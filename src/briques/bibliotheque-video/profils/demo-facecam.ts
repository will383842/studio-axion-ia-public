/** Profil du format « demo-facecam » (G3-11) : donnée pure, rien n'est lu par le rendu. Rien sur le visage : ni pavé ni repère épaule. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_DEMO_FACECAM: ProfilVideo = figerProfil({
  id: "demo-facecam/1", formatId: "demo-facecam", version: 1,
  capacites: {
    // plan de scènes et cadrage zoom de la démo : déjà en production (src/moteurs/montage-demo-facecam/)
    [ID.planScenesDemoFacecam]: { permis: true, decision: "G3-11" },
    [ID.cadrageZoomDemo]: { permis: true, decision: "G3-11" },
    // rien sur le visage
    [ID.textePave]: { permis: false, decision: "G3-11" },
    [ID.texteRepereEpaule]: { permis: false, decision: "G3-11" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
});
