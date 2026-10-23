/** Objet `calendrier` (R5) : page de calendrier, un jour s'allume puis une coche surgit ; dessine le plan. */
import { planCalendrier } from "../plans/Calendrier";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, valeurDe, type AvecAnim, type Mouvement } from "../plans/anim-objets";
import { CocheTracee } from "./CocheTracee";

export function Calendrier(p: ProprietesObjet & AvecAnim) {
  const c = planCalendrier(p);
  const { jour, coche, bandeau } = c;
  const mc = (c as { mouvementsCellules?: Mouvement[] }).mouvementsCellules;
  const mj = mc?.[jour.index];
  const trace = valeurDe(coche, "trace");
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.rayon, background: c.fiche, boxShadow: `0 ${c.boite.hauteur * 0.06}px ${c.boite.hauteur * 0.13}px ${c.ombre}`, overflow: "hidden", fontFamily: c.police.famille, fontWeight: c.police.graisse }}>
      <div style={{ position: "absolute", left: bandeau.boite.x, top: bandeau.boite.y, width: bandeau.boite.largeur, height: bandeau.boite.hauteur, background: bandeau.couleur, ...styleMouvement(mvt(bandeau)) }}>
        {bandeau.texte ? (
          <div style={{ position: "absolute", left: bandeau.texte.boite.x, top: bandeau.texte.boite.y, width: bandeau.texte.boite.largeur, height: bandeau.texte.boite.hauteur, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", fontSize: bandeau.texte.taille, color: bandeau.texteCouleur }}>{bandeau.texte.texte}</div>
        ) : null}
      </div>
      {c.cellules.map((b, i) =>
        i === jour.index ? null : <div key={i} style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, borderRadius: c.rayonCellule, background: c.cellulesCouleur, ...styleMouvement(mc?.[i], { opacity: c.cellulesOpacite }) }} />,
      )}
      <div style={{ position: "absolute", left: jour.boite.x, top: jour.boite.y, width: jour.boite.largeur, height: jour.boite.hauteur, borderRadius: c.rayonCellule, background: c.cellulesCouleur, ...styleMouvement(mj, { opacity: c.cellulesOpacite }) }} />
      <div style={{ position: "absolute", left: jour.boite.x, top: jour.boite.y, width: jour.boite.largeur, height: jour.boite.hauteur, borderRadius: c.rayonCellule, background: jour.couleur, ...styleMouvement(mj, { transform: `scale(${jour.echelle})` }), display: "flex", alignItems: "center", justifyContent: "center", fontSize: jour.texte?.taille, color: jour.texteCouleur, whiteSpace: "nowrap" }}>{jour.texte?.texte}</div>
      <div style={{ position: "absolute", left: coche.boite.x, top: coche.boite.y, width: coche.boite.largeur, height: coche.boite.hauteur, borderRadius: "50%", background: coche.couleur, opacity: coche.opacite, transform: `scale(${coche.echelle}) rotate(${coche.rotation}deg)` }}>
        {trace !== undefined ? (
          <CocheTracee trace={trace} couleur={coche.trait} epaisseur={coche.boite.largeur * 0.1} diametre={coche.boite.largeur} />
        ) : (
          <div style={{ position: "absolute", left: "32%", top: "20%", width: "26%", height: "48%", borderStyle: "solid", borderColor: coche.trait, borderWidth: `0 ${coche.boite.largeur * 0.1}px ${coche.boite.largeur * 0.1}px 0`, transform: "rotate(45deg)" }} />
        )}
      </div>
    </div>
  );
}
