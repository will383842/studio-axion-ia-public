/**
 * CLAUDE DU « TUTORIEL D'OUTIL » (T-EXT-30) : relie un vrai Claude au plan de scènes et à l'écriture du script depuis une
 * idée, UNIQUEMENT par le chemin gardé de l'argent (`executerRolePourVideo` : plafond propre de la vidéo, limite du mois,
 * pré-vol, réservation, dépense réelle, origine de la commande). Aucun appel direct à Claude ici.
 *
 *  - ÉTEINT PAR DÉFAUT : sans le réglage `tutoriel.claude` à exactement `true`, le raccord garde le comportement d'avant
 *    (Claude « pas encore relié », le plan retombe sur le repli). Le réglage n'est jamais écrit par ce fichier.
 *  - Claude non choisi pour les textes (fournisseur « texte-reseaux » ≠ Claude) : l'appel est simulé, sans texte ; on lève
 *    alors, le plan de repli sert. Jamais un faux plan venu de la simulation.
 *  - Plafond propre au tutoriel : `tutoriel.plafondClaudeUsd`, sinon le pire cas calculé ici (aucun prix recopié).
 *  - Aucun montant n'est rendu au moteur ni à l'écran (format sans prix).
 */
import "server-only";
import { construireRequetePlan, MAX_JETONS_PLAN_SCENES, type AppelClaude } from "@/briques/plan-scenes/generateur";
import type { MotMinute } from "@/briques/plan-scenes/schema";
import { coutPireRegardUsd } from "@/briques/regardeur";
import { ErreurClaude, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { IMAGES_REGARD_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/equipe/regardeur";
import { requeteScript } from "@/moteurs/montage-tutoriel-outil/script";
import { formatDuRatio } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import type { executerRolePourVideo } from "./depense-claude-video";

export const PARAM_CLAUDE_TUTORIEL = "tutoriel.claude";
export const PARAM_PLAFOND_TUTORIEL = "tutoriel.plafondClaudeUsd";
export const PREFIXE_ETAPE_TUTORIEL = "Tutoriel ·";
export const ETAPE_PLAN_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} plan de scènes`;
export const ETAPE_SCRIPT_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} script`;
/** T-EXT-27b : le regard de Claude sur les images-clés de la vidéo finie. ÉTEINT par défaut ; il exige aussi `tutoriel.claude`. */
export const PARAM_REGARD_TUTORIEL = "tutoriel.regardeur";
/** Bâtie sur le préfixe du tutoriel : la dépense compte dans le plafond `tuto`, jamais dans celui des textes de publication. */
export const ETAPE_REGARD_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} Regardeur`;
/** Nombre d'images-clés du regard : celui de l'adaptateur du regardeur (`instantsTutoriel`), jamais plus que le plafond commun. */
export { IMAGES_REGARD_TUTORIEL };

/** Le plafond est arrondi au 0,05 $ supérieur. */
const PAS_PLAFOND_USD = 0.05;
/** Même ratio que `jetonsEstimes` (tarifs) : 1 jeton pour 3 caractères, au pire. */
const CARACTERES_PAR_JETON = 3;

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`… : éteint). */
export async function claudeTutorielActif(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  const l = lire ?? (await import("./_commun")).lireParametre;
  return (await l<unknown>(PARAM_CLAUDE_TUTORIEL, false)) === true;
}

/** Vrai SEULEMENT si `tutoriel.regardeur` ET `tutoriel.claude` valent exactement `true` (absent, `"true"`, `1`, lecture en échec : éteint). */
export async function regardTutorielActif(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    if ((await l<unknown>(PARAM_REGARD_TUTORIEL, false)) !== true) return false;
    return await claudeTutorielActif(l);
  } catch {
    return false;
  }
}

/** Rôle de l'appel (copie locale du modèle `roleRedactionGuide` : la requête du service passée au contrat commun des rôles). */
export function roleDepuisRequete(requete: RequeteClaude, id: "tutoriel-plan" | "tutoriel-script"): DefinitionRole {
  return {
    id,
    version: 1,
    consigne: requete.systeme.map((b) => b.texte).join("\n\n"),
    modele: requete.modele,
    effort: requete.effort,
    maxTokens: requete.maxTokens,
    sansPhrasesFixes: true,
    simuler: () => "",
  };
}

/**
 * Entrée du rôle : le 1er message `user` tel quel ; pour le 2e essai du plan, les messages suivants sont aplatis dans
 * `variable`, la réponse d'avant dans `<reponse_precedente>`, la consigne de reprise dans `<consigne_reprise>`.
 */
export function entreeDepuisRequete(requete: RequeteClaude): EntreeRole {
  const [premier, ...suite] = requete.messages;
  const variable = [premier?.contenu ?? "", ...suite.map((m) => (m.role === "assistant" ? `<reponse_precedente>${m.contenu}</reponse_precedente>` : `<consigne_reprise>${m.contenu}</consigne_reprise>`))].join("\n");
  return { contexte: {}, variable };
}

