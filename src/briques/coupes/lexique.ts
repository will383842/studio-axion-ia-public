/**
 * BRIQUE COUPES — lexique de marque (10/10, passage dit autrement). PUR.
 *
 * Quand les sous-titres reprennent les mots de la TRANSCRIPTION (passage dit autrement que le texte validé), les noms
 * connus mal entendus par Whisper sont remis dans leur orthographe : « Calliopi » → « Certifexemple », « Axion IA » →
 * « Axion-IA ». La ponctuation collée au dernier mot remplacé est gardée. Données pures, à compléter au fil des vidéos.
 */
import { normaliser } from "./texte";

export const LEXIQUE_MARQUE: { forme: string; entendus: string[] }[] = [
  { forme: "Certifexemple", entendus: ["Certifexemple", "Calliopi", "Kaliopi", "Certifexemplee", "Calliopée", "Caliopi", "Kalliopi", "Qualiopy"] },
  { forme: "OPCO", entendus: ["OPCO", "Opco", "Opcos"] },
  { forme: "Axion-IA", entendus: ["Axion IA", "AxionIA", "Action IA", "ActionIA", "Axion-IA", "Axion I A"] },
  { forme: "one-to-one", entendus: ["one to one", "one-to-one", "onetoone", "wan to wan"] },
];

/** Entendus ramenés à leurs formes comparables (mots normalisés), les plus longs d'abord. */
const REGLES = LEXIQUE_MARQUE.flatMap((e) => e.entendus.map((x) => ({ forme: e.forme, mots: x.split(/[\s\-]+/).map(normaliser).filter(Boolean) }))).sort((a, b) => b.mots.length - a.mots.length);

const ponctuationFinale = (mot: string) => /[\s ]*[?!:;,.…»"”]+$/.exec(mot)?.[0] ?? "";
const ponctuationInitiale = (mot: string) => /^[«"“]+[\s ]*/.exec(mot)?.[0] ?? "";

/** Les mots corrigés par le lexique (une suite de 1 à 3 mots entendus peut devenir un seul mot). */
export function corrigerLexique(mots: string[]): string[] {
  const formes = mots.map((m) => m.split(/[\-]+/).map(normaliser).filter(Boolean));
  const sortie: string[] = [];
  let i = 0;
  while (i < mots.length) {
    const trouve = REGLES.map((r) => ({ r, n: couvre(r.mots, formes, i) })).find((x) => x.n > 0);
    if (!trouve) {
      sortie.push(mots[i++]);
      continue;
    }
    sortie.push(ponctuationInitiale(mots[i]) + trouve.r.forme + ponctuationFinale(mots[i + trouve.n - 1]));
    i += trouve.n;
  }
  return sortie;
}

/** Nombre de mots entendus (à partir de `i`) qui disent exactement la règle, 0 sinon. */
function couvre(regle: string[], formes: string[][], i: number): number {
  let k = 0;
  let n = 0;
  while (k < regle.length && i + n < formes.length) {
    const f = formes[i + n];
    if (!f.length || f.some((x, q) => regle[k + q] !== x)) return 0;
    k += f.length;
    n++;
  }
  return k === regle.length ? n : 0;
}
