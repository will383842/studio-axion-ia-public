// Textes GÉNÉRIQUES posés par le code (jamais par le spec) : aucun lien, aucun nom, aucun mot-clé d'appel.
// La dernière page sombre (T21) invite à écrire en message privé ; les étiquettes de la page avant/après (T08) sont neutres.
export const TEXTES_FIXES = {
  t21Titre: "Écrivez-nous en message privé",
  t21Ligne: "Une question, une idée, un projet : un message privé suffit.",
  t08Avant: "Avant",
  t08Apres: "Après",
  /** Signature discrète en bas à gauche des pages intérieures. */
  signature: "Axion-IA",
} as const;

/**
 * Étiquette de rubrique posée par le CODE au-dessus du titre des pages INTÉRIEURES (jamais sur une couverture ni sur la page sombre) :
 * générique, en capitales, sans chiffre, sans mot d'appel. Le spec n'en fournit aucune.
 */
export const RUBRIQUES = {
  T02: "EN PRATIQUE",
  T06: "L’ESSENTIEL",
  T08: "LE CONSTAT",
  T10: "À RETENIR",
  T20: "LA MÉTHODE",
  T22: "IDÉE REÇUE",
  T23: "LES BONNES QUESTIONS",
  T24: "LA DIFFÉRENCE",
  T26: "CAS CONCRET",
  T27: "À VÉRIFIER",
  T28: "LE CIRCUIT",
} as const;
export type TypePageAvecRubrique = keyof typeof RUBRIQUES;

/** Textes génériques des gabarits de la vague 1 (L9), posés par le code : jamais de chiffre, jamais de promesse. */
export const TEXTES_FIXES_L9 = {
  t22Mythe: "MYTHE",
  t22Realite: "RÉALITÉ",
  /** Annotation manuscrite à côté de la flèche (espace fine insécable avant « ! »). */
  t22Bascule: "Pas si vite\u202f!",
  t24Sans: "SANS",
  t24Avec: "AVEC",
  /** Étiquette OBLIGATOIRE d'un cas concret : le cas est inventé pour l'exemple. */
  t26Etiquette: "Scénario type · exemple illustratif",
  t26Avant: "AVANT",
  t26AvecNous: "AVEC NOUS",
  t26Vous: "VOUS :",
  t27Jauge: "Plus vous répondez «\u00a0oui\u00a0», plus le sujet mérite qu’on s’y arrête.",
} as const;

/** Minuscules, sans accent, apostrophes et ponctuation ramenées à une espace. */
const motsCompares = (texte: string): string =>
  ` ${texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/**
 * Rubrique à afficher au-dessus du titre, ou `undefined` quand le titre la dit déjà (« Idée reçue, réalité » sous « IDÉE REÇUE ») :
 * la rubrique, sans son article de tête, est comparée mot pour mot au titre, sans casse ni accents.
 */
export function rubriqueAffichee(type: TypePageAvecRubrique, titre: string | undefined): string | undefined {
  const rubrique = RUBRIQUES[type];
  const coeur = motsCompares(rubrique).replace(/^ (?:le|la|les|l) /u, " ");
  return titre && motsCompares(titre).includes(coeur) ? undefined : rubrique;
}
