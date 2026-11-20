/**
 * « NavigationFilmee » (T-EXT-38, motion T-EXT-44) : le film de la navigation (vidéo de la maquette, muette) posé sans
 * rognage, sous la caméra (zoom fluide), puis le projecteur (le reste de l'écran s'assombrit, la zone garde ses couleurs,
 * cadre terracotta), le curseur (en arc, pression et anneau au clic) et le volet « avant → maintenant » (sans texte).
 * Tout le temps et toute la géométrie viennent de `navigation-filmee.ts` / `motion-film.ts` (purs) : aucune logique de
 * temps ici. Couleurs de `CHARTE_AXION` seulement. Imports relatifs seulement.
 */
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, avecOpacite } from "../../../src/briques/jetons-motion";
import { OPACITE_PROJECTEUR, cameraA, curseurA, placementFilm, projecteurA, voletA, type NavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";

export function NavigationFilmee({ film, navigation }: { film: string; navigation: Omit<NavigationFilmee, "videoCle"> }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const format = { largeur: width, hauteur: height };
  // T-EXT-53c : `navigation.reglagesFilm` (crans du chat de retouche) voyage avec la navigation jusqu'à `motion-film` // en attendant T-EXT-53a.
  const nav = { ...navigation, videoCle: film } as NavigationFilmee & { reglagesFilm?: unknown };
  const t = (frame * 1000) / fps;
  const place = placementFilm(nav, format);
  const cam = cameraA(nav, t, format);
  const cadre = projecteurA(nav, t, format);
  const curseur = curseurA(nav, t, format);
  const volet = voletA(nav, t, format);
  const clic = curseur?.clic ?? 0;
  const anneau = curseur?.anneau ?? 0;
  const noir = cadre ? avecOpacite(CHARTE_AXION.noir, OPACITE_PROJECTEUR * cadre.opacite) : "transparent";
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire }}>
      <AbsoluteFill style={{ transform: `scale(${cam.echelle})`, transformOrigin: `${cam.origineXPct}% ${cam.origineYPct}%` }}>
        <div style={{ position: "absolute", left: place.x, top: place.y, width: place.largeur, height: place.hauteur, overflow: "hidden" }}>
          <OffthreadVideo src={film} muted trimBefore={Math.round((nav.debutFilmMs * fps) / 1000)} style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </div>
      </AbsoluteFill>
      {cadre ? (
        <>
          {/* Quatre bandes sombres autour de la zone : la zone garde ses couleurs. */}
          <div style={{ position: "absolute", left: 0, top: 0, width, height: Math.max(0, cadre.y), background: noir }} />
          <div style={{ position: "absolute", left: 0, top: cadre.y + cadre.hauteur, width, height: Math.max(0, height - cadre.y - cadre.hauteur), background: noir }} />
          <div style={{ position: "absolute", left: 0, top: cadre.y, width: Math.max(0, cadre.x), height: cadre.hauteur, background: noir }} />
          <div style={{ position: "absolute", left: cadre.x + cadre.largeur, top: cadre.y, width: Math.max(0, width - cadre.x - cadre.largeur), height: cadre.hauteur, background: noir }} />
          <div style={{ position: "absolute", left: cadre.x, top: cadre.y, width: cadre.largeur, height: cadre.hauteur, boxSizing: "border-box", border: `${cadre.epaisseur}px solid ${CHARTE_AXION.terracotta}`, borderRadius: 14, opacity: cadre.opacite }} />
        </>
      ) : null}
      {curseur ? (
        <>
          {anneau > 0 ? <span style={{ position: "absolute", left: curseur.xPx - 40, top: curseur.yPx - 40, width: 80, height: 80, boxSizing: "border-box", borderRadius: 40, border: `4px solid ${CHARTE_AXION.terracotta}`, opacity: 1 - anneau, transform: `scale(${0.4 + anneau * 0.9})` }} /> : null}
          <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: "absolute", left: curseur.xPx - 1, top: curseur.yPx - 1, transform: `scale(${1 - 0.1 * clic})`, transformOrigin: "2px 2px" }}>
            <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={CHARTE_AXION.noir} stroke={CHARTE_AXION.ivoire} strokeWidth={1.6} strokeLinejoin="round" />
          </svg>
        </>
      ) : null}
      {volet ? (
        <>
          {/* Volet net : un panneau ivoire bordé d'un filet terracotta ; aucun texte. */}
          <div style={{ position: "absolute", left: volet.arriereXPx, top: 0, width: volet.avantXPx - volet.arriereXPx, height, background: CHARTE_AXION.ivoire }} />
          <div style={{ position: "absolute", left: volet.avantXPx - volet.filetPx, top: 0, width: volet.filetPx, height, background: CHARTE_AXION.terracotta }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
}
