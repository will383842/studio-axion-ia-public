/**
 * BANDEAU « NOM ET FONCTION » DE L'AVOCAT (C2-U11) : ce qui est figé dans la commande au lancement, derrière le réglage
 * caché `avocat.bandeauNom` (absent = faux ; seul `true` allume). Le nom et la fonction sont ceux que Williams a saisis
 * sur le personnage principal : jamais inventés ni déduits (le titre d'avocat est protégé). Personnage « inventé », sans
 * rôle, ou « reel » sans accord coché : rien.
 */
import "server-only";
import { ENTREE_BANDEAU_NOM } from "@/briques/sous-titres/bandeau-nom";
import { depots, lireParametre } from "./_commun";

export const PARAM_BANDEAU_AVOCAT = "avocat.bandeauNom";
export { ENTREE_BANDEAU_NOM };

export async function entreeBandeauDuLancement(video: { entrees?: unknown; distribution?: { personnageId?: string }[] }): Promise<{ nom: string; fonction: string } | null> {
  if ((await lireParametre<unknown>(PARAM_BANDEAU_AVOCAT, false)) !== true) return null;
  const id = video.distribution?.[0]?.personnageId;
  const p = id ? await depots().personnages.obtenir(id) : undefined;
  if (!p) return null;
  const permis = p.nature === "moi" || (p.nature === "reel" && p.accord?.case === true);
  const nom = p.nom?.trim();
  const fonction = p.role?.trim();
  return permis && nom && fonction ? { nom, fonction } : null;
}
