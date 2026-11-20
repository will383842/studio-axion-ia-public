/**
 * Port « inbox » Zernio (réponses aux commentaires, messages privés) au-dessus du client à liste fermée.
 *
 * NON BRANCHÉ au démarrage : ni `instrumentation.ts` ni la boucle ne l'importent (test de garde).
 * Chaque appel passe par `client.requete` : « Tout arrêter », filtre, liste fermée, débit, `lectureRequise`.
 * Jamais d'erreur brute rendue : un résultat typé, sans corps de réponse, sans texte ni adresse de la personne.
 */
import { createHash } from "node:crypto";
import { consommerJetonNonOpposee, type JetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import { RETRY_AFTER_MAX_MS, enteteIdempotenceInbox, type ClientZernio } from "./publication/zernio-client";
import {
  LIBELLE_MISE_A_JOUR_DIFFEREE, RESEAUX_LISTE_COMMENTAIRES, commentaireLuDe,
  type CommentaireLu, type EvenementCommentaireRange, type ReseauListeCommentaires,
} from "./publication/zernio-inbox-corps";
import { CODES_CLIENT_CONNUS, CODES_MOTIF_REFUS, CODES_ZERNIO_CONNUS, SOURCES_MOTIF, estRaisonRefus, type RaisonRefus } from "@/domaine/guide-reseau/raison-refus";
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
  /** Identifiants de conversation / de destinataire rendus par Zernio (transit : l'appelant n'en garde que des empreintes). */
  idConversation?: string;
  idDestinataire?: string;
  /** Réponse privée à l'issue inconnue (502 privateReplyOutcome unknown) : à vérifier, aucun nouvel essai automatique. */
  issueInconnue?: boolean;
  /** 429 (incertain) : attente conseillée avant de vérifier. */
  reessayerApresSec?: number;
  /** Raison d'un refus sous FORME FERMÉE (code interne, statut, codes Meta, code Zernio d'une liste). Présente sur toute issue autre que « envoyé ». Jamais de décision dessus. */
  raison?: RaisonRefus;
}

const RAISON_INTERNE: RaisonRefus = { motif: "erreur-interne", codeClient: "erreur-inconnue", statut: null, meta: null, codeZernio: null, source: "interne" };

/**
 * Raison fermée d'un refus du service d'envoi. Pure, ne lève jamais. Ne lit JAMAIS `message` ni `detailTechnique` :
 * seulement `code` (vérifié contre la liste du client), `statut` et `motifInbox` (validés).
 */
export function raisonRefus(e: unknown): RaisonRefus {
  try {
    if (!estErreurZernio(e)) return { ...RAISON_INTERNE };
    const codeClient = CODES_CLIENT_CONNUS.includes(e.code) ? e.code : "erreur-inconnue";
    const statut = typeof e.statut === "number" && Number.isInteger(e.statut) && e.statut >= 100 && e.statut <= 599 ? e.statut : null;
    if (e.avantReseau) return { motif: "refus-avant-envoi", codeClient, statut: null, meta: null, codeZernio: null, source: "interne" };
    const m = e.motifInbox;
    const motif = m && (CODES_MOTIF_REFUS as readonly string[]).includes(m.motif) ? m.motif : "raison-inconnue";
    const codeZernio = m && (CODES_ZERNIO_CONNUS as readonly unknown[]).includes(m.codeZernio) ? m.codeZernio : null;
    const source = m && (SOURCES_MOTIF as readonly unknown[]).includes(m.source) ? m.source : !m && statut !== null && statut >= 200 && statut < 300 ? "interne" : "statut"; // erreur du client sur un 2xx : pas de motif, origine interne
    const r: RaisonRefus = { motif, statut, codeClient, meta: m?.meta ?? null, codeZernio, source };
    return estRaisonRefus(r) ? r : { motif: "raison-inconnue", statut, codeClient, meta: null, codeZernio: null, source: "statut" };
  } catch {
    return { ...RAISON_INTERNE };
  }
}

