/** Objet `liste-taches` (R2) : fiche blanche à cases vides dont les rangs entrent un à un. Dessine `plans/ListeTaches.ts`. */
import { useCurrentFrame } from "remotion";
import { couleursDuFond } from "../plans/commun";
import { planListeTaches, type ProprietesListeTaches } from "../plans/ListeTaches";

export function ListeTaches(p: ProprietesListeTaches) {
  const l = planListeTaches(p, useCurrentFrame());
  return (
    <div style={{ position: "relative", width: p.boite.largeur, height: p.boite.hauteur, borderRadius: l.fiche.rayon, background: l.fiche.couleur, boxShadow: `0 ${p.boite.hauteur * 0.08}px ${p.boite.hauteur * 0.17}px ${couleursDuFond(p.fond).ombre}`, transform: `translateX(${l.decalageX}px)` }}>
      {l.rangs.map((r, i) => (
        <div key={i} style={{ opacity: r.opacite, transform: `translateX(${r.decalageX}px)` }}>
          <div style={{ position: "absolute", left: r.caseBoite.x, top: r.caseBoite.y, width: r.caseBoite.largeur, height: r.caseBoite.hauteur, boxSizing: "border-box", borderRadius: r.caseRayon, borderStyle: "solid", borderWidth: r.caseTrait, borderColor: r.caseCouleur }} />
          <div style={{ position: "absolute", left: r.boite.x, top: r.boite.y, width: r.boite.largeur, height: r.boite.hauteur, display: "flex", alignItems: "center", fontFamily: r.famille, fontSize: r.taille, color: r.couleur, whiteSpace: "nowrap" }}>{r.texte}</div>
          {r.separateur ? <div style={{ position: "absolute", left: l.fiche.boite.largeur * 0.035, right: l.fiche.boite.largeur * 0.035, top: r.separateur.y, height: r.separateur.epaisseur, background: r.separateur.couleur }} /> : null}
        </div>
      ))}
    </div>
  );
}
