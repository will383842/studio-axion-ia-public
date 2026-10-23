/** Objet `programme` (R5) : feuille de programme, les titres de modules entrent un à un ; dessine le plan. */
import { planProgramme } from "../plans/Programme";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, type AvecAnim } from "../plans/anim-objets";

export function Programme(p: ProprietesObjet & AvecAnim) {
  const c = planProgramme(p);
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.rayon, background: c.fiche, boxShadow: `0 ${c.boite.hauteur * 0.06}px ${c.boite.hauteur * 0.13}px ${c.ombre}`, overflow: "hidden", fontFamily: c.police.famille, fontWeight: c.police.graisse, color: c.police.couleur }}>
      <div style={{ position: "absolute", left: c.bandeau.boite.x, top: c.bandeau.boite.y, width: c.bandeau.boite.largeur, height: c.bandeau.boite.hauteur, background: c.bandeau.couleur }}>
        <div style={{ position: "absolute", left: c.bandeau.accent.x, top: c.bandeau.accent.y, width: c.bandeau.accent.largeur, height: c.bandeau.accent.hauteur, borderRadius: c.bandeau.accent.hauteur / 2, background: c.bandeau.accent.couleur }} />
      </div>
      {c.modules.map((m, i) => (
        <div key={i} style={{ position: "absolute", left: m.boite.x, top: m.boite.y, width: m.boite.largeur, height: m.boite.hauteur, borderRadius: c.rayonRang, background: m.fond, ...styleMouvement(mvt(m), { opacity: m.opacite, transform: `translateX(${m.decalageX}px)` }) }}>
          <div style={{ position: "absolute", left: m.puce.x - m.boite.x, top: m.puce.y - m.boite.y, width: m.puce.diametre, height: m.puce.diametre, borderRadius: "50%", background: m.puce.couleur, ...styleMouvement(mvt(m.puce)) }} />
          {m.texte ? (
            <div style={{ position: "absolute", left: m.texte.boite.x - m.boite.x, top: 0, width: m.texte.boite.largeur, height: m.boite.hauteur, display: "flex", alignItems: "center", fontSize: m.texte.taille, lineHeight: 1.2 }}><div>{m.texte.lignes.map((l, k) => <div key={k} style={{ whiteSpace: "nowrap" }}>{l}</div>)}</div></div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
