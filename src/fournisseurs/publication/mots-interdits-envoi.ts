/**
 * Mots refusés à l'ENVOI vers Buffer (règle éditoriale permanente : ces mots ne sont jamais publiés) : chacun, seul,
 * suffit à refuser le texte du post comme le premier commentaire. Insensible à la casse, aux accents, aux caractères
 * invisibles (y compris toute la catégorie Cf) et aux mots collés en camelCase (#MotMot). Les mots voisins légitimes
 * restent autorisés.
 * Fichier à part : il ne touche pas aux règles d'interdits du studio.
 */
const J = (...p: string[]) => p.join("");
const FAMILLE = J("cert", "ifi");
const NOM_QUALITE = J("quali", "opi");

const RACINES: readonly { libelle: string; motif: RegExp }[] = [
  // Famille du participe : la racine sans frontière de gauche (préfixes, mots collés, #mot-dièse) ; seule la série
  // « -cat » est exclue (certificat, certificateur…), sauf si elle devient « -cation » (le nom du processus, refusé).
  { libelle: J("cert", "ifié"), motif: new RegExp(`${FAMILLE}(?!cat(?!ion))`) },
  // Nom du label qualité : la racine seule, sans aucune frontière (aucun mot légitime ne la contient).
  { libelle: J("Quali", "opi"), motif: new RegExp(NOM_QUALITE) },
];

// Caractères invisibles écrits en séquences d'échappement : trait d'union conditionnel, espaces sans largeur,
// joint de mot, marques de formatage (U+180E, U+200B-U+200F, U+2028-U+202E, U+2060-U+206F), BOM, tout le reste de Cf.
const INVISIBLES = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]|\p{Cf}/gu;
// Espaces étroites ou insécables : gardées comme espace, ou supprimées pour couper un mot en deux.
const ESPACES_INSECABLES = /[\u00A0\u2007\u2009\u200A\u202F]/g;
// Marques combinantes (accents) retirées après NFKD.
const ACCENTS = /[\u0300-\u036F]/g;

/** Texte à plat : compatibilité (ligature fi…), sans invisibles ni accents, minuscules ; mots collés séparés si demandé. */
function aplatir(t: string, insecableSupprimee: boolean, separerCamel: boolean): string {
  const sansCamel = t
    .replace(ESPACES_INSECABLES, insecableSupprimee ? "" : " ") // avant NFKD, qui les convertirait en espace
    .normalize("NFKD")
    .replace(INVISIBLES, "")
    .replace(ACCENTS, "");
  return (separerCamel ? sansCamel.replace(/([a-z])([A-Z])/g, "$1 $2") : sansCamel).toLowerCase();
}

/** Les mots interdits présents dans ce texte (libellés, sans doublon). PUR. */
export function motsInterditsEnvoi(texte: string): string[] {
  // Lectures : espace insécable gardée puis supprimée (coupe au milieu d'un mot) ; camelCase coupé ou non (nom collé).
  const lectures = [aplatir(texte, false, true), aplatir(texte, true, true), aplatir(texte, true, false)];
  return RACINES.filter((r) => lectures.some((n) => r.motif.test(n))).map((r) => r.libelle);
}
