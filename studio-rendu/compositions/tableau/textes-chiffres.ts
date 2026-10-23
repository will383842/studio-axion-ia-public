/**
 * Chiffre qui compte (TB-05) : le premier nombre du texte monte de 0 à sa valeur, puis s'écrit exactement comme dans
 * la fiche. Même formule que `valeurCompteur` du noyau motion (courbe « signature » de `src/briques/motion/courbes`),
 * dans un fichier PUR (sans React) pour être testé.
 */
import { courbe, mixer } from "../../../src/briques/motion/courbes";

const NOMBRE = /\d+(?:[.,]\d+)?/;

/** Texte à l'avancement `k` (0 à 1) ; à 1, le texte de la fiche tel quel. */
export function texteChiffre(texte: string, k: number): string {
  const m = NOMBRE.exec(texte);
  if (!m || k >= 1) return texte;
  const brut = m[0];
  const sep = brut.includes(",") ? "," : ".";
  const decimales = brut.includes(sep) ? brut.split(sep)[1].length : 0;
  const v = mixer(0, Number(brut.replace(",", ".")), courbe("signature")(Math.min(1, Math.max(0, k))));
  const ecrit = decimales ? v.toFixed(decimales).replace(".", sep) : String(Math.round(v));
  return texte.slice(0, m.index) + ecrit + texte.slice(m.index + brut.length);
}
