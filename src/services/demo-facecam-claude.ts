/**
 * CLAUDE DU PLAN DE SCÈNES DE LA DÉMO FACE CAMÉRA (G3-10-v20e, décision D4 de Williams du 20/11) : relie un vrai Claude (Sonnet)
 * à `genererPlan`, UNIQUEMENT par le chemin gardé de l'argent (`executerRolePourVideo`, reçu par injection). Aucun appel direct.
 *
 *  - ALLUMÉ PAR DÉFAUT depuis le 20/11 (ALLUMER-PLAN-DEMO-CLAUDE, décision D4) : absent = allumé ; le réglage `demoFacecam.planClaude` à `false` remet le plan simple.
 *  - PLAFOND DUR EN CODE : 0,85 € au plus pour ce plan, 1,25 € au plus pour tous les usages de Claude d'une vidéo ; refusé AVANT
 *    l'appel, quels que soient le mode du budget, le quota seul ou le réglage de plafond (qui ne peut que baisser la limite).
 *  - Refus, échec, simulation, texte vide : `ErreurClaude` sans montant ; `genererPlan` sort alors son plan simple. Jamais d'autre exception.
 */
import "server-only";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { ErreurClaude, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { eurVersUsd } from "@/domaine/credits";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import type { engagePlafondPropreCentimes, executerRolePourVideo } from "./depense-claude-video";

/** Le seul modèle des usages Claude d'une vidéo (décision D4). */
export const MODELE_CLAUDE_VIDEO = "claude-sonnet-5-5";
export const PARAM_PLAN_CLAUDE_DEMO = "demoFacecam.planClaude";
export const PARAM_PLAFOND_PLAN_DEMO = "demoFacecam.plafondPlanUsd";
export const ETAPE_PLAN_DEMO = "Démo · plan de scènes";

/** Table commune des trois usages (plan de scènes, narration du tableau, lecture de capture) : 1,25 € au plus par vidéo. */
export const PLAFONDS_CLAUDE_VIDEO_EUR = Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const);
export const PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25;
export const PREFIXES_ETAPE_CLAUDE_VIDEO = Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const);

type IdUsage = keyof typeof PLAFONDS_CLAUDE_VIDEO_EUR;
type PlafondPropre = NonNullable<Parameters<typeof executerRolePourVideo>[3]["plafondPropre"]>;
const PARAMETRES: Record<IdUsage, string> = { dmpln: PARAM_PLAFOND_PLAN_DEMO, tbnar: "tableau.plafondNarrationUsd", tblec: "tableau.plafondLectureCaptureUsd" };
const MARGE = 1.2;
const JETONS_VIDES: ReponseClaude["jetons"] = { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 };

const plafondPropre = (id: IdUsage): PlafondPropre => ({ id, parametre: PARAMETRES[id], defautUsd: PLAFONDS_CLAUDE_VIDEO_EUR[id], prefixeEtape: PREFIXES_ETAPE_CLAUDE_VIDEO[id] }) as unknown as PlafondPropre;

/** ALLUMÉ par défaut (prix accepté) : vrai seulement si la valeur lue est exactement `true` ou absente (undefined/null) ; tout le reste et une lecture en échec : éteint. */
export async function planClaudeDemoActif(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    const v = await l<unknown>(PARAM_PLAN_CLAUDE_DEMO, true);
    return v === true || v === undefined || v === null;
  } catch {
    return false;
  }
}

/** Rôle de l'appel : la requête du plan, mais le modèle est FORCÉ à Sonnet. */
export function roleDepuisRequetePlanDemo(requete: RequeteClaude): DefinitionRole {
  return {
    id: "demo-plan",
    version: 1,
    consigne: requete.systeme.map((b) => b.texte).join("\n\n"),
    modele: MODELE_CLAUDE_VIDEO,
    effort: requete.effort,
    maxTokens: requete.maxTokens,
    sansPhrasesFixes: true,
    simuler: () => "",
  } as DefinitionRole;
}

