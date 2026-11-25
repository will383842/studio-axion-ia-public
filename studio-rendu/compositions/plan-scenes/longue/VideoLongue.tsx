/**
 * Composition « VideoLongue » (16:9, 25 i/s) : la scène courante, la précédente dessous pendant la transition d'entrée,
 * la bande des sous-titres et le sous-titre. Tout vient de `mise-en-page.ts` (le contrôle voit la même chose).
 */
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { poserScene, poserSousTitre, repereChapitre, sceneAvecBande, sousTitreRedondant, logoFin, zoomScene } from "../../../../src/moteurs/montage-video-longue/mise-en-page";
import { COULEURS_LONGUE, TEMPS_LONGUE, ZONES_LONGUE, type ProprietesVideoLongue, type SceneLongue } from "../../../../src/moteurs/montage-video-longue/storyboard-types";
import logo from "../../commune/fin/logo-axion-fond-sombre.png";
import { DessinElement } from "./DessinElement";
import { chargerPoliceLongue } from "./police";

const fondDe = (s: SceneLongue) => (s.fond === "noir" ? COULEURS_LONGUE.noir : COULEURS_LONGUE.ivoire);

function Couche({ scene, t, style }: { scene: SceneLongue; t: number; style?: React.CSSProperties }) {
  const bande = sceneAvecBande(scene.type);
  const lg = scene.type === "fin" ? logoFin(scene) : { x: 0, y: 0, hauteur: 0, largeur: 0 };
  // Zoom lent du groupe de scène, calculé par la mise en page (jamais au point de sortir le contenu des marges).
  const zoom = zoomScene(scene, t);
  const entreeLogo = Math.min(1, Math.max(0, (t - scene.debutMs) / 300));
  return (
    <AbsoluteFill style={{ background: fondDe(scene), overflow: "hidden", ...style }}>
      <AbsoluteFill style={{ transform: `scale(${zoom.echelle})`, transformOrigin: `${zoom.x}px ${zoom.y}px` }}>
        {poserScene(scene, t).map((el) => (
          <DessinElement key={el.id} el={el} tMs={t} />
        ))}
        {scene.type === "fin" && <Img src={logo} style={{ position: "absolute", left: lg.x, top: lg.y, height: lg.hauteur, width: lg.largeur, opacity: entreeLogo, transform: `translateY(${20 * (1 - entreeLogo) + 6 * Math.sin((2 * Math.PI * (t - scene.debutMs)) / 3000)}px) scale(${1 + 0.02 * Math.sin(t / 700)})` }} />}
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
  let contenu;
  if (!prev) contenu = <Couche scene={s} t={t} />;
  else if (s.entree === "fondu") {
    // Fondu enchaîné sans superposition de texte : la scène sortante disparaît (0 → 200 ms), PUIS l'entrante apparaît (200 → 400 ms).
    const sortie = 1 - Math.min(1, Math.max(0, tl / 200));
    const entree = Math.min(1, Math.max(0, (tl - 200) / 200));
    contenu = (
      <>
        <Couche scene={prev} t={t} style={{ opacity: sortie }} />
        <Couche scene={s} t={t} style={{ opacity: entree }} />
      </>
    );
  } else if (s.entree === "glisse") {
    // Même séquence, avec un glissement de 40 px seulement : aucune lettre n'atteint le bord de l'image.
    const sortie = Math.min(1, Math.max(0, tl / 200));
    const entree = Math.min(1, Math.max(0, (tl - 200) / 200));
    const ee = 1 - (1 - entree) ** 3;
    contenu = (
      <>
        <Couche scene={prev} t={t} style={{ opacity: 1 - sortie, transform: `translateX(${-40 * sortie}px)` }} />
        <Couche scene={s} t={t} style={{ opacity: ee, transform: `translateX(${40 * (1 - ee)}px)` }} />
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
      {/* La bande reste à sa place pendant un fondu entre deux scènes à bande (aucun trou quand les deux couches sont transparentes). */}
      {prev && sceneAvecBande(prev.type) && sceneAvecBande(s.type) && (
        <div style={{ position: "absolute", left: 0, top: ZONES_LONGUE.bandeSousTitres.y, width: 1920, height: ZONES_LONGUE.bandeSousTitres.hauteur, background: COULEURS_LONGUE.gris }}>
          <div style={{ height: 4, background: COULEURS_LONGUE.terracotta }} />
        </div>
      )}
      {contenu}
      {sous && <DessinElement el={sous} tMs={t} />}
    </AbsoluteFill>
  );
}
