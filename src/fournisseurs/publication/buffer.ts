/**
 * PUBLICATION RÉELLE PAR BUFFER (lot R1, brouillon d'abord) — client GraphQL de https://api.buffer.com.
 *
 * - Formes recalées sur le schéma relevé le 03/10/2026 (`docs/buffer/schema-2026-10.json`) ; requêtes dans `requetes.ts`.
 * - Brouillon par défaut (`saveToDraft: true`) : rien ne part sur un réseau tant que Will ne l'a pas programmé dans
 *   Buffer. Le mode « programmer » n'est utilisé que sur son choix (Réglages, Buffer).
 * - UNE seule mutation (`createPost`). Aucune suppression, aucune modification chez Buffer.
 * - Erreurs typées (`ErreurBuffer`) : `incertain` dit si Buffer a PU créer la publication malgré l'erreur (délai dépassé,
 *   ligne coupée, panne du serveur après réception). Un envoi incertain n'est JAMAIS refait à l'aveugle : le service
 *   relit Buffer d'abord (`publicationsRecentes`).
 * - Délai 30 s par appel. Transport commun avec les lecteurs de mesures (`posterJson`) ; même variable, même adresse.
 * - Messages : une phrase française fixe par situation (`PHRASES_BUFFER`), seule montrée (écrans et journal du studio) ;
 *   le détail (code, texte brut de Buffer) va dans `ErreurBuffer.detail`, nettoyé (`nettoyerDetail` : ni clé, ni
 *   adresse signée), pour les journaux du SERVEUR seulement.
 * - Premier commentaire (L1-10) : `metadata.<réseau>.firstComment`, seulement Instagram, Facebook et LinkedIn (les seuls
 *   réseaux dont l'entrée l'accepte). Contrôlé par la liste d'interdits communs avant tout envoi. Un autre réseau n'est
 *   jamais abandonné en silence : la réponse dit `a-la-main` et le kit affiche le texte à poser soi-même.
 * - Texte alternatif (L1-10) : `altText` (125 signes au plus) sur chaque image ; le schéma n'en a pas pour une vidéo.
 * - Vignette : le schéma de Buffer REFUSE `thumbnailUrl` sur une vidéo (« the API rejects video assets that set this
 *   field ») ; aucune miniature n'est donc envoyée (la plateforme prend une image de la vidéo).
 */
import { serviceBuffer, statutDepuisBuffer } from "@/domaine/buffer";
import { interditsCommuns } from "@/domaine/qualite-script";
import { motsInterditsEnvoi } from "./mots-interdits-envoi";
import { URL_BUFFER, VARIABLE_CLE_BUFFER } from "../mesures/buffer";
import { nettoyerDetail, posterJson, type Fetch } from "../mesures/commun";
import type { CanalPublication, DemandePublication, EtatPublicationExterne, FournisseurPublication } from "../types";
import { MUTATION_CREER_POST, REQUETE_CANAUX, REQUETE_COMPTE, REQUETE_ETAT_POST, REQUETE_POSTS_CANAL } from "./requetes";

export const DELAI_BUFFER_MS = 30_000;

export type CodeErreurBuffer = "refuse" | "indisponible" | "introuvable" | "invalide" | "limite" | "illisible";

/**
 * Erreur de Buffer. `message` : une phrase française FIXE, montrable à Will (ni code, ni nom de réglage, ni anglais).
 * `detail` : ce qui s'est passé (code HTTP, message brut de Buffer), nettoyé (sans clé ni adresse signée), pour le journal.
 */
export class ErreurBuffer extends Error {
  constructor(
    public readonly code: CodeErreurBuffer,
    message: string,
    /** Buffer a peut-être créé la publication malgré l'erreur : relire avant tout nouvel envoi. */
    public readonly incertain = false,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ErreurBuffer";
  }
}

