// Machine d'états de la conversation « commentaire → message privé → e-mail → guide » : fonctions PURES (aucun réseau, aucune
// base, aucun journal). Le service (`parcours-conversation.ts`) fait les effets. Aucune donnée personnelle n'entre dans l'état.
import { estMotOpposition } from "./opposition";
import { ESSAIS_MAX, EN_COURS_MAX, type Conduite } from "./crochet-zernio";
import { ETATS_EN_COURS, type EtatParcours } from "./etats-parcours";
import type { ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";

export const DELAI_PERIME_MS = 24 * 3600_000;
export const EXPIRATION_MS = 7 * 24 * 3600_000;
export const FENETRE_M1_REESSAI_MS = 6 * 24 * 3600_000;
/** Fenêtre de 24 h de Meta, avec 1 h de marge (retards de Zernio) : au-delà, aucun message de conversation n'est envoyé. */
export const FENETRE_ENVOI_MS = 23 * 3600_000;
/** Une date de dernier message plus en avance que cela sur notre horloge est jugée suspecte : fenêtre fermée. */
export const AVANCE_HORLOGE_MAX_MS = 5 * 60_000;
export const ESSAIS_PUBLIC_MAX = 3;
export const ESSAIS_M1_MAX = 3;
export const ATTENTES_ORPHELIN_MS = [30_000, 2 * 60_000] as const;
export const ATTENTES_TEXTE_MS = [30_000, 2 * 60_000, 10 * 60_000] as const;
/** Panne de lecture (≠ message sans texte) : délai croissant, plafonné au dernier palier, JAMAIS d'abandon. */
export const ATTENTES_PANNE_LECTURE_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 3600_000] as const;
/** Message INTROUVABLE dans la liste (pagination, délai d'indexation) : délais longs avant de conclure, jamais « sans texte ». */
export const ATTENTES_INTROUVABLE_MS = [5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000] as const;
/** Codes du port qui ouvrent le disjoncteur des mots (rien ne repart tant que l'opérateur ne l'a pas refermé). */
export const CODES_BLOCAGE = ["INBOX_REQUIRED", "message_allowance_exceeded", "acces"] as const;

export { ETATS_EN_COURS, type EtatParcours };
/** Etats où un message privé de la personne est pris en compte. */
export const ETATS_MESSAGE_ACCEPTES: readonly EtatParcours[] = ["attente_email", "m1_a_verifier", "m1_en_vol", "m2_envoye"];