export interface MessageLu {
  texte: string | null;
  postback: string | null;
  /** Vrai : la lecture elle-même a échoué (panne). À réessayer, JAMAIS conclu « sans texte » ni « non opposé ». */
  panne?: boolean;
  /** Code de la panne, quand il est distinct : "liste-incomplete" = lecture arrêtée alors que la liste n'était pas finie (10 pages, curseur absent ou refusé). Réessai. */
  codePanne?: "liste-incomplete";
  /** Vrai : la liste est bien formée mais ne contient pas ce message (pagination, délai d'indexation). Réessai à délais longs. */
  introuvable?: boolean;
  /**
   * Vrai : message écrit PENDANT LA VEILLE (`metadata.standby`, un humain a repris la conversation). Il est rendu, jamais écarté :
   * l'appelant le LIT toujours (un « stop » doit être enregistré) mais n'y RÉPOND jamais (ni M1, ni M2, ni accusé, ni appel au site).
   */
  veille?: boolean;
}

export type SuiviInstagramLu = { statut: "suit" } | { statut: "ne_suit_pas" } | { statut: "inconnu" } | { statut: "panne"; definitive: boolean; code: string };

export interface PortInboxZernio {
  /** Lecture seule du suivi (follow-status) : ne rend jamais ni nom, ni pseudo, ni identifiant. Facultative. */
  lireSuiviInstagram?(p: { idCompte: string; idUtilisateur: string }): Promise<SuiviInstagramLu>;
  repondreCommentaire(p: { idCompte: string; idPost: string; idCommentaire: string; texte: string; cle: string; nonOpposee: JetonNonOpposee }): Promise<ResultatEcritureInbox>;
  repondreEnPrive(p: { idCompte: string; idPost: string; idCommentaire: string; texte: string; boutons?: BoutonPostback[]; nonOpposee: JetonNonOpposee }): Promise<ResultatEcritureInbox>;
  /**
   * Retrouve d'abord par `idPlateforme` (= `id` de la liste), puis par l'ancien id (id/_id/messageId = idMessage), sinon par HORODATAGE
   * (entrant, createdAt/sentAt ≈ occurredAt à ±2 s, expéditeur concordant) : l'id interne du webhook n'est jamais celui de la liste.
   * Ne retient QUE les messages ENTRANTS de la personne (jamais nos messages sortants ni échos). Un message `metadata.standby` est rendu avec `veille: true`. */
  lireMessage(p: { idCompte: string; idConversation: string; idMessage: string; idPlateforme?: string; occurredAt?: string; idExpediteur?: string }): Promise<MessageLu>;
  envoyerMessage(p: { idCompte: string; idConversation: string; texte: string; boutons?: BoutonPostback[]; cle: string; nonOpposee: JetonNonOpposee }): Promise<ResultatEcritureInbox>;
}

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const TEXTE_MAX = 2000;
const PAGES_MAX = 10;
const TOLERANCE_MS = 2000;
const LIMITE_LISTE = 100;

/** Contenu d'un message de la liste : texte dans `message` (chaîne, ou objet { text } par prudence). Sortant, écho : rien. */
function lireContenu(m: Record<string, unknown>): MessageLu {
  if (!estEntrant(m)) return { texte: null, postback: null };
  const veille = estObjet(m.metadata) && m.metadata.standby === true;
  const brut = typeof m.message === "string" ? m.message : estObjet(m.message) && typeof m.message.text === "string" ? m.message.text : "";
  const pb = estObjet(m.postback) ? m.postback.payload : undefined;
  return { texte: brut.length > 0 ? brut.slice(0, TEXTE_MAX) : null, postback: typeof pb === "string" && pb.length <= 64 ? pb : null, ...(veille ? { veille: true } : {}) };
}

/** Heure d'un message de la liste : `createdAt`, sinon `sentAt` (ms), ou `undefined` si absente / illisible. */
function heureDe(m: Record<string, unknown>): number | undefined {
  const brut = typeof m.createdAt === "string" ? m.createdAt : typeof m.sentAt === "string" ? m.sentAt : undefined;
  const t = brut === undefined ? NaN : Date.parse(brut);
  return Number.isFinite(t) ? t : undefined;
}

