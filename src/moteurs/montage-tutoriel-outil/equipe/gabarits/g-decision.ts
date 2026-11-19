/** Gabarit G-Décision (T-EXT-22) : du chiffre à la décision. Constante figée, aucun appel, rien ne l'importe en production. */
import { figerGabarit, type Gabarit } from "./types";

export const G_DECISION: Gabarit = figerGabarit({
  id: "G-Decision",
  nom: "G-Décision",
  cas: [1, 5],
  sequence: [
    { temps: "situation", montre: ["avant-maquette", "avant-dessine"], gestes: ["apparition", "defilement"] },
    { temps: "changement", montre: ["maquette"], gestes: ["zoom", "clic", "survol"] },
    { temps: "gain", montre: ["vue-ensemble"], gestes: ["zoom", "apparition"] },
  ],
  momentsMax: 3,
  rythme: { phraseMinMs: 1200, fixeMaxMs: 1500 },
  lisibilite: { largeurZoomeeMinPct: 25 },
});
