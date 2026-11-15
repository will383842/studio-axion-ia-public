// L5-26 : table mot × publication côté Studio. PUR : aucun réseau, aucune donnée de personne conservée ni lue.

export interface ContactAttribuable {
  mot: string;
  post_ref?: string | null;
}
export interface LigneAttribution {
  mot: string;
  post_ref: string;
  contacts: number;
}
export interface TableAttribution {
  lignes: LigneAttribution[];
  /** Contacts sans post_ref : « non rattaché ». */
  nonRattaches: number;
}

/** Compte les contacts par couple mot × publication ; sans post_ref, le contact est « non rattaché ». Tri stable (mot, puis post_ref). */
export function attribuerContacts(contacts: readonly ContactAttribuable[]): TableAttribution {
  const comptes = new Map<string, LigneAttribution>();
  let nonRattaches = 0;
  for (const c of contacts) {
    if (typeof c.post_ref !== "string" || c.post_ref.trim() === "") {
      nonRattaches += 1;
      continue;
    }
    const ref = c.post_ref.trim();
    const cle = `${c.mot}\u0000${ref}`;
    const l = comptes.get(cle);
    if (l) l.contacts += 1;
    else comptes.set(cle, { mot: c.mot, post_ref: ref, contacts: 1 });
  }
  const lignes = [...comptes.values()].sort((a, b) => (a.mot < b.mot ? -1 : a.mot > b.mot ? 1 : a.post_ref < b.post_ref ? -1 : a.post_ref > b.post_ref ? 1 : 0));
  return { lignes, nonRattaches };
}

const RE_EMAIL = /[^\s@"'<>]+\s*@\s*[^\s@"'<>]+?(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/;

/** Ramène les formes dissimulées d'une adresse (« [at] », « (at) », « arobase », « ＠ », « %40 », « [dot] ») à la forme littérale. */
function deshabiller(corps: string): string {
  let t = corps.normalize("NFKC");
  try {
    t = decodeURIComponent(t);
  } catch {
    t = t.replace(/%40/gi, "@");
  }
  return t
    .replace(/[[({<]\s*(?:at|arobase)\s*[\])}>]/gi, "@")
    .replace(/\barobase\b/gi, "@")
    .replace(/[[({<]\s*(?:dot|point)\s*[\])}>]/gi, ".");
}

/** Un corps qui contient une adresse e-mail, même dissimulée, est refusé (jamais de donnée de personne dans une jointure). */
export function corpsAcceptable(corps: string): { ok: true } | { ok: false; motif: "email_interdit" } {
  return RE_EMAIL.test(corps) || RE_EMAIL.test(deshabiller(corps)) ? { ok: false, motif: "email_interdit" } : { ok: true };
}

/** Valeur de utm_campaign d'un lien suivi (celle que `construireLienSuivi` y a écrite), ou null. */
export function utmCampaignDuLien(lien: string): string | null {
  try {
    return new URL(lien).searchParams.get("utm_campaign");
  } catch {
    return null;
  }
}
