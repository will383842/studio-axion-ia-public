/** Objet `barres-avant-apres` (R2) : une barre (« avant » ou « maintenant ») qui se remplit et porte son texte. Dessine `plans/BarresAvantApres.ts`. */
import { useCurrentFrame } from "remotion";
import { planBarresAvantApres, type ProprietesBarresAvantApres } from "../plans/BarresAvantApres";

export function BarresAvantApres(p: ProprietesBarresAvantApres) {
  const b = planBarresAvantApres(p, useCurrentFrame());
  return (
    <div style={{ position: "relative", width: p.boite.largeur, height: p.boite.hauteur }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: b.barre.boite.largeur, height: b.barre.boite.hauteur, borderRadius: b.barre.rayon, background: b.barre.couleur, overflow: "hidden", boxShadow: `0 ${p.boite.hauteur * 0.08}px ${p.boite.hauteur * 0.2}px ${b.ombre}` }}>
        <div style={{ position: "absolute", left: b.texte.boite.x, top: 0, width: b.texte.boite.largeur, height: b.texte.boite.hauteur, display: "flex", alignItems: "center", fontFamily: b.texte.famille, fontWeight: b.texte.graisse, fontSize: b.texte.taille, color: b.texte.couleur, whiteSpace: "nowrap" }}>{b.texte.texte}</div>
      </div>
    </div>
  );
}
