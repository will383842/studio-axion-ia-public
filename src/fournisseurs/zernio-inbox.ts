/**
 * Port « inbox » Zernio (réponses aux commentaires, messages privés) au-dessus du client à liste fermée.
 *
 * NON BRANCHÉ au démarrage : ni `instrumentation.ts` ni la boucle ne l'importent (test de garde).
 * Chaque appel passe par `client.requete` : « Tout arrêter », filtre, liste fermée, débit, `lectureRequise`.
 * Jamais d'erreur brute rendue : un résultat typé, sans corps de réponse, sans texte ni adresse de la personne.
 */
import { createHash } from "node:crypto";
import { enteteIdempotenceInbox, type ClientZernio } from "./publication/zernio-client";
import { estErreurZernio } from "./publication/zernio-erreurs";

export interface BoutonPostback {
  titre: string;
  payload: string;
}

export type StatutEcritureInbox = "envoye" | "refuse" | "definitif" | "a_verifier" | "a_reessayer";

export interface ResultatEcritureInbox {
  statut: StatutEcritureInbox;
  /** Code court : INBOX_REQUIRED, message_allowance_exceeded, ou code du client (envoi-coupe, chemin-refuse, lecture-requise…). */
  code?: string;
  idMessage?: string;
  /**
   * État à CONSERVER par l'appelant : "a_verifier" (issue inconnue : 502 réponse privée, 5xx, délai, 429 incertain) ou
   * "consommee" (400 privateReplyConsumed, définitif). Jamais de nouvel essai automatique sur "a_verifier".
   */
  etat?: "a_verifier" | "consommee";
  /** Réponse privée déjà consommée (400 privateReplyConsumed) : définitif. */
  consomme?: boolean;
  /** Réponse privée à l'issue inconnue (502 privateReplyOutcome unknown) : à vérifier, aucun nouvel essai automatique. */
  issueInconnue?: boolean;
  /** 429 (incertain) : attente conseillée avant de vérifier. */
  reessayerApresSec?: number;
}

export interface MessageLu {
  texte: string | null;
  postback: string | null;
}

export interface PortInboxZernio {
  repondreCommentaire(p: { idCompte: string; idPost: string; idCommentaire: string; texte: string; cle: string }): Promise<ResultatEcritureInbox>;
  repondreEnPrive(p: { idCompte: string; idPost: string; idCommentaire: string; texte: string; boutons?: BoutonPostback[] }): Promise<ResultatEcritureInbox>;
  /** Ne retient QUE les messages ENTRANTS de la personne (jamais nos messages sortants ni les échos). */
  lireMessage(p: { idCompte: string; idConversation: string; idMessage: string }): Promise<MessageLu>;
  envoyerMessage(p: { idCompte: string; idConversation: string; texte: string; boutons?: BoutonPostback[]; cle: string }): Promise<ResultatEcritureInbox>;
}

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const TEXTE_MAX = 2000;

/** Clé d'idempotence stable : même clé métier + même route + même cible = même `inbox-<hex>`. */
function cleInbox(route: string, ...parties: string[]): string {
  return enteteIdempotenceInbox(createHash("sha256").update([route, ...parties].join("\u0000")).digest("hex"));
}

function versBoutons(boutons: BoutonPostback[] | undefined): { type: "postback"; title: string; payload: string }[] | undefined {
  return boutons && boutons.length > 0 ? boutons.map((b) => ({ type: "postback", title: b.titre, payload: b.payload })) : undefined;
}

function idMessageDe(corps: unknown): string | undefined {
  if (!estObjet(corps)) return undefined;
  const m = estObjet(corps.message) ? corps.message : corps;
  const id = m.messageId ?? m.id ?? m._id;
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : undefined;
}

/** Message entrant de la personne : direction entrante ET ni écho ni message de la Page. Tout doute = ignoré. */
function estEntrant(m: Record<string, unknown>): boolean {
  const sens = typeof m.direction === "string" ? m.direction.toLowerCase() : "";
  if (sens !== "incoming" && sens !== "inbound") return false;
  return m.isEcho !== true && m.is_echo !== true && m.echo !== true && m.fromMe !== true && m.isFromMe !== true;
}