/** Clé d'idempotence stable : même clé métier + même route + même cible = même `inbox-<hex>`. */
function cleInbox(route: string, ...parties: string[]): string {
  return enteteIdempotenceInbox(createHash("sha256").update([route, ...parties].join("\u0000")).digest("hex"));
}

function versBoutons(boutons: BoutonPostback[] | undefined): { type: "postback"; title: string; payload: string }[] | undefined {
  return boutons && boutons.length > 0 ? boutons.map((b) => ({ type: "postback", title: b.titre, payload: b.payload })) : undefined;
}

function idOpaqueDe(v: unknown): string | undefined {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : undefined;
}
function idConversationDe(corps: unknown): string | undefined {
  if (!estObjet(corps)) return undefined;
  const m = estObjet(corps.message) ? corps.message : corps;
  const conv = estObjet(corps.conversation) ? corps.conversation : undefined;
  return idOpaqueDe(m.conversationId) ?? idOpaqueDe(corps.conversationId) ?? idOpaqueDe(conv?.id);
}
function idDestinataireDe(corps: unknown): string | undefined {
  if (!estObjet(corps)) return undefined;
  const m = estObjet(corps.message) ? corps.message : corps;
  const r = estObjet(m.recipient) ? m.recipient : estObjet(corps.recipient) ? corps.recipient : undefined;
  return idOpaqueDe(m.recipientId) ?? idOpaqueDe(corps.recipientId) ?? idOpaqueDe(r?.id);
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

export function creerPortInboxZernio(options: { client: ClientZernio; comptesPermis: readonly string[]; comptesLecture?: readonly string[]; domainesPermis?: readonly string[]; titresGuidesPermis?: readonly string[] }): PortInboxZernio {
  const { client } = options;
  const comptesPermis = [...options.comptesPermis];
  // Élargit la LECTURE seule (repérer un « stop » après le retrait d'un compte) ; toutes les écritures gardent comptesPermis.
  const comptesLecture = [...(options.comptesLecture ?? options.comptesPermis)];
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
      return { statut: "envoye", idMessage: idMessageDe(rep.corps), ...(idConversationDe(rep.corps) ? { idConversation: idConversationDe(rep.corps) } : {}), ...(idDestinataireDe(rep.corps) ? { idDestinataire: idDestinataireDe(rep.corps) } : {}) };
    } catch (e) {
      const raison = raisonRefus(e);
      if (!estErreurZernio(e)) return { statut: "refuse", code: "erreur-inconnue", raison };
      switch (e.code) {
        case "inbox-requis":
          return { statut: "refuse", code: "INBOX_REQUIRED", raison };
        case "quota-messages":
          return { statut: "refuse", code: "message_allowance_exceeded", raison };
        case "reponse-privee-consommee":
          return { statut: "definitif", code: e.code, etat: "consommee", consomme: true, raison };
        case "reponse-privee-inconnue":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier", issueInconnue: true, raison };
        case "a-verifier":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier", raison };
        case "limite-incertaine":
          return { statut: "a_verifier", code: e.code, etat: "a_verifier", reessayerApresSec: e.reessayerApresSec ?? (e.attenteMs !== undefined ? Math.ceil(e.attenteMs / 1000) : undefined), raison };
        case "debit":
          return { statut: "a_reessayer", code: e.code, reessayerApresSec: e.reessayerApresSec ?? (e.attenteMs !== undefined ? Math.ceil(e.attenteMs / 1000) : undefined), raison };
        default:
          return { statut: "refuse", code: e.code, raison };
      }
    }
  }

  const CODES_PASSAGERS: ReadonlySet<string> = new Set(["debit", "limite-incertaine", "a-verifier", "indisponible", "envoi-coupe", "lecture-requise"]);

  /** Jeton « vérifié : non opposée » consommé UNE fois, AVANT tout appel réseau : absent, forgé ou déjà utilisé => refus fermé. */
  const jetonRefuse = (j: unknown): boolean => !consommerJetonNonOpposee(j);
  const refusSansJeton = (): Promise<ResultatEcritureInbox> => Promise.resolve({ statut: "refuse", code: "non-opposee-requis" });

  return {
    async lireSuiviInstagram(p) {
      if (!comptesPermis.includes(p.idCompte)) return { statut: "panne", definitive: true, code: "compte-non-permis" };
      if (idOpaqueDe(p.idUtilisateur) === undefined) return { statut: "panne", definitive: true, code: "identifiant-illisible" };
      try {
        const { suit } = await client.suiviInstagram(p.idCompte, p.idUtilisateur);
        return suit === true ? { statut: "suit" } : suit === false ? { statut: "ne_suit_pas" } : { statut: "inconnu" };
      } catch (e) {
        if (!estErreurZernio(e)) return { statut: "panne", definitive: false, code: "erreur-inconnue" };
        const passager = CODES_PASSAGERS.has(e.code) || (e.statut !== undefined && e.statut >= 500);
        return { statut: "panne", definitive: !passager, code: e.code };
      }
    },

    repondreCommentaire: (p) =>
      jetonRefuse(p.nonOpposee) ? refusSansJeton() : ecrire({
        methode: "POST",
        chemin: `/v1/inbox/comments/${p.idPost}`,
        corps: { accountId: p.idCompte, message: p.texte, commentId: p.idCommentaire },
        idempotence: cleInbox("repondre-commentaire", p.cle, p.idCompte, p.idPost, p.idCommentaire),
        ...listes,
      }),

    repondreEnPrive: (p) => {
      if (jetonRefuse(p.nonOpposee)) return refusSansJeton();
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
      if (jetonRefuse(p.nonOpposee)) return refusSansJeton();
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
      const cible = typeof p.occurredAt === "string" ? Date.parse(p.occurredAt) : NaN;
      let meilleur: { m: Record<string, unknown>; ecart: number; sender: boolean } | undefined;
      let parAncienId: Record<string, unknown> | undefined;
      let curseur: string | undefined;
      let complete = false; // vrai seulement si la liste est finie (hasMore false) ou si l'arrêt anticipé en tri décroissant est sûr
      const vus = new Set<string>();
      try {
        for (let page = 0; page < PAGES_MAX; page++) {
          const rep = await client.requete({
            methode: "GET",
            chemin: `/v1/inbox/conversations/${p.idConversation}/messages`,
            query: { accountId: p.idCompte, sortOrder: "desc", limit: LIMITE_LISTE, ...(curseur ? { cursor: curseur } : {}) },
            comptesPermis: comptesLecture,
          });
          // Réponse sans tableau « messages » = réponse mal formée = PANNE (jamais « sans texte »).
          if (!estObjet(rep.corps) || !Array.isArray(rep.corps.messages)) return { ...vide, panne: true };
          // L'arrêt anticipé n'est sûr que si Zernio confirme avoir appliqué le tri décroissant.
          const desc = rep.corps.sortOrderApplied === "desc";
          let plusAncien = false;
          for (const x of rep.corps.messages) {
            if (!estObjet(x)) continue;
            // 1er choix : l'id de la plateforme (= id de la liste) ; 2e choix : l'ancienne correspondance par id.
            if (p.idPlateforme !== undefined && x.id === p.idPlateforme) return lireContenu(x);
            if (x.id === p.idMessage || x._id === p.idMessage || x.messageId === p.idMessage) {
              // Sans idPlateforme : retour immédiat (comportement d'avant). Avec : on le garde en réserve, l'idPlateforme peut suivre.
              if (p.idPlateforme === undefined) return lireContenu(x);
              parAncienId ??= x;
              continue;
            }
            if (!Number.isFinite(cible)) continue;
            const t = heureDe(x);
            if (t === undefined) continue;
            // Arrêt anticipé interdit tant qu'un idPlateforme fourni n'a pas été trouvé (il peut être plus bas dans la liste).
            if (desc && p.idPlateforme === undefined && t < cible - TOLERANCE_MS) plusAncien = true;
            if (!estEntrant(x)) continue;
            const ecart = Math.abs(t - cible);
            if (ecart > TOLERANCE_MS) continue;
            const sender = p.idExpediteur !== undefined && x.senderId === p.idExpediteur;
            if (!meilleur || ecart < meilleur.ecart || (ecart === meilleur.ecart && sender && !meilleur.sender)) meilleur = { m: x, ecart, sender };
          }
          const pag = estObjet(rep.corps.pagination) ? rep.corps.pagination : undefined;
          // Sans bloc pagination, ou hasMore false : page unique, la liste est finie (jamais une panne).
          if (pag === undefined || pag.hasMore === false || plusAncien) {
            complete = true;
            break;
          }
          const suivant = typeof pag.nextCursor === "string" && pag.nextCursor.length > 0 && pag.nextCursor.length <= 512 && /^[A-Za-z0-9_=.+/-]+$/.test(pag.nextCursor) ? pag.nextCursor : undefined;
          if (!suivant && pag.hasMore !== true) {
            complete = true; // hasMore absent et pas de curseur : rien à suivre
            break;
          }
          // Curseur absent / refusé / déjà vu (pas de boucle) : on s'arrête, la liste n'est PAS finie.
          if (!suivant || vus.has(suivant)) break;
          vus.add(suivant);
          curseur = suivant;
        }
        // L'id est testé sur TOUTES les pages lues avant de se rabattre sur l'horodatage.
        if (parAncienId) return lireContenu(parAncienId);
        if (meilleur) return lireContenu(meilleur.m);
        // Lecture arrêtée avant la fin de la liste : ce n'est PAS « introuvable » mais une panne, à réessayer.
        if (!complete) return { ...vide, panne: true, codePanne: "liste-incomplete" };
        return { ...vide, introuvable: true };
      } catch {
        return { ...vide, panne: true };
      }
    },
  };
}