/** Pire cas, en dollars, d'une requête passée par l'adaptateur. */
function pireCasDe(requete: RequeteClaude, id: "tutoriel-plan" | "tutoriel-script"): number {
  return pireCasRequete(roleDepuisRequete(requete, id), entreeDepuisRequete(requete));
}

/**
 * Plafond par défaut d'une vidéo du tutoriel, en dollars : AUCUN prix recopié, tout vient des vraies requêtes et de la
 * fonction unique du pire cas (`pireCasRequete`). Synchrone. Un script fictif de 55 s et 143 mots, au format 4:5 :
 *   pire cas de la 1re requête du plan + pire cas de la 2e (réponse maximale précédente + reprise) + 1 × le script,
 * arrondi au 0,05 $ supérieur. Le réglage `tutoriel.plafondClaudeUsd` ne peut que le remplacer.
 */
export function plafondTutorielParDefautUsd(): number {
  const nbMots = 143;
  const dureeMs = 55_000;
  const mots: MotMinute[] = Array.from({ length: nbMots }, (_, i) => ({ texte: "exemple", debutMs: Math.round((i * dureeMs) / nbMots), finMs: Math.round(((i + 1) * dureeMs) / nbMots) }));
  const e = { script: mots.map((m) => m.texte).join(" "), mots, format: formatDuRatio("4:5"), facecam: false };
  const reponseMax = "x".repeat(MAX_JETONS_PLAN_SCENES * CARACTERES_PAR_JETON);
  const plan1 = pireCasDe(construireRequetePlan(e), "tutoriel-plan");
  const plan2 = pireCasDe(construireRequetePlan(e, [{ reponse: reponseMax, motif: "ce n'est pas du JSON lisible" }]), "tutoriel-plan");
  const script = pireCasDe(requeteScript("Une idée de tutoriel pour un tableau de bord de suivi des commandes."), "tutoriel-script");
  // T-EXT-27b : un regard au pire (les images-clés du format maître), par la fonction commune.
  const total = plan1 + plan2 + script + coutPireRegardUsd(IMAGES_REGARD_TUTORIEL);
  const pas = Math.ceil(Math.round(total * 1e6) / 1e6 / PAS_PLAFOND_USD);
  return Math.round(pas * 5) / 100;
}

/** Plafond propre `tuto` d'une vidéo du tutoriel : le même objet pour les textes et pour le regard (même forme que les plafonds du tableau animé, conversion de `cas-concret-branchements.ts`). */
export function plafondPropreTutoriel(deps: { plafondUsd?: () => number } = {}): Parameters<typeof executerRolePourVideo>[3]["plafondPropre"] {
  return { id: "tuto", parametre: PARAM_PLAFOND_TUTORIEL, defautUsd: (deps.plafondUsd ?? plafondTutorielParDefautUsd)(), prefixeEtape: PREFIXE_ETAPE_TUTORIEL } as unknown as Parameters<typeof executerRolePourVideo>[3]["plafondPropre"];
}

/** Phrases rendues au moteur quand la garde d'argent arrête l'appel : jamais un montant. */
const PHRASE_ARRET: Record<string, string> = {
  "plafond-video": "La limite de cette vidéo pour l'écriture est atteinte : rien n'a été payé.",
  "en-attente-credit": "Claude est en attente de crédit : rien n'a été payé.",
  "budget-usine": "La limite du mois est atteinte : rien n'a été payé.",
  "bloquee-modele": "Ce modèle n'est pas autorisé pour l'instant : rien n'a été payé.",
  indisponible: "Claude n'est pas disponible pour l'instant : rien n'a été payé.",
};

const JETONS_VIDES: ReponseClaude["jetons"] = { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 };

/**
 * L'appel Claude du tutoriel pour une vidéo : UN appel de `executerRolePourVideo` par requête, avec l'origine de la
 * commande, l'étape « Tutoriel · … » et le plafond propre.
 */
export function appelClaudeTutoriel(videoId: Id, origine: CommandeFabrication["origine"], deps: { executer?: typeof executerRolePourVideo; plafondUsd?: () => number } = {}): AppelClaude {
  return async (requete) => {
    const plan = requete.json === true;
    const id = plan ? "tutoriel-plan" : "tutoriel-script";
    const etape = plan ? ETAPE_PLAN_TUTORIEL : ETAPE_SCRIPT_TUTORIEL;
    const role = roleDepuisRequete(requete, id);
    const entree = entreeDepuisRequete(requete);
    const plafondPropre = plafondPropreTutoriel(deps);
    const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
    const r = await executer(videoId, role, entree, { etape, plafondPropre, origine });
    if (!r.ok) throw new ErreurClaude("requete", PHRASE_ARRET[r.arret] ?? "Claude n'a pas été appelé : rien n'a été payé.");
    if (r.simule || !r.texte?.trim()) throw new ErreurClaude("requete", "Claude n'est pas choisi pour les textes : plan simple.");
    return { texte: r.texte, modeleDemande: requete.modele, modele: r.modele, replis: [], stopReason: r.stopReason ?? null, jetons: r.jetons ?? JETONS_VIDES };
  };
}
