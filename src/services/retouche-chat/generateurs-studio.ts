/**
 * PORTS DU STUDIO POUR LE CHAT DE RETOUCHE DES GÉNÉRATEURS (lot R3) — plan de scènes de départ de chaque générateur,
 * ports de base de R1 (`portsStudio`) complétés par `portsGenerateur`. Le LLM (Opus 5.5) et le rendu des scènes restent
 * NON BRANCHÉS tant que `executerRole` et le service de rendu ne les fournissent pas : lecture simple de la phrase, plan
 * retouché « prêt » sans version. Aucun appel réel ici.
 *  - Version déjà retouchée par chat : son plan (`retoucheChat.plan`).
 *  - Facecam animée : plan gardé dans l'état de la chaîne v4 (lot R2) ; Avocat et Image → vidéo : plan de repli (niveau 1,
 *    pièces du stock) dressé sur les phrases calées de la version, une seule fois (la première retouche l'enregistre).
 */
import "server-only";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { lireEtatV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { depots, lireParametre } from "../_commun";
import { planDuProjet, portsStudio } from "./studio";
import { portsGenerateur, retoucheChatActif, type IdGenerateurRetouche, type RenduPartielGenerateur } from "./generateurs";
import type { PortsRetoucheChat } from "./service";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };

export const retoucheChatActifServeur = (g: IdGenerateurRetouche) => retoucheChatActif(g, (id, defaut) => lireParametre<unknown>(id, defaut));

async function planDeDepart(g: IdGenerateurRetouche, videoId: string, versionId: string): Promise<PlanValide | null> {
  const d = depots();
  if (g === "facecam-animee") {
    const travaux = (await d.travaux.lister((t) => t.cibleId === videoId)) as { creeLe: string; parametres?: Record<string, unknown> }[];
    const dernier = travaux.sort((a, b) => b.creeLe.localeCompare(a.creeLe)).find((t) => lireEtatV4(t.parametres?.facecamAnimeeV4)?.planScenes?.plan);
    const plan = lireEtatV4(dernier?.parametres?.facecamAnimeeV4)?.planScenes?.plan;
    return plan ? validerPlan(plan, { mots: plan.mots, format: plan.format, facecam: plan.facecam, dureeMs: plan.dureeMs }).plan : null;
  }
  const plans = (await d.plans.lister((p) => p.versionId === versionId)).sort((a, b) => a.ordre - b.ordre).filter((p) => p.texte.trim() && p.finSec > p.debutSec);
  if (!plans.length) return null;
  const segments = plans.map((p) => ({ texte: p.texte.trim(), debutMs: Math.round(p.debutSec * 1000), finMs: Math.round(p.finSec * 1000) }));
  const r = await adapterPlan({ generateur: g === "avocat" ? "facecam" : "cas-concret", script: segments.map((s) => s.texte).join(" "), segments, format: FORMAT, facecam: g === "avocat" }, {});
  return r.plan;
}

export function portsGenerateurStudio(g: IdGenerateurRetouche, options: Partial<Pick<PortsRetoucheChat, "appeler">> & { rendu?: Partial<RenduPartielGenerateur> } = {}): PortsRetoucheChat {
  const base = portsStudio(options.appeler ? { appeler: options.appeler } : {});
  return portsGenerateur(
    g,
    {
      ...base,
      lireVersionChoisie: async (videoId) => {
        const deja = await base.lireVersionChoisie(videoId);
        if (deja) return deja;
        const video = await depots().videos.obtenir(videoId);
        const version = video?.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
        if (!version || planDuProjet(version.projetMontage)) return null;
        const plan = await planDeDepart(g, videoId, version.id);
        return plan ? { versionId: version.id, plan } : null;
      },
    },
    options.rendu,
  );
}
