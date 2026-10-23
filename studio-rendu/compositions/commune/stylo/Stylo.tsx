/**
 * Pose le stylo (pièce B) : la POINTE est à la position demandée, l'image est inclinée autour d'elle. Le stylo vient du
 * registre `src/briques/stylo` (identifiant « crayon/1 ») : aucune couleur ni police ici, tout vient de l'habillage.
 * L'image est le SVG embarqué (data URI) : rien à copier dans l'image du rendu.
 */
import type { CSSProperties } from "react";
import { STYLO_PAR_DEFAUT, stylo } from "../../../../src/briques/stylo/registre";
import { COULEURS_VIDEO } from "../../../../src/briques/habillage/charte-video";

export interface ProprietesStylo {
  /** Identifiant du stylo (« crayon/1 »). */
  id?: string;
  /** Position de la pointe dans la composition (px). */
  x: number;
  y: number;
  /** Hauteur de l'image (px) ; la largeur suit le rapport de l'image. */
  hauteur: number;
  /** Écrase l'inclinaison au repos du stylo (degrés). */
  angle?: number;
  opacite?: number;
  style?: CSSProperties;
}

export function Stylo({ id = STYLO_PAR_DEFAUT, x, y, hauteur, angle, opacite = 1, style }: ProprietesStylo) {
  const s = stylo(id);
  const largeur = (hauteur * s.largeur) / s.hauteur;
  const px = s.pointe.x * largeur;
  const py = s.pointe.y * hauteur;
  const o = s.ombre;
  const ombre = `drop-shadow(${(o.decalage.x * hauteur).toFixed(2)}px ${(o.decalage.y * hauteur).toFixed(2)}px ${(o.flou * hauteur).toFixed(2)}px ${hexVersRgba(COULEURS_VIDEO.ecriture, o.opacite)})`;
  return (
    <img
      alt=""
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`}
      style={{
        position: "absolute",
        left: x - px,
        top: y - py,
        width: largeur,
        height: hauteur,
        transformOrigin: `${px}px ${py}px`,
        transform: `rotate(${angle ?? s.angle}deg)`,
        filter: ombre,
        opacity: opacite,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

function hexVersRgba(hex: string, opacite: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`;
}
