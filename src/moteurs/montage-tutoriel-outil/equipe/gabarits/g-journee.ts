/** Gabarit G-Journée (T-EXT-22) : une journée avant / après. Constante figée, aucun appel, rien ne l'importe en production. */
import { figerGabarit, type Gabarit } from "./types";

export const G_JOURNEE: Gabarit = figerGabarit({
  id: "G-Journee",
  nom: "G-Journée",
  cas: [1, 4],
  sequence: [
    { temps: "situation", montre: ["avant-dessine", "avant-maquette"], gestes: ["apparition", "defilement"] },
    { temps: "changement", montre: ["maquette"], gestes: ["clic", "defilement", "apparition", "zoom"] },
    { temps: "gain", montre: ["vue-ensemble"], gestes: ["zoom", "apparition"] },
  ],
  momentsMax: 3,
  rythme: { phraseMinMs: 1200, fixeMaxMs: 1500 },
  lisibilite: { largeurZoomeeMinPct: 25 },
});