/** Les phrases que Will peut lire (une par situation). */
export const PHRASES_BUFFER = {
  cleRefusee: "Buffer refuse la clé du serveur : vérifiez-la.",
  muet: "Buffer ne répond pas pour l'instant : réessayez dans un moment.",
  aVerifier: "Buffer n'a pas répondu à temps : l'envoi est à vérifier.",
  panneEnvoi: "Buffer a eu une panne pendant l'envoi : l'envoi est à vérifier.",
  panne: "Buffer est momentanément indisponible : réessayez dans un moment.",
  limite: "Buffer limite les envois pour l'instant : réessayez dans quelques minutes.",
  limiteCompte: "Buffer : ce compte a atteint son nombre d'envois du jour.",
  demandeRefusee: "Buffer refuse la demande du studio.",
  commentaireInterdit: "Le premier commentaire contient une formule interdite : rien n'a été envoyé.",
  motInterditTexte: "Le texte du post contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.",
  motInterditCommentaire: "Le premier commentaire contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.",
  motInterditTitre: "Le titre YouTube contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.",
  motInterditTexteAlternatif: "Le texte alternatif d'une image contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.",
  texteAlternatifAbsent: "Une image n'a pas de texte alternatif : rien n'a été envoyé.",
  publicationRefusee: "Buffer refuse cette publication (vidéo ou texte non acceptés).",
  compteRefuse: "Buffer refuse l'envoi sur ce compte : vérifiez-le dans Buffer.",
  compteIntrouvable: "Buffer ne trouve pas ce compte : touchez « Tester » dans les Réglages.",
  publicationIntrouvable: "Buffer ne trouve pas cette publication.",
  incomprehensible: "Réponse de Buffer incompréhensible.",
  incomprehensibleEnvoi: "Réponse de Buffer incompréhensible : l'envoi est à vérifier.",
} as const;

/* ------------------------------------------------------------------ */
/* Entrée de createPost (PUR)                                           */
/* ------------------------------------------------------------------ */

/** Longueur maximale du texte alternatif d'une image (instagram). */
export const ALT_MAX = 125;

/** Réseaux dont l'entrée Buffer accepte `firstComment` (schéma du 03/10/2026). */
const RESEAUX_PREMIER_COMMENTAIRE = new Set(["instagram", "facebook", "linkedin"]);

/** Ce réseau reçoit-il le premier commentaire par Buffer ? Sinon : « à poser à la main ». PUR. */
export function premierCommentaireTransmissible(reseau: DemandePublication["reseau"]): boolean {
  return RESEAUX_PREMIER_COMMENTAIRE.has(serviceBuffer(reseau));
}

/** Refuse un premier commentaire qui contient un mot interdit à l'envoi ou un interdit commun (même s'il sera posé à la main). */
export function verifierPremierCommentaire(c: string): void {
  const mots = motsInterditsEnvoi(c);
  if (mots.length) throw new ErreurBuffer("invalide", PHRASES_BUFFER.motInterditCommentaire, false, `mots interdits : ${mots.join(", ")}`);
  const trouves = interditsCommuns().filter((i) => Object.values(i.tests).some((t) => t?.(c)));
  if (trouves.length) throw new ErreurBuffer("invalide", PHRASES_BUFFER.commentaireInterdit, false, `interdits : ${trouves.map((i) => i.libelle).join(", ")}`);
}

/** Premier commentaire utile (vide ou blanc = aucun). Un interdit commun refuse l'envoi entier. */
function commentaireDe(d: DemandePublication): string | undefined {
  const c = d.premierCommentaire?.trim();
  if (!c) return undefined;
  verifierPremierCommentaire(c);
  return c;
}

/** Texte alternatif ramené à 125 signes, sur une ligne. */
function texteAlt(brut: string): string {
  const t = brut.replace(/\s+/g, " ").trim();
  return t.length <= ALT_MAX ? t : `${t.slice(0, ALT_MAX - 1).trimEnd()}…`;
}

