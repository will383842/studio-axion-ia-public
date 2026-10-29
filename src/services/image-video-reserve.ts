/**
 * IMAGE → VIDÉO · RÉSERVE de scripts et d'idées (service). Un seul document `parametres` sous `imageVideo.reserve`,
 * relu / réécrit à chaque geste, toute écriture sous `sousVerrou` (comme le lot).
 *
 * Aucune boucle de fond : rien ne se fabrique sans un clic de Will (`fabriquerSuivantReserveIV`, UNE vidéo). Le prix
 * informe seulement : l'accord du dépôt est le prix du jour (`prixDuDepot`), redemandé une seule fois si le moteur
 * renvoie un autre montant. Un lancement interrompu laisse un « orphelin » ; avant de le relancer on cherche son
 * brouillon (même texte, créé après `lanceeLe`) : jamais de doublon.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import {
  NOTE_A_RELIRE_IV,
  ORPHELIN_APRES_MS_IV,
  PHRASES_RESERVE_IV,
  ajouterIV,
  appliquerIssueReserveIV,
  lierVideoIV,
  marquerLancementIV,
  orphelinIV,
  prochainIV,
  remettreAFaireIV,
  reserveVideIV,
  retirerIV,
  type ElementReserveIV,
  type IssueReserveIV,
  type NatureReserveIV,
  type ReserveIV,
} from "@/domaine/image-video/reserve";
import { PHRASE_TIKTOK_RETIRE_IV, RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { Id } from "@/domaine/types";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { ErreurStudio, depots, ecrireParametre, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { PHRASES_IV, prixDuDepot } from "./image-video-ecran";
import { dernierTravail, issueDuTravail, videoEcartee } from "./image-video-lot";
import { deposerScriptImageVideo, deposerTexteImageVideo, type DependancesTexteIV, type IssueDepotTexteIV } from "./image-video-texte";

export const PARAM_RESERVE_IV = "imageVideo.reserve";

export async function lireReserveIV(): Promise<ReserveIV> {
  return lireParametre<ReserveIV>(PARAM_RESERVE_IV, reserveVideIV());
}

/** À appeler SOUS `sousVerrou`. */
const ecrireBrut = (r: ReserveIV) => ecrireParametre(PARAM_RESERVE_IV, r);

export async function ecrireReserveIV(r: ReserveIV): Promise<void> {
  await sousVerrou(() => ecrireBrut(r));
}

/** Relit, transforme et réécrit sous verrou (n'écrit que si la réserve a changé). */
async function modifier<T>(f: (r: ReserveIV) => { reserve: ReserveIV; sortie: T }): Promise<T> {
  return sousVerrou(async () => {
    const avant = await lireReserveIV();
    const { reserve, sortie } = f(avant);
    if (reserve !== avant) await ecrireBrut(reserve);
    return sortie;
  });
}

/** Issue d'une vidéo liée d'après son dernier travail ; `null` : rien n'a changé. */
async function issueDeLaVideo(videoId: Id): Promise<IssueReserveIV | null> {
  const travail = await dernierTravail(videoId);
  if (!travail) return (await videoEcartee(videoId)) ? "supprimee" : null;
  if (travail.statut === "annule") return "annulee";
  const i = issueDuTravail(travail);
  if (i.statut === "faite") return "faite";
  if (i.statut === "mise-de-cote") return i.miseDeCote?.porte === "arret" ? "arret" : "mise-de-cote";
  return null;
}

/** La réserve, recalculée depuis les travaux des vidéos liées (idempotent). */
export async function vueReserveIV(): Promise<ReserveIV> {
  return sousVerrou(async () => {
    const avant = await lireReserveIV();
    let r = avant;
    for (const e of avant.elements) {
      if (e.etat !== "en-cours" || !e.videoId) continue;
      const issue = await issueDeLaVideo(e.videoId);
      if (issue) r = appliquerIssueReserveIV(r, e.id, issue);
    }
    if (r !== avant) await ecrireBrut(r);
    return r;
  });
}

