/**
 * Outils de lecture du texte pour les contrôles par code (plan v5 B.7, lot G3). PUR.
 * Aucun nom de format ni de réseau ici : les contrôles lisent la recette et les règles par réseau qu'on leur passe.
 */
import { phrasesDe } from "@/domaine/lecture";

export { phrasesDe };

export function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Minuscules, sans accents, apostrophes et espaces normalisés. */
export function normaliser(t: string): string {
  return sansAccents(t.toLowerCase())
    .replace(/[’`ʼ]/g, "'")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte comparé « mot pour mot » : normalisé, sans ponctuation ni guillemets. */
export function texteCompare(t: string): string {
  return normaliser(t)
    .replace(/[«»"“”.,;:!?…()[\]{}—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots lus (lettres ou chiffres). */
export function mots(t: string): string[] {
  return t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
}

/**
 * Débuts de phrase d'un texte dit, en index de mot (même découpe que l'ancre) : les mots `c` (1 à n − 1) dont le
 * morceau précédent finit une phrase (point, point d'interrogation ou d'exclamation, points de suspension ; « ? »
 * détaché compris). C'est là, et seulement là, qu'une scène peut être coupée en deux.
 */
export function debutsDePhrase(texteDit: string): number[] {
  const res: number[] = [];
  let n = 0;
  let fin = false;
  for (const morceau of texteDit.split(/\s+/).filter(Boolean)) {
    const estMot = /[\p{L}\p{N}]/u.test(morceau);
    if (estMot) {
      if (fin && n > 0) res.push(n);
      n++;
    }
    const ponctue = /[.!?…]["»”)]*$/.test(morceau);
    fin = estMot ? ponctue : fin || ponctue;
  }
  return res;
}

export function nombreDeMots(t: string): number {
  return mots(t).length;
}

/** Mots outils : ni pleins ni porteurs de sens (emphase, redondance, recouvrement). */
export const MOTS_OUTILS: ReadonlySet<string> = new Set(
  (
    "a au aux avec ce ces cet cette c ca cela d de des du dans donc elle elles en et est etre eu il ils j je l la le les leur leurs lui m ma mais me mes moi mon n ne ni nos notre nous on ou par pas pour qu que qui quoi s sa se ses si son sur t ta te tes toi ton tu un une vos votre vous y " +
    "plus moins tres trop tout tous toute toutes rien peu bien alors aussi encore deja ici la-bas comme quand dont ou sont ont avait etait fait faire font sera peut doit va vont avez avons ai as c'est n'est qu'il qu'on d'un d'une l'on chez entre sans sous apres avant puis car"
  ).split(" "),
);

/** Mots pleins normalisés (≥ 3 lettres, hors mots outils). */
export function motsPleins(t: string): string[] {
  return texteCompare(t)
    .split(/[\s'-]+/)
    .filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m) && !/^\d+$/.test(m));
}

/** Racine grossière d'un mot plein (pluriels, féminins, -ment) : sert à repérer une redondance. */
export function racine(m: string): string {
  const n = normaliser(m).replace(/(ements?|ments?|ations?|ees?|es|s|x|e)$/, "");
  return n.slice(0, 6);
}

/** Échappe une chaîne pour une expression régulière. */
export function echapper(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Le texte contient-il l'expression, mot entier, sans tenir compte des accents ni de la casse ? */
export function contientExpression(texte: string, expression: string): boolean {
  const e = texteCompare(expression);
  if (!e) return false;
  return ` ${texteCompare(texte)} `.includes(` ${e} `);
}

/** Écart-type d'une série (population). */
export function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  return Math.sqrt(valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / valeurs.length);
}

/** Retire les citations (« … », "…") d'un texte : C4 exclut les citations. */
export function sansCitations(t: string): string {
  return t.replace(/«[^»]*»/g, " ").replace(/"[^"]*"/g, " ").replace(/“[^”]*”/g, " ");
}
