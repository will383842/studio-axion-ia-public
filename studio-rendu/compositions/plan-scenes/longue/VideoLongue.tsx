/**
 * Composition « VideoLongue » (16:9, 25 i/s) : la scène courante, la précédente dessous pendant la transition d'entrée,
 * la bande des sous-titres et le sous-titre. Tout vient de `mise-en-page.ts` (le contrôle voit la même chose).
 */
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { poserScene, poserSousTitre, repereSousTitre, sceneAvecBande, logoFin, zoomScene } from "../../../../src/moteurs/montage-video-longue/mise-en-page";
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
  // Fondu au noir vers un carton de chapitre (250 ms pour sortir, 250 ms pour entrer) ; fondu enchaîné ou glisse ailleurs (400 ms).
  const carton = s.entree === "volet";
  const duree = carton ? 500 : TEMPS_LONGUE.transitionMs;
  const prev = idx > 0 && tl < duree && s.entree !== "aucune" ? scenes[idx - 1] : null;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  // Sortie 0 → 250 ms ; entrée 150 → 400 ms (chevauchement minimal : jamais d'image vide) ; vers un carton 250 → 500 ms (fondu au noir).
  const sortie = clamp(tl / 250);
  const entree = carton ? clamp((tl - 250) / 250) : clamp((tl - 150) / 250);
  const ee = 1 - (1 - entree) ** 3;
  let contenu;
  if (!prev) contenu = <Couche scene={s} t={t} />;
  else if (s.entree === "glisse") {
    // Glissement de 40 px seulement : aucune lettre n'atteint le bord de l'image.
    contenu = (
      <>
        <Couche scene={prev} t={t} style={{ opacity: 1 - sortie, transform: `translateX(${-40 * sortie}px)` }} />
        <Couche scene={s} t={t} style={{ opacity: ee, transform: `translateX(${40 * (1 - ee)}px)` }} />
      </>
    );
  } else {
    contenu = (
      <>
        <Couche scene={prev} t={t} style={{ opacity: 1 - sortie }} />
        <Couche scene={s} t={t} style={{ opacity: entree }} />
      </>
    );
  }
  // Sous-titre : celui de l'ancienne scène (qui s'estompe avec elle) jusqu'au milieu de la transition, puis celui de la nouvelle.
  const surPrev = prev !== null && tl < duree / 2;
  const sceneSous = surPrev && prev ? prev : s;
  const ligne = surPrev ? storyboard.sousTitres.find((l) => s.debutMs - 1 >= l.debutMs && s.debutMs - 1 < l.finMs) : storyboard.sousTitres.find((l) => t >= l.debutMs && t < l.finMs);
  const repere = repereSousTitre(sceneSous, ligne ?? { texte: "", debutMs: 0, finMs: 0 }, storyboard.chapitres);
  const tSous = ligne && surPrev ? Math.min(ligne.finMs - 1, Math.max(ligne.debutMs, ligne.finMs - 200)) : t;
  const sousBrut = ligne && sceneAvecBande(sceneSous.type) ? poserSousTitre(ligne, tSous, repere) : null;
  const sous = sousBrut && surPrev ? { ...sousBrut, opacite: sousBrut.opacite * (1 - sortie) } : sousBrut;
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
