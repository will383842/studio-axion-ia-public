/**
 * NAV · squelette de l'écran « A publier » puis envoi (Z3-E). NON ACTIVÉ : Z3-E n'est pas encore fusionné dans master.
 * À activer après la fusion de Z3-E : remplacer `test.skip` par `test`, puis compléter les gestes.
 */
import { test } from "@playwright/test";

const RAISON = "Z3-E (écran A publier) pas encore fusionné : à activer après sa fusion.";

test.describe("A publier (à activer plus tard)", () => {
  test.skip(true, RAISON);
  test("cocher une ligne, choisir brouillon ou programmer, envoyer", async () => {});
  test("TikTok : bouton inactif tant que la case n'est pas cochée", async () => {});
  test("second clic sur Envoyer : sans effet", async () => {});
  test("états vide, chargement et erreur", async () => {});
  test("refus d'un mot interdit (mot construit à partir de jetons) et refus d'un doublon", async () => {});
  test("clavier seul, focus visible, cibles 48 px, textes 16 px, mouvement réduit, vouvoiement, aucun mot anglais", async () => {});
});
