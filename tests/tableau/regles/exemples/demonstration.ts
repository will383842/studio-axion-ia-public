/** Fiche d'exemple valide · structure « La démonstration en 3 gestes ». Textes fictifs, en vouvoiement, sans nom ni prix. */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";

export const ficheDemonstration: FicheTableau = {
  version: "fiche-scenes/1",
  formatId: "tableau-anime",
  videoId: "exemple-demonstration",
  versionId: "v1",
  habillage: "charte-video/1",
  stylo: "crayon/1",
  ratio: "9:16",
  structure: "demonstration",
  serie: { code: "ia-pour-publier", nom: "L'IA pour publier" },
  douleur: "Vous ne savez pas quoi écrire dans vos publications.",
  gesteMinute: "Demandez trois idées de publication à partir de votre dernière question client.",
  appelId: null,
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: "Plus jamais à court d'idées de publications.",
      elements: [
        { id: "e01", type: "ligne", texte: "Idées de publications", niveau: "texte", role: "titre", marque: "entoure", ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "ampoule", cote: "droite", ancre: 3 },
      ],
    },
    {
      id: "s02",
      role: "etape",
      page: 1,
      texteDit: "Geste un : notez la dernière question d'un client.",
      elements: [
        { id: "e03", type: "ligne", texte: "Notez une question", niveau: "texte", role: "regle", marque: "souligne", ancre: 0 },
        { id: "e04", type: "dessin", dessinId: "bulle", cote: "gauche", ancre: 5 },
      ],
    },
    {
      id: "s03",
      role: "etape",
      page: 2,
      texteDit: "Geste deux : demandez trois idées de publication à partir de cette question.",
      elements: [
        { id: "e05", type: "ligne", texte: "Demandez trois idées", niveau: "texte", role: "regle", marque: "souligne", ancre: 2 },
        { id: "e06", type: "dessin", dessinId: "ampoule", cote: "droite", ancre: 7 },
      ],
    },
    {
      id: "s04",
      role: "etape",
      page: 2,
      texteDit: "Geste trois : gardez la meilleure et ajoutez votre exemple.",
      elements: [
        { id: "e07", type: "ligne", texte: "Gardez la meilleure", niveau: "texte", role: "regle", marque: "entoure", ancre: 2 },
        { id: "e08", type: "dessin", dessinId: "coche-cercle", cote: "gauche", ancre: 6 },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 3,
      texteDit: "Le résultat : trois idées prêtes, testées sur deux IA.",
      elements: [
        { id: "e09", type: "preuve", preuveId: "matiere-demo-idees", lignes: ["Trois idées utilisables", "Testé sur deux IA"], ancre: 0 },
        { id: "e10", type: "geste", geste: "entourer", cibleId: "e09", ancre: 6 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 3,
      texteDit: "Vous publiez sans chercher pendant une heure.",
      elements: [
        { id: "e11", type: "ligne", texte: "Publiez sans chercher", niveau: "texte", role: "resultat", ancre: 0 },
        { id: "e12", type: "geste", geste: "cocher", cibleId: "e11", ancre: 3 },
      ],
    },
  ],
};
