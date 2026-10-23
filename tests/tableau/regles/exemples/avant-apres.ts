/** Fiche d'exemple valide · structure « Avant / après ». Textes fictifs, en vouvoiement, sans nom ni prix. */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";

export const ficheAvantApres: FicheTableau = {
  version: "fiche-scenes/1",
  formatId: "tableau-anime",
  videoId: "exemple-avant-apres",
  versionId: "v1",
  habillage: "charte-video/1",
  stylo: "crayon/1",
  ratio: "9:16",
  structure: "avant-apres",
  serie: { code: "ia-au-bureau", nom: "L'IA au bureau" },
  douleur: "Vos comptes rendus de réunion sont trop longs à écrire.",
  gesteMinute: "Collez vos notes brutes et demandez un compte rendu en cinq points.",
  appelId: null,
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: "Comptes rendus trop longs à écrire ?",
      elements: [
        { id: "e01", type: "ligne", texte: "Trop long à écrire", niveau: "titre", role: "titre", marque: "entoure", ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "document", cote: "droite", ancre: 3 },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 1,
      texteDit: "Vous y passez une heure après chaque réunion.",
      elements: [
        { id: "e03", type: "ligne", texte: "Une heure par réunion", niveau: "texte", role: "alerte", ancre: 0 },
        { id: "e04", type: "dessin", dessinId: "horloge", cote: "gauche", ancre: 4 },
      ],
    },
    {
      id: "s03",
      role: "exemple",
      page: 2,
      texteDit: "Avant : vous recopiez vos notes, phrase par phrase.",
      elements: [
        { id: "e05", type: "ligne", texte: "Avant : tout recopier", niveau: "texte", role: "condition", marque: "barre", ancre: 0 },
        { id: "e06", type: "dessin", dessinId: "document", cote: "droite", ancre: 4 },
      ],
    },
    {
      id: "s04",
      role: "etape",
      page: 2,
      texteDit: "Le changement : collez vos notes et demandez cinq points clairs.",
      elements: [
        { id: "e07", type: "ligne", texte: "Demandez cinq points", niveau: "texte", role: "regle", marque: "souligne", ancre: 1 },
        { id: "e08", type: "dessin", dessinId: "bulle", cote: "gauche", ancre: 6 },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 3,
      texteDit: "Après : un compte rendu propre en deux minutes.",
      elements: [
        { id: "e09", type: "preuve", preuveId: "preuve-compte-rendu", lignes: ["Avant : une heure", "Après : deux minutes"], ancre: 0 },
        { id: "e10", type: "geste", geste: "entourer", cibleId: "e09", ancre: 5 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 3,
      texteDit: "Vous gagnez une heure par réunion.",
      elements: [
        { id: "e11", type: "ligne", texte: "Une heure gagnée", niveau: "texte", role: "resultat", ancre: 0 },
        { id: "e12", type: "geste", geste: "cocher", cibleId: "e11", ancre: 3 },
      ],
    },
  ],
};
