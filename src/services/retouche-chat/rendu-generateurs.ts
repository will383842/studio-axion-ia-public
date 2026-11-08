/**
 * BRANCHEMENT DU CHAT DE RETOUCHE SUR « TUTORIEL D'OUTIL » ET « DÉMO FACECAM » (lot R4) — AJOUT seul au socle R1.
 * `creerRendreScenes` fabrique le port `rendreScenes` : re-rend les seules scènes touchées, puis ne ré-exporte QUE les
 * formats dont l'empreinte change (`briques/export-partiel`). Rendu, export et lecture du plan d'avant sont injectés :
 * des doubles dans les tests, aucun appel réel ici. Le branchement réel (Remotion, R2) se fait au moment de l'usage.
 */
import { exportsARefaire, type CibleExport } from "@/briques/export-partiel";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { EntreeRenduPartiel, PortsRetoucheChat, SortieRenduPartiel } from "./service";

export const CIBLES_TUTORIEL: readonly CibleExport[] = [
  { id: "4:5", format: "4:5" },
  { id: "9:16", format: "9:16" },
  { id: "1:1", format: "1:1" },
];
export const CIBLES_DEMO_FACECAM: readonly CibleExport[] = [{ id: "9:16", format: "9:16" }];

export function ciblesDuFormat(formatId: string): readonly CibleExport[] | null {
  if (formatId === "tutoriel-outil") return CIBLES_TUTORIEL;
  if (formatId === "demo-facecam") return CIBLES_DEMO_FACECAM;
  return null;
}

export interface PortsRenduGenerateur {
  /** Plan de la version d'avant (null : introuvable, tout est refait). */
  lirePlan: (versionId: string) => Promise<PlanValide | null>;
  rendreScene: (e: EntreeRenduPartiel) => Promise<SortieRenduPartiel>;
  exporter: (e: { videoId: string; plan: PlanValide; cible: CibleExport }) => Promise<string>;
}

export type SortieRenduExports = SortieRenduPartiel & { exports: { refaits: string[]; gardes: string[]; fichiers: Record<string, string>; phrase: string } };

export function creerRendreScenes(cibles: readonly CibleExport[], ports: PortsRenduGenerateur): NonNullable<PortsRetoucheChat["rendreScenes"]> {
  return async (e) => {
    const rendu = await ports.rendreScene(e);
    const avant = await ports.lirePlan(e.parentVersionId);
    // Voix refaite : tous les formats changent ; sinon seuls ceux dont l'empreinte change.
    const sortie = avant ? exportsARefaire(avant, e.plan, cibles, e.voix ? { voix: "refaite" } : {}) : { aRefaire: cibles.map((c) => c.id), gardes: [], phrase: "Tous les formats seront refaits." };
    const fichiers: Record<string, string> = {};
    for (const c of cibles.filter((x) => sortie.aRefaire.includes(x.id))) fichiers[c.id] = await ports.exporter({ videoId: e.videoId, plan: e.plan, cible: c });
    const resultat: SortieRenduExports = { ...rendu, exports: { refaits: sortie.aRefaire, gardes: sortie.gardes, fichiers, phrase: sortie.phrase } };
    return resultat;
  };
}
