/**
 * LECTEUR DE STATISTIQUES PAR LISTE ET PAR PÉRIODE (L8-02a). LECTURE SEULE, branché nulle part.
 *
 * Lit la liste paginée de l'outil de publication (`GET /v1/analytics` sans `postId`, 50 publications par page) par le
 * client injecté. Seules requêtes faites : des GET /v1/analytics aux paramètres page, limit, fromDate, toDate, source.
 *
 * Principe : une donnée absente est `null`, jamais zéro ; une lecture ratée a un état distinct (jamais un chiffre
 * inventé). Rien de personnel n'est gardé : ni texte de publication, ni nom de compte, ni vignette, ni média, ni
 * message d'erreur du diffuseur.
 */
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

export interface StatistiquesLues {
  idDiffuseur: string | null;
  /** `latePostId` : l'identifiant gardé dans `Publication.idExterne`. */
  idPostStudio: string | null;
  reseau: string | null;
  urlPubliee: string | null;
  vues: number | null;
  portee: number | null;
  reactions: number | null;
  commentaires: number | null;
  partages: number | null;
  enregistrements: number | null;
  clics: number | null;
  tauxEngagement: number | null;
  publieLe: string | null;
  misesAJourLe: string | null;
  synchro: "a-jour" | "en-cours" | "inconnu";
}

export const PAGES_STATISTIQUES_MAX = 5;
export const TAILLE_PAGE_STATISTIQUES = 50;
export const ETENDUE_MAX_JOURS = 366;

export type ResultatPage =
  | { etat: "lues"; lignes: StatistiquesLues[]; complete: boolean }
  | { etat: "pas-encore-pretes" }
  | { etat: "non-lisible"; raison: "indisponible-offre" | "echec-reseaux" | "refuse" | "illisible" | "reseau" | "invalide" };

type Objet = Record<string, unknown>;
const objet = (x: unknown): Objet | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Objet) : null);

/** Nombre fini, positif ou nul ; sinon null (même lecture que `valeursDepuisAnalyticsZernio`). */
function nombre(x: unknown): number | null {
  const n = typeof x === "string" ? Number.parseFloat(x) : x;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}
const entier = (x: unknown): number | null => {
  const n = nombre(x);
  return n === null ? null : Math.round(n);
};
const texte = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);
const dateIso = (x: unknown): string | null => (typeof x === "string" && x.length > 0 && !Number.isNaN(Date.parse(x)) ? x : null);

/** Une publication de la liste (ou un post seul) → statistiques lues (PUR). Null si aucun bloc `analytics` lisible. */
export function statistiquesDepuisPost(brut: unknown): StatistiquesLues | null {
  const c = objet(brut);
  const a = c ? objet(c.analytics) : null;
  if (!c || !a) return null;
  const lu = [a.views, a.impressions, a.reach, a.likes, a.comments, a.shares, a.saves, a.clicks, a.engagementRate].some((v) => nombre(v) !== null);
  if (!lu) return null;
  const reseau = texte(c.platform);
  const url = texte(c.platformPostUrl);
  const story = reseau === "facebook" && (c.mediaType === "story" || (url !== null && url.includes("/stories/")));
  const premiere = Array.isArray(c.platforms) ? objet(c.platforms[0]) : null;
  const sync = texte(c.syncStatus) ?? (premiere ? texte(premiere.syncStatus) : null);
  const tauxBrut = nombre(a.engagementRate);
  return {
    idDiffuseur: texte(c._id) ?? texte(c.postId),
    idPostStudio: texte(c.latePostId),
    reseau,
    urlPubliee: url,
    vues: entier(a.views) ?? entier(a.impressions),
    portee: entier(a.reach),
    reactions: entier(a.likes),
    commentaires: entier(a.comments),
    partages: entier(a.shares),
    enregistrements: entier(a.saves),
    clics: story ? null : entier(a.clicks),
    tauxEngagement: tauxBrut === null ? null : Math.round(tauxBrut * 100) / 100,
    publieLe: dateIso(c.publishedAt),
    misesAJourLe: dateIso(a.lastUpdated),
    synchro: sync === "synced" ? "a-jour" : sync === "pending" ? "en-cours" : "inconnu",
  };
}

