import { createHash } from "node:crypto";
import type { Intention } from "@/briques/visuels/trames";
import { ToileSpec, type ToileSpecType } from "@/domaine/visuels/continu/schema-toile";
import type { ContextePorte, DemandeTexteCarrousel, FournisseurTexteCarrousel, RapportPorte } from "@/domaine/visuels/contrats";
import type { Depot } from "@/domaine/depots";
import { LIBELLES_STATUT, transitionPermise, type StatutVisuel } from "@/domaine/visuels/statuts";
import type { MotifRefus, Visuel } from "@/domaine/visuels/visuel";
import { ErreurVisuel, masquerSecrets, PHRASE_SERVEUR_NON_RELIE, RENDU_PERIME_MS, type DependancesCarrousels } from "@/visuels/services/carrousels";
import type { ResultatRenduToile } from "./rendu-toile";

/**
 * Cycle de vie d'un carrousel continu (une toile large découpée en pages) : mêmes statuts (`transitionPermise`), même verrou, même anti
 * double clic que `carrousels.ts`, qui n'est pas modifié (on importe `ErreurVisuel`, `masquerSecrets`, `RENDU_PERIME_MS`). TOUT est injecté.
 * La fiche vit dans la même collection `visuels`, avec `famille: "carrousel-continu"`.
 */

export interface DependancesContinus extends Pick<DependancesCarrousels, "depot" | "allume" | "verrou" | "maintenant" | "lireParametre" | "ecrireParametre" | "urlLecture" | "urlTelechargement"> {
  depot: Depot<Visuel>;
  texte: (d: DemandeTexteCarrousel) => FournisseurTexteCarrousel;
  /** Porte du texte de la toile : P4 la remplace par la vraie (`porte-continu`). */
  porte: (toile: unknown, ctx: ContextePorte) => { rapport: RapportPorte; toileCorrigee?: ToileSpecType };
  contextePorte: () => Promise<ContextePorte>;
  rendre: (toile: ToileSpecType) => Promise<ResultatRenduToile>;
  /** Note de 0 à 100 de la toile rendue : P4 la remplace par `noterToile` (`note-continu`). */
  noter: (toile: ToileSpecType) => number;
}

export const PHRASE_GENERATEUR_ETEINT = "Le générateur est éteint (Réglages › Carrousels)";
/** Sous cette note, un sujet en simulation est retouché ; sous `NOTE_BLOCAGE`, la fiche est bloquée une fois les retouches épuisées. */
export const NOTE_RETOUCHE = 90;
export const NOTE_BLOCAGE = 85;
export const VERSION_SPEC_MAX = 3;
const DOUBLE_CLIC_MS = 60_000;
const MOTIFS_REFUS: readonly MotifRefus[] = ["texte", "mise_en_page", "sujet", "ton", "autre"];
const CLE_SESSION = "carrousels-continus.session.";
const COMMENTAIRE_MAX = 500;
const TITRE_MAX = 120;
const SUJET_MIN = 3;
const SUJET_MAX = 200;
const SESSION_MAX = 100_000;
const LIEN = /(?:https?|ftp|mailto|file):|www\.|\/\/|[\p{L}\p{N}][\p{L}\p{N}-]*\.\p{L}{2,}/iu;
const PHRASE_ECHEC_FIXE = "Le rendu a échoué : réessayez avec « Relancer le rendu »";

const refus = (code: ErreurVisuel["code"], message: string, details?: string[]) => new ErreurVisuel(code, message, details);
const normaliser = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

async function exigerAllume(deps: DependancesContinus): Promise<void> {
  if (!(await deps.allume())) throw refus("GENERATEUR_ETEINT", PHRASE_GENERATEUR_ETEINT);
}

export async function lireToile(id: string, deps: Pick<DependancesContinus, "depot">): Promise<Visuel> {
  const v = await deps.depot.obtenir(id);
  if (!v || v.famille !== "carrousel-continu") throw refus("INTROUVABLE", "Ce carrousel est introuvable");
  return v;
}

/** Seul point de changement de statut. À appeler SOUS le verrou. */
async function transiter(id: string, vers: StatutVisuel, patch: Partial<Visuel>, deps: DependancesContinus): Promise<Visuel> {
  const v = await lireToile(id, deps);
  if (v.corbeilleLe) throw refus("TRANSITION_REFUSEE", "Ce carrousel est à la corbeille : restaurez-le d'abord");
  if (!transitionPermise(v.statut, vers)) throw refus("TRANSITION_REFUSEE", `Un carrousel « ${LIBELLES_STATUT[v.statut]} » ne peut pas passer à « ${LIBELLES_STATUT[vers]} »`);
  return deps.depot.modifier(id, { ...patch, statut: vers, modifieLe: deps.maintenant() });
}

