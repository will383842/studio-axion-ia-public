/** Carte de fin Axion : page ivoire, UN bloc noir arrondi avec le logo (charte 2026). Plan : `src/briques/charte/carte-fin.ts`. */
import { AbsoluteFill, Img, interpolate, useCurrentFrame, Easing } from "remotion";
import { COURBES, PILE_CSS } from "../../../../src/briques/charte/axion-2026";
import { planifierCarteFin } from "../../../../src/briques/charte/carte-fin";
import { chargerPoliceTitre } from "../polices";
import logo from "./logo-axion-fond-sombre.png";

export type ProprietesCarteFin = { largeur: number; hauteur: number; dureeSec: number; adresse: string };

export function CarteFinAxion(p: ProprietesCarteFin) {
  chargerPoliceTitre();
  const f = useCurrentFrame();
  const plan = planifierCarteFin(p.largeur, p.hauteur, p.dureeSec);
  const [a, b, c, d] = COURBES.douce;
  const e = interpolate(f, [0, plan.entreeImages], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(a, b, c, d) });
  return (
    <AbsoluteFill style={{ backgroundColor: plan.fondPage }}>
      <div style={{ position: "absolute", left: plan.carte.x, top: plan.carte.y + (1 - e) * 24, width: plan.carte.largeur, height: plan.carte.hauteur, borderRadius: plan.carte.rayon, backgroundColor: plan.carte.fond, opacity: e }}>
        <Img src={logo} style={{ position: "absolute", left: plan.logo.x - plan.carte.x, top: plan.logo.y - plan.carte.y, width: plan.logo.largeur, height: plan.logo.hauteur }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: plan.texte.y - plan.carte.y, textAlign: "center", fontFamily: PILE_CSS, fontWeight: plan.texte.graisse, fontSize: plan.texte.taillePx, color: plan.texte.couleur }}>{p.adresse}</div>
      </div>
    </AbsoluteFill>
  );
}
