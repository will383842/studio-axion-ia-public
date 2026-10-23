/**
 * Axe « matière » de la variété (lot APP-MAT) : la texture du dessin, DANS la charte (mêmes couleurs, mêmes polices).
 *  - MAT-A (référence) : net et plat (rendu d'aujourd'hui) ;
 *  - MAT-B : papier (grain dans le fond, cartes posées dessus) ;
 *  - MAT-C : trait fait main (contours tremblés, ombres en hachures) ;
 *  - MAT-D : profondeur douce (cartes avec une tranche, posées sur des plateaux en relief).
 * La matière est un CALQUE (`variete/matiere/calque.tsx`) autour de toutes les scènes dessinées par l'IV (toile, objets,
 * moments, écrans de variété) ; la toile la prolonge dans ses cartes (`Noeud.tsx`) et ses fils (`Toile.tsx`). Les écrans empruntés au
 * cas concret ne la reçoivent pas (composition interdite en écriture). Chaque bloc concerné reçoit
 * `variete.donnees.matiere` = `{ code }`.
 */
import { tirablesDe, type CodesParAxe, type FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

export interface DonneesMatiereIV {
  code: CodesParAxe["matiere"];
}

/** Les sortes de blocs enveloppées par l'habillage de variété (`Compositions.tsx`). */
const SORTES_HABILLEES = new Set(["toile", "objets", "moments", "variete"]);

export const AXE_MATIERE: AxeVarieteIV = {
  axe: "matiere",
  possibles(carte: CarteImage, format: FormatIV) {
    void carte;
    void format;
    return [...tirablesDe("matiere")];
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const code = etape.recette.matiere;
    if (code === "MAT-A") return etape;
    let habilles = 0;
    const donnees: DonneesMatiereIV = { code };
    const blocs = etape.blocs.map((b) => {
      if (!SORTES_HABILLEES.has(b.sorte)) return b;
      habilles++;
      return { ...b, variete: { ...b.variete!, donnees: { ...b.variete?.donnees, matiere: donnees } } };
    });
    if (!habilles) return { ...etape, replis: [...etape.replis, { axe: "matiere", code, raison: "aucune scène dessinée par l'IV (toile, objets, moments, écran de variété) dans cette version" }] };
    return { ...etape, blocs };
  },
};