/** État conservé par personne. JAMAIS : pseudo, texte, adresse, identifiant brut de personne ou de conversation (les alias sont des empreintes). `idCommentaire`, `idCompte` et `idPostPlateforme` restent bruts (commentaire, compte et publication de NOTRE côté). */
export interface Conversation {
  etat: EtatParcours;
  reseau: "instagram" | "facebook";
  idCompte: string;
  idCommentaire: string;
  idPostPlateforme: string | null;
  versionTexteM1: string;
  guide: string;
  /** Calculée UNE fois à la création, stockée, jamais recalculée (la rotation du secret la changerait). */
  cleIdempotenceGuide: string;
  creeLe: string;
  /** Date d'envoi de M2 (expiration de `m2_envoye` 7 jours après ; repli sur `m1Le`). */
  m2Le?: string | null;
  /** Date du dernier refus d'envoi (m1_refuse) : la reprise après 24 h se mesure depuis elle, pas depuis `creeLe`. */
  refuseLe?: string | null;
  m1Le: string | null;
  occurredAt: string | null;
  m2Envoye: boolean;
  essaisSite: number;
  essaisPub: number;
  essaisM1: number;
  prochainEssaiLe: number | null;
  dernierCode: string | null;
  /** Empreintes de `sender.id` et de `conversationId`. */
  alias: string[];
  /** Identifiant du message ayant déclenché la demande de guide (reprise de l'accusé, une seule fois). */
  idMessageGuide?: string | null;
  /** Identifiant OPAQUE du message qui portait l'adresse (écrit avec `occurredAt`) : sert à relire l'adresse chez Zernio pour un « stop ». */
  idMessageAdresse?: string | null;
  /** Version du corps de la demande de guide (1 ou 3), figée au PREMIER essai : le site refuse (409) un corps différent pour une même clé. */
  versionCorpsGuide?: 1 | 3 | null;
  /** Vrai dès que le message « adresse refusée » (site : 422) a été tenté : il ne part JAMAIS deux fois pour une conversation. */
  adresseRefuseeEnvoyee?: boolean;
  /** Le site a refusé l'adresse (422) mais le message « adresse refusée » attend le plafond : le réessai ne rappelle pas le site. */
  adresseRefuseeEnAttente?: boolean;
  /** Référence opaque de conversation du lien signé (« c1_… »), écrite UNE fois au premier M1 v3 ; jamais réécrite, jamais le jeton. */
  refLienConv?: string | null;
  /** Date (ISO) du dernier message ÉCRIT PAR LA PERSONNE : base de la fenêtre de 24 h de Meta. Jamais reculée. Absente = fenêtre fermée. */
  derniereActiviteLe?: string | null;
  /** Identifiant OPAQUE de ce dernier message de la personne (jamais d'identifiant de conversation brut). */
  idMessageDernier?: string | null;
  /** Empreintes SHA-256 (hex) des jetons des liens réellement ENVOYÉS dans M1 v3 : la `ref` d'une confirmation du site en est une. Jamais le jeton, jamais le lien. */
  empreintesLien?: string[];
  /** Merci après la page : « en_vol » écrit AVANT l'envoi, jamais effacé. Une autre confirmation de la même personne ne déclenche pas un 2e merci. */
  merciEtat?: EtatMerci | null;
  merciLe?: string | null;
  /** Un message privé a laissé un DOUTE sur une demande d'arrêt : M2 n'est plus jamais envoyé (une adresse explicite déclenche encore la demande de guide). Absent = faux. */
  douteOpposition?: boolean;
}

/** Délai avant réduction des identifiants bruts d'un événement clos (D1 : 30 jours, assez pour les réessais et les vérifications à la main dans l'Inbox Zernio). */
export const DELAI_REDUCTION_MS = 30 * 24 * 3600_000;
export interface FaitsReduction {
  /** `idMessage` à NE PAS réduire : message d'adresse et du guide de TOUTES les conversations (relecture d'un « stop »), dernier message des conversations à fenêtre ouverte, messages dont dépend une opposition à transmettre. */
  idsMessagesProteges: ReadonlySet<string>;
}
/**
 * Un événement Zernio clos peut-il perdre ses identifiants bruts ? Fonction pure. Vrai seulement si : clos, plus vieux que le délai
 * (date illisible = jamais : échec fermé), non protégé, pas déjà réduit.
 */
export function reductible(ev: { traite: boolean; recuLe: string; modifieLe?: string; charge: Record<string, unknown> }, faits: FaitsReduction, maintenantMs: number): boolean {
  if (ev.traite !== true) return false;
  if (typeof ev.charge.idsReduitsLe === "string") return false;
  const t = dateLue(ev.modifieLe) ?? dateLue(ev.recuLe);
  if (t === null || maintenantMs - t < DELAI_REDUCTION_MS) return false;
  const idMessage = ev.charge.idMessage;
  return !(typeof idMessage === "string" && faits.idsMessagesProteges.has(idMessage));
}

export type EtatMerci = "en_vol" | "envoye" | "a_verifier" | "non_envoye";
/** Issues d'une confirmation, dans l'ordre où elles s'évaluent (la première vraie l'emporte). */
export type IssueMerci = "deja_traite" | "conversation_inconnue" | "oppose" | "deja_remercie" | "texte_non_valide" | "hors_fenetre" | "a_envoyer";
/**
 * Issue d'une confirmation de la page, à partir de faits DÉJÀ lus. Fonction pure. Ordre : ref au registre › conversation inconnue
 * › opposée › déjà remerciée (autre ref) › texte non validé › hors fenêtre (ou identifiant de conversation introuvable) › à envoyer.
 */
