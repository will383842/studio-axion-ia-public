"use server";

/**
 * Actions serveur de l'écran « Face caméra animée » (Lot I). Même modèle que les autres écrans : un Resultat sérialisable,
 * la session vérifiée par le service.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { estimerFacecamAnimee, type EstimationFA, type PriseAEstimerFA, deposerFacecamAnimee, deposerFacecamAnimeeLot, scriptsValidesFacecamAnimee, texteDuScriptValideFA, type ScriptValideFA, type DemandeDepotFA, type IssueDepotFA, type IssueLotFA } from "@/services/facecam-animee";

/** « Animer ma vidéo » : la prise déposée, le texte dit (facultatif), l'accord d'essai. */
export async function deposerFacecamAnimeeAction(demande: DemandeDepotFA): Promise<Resultat<IssueDepotFA>> {
  const r = await essayer(() => deposerFacecamAnimee(demande));
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/videos");
  return r;
}

/** « Animer mes N vidéos » : une vidéo par prise, toutes mises dans la file de fabrication du studio. */
export async function deposerFacecamAnimeeLotAction(demandes: DemandeDepotFA[]): Promise<Resultat<{ issues: IssueLotFA[]; phraseSautees?: string }>> {
  const r = await essayer(() => deposerFacecamAnimeeLot(demandes));
  if (r.ok && r.donnees.issues.some((i) => i.statut === "lancee")) {
    revalidatePath("/videos");
    revalidatePath("/formats/facecam-animee");
  }
  return r;
}

/** « Reprendre un script validé » : la liste des scripts validés du format (lecture seule). */
export async function scriptsValidesFacecamAnimeeAction(): Promise<Resultat<ScriptValideFA[]>> {
  return essayer(() => scriptsValidesFacecamAnimee());
}

/** Le texte du script choisi, à poser dans « Ce que vous dites ». */
export async function texteDuScriptValideFAAction(id: string): Promise<Resultat<{ texte: string; tronque: boolean }>> {
  return essayer(() => texteDuScriptValideFA(id));
}

/** Estimation honnête (pire cas, plafond) affichée avant « Animer ma vidéo ». Lecture seule. */
export async function estimerFacecamAnimeeAction(prises: PriseAEstimerFA[]): Promise<Resultat<EstimationFA>> {
  return essayer(() => estimerFacecamAnimee(prises));
}
