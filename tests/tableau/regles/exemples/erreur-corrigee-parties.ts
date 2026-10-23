/**
 * La fiche d'exemple « L'erreur corrigée » au style « reference/3 » (gabarit par parties, style des nouvelles fiches
 * depuis le 14/10/2026) : MÊME texte dit, mêmes scènes ; chaque page porte sa partie (accroche, douleur, solution,
 * exemple, appel), l'idée reçue est la seule ligne barrée.
 */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";
import { ficheErreurCorrigee } from "./erreur-corrigee";

export const ficheErreurCorrigeeParties: FicheTableau = {
  ...ficheErreurCorrigee,
  habillage: "reference/3",
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      gabarit: { role: "accroche" },
      texteDit: "Vos réponses d'IA sont vagues ? Voici pourquoi.",
      elements: [
        { id: "e01", type: "ligne", texte: "Vos réponses d'IA sont vagues ?", niveau: "texte", role: "regle", bloc: "phrase-cle", marque: "entoure", importants: ["vagues"], ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "bulle", cote: "droite", ancre: 6 },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 2,
      gabarit: { role: "douleur" },
      texteDit: "Vous posez une question courte, et l'IA répond à côté.",
      elements: [
        { id: "e04", type: "ligne", texte: "Vous posez une question courte, et l'IA répond à côté.", niveau: "texte", role: "alerte", bloc: "phrase-cle", ancre: 0 },
        { id: "e03", type: "dessin", dessinId: "point-interrogation", cote: "droite", ancre: 4 },
      ],
    },
    {
      id: "s03",
      role: "idee-recue",
      page: 2,
      gabarit: { role: "douleur" },
      texteDit: "L'erreur : croire qu'une demande courte suffit.",
      elements: [{ id: "e07", type: "ligne", texte: "Croire qu'une demande courte suffit.", niveau: "texte", role: "regle", bloc: "idee-recue", ancre: 1 }],
    },
    {
      id: "s04",
      role: "etape",
      page: 3,
      gabarit: { role: "solution" },
      texteDit: "La bonne façon : demandez-lui de vous poser trois questions d'abord.",
      elements: [
        { id: "e06", type: "ligne", texte: "Trois questions", niveau: "titre", role: "regle", bloc: "titre", ancre: 0 },
        { id: "e08", type: "ligne", texte: "Demandez-lui de vous poser trois questions d'abord.", niveau: "texte", role: "regle", bloc: "phrase-cle", marque: "souligne", ancre: 1 },
        { id: "e09", type: "dessin", dessinId: "cible", cote: "droite", ancre: 6 },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 4,
      gabarit: { role: "exemple" },
      texteDit: "Testé trois fois : les réponses deviennent précises et utilisables.",
      elements: [
        { id: "e10", type: "ligne", texte: "Le test", niveau: "titre", role: "regle", bloc: "titre", ancre: 0 },
        { id: "e11", type: "preuve", preuveId: "matiere-demo-questions", lignes: ["Avant : conseils généraux", "Après : plan précis"], ancre: 0 },
        { id: "e12", type: "ligne", texte: "Les réponses deviennent précises et utilisables.", niveau: "texte", role: "resultat", bloc: "phrase-cle", ancre: 3 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 5,
      gabarit: { role: "appel" },
      texteDit: "Vous gagnez une réponse juste, du premier coup.",
      elements: [{ id: "e14", type: "ligne", texte: "Une réponse juste, du premier coup.", niveau: "texte", role: "resultat", bloc: "appel", ancre: 2 }],
    },
  ],
};
