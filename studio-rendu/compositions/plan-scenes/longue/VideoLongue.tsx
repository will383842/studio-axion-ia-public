/**
 * Composition « VideoLongue » (16:9, 25 i/s) : la scène courante, la précédente dessous pendant la transition d'entrée,
 * la bande des sous-titres et le sous-titre. Tout vient de `mise-en-page.ts` (le contrôle voit la même chose).
 */
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { ORIGINE_ZOOM_Y, ZOOM_SCENE, poserScene, poserSousTitre, repereChapitre, sceneAvecBande, sousTitreRedondant, logoFin } from "../../../../src/moteurs/montage-video-longue/mise-en-page";
import { COULEURS_LONGUE, TEMPS_LONGUE, ZONES_LONGUE, type ProprietesVideoLongue, type SceneLongue } from "../../../../src/moteurs/montage-video-longue/storyboard-types";
import logo from "../../commune/fin/logo-axion-fond-sombre.png";
import { DessinElement } from "./DessinElement";
import { chargerPoliceLongue } from "./police";

const fondDe = (s: SceneLongue) => (s.fond === "noir" ? COULEURS_LONGUE.noir : COULEURS_LONGUE.ivoire);

function Couche({ scene, t, style }: { scene: SceneLongue; t: number; style?: React.CSSProperties }) {
  const bande = sceneAvecBande(scene.type);
  const lg = scene.type === "fin" ? logoFin(scene) : { x: 0, y: 0, hauteur: 0, largeur: 0 };
  // Zoom lent du groupe de scène (1 → 1,06 sur la durée de la scène) : jamais deux images identiques.
  const avance = Math.min(1, Math.max(0, (t - scene.debutMs) / Math.max(1, scene.finMs - scene.debutMs)));
  const zoom = 1 + (ZOOM_SCENE - 1) * avance;
  const centreY = bande ? ORIGINE_ZOOM_Y : 540;
  const entreeLogo = Math.min(1, Math.max(0, (t - scene.debutMs) / 300));
  return (
    <AbsoluteFill style={{ background: fondDe(scene), overflow: "hidden", ...style }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `960px ${centreY}px` }}>
        {poserScene(scene, t).map((el) => (
          <DessinElement key={el.id} el={el} tMs={t} />
        ))}
        {scene.type === "fin" && <Img src={logo} style={{ position: "absolute", left: lg.x, top: lg.y, height: lg.hauteur, width: lg.largeur, opacity: entreeLogo, transform: `translateY(${20 * (1 - entreeLogo)}px) scale(${1 + 0.02 * Math.sin(t / 700)})` }} />}
      </AbsoluteFill>
      {bande && (
        <div style={{ position: "absolute", left: 0, top: ZONES_LONGUE.bandeSousTitres.y, width: 1920, height: ZONES_LONGUE.bandeSousTitres.hauteur, background: COULEURS_LONGUE.gris }}>
          <div style={{ height: 4, background: COULEURS_LONGUE.terracotta }} />
        </div>
      )}
    </AbsoluteFill>
  );
}

export function VideoLongue({ storyboard }: ProprietesVideoLongue) {
  chargerPoliceLongue();
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (image * 1000) / fps;
  const scenes = storyboard.scenes;
  if (!scenes.length) return <AbsoluteFill style={{ background: COULEURS_LONGUE.ivoire }} />;
  let idx = scenes.findIndex((s) => t >= s.debutMs && t < s.finMs);
  if (idx < 0) idx = t < scenes[0].debutMs ? 0 : scenes.length - 1;
  const s = scenes[idx];
  const tl = t - s.debutMs;
  const p = Math.min(1, Math.max(0, tl / TEMPS_LONGUE.transitionMs));
  const prev = idx > 0 && p < 1 && s.entree !== "aucune" ? scenes[idx - 1] : null;
  const e = 1 - (1 - p) ** 3;
  let contenu;
  if (!prev) contenu = <Couche scene={s} t={t} />;
  else if (s.entree === "fondu") {
    contenu = (
      <>
        <Couche scene={prev} t={t} />
        <Couche scene={s} t={t} style={{ opacity: e }} />
      </>
    );
  } else if (s.entree === "glisse") {
    contenu = (
      <>
        <Couche scene={prev} t={t} style={{ transform: `translateX(${-80 * e}px)` }} />
        <Couche scene={s} t={t} style={{ opacity: e, transform: `translateX(${80 * (1 - e)}px)` }} />
      </>
    );
  } else {
    // Volet : un aplat terracotta balaie l'image de gauche à droite ; la scène change quand il la couvre.
    const q = p;
    const couvre = q < 0.5;
    const gauche = couvre ? 0 : (q - 0.5) * 2 * 1920;
    const droite = couvre ? q * 2 * 1920 : 1920;
    contenu = (
      <>
        <Couche scene={couvre ? prev : s} t={t} />
        <div style={{ position: "absolute", left: gauche, top: 0, width: droite - gauche, height: 1080, background: COULEURS_LONGUE.terracotta }} />
      </>
    );
  }
  const ligne = storyboard.sousTitres.find((l) => t >= l.debutMs && t < l.finMs);
  // Quand la scène affiche déjà la phrase lue mot pour mot, la bande montre le repère du chapitre au lieu de la répéter.
  const chapitre = storyboard.chapitres.find((c) => c.id === s.chapitreId);
  const repere = ligne && chapitre && sousTitreRedondant(s, ligne) ? repereChapitre(chapitre.rang, chapitre.titre) : undefined;
  const sous = ligne && sceneAvecBande(s.type) ? poserSousTitre(ligne, t, repere) : null;
  return (
    <AbsoluteFill style={{ background: fondDe(s), overflow: "hidden" }}>
      {contenu}
      {sous && <DessinElement el={sous} tMs={t} />}
    </AbsoluteFill>
  );
}
