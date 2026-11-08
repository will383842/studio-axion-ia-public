/**
 * SERVICE DU CHAT DE RETOUCHE (lot R1) — aperçu, application (rendu PARTIEL), retour arrière. Tout passe par des PORTS
 * injectés (`PortsRetoucheChat`) : LLM, lecture de la version choisie, rendu des seules scènes touchées, enregistrement
 * d'une nouvelle version, choix de version. Les ports du studio sont dans `./studio` ; les tests passent des doubles.
 *  - `apercevoirRetouche` : comprend la phrase, applique sur une COPIE du plan, dit l'impact ; n'écrit rien, ne rend rien.
 *  - `appliquerRetouche` : relit les opérations reçues (liste fermée, Zod), réapplique sur le plan de la version
 *    choisie, ne re-rend que les scènes touchées, enregistre une nouvelle version (parent = version d'avant) et la choisit.
 *    Aucune scène touchée : rien n'est fait. Rendu non branché pour ce générateur : le plan retouché est rendu prêt.
 *  - `revenirAVersion` : retour arrière, par le choix de version existant (`choisirVersion`).
 * Aucun prix, aucun refus : les remarques disent ce qui n'a pas pu être fait.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerOperations, type RemarqueRetouche } from "./appliquer";
import { comprendreDemande } from "./comprendre";
import { impactRetouche, type ImpactRetouche } from "./impact";
import { lireOperations } from "./schema";

export interface EntreeRenduPartiel {
  videoId: string;
  parentVersionId: string;
  /** Plan complet retouché. */
  plan: PlanValide;
  /** Seules ces scènes sont re-rendues ; les autres sont reprises de la version d'avant. */
  scenes: string[];
  /** Voix à refaire (seulement après « modifie le script »). */
  voix: boolean;
}

export interface SortieRenduPartiel {
  fichierCle: string;
  dureeSec: number;
}

export interface PortsRetoucheChat {
  appeler: AppelClaude;
  lireVersionChoisie: (videoId: string) => Promise<{ versionId: string; plan: PlanValide } | null>;
  /** Rendu partiel du générateur ; absent : pas encore branché pour ce générateur. */
  rendreScenes?: (e: EntreeRenduPartiel) => Promise<SortieRenduPartiel>;
  enregistrerVersion: (e: { videoId: string; parentVersionId: string; plan: PlanValide; demande: string; operations: OperationRetouche[]; impact: ImpactRetouche; rendu: SortieRenduPartiel }) => Promise<{ versionId: string }>;
  choisirVersion: (videoId: string, versionId: string) => Promise<void>;
}

export interface ApercuRetouche {
  demande: string;
  operations: OperationRetouche[];
  impact: ImpactRetouche;
  remarques: string[];
}

export type IssueRetoucheChat =
  | { statut: "rendue"; versionId: string; impact: ImpactRetouche; remarques: string[] }
  | { statut: "plan-pret"; plan: PlanValide; impact: ImpactRetouche; remarques: string[] }
  | { statut: "inchangee"; impact: ImpactRetouche | null; remarques: string[] };

export const PHRASE_SANS_PLAN = "Cette vidéo n'a pas de plan de scènes : la retouche par chat n'est pas encore possible pour elle.";
export const PHRASE_RENDU_NON_BRANCHE = "Le plan retouché est prêt ; son rendu se branchera avec le générateur de cette vidéo.";

const texteRemarques = (r: readonly RemarqueRetouche[]) => r.filter((m) => m.code === "OPERATION_IGNOREE" || m.code === "MINUTAGE_A_REFAIRE" || m.code === "REPLI_NIVEAU_1" || m.code === "PARAMETRES_REPARES").map((m) => m.message);

export async function apercevoirRetouche(videoId: string, demande: string, ports: PortsRetoucheChat): Promise<ApercuRetouche> {
  const courante = await ports.lireVersionChoisie(videoId);
  const vide: ImpactRetouche = { scenes: [], total: 0, voixTouchee: false, phrase: "Aucune scène ne change, la voix ne change pas." };
  if (!courante) return { demande, operations: [], impact: vide, remarques: [PHRASE_SANS_PLAN] };
  const c = await comprendreDemande({ phrase: demande, plan: courante.plan }, ports.appeler);
  const a = appliquerOperations(courante.plan, c.operations);
  return { demande, operations: a.operations, impact: impactRetouche(courante.plan, a.plan, a.operations), remarques: [...c.remarques, ...texteRemarques(a.remarques)] };
}

export async function appliquerRetouche(videoId: string, e: { demande: string; operations: unknown }, ports: PortsRetoucheChat): Promise<IssueRetoucheChat> {
  const courante = await ports.lireVersionChoisie(videoId);
  if (!courante) return { statut: "inchangee", impact: null, remarques: [PHRASE_SANS_PLAN] };
  // Les opérations viennent du navigateur : relues comme celles du LLM (liste fermée, jamais de code).
  const lu = lireOperations(e.operations);
  const a = appliquerOperations(courante.plan, lu.operations);
  const impact = impactRetouche(courante.plan, a.plan, a.operations);
  const remarques = [...lu.remarques, ...texteRemarques(a.remarques)];
  if (!impact.scenes.length && !impact.voixTouchee) return { statut: "inchangee", impact, remarques: [...remarques, impact.phrase] };
  if (!ports.rendreScenes) return { statut: "plan-pret", plan: a.plan, impact, remarques: [...remarques, PHRASE_RENDU_NON_BRANCHE] };
  const rendu = await ports.rendreScenes({ videoId, parentVersionId: courante.versionId, plan: a.plan, scenes: impact.scenes, voix: impact.voixTouchee });
  const { versionId } = await ports.enregistrerVersion({ videoId, parentVersionId: courante.versionId, plan: a.plan, demande: e.demande.trim(), operations: a.operations, impact, rendu });
  await ports.choisirVersion(videoId, versionId);
  return { statut: "rendue", versionId, impact, remarques };
}

/** Retour arrière : la version d'avant redevient la version choisie (rien n'est effacé). */
export async function revenirAVersion(videoId: string, versionId: string, ports: Pick<PortsRetoucheChat, "choisirVersion">): Promise<void> {
  await ports.choisirVersion(videoId, versionId);
}
