/**
 * GUIDES PDF (lot G2) · rédaction d'un BROUILLON de guide par Claude. INERTE : tant que `GUIDES_REDACTION_ENABLED` n'est pas
 * exactement « true » (lu à l'exécution, valeur bornée), AUCUN appel, AUCUNE écriture.
 *
 * Chaîne : mot → appel Claude (modèle claude-sonnet-5-5, client Claude existant via `fournisseurs/claude/appel-redaction`, clé choisie par le socle des
 * sources Claude : aucune clé dans le code) → lecture du JSON → schéma et contrôle du texte (G1) → enregistrement dans un
 * paramètre VERSIONNÉ `guides.redaction.<mot>` au statut « À valider ». Jamais « validé » ici : seule la relecture
 * humaine (écran G5) validera. Le journal ne contient ni texte du guide, ni clé, ni donnée de personne (seulement le code de
 * l'événement, la version, l'empreinte raccourcie, l'identifiant de la règle en cas de refus).
 * ARGENT (0a phase 2) : l'appel réel (`appelerClaudeRedaction`) passe par le chemin gardé des appels Claude : limite Claude
 * du mois lue AVANT l'appel sous le verrou du mois, pré-vol et réservation de la brique Crédits, `appelerAvecRotation`, puis
 * `depenses.enregistrer` (coût réel) et réservation rendue. Limite atteinte ou crédit insuffisant : refus propre
 * (`plafond_atteint`, `credit_insuffisant`, `prix_a_confirmer`, `claude_indisponible`), AUCUN appel, rien d'écrit. Le verrou
 * « un geste à la fois par mot » est tenu par `guides-fabrique.ts` (seul appelant). Un seul appel par geste, jamais en boucle.
 */
import "server-only";
import { createHash } from "node:crypto";
import { contientCaractereInterdit, controlerTexteGuide, empreinteGuide, schemaContenuGuide, type ContenuGuide } from "@/domaine/guides-pdf/guide-contenu";
import { appelerClaudeRedaction, type MotifRefusArgent } from "@/fournisseurs/claude/appel-redaction";
import type { OrigineLancement } from "./budget-mensuel";
import { extraireJson, type RequeteClaude } from "@/fournisseurs/claude/client";

export const VARIABLE_INTERRUPTEUR_GUIDES_REDACTION = "GUIDES_REDACTION_ENABLED";
export const MODELE_REDACTION_GUIDE = "claude-sonnet-5-5";
export const STATUT_A_VALIDER = "À valider";
export const STATUT_VALIDE = "Validé";
export const MAX_VERSIONS_CONSERVEES = 50;
export const MAX_VERSIONS_REFUS = 1000;
export const PREFIXE_PARAM_REDACTION = "guides.redaction.";
const LONGUEUR_MAX_MOT = 60;
const LONGUEUR_MAX_INTERRUPTEUR = 16;

/**
 * Origine de la rédaction, transmise à la garde d'argent. Seule entrée : l'action Studio d'une personne connectée
 * (`actions-guides.ts`, `exigerSession()` avant tout) via `guides-fabrique.ts` ; AUCUNE entrée de l'Usine n'appelle cette
 * rédaction. Un appelant de l'Usine devra passer « usine » lui-même, jamais cette constante.
 */
export const ORIGINE_GUIDES: OrigineLancement = "studio";

type Env = Record<string, string | undefined>;

/** Seul le texte exact « true » allume (valeur démesurée, majuscules, espaces : éteint). */
export function guidesRedactionActif(env: Env = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_GUIDES_REDACTION];
  return typeof v === "string" && v.length <= LONGUEUR_MAX_INTERRUPTEUR && v === "true";
}

export interface DepsRedaction {
  env?: Env;
  choisirCle: () => Promise<string | null>;
  appeler: (requete: RequeteClaude, cle: string, origine: OrigineLancement) => Promise<{ texte: string; marqueur?: string }>;
  lireParametre: (id: string) => Promise<unknown>;
  ecrireParametre: (id: string, valeur: unknown) => Promise<void>;
  journaliser: (type: string, message: string) => Promise<void>;
  maintenant: () => string;
}

export interface VersionBrouillon {
  version: number;
  statut: string;
  empreinte: string;
  modele: string;
  creeLe: string;
  contenu: ContenuGuide;
}

