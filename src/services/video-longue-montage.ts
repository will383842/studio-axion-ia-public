/**
 * MONTAGE RÉEL DE LA « VIDÉO LONGUE » côté Studio (lot UI-4) : le port `monter` du moteur `montage-video-longue`.
 *
 *  1. plan 16:9 par chapitre, SANS IA (`planVideoLongue`, niveau 1) : aucun appel Claude, 0 € ;
 *  2. sous-titres (`fabriquerSousTitres`) sur les mêmes mots, passés en `proprietes.sousTitres` ;
 *  3. un morceau muet par plage d'images (`rendreChapitres`, une plage à la fois sur le service de rendu) ; chaque morceau
 *     terminé est NOTÉ (paramètre `videoLongue.plages.<videoId>`) : un redémarrage ne refait pas une plage rendue ;
 *  4. collage des morceaux (`collage-chapitres`) : SANS voix en mode sans voix (aucune piste son).
 *
 * Ce module ne parle jamais à HeyGen ni à ElevenLabs et n'importe aucun fournisseur de voix. Les ports (rendu, signatures,
 * clés, reprise) sont injectés : les tests n'ont aucun réseau. Les gardes d'argent restent dans `video-longue-branchements`.
 */
import { createHash } from "node:crypto";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import type { SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { COMPOSITION_VIDEO_LONGUE, type DependancesVideoLongue } from "@/moteurs/montage-video-longue/chaine";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { planVideoLongue, type ChapitrePourPlan, type FormatVideoLongue } from "@/moteurs/montage-video-longue/plan";
import { rendreChapitres, type DemandePlage, type MorceauRendu, type PortRenduPlage } from "@/moteurs/montage-video-longue/rendu-chapitres";

export const NOM_FICHIER_VIDEO_LONGUE_16X9 = "video-longue-16x9.mp4";
/** Paramètre où sont notées les plages rendues, par vidéo (reprise après redémarrage). */
export const cleParametrePlages = (videoId: string): string => `videoLongue.plages.${videoId}`;
/** Attente entre deux lectures de l'état d'un rendu. */
export const INTERVALLE_ETAT_RENDU_MS = 5_000;
/** Délai du collage (sans réencodage : court). */
export const DELAI_COLLAGE_MS = 20 * 60_000;
/** Mots au plus par segment calé (un segment finit aussi à la ponctuation de fin de phrase). */
const MOTS_PAR_SEGMENT_MAX = 18;

type Contexte = Parameters<DependancesVideoLongue["monter"]>[1];

/** Plage notée : la clé du morceau et l'empreinte de ce qui l'a produit (une retouche ne réutilise jamais un vieux morceau). */
export type PlageNotee = { sortieCle: string; empreinte: string };

export interface PortsMontageVideoLongue {
  rendu: ServiceRendu;
  signer: (lectures: Record<string, string>, depots: { cle: string; mime: string }[]) => Promise<{ lectures: Record<string, string>; depots: Record<string, string> }>;
  /** Clé de stockage d'une sortie de la vidéo (`studio/{env}/videos/{videoId}/{nom}`). */
  cle: (c: CommandeFabrication, nom: string) => string;
  lirePlages(videoId: string): Promise<Record<string, PlageNotee>>;
  ecrirePlages(videoId: string, plages: Record<string, PlageNotee>): Promise<void>;
  /** Attente entre deux lectures d'état (tests : rien). */
  attendre?: (ms: number) => Promise<void>;
  intervalleMs?: number;
  delaiCollageMs?: number;
}

/** Erreur du montage : non réessayable quand c'est le script lui-même qui est en cause (`problemes` dit quoi). */
export class ErreurMontageVideoLongue extends Error {
  constructor(message: string, readonly problemes: string[] = [], readonly reessayable = false) {
    super(message);
    this.name = "ErreurMontageVideoLongue";
  }
}

const empreinte = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const attendreParDefaut = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Segments d'un chapitre, calés sur le temps des mots, en temps de la vidéo ENTIÈRE. PUR. */
export function segmentsDuChapitre(mots: MotHorodate[], debutMs: number, finMs: number): SegmentCale[] {
  const segments: SegmentCale[] = [];
  let courant: MotHorodate[] = [];
  const clore = () => {
    if (!courant.length) return;
    const d = Math.min(finMs, Math.max(debutMs, Math.round(courant[0].debutSec * 1000)));
    const f = Math.min(finMs, Math.max(d, Math.round(courant[courant.length - 1].finSec * 1000)));
    segments.push({ texte: courant.map((m) => m.mot).join(" "), debutMs: d, finMs: f });
    courant = [];
  };
  for (const m of mots) {
    courant.push(m);
    if (/[.!?…]$/.test(m.mot) || courant.length >= MOTS_PAR_SEGMENT_MAX) clore();
  }
  clore();
  return segments;
}

/** Chapitres pour le plan : les mots de chaque chapitre sont ceux qui commencent dans sa tranche de temps. PUR. */
export function chapitresPourPlan(ctx: Contexte): ChapitrePourPlan[] {
  return ctx.chapitres.map((c, i) => {
    const debutMs = Math.round(c.debutSec * 1000);
    const finMs = Math.round(c.finSec * 1000);
    const dernier = i === ctx.chapitres.length - 1;
    const mots = ctx.mots.filter((m) => m.debutSec * 1000 >= debutMs - 1 && (dernier || m.debutSec * 1000 < finMs));
    return { id: `c${i + 1}`, debutMs, finMs, segments: segmentsDuChapitre(mots, debutMs, finMs) };
  });
}

/** Soumet une demande et attend sa fin ; `inconnu` = le conteneur a redémarré : même demande, soumise à nouveau. */
async function soumettreEtAttendre(demande: DemandeRendu, ports: PortsMontageVideoLongue, signal: AbortSignal): Promise<{ sortieCle: string }> {
  const attendre = ports.attendre ?? attendreParDefaut;
  await ports.rendu.soumettre(demande);
  for (;;) {
    if (signal.aborted) throw new Error("délai dépassé");
    const e = await ports.rendu.etat(demande.idRendu);
    if (e.statut === "termine") return { sortieCle: e.sortieCle || demande.sortie.cle };
    if (e.statut === "echec") throw new Error(`Le rendu a échoué : ${e.erreur.message}`);
    if (e.statut === "inconnu") await ports.rendu.soumettre(demande);
    else await attendre(ports.intervalleMs ?? INTERVALLE_ETAT_RENDU_MS);
  }
}

/** Port de rendu d'une plage : opération `composition` (mode `plage`), file longue, morceau muet déposé sous une clé stable. */
function portRenduPlage(commande: CommandeFabrication, ports: PortsMontageVideoLongue): PortRenduPlage {
  return {
    async rendre(d: DemandePlage) {
      const cle = ports.cle(commande, `video-longue-plages/${d.idRendu}.mp4`);
      const signe = await ports.signer({}, [{ cle, mime: "video/mp4" }]);
      const demande: DemandeRendu = { idRendu: d.idRendu, operation: "composition", file: d.file, entrees: {}, sortie: { urlDepot: signe.depots[cle], cle }, parametres: d.parametres };
      return soumettreEtAttendre(demande, ports, d.signal);
    },
  };
}

/** Plan sans scène (PUR) : mêmes habillage et durée que les autres chapitres, rien à dessiner de plus. */
function planVide(format: FormatVideoLongue, dureeMs: number): PlanValide {
  return { version: "plan-scenes-1", format, facecam: false, dureeMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes: [] } as unknown as PlanValide;
}

/** Paramètres du collage : `m0..mN` dans l'ordre ; `voix` seulement si une voix est donnée (jamais en sans-voix). PUR. */
export function parametresCollage(nbMorceaux: number, avecVoix: boolean): { noms: string[]; parametres: Record<string, unknown> } {
  const noms = Array.from({ length: nbMorceaux }, (_, i) => `m${i}`);
  return { noms, parametres: { morceaux: noms, ...(avecVoix ? { voix: "voix" } : {}) } };
}

/**
 * Monte la vidéo longue (16:9) et rend `{ fichierCle }`. Aucun appel IA, aucun fournisseur de voix.
 * Seul le mode sans voix est relié ici : la pose d'une voix au collage n'est pas branchée (voir `video-longue-branchements`).
 */
export async function monterVideoLongue(commande: CommandeFabrication, travailId: string, ctx: Contexte, ports: PortsMontageVideoLongue): Promise<{ fichierCle: string }> {
  const videoId = commande.videoId;
  const plan = await planVideoLongue(chapitresPourPlan(ctx));
  if (!plan.valide) throw new ErreurMontageVideoLongue(`Le plan de la vidéo n'a pas pu être préparé : ${plan.problemes.join(" ")}`, plan.problemes);

  const sousTitres = fabriquerSousTitres({ texte: ctx.mots.map((m) => m.mot).join(" "), dureeSec: ctx.dureeSec, mots: ctx.mots, ratio: "16:9" });

  // Reprise : seules les plages notées avec la MÊME empreinte (même plan, mêmes bornes, mêmes sous-titres) sont gardées.
  const notees = await ports.lirePlages(videoId);
  const toutes: Record<string, PlageNotee> = { ...notees };
  const morceaux: MorceauRendu[] = [];
  const rendu = portRenduPlage(commande, ports);
  for (const c of plan.chapitres) {
    // Aucune scène à poser sur ce chapitre : plan vide de la bonne durée (le fond et les sous-titres restent dessinés).
    const planChapitre = c.plan ?? planVide(plan.format, c.finMs);
    const empreinteChapitre = empreinte({ plan: planChapitre, debutMs: c.debutMs, finMs: c.finMs, sousTitres });
    const dejaRendus: Record<string, string> = {};
    for (const [id, n] of Object.entries(notees)) if (n.empreinte === empreinteChapitre && id.startsWith(`${travailId}-${c.id}-p`)) dejaRendus[id] = n.sortieCle;
    morceaux.push(
      ...(await rendreChapitres(
        {
          idVideo: travailId,
          composition: COMPOSITION_VIDEO_LONGUE,
          proprietes: { plan: planChapitre, sousTitres },
          chapitres: [{ id: c.id, debutMs: c.debutMs, finMs: c.finMs }],
          dejaRendus,
          apresPlage: async (m) => {
            toutes[m.idRendu] = { sortieCle: m.sortieCle, empreinte: empreinteChapitre };
            await ports.ecrirePlages(videoId, toutes);
          },
        },
        rendu,
      )),
    );
  }

  // Collage : sans voix, aucune piste son.
  const { noms, parametres } = parametresCollage(morceaux.length, false);
  const sortieCle = ports.cle(commande, NOM_FICHIER_VIDEO_LONGUE_16X9);
  const signe = await ports.signer(Object.fromEntries(noms.map((n, i) => [n, morceaux[i].sortieCle])), [{ cle: sortieCle, mime: "video/mp4" }]);
  const demande: DemandeRendu = {
    idRendu: `${travailId}-collage`,
    operation: "collage-chapitres",
    file: "longue",
    entrees: Object.fromEntries(noms.map((n) => [n, signe.lectures[n]])),
    sortie: { urlDepot: signe.depots[sortieCle], cle: sortieCle },
    parametres,
  };
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), ports.delaiCollageMs ?? DELAI_COLLAGE_MS);
  try {
    return { fichierCle: (await soumettreEtAttendre(demande, ports, controleur.signal)).sortieCle };
  } finally {
    clearTimeout(minuterie);
  }
}
