// Opposition écrite par la personne elle-même (« stop », « arrêtez », « stop, merci ») : PUR. Aucun texte n'est jamais envoyé en réponse.
// Listes FERMÉES. Une opposition n'efface rien : elle met la personne à l'écart (et alerte l'opérateur).

/** Mots d'opposition reçus (comparés sans accents ni casse). */
export const MOTS_OPPOSITION: readonly string[] = [
  "STOP", "STOPPEZ", "ARRET", "ARRETE", "ARRETEZ", "ARRETER",
  "DESINSCRIRE", "DESINSCRIPTION", "DESINSCRIVEZ", "DESABONNER", "DESABONNEZ", "DESABONNEMENT",
];
/** Phrases d'opposition (mots consécutifs, cherchées avant les mots). */
export const PHRASES_OPPOSITION: readonly string[] = ["NE M ECRIVEZ PLUS", "NE ME CONTACTEZ PLUS", "NE M ENVOYEZ PLUS", "PLUS DE MESSAGES", "LAISSEZ MOI TRANQUILLE",
  // Formes plus longues AVANT « JE M OPPOSE » (la première qui correspond l'emporte).
  "JE M OPPOSE AU TRAITEMENT DE MES DONNEES PERSONNELLES", "JE M OPPOSE AU TRAITEMENT DE MES DONNEES", "JE M OPPOSE AU TRAITEMENT",
  "JE M OPPOSE A LA COLLECTE DE MES DONNEES PERSONNELLES", "JE M OPPOSE A LA COLLECTE DE MES DONNEES", "JE M OPPOSE A LA COLLECTE DE DONNEES", "JE M OPPOSE A LA COLLECTE", "JE M Y OPPOSE", "JE SUIS OPPOSE E", "JE SUIS OPPOSEE", "JE SUIS OPPOSE", "OPPOSEE",
  "JE M OPPOSE", "JE ME OPPOSE", "M OPPOSE", "ME OPPOSE", "OPPOSITION", "OPPOSE", "OPPOSER"];
/** Mots sans portée qui peuvent accompagner une opposition. Contient au moins toutes les politesses de mot-normalise.ts (MOTS_NEUTRES_POLITESSE et SIL) : un arrêt poli n'est jamais moins reconnu qu'une demande polie (test opposition-politesses). */
export const NEUTRES_OPPOSITION: readonly string[] = [
  "MERCI", "BEAUCOUP", "SVP", "STP", "S", "IL", "VOUS", "TE", "PLAIT", "OK", "NON", "BONJOUR", "BONSOIR", "SALUT", "TOUT", "CA", "CELA", "LE", "LES", "DES",
  "MESSAGE", "MESSAGES", "MP", "MAIL", "MAILS", "ENVOIS", "JE", "VEUX", "VOUDRAIS", "MAINTENANT", "DONC", "ALORS", "BIEN",
  "PLEASE", "THANKS", "THANK", "YOU", "HELLO", "HI", "SIL",
];
/** Négations : leur présence rend toute opposition douteuse (« ne vous arrêtez pas »). */
export const NEGATIONS: readonly string[] = ["NE", "N", "PAS", "JAMAIS", "SANS", "SURTOUT"];
/** Un mot qui commence ainsi, sans être un mot d'opposition, rend le texte douteux (« stopper », « arrêt maladie »). */
const RACINES_DOUTE: readonly string[] = ["STOP", "ARRET", "DESINSCRI", "DESABONN", "OPPOS"];

export type ClasseOpposition = "opposition" | "doute" | "non";
const LONGUEUR_MAX = 80;
const MOTS_MAX = 8;

/** NFKC, puis sans accents, majuscules ; tout caractère non lettre/chiffre devient une espace ; découpe en mots. */
export function motsDe(texte: string): string[] {
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
  let compactes = 0; // une phrase d'opposition compte pour UN mot (sinon les formes longues dépasseraient MOTS_MAX)
  for (let i = 0; i < mots.length; ) {
    const ph = PHRASES_MOTS.find((p) => p.every((m, k) => mots[i + k] === m));
    if (ph) {
      trouves.push(ph.join(" "));
      i += ph.length;
      compactes += ph.length - 1;
    } else if (MOTS_OPPOSITION.includes(mots[i])) {
      trouves.push(mots[i]);
      i++;
    } else autres.push(mots[i++]);
  }
  const racine = autres.some((m) => RACINES_DOUTE.some((r) => m.startsWith(r)));
  return { trouves, autres, doute: racine, nbMots: mots.length - compactes, longueur: mots.join(" ").length };
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

/** Racines d'un refus ou d'une demande de retrait (« je refuse », « supprimez mes données », « je suis contre », « opose » faute de frappe). */
const RACINES_REFUS: readonly string[] = ["SUPPRIM", "EFFAC", "REFUS", "RETIR", "CONTRE", "OPOSE"];
const EXPRESSIONS_REFUS: readonly (readonly string[])[] = [["NON", "MERCI"], ["NAN", "MERCI"], ["NE", "VEUX", "PAS"], ["NE", "VOULAIS", "PAS"], ["VEUX", "PAS"], ["PAS", "INTERESSE"], ["PAS", "INTERESSEE"],
  ["NE", "SOUHAITE", "PAS"], ["SOUHAITE", "PAS"], ["PREFERE", "PAS"]];

/**
 * Le texte exprime-t-il un refus ou une demande de retrait (sans être une opposition claire) ? PUR.
 * Sert en attente d'adresse : une réponse SANS adresse de ce genre ne doit jamais déclencher la relance « adresse non reconnue » (doute à la place).
 */
export function exprimeUnRefus(texte: string | null | undefined): boolean {
  if (typeof texte !== "string") return false;
  const mots = motsDe(texte);
  if (mots.length === 1 && (mots[0] === "NON" || mots[0] === "NAN")) return true;
  if (mots.some((m) => RACINES_REFUS.some((r) => m.startsWith(r)))) return true;
  return EXPRESSIONS_REFUS.some((e) => mots.some((_, i) => e.every((m, k) => mots[i + k] === m)));
}