export type ResultatRedaction =
  | { ok: true; version: number; statut: typeof STATUT_A_VALIDER; empreinte: string }
  | { ok: false; raison: "interrupteur_eteint" | "mot_invalide" | "cle_absente" | "panne_claude" | "reponse_illisible" | "texte_refuse" | "enregistrement_echec" | "dependances_indisponibles" | "trop_de_versions" | RaisonRefusArgent; regle?: string };

/** Refus de la garde d'argent (aucun appel, rien d'écrit). */
export type RaisonRefusArgent = "plafond_atteint" | "credit_insuffisant" | "prix_a_confirmer" | "claude_indisponible";
const RAISON_DU_REFUS_ARGENT: Record<MotifRefusArgent, RaisonRefusArgent> = {
  "plafond-mois": "plafond_atteint",
  credit: "credit_insuffisant",
  "prix-a-confirmer": "prix_a_confirmer",
  "claude-indisponible": "claude_indisponible",
};

/** Reconnaît un refus de la garde par sa forme (pas d'`instanceof` : le module peut être doublé dans les essais). */
function refusArgent(e: unknown): RaisonRefusArgent | null {
  if (!e || typeof e !== "object" || (e as { refusArgent?: unknown }).refusArgent !== true) return null;
  return RAISON_DU_REFUS_ARGENT[(e as { motif: MotifRefusArgent }).motif] ?? "credit_insuffisant";
}

/** Dépendances réelles, importées à l'usage (rien ne touche la base ni le réseau à l'import). */
async function depsReelles(): Promise<DepsRedaction> {
  const commun = await import("./_commun");
  return {
    choisirCle: async () => {
      // Comme generation-claude.ts : même choix de source, mêmes clés visibles. Import différé (cycle).
      const { choisirSourceClaude } = await import("./source-claude");
      const { envClaude } = await import("./generation-claude");
      const choix = await choisirSourceClaude([], envClaude());
      return choix.etat === "pret" ? choix.cle : null;
    },
    appeler: appelerClaudeRedaction,
    lireParametre: async (id) => (await commun.depots().parametres.obtenir(id))?.valeur ?? null,
    ecrireParametre: commun.ecrireParametre,
    journaliser: (type, message) => commun.journaliser(type, message),
    maintenant: commun.maintenant,
  };
}

