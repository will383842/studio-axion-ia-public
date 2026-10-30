/**
 * Mots refusés à l'ENVOI vers Buffer (règle éditoriale permanente : ces mots ne sont jamais publiés) : chacun, seul,
 * suffit à refuser le texte du post comme le premier commentaire. Insensible à la casse, aux accents, aux caractères
 * invisibles et aux mots collés en camelCase (#MotMot). Les mots voisins légitimes restent autorisés.
 * Fichier à part : il ne touche pas aux règles d'interdits du studio.
 */
const J = (...p: string[]) => p.join("");
const FAMILLE = J("cert", "ifi");
const NOM_QUALITE = J("quali", "opi");

const RACINES: readonly { libelle: string; motif: RegExp }[] = [
  // Famille du participe : formes exactes (les mots voisins légitimes ne passent pas ce motif).
  { libelle: J("cert", "ifié"), motif: new RegExp(`(?<![a-z])${FAMILLE}(?:e|ee|es|ees|er|ant|ante|ants|antes|ons|ez)?(?![a-z])`) },
  { libelle: J("cert", "ification"), motif: new RegExp(`(?<![a-z])${J("cert", "ification")}s?(?![a-z])`) },
  // Nom du label qualité : la racine seule, sans aucune frontière (aucun mot légitime ne la contient).
  { libelle: J("Quali", "opi"), motif: new RegExp(NOM_QUALITE) },
];

const INVISIBLES = /[­​-‍⁠﻿]/g;
const ESPACES_INSECABLES = /[   ]/g;

/** Texte à plat : compatibilité (ligature fi…), sans invisibles ni accents, minuscules ; mots collés séparés si demandé. */
function aplatir(t: string, insecableSupprimee: boolean, separerCamel: boolean): string {
  const sansCamel = t
    .replace(ESPACES_INSECABLES, insecableSupprimee ? "" : " ") // avant NFKD, qui les convertirait en espace
    .normalize("NFKD")
    .replace(INVISIBLES, "")
    .replace(/[̀-ͯ]/g, "");
  return (separerCamel ? sansCamel.replace(/([a-z])([A-Z])/g, "$1 $2") : sansCamel).toLowerCase();
}

/** Les mots interdits présents dans ce texte (libellés, sans doublon). PUR. */
export function motsInterditsEnvoi(texte: string): string[] {
  // Lectures : espace insécable gardée puis supprimée (coupe au milieu d'un mot) ; camelCase coupé ou non (nom collé).
  const lectures = [aplatir(texte, false, true), aplatir(texte, true, true), aplatir(texte, true, false)];
  return RACINES.filter((r) => lectures.some((n) => r.motif.test(n))).map((r) => r.libelle);
}
