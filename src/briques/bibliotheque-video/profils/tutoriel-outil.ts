/** Profil du format « tutoriel-outil » (N-02) : donnée pure, rien n'est lu par le rendu. Pas de visage : aucun bloc texteEcran. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_TUTORIEL_OUTIL: ProfilVideo = figerProfil({
  id: "tutoriel-outil/1", formatId: "tutoriel-outil", version: 1,
  capacites: {
    // plan de scènes du tutoriel : déjà en production (src/moteurs/montage-tutoriel-outil/)
    [ID.planScenesTutorielOutil]: { permis: true, decision: "N-02" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
});
