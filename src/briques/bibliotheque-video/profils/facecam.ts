/** Profil du format « facecam » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_FACECAM: ProfilVideo = figerProfil({
  id: "facecam/1", formatId: "facecam", version: 1,
  capacites: {
    // src/moteurs/montage-facecam/monteur/catalogue.ts:40 (opération zoom)
    [ID.cadrageZoomClassique]: { permis: true },
    // src/moteurs/montage-facecam/habillage.ts:148 (transition: "coupe")
    [ID.transitionCoupe]: { permis: true },
    // LUT prod : aucun usage prouvé pour facecam (src/donnees/luts-axion.ts:33-34 : avocat et selfie seulement) : retirées.
    // permis: false : prévu ou éteint, jamais allumé par le code
    [ID.planScenesFacecam]: { permis: false, maxParVideo: 1, decision: "Q11" },
    [ID.texteSurlignageMarqueur]: { permis: false, maxParVideo: 1, decision: "S1, Q3" },
    [ID.texteStyleVarie]: { permis: false, maxParVideo: 1, decision: "S2, Q3" },
    [ID.texteRepereEpaule]: { permis: false, maxParVideo: 1, decision: "V1, Q1, Q2" },
    [ID.texteEscalier]: { permis: false, decision: "AM-09 (BR-FACECAM-TEXTE)" },
    [ID.textePave]: { permis: false, maxParVideo: 6, decision: "Q2 (BR-FACECAM-TEXTE)" },
    [ID.fondVivant]: { permis: false, maxParVideo: 1 },
    [ID.fondLumiere]: { permis: false, maxParVideo: 1 },
    [ID.etalonnageLutNouvelle]: { permis: false, maxParVideo: 1, decision: "Q12" },
    // objet (C9-03) : prévu, jamais permis
    [ID.objetTrait]: { permis: false, decision: "D3 § C, à valider sur planche" },
    [ID.objetMarque]: { permis: false, decision: "D3 § C, à valider sur planche" },
    // FOND-FLOU-C10-04-b-v20l : famille étiquette permise, réduite au SEUL carton magazine par pieces-permises.ts (pieces-validees.ts)
    [ID.objetEtiquette]: { permis: true, decision: "FOND-FLOU-C10-04-b-v20l · Williams 21/11 00:25 (carton magazine seul)" },
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
