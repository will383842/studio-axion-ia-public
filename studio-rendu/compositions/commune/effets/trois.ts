/**
 * Three.js r159 LOCAL (même fichier que les cartes sur mesure : `motion/sur-mesure/vendeur/three.min.js`, MIT),
 * chargé une fois dans la page de rendu. Aucune adresse réseau. WebGL logiciel (`gl: "swangle"` du rendu).
 */
import { TROIS_D_JS } from "../motion/sur-mesure/bibliotheques.genere";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Trois = any;

let module3d: Trois | null = null;

export function trois(): Trois {
  if (!module3d) {
    // Construction UMD : `exports` et `module` locaux ; l'avertissement de dépréciation de r159 est tu.
    const charger = new Function(`var exports = {}; var module = { exports: exports }; var define = undefined; var console = { warn: function () {}, log: function () {}, error: function () {} };\n${TROIS_D_JS}\n;return module.exports;`);
    module3d = charger();
  }
  return module3d;
}
