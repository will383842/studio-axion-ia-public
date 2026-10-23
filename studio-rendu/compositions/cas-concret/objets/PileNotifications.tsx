/** Objet `pile-notifications` : des e-mails qui arrivent l'un après l'autre, cochés en vert. */
import type { ProprietesObjet } from "../plans/commun";
import type { ContexteObjet } from "../plans/Objet";
import { planPileNotifications } from "../plans/PileNotifications";
import { mvt, styleMouvement, valeurDe } from "../plans/anim-objets";
import { CocheTracee } from "./CocheTracee";

export function PileNotifications(p: ProprietesObjet) {
  const pile = planPileNotifications(p as ContexteObjet);
  return (
    <>
      {pile.cartes.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: c.boite.x, top: c.boite.y, width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.rayon, background: c.fond, ...styleMouvement(mvt(c), { opacity: c.opacite, transform: `translateY(${c.decalageY}px) scale(${c.echelle})` }), boxShadow: `0 ${c.boite.hauteur * 0.3}px ${c.boite.hauteur * 0.6}px ${pile.ombre}` }}>
          <div style={{ position: "absolute", left: c.icone.boite.x, top: c.icone.boite.y, width: c.icone.boite.largeur, height: c.icone.boite.hauteur, borderRadius: c.icone.rayon, background: c.icone.fond, color: c.icone.couleur, fontFamily: c.icone.famille, fontSize: c.icone.taille, lineHeight: `${c.icone.boite.hauteur}px`, textAlign: "center" }}>{c.icone.lettre}</div>
          <div style={{ position: "absolute", left: c.expediteur.boite.x, top: c.expediteur.boite.y, width: c.expediteur.boite.largeur, fontFamily: c.expediteur.famille, fontSize: c.expediteur.taille, lineHeight: 1.2, color: c.expediteur.couleur, whiteSpace: "nowrap" }}>{c.expediteur.texte}</div>
          {c.sujet.barre ? (
            <div style={{ position: "absolute", left: c.sujet.boite.x, top: c.sujet.boite.y + (c.sujet.boite.hauteur - c.sujet.barre.hauteur) / 2, width: c.sujet.barre.largeur, height: c.sujet.barre.hauteur, borderRadius: c.sujet.barre.hauteur / 2, background: c.sujet.barre.couleur }} />
          ) : (
            <div style={{ position: "absolute", left: c.sujet.boite.x, top: c.sujet.boite.y, width: c.sujet.boite.largeur, fontFamily: c.sujet.famille, fontSize: c.sujet.taille, lineHeight: 1.2, color: c.sujet.couleur, whiteSpace: "nowrap" }}>{c.sujet.texte}</div>
          )}
          <div style={{ position: "absolute", left: c.coche.boite.x, top: c.coche.boite.y, width: c.coche.boite.largeur, height: c.coche.boite.hauteur, borderRadius: "50%", background: c.coche.fond, opacity: c.coche.opacite, transform: `scale(${c.coche.echelle})` }}>
            {valeurDe(c.coche, "trace") !== undefined ? (
              <CocheTracee trace={valeurDe(c.coche, "trace")!} couleur={c.coche.trait} epaisseur={c.coche.epaisseur} diametre={c.coche.boite.largeur} />
            ) : (
              <div style={{ position: "absolute", left: c.coche.boite.largeur * 0.36, top: c.coche.boite.hauteur * 0.18, width: c.coche.boite.largeur * 0.24, height: c.coche.boite.hauteur * 0.45, boxSizing: "border-box", borderStyle: "solid", borderColor: c.coche.trait, borderWidth: `0 ${c.coche.epaisseur}px ${c.coche.epaisseur}px 0`, transform: "rotate(45deg)" }} />
            )}
          </div>
        </div>
      ))}
    </>
  );
}
