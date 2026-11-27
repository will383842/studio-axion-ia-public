/**
 * RAP-1 · Décision PURE du rapatriement : quels posts du diffuseur manquent au calendrier du Studio.
 * Aucun réseau, aucun dépôt, aucun import d'exécution du fournisseur (types seulement). Les écritures éventuelles
 * se font dans le service, DANS le serveur, jamais ici.
 */
import type { PostZernio, PlateformePostZernio } from "../fournisseurs/publication/zernio-client";
import type { IdReseau, Publication } from "./types";

/** Statuts lus chez le diffuseur pour le rapatriement (« à venir »). */
export const STATUTS_RAPATRIES = ["scheduled", "draft", "publishing"] as const;

export type RaisonEcart = "absent" | "sans-date" | "reseau-inconnu";

export interface ConnusLocaux {
  /** `idExterne` des publications locales (rapatriées, retirées ou nées au Studio). */
  idsExternes: ReadonlySet<string>;
  /** `cleEnvoi` des publications locales. */
  clesEnvoi: ReadonlySet<string>;
  /** `(cleDiffuseur ?? cle)` des envois planifiés : le créneau montre déjà ce post. */
  clesCreneaux: ReadonlySet<string>;
}

export type PublicationARapatrier = Omit<Publication, "creeLe" | "modifieLe">;

export interface DecisionRapatriement {
  aCreer: PublicationARapatrier[];
  connus: number;
  /** Posts du diffuseur qui ne sont pas au calendrier et ne peuvent pas y être mis. */
  ecarts: { postId: string; raison: RaisonEcart }[];
}

/**
 * Plateforme du diffuseur → réseau du Studio : l'INVERSE de la table d'envoi (`RESEAUX_PLATEFORME`, zernio-corps.ts), où YouTube
 * chez le diffuseur est `youtube-shorts`. Un test garde les deux tables d'accord.
 */
const PLATEFORME_VERS_RESEAU: Readonly<Record<string, IdReseau>> = {
  instagram: "instagram",
  facebook: "facebook",
  linkedin: "linkedin",
  tiktok: "tiktok",
  youtube: "youtube-shorts",
  pinterest: "pinterest",
};

export function reseauDepuisPlateforme(platform: string): IdReseau | null {
  const p = String(platform ?? "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLATEFORME_VERS_RESEAU, p) ? PLATEFORME_VERS_RESEAU[p] : null;
}

/** Identifiant déterministe d'une publication rapatriée (idempotence). */
export function cleRapatriement(postId: string, accountId: string): string {
  return `zr_${postId}_${accountId}`;
}

const idCompte = (pf: PlateformePostZernio): string => (typeof pf.accountId === "string" ? pf.accountId : String(pf.accountId?._id ?? ""));
const studioCleDe = (post: PostZernio): string | undefined => (typeof post.metadata?.studioCle === "string" && post.metadata.studioCle ? post.metadata.studioCle : undefined);

/** Un post du diffuseur est « connu » (jamais rapatrié deux fois) : même identifiant externe, même clé d'envoi, ou clé d'un envoi planifié. */
export function estConnu(post: PostZernio, c: ConnusLocaux): boolean {
  if (c.idsExternes.has(post._id)) return true;
  const cle = studioCleDe(post);
  return !!cle && (c.clesEnvoi.has(cle) || c.clesCreneaux.has(cle));
}

function origineDe(post: PostZernio): "import-buffer" | "studio" | "externe" {
  const o = post.metadata?.origine;
  return o === "import-buffer" || o === "studio" ? o : "externe";
}

const adresseHttps = (v: unknown): string | undefined => (typeof v === "string" && /^https:\/\//i.test(v) && v.length <= 2000 ? v : undefined);

function mediaDe(post: PostZernio): NonNullable<Publication["mediaDiffuseur"]> {
  const items = Array.isArray(post.mediaItems) ? post.mediaItems : [];
  if (items.length === 0) return { type: "aucun", nombre: 0 };
  const type = items.some((m) => m?.type === "video") ? "video" : items[0]?.type === "document" ? "document" : "image";
  // RAP-3 : image du premier média, ou vignette de la vidéo ; un document n'a pas de miniature. Le seul usage : la carte du calendrier, via le serveur.
  const premier = items[0];
  const miniature = type === "image" ? adresseHttps(premier?.url) : type === "video" ? adresseHttps(premier?.thumbnail) ?? adresseHttps(premier?.thumbnailUrl) : undefined;
  return { type, nombre: items.length, ...(miniature ? { miniature } : {}) };
}

/** Raison pour laquelle ce post ne peut pas être mis au calendrier, ou `null`. */
function raisonImpossible(post: PostZernio): RaisonEcart | null {
  if (typeof post.scheduledFor !== "string" || !Number.isFinite(Date.parse(post.scheduledFor))) return "sans-date";
  const plateformes = Array.isArray(post.platforms) ? post.platforms : [];
  if (plateformes.length === 0 || plateformes.some((pf) => reseauDepuisPlateforme(pf.platform) === null || !idCompte(pf))) return "reseau-inconnu";
  return null;
}

export function deciderRapatriement(
  posts: readonly PostZernio[],
  c: ConnusLocaux,
  o: { instant: string; nomsComptes?: ReadonlyMap<string, string> },
): DecisionRapatriement {
  const aCreer: PublicationARapatrier[] = [];
  const ecarts: DecisionRapatriement["ecarts"] = [];
  let connus = 0;
  for (const post of posts) {
    if (estConnu(post, c)) {
      connus++;
      continue;
    }
    const raison = raisonImpossible(post);
    if (raison) {
      ecarts.push({ postId: post._id, raison });
      continue;
    }
    for (const pf of post.platforms) {
      const compte = idCompte(pf);
      const id = cleRapatriement(post._id, compte);
      if (c.idsExternes.has(id)) continue;
      const nom = o.nomsComptes?.get(compte);
      const cleEnvoi = studioCleDe(post);
      aCreer.push({
        id,
        reseau: reseauDepuisPlateforme(pf.platform)!,
        statut: post.status === "draft" ? "brouillon" : "programmee",
        via: "zernio",
        date: new Date(post.scheduledFor!).toISOString(),
        texte: pf.customContent ?? post.content ?? "",
        idExterne: post._id,
        etatEnvoi: "envoye",
        canalId: compte,
        ...(nom ? { canalNom: nom } : {}),
        ...(cleEnvoi ? { cleEnvoi } : {}),
        envoiCommenceLe: o.instant,
        etatLuLe: o.instant,
        rapatrieeLe: o.instant,
        origineDiffuseur: origineDe(post),
        mediaDiffuseur: mediaDe(post),
      });
    }
  }
  return { aCreer, connus, ecarts };
}

/** Écart seul (sans construire les publications) : combien de posts du diffuseur, et lesquels ne sont pas au calendrier. */
export function compterEcart(posts: readonly PostZernio[], c: ConnusLocaux): { chezDiffuseur: number; absents: { postId: string; raison: RaisonEcart }[] } {
  const absents: { postId: string; raison: RaisonEcart }[] = [];
  for (const post of posts) {
    if (estConnu(post, c)) continue;
    absents.push({ postId: post._id, raison: raisonImpossible(post) ?? "absent" });
  }
  return { chezDiffuseur: posts.length, absents };
}
