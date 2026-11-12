/**
 * JOURNAL DURABLE DES ÉCHECS (GV-EC-01a) — partie pure (aucun accès aux dépôts).
 * Chaque échec d'un travail laisse une ligne qui ne s'efface jamais, même après « Réessayer » (les moteurs vident
 * `travail.erreur` à la relance). La ligne est portée par un événement du journal existant (type `echec-detail`).
 */
import { CODES_ATTENTE_VALIDATION } from "./sujets-traites";
import type { Evenement } from "./types";

/** Type de l'événement qui porte la ligne dans le dépôt `evenements`. */
export const TYPE_EVENEMENT_ECHEC = "echec-detail";

/** Longueur maximale du détail technique gardé. */
export const LONGUEUR_MAX_DETAIL = 500;

export type FamilleEchec = "attente-validation" | "fournisseur" | "entree-a-corriger" | "controle" | "reglage" | "panne" | "autre";

export interface LigneEchec {
  date: string;
  videoId: string;
  travailId: string;
  /** Identifiant du format (`formatId` de la commande). */
  generateur: string;
  moteur: string;
  /** Nom de l'étape en échec. */
  etape: string;
  code: string;
  famille: FamilleEchec;
  /** La phrase montrée à l'utilisateur. */
  phrase: string;
  /** Détail technique nettoyé (jamais de clé ni de jeton). */
  detail: string;
  /** Numéro d'essai (`tentatives` du travail au moment de l'échec). */
  essai: number;
}

/** Événement du journal d'activité qui porte une ligne d'échec (champ supplémentaire typé ici, pas dans `types.ts`). */
export interface EvenementEchec extends Evenement {
  echec: LigneEchec;
}

/** Identifiant stable de l'événement : rejouer l'écriture du même échec n'ajoute rien. */
export function identifiantEchec(travailId: string, tentatives: number): string {
  return `ev-echec-${travailId}-${tentatives}`;
}

/** Famille d'un code d'erreur de travail (étiquette seulement : aucun comportement n'en dépend ici). */
export function familleDe(code: string): FamilleEchec {
  if (CODES_ATTENTE_VALIDATION.includes(code)) return "attente-validation";
  if (code.startsWith("FOURNISSEUR_")) return "fournisseur";
  if (code.startsWith("IV_IMAGE") || code === "IV_TYPE_A_CHOISIR") return "entree-a-corriger";
  if (/^(BUDGET_|CONFIRMATION_|CREDIT_|CAS_TRAITE|CAS_RETIRE|SUJET_|PAS_EN_ECHEC)/.test(code)) return "controle";
  if (/^(REGLAGE|CLE_|CONFIG|SANS_CLE)/.test(code) || /_NON_CONFIGURE$/.test(code)) return "reglage";
  if (/^(PANNE|ERREUR_INTERNE|EXPORT_|MONTAGE_|RENDU_|FFMPEG|INTERNE)/.test(code)) return "panne";
  return "autre";
}

/**
 * Détail technique prêt à garder : 500 caractères au plus, et tout ce qui ressemble à une clé, un jeton ou un mot de
 * passe est retiré (remplacé par « [retiré] »).
 */
export function nettoyerDetail(texte: string | null | undefined): string {
  if (!texte) return "";
  const retire = "[retiré]";
  const net = String(texte)
    // en-têtes et valeurs nommées : Authorization: Bearer xxx, api_key=xxx, "token":"xxx", password: xxx…
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${retire}`)
    .replace(/(["']?\b[\w-]*(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|mot[_-]?de[_-]?passe|authorization|cle|key)[\w-]*\b["']?\s*[:=]\s*)(["']?)[^\s"',;&]+\2/gi, `$1${retire}`)
    // préfixes de clés connus
    .replace(/\b(?:sk|pk|rk|xox[abprs]|ghp|gho|ghs|github_pat|AKIA|AIza)[-_A-Za-z0-9]{8,}/g, retire)
    // jeton signé (JWT)
    .replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, retire)
    // toute longue suite opaque (hexadécimal, base64) de 24 caractères ou plus
    .replace(/\b[A-Za-z0-9+/_=-]{24,}\b/g, (m) => (/[0-9]/.test(m) || /[A-Z]/.test(m) ? retire : m));
  return net.slice(0, LONGUEUR_MAX_DETAIL);
}