function fournisseurPermis(demande: DemandeTexteCarrousel, deps: DependancesContinus): FournisseurTexteCarrousel {
  const f = deps.texte(demande);
  if (f.mode === "api") throw refus("API_PAYANTE_VERROUILLEE", "Le texte par API payante est verrouillé");
  return f;
}

/** Écrit le texte de la toile, passe la porte, puis range le brouillon `id` en « ecrit » ou « bloque ». */
async function rediger(id: string, fournisseur: FournisseurTexteCarrousel, demande: DemandeTexteCarrousel, deps: DependancesContinus): Promise<void> {
  const ranger = (vers: StatutVisuel, patch: Partial<Visuel>) =>
    deps.verrou(async () => {
      const v = await deps.depot.obtenir(id);
      if (!v || v.corbeilleLe) return;
      await transiter(id, vers, patch, deps);
    });
  const bloquer = (erreur: string, patch: Partial<Visuel> = {}) => ranger("bloque", { ...patch, erreur });
  let reponse;
  try {
    reponse = await fournisseur.ecrire(demande);
  } catch {
    await bloquer(demande.type === "sujet" ? "L'écriture du texte a échoué : réessayez avec « Refaire »" : "La lecture du texte déposé a échoué : déposez un texte corrigé");
    return;
  }
  if (!reponse) {
    await bloquer("La réponse du texte est incomplète");
    return;
  }
  let controle;
  try {
    controle = deps.porte(reponse.spec, await deps.contextePorte());
  } catch {
    await bloquer("Le texte n'a pas pu être contrôlé par la porte");
    return;
  }
  const { rapport } = controle;
  const lue = rapport.verdict === "rouge" ? undefined : ToileSpec.safeParse(reponse.spec);
  const toile = controle.toileCorrigee ?? (lue?.success ? lue.data : undefined);
  const pagesEcrites = (reponse.spec as { pages?: unknown } | null)?.pages;
  const patch: Partial<Visuel> = {
    titre: reponse.titre.trim().slice(0, TITRE_MAX) || "Carrousel continu",
    pourquoi: [...reponse.pourquoi],
    modeTexte: reponse.mode,
    rapport,
    toile,
    noteTexte: reponse.note,
    pagesTexte: Array.isArray(pagesEcrites) ? Math.min(pagesEcrites.length, 10) : undefined,
  };
  if (rapport.verdict === "rouge") await ranger("bloque", patch);
  else if (!toile) await bloquer("La porte n'a rendu aucun texte corrigé", patch);
  else await ranger("ecrit", patch);
}

async function demarrer(entree: Visuel["entree"], demande: DemandeTexteCarrousel, titre: string, empreinteSession: string | null, deps: DependancesContinus): Promise<{ id: string }> {
  await exigerAllume(deps);
  const fournisseur = fournisseurPermis(demande, deps);
  const cle = entree.type === "sujet" ? normaliser(entree.sujet) : null;
  const { id, neuf } = await deps.verrou(async () => {
    const maintenant = deps.maintenant();
    if (cle !== null) {
      const recent = await deps.depot.trouver(
        (v) =>
          v.famille === "carrousel-continu" &&
          v.entree.type === "sujet" &&
          normaliser(v.entree.sujet) === cle &&
          !v.corbeilleLe &&
          (v.statut === "brouillon" || v.statut === "ecrit" || v.statut === "rendu_en_cours") &&
          Date.parse(maintenant) - Date.parse(v.creeLe) < DOUBLE_CLIC_MS,
      );
      if (recent) return { id: recent.id, neuf: false };
    }
    if (empreinteSession !== null) {
      const vu = await deps.lireParametre<{ id: string; le: string } | null>(CLE_SESSION + empreinteSession, null);
      if (vu && Date.parse(maintenant) - Date.parse(vu.le) < DOUBLE_CLIC_MS) {
        const existant = await deps.depot.obtenir(vu.id);
        if (existant && !existant.corbeilleLe) return { id: existant.id, neuf: false };
      }
    }
    const nouveau: Visuel = {
      id: `vis_${crypto.randomUUID()}`,
      famille: "carrousel-continu",
      titre: titre.slice(0, TITRE_MAX),
      entree,
      statut: "brouillon",
      modeTexte: entree.type === "session" ? "session" : "simulation",
      versionSpec: 1,
      coutCentimes: 0,
      creeLe: maintenant,
      modifieLe: maintenant,
    };
    await deps.depot.enregistrer(nouveau);
    if (empreinteSession !== null) await deps.ecrireParametre(CLE_SESSION + empreinteSession, { id: nouveau.id, le: maintenant });
    return { id: nouveau.id, neuf: true };
  });
  if (neuf) await rediger(id, fournisseur, demande, deps);
  return { id };
}

