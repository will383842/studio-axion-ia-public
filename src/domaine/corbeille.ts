/** Corbeille de 30 jours (décision de Will du 18/10) : règles pures, partagées par le serveur et les écrans. */
import type { StatutVideo } from "./types";

export const JOURS_CORBEILLE = 30;
const JOUR_MS = 86_400_000;

/** Jours avant la suppression définitive (30 le jour même ; 0 seulement quand le délai est écoulé). */
export function joursRestants(corbeilleLe: string, maintenantMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(corbeilleLe) + JOURS_CORBEILLE * JOUR_MS - maintenantMs) / JOUR_MS));
}

export function phraseSuppressionDans(jours: number): string {
  return jours <= 0 ? "Supprimée aujourd'hui" : jours === 1 ? "Supprimée dans 1 jour" : `Supprimée dans ${jours} jours`;
}

/** Message après « Mettre à la corbeille » : restaurable 30 jours, et les brouillons laissés dans Buffer. */
export function messageCorbeille(mises: number, brouillonsBuffer: number, pagesRetirees = 0): string {
  const base = `${mises > 1 ? `${mises} vidéos mises à la corbeille` : "Vidéo mise à la corbeille"}. Restaurable pendant ${JOURS_CORBEILLE} jours.`;
  const buffer = brouillonsBuffer ? ` ${brouillonsBuffer} brouillon${brouillonsBuffer > 1 ? "s restent" : " reste"} dans Buffer : à supprimer dans Buffer.` : "";
  const site = pagesRetirees ? ` ${pagesRetirees > 1 ? `${pagesRetirees} pages du site sont retirées` : "La page du site est retirée"} : à republier après la restauration.` : "";
  return `${base}${buffer}${site}`;
}

/** « Annuler cette vidéo » n'existe que pour une vidéo NON TERMINÉE : jamais une prête, jamais une déjà archivée. */
export function statutAnnulable(statut: StatutVideo): boolean {
  return statut !== "prete" && statut !== "archivee";
}

/** Une vidéo qui a une version finie (`versionChoisieId`) n'est jamais annulée, même si une retouche ratée ou arrêtée l'a passée en échec / annulée. */
export function peutAnnuler(v: { statut: StatutVideo; versionChoisieId?: string | null }): boolean {
  return statutAnnulable(v.statut) && !v.versionChoisieId;
}

/** Une vidéo restaurée ne revient pas sur le site : sa page a été retirée à la mise à la corbeille. */
export const NOTE_RESTAURATION = "sa page du site n'est pas remise : à republier si besoin.";
/** « ; <note> » seulement pour une vidéo venue de la corbeille (une simple archive ne retire rien du site). */
export const noteRestauration = (corbeilleLe?: string): string => (corbeilleLe ? `; ${NOTE_RESTAURATION}` : "");