/** Ce que Buffer reçoit pour créer la publication (forme `CreatePostInput` relevée). PUR, testé. */
export function entreeCreerPost(d: DemandePublication, instant: number = Date.now()): Record<string, unknown> {
  if (!d.canalId) throw new ErreurBuffer("invalide", "Aucun compte Buffer choisi pour ce réseau.");
  const images = d.images ?? [];
  if (!images.length && !/^https:\/\//.test(d.fichierCle)) throw new ErreurBuffer("invalide", "La vidéo n'est pas en ligne : Buffer ne pourrait pas la lire.");
  for (const im of images) {
    if (!/^https:\/\//.test(im.url)) throw new ErreurBuffer("invalide", "Une image n'est pas en ligne : Buffer ne pourrait pas la lire.");
    if (!texteAlt(im.texteAlternatif ?? "")) throw new ErreurBuffer("invalide", PHRASES_BUFFER.texteAlternatifAbsent);
    const motsAlt = motsInterditsEnvoi(im.texteAlternatif ?? "");
    if (motsAlt.length) throw new ErreurBuffer("invalide", PHRASES_BUFFER.motInterditTexteAlternatif, false, `mots interdits : ${motsAlt.join(", ")}`);
  }
  const motsTexte = motsInterditsEnvoi(d.texte);
  if (motsTexte.length) throw new ErreurBuffer("invalide", PHRASES_BUFFER.motInterditTexte, false, `mots interdits : ${motsTexte.join(", ")}`);
  const motsTitre = serviceBuffer(d.reseau) === "youtube" ? motsInterditsEnvoi(d.titre ?? "") : [];
  if (motsTitre.length) throw new ErreurBuffer("invalide", PHRASES_BUFFER.motInterditTitre, false, `mots interdits : ${motsTitre.join(", ")}`);
  const commentaire = commentaireDe(d);
  const brouillon = (d.mode ?? "brouillon") === "brouillon";
  const echeance = Date.parse(d.date);
  // Une date à venir part telle quelle ; « maintenant » : file d'attente pour un brouillon, envoi immédiat sinon.
  const aVenir = Number.isFinite(echeance) && echeance > instant + 60_000;
  const service = serviceBuffer(d.reseau);
  const metadata: Record<string, unknown> = {};
  const premier = commentaire ? { firstComment: commentaire } : {};
  if (service === "instagram") metadata.instagram = { type: images.length ? "post" : "reel", shouldShareToFeed: true, ...premier };
  if (service === "facebook") metadata.facebook = { type: images.length ? "post" : "reel", ...premier };
  if (service === "linkedin" && commentaire) metadata.linkedin = premier;
  if (service === "youtube") metadata.youtube = { title: titreYoutube(d) };
  return {
    channelId: d.canalId,
    text: d.texte,
    assets: images.length ? images.map((im) => ({ image: { url: im.url, metadata: { altText: texteAlt(im.texteAlternatif) } } })) : [{ video: { url: d.fichierCle } }],
    mode: aVenir ? "customScheduled" : brouillon ? "addToQueue" : "shareNow",
    ...(aVenir ? { dueAt: new Date(echeance).toISOString() } : {}),
    saveToDraft: brouillon,
    schedulingType: "automatic",
    needsApproval: false,
    ...(Object.keys(metadata).length ? { metadata } : {}),
    source: "studio-axion-ia",
  };
}

/** YouTube exige un titre (100 caractères au plus) : celui du kit, sinon la première ligne du texte. */
function titreYoutube(d: DemandePublication): string {
  const brut = (d.titre?.trim() || d.texte.split("\n").find((l) => l.trim())?.trim() || "Vidéo").replace(/\s+/g, " ");
  return brut.length <= 100 ? brut : `${brut.slice(0, 99).trimEnd()}…`;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** Codes GraphQL qui prouvent que Buffer n'a RIEN fait (requête refusée avant d'agir). */
const CODES_SANS_EFFET = new Set(["BAD_USER_INPUT", "GRAPHQL_VALIDATION_FAILED", "GRAPHQL_PARSE_FAILED", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND"]);

interface ReponseGraphql {
  data?: Record<string, unknown> | null;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

export interface ClientBuffer {
  appeler(query: string, variables: Record<string, unknown>, options?: { mutation?: boolean }): Promise<Record<string, unknown>>;
}

export function creerClientBuffer(cle: string, options: { appeler?: Fetch; delaiMs?: number } = {}): ClientBuffer {
  const net = (t: string) => nettoyerDetail(t, [cle]);
  return {
    async appeler(query, variables, { mutation = false } = {}) {
      const r = await posterJson(options.appeler ?? fetch, URL_BUFFER, cle, { query, variables }, options.delaiMs ?? DELAI_BUFFER_MS);
      if (!r.ok && r.raison === "reseau") {
        // Délai dépassé ou ligne coupée : pour un envoi, Buffer a pu le recevoir.
        throw mutation ? new ErreurBuffer("indisponible", PHRASES_BUFFER.aVerifier, true, "délai dépassé ou ligne coupée pendant l'envoi") : new ErreurBuffer("indisponible", PHRASES_BUFFER.muet, false, "délai dépassé ou ligne coupée");
      }
      if (!r.ok && r.raison === "illisible") throw new ErreurBuffer("illisible", mutation ? PHRASES_BUFFER.incomprehensibleEnvoi : PHRASES_BUFFER.incomprehensible, mutation, `réponse HTTP ${r.status} illisible`);
      if (!r.ok) {
        const s = r.status;
        if (s === 401 || s === 403) throw new ErreurBuffer("refuse", PHRASES_BUFFER.cleRefusee, false, `${VARIABLE_CLE_BUFFER} refusée (HTTP ${s})`);
        if (s === 429) throw new ErreurBuffer("limite", PHRASES_BUFFER.limite, false, "HTTP 429");
        if (s >= 500) throw new ErreurBuffer("indisponible", mutation ? PHRASES_BUFFER.panneEnvoi : PHRASES_BUFFER.panne, mutation, `HTTP ${s}`);
        throw new ErreurBuffer("invalide", PHRASES_BUFFER.demandeRefusee, false, `HTTP ${s}`);
      }
      const corps = (r.corps ?? {}) as ReponseGraphql;
      if (corps.errors?.length) {
        const codes = corps.errors.map((e) => e.extensions?.code ?? "");
        const detail = net(`${codes.filter(Boolean).join(", ") || "sans code"} : ${corps.errors.map((e) => e.message ?? "").filter(Boolean).join(" ; ")}`);
        if (codes.includes("UNAUTHENTICATED") || codes.includes("FORBIDDEN")) throw new ErreurBuffer("refuse", PHRASES_BUFFER.cleRefusee, false, `${VARIABLE_CLE_BUFFER} refusée (${detail})`);
        if (codes.includes("NOT_FOUND")) throw new ErreurBuffer("introuvable", PHRASES_BUFFER.publicationIntrouvable, false, detail);
        const incertain = mutation && !codes.every((c) => CODES_SANS_EFFET.has(c));
        throw new ErreurBuffer("invalide", incertain ? PHRASES_BUFFER.incomprehensibleEnvoi : PHRASES_BUFFER.demandeRefusee, incertain, detail);
      }
      if (!corps.data) throw new ErreurBuffer("illisible", mutation ? PHRASES_BUFFER.incomprehensibleEnvoi : PHRASES_BUFFER.incomprehensible, mutation, "réponse vide");
      return corps.data;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Lectures (PUR)                                                       */
/* ------------------------------------------------------------------ */

type Brut = Record<string, unknown>;
const texteDe = (x: unknown) => (typeof x === "string" && x ? x : undefined);

function etatDepuisPost(p: Brut, net: (t: string) => string): EtatPublicationExterne {
  const brute = p.error && typeof p.error === "object" ? texteDe((p.error as Brut).message) : undefined;
  const erreur = brute ? net(brute) : undefined;
  return {
    idExterne: String(p.id ?? ""),
    canalId: texteDe(p.channelId),
    statut: statutDepuisBuffer(texteDe(p.status)),
    date: texteDe(p.dueAt),
    envoyeeLe: texteDe(p.sentAt),
    lien: texteDe(p.externalLink),
    erreur,
    texte: typeof p.text === "string" ? p.text : undefined,
    creeeLe: texteDe(p.createdAt),
  };
}

function canalDepuis(c: Brut): CanalPublication {
  return {
    id: String(c.id),
    organisationId: String(c.organizationId ?? c.organisationId ?? ""),
    nom: texteDe(c.displayName) ?? texteDe(c.name) ?? "Compte",
    service: String(c.service ?? ""),
    genre: texteDe(c.type),
    avatar: texteDe(c.avatar),
    deconnecte: c.isDisconnected === true || c.isLocked === true,
  };
}

/* ------------------------------------------------------------------ */
/* Fournisseur                                                          */
/* ------------------------------------------------------------------ */

export function creerPublicationBuffer(cle: string, options: { appeler?: Fetch; delaiMs?: number; maintenant?: () => number } = {}): FournisseurPublication {
  const client = creerClientBuffer(cle, options);
  const net = (t: string) => nettoyerDetail(t, [cle]);
  return {
    id: "buffer",
    type: "publication",
    nom: "Publication (Buffer)",
    reelPrevu: "Buffer",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },

    async envoyer(demande) {
      const input = entreeCreerPost(demande, options.maintenant?.() ?? Date.now());
      const data = await client.appeler(MUTATION_CREER_POST, { input }, { mutation: true });
      const charge = (data.createPost ?? null) as Brut | null;
      const type = texteDe(charge?.__typename);
      if (type === "PostActionSuccess" && charge?.post && typeof charge.post === "object") {
        const post = charge.post as Brut;
        if (!texteDe(post.id)) throw new ErreurBuffer("illisible", PHRASES_BUFFER.incomprehensibleEnvoi, true, "succès sans identifiant de publication");
        const aCommenter = !!demande.premierCommentaire?.trim();
        return {
          idExterne: String(post.id),
          via: "buffer",
          statut: statutDepuisBuffer(texteDe(post.status)) === "brouillon" ? "brouillon" : "programmee",
          ...(aCommenter ? { premierCommentaire: premierCommentaireTransmissible(demande.reseau) ? ("transmis" as const) : ("a-la-main" as const) } : {}),
        };
      }
      const detail = net(`${type ?? "réponse inconnue"} : ${texteDe(charge?.message) ?? "sans message"}`);
      switch (type) {
        case "UnauthorizedError":
          throw new ErreurBuffer("refuse", PHRASES_BUFFER.compteRefuse, false, detail);
        case "LimitReachedError":
          throw new ErreurBuffer("limite", PHRASES_BUFFER.limiteCompte, false, detail);
        case "NotFoundError":
          throw new ErreurBuffer("introuvable", PHRASES_BUFFER.compteIntrouvable, false, detail);
        case "InvalidInputError":
        case "RestProxyError":
          throw new ErreurBuffer("invalide", PHRASES_BUFFER.publicationRefusee, false, detail);
        default:
          // UnexpectedError ou réponse inconnue : Buffer a pu créer la publication.
          throw new ErreurBuffer("illisible", PHRASES_BUFFER.incomprehensibleEnvoi, true, detail);
      }
    },

    async listerCanaux() {
      const compte = (await client.appeler(REQUETE_COMPTE, {})).account as Brut | undefined;
      const organisations = Array.isArray(compte?.organizations) ? (compte.organizations as Brut[]) : [];
      const canaux: CanalPublication[] = [];
      for (const o of organisations) {
        const data = await client.appeler(REQUETE_CANAUX, { organizationId: o.id });
        for (const c of Array.isArray(data.channels) ? (data.channels as Brut[]) : []) canaux.push(canalDepuis({ organizationId: o.id, ...c }));
      }
      return canaux;
    },

    async lireEtat(idExterne) {
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(idExterne)) throw new ErreurBuffer("invalide", PHRASES_BUFFER.publicationIntrouvable, false, "identifiant illisible");
      const post = (await client.appeler(REQUETE_ETAT_POST, { id: idExterne })).post;
      if (!post || typeof post !== "object") throw new ErreurBuffer("introuvable", PHRASES_BUFFER.publicationIntrouvable);
      return etatDepuisPost(post as Brut, net);
    },

    async publicationsRecentes({ organisationId, canalId, depuis }) {
      const data = await client.appeler(REQUETE_POSTS_CANAL, { organizationId: organisationId, channelIds: [canalId], depuis, nombre: 20 });
      const edges = ((data.posts as Brut | undefined)?.edges ?? []) as { node?: Brut }[];
      return edges.map((e) => e.node).filter((n): n is Brut => !!n && typeof n === "object").map((n) => etatDepuisPost(n, net));
    },
  };
}
