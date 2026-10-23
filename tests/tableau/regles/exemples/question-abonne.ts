/**
 * Fiche d'exemple valide · structure « Votre question ». Question reformulée, sans nom ni pseudo ; textes fictifs, en
 * vouvoiement, sans prix. Montre un exemple chiffré (mention « Exemple illustratif ») et un chiffre sourcé.
 */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";

export const ficheQuestionAbonne: FicheTableau = {
  version: "fiche-scenes/1",
  formatId: "tableau-anime",
  videoId: "exemple-question-abonne",
  versionId: "v1",
  habillage: "charte-video/1",
  stylo: "crayon/1",
  ratio: "9:16",
  structure: "question-abonne",
  serie: { code: "vos-questions", nom: "Vos questions" },
  douleur: "Vos devis envoyés restent sans réponse.",
  gesteMinute: "Relancez avec une question fermée, deux jours après l'envoi.",
  appelId: null,
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: "Vos devis restent sans réponse ?",
      elements: [
        { id: "e01", type: "ligne", texte: "Devis sans réponse ?", niveau: "titre", role: "titre", marque: "entoure", ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "point-interrogation", cote: "droite", ancre: 2 },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 1,
      texteDit: "Une question reçue : comment relancer sans paraître insistant ?",
      elements: [
        { id: "e03", type: "ligne", texte: "Comment relancer ?", niveau: "texte", role: "alerte", ancre: 0 },
        { id: "e04", type: "dessin", dessinId: "enveloppe", cote: "gauche", ancre: 4 },
      ],
    },
    {
      id: "s03",
      role: "etape",
      page: 2,
      texteDit: "La réponse : posez une question fermée, deux jours après l'envoi.",
      elements: [
        { id: "e05", type: "ligne", texte: "Une question fermée", niveau: "texte", role: "regle", marque: "souligne", ancre: 2 },
        { id: "e06", type: "chiffre", valeur: "2", unite: "jours", sourceId: "source-delai-relance", ancre: 6 },
      ],
    },
    {
      id: "s04",
      role: "exemple",
      page: 2,
      texteDit: "Par exemple : le devis du 3 mars tient-il toujours ?",
      elements: [
        { id: "e07", type: "ligne", texte: "Le devis tient-il toujours ?", niveau: "texte", role: "condition", ancre: 0 },
        { id: "e08", type: "dessin", dessinId: "bulle", cote: "droite", ancre: 5 },
        { id: "e09", type: "mention", texte: "Exemple illustratif" },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 3,
      texteDit: "Testé sur deux IA : la question fermée obtient une réponse claire.",
      elements: [
        { id: "e10", type: "preuve", preuveId: "matiere-demo-relance", lignes: ["Fermée : réponse claire"], ancre: 0 },
        { id: "e11", type: "geste", geste: "entourer", cibleId: "e10", ancre: 3 },
        { id: "e12", type: "ligne", texte: "Une réponse claire", niveau: "texte", role: "resultat", marque: "souligne", ancre: 7 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 3,
      texteDit: "Vous obtenez une réponse, sans insister.",
      elements: [
        { id: "e13", type: "ligne", texte: "Une réponse, sans insister", niveau: "texte", role: "resultat", ancre: 0 },
        { id: "e14", type: "geste", geste: "cocher", cibleId: "e13", ancre: 3 },
      ],
    },
  ],
};