/** Une page d'événements rangés. `curseurSuivant` null = fin de la liste. */
export interface PageEvenementsCommentaires {
  evenements: readonly EvenementCommentaireRange[];
  curseurSuivant: string | null;
}

/** Source des événements `comment.received` déjà rangés (dépôt du Studio, branché par une fiche suivante). */
export type SourceCommentairesRecus = (p: {
  idCompte: string;
  reseau: Exclude<ReseauListeCommentaires, "youtube">;
  curseur?: string;
  limite: number;
}) => Promise<PageEvenementsCommentaires>;

export type CodePanneListeCommentaires =
  | "compte-non-permis"
  | "reseau-inconnu"
  | "source-illisible"
  | "liste-incomplete"
  | "debit-persistant"
  | "indisponible"
  | "erreur-inconnue";

export type ListeCommentaires =
  | { statut: "ok"; reseau: Exclude<ReseauListeCommentaires, "youtube">; commentaires: CommentaireLu[]; pagesLues: number; illisibles: number }
  | { statut: "differe"; reseau: "youtube"; libelle: typeof LIBELLE_MISE_A_JOUR_DIFFEREE }
  | { statut: "panne"; code: CodePanneListeCommentaires; pagesLues: number; reessayerApresSec?: number };

export interface LecteurCommentaires {
  lireCommentaires(p: { idCompte: string; reseau: ReseauListeCommentaires }): Promise<ListeCommentaires>;
}

