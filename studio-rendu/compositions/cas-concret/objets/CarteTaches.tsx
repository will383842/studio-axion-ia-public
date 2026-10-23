/** Objet `carte-taches` (R5) : douze cases, trois passent à l'orange ; dessine le plan. */
import { planCarteTaches } from "../plans/CarteTaches";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, type AvecAnim } from "../plans/anim-objets";

export function CarteTaches(p: ProprietesObjet & AvecAnim) {
  const c = planCarteTaches(p);
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.rayon, background: c.fiche, boxShadow: `0 ${c.boite.hauteur * 0.06}px ${c.boite.hauteur * 0.13}px ${c.ombre}`, fontFamily: c.police.famille, fontWeight: c.police.graisse, color: c.police.couleur }}>
      {c.titre ? <div style={{ position: "absolute", left: c.titre.boite.x, top: c.titre.boite.y, width: c.titre.boite.largeur, height: c.titre.boite.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: c.titre.taille }}>{c.titre.texte}</div> : null}
      {c.cases.map((k) => (
        <div key={k.index} style={{ position: "absolute", left: k.boite.x, top: k.boite.y, width: k.boite.largeur, height: k.boite.hauteur, borderRadius: c.rayonCase, background: k.couleur, ...styleMouvement(mvt(k), { transform: `scale(${k.echelle})` }) }} />
      ))}
    </div>
  );
}
