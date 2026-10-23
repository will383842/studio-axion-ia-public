/**
 * Stylo `crayon/1` : un crayon SEUL, dessiné en vectoriel, aux couleurs de l'habillage `charte-video/1`.
 * Sans main, sans visage, sans personnage, sans mascotte (décision de Will, 11/10/2026). Image : un crayon droit,
 * pointe en bas ; `angle` l'incline au repos. Le même dessin est écrit dans `public/stylo/crayon/crayon-1.svg`
 * (un test vérifie qu'ils sont identiques). Au repos, le corps part de la pointe vers le BAS à droite (145°) : la main
 * qui écrit ne cache jamais ce qui est déjà écrit au-dessus.
 */
import { COULEURS_VIDEO as C } from "../../habillage/charte-video";
import { COURBES_GESTES } from "../courbes";
import type { Stylo } from "../types";

/** Image 100 × 500, pointe en (50, 490). Contours en écriture, corps en soulignement, bois et virole en sable. */
export function dessinerCrayon(): string {
  const trait = `stroke="${C.ecriture}" stroke-width="4" stroke-linejoin="round"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 500" width="100" height="500">`,
    `<rect x="32" y="12" width="36" height="48" rx="10" fill="${C.page}" ${trait}/>`,
    `<rect x="28" y="60" width="44" height="34" fill="${C.sable}" ${trait}/>`,
    `<path d="M28 72H72M28 82H72" fill="none" stroke="${C.ecriture}" stroke-width="3"/>`,
    `<rect x="28" y="94" width="44" height="290" fill="${C.soulignement}" ${trait}/>`,
    `<path d="M40 100V378" fill="none" stroke="${C.sable}" stroke-width="5" stroke-linecap="round"/>`,
    `<path d="M28 384H72L50 490Z" fill="${C.sable}" ${trait}/>`,
    `<path d="M43 460H57L50 490Z" fill="${C.ecriture}" ${trait}/>`,
    `</svg>`,
  ].join("");
}

export const CRAYON_1: Stylo = Object.freeze({
  id: "crayon",
  version: 1,
  image: "stylo/crayon/crayon-1.svg",
  largeur: 100,
  hauteur: 500,
  pointe: Object.freeze({ x: 0.5, y: 490 / 500 }),
  angle: 145,
  emprise: Object.freeze({ x0: 0.26, y0: 0.02, x1: 0.74, cone: 0.768 }),
  ombre: Object.freeze({ decalage: Object.freeze({ x: 0.012, y: 0.01 }), flou: 0.012, opacite: 0.28 }),
  gestes: COURBES_GESTES,
  licence: "stylo-crayon-1",
  svg: dessinerCrayon(),
});
