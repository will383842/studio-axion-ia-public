// Machine d'états de la conversation « commentaire → message privé → e-mail → guide » : fonctions PURES (aucun réseau, aucune
// base, aucun journal). Le service (`parcours-conversation.ts`) fait les effets. Aucune donnée personnelle n'entre dans l'état.
import { estMotOpposition } from "./opposition";
import { ESSAIS_MAX, EN_COURS_MAX, type Conduite } from "./crochet-zernio";
import type { ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";

export const DELAI_PERIME_MS = 24 * 3600_000;
export const EXPIRATION_MS = 7 * 24 * 3600_000;
export const FENETRE_M1_REESSAI_MS = 6 * 24 * 3600_000;
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

export type EtatParcours =
  | "nouveau" | "pub_ok" | "m1_en_vol" | "attente_email" | "m1_a_verifier" | "m1_consommee" | "m1_refuse"
  | "m2_envoye" | "guide_demande" | "termine" | "site_refuse" | "expire" | "oppose";
/** Etats où un message privé de la personne est pris en compte. */
export const ETATS_MESSAGE_ACCEPTES: readonly EtatParcours[] = ["attente_email", "m1_a_verifier", "m1_en_vol", "m2_envoye"];

/** État conservé par personne. JAMAIS : pseudo, texte, adresse, identifiant brut (les alias sont des empreintes). */
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
}

export type Raison = "proprio" | "auteur_compte" | "mot" | "reponse" | "perime" | "silence" | "opposee" | "orphelin" | "echo" | "etat";

export type EvenementMachine =
  | { t: "commentaire"; idCommentaire: string; proprio: boolean; idAuteur: string | null; idCompte: string; motSeul: string | null; estReponse: boolean; ageMs: number; maintenantMs: number }
  | { t: "public"; res: ResultatEcritureInbox }
  | { t: "m1"; res: ResultatEcritureInbox; maintenantMs: number }
  | { t: "message"; idExpediteur: string | null; idCompte: string; idMessage: string; /** Message sortant / de notre compte (direction, isOwnAccount) : écho. */ sortant?: boolean }
  | { t: "texte"; estOpposition: boolean; adresse: string | null }
  | { t: "site"; conduite: Conduite; enCoursAvant: number }
  | { t: "orphelin"; essais: number }
  | { t: "texte_absent"; essais: number }
  | { t: "texte_panne"; essais: number }
  | { t: "texte_introuvable"; essais: number };

export type Action =
  | "ecarter" | "opposer" | "demarrer" | "reprendre" | "silence"
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
export function transition(etat: Conversation | null, ev: EvenementMachine): Sortie {
  switch (ev.t) {
    case "commentaire": {
      if (ev.proprio) return { action: "ecarter", raison: "proprio" };
      if (ev.idAuteur === null || ev.idAuteur === ev.idCompte) return { action: "ecarter", raison: "auteur_compte" };
      // Une opposition (liste fermée) compte MÊME postée en réponse à un commentaire : testée AVANT d'écarter les réponses.
      if (ev.motSeul !== null && estMotOpposition(ev.motSeul)) return { action: "opposer" };
      if (ev.estReponse) return { action: "ecarter", raison: "reponse" };
      if (ev.motSeul === null) return { action: "ecarter", raison: "mot" };
      // Jamais de repli « mot inconnu → GUIDE » : seul le mot GUIDE ou une opposition a un effet.
      if (ev.motSeul.trim().toUpperCase() !== "GUIDE") return { action: "ecarter", raison: "mot" };
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
      // Déjà opposée : rien à lire. Tout AUTRE état connu : le texte est lu pour y repérer une opposition (jamais autre chose).
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
      if (ev.adresse === null) return etat && !etat.m2Envoye ? { action: "m2" } : { action: "silence", raison: "silence" };
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
 *  - `m1_en_vol` : creeLe, seulement s'il n'est PAS en vol dans ce processus (`enVol`, indicateur : la fonction reste pure) ;
 *  - toutes les dates illisibles : expiré (jamais un état éternel).
 */
export function doitExpirer(c: Conversation, maintenantMs: number, enVol = false): boolean {
  let candidates: Array<string | null | undefined>;
  switch (c.etat) {
    case "m2_envoye": candidates = [c.m2Le, c.m1Le, c.creeLe]; break;
    case "attente_email": case "m1_a_verifier": candidates = [c.m1Le, c.creeLe]; break;
    case "m1_en_vol": if (enVol) return false; candidates = [c.creeLe]; break;
    default: return false;
  }
  for (const d of candidates) {
    const t = dateLue(d);
    if (t !== null) return maintenantMs - t >= EXPIRATION_MS;
  }
  return true;
}