/** Réponse 200 de la liste → lignes lues (PUR). `complete` : moins d'une page pleine de publications lues. */
export function pageDepuisListe(corps: unknown): { lignes: StatistiquesLues[]; complete: boolean } | null {
  const c = objet(corps);
  if (!c || !Array.isArray(c.posts)) return null;
  const lignes: StatistiquesLues[] = [];
  for (const p of c.posts) {
    const l = statistiquesDepuisPost(p);
    if (l) lignes.push(l);
  }
  return { lignes, complete: c.posts.length < TAILLE_PAGE_STATISTIQUES };
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
function jourUtc(s: string): number | null {
  const m = JOUR.exec(s);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(t).toISOString().slice(0, 10) === s ? t : null;
}
function periodeValide(du: string, au: string): boolean {
  const a = jourUtc(du);
  const b = jourUtc(au);
  if (a === null || b === null || a > b) return false;
  return (b - a) / 86_400_000 <= ETENDUE_MAX_JOURS;
}

const INVALIDE: ResultatPage = { etat: "non-lisible", raison: "invalide" };

/** UNE requête GET /v1/analytics. Période fausse ou trop longue : refus SANS requête. */
export async function lirePageStatistiques(client: Pick<ClientZernio, "requete">, q: { page: number; du: string; au: string }): Promise<ResultatPage> {
  if (!Number.isInteger(q.page) || q.page < 1 || !periodeValide(q.du, q.au)) return INVALIDE;
  try {
    const rep = await client.requete({ methode: "GET", chemin: "/v1/analytics", query: { page: q.page, limit: TAILLE_PAGE_STATISTIQUES, fromDate: q.du, toDate: q.au, source: "late" } });
    if (rep.statut === 202) return { etat: "pas-encore-pretes" };
    const page = pageDepuisListe(rep.corps);
    return page ? { etat: "lues", ...page } : { etat: "non-lisible", raison: "illisible" };
  } catch (e) {
    if (!estErreurZernio(e)) return { etat: "non-lisible", raison: "reseau" };
    if (e.statut === 202) return { etat: "pas-encore-pretes" };
    if (e.statut === 424) return { etat: "non-lisible", raison: "echec-reseaux" };
    if (e.statut === 402) return { etat: "non-lisible", raison: "indisponible-offre" };
    if (e.statut === 400) return INVALIDE;
    return { etat: "non-lisible", raison: e.code === "acces" || e.code === "refuse" ? "refuse" : "reseau" };
  }
}

/** Pages 1, 2, … (5 au plus) ; arrêt à la première page complète, vide, 202 ou en échec. `requetes` compte tout. */
export async function lireStatistiquesPeriode(
  client: Pick<ClientZernio, "requete">,
  { du, au, pagesMax }: { du: string; au: string; pagesMax: number },
): Promise<{ lignes: StatistiquesLues[]; requetes: number; complet: boolean; dernierEtat: ResultatPage["etat"] }> {
  const lignes: StatistiquesLues[] = [];
  const plafond = Math.min(Number.isFinite(pagesMax) ? Math.floor(pagesMax) : 0, PAGES_STATISTIQUES_MAX);
  if (plafond < 1 || !periodeValide(du, au)) return { lignes, requetes: 0, complet: false, dernierEtat: "non-lisible" };
  let requetes = 0;
  let dernierEtat: ResultatPage["etat"] = "non-lisible";
  for (let page = 1; page <= plafond; page++) {
    requetes++;
    const r = await lirePageStatistiques(client, { page, du, au });
    dernierEtat = r.etat;
    if (r.etat !== "lues") return { lignes, requetes, complet: false, dernierEtat };
    lignes.push(...r.lignes);
    if (r.complete) return { lignes, requetes, complet: true, dernierEtat };
  }
  return { lignes, requetes, complet: false, dernierEtat };
}