/** Entrée du rôle : 1er message tel quel ; au 2e essai, la réponse d'avant et la consigne de reprise sont aplaties dans `variable`. */
export function entreeDepuisRequetePlanDemo(requete: RequeteClaude): EntreeRole {
  const [premier, ...suite] = requete.messages;
  const variable = [premier?.contenu ?? "", ...suite.map((m) => (m.role === "assistant" ? `<reponse_precedente>${m.contenu}</reponse_precedente>` : `<consigne_reprise>${m.contenu}</consigne_reprise>`))].join("\n");
  return { contexte: {}, variable };
}

export interface DependancesPlanDemo {
  executer?: typeof executerRolePourVideo;
  engage?: typeof engagePlafondPropreCentimes;
  taux?: () => Promise<number>;
  /** Lecture de réglage (laissée à l'injection des tests ; le plafond dur ne s'en sert pas). */
  lire?: <T>(id: string, defaut: T) => Promise<T>;
}

/**
 * Plafond dur : vrai si l'appel peut partir. `demande` et les plafonds sont en centimes de dollar ; `engage` = déjà dépensé + réservé.
 * Ne dépend ni du mode indicatif, ni de `quotaSeul`, ni du réglage de plafond.
 */
async function sousLePlafondDur(videoId: Id, demande: number, deps: DependancesPlanDemo): Promise<boolean> {
  const valide = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (!valide(demande)) return false;
  const engage = deps.engage ?? (await import("./depense-claude-video")).engagePlafondPropreCentimes;
  const t = await (deps.taux ?? (await import("./generation-claude")).taux)();
  // Taux inutilisable (NaN, 0, négatif) : limite négative = refus (jamais « 1 € = 1 $ »).
  const limite = (eur: number) => (Number.isFinite(t) && t > 0 ? Math.floor(eurVersUsd(eur * 100, t)) : -1);
  const dmpln = await engage(videoId, plafondPropre("dmpln"));
  if (!valide(dmpln)) return false;
  if (dmpln + demande > limite(PLAFONDS_CLAUDE_VIDEO_EUR.dmpln)) return false;
  const tbnar = await engage(videoId, plafondPropre("tbnar"));
  const tblec = await engage(videoId, plafondPropre("tblec"));
  if (!valide(tbnar) || !valide(tblec)) return false;
  return dmpln + tbnar + tblec + demande <= limite(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR);
}

/** L'appel Claude du plan de scènes pour une vidéo : UN appel de `executerRolePourVideo` par requête, après le plafond dur. */
export function appelClaudePlanDemo(videoId: Id, origine: CommandeFabrication["origine"], deps: DependancesPlanDemo = {}): AppelClaude {
  return async (requete) => {
    const role = roleDepuisRequetePlanDemo(requete);
    const entree = entreeDepuisRequetePlanDemo(requete);
    const demande = Math.ceil(pireCasRequete(role, entree) * 100 * MARGE);
    if (!(await sousLePlafondDur(videoId, demande, deps))) throw new ErreurClaude("requete", "La limite de cette vidéo pour la composition par l'IA est atteinte : plan simple, rien n'a été payé.");
    const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
    let r: Awaited<ReturnType<typeof executerRolePourVideo>>;
    try {
      r = await executer(videoId, role, entree, { etape: ETAPE_PLAN_DEMO, plafondPropre: plafondPropre("dmpln"), origine });
    } catch {
      throw new ErreurClaude("requete", "Claude n'est pas disponible pour l'instant : plan simple.");
    }
    if (!r.ok) throw new ErreurClaude("requete", "Claude n'a pas été appelé : plan simple, rien n'a été payé.");
    if (r.simule || !r.texte?.trim()) throw new ErreurClaude("requete", "Claude n'est pas choisi pour les textes : plan simple.");
    return { texte: r.texte, modeleDemande: requete.modele, modele: r.modele, replis: [], stopReason: r.stopReason ?? null, jetons: r.jetons ?? JETONS_VIDES };
  };
}
