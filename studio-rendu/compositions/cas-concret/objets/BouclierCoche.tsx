/** Objet `bouclier-coche` (R2) : fiche blanche, grand rond vert, coche blanche qui surgit. Dessine `plans/BouclierCoche.ts`. */
import { useCurrentFrame } from "remotion";
import { couleursDuFond } from "../plans/commun";
import { planBouclierCoche, type ProprietesBouclierCoche } from "../plans/BouclierCoche";
import { mvt, styleMouvement, valeurDe } from "../plans/anim-objets";
import { CocheTracee } from "./CocheTracee";

export function BouclierCoche(p: ProprietesBouclierCoche) {
  const b = planBouclierCoche(p, useCurrentFrame());
  const mf = mvt(b.fiche);
  const trace = valeurDe(b.coche, "trace");
  return (
    <div style={{ position: "relative", width: p.boite.largeur, height: p.boite.hauteur }}>
      <div style={{ position: "absolute", left: b.fiche.boite.x, top: b.fiche.boite.y, width: b.fiche.boite.largeur, height: b.fiche.boite.hauteur, borderRadius: b.fiche.rayon, background: b.fiche.couleur, boxShadow: `0 ${b.fiche.boite.hauteur * 0.15}px ${b.fiche.boite.hauteur * 0.3}px ${couleursDuFond(p.fond).ombre}`, ...styleMouvement(mf) }} />
      <div style={{ position: "absolute", left: b.rond.boite.x, top: b.rond.boite.y, width: b.rond.boite.largeur, height: b.rond.boite.hauteur, borderRadius: "50%", background: b.rond.couleur, opacity: b.rond.opacite, transform: `scale(${b.rond.echelle})` }}>
        {trace !== undefined ? (
          <CocheTracee trace={trace} couleur={b.coche.couleur} epaisseur={b.coche.trait} diametre={b.rond.boite.largeur} />
        ) : (
          <div style={{ position: "absolute", left: b.coche.boite.x, top: b.coche.boite.y, width: b.coche.boite.largeur, height: b.coche.boite.hauteur, boxSizing: "border-box", borderStyle: "solid", borderColor: b.coche.couleur, borderWidth: `0 ${b.coche.trait}px ${b.coche.trait}px 0`, transform: "rotate(45deg)" }} />
        )}
      </div>
    </div>
  );
}
