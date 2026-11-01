/**
 * Erreurs typées du client Zernio (ADR-0002, ADR-0003, ADR-0004).
 *
 * Règle de sécurité : une erreur ne porte JAMAIS la clé d'API, ni les en-têtes de la requête. Tout texte venu du
 * fournisseur passe par `masquerSecret` avant d'être rangé dans `detailTechnique`.
 */
import type { ErreurFournisseur } from "@/fournisseurs/types";

/**
 * Codes d'erreur du client :
 * - `envoi-coupe` : interrupteur `zernio.envoi_autorise` à faux, écriture refusée (lecture permise) ;
 * - `mot-interdit` : un mot interdit est présent dans le corps (D7), refus avant le réseau ;
 * - `chemin-refuse` : chemin, méthode ou forme de corps hors de la liste fermée (D6), refus avant le réseau ;
 * - `debit` : plafond de débit local atteint (refus avant le réseau) ou 429 répété après un seul nouvel essai ;
 * - `lecture-requise` : une écriture a fini en 5xx ou en délai dépassé ; une lecture GET doit précéder toute écriture ;
 * - `conflit-idempotence` : 409 `idempotency_conflict`, le premier appel tourne encore ;
 * - `doublon` : 409 doublon de contenu (24 h), `existingPostId` renseigné si Zernio le donne ;
 * - `a-verifier` : 5xx ou délai dépassé sur une écriture : l'état chez Zernio est inconnu, lire avant de réessayer ;
 * - `indisponible` : 5xx ou délai dépassé sur une lecture ;
 * - `acces` : 401 ou 403 ;
 * - `introuvable` : 404 ;
 * - `refuse` : autre 4xx ;
 * - `reponse-invalide` : réponse illisible ou de forme inattendue.
 */
export type CodeErreurZernio =
  | "envoi-coupe"
  | "mot-interdit"
  | "chemin-refuse"
  | "debit"
  | "lecture-requise"
  | "conflit-idempotence"
  | "doublon"
  | "a-verifier"
  | "indisponible"
  | "acces"
  | "introuvable"
  | "refuse"
  | "reponse-invalide";

/** Codes levés AVANT tout appel réseau (le faux fetch des tests n'est jamais appelé). */
export const CODES_AVANT_RESEAU: readonly CodeErreurZernio[] = ["envoi-coupe", "mot-interdit", "chemin-refuse", "debit", "lecture-requise"];

export interface DetailsErreurZernio {
  /** Statut HTTP reçu, absent pour un refus avant le réseau. */
  statut?: number;
  /** Peut-on réessayer plus tard sans risque de doublon ? */
  reessayable?: boolean;
  /** Attente conseillée avant un nouvel essai (Retry-After ou plafond local), en millisecondes. */
  attenteMs?: number;
  /** Doublon de contenu : identifiant du post d'origine (lu dans `details.existingPostId` ou à la racine). */
  existingPostId?: string;
  /** Champs du corps en cause (filtre des mots interdits, liste fermée). */
  champs?: string[];
  /** Texte technique (anglais, code fournisseur), déjà nettoyé de tout secret. Console serveur seulement. */
  detailTechnique?: string;
}

export class ErreurZernio extends Error {
  readonly code: CodeErreurZernio;
  readonly statut?: number;
  readonly reessayable: boolean;
  readonly attenteMs?: number;
  readonly existingPostId?: string;
  readonly champs?: string[];
  readonly detailTechnique?: string;

  constructor(code: CodeErreurZernio, message: string, details: DetailsErreurZernio = {}) {
    super(message);
    this.name = "ErreurZernio";
    this.code = code;
    this.statut = details.statut;
    this.reessayable = details.reessayable ?? false;
    this.attenteMs = details.attenteMs;
    this.existingPostId = details.existingPostId;
    this.champs = details.champs;
    this.detailTechnique = details.detailTechnique;
  }

  /** Vrai si l'erreur a été levée avant tout appel réseau. */
  get avantReseau(): boolean {
    return CODES_AVANT_RESEAU.includes(this.code);
  }
}

export function estErreurZernio(e: unknown): e is ErreurZernio {
  return e instanceof ErreurZernio;
}

const MASQUE = "[secret masqué]";

/**
 * Retire d'un texte toute occurrence des secrets donnés (clé d'API) et tout jeton porteur (`Bearer …`).
 * À appliquer à tout texte venu du réseau ou d'une exception avant de le ranger dans une erreur ou un journal.
 */
export function masquerSecret(texte: string, secrets: readonly string[] = []): string {
  let propre = texte;
  for (const s of secrets) {
    if (s && s.length >= 4) propre = propre.split(s).join(MASQUE);
  }
  return propre.replace(/Bearer\s+[^\s"',;]+/gi, `Bearer ${MASQUE}`);
}

/** Traduction vers l'erreur commune des fournisseurs (phrase simple pour l'écran, détail technique à part). */
export function versErreurFournisseur(e: ErreurZernio): ErreurFournisseur {
  const code: ErreurFournisseur["code"] =
    e.code === "debit" || e.code === "conflit-idempotence"
      ? "quota"
      : e.code === "indisponible" || e.code === "a-verifier"
        ? "indisponible"
        : e.code === "reponse-invalide"
          ? "inconnu"
          : "refuse";
  return { code, reessayable: e.reessayable, message: e.message, detailTechnique: e.detailTechnique };
}