export function issueMerci(o: { refAuRegistre: boolean; conversation: Pick<Conversation, "derniereActiviteLe" | "merciEtat"> | null; oppose: boolean; texteValide: boolean; idConversationRetrouve: boolean; maintenantMs: number }): IssueMerci {
  if (o.refAuRegistre) return "deja_traite";
  if (!o.conversation) return "conversation_inconnue";
  if (o.oppose) return "oppose";
  if (o.conversation.merciEtat) return "deja_remercie";
  if (!o.texteValide) return "texte_non_valide";
  if (!dansFenetreEnvoi(o.conversation, o.maintenantMs) || !o.idConversationRetrouve) return "hors_fenetre";
  return "a_envoyer";
}

/** Version du 1er message privé quand il porte le lien signé de la page guide (interrupteur PARCOURS_LIEN_GUIDE). */
export const VERSION_M1_LIEN = "mp-m1-v3";
/** Pourquoi le 1er message part sans lien (M1 v2). Jamais une valeur, jamais un message d'erreur. */
export type CodeRepliLien = "lien_eteint" | "secret_lien_absent" | "texte_lien_non_valide" | "compte_lien_inconnu" | "jeton_invalide" | "lien_trop_long" | "forme_refusee";

export type Raison = "proprio" | "auteur_compte" | "mot" | "reponse" | "perime" | "silence" | "opposee" | "orphelin" | "echo" | "etat";

export type EvenementMachine =
  | { t: "commentaire"; idCommentaire: string; proprio: boolean; idAuteur: string | null; idCompte: string; motSeul: string | null; estReponse: boolean; ageMs: number; maintenantMs: number }
  | { t: "public"; res: ResultatEcritureInbox }
  | { t: "m1"; res: ResultatEcritureInbox; maintenantMs: number }
  | { t: "message"; idExpediteur: string | null; idCompte: string; idMessage: string; /** Message sortant / de notre compte (direction, isOwnAccount) : écho. */ sortant?: boolean }
  | { t: "texte"; estOpposition: boolean; /** Doute sur une demande d'arrêt (classerOpposition) : rien n'est envoyé. */ doute?: boolean; adresse: string | null }
  | { t: "site"; conduite: Conduite; enCoursAvant: number }
  | { t: "orphelin"; essais: number }
  | { t: "texte_absent"; essais: number }
  | { t: "texte_panne"; essais: number }
  | { t: "texte_introuvable"; essais: number };

export type Action =
  | "ecarter" | "opposer" | "doute" | "demarrer" | "reprendre" | "silence"
  | "prive" | "reessayer" | "terminer" | "bloquer"
  | "lire" | "lire_opposition" | "reprendre_recu" | "orphelin_reessai" | "orphelin_lire" | "texte_reessai" | "texte_ignore" | "texte_panne_reessai" | "introuvable_reessai" | "introuvable_clore"
  | "m2" | "demander_guide" | "guide_ok" | "site_reessai" | "site_refuse";

export interface Sortie {
  action: Action;
  raison?: Raison;
  patch?: Partial<Conversation>;
  apresMs?: number;
  code?: string;
  /** Vrai : le port a répondu par un code qui ouvre le disjoncteur des mots. */
  blocage?: boolean;
}

const estBlocage = (code: string | undefined): boolean => !!code && (CODES_BLOCAGE as readonly string[]).includes(code);
const secondes = (s: number | undefined, defautMs: number): number => (typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.min(Math.ceil(s) * 1000, 3600_000) : defautMs);

