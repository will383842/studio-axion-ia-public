/** Pages d'exemple des compositions, tirées de la VRAIE mise en page (générateur et test d'égalité). */
import { mettreEnPage, type PagePlacee } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";

const garder = (p: PagePlacee, ids: string[]): PagePlacee => ({ ...p, elements: p.elements.filter((e) => ids.includes(e.elementId)), gestes: p.gestes.filter((g) => ids.includes(g.elementId)) });

export function pagesExemples() {
  const erreur = mettreEnPage(ficheErreurCorrigee);
  const question = mettreEnPage(ficheQuestionAbonne, { preuves: { e10: { phrase: "Posez une question fermée", testeLe: "2026-10-09" } } });
  return {
    cadres: { cadre: erreur.cadre, zoneSure: erreur.zoneSure, bandeSousTitres: erreur.bandeSousTitres },
    accroche: erreur.pages[0],
    ligne: garder(erreur.pages[1], ["e06"]),
    bulle: garder(question.pages[2], ["e10"]),
  };
}
