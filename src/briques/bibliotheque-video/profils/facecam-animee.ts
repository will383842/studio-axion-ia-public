/** Profil du format « facecam-animee » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { EXTRAITS_PAR_DEFAUT, figerProfil } from "./neutre";

export const PROFIL_FACECAM_ANIMEE: ProfilVideo = figerProfil({
  id: "facecam-animee/1", formatId: "facecam-animee", version: 1,
  capacites: {
    // prod, déjà utilisés par la chaîne v4 : src/moteurs/montage-facecam-animee/index.ts:25 (sous-titres v4)
    [ID.texteSousTitresV4]: { permis: true },
    // src/moteurs/montage-facecam-animee/videos-v4-studio.ts:12 (clips v4 préparés)
    [ID.ecranClipV4]: { permis: true },
    // src/moteurs/montage-facecam-animee/chaine-v4.ts:627 (plaquettes v4)
    [ID.motionPlaquettesV4]: { permis: true },
    // src/moteurs/montage-facecam-animee/chaine-v4.ts:15 (les plaquettes jouent leurs bruitages)
    [ID.sonV4]: { permis: true },
    // permis: false : prévu ou éteint, jamais allumé par le code
    [ID.ecranMosaiqueExtraits]: { permis: false, maxParVideo: 1, decision: "Q4, Q5" },
    [ID.ecranTelephoneExtrait]: { permis: false, maxParVideo: 1, decision: "Q1, P-6" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: ["etalonnage", ID.calqueTexteDerriereDouble],
  // § 3.3 : aucune fiche etalonnage.* sur le chemin facecam-v4, aucune capacité etalonnage.* inscrite.
  blocs: { extraits: EXTRAITS_PAR_DEFAUT },
});
