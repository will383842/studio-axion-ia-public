/**
 * PORTS DU STUDIO POUR LE CHAT DE RETOUCHE (lot R1) — lecture du plan de la version choisie, nouvelle version (parent =
 * version d'avant, numéro suivant), choix de version par `choisirVersion` (retour arrière compris).
 * NON BRANCHÉ par défaut : le LLM (Opus 5.5) se branchera par `executerRole` / `services/generation-claude.ts` (pré-vol
 * et crédits, garde de `tests/v4-argent.test.ts`) et le rendu partiel par chaque générateur (lot R2). Tant qu'ils ne
 * sont pas fournis, la phrase est lue simplement et le plan retouché est rendu « prêt » sans version.
 */
import "server-only";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { ErreurClaude } from "@/fournisseurs/claude/client";
import { nouvelId } from "@/lib/ids";
import { depots, horodatage } from "../_commun";
import { choisirVersion } from "../videos";
import type { PortsRetoucheChat } from "./service";

/** Le plan de scènes d'une version : celui d'une retouche par chat, sinon celui du générateur (tutoriel, démo facecam). */
export function planDuProjet(projetMontage: Record<string, unknown> | undefined): PlanValide | null {
  const p = projetMontage as { retoucheChat?: { plan?: unknown }; tutoriel?: { plan?: { plan?: unknown } }; reprise?: { plan?: unknown } } | undefined;
  const brut = p?.retoucheChat?.plan ?? p?.tutoriel?.plan?.plan ?? p?.reprise?.plan;
  if (!brut || typeof brut !== "object" || !Array.isArray((brut as { scenes?: unknown }).scenes)) return null;
  const b = brut as PlanValide;
  return validerPlan(b, { mots: b.mots, format: b.format, facecam: b.facecam, dureeMs: b.dureeMs }).plan;
}

/** LLM non branché : `comprendreDemande` passe à la lecture simple (aucun appel réel). */
export const appelNonBranche: AppelClaude = async () => {
  throw new ErreurClaude("requete", "LLM du chat de retouche non branché");
};

export function portsStudio(options: Partial<Pick<PortsRetoucheChat, "appeler" | "rendreScenes">> = {}): PortsRetoucheChat {
  return {
    appeler: options.appeler ?? appelNonBranche,
    ...(options.rendreScenes ? { rendreScenes: options.rendreScenes } : {}),
    lireVersionChoisie: async (videoId) => {
      const d = depots();
      const video = await d.videos.obtenir(videoId);
      const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
      const plan = version ? planDuProjet(version.projetMontage) : null;
      return version && plan ? { versionId: version.id, plan } : null;
    },
    enregistrerVersion: async (e) => {
      const d = depots();
      const parent = await d.versions.obtenir(e.parentVersionId);
      if (!parent) throw new Error("Version d'avant introuvable.");
      const { prochainNumero } = await import("../fabrication");
      const versionId = nouvelId("ver");
      await d.versions.enregistrer({
        id: versionId,
        videoId: e.videoId,
        numero: await prochainNumero(e.videoId),
        parentVersionId: parent.id,
        commande: parent.commande,
        statut: "prete",
        choisie: false,
        noteRetouche: e.demande.slice(0, 500),
        projetMontage: { ...(parent.projetMontage ?? {}), retoucheChat: { plan: e.plan, demande: e.demande, operations: e.operations, scenesRefaites: e.impact.scenes, voixRefaite: e.impact.voixTouchee, rendu: e.rendu } },
        ...horodatage(),
        ...(parent.estDemo ? { estDemo: true } : {}),
      });
      return { versionId };
    },
    choisirVersion: (videoId, versionId) => choisirVersion(videoId, versionId),
  };
}
