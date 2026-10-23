/** Objet `bulle-lien` (R4) : bulle arrondie portant le texte du lien, ajusté pour tenir ; dessine le plan. */
import { planBulleLien } from "../plans/BulleLien";
import type { ProprietesBulle } from "../plans/Lien";
import { mvt, styleMouvement, valeurDe, type AvecAnim } from "../plans/anim-objets";

export function BulleLien(p: ProprietesBulle & AvecAnim) {
  const b = planBulleLien(p);
  const { pastille, texte } = b;
  const revele = valeurDe(texte, "revele");
  return (
    <div style={{ position: "relative", width: b.boite.largeur, height: b.boite.hauteur, borderRadius: b.rayon, background: b.fiche, boxShadow: `0 ${b.boite.hauteur * 0.29}px ${b.boite.hauteur * 0.62}px ${b.ombre}`, ...styleMouvement(mvt(b)) }}>
      <div style={{ position: "absolute", left: pastille.x, top: pastille.y, width: pastille.diametre, height: pastille.diametre, borderRadius: "50%", background: pastille.couleur, ...styleMouvement(mvt(pastille)) }}>
        <div style={{ position: "absolute", left: pastille.anneau.x, top: pastille.anneau.y, width: pastille.anneau.diametre, height: pastille.anneau.diametre, boxSizing: "content-box", borderRadius: "50%", borderStyle: "solid", borderWidth: pastille.anneau.epaisseur, borderColor: pastille.anneau.couleur }} />
      </div>
      <div style={{ position: "absolute", left: texte.zone.x, top: 0, width: texte.zone.largeur, height: texte.zone.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontFamily: texte.famille, fontWeight: texte.graisse, fontSize: texte.taille, color: texte.couleur, ...styleMouvement(mvt(texte)), ...(revele !== undefined && revele < 1 ? { clipPath: `inset(0 ${(1 - revele) * 100}% 0 0)` } : {}) }}>
        {texte.texte}
      </div>
    </div>
  );
}