export async function creerToileDepuisSujet(sujet: string, deps: DependancesContinus, intention?: Intention): Promise<{ id: string }> {
  await exigerAllume(deps);
  const net = sujet.trim();
  if (net.length < SUJET_MIN || net.length > SUJET_MAX || LIEN.test(net)) throw refus("SUJET_INVALIDE", `Le sujet fait de ${SUJET_MIN} à ${SUJET_MAX} signes, sans lien`);
  const avecIntention = intention ? { intention } : {};
  return demarrer({ type: "sujet", sujet: net, ...avecIntention }, { type: "sujet", sujet: net, ...avecIntention }, net, null, deps);
}

export async function deposerSessionToile(contenu: string, deps: DependancesContinus): Promise<{ id: string }> {
  await exigerAllume(deps);
  if (!contenu.trim() || contenu.length > SESSION_MAX) throw refus("PAQUET_INVALIDE", "Le fichier de session est vide ou trop long", ["Le texte déposé est vide ou trop long."]);
  // Le paquet `paquet-session-toile/1` est lu par le fournisseur de texte (P4b) : un paquet illisible bloque la fiche avec sa phrase.
  return demarrer({ type: "session" }, { type: "paquet-session", contenu }, "Carrousel continu depuis une session", createHash("sha256").update(contenu).digest("hex"), deps);
}

