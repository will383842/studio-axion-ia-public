/** Profil du format « cas-concret » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_CAS_CONCRET: ProfilVideo = figerProfil({
  id: "cas-concret/1", formatId: "cas-concret", version: 1,
  capacites: {
    // prod, déjà utilisés : src/moteurs/montage-cas-concret/fabriquer.ts:1076 (planScenesCasConcret)
    [ID.planScenesCasConcret]: { permis: true },
    // src/moteurs/montage-cas-concret/variete.ts:61 (TRANSITIONS)
    [ID.transitionCasConcret]: { permis: true },
    // src/moteurs/montage-cas-concret/variete.ts:64 (STYLES_CAMERA)
    [ID.cadrageCameraCasConcret]: { permis: true },
    // permis: false : prévu ou éteint, jamais allumé par le code
    [ID.texteSurlignageMarqueur]: { permis: false, maxParVideo: 1, decision: "S1, Q3" },
    [ID.texteStyleVarie]: { permis: false, maxParVideo: 1, decision: "S2, Q3 (C2-U5bis)" },
    [ID.transitionCommune]: { permis: false, maxParVideo: 1, decision: "Q7" },
    // objet (C9-03) : prévu, jamais permis
    [ID.objetTrait]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetMarque]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetEtiquette]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetAppel]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetChiffre]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetEtape]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetCartes]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetSchema]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetEcran]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetReseauSchema]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetManuscrit]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetEmoji]: { permis: false, decision: "D3 § C, à valider sur planche" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
  blocs: { texteEcran: { teintes: ["terracotta", "ivoire", "ardoise"], cibles: ["souligne", "expression", "mot-dit"], pave: false, outils: false, bandeauNom: false, intensites: [], signaturesAEviter: 3 } },
});
