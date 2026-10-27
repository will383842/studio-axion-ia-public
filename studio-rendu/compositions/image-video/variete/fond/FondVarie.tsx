/**
 * Variété « Image → vidéo » · axe fond (FON-A..FON-E) : position de la lueur du fond. FON-A = rendu d'aujourd'hui
 * (lueur 0) ; sans variété, le fond reste celui de référence. Jamais le fond « fort ».
 */
import React from "react";
import type { Fond as NomFond } from "../../../../../src/briques/ecrans-motion";
import { codeDe } from "../../../../../src/briques/schema-motion/variete";
import { Fond } from "../../../cas-concret/socle/Fond";
import { useVariete } from "../ContexteVariete";
import { LUEUR_DU_CODE_FOND } from "./lueurs";

/** Le `Fond` du cas concret avec la lueur du code de fond de la recette (sans recette : FON-A). */
export function FondIV({ fond, largeur, hauteur }: { fond: NomFond; largeur: number; hauteur: number }) {
  const code = codeDe(useVariete()?.recette, "fond");
  return <Fond fond={fond} largeur={largeur} hauteur={hauteur} lueur={LUEUR_DU_CODE_FOND[fond][code]} />;
}