/** Le mot sert d'identifiant du paramètre : lettres/chiffres/tirets, 1 à 60 caractères, sans caractère de contrôle. */
export function identifiantMot(mot: unknown): string | null {
  if (typeof mot !== "string") return null;
  const brut = mot.trim();
  if (!brut || brut.length > LONGUEUR_MAX_MOT || contientCaractereInterdit(brut)) return null;
  const base = brut.normalize("NFKD").replace(/[\u0300-\u036F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base) return null;
  // Suffixe d'empreinte du mot d'origine (NFC, minuscules) : « Été » et « ete », « C++ » et « C » ne partagent jamais la même clé.
  const empreinte = createHash("sha256").update(brut.normalize("NFC").toLowerCase(), "utf8").digest("hex").slice(0, 8);
  return `${base}-${empreinte}`;
}

const CONSIGNE = [
  "Vous rédigez le brouillon d'un guide pratique à télécharger, en français, pour la marque Studio Axion IA.",
  "Règles impératives : vouvoiement (jamais de tutoiement) ; pour la suite, dire « suivre le compte » ; aucune promesse de résultat ni de gain, aucun pourcentage, aucun montant en euros, aucune formule « x fois » ou « doubler/tripler » ; ne jamais écrire « garanti », « certifié », « Qualiopi », ni citer de ville ; pas de donnée de personne.",
  "Structure : de 3 à 8 sections ; chaque section a un titre court, 1 à 4 paragraphes courts et, si utile, jusqu'à 6 puces.",
  'Répondez UNIQUEMENT par un objet JSON de la forme {"titre": "...", "sections": [{"titre": "...", "paragraphes": ["..."], "puces": ["..."]}]}, sans texte autour. Le champ "puces" est toujours présent (liste vide si aucune).',
].join("\n");

/**
 * Rédige un brouillon pour `mot` et l'enregistre « À valider ». Ne lève jamais : toute panne devient un résultat d'échec.
 * `deps` : injectable pour les essais (faux client Claude, mémoire).
 */
export async function redigerBrouillonGuide(mot: string, deps?: DepsRedaction): Promise<ResultatRedaction> {
  // 1. L'interrupteur se lit AVANT tout chargement : éteint, rien n'est importé ni touché.
  if (!guidesRedactionActif(deps?.env ?? process.env)) return { ok: false, raison: "interrupteur_eteint" };
  // 2. Les dépendances se chargent dans un try : une panne d'import ou de base devient un résultat d'échec.
  let d: DepsRedaction;
  try {
    d = deps ?? (await depsReelles());
  } catch {
    return { ok: false, raison: "dependances_indisponibles" };
  }
  const id = identifiantMot(mot);
  if (!id) return { ok: false, raison: "mot_invalide" };
  // Le mot envoyé à Claude est le mot VALIDÉ (même filtre que le schéma), jamais une version non filtrée.
  const cle = await d.choisirCle().catch(() => null);
  if (!cle) return { ok: false, raison: "cle_absente" };

  const cleParam = PREFIXE_PARAM_REDACTION + id;
  let versions: VersionBrouillon[];
  try {
    const existant = await d.lireParametre(cleParam);
    versions = Array.isArray((existant as { versions?: unknown } | null)?.versions) ? [...(existant as { versions: VersionBrouillon[] }).versions] : [];
  } catch {
    return { ok: false, raison: "enregistrement_echec" };
  }
  if (versions.length >= MAX_VERSIONS_REFUS) return { ok: false, raison: "trop_de_versions" };

  let brut: string;
  let marqueur: string | undefined;
  try {
    const reponse = await d.appeler(
      {
        modele: MODELE_REDACTION_GUIDE,
        maxTokens: 8000,
        effort: "medium",
        systeme: [{ texte: CONSIGNE }],
        messages: [{ role: "user", contenu: `Mot du guide : ${mot.trim()}\nRédigez le brouillon du guide.` }],
        json: true,
      },
      cle,
      ORIGINE_GUIDES,
    );
    brut = reponse.texte;
    marqueur = reponse.marqueur;
  } catch (e) {
    // Refus de la garde d'argent : rien n'est parti chez Claude, rien n'est écrit (ce n'est pas une panne).
    const refus = refusArgent(e);
    if (refus) {
      await journaliserSansDonnee(d, "guide_redaction_refus_argent", `raison=${refus}`);
      return { ok: false, raison: refus };
    }
    await journaliserSansDonnee(d, "guide_redaction_panne", `code=${e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "inconnu"}`);
    return { ok: false, raison: "panne_claude" };
  }

  let contenu: ContenuGuide;
  try {
    const analyse = schemaContenuGuide.safeParse(JSON.parse(extraireJson(brut)));
    if (!analyse.success) throw new Error("schema");
    contenu = analyse.data;
  } catch {
    await journaliserSansDonnee(d, "guide_redaction_illisible", `reponse non conforme${marqueur ? ` marqueur=${marqueur}` : ""}`);
    return { ok: false, raison: "reponse_illisible" };
  }

  const controle = controlerTexteGuide(contenu);
  if (!controle.ok) {
    await journaliserSansDonnee(d, "guide_redaction_refusee", `regle=${controle.regle}`);
    return { ok: false, raison: "texte_refuse", regle: controle.regle };
  }

  try {
    const version = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
    const empreinte = empreinteGuide(contenu);
    versions.push({ version, statut: STATUT_A_VALIDER, empreinte, modele: MODELE_REDACTION_GUIDE, creeLe: d.maintenant(), contenu });
    await d.ecrireParametre(cleParam, { versions: garderDernieres(versions) });
    await journaliserSansDonnee(d, "guide_redaction_ok", `version=${version} empreinte=${empreinte.slice(0, 12)}`);
    return { ok: true, version, statut: STATUT_A_VALIDER, empreinte };
  } catch {
    return { ok: false, raison: "enregistrement_echec" };
  }
}

/** Garde les 50 dernières versions, plus la dernière version validée si elle est plus ancienne. Ordre croissant conservé. */
function garderDernieres(versions: VersionBrouillon[]): VersionBrouillon[] {
  if (versions.length <= MAX_VERSIONS_CONSERVEES) return versions;
  const recentes = versions.slice(-MAX_VERSIONS_CONSERVEES);
  const derniereValidee = [...versions].reverse().find((v) => v.statut === STATUT_VALIDE);
  if (!derniereValidee || recentes.includes(derniereValidee)) return recentes;
  return [derniereValidee, ...recentes.slice(1)];
}

async function journaliserSansDonnee(d: DepsRedaction, type: string, message: string): Promise<void> {
  try {
    await d.journaliser(type, message);
  } catch {
    /* le journal ne fait jamais échouer la rédaction */
  }
}
