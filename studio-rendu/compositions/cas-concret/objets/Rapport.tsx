/** Objet `rapport` (R5) : trois pages qui se déploient, une barre orange se remplit ; dessine le plan. */
import { planRapport } from "../plans/Rapport";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, type AvecAnim } from "../plans/anim-objets";

export function Rapport(p: ProprietesObjet & AvecAnim) {
  const c = planRapport(p);
  const { devant } = c;
  const page = (b: { x: number; y: number; largeur: number; hauteur: number }) => ({ position: "absolute" as const, left: b.x, top: b.y, width: b.largeur, height: b.hauteur, borderRadius: c.rayonPage, boxShadow: `0 ${b.hauteur * 0.03}px ${b.hauteur * 0.08}px ${c.ombre}` });
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, fontFamily: c.police.famille, fontWeight: c.police.graisse, color: c.police.couleur }}>
      {c.pages.map((pg) => (
        <div key={pg.index} style={{ ...page(pg.boite), background: pg.couleur, transform: `translateX(${pg.decalageX}px) rotate(${pg.rotation}deg)` }}>
          {pg.lignes.map((l, i) => (
            <div key={i} style={{ position: "absolute", left: l.x, top: l.y, width: l.largeur, height: l.hauteur, borderRadius: l.hauteur / 2, background: l.couleur }} />
          ))}
        </div>
      ))}
      <div style={{ ...page(devant.boite), background: devant.couleur, ...styleMouvement(mvt(devant)) }}>
        {devant.titre ? <div style={{ position: "absolute", left: devant.titre.boite.x, top: devant.titre.boite.y, width: devant.titre.boite.largeur, height: devant.titre.boite.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: devant.titre.taille }}>{devant.titre.texte}</div> : null}
        {devant.lignes.map((l, i) => (
          <div key={i} style={{ position: "absolute", left: l.x, top: l.y, width: l.largeur, height: l.hauteur, borderRadius: l.hauteur / 2, background: l.couleur }} />
        ))}
        {devant.etiquette ? <div style={{ position: "absolute", left: devant.etiquette.boite.x, top: devant.etiquette.boite.y, width: devant.etiquette.boite.largeur, height: devant.etiquette.boite.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontSize: devant.etiquette.taille }}>{devant.etiquette.texte}</div> : null}
        <div style={{ position: "absolute", left: devant.piste.boite.x, top: devant.piste.boite.y, width: devant.piste.boite.largeur, height: devant.piste.boite.hauteur, borderRadius: devant.piste.boite.hauteur / 2, background: devant.piste.couleur }} />
        <div style={{ position: "absolute", left: devant.barre.x, top: devant.barre.y, width: devant.barre.largeur, height: devant.barre.hauteur, borderRadius: devant.barre.hauteur / 2, background: devant.barre.couleur }} />
      </div>
    </div>
  );
}
