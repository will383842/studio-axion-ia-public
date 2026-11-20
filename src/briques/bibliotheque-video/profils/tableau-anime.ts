/** Profil du format « tableau-anime » (C1-U3, PLAN-FINAL § 3.4) : une liste de permissions, jamais un allumage. */
import { ID } from "../noms";
import type { ProfilVideo } from "../types";
import { figerProfil } from "./neutre";

export const PROFIL_TABLEAU_ANIME: ProfilVideo = figerProfil({
  id: "tableau-anime/1", formatId: "tableau-anime", version: 1,
  capacites: {
    // permis: false : tableau couvert par le filet (A2-11) ; pavé et étiquette autonome exclus du style « blocs/2 »
    [ID.texteSurlignageMarqueur]: { permis: false, maxParVideo: 1, decision: "S1, Q3" },
    [ID.texteStyleVarie]: { permis: false, maxParVideo: 1, decision: "S2, Q3 (A2-11)" },
    // objets N-04 : déclarés fermés
    [ID.objetChiffre]: { permis: false, maxParVideo: 1, decision: "N-04 (allumage = Williams)" },
    [ID.objetEtape]: { permis: false, maxParVideo: 1, decision: "N-04 (allumage = Williams)" },
    [ID.objetMarque]: { permis: false, maxParVideo: 1, decision: "N-04 (allumage = Williams)" },
  },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" },
  verrous: [ID.calqueTexteDerriereDouble],
  blocs: { texteEcran: { teintes: ["terracotta", "ivoire", "ardoise"], cibles: ["souligne", "expression", "mot-dit"], pave: false, outils: false, bandeauNom: false, intensites: [], signaturesAEviter: 3 } },
});
