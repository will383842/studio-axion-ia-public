/**
 * HSH-01a · RÉGLAGE DU PLACEMENT DES HASHTAGS (à la fin du texte ou dans le premier commentaire), par réseau, gardé
 * dans le paramètre `hashtags.placement`. Défaut « texte » partout. Les règles sont dans `reseaux/placement-hashtags.ts` (PUR).
 */
import "server-only";
import { PLACEMENT_PAR_DEFAUT, PLACEMENTS, RESEAUX_PLACEMENT, type PlacementHashtags, type ReseauPlacement } from "@/reseaux/placement-hashtags";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

const CLE = "hashtags.placement";
const NOMS: Record<ReseauPlacement, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

/** Placement de chaque réseau (« texte » tant que rien n'est choisi). */
export async function lirePlacements(): Promise<Record<ReseauPlacement, PlacementHashtags>> {
  const gardes = await lireParametre<Partial<Record<ReseauPlacement, PlacementHashtags>>>(CLE, {});
  const out = { ...PLACEMENT_PAR_DEFAUT };
  for (const r of RESEAUX_PLACEMENT) {
    const v = gardes[r];
    if (v && (PLACEMENTS as readonly string[]).includes(v)) out[r] = v;
  }
  return out;
}

/** Enregistre le placement d'un réseau ; une valeur ou un réseau inconnu est refusé avec une phrase claire. */
export async function definirPlacement(reseau: ReseauPlacement, placement: PlacementHashtags): Promise<PlacementHashtags> {
  await exigerSession();
  if (!(RESEAUX_PLACEMENT as readonly string[]).includes(reseau)) throw new ErreurStudio("PLACEMENT_REFUSE", "Ce réseau n'a pas de réglage de placement des hashtags.");
  if (!(PLACEMENTS as readonly string[]).includes(placement)) throw new ErreurStudio("PLACEMENT_REFUSE", "Choisissez « À la fin du texte » ou « Dans le premier commentaire ».");
  const actuels = await lireParametre<Partial<Record<ReseauPlacement, PlacementHashtags>>>(CLE, {});
  await ecrireParametre(CLE, { ...actuels, [reseau]: placement });
  await journaliser("publication", `Placement des hashtags ${NOMS[reseau]} : ${placement === "texte" ? "à la fin du texte" : "dans le premier commentaire"}`);
  return placement;
}
