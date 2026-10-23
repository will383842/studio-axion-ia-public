/** Objet `outils-relies` (R5) : trois pastilles nommées, un fil, un point qui circule ; dessine le plan. */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { planOutilsRelies } from "../plans/OutilsRelies";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, type AvecAnim } from "../plans/anim-objets";

export function OutilsRelies(p: ProprietesObjet & AvecAnim) {
  const c = planOutilsRelies(p);
  const { fil, point } = c;
  const chemin = fil.points.map((q) => `${q.x},${q.y}`).join(" ");
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, fontFamily: c.police.famille, fontWeight: c.police.graisse, color: c.police.couleur }}>
      <svg width={c.boite.largeur} height={c.boite.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <polygon points={chemin} fill="none" stroke={fil.couleur} strokeWidth={fil.epaisseur} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fil.trace} />
        {point.visible ? <circle cx={point.x} cy={point.y} r={point.diametre / 2} fill={point.couleur} stroke={point.halo} strokeWidth={point.diametre * 0.25} /> : null}
      </svg>
      {c.pastilles.map((q) => (
        <div key={q.index} style={{ position: "absolute", left: q.boite.x, top: q.boite.y, width: q.boite.largeur, height: q.boite.hauteur, borderRadius: c.rayonPastille, background: COULEURS_DUO.blanc, boxShadow: `0 ${q.boite.hauteur * 0.25}px ${q.boite.hauteur * 0.5}px ${c.ombre}`, ...styleMouvement(mvt(q), { opacity: q.opacite, transform: `scale(${q.echelle})` }) }}>
          <div style={{ position: "absolute", left: q.rond.x - q.boite.x, top: q.rond.y - q.boite.y, width: q.rond.diametre, height: q.rond.diametre, borderRadius: "50%", background: q.rond.couleur }} />
          {q.texte ? <div style={{ position: "absolute", left: q.texte.boite.x - q.boite.x, top: 0, width: q.texte.boite.largeur, height: q.boite.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: q.texte.taille }}>{q.texte.texte}</div> : null}
        </div>
      ))}
    </div>
  );
}
