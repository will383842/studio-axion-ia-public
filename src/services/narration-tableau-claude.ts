/**
 * NARRATION DU TABLEAU DE BORD ÉCRITE PAR CLAUDE (G4-06-b-v20e, décision D4 de Williams du 20/11 : 1,25 € au plus par vidéo
 * pour tous les usages de Claude, dont 0,15 € pour ce texte lu).
 *
 *  - ALLUMÉ PAR DÉFAUT depuis le 20/11, Williams : réglage `tableau.narrationClaude` absent → allumé ; à toute autre
 *    valeur que `true` exact (false, "false", "true", 0, 1, objet…) → éteint (le port rend `null` sans aucun appel et la chaîne garde la narration gratuite à phrases à trous) ;
 *    lecture en échec → éteint (prudence). Le réglage n'est jamais écrit par ce fichier.
 *  - Seul chemin payant : `executerRolePourVideo` (injecté), jamais le client Claude en direct, jamais `fetch`.
 *  - Modèle forcé : `claude-sonnet-5-5`, quel que soit celui de la requête de la brique.
 *  - PLAFOND DUR codé ici, contrôlé AVANT l'appel, indépendant du mode budget indicatif, de `quotaSeul` et du réglage
 *    de plafond (qui ne peut que baisser la limite) : refus sans appel si l'usage dépasse sa part ou si les trois usages
 *    ensemble dépassent 1,25 € pour cette vidéo.
 *  - Tout refus, échec, simulation, réponse illisible ou exception : `null` (la narration gratuite sert). Ne lève jamais.
 *  - Aucun montant n'est rendu à l'écran.
 */
import "server-only";
import { lireNarrationClaude, requeteNarrationClaude, type NarrationClaude } from "@/briques/donnees-video/narration-claude";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { engagePlafondPropreCentimes, executerRolePourVideo } from "./depense-claude-video";

/** Modèle des appels Claude de la vidéo (décision D4) : écrit en dur, jamais pris à la requête. */
export const MODELE_CLAUDE_VIDEO = "claude-sonnet-5-5";
export const PARAM_NARRATION_CLAUDE = "tableau.narrationClaude";
export const PARAM_PLAFOND_NARRATION = "tableau.plafondNarrationUsd";
export const ETAPE_NARRATION = "Tableau de bord · narration";

/** Table figée des plafonds par vidéo, en euros : identique dans les trois fichiers des usages (D4). */
export const PLAFONDS_CLAUDE_VIDEO_EUR = Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const);
export const PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25;
export const PREFIXES_ETAPE_CLAUDE_VIDEO = Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const);

type IdUsage = keyof typeof PLAFONDS_CLAUDE_VIDEO_EUR;
type PlafondPropre = NonNullable<Parameters<typeof executerRolePourVideo>[3]["plafondPropre"]>;
type Lire = <T>(id: string, defaut: T) => Promise<T>;

/** Réglages de plafond proposés (lus seulement par `valeurPlafondPropre`, jamais écrits ici). */
const PARAMETRES_PLAFOND: Record<IdUsage, string> = { dmpln: "demoFacecam.plafondPlanUsd", tbnar: PARAM_PLAFOND_NARRATION, tblec: "tableau.plafondLectureCaptureUsd" };
/** Marge de la réservation, la même que celle d'`executerRolePourVideo`. */
const MARGE = 1.2;

const plafondPropreDe = (id: IdUsage): PlafondPropre => ({ id, parametre: PARAMETRES_PLAFOND[id], defautUsd: PLAFONDS_CLAUDE_VIDEO_EUR[id], prefixeEtape: PREFIXES_ETAPE_CLAUDE_VIDEO[id] }) as unknown as PlafondPropre;

/** Vrai SEULEMENT si la valeur lue est exactement `true`, ou absente (undefined/null) ; tout le reste est éteint
 *  (false, "false", "true", 0, 1, objet…) et une lecture en échec aussi. */
export async function narrationClaudeActive(lire?: Lire): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    const v = await l<unknown>(PARAM_NARRATION_CLAUDE, true);
    return v === true || v === undefined || v === null;
  } catch {
    return false;
  }
}

export interface DepsNarrationClaude {
  executer?: typeof executerRolePourVideo;
  engage?: typeof engagePlafondPropreCentimes;
  /** Taux dollar → euro du Studio (euros pour 1 $). */
  taux?: () => Promise<number>;
  lire?: Lire;
}

/** Limite en centimes de dollar d'une somme en euros, au taux donné. Valeur négative si le taux est inutilisable. */
function limiteCentimes(eur: number, taux: number): number {
  return Number.isFinite(taux) && taux > 0 ? Math.floor(Math.round(eur * 100) / taux) : -1;
}

const valide = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * Le port de narration : donnée du tableau → narration de Claude, ou `null` (la chaîne reprend alors la narration gratuite).
 * UN appel au plus par invocation ; aucun appel si éteint ou si le plafond dur le refuse.
 */
export function portNarrationClaude(videoId: Id, origine: CommandeFabrication["origine"], deps: DepsNarrationClaude = {}): (donnee: TableauDeBord) => Promise<NarrationClaude | null> {
  return async (donnee) => {
    try {
      if (!(await narrationClaudeActive(deps.lire))) return null;
      const requete = requeteNarrationClaude(donnee, MODELE_CLAUDE_VIDEO);
      const role: DefinitionRole = {
        id: "tableau-narration",
        version: 1,
        consigne: requete.systeme.map((b) => b.texte).join("\n\n"),
        modele: MODELE_CLAUDE_VIDEO,
        effort: requete.effort,
        maxTokens: requete.maxTokens,
        sansPhrasesFixes: true,
        simuler: () => "",
      };
      const entree: EntreeRole = { contexte: {}, variable: requete.messages[0]?.contenu ?? "" };

      // Plafond dur, AVANT l'appel : la part de cet usage ET le total des trois usages pour cette vidéo.
      const demande = Math.ceil(pireCasRequete(role, entree) * 100 * MARGE);
      const taux = await (deps.taux ?? (await import("./generation-claude")).taux)();
      const engage = deps.engage ?? (await import("./depense-claude-video")).engagePlafondPropreCentimes;
      const dmpln = await engage(videoId, plafondPropreDe("dmpln"));
      const tbnar = await engage(videoId, plafondPropreDe("tbnar"));
      const tblec = await engage(videoId, plafondPropreDe("tblec"));
      if (!valide(demande) || !valide(dmpln) || !valide(tbnar) || !valide(tblec)) return null;
      if (tbnar + demande > limiteCentimes(PLAFONDS_CLAUDE_VIDEO_EUR.tbnar, taux)) return null;
      if (dmpln + tbnar + tblec + demande > limiteCentimes(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR, taux)) return null;

      const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
      const r = await executer(videoId, role, entree, { etape: ETAPE_NARRATION, plafondPropre: plafondPropreDe("tbnar"), origine });
      if (!r.ok || r.simule || !r.texte?.trim()) return null;
      return lireNarrationClaude(r.texte, donnee);
    } catch {
      return null;
    }
  };
}