const PAGES_MAX_COMMENTAIRES = 10;
const ESSAIS_429_MAX = 3;
const ATTENTE_429_DEFAUT_MS = 60_000;
const CURSEUR_COMMENTAIRES = /^[A-Za-z0-9_=.+/-]{1,512}$/;

export function creerLecteurCommentaires(options: {
  source: SourceCommentairesRecus;
  comptesLecture: readonly string[];
  attendre?: (ms: number) => Promise<void>;
  pagesMax?: number;
  limite?: number;
  essais429Max?: number;
}): LecteurCommentaires {
  const comptes = [...options.comptesLecture];
  const source = options.source;
  const attendre = options.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const borne = (v: number | undefined, defaut: number, min: number, max: number): number =>
    typeof v === "number" && Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : defaut;
  const pagesMax = borne(options.pagesMax, PAGES_MAX_COMMENTAIRES, 1, PAGES_MAX_COMMENTAIRES);
  const limite = borne(options.limite, 100, 1, 100);
  const essais429Max = borne(options.essais429Max, ESSAIS_429_MAX, 0, ESSAIS_429_MAX);
  const panne = (code: CodePanneListeCommentaires, pagesLues: number, reessayerApresSec?: number): ListeCommentaires =>
    reessayerApresSec === undefined ? { statut: "panne", code, pagesLues } : { statut: "panne", code, pagesLues, reessayerApresSec };

  return {
    async lireCommentaires(p) {
      let pagesLues = 0;
      try {
        if (p.reseau === "youtube") return { statut: "differe", reseau: "youtube", libelle: LIBELLE_MISE_A_JOUR_DIFFEREE };
        if (!RESEAUX_LISTE_COMMENTAIRES.includes(p.reseau)) return panne("reseau-inconnu", 0);
        if (!comptes.includes(p.idCompte)) return panne("compte-non-permis", 0);
        const { idCompte, reseau } = p;
        const gardes = new Map<string, CommentaireLu>();
        const vus = new Set<string>();
        let illisibles = 0;
        let curseur: string | undefined;
        let fini = false;
        for (let page = 0; page < pagesMax && !fini; page++) {
          let rep: unknown;
          for (let attentes = 0; ; ) {
            try {
              rep = await source({ idCompte, reseau, limite, ...(curseur ? { curseur } : {}) });
              break;
            } catch (e) {
              if (!estErreurZernio(e)) return panne("erreur-inconnue", pagesLues);
              if (e.code === "debit" || e.statut === 429) {
                const attente = e.attenteMs ?? (e.reessayerApresSec !== undefined ? e.reessayerApresSec * 1000 : ATTENTE_429_DEFAUT_MS);
                if (attente > RETRY_AFTER_MAX_MS || attentes >= essais429Max) return panne("debit-persistant", pagesLues, Math.ceil(attente / 1000));
                attentes++;
                await attendre(attente);
                continue;
              }
              if (e.code === "indisponible" || e.code === "a-verifier" || (e.statut ?? 0) >= 500) return panne("indisponible", pagesLues);
              return panne("erreur-inconnue", pagesLues);
            }
          }
          const r = rep as { evenements?: unknown; curseurSuivant?: unknown } | null;
          if (typeof r !== "object" || r === null || !Array.isArray(r.evenements)) return panne("source-illisible", pagesLues);
          const suivant = r.curseurSuivant;
          if (suivant !== null && typeof suivant !== "string") return panne("source-illisible", pagesLues);
          pagesLues++;
          for (const ev of r.evenements) {
            const c = commentaireLuDe(ev);
            if (c === null) {
              const charge = (ev as { charge?: { proprio?: unknown } } | null)?.charge;
              if (charge?.proprio !== true) illisibles++;
              continue;
            }
            if (c.idCompte !== idCompte || c.reseau !== reseau || gardes.has(c.idCommentaire)) continue;
            gardes.set(c.idCommentaire, c);
          }
          if (suivant === null) {
            fini = true;
          } else {
            if (!CURSEUR_COMMENTAIRES.test(suivant) || vus.has(suivant)) return panne("liste-incomplete", pagesLues);
            vus.add(suivant);
            curseur = suivant;
          }
        }
        if (!fini) return panne("liste-incomplete", pagesLues);
        const commentaires = [...gardes.values()].sort((a, b) => (a.recuLe === b.recuLe ? a.idCommentaire.localeCompare(b.idCommentaire) : a.recuLe < b.recuLe ? 1 : -1));
        return { statut: "ok", reseau: reseau as Exclude<ReseauListeCommentaires, "youtube">, commentaires, pagesLues, illisibles };
      } catch {
        return panne("erreur-inconnue", pagesLues);
      }
    },
  };
}
