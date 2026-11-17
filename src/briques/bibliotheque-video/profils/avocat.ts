/** Profil du format « avocat » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_AVOCAT: ProfilVideo = figerProfil({
  id: "avocat/1", formatId: "avocat", version: 1,
  capacites: {
    // prod, déjà utilisés : src/services/avocat-branchements.ts:78-100 (cartes de la motion commune)
    [ID.motionCartesCommunes]: { permis: true },
    // src/moteurs/montage-avocat/monteur.ts:41 (opération zoom) et :68
    [ID.cadrageZoomAvocat]: { permis: true },
    // src/moteurs/montage-avocat/decoupage.ts:454 (transition: "coupe")
    [ID.transitionCoupe]: { permis: true },
    // permis: false : prévu ou éteint, jamais allumé par le code
    [ID.texteSurlignageMarqueur]: { permis: false, maxParVideo: 1, decision: "S1, Q3" },
    [ID.texteStyleVarie]: { permis: false, maxParVideo: 1, decision: "S2, Q3" },
    [ID.textePave]: { permis: false, maxParVideo: 1, decision: "Q2" },
    [ID.texteNomOutil]: { permis: false, maxParVideo: 1, decision: "texte seul" },
    [ID.texteNomOutilAutonome]: { permis: false, maxParVideo: 3, decision: "texte seul, sans logo (BR-ETIQUETTES-OUTIL)" },
    [ID.texteBandeauNom]: { permis: false, maxParVideo: 1, decision: "bandeau autorisé" },
    [ID.etalonnageLutNouvelle]: { permis: false, maxParVideo: 1, decision: "Q12" },
    [ID.sonRegistreCommun]: { permis: false, maxParVideo: 1 },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
  blocs: { texteEcran: { teintes: ["terracotta", "ivoire", "ardoise"], cibles: ["souligne", "expression", "mot-dit"], pave: false, outils: false, bandeauNom: false, intensites: [], signaturesAEviter: 3 } },
});