/** Phrases écrites par le rendu de la toile pour l'équipe : gardées telles quelles. Tout autre message (adresse, chemin, pile) n'est jamais recopié. */
const PHRASE_TOILE = /^La (?:toile|page \d+)\b[^\n]{0,280}$/;
const PHRASES_CONNUES = [/^Le serveur du studio n'a pas fini à temps\.$/];

function phraseEchec(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  if (PHRASE_TOILE.test(message) || PHRASES_CONNUES.some((r) => r.test(message))) return masquerSecrets(message).slice(0, 300);
  return /mesure/i.test(message) ? PHRASE_SERVEUR_NON_RELIE : PHRASE_ECHEC_FIXE;
}

function journaliserEchec(id: string, e: unknown): void {
  try {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(`[carrousels-continus] rendu échoué | visuel ${id} | ${masquerSecrets(err.stack ?? `${err.name}: ${err.message}`)}`);
  } catch {
    // Le journal ne doit jamais empêcher de conclure le rendu.
  }
}

export async function lancerRenduToile(id: string, deps: DependancesContinus): Promise<void> {
  await exigerAllume(deps);
  const jeton = deps.maintenant();
  const toile = await deps.verrou(async () => {
    const v = await lireToile(id, deps);
    if (v.statut === "rendu_en_cours" && !v.corbeilleLe) {
      if (v.renduDemandeLe && Date.parse(jeton) - Date.parse(v.renduDemandeLe) < RENDU_PERIME_MS) return null;
      await deps.depot.modifier(id, { renduDemandeLe: jeton, modifieLe: jeton });
      return v.toile ?? undefined;
    }
    await transiter(id, "rendu_en_cours", { renduDemandeLe: jeton, erreur: undefined }, deps);
    return v.toile ?? undefined;
  });
  if (toile === null) return;
  /** Vrai si CE lancement a conclu (un autre rendu relancé entre-temps a pu le faire avant). */
  const conclure = async (vers: StatutVisuel, patch: Partial<Visuel>): Promise<boolean> => {
    try {
      return await deps.verrou(async () => {
        const v = await lireToile(id, deps);
        if (v.renduDemandeLe === undefined || Date.parse(v.renduDemandeLe) !== Date.parse(jeton)) return false;
        await transiter(id, vers, patch, deps);
        return true;
      });
    } catch (e) {
      if (!(e instanceof ErreurVisuel && e.code === "TRANSITION_REFUSEE")) throw e;
      return false;
    }
  };
  let renduToile: NonNullable<Visuel["renduToile"]>;
  try {
    if (!toile) throw new Error("Ce carrousel n'a pas de toile à rendre");
    const r = await deps.rendre(toile);
    renduToile = { empreinte: r.empreinte, format: r.format, pages: r.pages, bandeCle: r.bandeCle, vignetteCle: r.vignetteCle, renduLe: deps.maintenant() };
  } catch (e) {
    journaliserEchec(id, e);
    await conclure("echec_rendu", { erreur: phraseEchec(e) });
    return;
  }
  if (!(await conclure("a_valider", { renduToile, erreur: undefined })) || !toile) return;
  await retoucherSiNecessaire(id, toile, deps);
}

/** Sujet en simulation seulement : sous 90, UN `refaireToile` (version +1) puis nouveau rendu, tant que `versionSpec` < 3 ; ensuite, sous 85 : « bloque ». */
async function retoucherSiNecessaire(id: string, toile: ToileSpecType, deps: DependancesContinus): Promise<void> {
  const v = await lireToile(id, deps);
  if (v.entree.type !== "sujet" || v.modeTexte !== "simulation" || v.statut !== "a_valider") return;
  const note = deps.noter(toile);
  if (note >= NOTE_RETOUCHE) return;
  if (v.versionSpec < VERSION_SPEC_MAX) {
    await refaireToile(id, deps);
    if ((await lireToile(id, deps)).statut === "ecrit") await lancerRenduToile(id, deps);
    return;
  }
  if (note >= NOTE_BLOCAGE) return;
  // La table des statuts n'a pas de « à valider → bloqué » : on passe par « refusé » puis « brouillon », sous le verrou.
  await deps.verrou(async () => {
    const frais = await lireToile(id, deps);
    if (frais.statut !== "a_valider") return;
    const entree = { motif: "autre" as const, commentaire: `note ${note}/100`, le: deps.maintenant() };
    await transiter(id, "refuse", { refus: [...(frais.refus ?? []), entree] }, deps);
    await transiter(id, "brouillon", {}, deps);
    await transiter(id, "bloque", { erreur: `note ${note}/100 : à refaire` }, deps);
  });
}

export async function validerToile(id: string, deps: DependancesContinus): Promise<void> {
  await deps.verrou(() => transiter(id, "valide", { valideLe: deps.maintenant() }, deps));
}

/** `page` est en base 0 : un entier de 0 à nombre de pages - 1. */
export async function refuserToile(id: string, motif: MotifRefus, page: number | undefined, commentaire: string | undefined, deps: DependancesContinus): Promise<void> {
  await deps.verrou(async () => {
    const v = await lireToile(id, deps);
    if (!MOTIFS_REFUS.includes(motif)) throw refus("TRANSITION_REFUSEE", "Ce motif de refus n'existe pas");
    if (page !== undefined && !(Number.isInteger(page) && page >= 0 && page < (v.toile?.pages.length ?? 0))) throw refus("TRANSITION_REFUSEE", "Cette page n'existe pas dans ce carrousel");
    const entree = { motif, ...(page !== undefined ? { page } : {}), ...(commentaire ? { commentaire: commentaire.slice(0, COMMENTAIRE_MAX) } : {}), le: deps.maintenant() };
    await transiter(id, "refuse", { refus: [...(v.refus ?? []), entree] }, deps);
  });
}

/** bloque|refuse|echec_rendu → brouillon → réécriture (sujet seulement). Depuis « à valider » : refus « autre » d'abord, la table reste intacte. */
export async function refaireToile(id: string, deps: DependancesContinus): Promise<void> {
  await exigerAllume(deps);
  const v = await lireToile(id, deps);
  if (v.entree.type === "session") throw refus("SESSION_ATTENDUE", "Ce carrousel vient d'une session : déposez un nouveau fichier");
  if (v.corbeilleLe) throw refus("TRANSITION_REFUSEE", "Ce carrousel est à la corbeille : restaurez-le d'abord");
  const demande: DemandeTexteCarrousel = { type: "sujet", sujet: v.entree.sujet, ...(v.entree.intention ? { intention: v.entree.intention } : {}) };
  const fournisseur = fournisseurPermis(demande, deps);
  if (v.statut === "a_valider") await refuserToile(id, "autre", undefined, undefined, deps);
  else if (!transitionPermise(v.statut, "brouillon")) throw refus("TRANSITION_REFUSEE", `Un carrousel « ${LIBELLES_STATUT[v.statut]} » ne se refait pas`);
  let version = 1;
  await deps.verrou(async () => {
    const frais = await lireToile(id, deps);
    version = frais.versionSpec + 1;
    await transiter(
      id,
      "brouillon",
      { versionSpec: version, toile: undefined, rapport: undefined, renduToile: undefined, renduDemandeLe: undefined, erreur: undefined, valideLe: undefined, pourquoi: undefined, noteTexte: undefined, pagesTexte: undefined },
      deps,
    );
  });
  await rediger(id, fournisseur, { ...demande, version }, deps);
}