export type IssueAjoutReserveIV = { statut: "ajoute"; element: ElementReserveIV } | { statut: "refuse"; phrase: string };

export async function ajouterReserveIV(e: { nature: NatureReserveIV; texte: string; reseaux?: readonly string[] }): Promise<IssueAjoutReserveIV> {
  await exigerSession();
  const reseaux = RESEAUX_IV.filter((r) => (e.reseaux ?? RESEAUX_IV).includes(r));
  if (!reseaux.length) return { statut: "refuse", phrase: (e.reseaux ?? []).includes("tiktok") ? PHRASE_TIKTOK_RETIRE_IV : PHRASES_IV.sansReseau };
  const id = `res-${randomUUID().slice(0, 12)}`;
  const a = maintenant();
  return modifier<IssueAjoutReserveIV>((r) => {
    const issue = ajouterIV(r, { nature: e.nature === "script" ? "script" : "idee", texte: e.texte, reseaux }, id, a);
    return issue.ok ? { reserve: issue.reserve, sortie: { statut: "ajoute", element: issue.element } } : { reserve: r, sortie: { statut: "refuse", phrase: issue.phrase } };
  });
}

/** Seul un élément à faire se retire ; il passe à « retiré » et reste dans la réserve. */
export async function retirerReserveIV(id: string): Promise<boolean> {
  await exigerSession();
  return modifier((r) => {
    const suivant = retirerIV(r, id);
    return { reserve: suivant, sortie: suivant !== r };
  });
}

export type IssueFabricationReserveIV =
  | { statut: "vide" }
  /** Un lancement est déjà en route (double clic) : rien n'est déposé. */
  | { statut: "occupe" }
  | { statut: "lancee"; id: string; videoId: Id; reprise?: true }
  | { statut: "refusee"; id: string; phrase: string };

export interface DependancesReserveIV {
  /** Doubles du dépôt (tests). */
  depot?: DependancesTexteIV;
  taux?: () => Promise<number>;
}

/**
 * Brouillon Image → vidéo de l'orphelin : posé avec sa `reserveId` ; à défaut (ancien dépôt) même texte, même nature
 * (`scriptColle`), créé après le lancement interrompu et pas déjà lié à un autre élément de la réserve.
 */
async function brouillonDeLOrphelin(e: ElementReserveIV, r: ReserveIV): Promise<Id | null> {
  const depuis = e.lanceeLe ?? e.ajouteLe;
  const liees = new Set(r.elements.map((x) => x.videoId).filter((v): v is string => !!v));
  const liste = await depots().videos.lister((v) => {
    if (v.formatId !== ID_FORMAT_IMAGE_VIDEO || v.statut === "archivee" || v.creeLe < depuis || liees.has(v.id)) return false;
    const iv = (v.entrees?.imageVideo ?? {}) as { texte?: unknown; scriptColle?: unknown; reserveId?: unknown };
    if (typeof iv.reserveId === "string") return iv.reserveId === e.id;
    return typeof iv.texte === "string" && iv.texte.normalize("NFC").trim() === e.texte && (iv.scriptColle === true) === (e.nature === "script");
  });
  return liste.sort((a, b) => a.creeLe.localeCompare(b.creeLe))[0]?.id ?? null;
}

/** Ce que le prochain clic fabriquerait (l'orphelin d'abord, sinon le prochain à faire) : nombre de réseaux et prix « au plus ». Information seulement. */
export function apercuSuivantReserveIV(r: ReserveIV, tauxUsdEur: number): { reseaux: number; centimes: number } | null {
  const e = orphelinIV(r, maintenant()) ?? prochainIV(r);
  if (!e) return null;
  const reseaux = RESEAUX_IV.filter((x) => e.reseaux.includes(x));
  return { reseaux: reseaux.length, centimes: prixDuDepot(reseaux, tauxUsdEur) };
}

/**
 * UN clic = UNE fabrication. Sous verrou : l'orphelin éventuel (sinon le prochain à faire) est marqué « en cours ».
 * Hors verrou : le dépôt (script dit tel quel, idée décrite). Puis sous verrou : vidéo liée, ou retour à faire en fin de file.
 */
