/** Étiquette en capitales espacées, couleur d'accent, au-dessus du titre. */
import type { Fond, TextePose } from "../../../../src/briques/ecrans-motion";
import { planEtiquette } from "../plans/commun";

export function Etiquette({ pose, fond, t }: { pose: TextePose; fond: Fond; t: number }) {
  const e = planEtiquette(fond, pose, t);
  return (
    <div style={{ position: "absolute", left: e.boite.x, top: e.boite.y, width: e.boite.largeur, textAlign: "center", fontFamily: e.famille, fontSize: e.taille, letterSpacing: `${e.approcheEm}em`, textTransform: "uppercase", color: e.couleur, opacity: e.opacite, whiteSpace: "nowrap" }}>
      {e.texte.replace(/\*/g, "")}
    </div>
  );
}
