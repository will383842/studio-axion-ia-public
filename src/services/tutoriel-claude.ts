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
import { formatDuRatio } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { entreesPireCasEquipe, ROLES_APPELES, ROLES_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { entreeMaquettiste, roleMaquettiste, type ContexteMaquettiste, type ManqueMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { PROPOSITIONS_PIECE_MAX } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PHRASE_DEPOT_MAX } from "@/moteurs/montage-tutoriel-outil/entrees";
import type { CommandeFabrication, Id } from "@/domaine/types";
import type { executerRolePourVideo } from "./depense-claude-video";

export const PARAM_CLAUDE_TUTORIEL = "tutoriel.claude";
export const PARAM_PLAFOND_TUTORIEL = "tutoriel.plafondClaudeUsd";
export const PREFIXE_ETAPE_TUTORIEL = "Tutoriel ·";
export const ETAPE_PLAN_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} plan de scènes`;
export const ETAPE_SCRIPT_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} script`;
/** T-EXT-53b : la lecture d'une demande de retouche. Bâtie sur le préfixe : la dépense compte dans le plafond `tuto` déjà fixé par vidéo (aucun plafond propre). */
export const ETAPE_LECTURE_RETOUCHE_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} lecture de retouche`;
/** T-EXT-53b : ÉTEINT par défaut ; exige aussi `tutoriel.claude`. */
export const PARAM_LECTEUR_CLAUDE_RETOUCHE = "retoucheChat.tutorielLecteurClaude";
/** T-EXT-27b : le regard de Claude sur les images-clés de la vidéo finie. ÉTEINT par défaut ; il exige aussi `tutoriel.claude`. */
export const PARAM_REGARD_TUTORIEL = "tutoriel.regardeur";
/** Bâtie sur le préfixe du tutoriel : la dépense compte dans le plafond `tuto`, jamais dans celui des textes de publication. */
export const ETAPE_REGARD_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} Regardeur`;
/** Nombre d'images-clés du regard : celui de l'adaptateur du regardeur (`instantsTutoriel`), jamais plus que le plafond commun. */
export { IMAGES_REGARD_TUTORIEL };

/** V2-07 : l'étape de la création d'une maquette ou d'un flux depuis une phrase (même libellé que la ligne « Tutoriel · <rôle> » de l'équipe). */
export const ETAPE_PIECE_TUTORIEL = `${PREFIXE_ETAPE_TUTORIEL} maquettiste`;

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

/** T-EXT-53b : vrai SEULEMENT si `retoucheChat.tutorielLecteurClaude` ET `tutoriel.claude` valent exactement `true` (absent, `"true"`, `1`, lecture en échec : éteint). */
export async function lecteurClaudeTutorielActif(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    if ((await l<unknown>(PARAM_LECTEUR_CLAUDE_RETOUCHE, false)) !== true) return false;
    return await claudeTutorielActif(l);
  } catch {
    return false;
  }
}

