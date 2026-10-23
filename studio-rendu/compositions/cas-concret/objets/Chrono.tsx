/** Objet `chrono` : anneau qui se remplit, compteur qui monte jusqu'à la valeur demandée, puis bat une fois. */
import type { ProprietesObjet } from "../plans/commun";
import { planChrono } from "../plans/Chrono";
import type { ContexteObjet } from "../plans/Objet";
import { mvt, styleMouvement } from "../plans/anim-objets";

export function Chrono(p: ProprietesObjet) {
  const c = planChrono(p as ContexteObjet);
  const a = c.anneau;
  return (
    <>
      <svg style={{ position: "absolute", left: c.boite.x, top: c.boite.y, overflow: "visible", filter: `drop-shadow(0 0 ${a.trait * 1.7}px ${a.lueur})`, ...styleMouvement(mvt(a)) }} width={c.boite.largeur} height={c.boite.hauteur}>
        <circle cx={c.boite.largeur / 2} cy={c.boite.hauteur / 2} r={a.rayon} fill="none" stroke={a.piste} strokeWidth={a.trait} />
        <circle cx={c.boite.largeur / 2} cy={c.boite.hauteur / 2} r={a.rayon} fill="none" stroke={a.couleur} strokeWidth={a.trait} strokeLinecap="round" strokeDasharray={a.circonference} strokeDashoffset={a.decalage} transform={`rotate(-90 ${c.boite.largeur / 2} ${c.boite.hauteur / 2})`} />
      </svg>
      <div style={{ position: "absolute", left: c.nombre.boite.x, top: c.nombre.boite.y, width: c.nombre.boite.largeur, height: c.nombre.boite.hauteur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: c.nombre.famille, fontSize: c.nombre.taille, lineHeight: 1.04, color: c.nombre.couleur, whiteSpace: "nowrap", transform: `scale(${c.nombre.echelle})`, textShadow: `0 0 ${c.nombre.taille * 0.18}px ${c.nombre.lueur}, 0 0 ${c.nombre.taille * 0.41}px ${c.nombre.lueurLarge}` }}>
        {c.nombre.texte}
      </div>
      <div style={{ position: "absolute", left: c.unite.boite.x, top: c.unite.boite.y, width: c.unite.boite.largeur, height: c.unite.boite.hauteur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: c.unite.famille, fontSize: c.unite.taille, lineHeight: 1.04, color: c.unite.couleur, textTransform: "uppercase", whiteSpace: "nowrap", ...styleMouvement(mvt(c.unite)) }}>
        {c.unite.texte}
      </div>
    </>
  );
}