export function creerPortInboxZernio(options: { client: ClientZernio; comptesPermis: readonly string[]; domainesPermis?: readonly string[]; titresGuidesPermis?: readonly string[] }): PortInboxZernio {
  const { client } = options;
  const comptesPermis = [...options.comptesPermis];
  const domainesPermis = options.domainesPermis ? [...options.domainesPermis] : undefined;
  // Un domaine permis contient un point et ne commence pas par un point (« com » ou « .com » ouvriraient tout un suffixe).
  if (domainesPermis?.some((d) => typeof d !== "string" || !d.trim().includes(".") || d.trim().startsWith("."))) {
    throw new Error("Inbox : domainesPermis invalide (un domaine complet est attendu).");
  }
  const titresGuidesPermis = [...(options.titresGuidesPermis ?? [])];
  const listes = { comptesPermis, domainesPermis, titresGuidesPermis };

  async function ecrire(requete: Parameters<ClientZernio["requete"]>[0]): Promise<ResultatEcritureInbox> {
    try {
      const rep = await client.requete(requete);
      return { statut: "envoye", idMessage: idMessageDe(rep.corps) };
    } catch (e) {
      if (!estErreurZernio(e)) return { statut: "refuse", code: "erreur-inconnue" };
      switch (e.code) {
        case "inbox-requis":
          return { statut: "refuse", code: "INBOX_REQUIRED" };
        case "quota-messages":
          return { statut: "refuse", code: "message_allowance_exceeded" };
        case "reponse-privee-consommee":
          return { statut: "definitif", code: e.code, etat: "consommee", consomme: true };
        case "reponse-privee-inconnue":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier", issueInconnue: true };
        case "a-verifier":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier" };
        case "limite-incertaine":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier", reessayerApresSec: e.reessayerApresSec ?? (e.attenteMs !== undefined ? Math.ceil(e.attenteMs / 1000) : undefined) };
        case "debit":
          return { statut: "a_reessayer", code: e.code, reessayerApresSec: e.reessayerApresSec ?? (e.attenteMs !== undefined ? Math.ceil(e.attenteMs / 1000) : undefined) };
        default:
          return { statut: "refuse", code: e.code };
      }
    }
  }

  return {
    repondreCommentaire: (p) =>
      ecrire({
        methode: "POST",
        chemin: `/v1/inbox/comments/${p.idPost}`,
        corps: { accountId: p.idCompte, message: p.texte, commentId: p.idCommentaire },
        idempotence: cleInbox("repondre-commentaire", p.cle, p.idCompte, p.idPost, p.idCommentaire),
        ...listes,
      }),

    repondreEnPrive: (p) => {
      const buttons = versBoutons(p.boutons);
      if (buttons) return Promise.resolve<ResultatEcritureInbox>({ statut: "refuse", code: "boutons-non-supportes" }); // la route privée ne documente que {accountId, message}
      return ecrire({
        methode: "POST",
        chemin: `/v1/inbox/comments/${p.idPost}/${p.idCommentaire}/private-reply`,
        corps: { accountId: p.idCompte, message: p.texte },
        ...listes,
      });
    },

    envoyerMessage: (p) => {
      const buttons = versBoutons(p.boutons);
      return ecrire({
        methode: "POST",
        chemin: `/v1/inbox/conversations/${p.idConversation}/messages`,
        corps: { accountId: p.idCompte, message: p.texte, ...(buttons ? { buttons } : {}) },
        idempotence: cleInbox("envoyer-message", p.cle, p.idCompte, p.idConversation),
        ...listes,
      });
    },

    async lireMessage(p) {
      const vide: MessageLu = { texte: null, postback: null };
      try {
        const rep = await client.requete({
          methode: "GET",
          chemin: `/v1/inbox/conversations/${p.idConversation}/messages`,
          query: { accountId: p.idCompte },
          comptesPermis,
        });
        const liste = estObjet(rep.corps) && Array.isArray(rep.corps.messages) ? rep.corps.messages : [];
        const m = liste.find((x): x is Record<string, unknown> => estObjet(x) && (x.id === p.idMessage || x._id === p.idMessage));
        if (!m || !estEntrant(m)) return vide;
        const texte = typeof m.text === "string" && m.text.length > 0 ? m.text.slice(0, TEXTE_MAX) : null;
        const pb = estObjet(m.postback) ? m.postback.payload : undefined;
        return { texte, postback: typeof pb === "string" && pb.length <= 64 ? pb : null };
      } catch {
        return vide;
      }
    },
  };
}
