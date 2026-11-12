// Parcours « mot → e-mail → guide » : ORIGINE COMPLÈTE (contrat v3). PUR : aucun réseau, aucune base, aucun secret.
// Tous les champs d'origine sont FACULTATIFS. Le drapeau `ORIGINE_V3_ENABLED` est ÉTEINT par défaut : sans lui, le Studio envoie le corps v1 inchangé.
// Interdits au contrat : pseudo, nom affiché, texte d'un commentaire ou d'un message, identifiant de profil en clair.
import { corpsDemandeGuide, type RunLu } from "./crochet-zernio";
import dictionnaire from "../../../contrats/dictionnaire-origine.v1.json";

export const VARIABLE_INTERRUPTEUR_ORIGINE_V3 = "ORIGINE_V3_ENABLED";
/** Préfixes de chemin de NOS comptes (séparés par des virgules), lus dans la configuration du Studio côté serveur : jamais fournis par Zernio. */
export const VARIABLE_PREFIXES_COMPTES_ORIGINE = "ORIGINE_V3_PREFIXES_COMPTES";
export function prefixesComptesConfigures(env: Record<string, string | undefined> = process.env): string[] {
  return (env[VARIABLE_PREFIXES_COMPTES_ORIGINE] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
}
/** Identifiants des comptes Zernio autorisés à envoyer le corps v3 (séparés par des virgules). Vide ou absent = aucun compte (éteint par défaut). */
export const VARIABLE_COMPTES_ORIGINE_V3 = "ORIGINE_V3_COMPTES";
export function comptesOrigineV3(env: Record<string, string | undefined> = process.env): string[] {
  return (env[VARIABLE_COMPTES_ORIGINE_V3] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
}
export function compteAutoriseOrigineV3(idCompte: string, env: Record<string, string | undefined> = process.env): boolean {
  return idCompte !== "" && comptesOrigineV3(env).includes(idCompte);
}
/** Éteint par défaut : seules les valeurs exactes « 1 » et « true » allument. */
export function origineV3Active(env: Record<string, string | undefined> = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_ORIGINE_V3];
  return v === "1" || v === "true";
}

export const SCHEMA_VERSION_ORIGINE = 3;
export const CANAUX = ["commentaire", "message_prive"] as const;
export type Canal = (typeof CANAUX)[number];
/** Réseaux où le Studio ne répond jamais en message privé : réponse publique seule. */
export const RESEAUX_REPONSE_PUBLIQUE_SEULE: readonly string[] = ["linkedin_page", "tiktok"];

export const RE_POST_REF = /^[A-Za-z0-9_-]{8,80}$/;
/** Forme d'une clé du dictionnaire fermé (ASCII minuscules) : premier filtre, avant la vérification d'appartenance. */
export const RE_CLE_DICTIONNAIRE = /^[a-z0-9_]{2,40}$/;
/** Dictionnaire fermé « Famille › Détail » : copie exacte de celui du site (contrats/, empreinte vérifiée par test). */
const FAMILLES: Readonly<Record<string, { details: Readonly<Record<string, unknown>> }>> = dictionnaire.familles;
const possede = (o: object, cle: string) => Object.prototype.hasOwnProperty.call(o, cle);
export function familleDansDictionnaire(famille: string): boolean {
  return RE_CLE_DICTIONNAIRE.test(famille) && possede(FAMILLES, famille);
}
/** Un détail n'existe que sous SA famille. */
export function detailDansDictionnaire(famille: string, detail: string): boolean {
  return familleDansDictionnaire(famille) && RE_CLE_DICTIONNAIRE.test(detail) && possede(FAMILLES[famille].details, detail);
}
export const RE_COMPTE = /^[a-z0-9_]{2,40}$/;
export const RE_UTM_CAMPAGNE = /^[a-z0-9_-]{2,60}$/;
export const RE_VERSION_TEXTE_ORIGINE = /^[A-Za-z0-9._-]{3,64}$/;
export const POST_URL_MAX = 300;

/** Hôtes publics autorisés, par réseau : égalité STRICTE (jamais de `endsWith`). `page_guide` n'a pas de publication publique. */
export const HOTES_POST_URL: Record<string, readonly string[]> = {
  instagram: ["www.instagram.com", "instagram.com"],
  facebook: ["www.facebook.com", "facebook.com"],
  linkedin_page: ["www.linkedin.com"],
  tiktok: ["www.tiktok.com"],
  page_guide: [],
};
/** Ce qui doit suivre le préfixe de nos comptes : un segment de publication, jamais un simple profil. */
const RE_SEGMENT_PUBLICATION = /^(?:p|reel|reels|tv|posts|video|videos|feed\/update)\/[A-Za-z0-9_:%.-]+\/?$/;

/**
 * URL publique d'une publication de NOS comptes. `prefixesComptes` : préfixes de chemin (commencent et finissent par « / »)
 * fournis par l'appelant ; liste vide = tout refuser (aucune URL ne part sans préfixe connu). Jamais récupérée par le serveur.
 */
export function postUrlValide(url: unknown, reseau: string, prefixesComptes: readonly string[]): boolean {
  if (typeof url !== "string" || url.length === 0 || url.length > POST_URL_MAX || /[\s?#@\\]/.test(url)) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password || u.search || u.hash) return false;
  if (!(HOTES_POST_URL[reseau] ?? []).includes(u.hostname)) return false;
  const prefixe = prefixesComptes.find((p) => /^\/[^/].*\/$/.test(p) && u.pathname.startsWith(p));
  return prefixe !== undefined && RE_SEGMENT_PUBLICATION.test(u.pathname.slice(prefixe.length));
}

/** Entrée (noms français du Studio). Aucune de ces valeurs n'est un pseudo ni un texte de personne. */
export interface OrigineBrute {
  postRef?: string;
  postUrl?: string;
  canal?: string;
  compte?: string;
  famille?: string;
  detail?: string;
  versionTexte?: string;
  utmCampaign?: string;
}
/** Sortie : noms du contrat, ordre FIXE (mêmes octets à chaque reconstruction). */
export interface OrigineV3 {
  post_ref?: string;
  post_url?: string;
  canal?: Canal;
  compte?: string;
  famille?: string;
  detail?: string;
  version_texte?: string;
  utm_campaign?: string;
}
export type CodeRefusOrigine = "post_ref_invalide" | "post_url_invalide" | "canal_invalide" | "message_prive_interdit" | "compte_invalide" | "famille_invalide" | "detail_invalide" | "version_texte_invalide" | "utm_invalide";

/** Construit l'origine. Un champ présent et invalide refuse TOUT (jamais de demi-envoi) ; le code ne répète jamais la valeur. */
export function construireOrigineV3(b: OrigineBrute, o: { reseau: string; prefixesComptes: readonly string[] }): { ok: true; origine: OrigineV3 } | { ok: false; code: CodeRefusOrigine } {
  const sortie: OrigineV3 = {};
  const presente = (v: unknown) => v !== undefined && v !== null;
  if (presente(b.postRef)) {
    if (typeof b.postRef !== "string" || !RE_POST_REF.test(b.postRef)) return { ok: false, code: "post_ref_invalide" };
    sortie.post_ref = b.postRef;
  }
  if (presente(b.postUrl)) {
    if (!postUrlValide(b.postUrl, o.reseau, o.prefixesComptes)) return { ok: false, code: "post_url_invalide" };
    sortie.post_url = b.postUrl;
  }
  if (presente(b.canal)) {
    if (!(CANAUX as readonly string[]).includes(String(b.canal))) return { ok: false, code: "canal_invalide" };
    if (b.canal === "message_prive" && RESEAUX_REPONSE_PUBLIQUE_SEULE.includes(o.reseau)) return { ok: false, code: "message_prive_interdit" };
    sortie.canal = b.canal as Canal;
  }
  const simple = (v: unknown, re: RegExp): v is string => typeof v === "string" && re.test(v);
  if (presente(b.compte)) {
    if (!simple(b.compte, RE_COMPTE)) return { ok: false, code: "compte_invalide" };
    sortie.compte = b.compte;
  }
  if (presente(b.famille)) {
    if (!simple(b.famille, RE_CLE_DICTIONNAIRE) || !familleDansDictionnaire(b.famille)) return { ok: false, code: "famille_invalide" };
    sortie.famille = b.famille;
  }
  if (presente(b.detail)) {
    if (!simple(b.detail, RE_CLE_DICTIONNAIRE) || typeof b.famille !== "string" || !detailDansDictionnaire(b.famille, b.detail)) return { ok: false, code: "detail_invalide" };
    sortie.detail = b.detail;
  }
  if (presente(b.versionTexte)) {
    if (!simple(b.versionTexte, RE_VERSION_TEXTE_ORIGINE)) return { ok: false, code: "version_texte_invalide" };
    sortie.version_texte = b.versionTexte;
  }
  if (presente(b.utmCampaign)) {
    if (!simple(b.utmCampaign, RE_UTM_CAMPAGNE)) return { ok: false, code: "utm_invalide" };
    sortie.utm_campaign = b.utmCampaign;
  }
  return { ok: true, origine: sortie };
}

/** Corps v3 : les clés du corps v1 (même ordre), `schemaVersion` à 3, puis l'origine. Octets stables d'un essai à l'autre. */
export function corpsDemandeGuideV3(run: RunLu, cleIdempotence: string, origine: OrigineV3): string {
  const v1 = JSON.parse(corpsDemandeGuide(run, cleIdempotence)) as Record<string, unknown>;
  return JSON.stringify({ ...v1, schemaVersion: SCHEMA_VERSION_ORIGINE, ...origine });
}
