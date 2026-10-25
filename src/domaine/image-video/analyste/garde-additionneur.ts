/**
 * IMAGE → VIDÉO · Garde aval « additionneur » (lot R3). PUR.
 *
 * Un calcul faux ne doit jamais finir en scène « additionneur » (les minutes qui s'additionnent, avec un total affiché).
 * Cette garde vit ici, hors de `regles.ts` (recouvert sur le serveur) : le lot R5 l'appellera au choix de la scène.
 * Sans calcul faux, la scène est rendue telle quelle ; sinon elle retombe sur `SCENE_DE_REPLI` (rien n'est inventé).
 */
import type { CarteImage } from "../carte";
import { analyserRealisme, calculsFauxDeTexte } from "./realisme";

export const SCENE_DE_REPLI = "toile" as const;

/** Vrai si la carte (ou l'un des textes donnés, par exemple ceux de la scène) porte un calcul faux. */
export function contientCalculFaux(carte: CarteImage | null | undefined, textes: readonly string[] = []): boolean {
  if (textes.some((t) => calculsFauxDeTexte(t).length > 0)) return true;
  return !!carte && analyserRealisme(carte).problemes.some((p) => p.code === "calcul-faux");
}

/** Vrai si la carte a un entonnoir dont les étapes augmentent (jamais réparé : la scène « entonnoir » serait fausse). */
export function contientEntonnoirCroissant(carte: CarteImage | null | undefined): boolean {
  return !!carte && analyserRealisme(carte).problemes.some((p) => p.code === "entonnoir-croissant");
}

/**
 * Renvoie la scène demandée, sauf « additionneur » avec un calcul faux, ou « entonnoir » dont les étapes augmentent :
 * alors la scène de repli.
 */
export function sceneApresGarde<S extends string>(scene: S, carte: CarteImage | null | undefined, textes: readonly string[] = []): S | typeof SCENE_DE_REPLI {
  if (scene === "additionneur" && contientCalculFaux(carte, textes)) return SCENE_DE_REPLI;
  if (scene === "entonnoir" && contientEntonnoirCroissant(carte)) return SCENE_DE_REPLI;
  return scene;
}
