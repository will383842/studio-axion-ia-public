/** Profil du format « image-video » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_IMAGE_VIDEO: ProfilVideo = figerProfil({
  id: "image-video/1", formatId: "image-video", version: 1,
  capacites: {
    // prod, déjà utilisé : src/moteurs/montage-image-video/variete/axes/transitions.ts:2 (axe transitions)
    [ID.transitionImageVideo]: { permis: true },
    // permis: false : prévu ou éteint, jamais allumé par le code
    [ID.texteSurlignageMarqueur]: { permis: false, maxParVideo: 1, decision: "S1, Q3" },
    [ID.texteStyleVarie]: { permis: false, maxParVideo: 1, decision: "S2, Q3 (C2-U5bis)" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
  blocs: { texteEcran: { teintes: ["terracotta", "ivoire", "ardoise"], cibles: ["souligne", "expression", "mot-dit"], pave: false, outils: false, bandeauNom: false, intensites: [], signaturesAEviter: 3 } },
});
