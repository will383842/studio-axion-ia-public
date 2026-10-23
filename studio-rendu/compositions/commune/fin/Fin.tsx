/**
 * FIN (TB-15, plan § 11) : la phrase s'écrit à la page ivoire, puis le crayon COCHE (geste signature de la série).
 * 3 à 4 s, SANS son ni sous-titres ; rien n'est dessiné dans la bande des sous-titres. Le plan (`plan.ts`) calcule tout
 * depuis le numéro d'image : déterministe. S'inscrit dans `tableau/Compositions.tsx`.
 */
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COULEURS_VIDEO } from "../../../../src/briques/habillage/charte-video";
import { LigneEcrite } from "../../tableau/LigneEcrite";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../polices";
import { Cocher } from "../stylo/Gestes";
import { Stylo } from "../stylo/Stylo";
import { avancementAction, planifierFin, pointeFin, REGLAGES_FIN, type ProprietesFin } from "./plan";

export function Fin(p: ProprietesFin) {
  chargerPoliceTitre();
  chargerPoliceMontserrat();
  const image = useCurrentFrame();
  const plan = useMemo(() => planifierFin(p), [p]);
  const t = image / plan.fps;
  const pointe = pointeFin(plan, t);
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_VIDEO.page, overflow: "hidden" }}>
      {/* Tout le contenu (et le crayon) reste au-dessus de la bande des sous-titres. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: plan.largeur, height: p.bande.y, overflow: "hidden" }}>
        {plan.lignes.map((l) => (
          <LigneEcrite key={l.texte} texte={l.texte} px={l.px} taille={plan.taille} niveau="titre" u={avancementAction(t, l.debut, l.duree)} largeurImage={plan.largeur} />
        ))}
        <Cocher cible={plan.coche.cible} debut={plan.coche.debut} duree={plan.coche.duree} largeurVideo={plan.largeur} stylo={false} t={t} />
        {pointe && <Stylo id={p.stylo} x={pointe.x} y={pointe.y} hauteur={plan.hauteurStylo} angle={REGLAGES_FIN.angleStylo} />}
      </div>
    </AbsoluteFill>
  );
}
