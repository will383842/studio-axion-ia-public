/**
 * N-26-c1 — « Appliquer » pour la démo face caméra : plan retouché (comme `appliquerRetouche` SANS rendu), puis lancement
 * INJECTÉ. Le chat n'écrit jamais de version (c'est `creerRetouche` qui l'écrit). Pur : rien lu, rien importé de lancer-demo.
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { ImpactRetouche } from "./impact";
import { appliquerRetouche, PHRASE_RENDU_NON_BRANCHE, type IssueRetoucheChat, type PortsRetoucheChat } from "./service";

export type LancerDemo = (d: { videoId: string; versionId: string; plan: PlanValide; consigne: string }) => Promise<{ statut: "lancee"; travailId: string } | { statut: "plan-pret"; raison: string }>;

export type IssueRetoucheDemo = IssueRetoucheChat | { statut: "lancee"; travailId: string; impact: ImpactRetouche; remarques: string[] };

export const PHRASE_RETOUCHE_LANCEE = "La retouche est lancée : la nouvelle version arrive dans quelques minutes.";
const PHRASE_ECHEC = "La retouche n'a pas pu être lancée : le plan reste prêt.";

export async function appliquerRetoucheDemo(videoId: string, e: { demande: string; operations: unknown }, ports: PortsRetoucheChat, lancer: LancerDemo): Promise<IssueRetoucheDemo> {
  // Rendu RETIRÉ : jamais enregistrerVersion ni choisirVersion par ce chemin, même si un port de rendu est donné.
  const base = await appliquerRetouche(videoId, e, { ...ports, rendreScenes: undefined });
  if (base.statut !== "plan-pret" || base.impact.voixTouchee) return base;
  const courante = await ports.lireVersionChoisie(videoId);
  if (!courante) return base;
  const remarques = base.remarques.filter((m) => m !== PHRASE_RENDU_NON_BRANCHE);
  let r: Awaited<ReturnType<LancerDemo>>;
  try {
    r = await lancer({ videoId, versionId: courante.versionId, plan: base.plan, consigne: e.demande.trim().slice(0, 500) });
  } catch {
    return { ...base, remarques: [...remarques, PHRASE_ECHEC] };
  }
  if (r.statut === "lancee") return { statut: "lancee", travailId: r.travailId, impact: base.impact, remarques: [...remarques, PHRASE_RETOUCHE_LANCEE] };
  return { ...base, remarques: [...remarques, r.raison] };
}
