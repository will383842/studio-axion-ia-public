/**
 * IMP-1 — CLIENT ET LECTURE DES POSTS À VENIR DANS BUFFER. LECTURE SEULE.
 *
 * - Toute requête contenant « mutation » (casse indifférente) est REFUSÉE avant l'envoi.
 * - La clé vient de l'environnement du serveur (BUFFER_API_KEY, même adresse que le fournisseur Buffer du dépôt) ;
 *   elle n'apparaît jamais dans une erreur, un rapport ou un journal.
 */
import { URL_BUFFER, VARIABLE_CLE_BUFFER } from "../../fournisseurs/mesures/buffer";
import { cleDans, nettoyerDetail, posterJson, type Env, type Fetch } from "../../fournisseurs/mesures/commun";
import { REQUETE_CANAUX, REQUETE_COMPTE, REQUETE_POSTS_A_VENIR } from "./requetes-lecture";
import { ErreurLectureBuffer, type CanalBuffer, type LienJoint, type MediaBuffer, type PostBuffer } from "./types";

type Brut = Record<string, unknown>;
const objet = (x: unknown): Brut | undefined => (x && typeof x === "object" && !Array.isArray(x) ? (x as Brut) : undefined);
const texte = (x: unknown): string | undefined => (typeof x === "string" && x ? x : undefined);
const nombre = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

/** Vrai si la chaîne contient une écriture GraphQL. */
export const contientEcriture = (requete: string): boolean => /mutation/i.test(requete);

export interface ClientLecture {
  lire(requete: string, variables?: Record<string, unknown>): Promise<Brut>;
}

export function creerClientLecture(cle: string, options: { appeler?: Fetch; url?: string } = {}): ClientLecture {
  const appeler = options.appeler ?? fetch;
  return {
    async lire(requete, variables = {}) {
      // Garde avant tout envoi : une écriture n'atteint jamais le réseau.
      if (contientEcriture(requete)) throw new ErreurLectureBuffer("ecriture-refusee", "Requête refusée : ce client ne fait que lire.");
      const r = await posterJson(appeler, options.url ?? URL_BUFFER, cle, { query: requete, variables });
      if (!r.ok) {
        if (r.raison === "reseau") throw new ErreurLectureBuffer("indisponible", "Buffer ne répond pas.");
        if (r.raison === "illisible") throw new ErreurLectureBuffer("illisible", "Buffer : réponse illisible.");
        if (r.status === 401 || r.status === 403) throw new ErreurLectureBuffer("refuse", "Buffer refuse la clé du serveur.");
        throw new ErreurLectureBuffer("indisponible", "Buffer ne répond pas pour l'instant.");
      }
      const corps = objet(r.corps);
      const erreurs = Array.isArray(corps?.errors) ? corps.errors : [];
      if (erreurs.length) {
        const m = texte(objet(erreurs[0])?.message) ?? "erreur";
        throw new ErreurLectureBuffer("illisible", `Buffer : ${nettoyerDetail(m, [cle])}`);
      }
      const data = objet(corps?.data);
      if (!data) throw new ErreurLectureBuffer("illisible", "Buffer : réponse vide.");
      return data;
    },
  };
}

/** Client depuis l'environnement du serveur. */
export function clientDepuisEnv(env: Env = process.env, appeler?: Fetch): ClientLecture {
  const cle = cleDans(env, VARIABLE_CLE_BUFFER);
  if (!cle) throw new ErreurLectureBuffer("cle-absente", `${VARIABLE_CLE_BUFFER} est absente de l'environnement.`);
  return creerClientLecture(cle, { appeler });
}

/* ------------------------------ normalisation (PUR) ------------------------------ */

function normaliserMedia(a: Brut): MediaBuffer | undefined {
  const type = texte(a.type);
  if (type !== "image" && type !== "video" && type !== "document") return undefined;
  const m: MediaBuffer = { type, mime: texte(a.mimeType) ?? "application/octet-stream", source: texte(a.source) ?? "" };
  const image = objet(a.image);
  const video = objet(a.video);
  const doc = objet(a.document);
  if (image) m.texteAlternatif = texte(image.altText);
  if (video) {
    m.titre = texte(video.title);
    m.tailleAnnoncee = nombre(video.fileSize);
  }
  if (doc) {
    m.titre = texte(doc.title);
    m.tailleAnnoncee = nombre(doc.filesize);
  }
  return m;
}

function normaliserLien(l: unknown): LienJoint | undefined {
  const o = objet(l);
  const url = texte(o?.url);
  return url ? { url, titre: texte(o?.title) } : undefined;
}

export function normaliserPost(n: Brut): PostBuffer {
  const meta = objet(n.metadata);
  const assets = Array.isArray(n.assets) ? n.assets : [];
  return {
    id: String(n.id ?? ""),
    canalId: String(n.channelId ?? ""),
    texte: typeof n.text === "string" ? n.text : "",
    dateUtc: texte(n.dueAt),
    creeLe: texte(n.createdAt),
    envoyeLe: texte(n.sentAt),
    statut: texte(n.status) ?? "inconnu",
    medias: assets.map((a) => objet(a)).filter((a): a is Brut => !!a).map(normaliserMedia).filter((m): m is MediaBuffer => !!m),
    premierCommentaire: texte(meta?.firstComment),
    lienJoint: normaliserLien(meta?.linkAttachment),
    titre: texte(meta?.title),
  };
}

/* ------------------------------ lecture (pages) ------------------------------ */

const PAGES_MAX = 50;

export interface LectureBuffer {
  canaux: CanalBuffer[];
  posts: PostBuffer[];
  organisationId: string;
  /** Vrai si la lecture s'est arrêtée au plafond de pages alors que Buffer en annonçait encore. */
  tronque: boolean;
}

/** Organisation, canaux, puis tous les posts à partir de `depuis`. Lecture seule. */
export async function lireBuffer(client: ClientLecture, options: { depuis: string; taillePage?: number; pagesMax?: number }): Promise<LectureBuffer> {
  const compte = objet((await client.lire(REQUETE_COMPTE)).account);
  const orgs = Array.isArray(compte?.organizations) ? compte.organizations : [];
  const organisationId = texte(objet(orgs[0])?.id);
  if (!organisationId) throw new ErreurLectureBuffer("illisible", "Buffer : aucune organisation.");
  const canaux: CanalBuffer[] = [];
  const dataCanaux = await client.lire(REQUETE_CANAUX, { organizationId: organisationId });
  for (const c of Array.isArray(dataCanaux.channels) ? dataCanaux.channels : []) {
    const o = objet(c);
    if (o) canaux.push({ id: String(o.id), nom: texte(o.displayName) ?? texte(o.name) ?? "Compte", service: String(o.service ?? "") });
  }
  const posts: PostBuffer[] = [];
  let apres: string | undefined;
  let tronque = false;
  const pagesMax = options.pagesMax ?? PAGES_MAX;
  for (let page = 0; page < pagesMax; page++) {
    const resultat = objet((await client.lire(REQUETE_POSTS_A_VENIR, { organizationId: organisationId, depuis: options.depuis, apres, nombre: options.taillePage ?? 50 })).posts);
    for (const e of Array.isArray(resultat?.edges) ? resultat.edges : []) {
      const n = objet(objet(e)?.node);
      if (n) posts.push(normaliserPost(n));
    }
    const info = objet(resultat?.pageInfo);
    apres = texte(info?.endCursor);
    if (info?.hasNextPage !== true || !apres) break;
    if (page === pagesMax - 1) tronque = true;
  }
  return { canaux, posts, organisationId, tronque };
}
