/** Petits utilitaires de texte en français. PUR. */
export function pluriel(n: number, singulier: string, plurielForme?: string): string {
  return `${n} ${n > 1 ? (plurielForme ?? singulier + "s") : singulier}`;
}

export function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Comparaison pour la recherche : insensible à la casse et aux accents. */
export function contient(texte: string | undefined, requete: string): boolean {
  if (!texte) return false;
  return sansAccents(texte.toLowerCase()).includes(sansAccents(requete.toLowerCase().trim()));
}

export function tronquer(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Typographie française à l'affichage : l'espace avant « ? ! : ; » et après « « » devient insécable,
 * pour qu'un « ? » ne parte jamais seul à la ligne.
 */
export function insecable(t: string): string {
  const nb = String.fromCharCode(0xa0);
  return t.replace(/ ([?!:;»])/g, `${nb}$1`).replace(/« /g, `«${nb}`);
}
