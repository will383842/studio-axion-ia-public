/**
 * « CaptureEcran » (G5-04) : fausse fenêtre d'application qui montre une capture d'écran. La géométrie vient de
 * `captureEcran` (pure). L'image est l'adresse `src` DÉJÀ signée par le Studio : le rendu ne signe ni ne télécharge rien.
 * Sans `src` : fenêtre vide neutre. Imports relatifs seulement.
 */
import { AbsoluteFill, Img } from "remotion";
import { captureEcran, type OptionsCapture } from "../../../src/briques/plan-scenes/tutoriel/capture";
import { CHARTE_AXION } from "../../../src/briques/jetons-motion";

export function CaptureEcran(p: OptionsCapture) {
  const g = captureEcran(p);
  if (!g) return <AbsoluteFill />;
  const { fenetre, barre, image } = g;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: fenetre.x, top: fenetre.y, width: fenetre.largeur, height: fenetre.hauteur, borderRadius: 28, background: CHARTE_AXION.ivoire, boxShadow: `0 0 0 2px ${CHARTE_AXION.gris}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: fenetre.largeur, height: barre.hauteur, background: CHARTE_AXION.gris }} />
        {barre.points.map((pt, i) => (
          <span key={i} style={{ position: "absolute", left: pt.cx - fenetre.x - pt.rayon, top: pt.cy - fenetre.y - pt.rayon, width: pt.rayon * 2, height: pt.rayon * 2, borderRadius: pt.rayon, background: CHARTE_AXION[pt.couleur] }} />
        ))}
        <div style={{ position: "absolute", left: image.x - fenetre.x, top: image.y - fenetre.y, width: image.largeur, height: image.hauteur, overflow: "hidden", background: CHARTE_AXION.ivoire }}>
          {g.src ? <Img src={g.src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${g.zoom})`, transformOrigin: `${g.origineZoom.x}% ${g.origineZoom.y}%` }} /> : null}
        </div>
      </div>
      {g.curseur ? (
        <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: "absolute", left: g.curseur.x, top: g.curseur.y }}>
          <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={CHARTE_AXION.noir} stroke={CHARTE_AXION.ivoire} strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}
