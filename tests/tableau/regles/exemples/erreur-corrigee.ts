/** Fiche d'exemple valide · structure « L'erreur corrigée ». Textes fictifs, en vouvoiement, sans nom ni prix. */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";

export const ficheErreurCorrigee: FicheTableau = {
  version: "fiche-scenes/1",
  formatId: "tableau-anime",
  videoId: "exemple-erreur-corrigee",
  versionId: "v1",
  habillage: "charte-video/1",
  stylo: "crayon/1",
  ratio: "9:16",
  structure: "erreur-corrigee",
  serie: { code: "ia-au-quotidien", nom: "L'IA au quotidien" },
  douleur: "Vos demandes à l'IA donnent des réponses trop vagues.",
  gesteMinute: "Ajoutez à votre demande : posez-moi trois questions avant de répondre.",
  appelId: null,
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: "Vos réponses d'IA sont vagues ? Voici pourquoi.",
      elements: [
        { id: "e01", type: "ligne", texte: "Réponses vagues ?", niveau: "titre", role: "titre", marque: "entoure", ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "point-interrogation", cote: "droite", ancre: 4 },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 1,
      texteDit: "Vous posez une question courte, et l'IA répond à côté.",
      elements: [
        { id: "e03", type: "ligne", texte: "Question trop courte", niveau: "texte", role: "alerte", ancre: 0 },
        { id: "e04", type: "dessin", dessinId: "bulle", cote: "gauche", ancre: 5 },
      ],
    },
    {
      id: "s03",
      role: "idee-recue",
      page: 2,
      texteDit: "L'erreur : croire qu'une demande courte suffit.",
      elements: [{ id: "e05", type: "ligne", texte: "Une demande courte", niveau: "texte", role: "alerte", marque: "barre", ancre: 1 }],
    },
    {
      id: "s04",
      role: "etape",
      page: 2,
      texteDit: "La bonne façon : demandez-lui de vous poser trois questions d'abord.",
      elements: [
        { id: "e06", type: "ligne", texte: "Trois questions d'abord", niveau: "texte", role: "regle", marque: "souligne", ancre: 1 },
        { id: "e07", type: "dessin", dessinId: "point-interrogation", cote: "droite", ancre: 6 },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 3,
      texteDit: "Testé trois fois : les réponses deviennent précises et utilisables.",
      elements: [
        { id: "e08", type: "preuve", preuveId: "matiere-demo-questions", lignes: ["Avant : conseils généraux", "Après : plan précis"], ancre: 0 },
        { id: "e09", type: "geste", geste: "entourer", cibleId: "e08", ancre: 6 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 3,
      texteDit: "Vous gagnez une réponse juste, du premier coup.",
      elements: [
        { id: "e10", type: "ligne", texte: "Juste, du premier coup", niveau: "texte", role: "resultat", ancre: 0 },
        { id: "e11", type: "geste", geste: "cocher", cibleId: "e10", ancre: 5 },
      ],
    },
  ],
};
