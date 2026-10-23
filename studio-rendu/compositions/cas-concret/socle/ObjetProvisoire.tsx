/**
 * Objet de remplacement (R1a) : une fiche blanche arrondie, ou le vrai écran dans un cadre de téléphone. Remplacé
 * objet par objet par les tâches R2 à R5.
 */
import { Img } from "remotion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, type ProprietesObjet } from "../plans/commun";

export function ObjetProvisoire({ boite, fond, capture }: ProprietesObjet) {
  const c = couleursDuFond(fond);
  const rayon = Math.min(boite.largeur, boite.hauteur) * 0.12;
  if (capture) {
    const bord = Math.max(4, boite.largeur * 0.03);
    return (
      <div style={{ width: boite.largeur, height: boite.hauteur, borderRadius: rayon, background: COULEURS_DUO.encre, padding: bord, boxSizing: "border-box", boxShadow: `0 ${boite.hauteur * 0.06}px ${boite.hauteur * 0.13}px ${c.ombre}` }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: rayon - bord, overflow: "hidden", background: COULEURS_DUO.blanc }}>
          {capture.sorte === "video" ? null : <Img src={capture.src} style={{ position: "absolute", left: 0, top: 0, width: "100%" }} />}
        </div>
      </div>
    );
  }
  return <div style={{ width: boite.largeur, height: boite.hauteur, borderRadius: rayon, background: COULEURS_DUO.blanc, boxShadow: `0 ${boite.hauteur * 0.06}px ${boite.hauteur * 0.13}px ${c.ombre}` }} />;
}