/** Transition PURE : (état courant | null, événement) → action à faire et correctif d'état. */
export function transition(etat: Conversation | null, ev: EvenementMachine, motsActifs: readonly string[] = ["GUIDE"]): Sortie {
  switch (ev.t) {
    case "commentaire": {
      if (ev.proprio) return { action: "ecarter", raison: "proprio" };
      if (ev.idAuteur === null || ev.idAuteur === ev.idCompte) return { action: "ecarter", raison: "auteur_compte" };
      // Une opposition (liste fermée) compte MÊME postée en réponse à un commentaire : testée AVANT d'écarter les réponses.
      if (ev.motSeul !== null && estMotOpposition(ev.motSeul)) return { action: "opposer" };
      if (ev.estReponse) return { action: "ecarter", raison: "reponse" };
      if (ev.motSeul === null) return { action: "ecarter", raison: "mot" };
      // Jamais de repli « mot inconnu → GUIDE » : seul le mot GUIDE ou une opposition a un effet.
      if (!motsActifs.includes(ev.motSeul.trim().toUpperCase())) return { action: "ecarter", raison: "mot" };
      if (etat === null) return ev.ageMs > DELAI_PERIME_MS ? { action: "ecarter", raison: "perime" } : { action: "demarrer" };
      // Reprise du MÊME commentaire (réessai public ou privé), jamais un second parcours.
      if (etat.idCommentaire === ev.idCommentaire && (etat.etat === "nouveau" || etat.etat === "pub_ok")) return { action: "reprendre" };
      // Un parcours par personne ; seule exception : un refus d'envoi (m1_refuse) vieux de plus de 24 h (depuis la date du refus).
      if (etat.etat === "m1_refuse" && ev.maintenantMs - Date.parse(etat.refuseLe ?? etat.creeLe) > DELAI_PERIME_MS) return { action: "demarrer" };
      return { action: "silence", raison: "silence" };
    }
    case "public": {
      const r = ev.res;
      if (r.statut === "envoye") return { action: "prive", patch: { etat: "pub_ok", dernierCode: null, prochainEssaiLe: null } };
      if (estBlocage(r.code)) return { action: "bloquer", code: r.code, blocage: true, patch: { dernierCode: r.code ?? null } };
      const essais = (etat?.essaisPub ?? 0) + 1;
      if (r.statut === "a_reessayer" && essais < ESSAIS_PUBLIC_MAX) return { action: "reessayer", apresMs: secondes(r.reessayerApresSec, 30_000), code: r.code, patch: { essaisPub: essais, dernierCode: r.code ?? null } };
      // a_verifier / refuse / définitif / débit épuisé : on note le code, SANS réessai, et on continue vers le privé.
      return { action: "prive", code: r.code, patch: { etat: "pub_ok", essaisPub: essais, dernierCode: r.code ?? r.statut, prochainEssaiLe: null } };
    }
    case "m1": {
      const r = ev.res;
      if (r.statut === "envoye") return { action: "terminer", patch: { etat: "attente_email", m1Le: new Date(ev.maintenantMs).toISOString(), dernierCode: null, prochainEssaiLe: null } };
      if (r.statut === "definitif" || r.consomme || r.etat === "consommee") return { action: "terminer", code: r.code, patch: { etat: "m1_consommee", dernierCode: r.code ?? "consommee", prochainEssaiLe: null } };
      if (r.statut === "a_verifier") return { action: "terminer", code: r.code, patch: { etat: "m1_a_verifier", dernierCode: r.code ?? "a_verifier", prochainEssaiLe: null } };
      if (r.statut === "a_reessayer") {
        const essais = (etat?.essaisM1 ?? 0) + 1;
        const dansLaFenetre = etat ? ev.maintenantMs - Date.parse(etat.creeLe) < FENETRE_M1_REESSAI_MS : false;
        if (essais < ESSAIS_M1_MAX && dansLaFenetre) {
          const apres = secondes(r.reessayerApresSec, 60_000);
          return { action: "reessayer", apresMs: apres, code: r.code, patch: { etat: "pub_ok", essaisM1: essais, dernierCode: r.code ?? null, prochainEssaiLe: ev.maintenantMs + apres } };
        }
        return { action: "terminer", code: r.code, patch: { etat: "m1_refuse", refuseLe: new Date(ev.maintenantMs).toISOString(), essaisM1: essais, dernierCode: r.code ?? "debit", prochainEssaiLe: null } };
      }
      return { action: estBlocage(r.code) ? "bloquer" : "terminer", code: r.code, blocage: estBlocage(r.code), patch: { etat: "m1_refuse", refuseLe: new Date(ev.maintenantMs).toISOString(), dernierCode: r.code ?? "refuse", prochainEssaiLe: null } };
    }
    case "message": {
      if (ev.sortant === true || ev.idExpediteur === null || ev.idExpediteur === ev.idCompte) return { action: "ecarter", raison: "echo" };
      if (etat === null) return { action: "orphelin_reessai", raison: "orphelin" };
      if (etat.etat === "guide_demande" && etat.idMessageGuide === ev.idMessage) return { action: "reprendre_recu" };
      // Déjà opposée : rien à lire. États de ETATS_MESSAGE_ACCEPTES : lecture complète (adresse ou opposition). Tout AUTRE état connu : le texte est lu pour y repérer une opposition SEULEMENT.
      if (etat.etat === "oppose") return { action: "silence", raison: "etat" };
      if (!ETATS_MESSAGE_ACCEPTES.includes(etat.etat)) return { action: "lire_opposition", raison: "etat" };
      return { action: "lire" };
    }
    case "orphelin":
      return ev.essais < ATTENTES_ORPHELIN_MS.length ? { action: "orphelin_reessai", apresMs: ATTENTES_ORPHELIN_MS[ev.essais] } : { action: "orphelin_lire", raison: "orphelin" };
    case "texte_absent":
      return ev.essais < ATTENTES_TEXTE_MS.length ? { action: "texte_reessai", apresMs: ATTENTES_TEXTE_MS[ev.essais] } : { action: "texte_ignore" };
    case "texte_panne":
      return { action: "texte_panne_reessai", apresMs: ATTENTES_PANNE_LECTURE_MS[Math.min(Math.max(ev.essais, 0), ATTENTES_PANNE_LECTURE_MS.length - 1)] };
    case "texte_introuvable":
      return ev.essais < ATTENTES_INTROUVABLE_MS.length ? { action: "introuvable_reessai", apresMs: ATTENTES_INTROUVABLE_MS[Math.max(ev.essais, 0)] } : { action: "introuvable_clore" };
    case "texte": {
      if (ev.estOpposition) return { action: "opposer", patch: { etat: "oppose" } };
      if (ev.doute) return { action: "doute", patch: { douteOpposition: true } };
      // Après un doute, M2 n'est plus jamais envoyé ; une adresse explicite déclenche quand même la demande de guide.
      // Après le message avec lien (M1 v3), on n'a jamais demandé d'adresse : M2 (« adresse non reconnue ») n'a pas de sens, silence.
      if (ev.adresse === null) return etat && !etat.m2Envoye && !etat.douteOpposition && etat.versionTexteM1 !== VERSION_M1_LIEN ? { action: "m2" } : { action: "silence", raison: "silence" };
      return { action: "demander_guide" };
    }
    case "site": {
      const c = ev.conduite;
      if (c.genre === "termine") return { action: "guide_ok", patch: { etat: "guide_demande", dernierCode: "200", prochainEssaiLe: null } };
      if (c.genre === "definitif") return { action: "site_refuse", code: c.code, patch: { etat: "site_refuse", dernierCode: c.code, prochainEssaiLe: null } };
      const enAttente = c.code === "409_en_cours";
      const essais = (etat?.essaisSite ?? 0) + (enAttente ? 0 : 1);
      if (enAttente ? ev.enCoursAvant + 1 > EN_COURS_MAX : essais >= ESSAIS_MAX) return { action: "site_refuse", code: "abandon", patch: { etat: "site_refuse", essaisSite: essais, dernierCode: "abandon", prochainEssaiLe: null } };
      return { action: "site_reessai", apresMs: c.apresMs, code: c.code, patch: { essaisSite: essais, dernierCode: c.code } };
    }
  }
}

