// Opposition écrite par la personne elle-même (« stop », « arrêtez », « stop, merci ») : PUR. Aucun texte n'est jamais envoyé en réponse.
// Listes FERMÉES. Une opposition n'efface rien : elle met la personne à l'écart (et alerte l'opérateur).

/** Mots d'opposition reçus (comparés sans accents ni casse). */
export const MOTS_OPPOSITION: readonly string[] = [
  "STOP", "STOPPEZ", "ARRET", "ARRETE", "ARRETEZ", "ARRETER",
  "DESINSCRIRE", "DESINSCRIPTION", "DESINSCRIVEZ", "DESABONNER", "DESABONNEZ", "DESABONNEMENT",
];
/** Phrases d'opposition (mots consécutifs, cherchées avant les mots). */
export const PHRASES_OPPOSITION: readonly string[] = ["NE M ECRIVEZ PLUS", "NE ME CONTACTEZ PLUS", "NE M ENVOYEZ PLUS", "PLUS DE MESSAGES", "LAISSEZ MOI TRANQUILLE"];
/** Mots sans portée qui peuvent accompagner une opposition. */
export const NEUTRES_OPPOSITION: readonly string[] = [
  "MERCI", "BEAUCOUP", "SVP", "STP", "S", "IL", "VOUS", "TE", "PLAIT", "OK", "NON", "BONJOUR", "BONSOIR", "SALUT", "TOUT", "CA", "CELA", "LE", "LES", "DES",
  "MESSAGE", "MESSAGES", "MP", "MAIL", "MAILS", "ENVOIS", "JE", "VEUX", "VOUDRAIS", "MAINTENANT", "DONC", "ALORS", "BIEN",
];
/** Négations : leur présence rend toute opposition douteuse (« ne vous arrêtez pas »). */
export const NEGATIONS: readonly string[] = ["NE", "N", "PAS", "JAMAIS", "SANS", "SURTOUT"];
/** Un mot qui commence ainsi, sans être un mot d'opposition, rend le texte douteux (« stopper », « arrêt maladie »). */
const RACINES_DOUTE: readonly string[] = ["STOP", "ARRET", "DESINSCRI", "DESABONN"];

export type ClasseOpposition = "opposition" | "doute" | "non";
const LONGUEUR_MAX = 80;
const MOTS_MAX = 8;

/** NFKC, puis sans accents, majuscules ; tout caractère non lettre/chiffre devient une espace ; découpe en mots. */
function motsDe(texte: string): string[] {
  const n = texte.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return n === "" ? [] : n.split(" ");
}

interface Analyse {
  /** Mots d'opposition et phrases trouvés, dans l'ordre. */
  trouves: string[];
  /** Mots restants (hors phrases et hors mots d'opposition). */
  autres: string[];
  doute: boolean;
  nbMots: number;
  longueur: number;
}
const PHRASES_MOTS = PHRASES_OPPOSITION.map((p) => p.split(" "));

function analyser(texte: string): Analyse {
  const mots = motsDe(texte);
  const trouves: string[] = [];
  const autres: string[] = [];
  for (let i = 0; i < mots.length; ) {
    const ph = PHRASES_MOTS.find((p) => p.every((m, k) => mots[i + k] === m));
    if (ph) {
      trouves.push(ph.join(" "));
      i += ph.length;
    } else if (MOTS_OPPOSITION.includes(mots[i])) {
      trouves.push(mots[i]);
      i++;
    } else autres.push(mots[i++]);
  }
  const racine = autres.some((m) => RACINES_DOUTE.some((r) => m.startsWith(r)));
  return { trouves, autres, doute: racine, nbMots: mots.length, longueur: mots.join(" ").length };
}

/**
 * Classe un texte reçu : « opposition » (texte court, au moins un mot ou une phrase d'opposition, aucune négation, tous les autres mots neutres),
 * « non » (aucun mot d'opposition, aucune phrase, aucune racine de doute), « doute » (tout le reste : rien ne part, l'opérateur est alerté).
 */
export function classerOpposition(texte: string | null | undefined): ClasseOpposition {
  if (typeof texte !== "string") return "non";
  const a = analyser(texte);
  if (a.trouves.length === 0 && !a.doute) return "non";
  if (a.trouves.length === 0) return "doute";
  if (a.longueur > LONGUEUR_MAX || a.nbMots > MOTS_MAX) return "doute";
  if (a.autres.every((m) => NEUTRES_OPPOSITION.includes(m))) return "opposition";
  return "doute";
}

/** Le texte reçu est-il une opposition claire ? (Un doute n'est PAS une opposition : il met en pause sans écarter la personne.) */
export function estMotOpposition(texte: string | null | undefined): boolean {
  return classerOpposition(texte) === "opposition";
}

/** Forme canonique : le premier mot d'opposition du texte (ex. « STOP »), ou la première phrase s'il n'y a que des phrases ; sinon null. */
export function formeCanonique(texte: string | null | undefined): string | null {
  if (typeof texte !== "string") return null;
  return analyser(texte).trouves[0] ?? null;
}
