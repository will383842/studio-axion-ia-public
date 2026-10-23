/** La marque « axion-ia.com », en haut de la zone sûre, sur chaque écran. */
import type { BoitePx, Fond, ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { planMarque } from "../plans/commun";

export function Marque({ p, boite }: { p: Pick<ProprietesEcran, "marque" | "fond" | "hauteur">; boite: BoitePx; fond?: Fond }) {
  const m = planMarque(p, boite);
  return (
    <div style={{ position: "absolute", left: m.boite.x, top: m.boite.y, width: m.boite.largeur, height: m.boite.hauteur, textAlign: "center", fontFamily: m.famille, fontSize: m.taille, letterSpacing: `${m.approcheEm}em`, color: m.couleur, whiteSpace: "nowrap" }}>
      {m.texte}
    </div>
  );
}
