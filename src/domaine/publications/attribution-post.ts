/**
 * L5-26 · clé de jointure publication × mot (partie 19a). PUR, aucune donnée de personne.
 * - Un contact sans `post_ref` est « non rattaché ».
 * - Un corps qui contient une adresse e-mail est refusé.
 * - `utm_campaign` d'un lien suivi = code du lien (`construireLienSuivi`, src/domaine/mesures.ts).
 */

export interface OrigineContact {
  mot: string;
  reseau: string;
  post_ref?: string;
}

export type Rattachement = { statut: "non_rattache" } | { statut: "rattache"; cle: { mot: string; postRef: string } };

export function rattacherContact(o: OrigineContact): Rattachement {
  const ref = o.post_ref?.trim();
  if (!ref) return { statut: "non_rattache" };
  return { statut: "rattache", cle: { mot: o.mot.trim().toUpperCase(), postRef: ref } };
}

const RE_EMAIL = /[^\s@]+@[^\s@]+/;

export function corpsSansEmail(corps: string): { ok: true } | { ok: false; motif: "email_interdit" } {
  return RE_EMAIL.test(corps) ? { ok: false, motif: "email_interdit" } : { ok: true };
}

export interface LigneJointure {
  mot: string;
  postRef: string;
  contacts: number;
}

export function jointureMotPublication(origines: readonly OrigineContact[]): { lignes: LigneJointure[]; nonRattaches: number } {
  const table = new Map<string, LigneJointure>();
  let nonRattaches = 0;
  for (const o of origines) {
    const r = rattacherContact(o);
    if (r.statut === "non_rattache") {
      nonRattaches += 1;
      continue;
    }
    const k = `${r.cle.mot}\u0000${r.cle.postRef}`;
    const l = table.get(k) ?? { mot: r.cle.mot, postRef: r.cle.postRef, contacts: 0 };
    l.contacts += 1;
    table.set(k, l);
  }
  const lignes = [...table.values()].sort((a, b) => a.mot.localeCompare(b.mot) || a.postRef.localeCompare(b.postRef));
  return { lignes, nonRattaches };
}

/** Valeur de `utm_campaign` d'un lien suivi (sans fragment, décodée), ou null. */
export function utmCampaignDuLien(lien: string): string | null {
  try {
    return new URL(lien).searchParams.get("utm_campaign") || null;
  } catch {
    return null;
  }
}
