/**
 * PORTE DE LECTURE DES FAITS DU SITE — partie pure (fiche KB-02). Ni réseau, ni base, ni horloge.
 *
 * Trois choses seulement : construire l'adresse de recherche (jamais d'autre point d'entrée que la recherche),
 * ne garder de la réponse que les résultats de la forme attendue, et masquer tout montant avant l'affichage.
 */

/** Plafond de résultats demandés (le site accepte jusqu'à 100 ; le Studio n'en veut pas plus de 10). */
export const LIMITE_FAITS = 10;
/** Longueur maximale d'une recherche (limite du site). */
export const LONGUEUR_MAX_RECHERCHE = 200;
/** Seul point d'entrée du site que le Studio appelle. */
export const CHEMIN_RECHERCHE_SITE = "/api/internal/kb/search";

/** Un résultat de recherche du site, tel que validé. */
export interface FaitSite {
  entryId: string;
  translationId: string;
  type: string;
  slug: string;
  title: string;
  excerpt: string;
  locale: string;
  rank: number;
}

/** Adresse de base du site : http(s) seulement, sans identifiants ; sinon `null` (porte éteinte). */
export function baseSiteValide(base: string | undefined): string | null {
  const b = (base ?? "").trim();
  if (!b) return null;
  let u: URL;
  try {
    u = new URL(b);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  return u.origin;
}

/** Recherche nettoyée et coupée à 200 caractères ; vide si rien à chercher. */
export function nettoyerRecherche(q: unknown): string {
  return typeof q === "string" ? q.trim().slice(0, LONGUEUR_MAX_RECHERCHE).trim() : "";
}

/** Adresse de recherche : `<site>/api/internal/kb/search?q=…&locale=fr&limit=10`, ou `null` (base ou recherche invalide). */
export function construireAdresseRecherche(base: string | undefined, q: unknown): string | null {
  const origine = baseSiteValide(base);
  const texte = nettoyerRecherche(q);
  if (!origine || !texte) return null;
  const u = new URL(CHEMIN_RECHERCHE_SITE, origine);
  u.searchParams.set("q", texte);
  u.searchParams.set("locale", "fr");
  u.searchParams.set("limit", String(LIMITE_FAITS));
  return u.toString();
}

const texteNonVide = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Un résultat est gardé seulement s'il a EXACTEMENT les champs attendus, du bon type (les champs en trop sont jetés). */
export function validerFait(brut: unknown): FaitSite | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const h = brut as Record<string, unknown>;
  const { entryId, translationId, type, slug, title, excerpt, locale, rank } = h;
  if (![entryId, translationId, type, slug, title, locale].every(texteNonVide)) return null;
  if (typeof excerpt !== "string") return null;
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  return { entryId: entryId as string, translationId: translationId as string, type: type as string, slug: slug as string, title: title as string, excerpt, locale: locale as string, rank };
}

/** Réponse `{ hits: [...] , total }` du site : liste des résultats valides (au plus 10), vide si la forme est mauvaise. */
export function validerReponseRecherche(corps: unknown): FaitSite[] {
  if (!corps || typeof corps !== "object") return [];
  const hits = (corps as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  const sortie: FaitSite[] = [];
  for (const brut of hits) {
    const fait = validerFait(brut);
    if (fait) sortie.push(fait);
    if (sortie.length >= LIMITE_FAITS) break;
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Montants : jamais à l'écran du Studio                               */
/* ------------------------------------------------------------------ */

const NOMBRE = String.raw`\d+(?:[ .,  ]\d+)*`;
const DEVISE = String.raw`(?:€|\$|(?:eur(?:os?)?|usd|dollars?)(?![a-zà-ÿ]))`;
/** Un nombre suivi d'une devise (avec « k » ou « M » possibles), ou une devise suivie d'un nombre. */
const reMontant = () => new RegExp(String.raw`(?:${NOMBRE}\s*[km]?\s*${DEVISE}|(?:€|\$)\s*${NOMBRE})`, "gi");

export const TEXTE_MONTANT_MASQUE = "[montant masqué]";

/** Remplace tout montant d'argent d'un texte par « [montant masqué] » ; les autres nombres ne sont pas touchés. */
export function masquerMontants(texte: string): string {
  return texte.replace(reMontant(), TEXTE_MONTANT_MASQUE);
}

export function contientMontant(texte: string): boolean {
  return reMontant().test(texte);
}

/** Un fait prêt à l'affichage : titre et extrait sans montant. */
export function faitSansMontant(f: FaitSite): FaitSite {
  return { ...f, title: masquerMontants(f.title), excerpt: masquerMontants(f.excerpt) };
}
