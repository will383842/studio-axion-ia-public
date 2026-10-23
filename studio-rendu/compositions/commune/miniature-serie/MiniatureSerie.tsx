/**
 * COUVERTURE DE SÉRIE (TB-16) : la douleur en gros sur la page ivoire, le mot-clé en noir souligné d'orange, le nom
 * de la série en petit. Une image fixe (9:16 ou 1:1), sans son ni sous-titres, jamais de numéro d'épisode. Le plan
 * (`plan.ts`) calcule tout : déterministe. `Miniature.tsx` (miniature des vidéos) n'est pas modifiée.
 */
import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { COULEURS_VIDEO, POLICES_VIDEO } from "../../../../src/briques/habillage/charte-video";
import { APPROCHE_EM } from "../../../../src/briques/motion/jetons";
import { STYLE_ECRITURE_EXACTE } from "../../../../src/briques/stylo/mesure-ecriture";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../polices";
import { planifierCouverture, type ProprietesCouverture } from "./plan";

export function MiniatureSerie(p: ProprietesCouverture) {
  chargerPoliceTitre();
  chargerPoliceMontserrat();
  const plan = useMemo(() => planifierCouverture(p), [p]);
  const titre = POLICES_VIDEO.titre;
  const texte = POLICES_VIDEO.texte;
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_VIDEO.page, overflow: "hidden" }}>
      {plan.traits.map((t, i) => (
        <div key={`t${i}`} style={{ position: "absolute", left: t.x, top: t.y, width: t.largeur, height: t.hauteur, borderRadius: t.hauteur, backgroundColor: COULEURS_VIDEO.soulignement }} />
      ))}
      {plan.lignes.map((l) => (
        <span
          key={l.texte}
          style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, fontFamily: `"${titre.famille}", sans-serif`, fontWeight: titre.graisse, fontSize: plan.taille, letterSpacing: `${APPROCHE_EM.titre}em`, ...STYLE_ECRITURE_EXACTE, color: COULEURS_VIDEO.ecriture, whiteSpace: "pre" }}
        >
          {l.texte}
        </span>
      ))}
      <span
        style={{ position: "absolute", left: plan.serie.px.x, top: plan.serie.px.y, width: plan.serie.px.largeur, height: plan.serie.px.hauteur, lineHeight: `${plan.serie.px.hauteur}px`, fontFamily: `"${texte.famille}", sans-serif`, fontWeight: texte.graisse, fontSize: plan.serie.taille, ...STYLE_ECRITURE_EXACTE, color: COULEURS_VIDEO.ecriture, whiteSpace: "pre" }}
      >
        {plan.serie.texte}
      </span>
    </AbsoluteFill>
  );
}
