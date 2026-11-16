/**
 * Profondeur réelle de chaque mémoire lue (C1-U6a), relevée dans le code existant (A1-9) : lue par la fiche C1-U12.
 * Constantes pures : aucun import hors types, pas de `server-only`. C1-U6b y ajoute ses trois lignes.
 */
import type { SourceMemoire } from "./types";

export const PROFONDEUR_MEMOIRE: Readonly<Partial<Record<SourceMemoire, { videos: number; ou: string }>>> = Object.freeze({
  "avocat-cartes": { videos: 5, ou: "src/services/avocat-branchements.ts:86 (.slice(0, 5))" },
  "v4-familles": { videos: 5, ou: "src/services/facecam-animee.ts:252 (.slice(0, 5))" },
  "v4-extraits": { videos: 5, ou: "même lecture que les familles v4 (travaux facecam-animee, .slice(0, 5))" },
  illustrations: { videos: 1, ou: "derniereVideoId par élément (src/domaine/types.ts:449-451), anti-répétition à 10 vidéos" },
  "cas-concret-tirages": { videos: 42, ou: "src/services/cas-concret-variete.ts:16-20 (réglage casConcret.historiqueTirages, 42 au plus)" },
  "tableau-styles": { videos: 42, ou: "src/services/tableau-variete.ts:10-15 (TAILLE_HISTORIQUE_STYLES, src/moteurs/montage-tableau/tirage-style.ts:15)" },
  "image-video-variete": { videos: 10, ou: "HISTORIQUE_VARIETE_IV, src/moteurs/montage-image-video/fabrication.ts:605" },
  "bibliotheque-video": { videos: 0, ou: "fenêtre du profil" },
});
