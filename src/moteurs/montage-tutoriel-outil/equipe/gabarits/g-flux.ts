/** Gabarit G-Flux (T-EXT-50) : une automatisation filmée de bout en bout, puis résumée par un schéma. Constante figée, aucun appel. */
import { figerGabarit, type Gabarit } from "./types";

export const G_FLUX: Gabarit = figerGabarit({
  id: "G-Flux",
  nom: "Le flux de bout en bout",
  cas: [3, 5],
  sequence: [
    { temps: "situation", montre: ["avant-maquette", "avant-dessine"], gestes: ["apparition", "defilement"] },
    { temps: "changement", montre: ["flux"], gestes: ["clic", "apparition", "saisie", "zoom"] },
    { temps: "changement", montre: ["schema-flux"], gestes: ["apparition"] },
    { temps: "gain", montre: ["flux", "maquette"], gestes: ["zoom", "apparition"] },
  ],
  momentsMax: 3,
  rythme: { phraseMinMs: 1200, fixeMaxMs: 1500 },
  lisibilite: { largeurZoomeeMinPct: 25 },
});
