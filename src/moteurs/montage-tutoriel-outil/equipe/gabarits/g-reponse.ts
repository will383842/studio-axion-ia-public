/** Gabarit G-Réponse (T-EXT-22) : le client écrit à 2 h du matin. Constante figée, aucun appel, rien ne l'importe en production. */
import { figerGabarit, type Gabarit } from "./types";

export const G_REPONSE: Gabarit = figerGabarit({
  id: "G-Reponse",
  nom: "G-Réponse",
  cas: [4],
  sequence: [
    { temps: "situation", montre: ["avant-dessine"], gestes: ["apparition"] },
    { temps: "changement", montre: ["conversation", "maquette"], gestes: ["apparition", "clic"] },
    { temps: "gain", montre: ["vue-ensemble"], gestes: ["zoom", "apparition"] },
  ],
  momentsMax: 3,
  rythme: { phraseMinMs: 1200, fixeMaxMs: 1500 },
  lisibilite: { largeurZoomeeMinPct: 25 },
});
