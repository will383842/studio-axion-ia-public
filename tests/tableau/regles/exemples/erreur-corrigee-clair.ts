/**
 * La fiche d'exemple « L'erreur corrigée » au style « reference/2 » (gabarit de page clair, style des nouvelles fiches
 * depuis le 14/10/2026) : MÊME texte dit, scènes et pages identiques ; le texte écrit suit le gabarit (titre, phrase
 * clé, détails, avant / après).
 */
import type { FicheTableau } from "../../../../src/moteurs/montage-tableau/fiche";
import { ficheErreurCorrigee } from "./erreur-corrigee";

export const ficheErreurCorrigeeClair: FicheTableau = {
  ...ficheErreurCorrigee,
  habillage: "reference/2",
  scenes: [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      gabarit: { role: "probleme" },
      texteDit: "Vos réponses d'IA sont vagues ? Voici pourquoi.",
      elements: [
        { id: "e01", type: "ligne", texte: "Le problème", niveau: "titre", role: "alerte", bloc: "titre", ancre: 0 },
        { id: "e02", type: "ligne", texte: "Vos réponses d'IA sont vagues ?", niveau: "texte", role: "alerte", bloc: "phrase-cle", marque: "entoure", ancre: 0 },
        { id: "e03", type: "dessin", dessinId: "point-interrogation", cote: "droite", ancre: 4 },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 1,
      gabarit: { role: "probleme" },
      texteDit: "Vous posez une question courte, et l'IA répond à côté.",
      elements: [
        { id: "e04", type: "ligne", texte: "Vous posez une question courte, et l'IA répond à côté.", niveau: "texte", role: "alerte", bloc: "detail", ancre: 0 },
        { id: "e05", type: "geste", geste: "souligner", cibleId: "e04", ancre: 6 },
      ],
    },
    {
      id: "s03",
      role: "idee-recue",
      page: 2,
      gabarit: { role: "probleme" },
      texteDit: "L'erreur : croire qu'une demande courte suffit.",
      elements: [
        { id: "e06", type: "ligne", texte: "L'erreur", niveau: "titre", role: "alerte", bloc: "titre", ancre: 0 },
        { id: "e07", type: "ligne", texte: "Croire qu'une demande courte suffit.", niveau: "texte", role: "alerte", bloc: "phrase-cle", marque: "barre", ancre: 1 },
      ],
    },
    {
      id: "s04",
      role: "etape",
      page: 2,
      gabarit: { role: "probleme" },
      texteDit: "La bonne façon : demandez-lui de vous poser trois questions d'abord.",
      elements: [
        { id: "e08", type: "ligne", texte: "Demandez-lui de vous poser trois questions d'abord.", niveau: "texte", role: "regle", bloc: "detail", marque: "souligne", ancre: 1 },
        { id: "e09", type: "dessin", dessinId: "bulle", cote: "droite", ancre: 6 },
      ],
    },
    {
      id: "s05",
      role: "preuve",
      page: 3,
      gabarit: { role: "exemple" },
      texteDit: "Testé trois fois : les réponses deviennent précises et utilisables.",
      elements: [
        { id: "e10", type: "ligne", texte: "Le test", niveau: "titre", role: "regle", bloc: "titre", ancre: 0 },
        { id: "e11", type: "preuve", preuveId: "matiere-demo-questions", lignes: ["Avant : conseils généraux", "Après : plan précis"], ancre: 0 },
        { id: "e12", type: "ligne", texte: "Les réponses deviennent précises et utilisables.", niveau: "texte", role: "resultat", bloc: "phrase-cle", ancre: 3 },
        { id: "e13", type: "geste", geste: "entourer", cibleId: "e11", ancre: 6 },
      ],
    },
    {
      id: "s06",
      role: "resultat",
      page: 3,
      gabarit: { role: "exemple" },
      texteDit: "Vous gagnez une réponse juste, du premier coup.",
      elements: [
        { id: "e14", type: "ligne", texte: "Vous gagnez une réponse juste, du premier coup.", niveau: "texte", role: "resultat", bloc: "detail", ancre: 0 },
        { id: "e15", type: "geste", geste: "cocher", cibleId: "e14", ancre: 5 },
      ],
    },
  ],
};
