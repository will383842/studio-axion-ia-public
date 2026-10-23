/**
 * DÉCOUPAGE D'UN TEXTE COLLÉ (B.0 §16 ; correcteur 3, B8 de l'audit B), PUR. Code fixe, jamais Claude.
 *
 * - Les paragraphes de Will (lignes vides) sont gardés ENTIERS : un paragraphe va à un seul bloc de la recette.
 * - Ses retours à la ligne sont gardés : deux lignes ne sont jamais réunies dans le même morceau.
 * - Une ligne est coupée en phrases sur la ponctuation de fin (. ? ! …) ; une phrase trop longue (texte dicté sans
 *   ponctuation) est coupée en morceaux de taille égale, d'au plus `MOTS_MAX_MORCEAU` mots. VERIF-E2E-1 (B) : une vraie
 *   phrase (qui finit par . ? ! …) reste entière jusqu'à `MOTS_MAX_PHRASE` mots (une phrase de 18 mots n'est plus
 *   coupée au milieu d'un groupe de mots) ; au-delà, même coupe en morceaux égaux.
 * - JAMAIS un mot réécrit : seuls les espaces en trop sont retirés ; la suite des mots reste identique.
 */

/** Taille maximale d'un morceau sans ponctuation (une phrase dite d'un souffle). */
export const MOTS_MAX_MORCEAU = 16;

/** Taille maximale d'une phrase PONCTUÉE gardée entière (au-delà, coupée en morceaux de `MOTS_MAX_MORCEAU` au plus). */
export const MOTS_MAX_PHRASE = 2 * MOTS_MAX_MORCEAU;

/** Coupe une phrase trop longue en morceaux de taille égale, sans toucher aux mots. */
function couperLongue(phrase: string): string[] {
  const mots = phrase.split(" ");
  const ponctuee = /[.?!…][»"”’)\]\s  ]*$/.test(phrase);
  if (mots.length <= (ponctuee ? MOTS_MAX_PHRASE : MOTS_MAX_MORCEAU)) return [phrase];
  const nombre = Math.ceil(mots.length / MOTS_MAX_MORCEAU);
  const taille = Math.ceil(mots.length / nombre);
  const sortie: string[] = [];
  for (let i = 0; i < mots.length; i += taille) sortie.push(mots.slice(i, i + taille).join(" "));
  return sortie;
}

/** Une ligne → ses morceaux (phrases, puis morceaux d'une phrase trop longue). */
function morceauxDeLaLigne(ligne: string): string[] {
  const propre = ligne.replace(/[^\S\n  ]+/g, " ").trim();
  if (!propre) return [];
  return propre
    .split(/(?<=[.?!…])\s+/)
    .filter(Boolean)
    .flatMap(couperLongue);
}

/** Le texte → ses paragraphes, chacun la liste de ses morceaux dans l'ordre. Les paragraphes vides sont ignorés. */
export function paragraphesDuTexte(texte: string): string[][] {
  return texte
    .replace(/\r\n?/g, "\n")
    .split(/\n[^\S\n]*\n/)
    .map((p) => ouvrantsAvecLaSuite(p.split("\n").flatMap(morceauxDeLaLigne)))
    .filter((p) => p.length > 0);
}

/**
 * VERIF-E2E-1 (B) : un guillemet ouvrant (« ou “) laissé en fin de morceau (retour à la ligne juste après lui, ligne de
 * PDF, phrase longue coupée) passe au DÉBUT du morceau suivant du même paragraphe : il reste avec le mot qu'il ouvre.
 * Avant, la voix et les sous-titres le collaient au mot précédent (« marqué« »). Les mots et leur ordre ne changent pas.
 */
function ouvrantsAvecLaSuite(morceaux: string[]): string[] {
  const sortie = [...morceaux];
  for (let i = 0; i < sortie.length - 1; i++) {
    const m = ouvrantsEnFin(sortie[i]);
    if (!m) continue;
    sortie[i] = sortie[i].slice(0, m.index);
    sortie[i + 1] = `${m.ouvrants} ${sortie[i + 1]}`;
  }
  return sortie.filter(Boolean);
}

const estOuvrant = (c: string) => c === "«" || c === "“";
const estEspace = (c: string) => /\s/.test(c);

/**
 * RELECTURE FINALE S2 : même résultat que `/(?:^|\s+)([«“](?:\s*[«“])*)$/.exec(m)`, en temps LINÉAIRE. L'expression
 * revenait en arrière en O(N²) sur une longue suite d'espaces insécables (50 000 : 1 s, serveur figé). Ici : seule la
 * suite finale de guillemets ouvrants et d'espaces est lue, une fois. `index` : début des espaces avant le premier
 * guillemet précédé d'un espace (ou en tête) ; `ouvrants` : de ce guillemet à la fin.
 */
export function ouvrantsEnFin(m: string): { index: number; ouvrants: string } | null {
  if (!m.length || !estOuvrant(m[m.length - 1])) return null;
  let k = m.length;
  while (k > 0 && (estOuvrant(m[k - 1]) || estEspace(m[k - 1]))) k--;
  for (let q = k; q < m.length; q++) {
    if (!estOuvrant(m[q]) || (q > 0 && !estEspace(m[q - 1]))) continue;
    let index = q;
    while (index > k && estEspace(m[index - 1])) index--;
    return { index, ouvrants: m.slice(q) };
  }
  return null;
}

export interface BlocCible {
  id: string;
  dureeCibleSec?: [number, number];
}

/**
 * Affecte chaque morceau à un bloc de la recette, dans l'ordre du texte (jamais réordonné). L'unité d'affectation est
 * le PARAGRAPHE quand Will en a écrit plusieurs, sinon le morceau : la première unité va au premier bloc, la dernière
 * au dernier, la deuxième et l'avant-dernière aux blocs voisins, une unité chiffrée à la « preuve » si la recette en a
 * une, le reste au bloc le plus long (le cœur).
 */
export function affecterMorceaux(texte: string, blocs: readonly BlocCible[]): { blocRecette: string; morceaux: string[] }[] {
  const paragraphes = paragraphesDuTexte(texte);
  if (!paragraphes.length || !blocs.length) return [];
  const unites = paragraphes.length > 1 ? paragraphes : paragraphes[0].map((m) => [m]);
  const n = unites.length;
  const affectation = new Array<string>(n);
  const dernier = blocs.length - 1;
  const long = [...blocs].sort((a, b) => (b.dureeCibleSec?.[1] ?? 0) - (a.dureeCibleSec?.[1] ?? 0))[0].id;
  affectation[0] = blocs[0].id;
  if (n > 1) affectation[n - 1] = blocs[dernier].id;
  if (n > 3 && blocs.length >= 4) {
    affectation[1] = blocs[1].id;
    affectation[n - 2] = blocs[dernier - 1].id;
  }
  const preuve = blocs.find((b) => b.id === "preuve");
  for (let i = 0; i < n; i++) {
    if (affectation[i]) continue;
    affectation[i] = preuve && /\d/.test(unites[i].join(" ")) && !affectation.includes(preuve.id) ? preuve.id : long;
  }
  // Des unités voisines du même bloc forment un seul bloc.
  const sortie: { blocRecette: string; morceaux: string[] }[] = [];
  unites.forEach((u, i) => {
    const precedent = sortie[sortie.length - 1];
    if (precedent && precedent.blocRecette === affectation[i]) precedent.morceaux.push(...u);
    else sortie.push({ blocRecette: affectation[i], morceaux: [...u] });
  });
  return sortie;
}
