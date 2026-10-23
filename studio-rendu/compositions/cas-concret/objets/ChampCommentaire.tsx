/** Objet « champ de saisie » (R4) : champ de saisie où le mot se tape lettre par lettre ; dessine le plan. */
import { planChampCommentaire } from "../plans/ChampCommentaire";
import type { ProprietesChamp } from "../plans/AppelMot";
import { mvt, styleMouvement, type AvecAnim } from "../plans/anim-objets";

export function ChampCommentaire(p: ProprietesChamp & AvecAnim) {
  const c = planChampCommentaire(p);
  const { texte, pastille, bouton } = c;
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, borderRadius: c.rayon, background: c.fiche, boxShadow: `0 ${c.boite.hauteur * 0.23}px ${c.boite.hauteur * 0.46}px ${c.ombre}`, ...styleMouvement(mvt(c)) }}>
      <div style={{ position: "absolute", left: pastille.x, top: pastille.y, width: pastille.diametre, height: pastille.diametre, borderRadius: "50%", background: pastille.couleur, ...styleMouvement(mvt(pastille)) }} />
      <div style={{ position: "absolute", left: texte.zone.x, top: 0, width: texte.zone.largeur, height: texte.zone.hauteur, display: "flex", alignItems: "center", whiteSpace: "nowrap", fontFamily: texte.famille, fontWeight: texte.graisse, fontSize: texte.taille, letterSpacing: `${texte.approcheEm}em`, color: texte.couleur }}>
        <span>{texte.tape}</span>
        <span style={{ display: "inline-block", width: texte.curseurLargeur, height: texte.curseurHauteur, marginLeft: texte.taille * 0.04, background: texte.couleur, opacity: texte.curseur ? 1 : 0 }} />
      </div>
      <div style={{ position: "absolute", right: bouton.droite, top: bouton.y, width: bouton.diametre, height: bouton.diametre, borderRadius: "50%", background: bouton.couleur, ...styleMouvement(mvt(bouton)) }}>
        <div style={{ position: "absolute", left: bouton.triangle.x, top: bouton.triangle.y, width: 0, height: 0, borderStyle: "solid", borderWidth: `${bouton.triangle.base}px 0 ${bouton.triangle.base}px ${bouton.triangle.longueur}px`, borderColor: `transparent transparent transparent ${bouton.triangle.couleur}` }} />
      </div>
    </div>
  );
}
