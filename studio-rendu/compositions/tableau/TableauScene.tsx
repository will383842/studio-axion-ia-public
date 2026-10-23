/**
 * TABLEAU SCÈNE (TB-05, plan § 4.2 étape 6 et § 7) : UNE composition, pilotée par ses propriétés, rend UNE scène du
 * tableau animé — la page ivoire qui se remplit de haut en bas sans rien effacer. Ce que les scènes précédentes de la
 * page ont écrit est là dès la première image. Une scène qui ouvre une nouvelle page la fait glisser d'un geste du
 * crayon (0,3 s), jamais une coupe sèche.
 *
 * SANS son ni sous-titres (posés plus tard par la composition `complet`) : rien n'est dessiné dans la bande des
 * sous-titres (tout le contenu est coupé au-dessus d'elle). Carte plein écran OPAQUE (fond = page de l'habillage) :
 * elle se pose comme un plan, sans `premultiply`. Durée = `finMs − debutMs`, 25 i/s, 1080 × 1920.
 * Déterministe : tout se calcule depuis le numéro d'image (aucun hasard, aucune horloge).
 */
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { Stylo } from "../commune/stylo/Stylo";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../commune/polices";
import { PageEcrite } from "./PageEcrite";
import { adoucir } from "../../../src/briques/stylo/courbes";
import { planifierScene, planPagePleine, poseStylo } from "./plan";
import type { ProprietesTableauScene } from "./types";
import { TableauV2 } from "./v2/EcranV2";
import { PageReference } from "./reference/PageReference";
import { PageReference3 } from "./reference/PageReference3";
import { PageTableau } from "./trois-styles/PageTableau";

export function TableauScene(p: ProprietesTableauScene) {
  chargerPoliceTitre();
  chargerPoliceMontserrat();
  // Style « blocs/2 » (vidéo modèle « Formation ») : écrans à fonds pleins, titres en blocs ; sinon la page écrite.
  if (p.v2) return <TableauV2 p={p} />;
  // Style « reference/1 » (reel de référence « tableau blanc ») : la page blanche que le crayon écrit, bloc après bloc.
  // Style « reference/3 » (gabarit par parties) : étiquette de partie, barre de progression, visuels, appel plein cadre.
  // Trois styles du tableau (16/10/2026, maquettes validées PR #280) : tableau blanc, ardoise, paperboard.
  if (p.styleReference?.style === "reference/3") return p.styleReference.tableau ? <PageTableau p={p} /> : <PageReference3 p={p} />;
  if (p.styleReference) return <PageReference p={p} />;
  return <PageScene {...p} />;
}

function PageScene(p: ProprietesTableauScene) {
  const image = useCurrentFrame();
  const plan = useMemo(() => planifierScene(p), [p]);
  const precedente = useMemo(() => (p.pagePrecedente ? planPagePleine(p, p.pagePrecedente) : null), [p]);
  const t = image / plan.fps;
  const W = plan.largeur;
  const H = plan.hauteur;
  const bande = p.bandeSousTitres.px;
  const tourner = plan.actions.find((a) => a.sorte === "tourner");
  const e = tourner ? adoucir((t - tourner.debut) / Math.max(1e-6, tourner.duree)) : 1;
  const { pointe, angle } = poseStylo(plan, t);
  // Bord de la page qui glisse : une ombre légère (écriture très transparente), seulement pendant le geste.
  const ombre = `${Math.round(W * 0.012)}px 0 ${Math.round(W * 0.03)}px ${COULEURS_VIDEO.ecriture}33`;
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_VIDEO.page, overflow: "hidden" }}>
      {/* Tout le contenu (et le crayon) reste au-dessus de la bande des sous-titres. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: bande.y, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: e < 1 ? `translateX(${((1 - e) * W).toFixed(2)}px)` : undefined, backgroundColor: COULEURS_VIDEO.page }}>
          <PageEcrite plan={plan} page={p.page} t={t} importants={p.importants} />
        </div>
        {precedente && p.pagePrecedente && e < 1 && (
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateX(${(-e * W).toFixed(2)}px)`, backgroundColor: COULEURS_VIDEO.page, boxShadow: ombre }}>
            <PageEcrite plan={precedente} page={p.pagePrecedente} t={t} importants={p.importants} />
          </div>
        )}
        <Stylo id={p.stylo} x={pointe.x} y={pointe.y} hauteur={plan.hauteurStylo} angle={angle} />
      </div>
    </AbsoluteFill>
  );
}
