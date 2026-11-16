/**
 * C10-07 : quel contour poser sous un sous-titre selon la couleur du fond. PUR, non branché (rien ne l'appelle).
 * Aucun import « @/ » : le dossier est copié dans l'image de rendu.
 */
import { PALETTE } from "../charte/axion-2026";
import { luminance, rapportContraste } from "../habillage/contraste";

/** Luminance relative au-dessus de laquelle un fond est dit clair. */
export const SEUIL_FOND_CLAIR = 0.5;
/** Contraste texte/fond minimal (WCAG AA) ; en dessous, une réserve est signalée. */
export const CONTRASTE_MIN = 4.5;

export type ResultatContour = {
  contour: string | null;
  contraste: number;
  reserve: "aucune" | "contraste-faible";
};

export function contourPourFond(fondHex: string, texteHex: string): ResultatContour {
  try {
    const clair = luminance(fondHex) > SEUIL_FOND_CLAIR;
    const contraste = rapportContraste(texteHex, fondHex);
    return {
      contour: clair ? PALETTE.noir : null,
      contraste,
      reserve: contraste < CONTRASTE_MIN ? "contraste-faible" : "aucune",
    };
  } catch {
    return { contour: null, contraste: 0, reserve: "contraste-faible" };
  }
}
