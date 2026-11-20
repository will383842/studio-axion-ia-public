import "server-only";
/**
 * RAP-3 · « Retirer du calendrier » une publication rapatriée : geste LOCAL. Il pose `retireeLe` et rien d'autre : la ligne, son texte et
 * son statut restent, et RIEN n'est demandé au diffuseur (le post reste programmé chez lui). Aucune dépendance au client du diffuseur.
 */
import { estRapatriee, type Publication } from "@/domaine/types";

export type ResultatRetraitRapatriee = { ok: true; message: string } | { ok: false; etat: "introuvable" | "pas-rapatriee" | "deja-fait" | "publiee"; message: string };

export interface DepsRetraitRapatriee {
  publication(id: string): Promise<Publication | null>;
  ecrire(id: string, modif: Partial<Publication>): Promise<void>;
  maintenant(): string;
}

export const MESSAGE_RETRAIT_LOCAL = "C'est fait : ce post n'est plus au calendrier du Studio. Il reste programmé chez le diffuseur.";

export async function retirerRapatrieeDuCalendrier(d: DepsRetraitRapatriee, id: string): Promise<ResultatRetraitRapatriee> {
  const p = await d.publication(id);
  if (!p) return { ok: false, etat: "introuvable", message: "Cette publication est introuvable. Rechargez la page." };
  if (!estRapatriee(p)) return { ok: false, etat: "pas-rapatriee", message: "Seule une publication reprise du diffuseur se retire d'ici." };
  if (p.retireeLe) return { ok: false, etat: "deja-fait", message: "Ce post est déjà retiré du calendrier." };
  if (p.statut === "publiee") return { ok: false, etat: "publiee", message: "Ce post est déjà publié : il reste dans l'historique." };
  const maintenant = d.maintenant();
  await d.ecrire(id, { retireeLe: maintenant, modifieLe: maintenant });
  return { ok: true, message: MESSAGE_RETRAIT_LOCAL };
}