/** Rôle de l'appel (copie locale du modèle `roleRedactionGuide` : la requête du service passée au contrat commun des rôles). */
export function roleDepuisRequete(requete: RequeteClaude, id: "tutoriel-plan" | "tutoriel-script" | "tutoriel-retouche"): DefinitionRole {
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
function pireCasDe(requete: RequeteClaude, id: "tutoriel-plan" | "tutoriel-script" | "tutoriel-retouche"): number {
  return pireCasRequete(roleDepuisRequete(requete, id), entreeDepuisRequete(requete));
}

/**
 * Détail du plafond par défaut, en dollars : le plan de scènes (2 requêtes), CHAQUE rôle de l'équipe × ses essais
 * (`ROLES_TUTORIEL`), le regard. Aucun prix recopié. Le script ×1 de l'ancienne consigne (`requeteScript`, retirée) sort du calcul.
 */
export function detailPlafondTutorielUsd(): { plan: number; roles: Record<string, number>; regard: number; total: number } {
  const nbMots = 143;
  const dureeMs = 55_000;
  const mots: MotMinute[] = Array.from({ length: nbMots }, (_, i) => ({ texte: "exemple", debutMs: Math.round((i * dureeMs) / nbMots), finMs: Math.round(((i + 1) * dureeMs) / nbMots) }));
  const e = { script: mots.map((m) => m.texte).join(" "), mots, format: formatDuRatio("4:5"), facecam: false };
  const reponseMax = "x".repeat(MAX_JETONS_PLAN_SCENES * CARACTERES_PAR_JETON);
  const plan = pireCasDe(construireRequetePlan(e), "tutoriel-plan") + pireCasDe(construireRequetePlan(e, [{ reponse: reponseMax, motif: "ce n'est pas du JSON lisible" }]), "tutoriel-plan");
  const pires: Record<string, EntreeRole | undefined> = entreesPireCasEquipe();
  const roles: Record<string, number> = {};
  for (const r of ROLES_TUTORIEL) {
    const role = ROLES_APPELES[r.id];
    const entree = pires[r.id];
    if (role && entree && r.essaisMax > 0) roles[r.id] = pireCasRequete(role, entree) * r.essaisMax;
  }
  // T-EXT-27b : un regard au pire (les images-clés du format maître), par la fonction commune.
  const regard = coutPireRegardUsd(IMAGES_REGARD_TUTORIEL);
  return { plan, roles, regard, total: plan + Object.values(roles).reduce((s, v) => s + v, 0) + regard };
}

/**
 * Plafond par défaut d'une vidéo du tutoriel, en dollars : AUCUN prix recopié, tout vient des vraies requêtes et de la
 * fonction unique du pire cas (`pireCasRequete`). Synchrone. Plan de scènes (2 requêtes, script fictif de 55 s et 143 mots, 4:5)
 * + chaque rôle de l'équipe × ses essais + un regard, arrondi au 0,05 $ supérieur. Le réglage `tutoriel.plafondClaudeUsd`
 * ne peut que le remplacer.
 */
export function plafondTutorielParDefautUsd(): number {
  const pas = Math.ceil(Math.round(detailPlafondTutorielUsd().total * 1e6) / 1e6 / PAS_PLAFOND_USD);
  return Math.round(pas * 5) / 100;
}

/**
 * V2-07 : pire cas, en dollars, de la création d'une maquette ou d'un flux depuis une phrase : au plus `PROPOSITIONS_PIECE_MAX`
 * propositions (la première, puis une seule « autre proposition » demandée ; aucune reprise automatique), chacune au pire des
 * deux genres, pour la demande la plus longue du formulaire. Aucun prix recopié : tout vient de `pireCasRequete`.
 */
export function coutPirePieceCreeeUsd(): number {
  const contexte: ContexteMaquettiste = { metier: "x".repeat(40), carteZones: [], interdits: [], demande: "x".repeat(PHRASE_DEPOT_MAX), proposition: 2 };
  const role = roleMaquettiste as unknown as DefinitionRole;
  const maquette = pireCasRequete(role, entreeMaquettiste("maquette", contexte));
  // en attendant T-EXT-25b : le manque « flux-automatisation » n'existe pas encore dans `MANQUES_MAQUETTISTE` ; même entrée, même plafond de réponse.
  const flux = pireCasRequete(role, entreeMaquettiste("flux-automatisation" as ManqueMaquettiste, contexte));
  return PROPOSITIONS_PIECE_MAX * Math.max(maquette, flux);
}

let plafondPhraseJournalise = false;

/**
 * V2-07 : plafond par défaut d'une vidéo partie d'UNE PHRASE, en dollars : le plafond d'un dossier, sans la part du maquettiste
 * déjà comptée une fois par `detailPlafondTutorielUsd` (jamais deux fois), plus la création au pire. Arrondi au 0,05 $ supérieur.
 * `plafondTutorielParDefautUsd` (un dossier) reste inchangée. Le réglage `tutoriel.plafondClaudeUsd` remplace toujours le plafond.
 * Le détail est écrit une fois au journal technique, jamais à l'écran.
 */
export function plafondTutorielPhraseUsd(): number {
  const detail = detailPlafondTutorielUsd();
  const defaut = plafondTutorielParDefautUsd();
  const creation = coutPirePieceCreeeUsd();
  const pas = Math.ceil(Math.round((detail.total - (detail.roles.maquettiste ?? 0) + creation) * 1e6) / 1e6 / PAS_PLAFOND_USD);
  const total = Math.round(pas * 5) / 100;
  if (!plafondPhraseJournalise) {
    plafondPhraseJournalise = true;
    console.info(`Plafond tutoriel depuis une phrase : défaut ${defaut} $, création ${creation.toFixed(4)} $ (${PROPOSITIONS_PIECE_MAX} propositions au pire), total ${total} $`);
  }
  return total;
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
export function appelClaudeTutoriel(videoId: Id, origine: CommandeFabrication["origine"], deps: { executer?: typeof executerRolePourVideo; plafondUsd?: () => number; etape?: string; id?: "tutoriel-retouche" } = {}): AppelClaude {
  return async (requete) => {
    const plan = requete.json === true;
    // T-EXT-53b : sans `etape`, exactement le choix d'avant (plan / script) ; avec, l'appel porte l'étape demandée.
    const id = deps.id ?? (plan ? "tutoriel-plan" : "tutoriel-script");
    const etape = deps.etape ?? (plan ? ETAPE_PLAN_TUTORIEL : ETAPE_SCRIPT_TUTORIEL);
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

/**
 * T-EXT-53b : l'appel du LECTEUR de demande du chat de retouche pour une vidéo du tutoriel. Origine lue sur la commande de la
 * version choisie (injectable). Vidéo ou version introuvable : un appel qui lève (comme `appelNonBranche`), jamais d'appel Claude.
 * Même chemin gardé que le plan, même plafond `tuto` déjà fixé par vidéo : aucun plafond propre, aucun montant. BRANCHÉ NULLE PART en 53b.
 */
export async function appelLecteurTutoriel(videoId: Id, deps: { origine?: (videoId: Id) => Promise<CommandeFabrication["origine"] | null | undefined>; executer?: typeof executerRolePourVideo; plafondUsd?: () => number } = {}): Promise<AppelClaude> {
  let origine: CommandeFabrication["origine"] | null | undefined = null;
  let trouvee = false;
  try {
    if (deps.origine) {
      origine = await deps.origine(videoId);
      trouvee = origine !== null;
    } else {
      const { depots } = await import("./_commun");
      const video = await depots().videos.obtenir(videoId);
      const version = video?.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
      trouvee = !!version;
      origine = version?.commande?.origine;
    }
  } catch {
    trouvee = false;
  }
  if (!trouvee) {
    return async () => {
      throw new ErreurClaude("requete", "La lecture de cette demande n'est pas disponible pour cette vidéo.");
    };
  }
  return appelClaudeTutoriel(videoId, origine ?? undefined, { etape: ETAPE_LECTURE_RETOUCHE_TUTORIEL, id: "tutoriel-retouche", ...(deps.executer ? { executer: deps.executer } : {}), ...(deps.plafondUsd ? { plafondUsd: deps.plafondUsd } : {}) });
}
