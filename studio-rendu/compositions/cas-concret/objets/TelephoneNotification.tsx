/** Objet `telephone-notification` : écran verrouillé, l'heure, une notification qui tombe ; le téléphone vibre. */
import type { ProprietesObjet } from "../plans/commun";
import type { ContexteObjet } from "../plans/Objet";
import { planTelephoneNotification } from "../plans/TelephoneNotification";
import { mvt, styleMouvement, type Mouvement } from "../plans/anim-objets";

export function TelephoneNotification(p: ProprietesObjet) {
  const t = planTelephoneNotification(p as ContexteObjet);
  const c = t.carte;
  const allumage = (t as { allumage?: Mouvement }).allumage;
  return (
    <div style={{ position: "absolute", left: t.corps.x, top: t.corps.y, width: t.corps.largeur, height: t.corps.hauteur, borderRadius: t.rayon, background: t.couleur, padding: t.bord, boxSizing: "border-box", transform: `rotate(${t.rotation}deg)`, boxShadow: `0 ${t.corps.hauteur * 0.065}px ${t.corps.hauteur * 0.14}px ${t.ombre}` }}>
      <div style={{ position: "relative", width: t.ecran.largeur, height: t.ecran.hauteur, borderRadius: t.rayonEcran, overflow: "hidden", background: `linear-gradient(180deg, ${t.fondEcran.haut}, ${t.fondEcran.bas})`, ...styleMouvement(allumage) }}>
        <div style={{ position: "absolute", left: t.heure.boite.x, top: t.heure.boite.y, width: t.heure.boite.largeur, textAlign: "center", fontFamily: t.heure.famille, fontSize: t.heure.taille, lineHeight: 1.2, letterSpacing: `${t.heure.approcheEm}em`, color: t.heure.couleur, whiteSpace: "nowrap", ...styleMouvement(mvt(t.heure)) }}>{t.heure.texte}</div>
        <div style={{ position: "absolute", left: c.boite.x, top: c.boite.y, width: c.boite.largeur, height: c.boite.hauteur, boxSizing: "border-box", padding: `${c.marge.y}px ${c.marge.x}px`, borderRadius: c.rayon, background: c.fond, ...styleMouvement(mvt(c), { opacity: c.opacite, transform: `translateY(${c.decalageY}px) scale(${c.echelle})` }) }}>
          <div style={{ fontFamily: c.enTete.famille, fontSize: c.enTete.taille, lineHeight: 1.2, color: c.enTete.couleur, whiteSpace: "nowrap", textTransform: "uppercase" }}>{c.enTete.texte}</div>
          <div style={{ marginTop: c.marge.y * 0.36, fontFamily: c.sujet.famille, fontSize: c.sujet.taille, lineHeight: 1.25, color: c.sujet.couleur }}>
            {c.sujet.lignes.map((l, i) => (
              <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