export async function fabriquerSuivantReserveIV(dep: DependancesReserveIV = {}): Promise<IssueFabricationReserveIV> {
  await exigerSession();
  const choix = await sousVerrou<"occupe" | { element: ElementReserveIV } | { repris: ElementReserveIV; videoId: Id } | null>(async () => {
    const r = await lireReserveIV();
    const t = Date.parse(maintenant());
    // Un lancement récent, sans vidéo : un autre clic est déjà en route (pas d'orphelin avant le délai).
    const enRoute = r.elements.some((e) => e.etat === "en-cours" && !e.videoId && e.lanceeLe && t - Date.parse(e.lanceeLe) <= ORPHELIN_APRES_MS_IV);
    if (enRoute) return "occupe";
    const orphelin = orphelinIV(r, maintenant());
    if (orphelin) {
      const videoId = await brouillonDeLOrphelin(orphelin, r);
      if (videoId) {
        // Un brouillon sans travail n'a jamais été lancé : on l'archive (conservé) et on relance normalement.
        if (await dernierTravail(videoId)) {
          await ecrireBrut(lierVideoIV(r, orphelin.id, videoId));
          return { repris: orphelin, videoId };
        }
        const { abandonnerBrouillon } = await import("./videos");
        await abandonnerBrouillon(videoId);
      }
    }
    const element = orphelin ?? prochainIV(r);
    if (!element) return null;
    await ecrireBrut(marquerLancementIV(r, element.id, maintenant()));
    return { element };
  });
  if (!choix) return { statut: "vide" };
  if (choix === "occupe") return { statut: "occupe" };
  if ("repris" in choix) return { statut: "lancee", id: choix.repris.id, videoId: choix.videoId, reprise: true };

  const { element } = choix;
  const reseaux = RESEAUX_IV.filter((r) => element.reseaux.includes(r)) as ReseauIV[];
  const taux = await (dep.taux ?? (() => lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT)))();
  const deposer = (accordCentimes: number): Promise<IssueDepotTexteIV> =>
    element.nature === "script"
      ? deposerScriptImageVideo({ script: element.texte, reserveId: element.id, reseaux, accordCentimes }, dep.depot)
      : deposerTexteImageVideo({ texte: element.texte, reserveId: element.id, reseaux, accordCentimes }, dep.depot);
  let issue: IssueDepotTexteIV;
  try {
    issue = await deposer(prixDuDepot(reseaux, taux));
    if (issue.statut === "accord-requis") issue = await deposer(issue.centimes);
  } catch (e) {
    // Le dépôt a pu créer le brouillon avant de tomber : on le retrouve (reserveId) avant toute remise à faire.
    const brouillon = await brouillonDeLOrphelin(element, await lireReserveIV());
    if (brouillon) {
      if (await dernierTravail(brouillon)) {
        await modifier((r) => ({ reserve: lierVideoIV(r, element.id, brouillon), sortie: null }));
        return { statut: "lancee", id: element.id, videoId: brouillon, reprise: true };
      }
      const { abandonnerBrouillon } = await import("./videos");
      await abandonnerBrouillon(brouillon);
    }
    // Une phrase métier est la note ; une panne imprévue revient à faire, à relire.
    const metier = e instanceof ErreurStudio;
    if (!metier) console.error(e);
    const phrase = metier ? e.message : PHRASES_RESERVE_IV.panne;
    await modifier((r) => ({ reserve: remettreAFaireIV(r, element.id, metier ? e.message : NOTE_A_RELIRE_IV), sortie: null }));
    return { statut: "refusee", id: element.id, phrase };
  }

  if (issue.statut === "lancee") {
    const videoId = issue.videoId;
    await modifier((r) => ({ reserve: lierVideoIV(r, element.id, videoId), sortie: null }));
    return { statut: "lancee", id: element.id, videoId };
  }
  const phrase = issue.phrase;
  await modifier((r) => ({ reserve: remettreAFaireIV(r, element.id, phrase), sortie: null }));
  return { statut: "refusee", id: element.id, phrase };
}
