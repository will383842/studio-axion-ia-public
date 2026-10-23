/**
 * N° 6 `cercle-epaule` (lot B, standard v3 § G, refonte après critique du 16/10) : un GRAND CERCLE de vidéo sous l'épaule,
 * ENTIÈREMENT dans le cadre, avec un ANNEAU orange décalé qui se trace puis tourne ; visage ENTIER (le cercle reste sous 0,62 H).
 *
 * Forme K6 : diamètre 0,52 L (≈ 12 % de l'image), centre (0,70 L ; 0,76 H) à droite, ou (0,30 L ; 0,76 H) en miroir ; anneau
 * de 0,010 L. Plus de pastille éclair (retirée sur la critique). B-roll carré net et vivant (chantier).
 * Entrée N3 « ouverture de masque » depuis le centre : le MASQUE passe d'un point à sa taille finale avec `POSER` ; la vidéo
 * reste FIXE dessous (pas de zoom). L'anneau (dégradé orange → orange voile pour que sa rotation se VOIE) se trace en 9
 * images puis tourne. Vie à la pose : flottement et reflet qui passe à i11 et i44. Sortie : aspiration vers le bord de
 * l'image (rétrécit + file hors cadre, `FOUET`, flou directionnel horizontal) ; plus rien à l'écran à la dernière image.
 * Profondeur (V6) : ombre en 3 couches, mise au point à l'entrée, flou de mouvement à la sortie, anneau décalé.
 */
import React, { useId } from "react";
import { Easing } from "remotion";
import { NUANCES, alpha } from "../../variantes/premium-2";
import { Bruitages, FPS, FlouDir, Glint, Lisere, VideoCover, Vignette, borne, courbe, flotte, ressort } from "./commun-lotB";

export type CercleEpauleProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  src: string;
  cote?: "droite" | "gauche";
  depuisImage?: number;
};

export function CercleEpaule(p: CercleEpauleProps) {
  const id = `an${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const s = p.cote === "gauche" ? -1 : 1;
  const i = (p.t - p.debut) * FPS;
  const iSortie = Math.round((p.fin - p.debut) * FPS) - 7;
  const R = 0.26 * W;
  const cx = s === 1 ? 0.7 * W : 0.3 * W;
  const cy = 0.76 * H;

  const pose = ressort("POSER", i);
  const sortie = ressort("FOUET", i - iSortie);
  const q = courbe(i, iSortie, 6, Easing.in(Easing.cubic));
  const vie = i > 12 && q === 0 ? borne((i - 12) / 6) : 0;
  const r = R * borne(pose, 0, 1.04) * (1 - 0.5 * q);
  const tx = s * 0.55 * W * sortie;
  const ty = vie * flotte(i) * 0.004 * H;
  const flou = (1 - courbe(i, 0, 4)) * 0.008 * W;
  const vitesse = q * 0.024 * W;

  const rAnneau = r + 0.012 * W + 0.005 * W;
  const trace = courbe(i, 3, 9, Easing.bezier(0.33, 0, 0.2, 1));
  const circ = 2 * Math.PI * rAnneau;
  const rotation = i * 0.4 * s;
  const tailleSvg = 2 * (R + 0.05 * W);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Bruitages
        debut={p.debut}
        liste={[
          [0, "select_002", 0.9],
          [9, "tick_002", 0.6],
          [iSortie, "whoosh-out", 0.7],
        ]}
      />
      <FlouDir sx={vitesse} style={{ transform: `translate(${tx}px, ${ty}px)` }}>
        <div style={{ position: "absolute", inset: 0, filter: ombresFiltreCercle(W) }}>
          <div
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: "50%",
              overflow: "hidden",
              filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
              background: alpha(NUANCES.encreDouce, 0.9),
            }}
          >
            <div style={{ position: "absolute", left: r - R, top: r - R, width: 2 * R, height: 2 * R }}>
              <VideoCover src={p.src} debut={p.debut} largeur={2 * R} hauteur={2 * R} depuisImage={p.depuisImage} />
              <Vignette gloss={false} />
              <Glint i={i} i0={11} W={W} largeur={2 * R} />
              <Glint i={i} i0={44} W={W} largeur={2 * R} />
            </div>
            <Lisere W={W} rayon="50%" />
          </div>
        </div>
        {i >= 3 ? (
          <svg width={tailleSvg} height={tailleSvg} viewBox={`${-tailleSvg / 2} ${-tailleSvg / 2} ${tailleSvg} ${tailleSvg}`} style={{ position: "absolute", left: cx - tailleSvg / 2, top: cy - tailleSvg / 2, overflow: "visible" }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={NUANCES.orangeProfond} />
                <stop offset="55%" stopColor={NUANCES.orange} />
                <stop offset="100%" stopColor={NUANCES.orangeVoile} />
              </linearGradient>
            </defs>
            <g transform={`rotate(${-90 + rotation})`}>
              <circle r={rAnneau} fill="none" stroke={`url(#${id})`} strokeWidth={0.01 * W} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - trace)} />
            </g>
          </svg>
        ) : null}
      </FlouDir>
    </div>
  );
}

function ombresFiltreCercle(W: number): string {
  return [
    `drop-shadow(0 ${0.004 * W}px ${0.005 * W}px ${alpha(NUANCES.encre, 0.2)})`,
    `drop-shadow(0 ${0.018 * W}px ${0.022 * W}px ${alpha(NUANCES.encre, 0.24)})`,
    `drop-shadow(0 ${0.045 * W}px ${0.055 * W}px ${alpha(NUANCES.encre, 0.16)})`,
  ].join(" ");
}
