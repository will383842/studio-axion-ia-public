/** Objet `contrat-signature` : feuille dont les lignes s'écrivent, puis la signature qui se trace. */
import type { ProprietesObjet } from "../plans/commun";
import { planContratSignature } from "../plans/ContratSignature";
import type { ContexteObjet } from "../plans/Objet";
import { mvt, styleMouvement } from "../plans/anim-objets";

export function ContratSignature(p: ProprietesObjet) {
  const c = planContratSignature(p as ContexteObjet);
  const s = c.signature;
  return (
    <div style={{ position: "absolute", left: c.boite.x, top: c.boite.y, width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.feuille.rayon, background: c.feuille.fond, boxShadow: `0 ${c.boite.hauteur * 0.07}px ${c.boite.hauteur * 0.15}px ${c.feuille.ombre}`, ...styleMouvement(mvt(c.feuille)) }}>
      {c.lignes.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: l.x, top: l.y, width: l.largeur, height: l.hauteur, borderRadius: l.rayon, background: l.couleur, ...styleMouvement(mvt(l)) }} />
      ))}
      <svg style={{ position: "absolute", left: s.boite.x, top: s.boite.y }} width={s.boite.largeur} height={s.boite.hauteur} viewBox="0 0 360 150">
        <path d={s.chemin} fill="none" stroke={s.couleur} strokeWidth={s.epaisseur} strokeLinecap="round" strokeDasharray={s.longueur} strokeDashoffset={s.decalage} />
      </svg>
      <div style={{ position: "absolute", left: c.base.x, top: c.base.y, width: c.base.largeur, height: c.base.hauteur, background: c.base.couleur }} />
    </div>
  );
}
