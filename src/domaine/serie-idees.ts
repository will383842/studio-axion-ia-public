/** Écriture en série (B7) : découpage PUR d'un champ « plusieurs idées, une par ligne ». */

/** Au plus 20 idées d'un geste (même limite que le service). */
export const MAX_IDEES_SERIE = 20;

/** Une idée par ligne : puces et numéros retirés, lignes vides et doublons ignorés, 20 au plus. */
export function ideesParLigne(texte: string): string[] {
  const vues = new Set<string>();
  const idees: string[] = [];
  for (const brute of texte.split(/\r?\n/)) {
    const l = brute.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim();
    if (!l || vues.has(l.toLowerCase())) continue;
    vues.add(l.toLowerCase());
    idees.push(l);
  }
  return idees.slice(0, MAX_IDEES_SERIE);
}
