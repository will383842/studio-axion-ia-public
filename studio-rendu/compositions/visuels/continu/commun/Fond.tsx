/**
 * Fond de la toile, dessiné d'UN seul tenant sur N × 1080 px (aucune page ne coupe un halo) : crème, fonds sombres par page, halos
 * `radial-gradient` aux positions déclarées (coordonnées de la toile). Le grain (`Grain`) est un motif SVG `feTurbulence` en image de fond
 * carrelée de 260 px : calculé une fois, répété (jamais un filtre sur toute la toile).
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { CARREAU_GRAIN, LARGEUR_PAGE } from "../constantes-continu";

export interface Halo {
  /** Centre, en px de la toile. */
  x: number;
  y: number;
  /** Rayon horizontal (px) ; le vertical vaut 78 %. */
  r: number;
  /** Opacité de l'orange au centre (0,18 dans la maquette). */
  a?: number;
}

/**
 * Grain de la maquette (`.pg:after`), un SVG de 260 × 260 en base64 : `feTurbulence` fractalNoise (fréquence 0,85, 2 octaves, `stitchTiles` :
 * le carreau se raccorde à lui-même), puis `feColorMatrix` brun (0,35 / 0,22 / 0,10) à 22 % d'opacité, appliqué à un rectangle plein.
 */
const GRAIN = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNjAnIGhlaWdodD0nMjYwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nLjg1JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdmFsdWVzPScwIDAgMCAwIC4zNSAwIDAgMCAwIC4yMiAwIDAgMCAwIC4xIDAgMCAwIC4yMiAwJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI24pJy8+PC9zdmc+")`;

export function Fond({ pages, hauteur, sombres, halos }: { pages: number; hauteur: number; sombres: readonly number[]; halos: readonly Halo[] }) {
  const degrades = halos.map((h) => `radial-gradient(${h.r}px ${Math.round(h.r * 0.78)}px at ${h.x}px ${h.y}px, ${alpha(C.orange, h.a ?? 0.18)}, transparent 62%)`);
  return (
    <div data-fond="" style={{ position: "absolute", left: 0, top: 0, width: pages * LARGEUR_PAGE, height: hauteur, background: C.creme }}>
      {sombres.map((i) => (
        <div key={i} style={{ position: "absolute", left: i * LARGEUR_PAGE, top: 0, width: LARGEUR_PAGE, height: hauteur, background: C.encre }} />
      ))}
      {degrades.length ? <div style={{ position: "absolute", inset: 0, background: degrades.join(", ") }} /> : null}
    </div>
  );
}

/** Grain posé AU-DESSUS du contenu (maquette : `z-index 9`, multiplication à 50 % ; écran à 35 % sur une page sombre). */
export function Grain({ pages, hauteur, sombres }: { pages: number; hauteur: number; sombres: readonly number[] }) {
  const motif = { backgroundImage: GRAIN, backgroundSize: `${CARREAU_GRAIN}px ${CARREAU_GRAIN}px`, backgroundRepeat: "repeat", pointerEvents: "none" } as const;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: pages * LARGEUR_PAGE, height: hauteur, opacity: 0.5, mixBlendMode: "multiply", ...motif }} />
      {sombres.map((i) => (
        <div key={i} style={{ position: "absolute", left: i * LARGEUR_PAGE, top: 0, width: LARGEUR_PAGE, height: hauteur, opacity: 0.35, mixBlendMode: "screen", backgroundPosition: `${-i * LARGEUR_PAGE}px 0`, ...motif }} />
      ))}
    </>
  );
}
