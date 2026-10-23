/** Comparaison de numéros de version (PUR). « v4.0.532 », « n9.0.2 », « 4.0.532 » se comparent ; le reste non. */

/** « v4.0.532 » → « 4.0.532 » ; null si ce n'est pas un numéro de version. */
export function versionNette(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.trim().match(/^[vn]?(\d+(?:\.\d+){0,3})$/i);
  return m ? m[1] : null;
}

/** > 0 si `a` est plus récente que `b`, 0 si égales, < 0 sinon ; null si l'une n'est pas un numéro de version. */
export function comparerVersions(a: string | undefined, b: string | undefined): number | null {
  const x = versionNette(a);
  const y = versionNette(b);
  if (!x || !y) return null;
  const pa = x.split(".").map(Number);
  const pb = y.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export type Ecart = "majeur" | "mineur" | "correctif" | "aucun" | "inconnu";

/** Ampleur du saut de `utilisee` à `vue` (majeur = premier chiffre). */
export function ecartVersions(utilisee: string | undefined, vue: string | undefined): Ecart {
  const c = comparerVersions(vue, utilisee);
  if (c === null) return "inconnu";
  if (c <= 0) return "aucun";
  const [a1, a2] = versionNette(utilisee)!.split(".").map(Number);
  const [b1, b2] = versionNette(vue)!.split(".").map(Number);
  if (b1 !== a1) return "majeur";
  if ((b2 ?? 0) !== (a2 ?? 0)) return "mineur";
  return "correctif";
}

/** Plus grande version stable d'une liste d'étiquettes (« -dev », « -rc », « beta » écartées). */
export function plusRecente(etiquettes: string[]): string | null {
  let meilleure: string | null = null;
  for (const e of etiquettes) {
    if (!versionNette(e)) continue;
    if (meilleure === null || (comparerVersions(e, meilleure) ?? 0) > 0) meilleure = e;
  }
  return meilleure ? versionNette(meilleure) : null;
}