/** Date lisible → millisecondes, sinon `null` (absente ou illisible). */
const dateLue = (d: string | null | undefined): number | null => {
  const t = typeof d === "string" ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * Expiration après 7 jours, sans message envoyé. Date de référence, avec repli quand la date est illisible :
 *  - `m2_envoye` : m2Le → m1Le → creeLe ; `attente_email` et `m1_a_verifier` : m1Le → creeLe ;
 *  - `nouveau` et `pub_ok` : creeLe ; `guide_demande` : m1Le → creeLe ;
 *  - `m1_en_vol` : creeLe, seulement s'il n'est PAS en vol dans ce processus (`enVol`, indicateur : la fonction reste pure) ;
 *  - toutes les dates illisibles : expiré (jamais un état éternel).
 */
export function doitExpirer(c: Conversation, maintenantMs: number, enVol = false): boolean {
  let candidates: Array<string | null | undefined>;
  switch (c.etat) {
    case "m2_envoye": candidates = [c.m2Le, c.m1Le, c.creeLe]; break;
    case "attente_email": case "m1_a_verifier": candidates = [c.m1Le, c.creeLe]; break;
    case "m1_en_vol": if (enVol) return false; candidates = [c.creeLe]; break;
    // STU-MENAGE : sans cela ces états « en cours » ne finissaient JAMAIS si leur événement était perdu ou clos autrement.
    // `nouveau` / `pub_ok` : la réponse privée de Meta n'est plus possible après 7 jours. `guide_demande` : le guide est parti par e-mail, seul le reçu manquait.
    case "nouveau": case "pub_ok": candidates = [c.creeLe]; break;
    case "guide_demande": candidates = [c.m1Le, c.creeLe]; break;
    default: return false;
  }
  for (const d of candidates) {
    const t = dateLue(d);
    if (t !== null) return maintenantMs - t >= EXPIRATION_MS;
  }
  return true;
}

/**
 * Date de dernière activité à retenir : la PLUS RÉCENTE de l'ancienne et de la nouvelle (jamais en arrière : rejeu, désordre).
 * La nouvelle vient de `occurredAt` s'il est lisible, sinon de `recuLe` ; une date dans le futur est ramenée à maintenant.
 * `null` si rien n'est lisible.
 */
export function activiteRetenue(ancienne: string | null | undefined, occurredAt: string | null | undefined, recuLe: string | null | undefined, maintenantMs: number): string | null {
  const nouvelle = dateLue(occurredAt) ?? dateLue(recuLe);
  const vieille = dateLue(ancienne);
  const n = nouvelle === null ? null : Math.min(nouvelle, maintenantMs);
  const meilleur = n === null ? vieille : vieille === null ? n : Math.max(n, vieille);
  return meilleur === null ? null : new Date(meilleur).toISOString();
}

/** Vrai si un message de conversation peut encore partir. Échec fermé : date absente, illisible ou en avance sur l'horloge = faux. */
export function dansFenetreEnvoi(c: Pick<Conversation, "derniereActiviteLe">, maintenantMs: number): boolean {
  const t = dateLue(c.derniereActiviteLe);
  if (t === null || t > maintenantMs + AVANCE_HORLOGE_MAX_MS) return false;
  return maintenantMs - t < FENETRE_ENVOI_MS;
}

/**
 * Par quelles voies un « stop » peut-il devoir atteindre le site ?
 *  - `adresse` : l'adresse a été tapée dans la conversation et transmise (route actuelle, par adresse) ;
 *  - `page` : la personne a reçu le lien de la page (`refLienConv`), donc son adresse est peut-être chez le site sans que le Studio la connaisse.
 */
export function voiesOpposition(c: Pick<Conversation, "occurredAt" | "refLienConv">): { adresse: boolean; page: boolean } {
  return { adresse: typeof c.occurredAt === "string", page: typeof c.refLienConv === "string" && c.refLienConv !== "" };
}
