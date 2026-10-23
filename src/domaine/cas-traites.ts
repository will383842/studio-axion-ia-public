/**
 * CAS CONCRETS TRAITÉS (ordre de Will, 23/10/2026) : un cas dont la vidéo est ALLÉE AU BOUT n'est plus disponible
 * (ni dans la liste, ni dans « Proposez-moi un cas restant », ni estimable, lançable ou relançable), pour ne jamais
 * refaire deux vidéos identiques. PUR : aucun accès à la base ; le service (`services/cas-concret-traites.ts`) lit les
 * vidéos et les deux inscriptions durables, puis appelle `casTraites`.
 *
 * Vidéo FINIE = statut effectif `prete` (celui d'avant l'archivage pour une vidéo à la corbeille), format `cas-concret`,
 * ni démonstration, ni dérivée (variante de réseau, autre accroche), ni essai simulé (rien n'a été fabriqué pour de vrai).
 * En file, en fabrication, en pause « à valider », en panne, brouillon : le cas n'est PAS traité.
 *
 * Deux inscriptions durables :
 *  - `casTraites` ({ casId: { videoId, titre, le } }) : le cas reste traité même si sa vidéo est supprimée pour de bon ;
 *  - `casRemis` ({ casId: { remisLe, videoIds? } }) : Will a remis le cas en stock ; on ne compte alors que ce qui est
 *    fini APRÈS `remisLe` (et jamais les vidéos déjà comptées à ce moment-là, même retouchées ensuite).
 */
import { statutEffectif } from "./sujets-traites";
import type { StatutVideo } from "./types";

export const FORMAT_CAS_CONCRET = "cas-concret";
export const PHRASE_CAS_TRAITE = "Ce cas est déjà traité : il n'est plus disponible. Pour le rouvrir : Cas concret MD › Cas déjà faits › Remettre en stock.";
/** Refus d'une relance (panne) dont le cas est fini par une autre vidéo. */
export const PHRASE_RELANCE_CAS_TRAITE = "Une autre vidéo de ce cas est déjà finie : cette relance est refusée, rien n'est dépensé. Pour refaire ce cas, remettez-le en stock (Cas concret MD › Cas déjà faits › Remettre en stock).";
/** Travaux d'une vidéo déjà finie (retouche, réexport, sous-titres) : la garde « cas traité » ne les touche pas. */
export const TRAVAUX_SUR_VIDEO_FINIE: readonly string[] = ["retouche", "reexport", "recalque-sous-titres"];

/** Ce que la règle lit d'une vidéo. */
export interface VideoCasTraite {
  id: string;
  titre: string;
  formatId: string;
  statut: StatutVideo;
  statutAvantArchive?: StatutVideo;
  estDemo?: boolean;
  sourceVideoId?: string;
  typeDerive?: string;
  entrees?: Record<string, unknown>;
  terminee?: string;
  modifieLe?: string;
  /** Posé par le service : la version choisie est un essai simulé (`commandeEnEssai`). */
  essaiSimule?: boolean;
}

export interface InscriptionCasTraite {
  videoId?: string;
  titre: string;
  le: string;
}

export interface RemiseEnStock {
  remisLe: string;
  /** Vidéos déjà comptées au moment de la remise : elles ne rendent jamais le cas traité. */
  videoIds?: string[];
}

export interface CasTraite {
  /** Absent : la vidéo a été supprimée pour de bon (seule l'inscription reste). */
  videoId?: string;
  titre: string;
  le: string;
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Identifiant du cas d'une vidéo de cas concret (`entrees.casConcret.casId`). Absent pour la porte B (cas construit à chaque
 * description, jamais au catalogue : il n'est jamais « traité »).
 */
export function casIdDeLaVideo(v: Pick<VideoCasTraite, "entrees">): string | undefined {
  const cc = objet(objet(v.entrees).casConcret);
  // Même lecture que `lireEntreesCasConcret` : « porte-b » et son alias « b ».
  if (cc.porte === "porte-b" || cc.porte === "b") return undefined;
  const id = cc.casId;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

/** Une vidéo finie compte-t-elle (hors remise en stock) ? */
export function videoFinie(v: VideoCasTraite): boolean {
  if (v.formatId !== FORMAT_CAS_CONCRET || v.estDemo || v.sourceVideoId || v.typeDerive || v.essaiSimule) return false;
  return statutEffectif(v) === "prete";
}

export function casTraites(src: {
  videos: readonly VideoCasTraite[];
  inscrits?: Readonly<Record<string, InscriptionCasTraite>>;
  remis?: Readonly<Record<string, RemiseEnStock>>;
}): Map<string, CasTraite> {
  const sortie = new Map<string, CasTraite>();
  const remis = src.remis ?? {};
  const ids = new Set(src.videos.map((v) => v.id));
  const poser = (casId: string, c: CasTraite) => {
    const deja = sortie.get(casId);
    // La plus ancienne fait foi (date du premier traitement) ; la vidéo vivante est préférée à la seule inscription.
    if (!deja || (c.videoId && !deja.videoId) || (!!c.videoId === !!deja.videoId && c.le < deja.le)) sortie.set(casId, c);
  };
  const apresRemise = (casId: string, videoId: string | undefined, le: string): boolean => {
    const r = remis[casId];
    if (!r) return true;
    if (videoId && r.videoIds?.includes(videoId)) return false;
    return le > r.remisLe;
  };
  for (const v of src.videos) {
    if (!videoFinie(v)) continue;
    const casId = casIdDeLaVideo(v);
    if (!casId) continue;
    const le = v.terminee ?? v.modifieLe ?? "";
    if (!apresRemise(casId, v.id, le)) continue;
    poser(casId, { videoId: v.id, titre: v.titre, le });
  }
  for (const [casId, i] of Object.entries(src.inscrits ?? {})) {
    if (!i || typeof i.le !== "string" || !apresRemise(casId, i.videoId, i.le)) continue;
    poser(casId, { ...(i.videoId && ids.has(i.videoId) ? { videoId: i.videoId } : {}), titre: i.titre, le: i.le });
  }
  return sortie;
}
