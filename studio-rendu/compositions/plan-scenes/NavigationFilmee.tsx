/**
 * « NavigationFilmee » (T-EXT-38) : le film de la navigation (vidéo de la maquette, muette) posé sans rognage, sous la
 * caméra (zoom), puis la surbrillance de la zone et le curseur (dessinés APRÈS la caméra : ils ne glissent pas pendant
 * le zoom). Toute la géométrie vient de `navigation-filmee.ts` (pur). Aucun mot à l'écran. Imports relatifs seulement.
 */
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION } from "../../../src/briques/jetons-motion";
import { cameraA, curseurA, placementFilm, surbrillanceA, type NavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";

export function NavigationFilmee({ film, navigation }: { film: string; navigation: Omit<NavigationFilmee, "videoCle"> }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const format = { largeur: width, hauteur: height };
  const nav = { ...navigation, videoCle: film } as NavigationFilmee;
  const t = (frame * 1000) / fps;
  const place = placementFilm(nav, format);
  const cam = cameraA(nav, t, format);
  const cadre = surbrillanceA(nav, t, format);
  const curseur = curseurA(nav, t, format);
  const clic = curseur?.clic ?? 0;
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire }}>
      <AbsoluteFill style={{ transform: `scale(${cam.echelle})`, transformOrigin: `${cam.origineXPct}% ${cam.origineYPct}%` }}>
        <div style={{ position: "absolute", left: place.x, top: place.y, width: place.largeur, height: place.hauteur, overflow: "hidden" }}>
          <OffthreadVideo src={film} muted trimBefore={Math.round((nav.debutFilmMs * fps) / 1000)} style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </AbsoluteFill>
      {cadre ? <div style={{ position: "absolute", left: cadre.x, top: cadre.y, width: cadre.largeur, height: cadre.hauteur, boxSizing: "border-box", border: `${cadre.epaisseur}px solid ${CHARTE_AXION.terracotta}`, borderRadius: 14, opacity: cadre.opacite }} /> : null}
      {curseur ? (
        <>
          {clic > 0 ? <span style={{ position: "absolute", left: curseur.xPx - 40, top: curseur.yPx - 40, width: 80, height: 80, boxSizing: "border-box", borderRadius: 40, border: `4px solid ${CHARTE_AXION.terracotta}`, opacity: 1 - clic * 0.6, transform: `scale(${0.4 + clic * 0.9})` }} /> : null}
          <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: "absolute", left: curseur.xPx - 1, top: curseur.yPx - 1, transform: `scale(${1 - 0.1 * clic})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(20,20,19,0.35))" }}>
            <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={CHARTE_AXION.noir} stroke={CHARTE_AXION.ivoire} strokeWidth={1.6} strokeLinejoin="round" />
          </svg>
        </>
      ) : null}
    </AbsoluteFill>
  );
}
