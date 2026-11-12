// File « À traiter » LinkedIn/TikTok : lecture PURE d'un comment.received, SANS CONTENU. Rien n'est branché ici.
// ⚠️ Forme exacte NON PROUVÉE chez Zernio : lecture tolérante sur les noms, stricte sur le contenu.
// Règle RC-43 : sur LinkedIn et TikTok, JAMAIS de réponse ni de message automatique ; ce module ne fait que lire.
import { createHash } from "node:crypto";
import { type EnveloppeZernio, TYPE_EVENEMENT_COMMENTAIRE, motSeulDe } from "./crochet-zernio";
import { estMotOpposition } from "./opposition";
import { normaliserMot } from "./mot-normalise";

const RE_OPAQUE = /^[A-Za-z0-9_-]{1,128}$/;
const RE_URN = /^urn:li:[A-Za-z]+:[A-Za-z0-9_(),:-]{1,160}$/;
const HOTES_LIEN = ["linkedin.com", "www.linkedin.com", "tiktok.com", "www.tiktok.com"];

export interface CommentaireManuel {
  idCommentaire: string;
  idCompte: string;
  reseau: "linkedin_page" | "tiktok";
  /** Identifiant de publication s'il est opaque, sinon « li_ » + empreinte de l'URN. Jamais un nom. */
  repere: string;
  lienPost: string | null;
  idAuteur: string | null;
  /** Vrai si le commentaire est NOTRE propre commentaire : rien à traiter. */
  proprio: boolean;
  /** Forme d'opposition canonique ou mot normalisé ; sinon null. Le texte brut n'est JAMAIS gardé. */
  motSeul: string | null;
  estReponse: boolean;
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** `undefined` = absent ; `null` = présent mais d'une forme refusée ; sinon l'identifiant. */
function id(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return typeof v === "string" && (RE_OPAQUE.test(v) || RE_URN.test(v)) ? v : null;
}
const premier = (...c: Array<string | null | undefined>): string | null | undefined => c.find((x) => x !== undefined);
const empreinteUrn = (urn: string): string => createHash("sha256").update(urn).digest("base64url").slice(0, 22);

function lienSur(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 500) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !HOTES_LIEN.includes(u.hostname) || u.username !== "" || u.password !== "" || u.port !== "") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function lireCommentaireManuel(env: EnveloppeZernio, motsConnus?: readonly string[]): CommentaireManuel | null {
  if (env.event !== TYPE_EVENEMENT_COMMENTAIRE) return null;
  const c = objet(env.racine.comment);
  const compte = objet(env.racine.account);
  const post = objet(env.racine.post);
  const plateforme = String(compte?.platform ?? c?.platform ?? "").toLowerCase();
  if (!c || (plateforme !== "linkedin" && plateforme !== "tiktok")) return null;
  const idCommentaire = id(c.id);
  const idCompte = premier(id(compte?.accountId), id(compte?.id));
  const idPost = premier(id(c.platformPostId), id(post?.platformPostId), id(c.postId));
  const auteur = objet(c.author) ?? objet(c.from);
  const idAuteur = premier(id(auteur?.id), id(c.authorId));
  // Un identifiant présent mais mal formé, ou un identifiant indispensable absent : on ne lit rien (fermé).
  if (!idCommentaire || !idCompte || idPost === null || idAuteur === null) return null;
  const repere = idPost === undefined ? `cm_${empreinteUrn(idCommentaire)}` : RE_URN.test(idPost) ? `li_${empreinteUrn(idPost)}` : idPost;
  const proprio = auteur?.isOwnAccount === true || auteur?.isSelf === true || c.isOwn === true || (idAuteur !== undefined && idAuteur === idCompte);
  const texte = typeof c.text === "string" && c.text.length <= 200 ? c.text : null;
  const garde = texte === null ? null : motSeulDe(texte, motsConnus);
  const motSeul = garde === null ? null : estMotOpposition(garde) ? garde : normaliserMot(garde);
  return {
    idCommentaire,
    idCompte,
    reseau: plateforme === "tiktok" ? "tiktok" : "linkedin_page",
    repere,
    lienPost: lienSur(c.postUrl) ?? lienSur(c.permalink) ?? lienSur(post?.url) ?? lienSur(post?.permalink),
    idAuteur: proprio ? idCompte : (idAuteur ?? null),
    proprio,
    motSeul: proprio ? null : motSeul,
    estReponse: c.isReply === true || (c.parentId !== undefined && c.parentId !== null && c.parentId !== ""),
  };
}
