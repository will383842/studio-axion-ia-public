/**
 * N° 8 `arche-bas` (lot B, standard v3 § G, refonte après critique du 16/10) : une GRANDE ARCHE verticale de vidéo, sur le
 * CÔTÉ DROIT (miroir : gauche), qui monte depuis le bas du cadre ; visage ENTIER.
 *
 * Forme K8 : rectangle dont le haut est un demi-cercle complet, 0,21 L × 0,57 H (≈ 11 % de l'image), x 0,765 → 0,975 L
 * (entièrement dans le cadre), posée à +1,5° (la colonne x > 0,75 L est la seule place libre à côté de la zone du visage).
 * Matière « verre » en FAUX VERRE (cadre ivoire à 88 % sans flou d'arrière-plan : standard § D.6), liseré et reflet en haut.
 * B-roll vertical littéral (homme à la tablette sur un chantier). Puce v3 de 52 px qui chevauche le bas de l'arche (plan P2).
 * Entrée N2 « bascule depuis le bas » en perspective 1400 px : translation de 0,9 H à 0 avec `VERRE` (sans dépassement vers
 * le haut), rotateX de 20° à 0 avec `PIVOT` (charnière en bas). Vie à la pose : flottement (±0,4 % H, ±0,5°) et reflet qui
 * passe à i14 et i46. Sortie : rechute complète vers le bas en 6 images (rotateX vers 30°, `Easing.in(cubic)`, flou vertical)
 * jusqu'à sortir du cadre : aucun reste.
 * Profondeur (V6) : perspective rotateX, ombre en 3 couches, mise au point, flou de mouvement vertical, puce P2.
 */
import React from "react";
import { Easing } from "remotion";
import { NUANCES, alpha } from "../../variantes/premium-2";
import { Bruitages, FPS, FlouDir, Glint, Puce, VideoCover, Vignette, borne, courbe, flotte, largeurPuce, ombres, ressort } from "./commun-lotB";

export type ArcheBasProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  src: string;
  etiquette: string;
  cote?: "droite" | "gauche";
  depuisImage?: number;
};

export function ArcheBas(p: ArcheBasProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const s = p.cote === "gauche" ? -1 : 1;
  const i = (p.t - p.debut) * FPS;
  const iSortie = Math.round((p.fin - p.debut) * FPS) - 7;
  const w = 0.21 * W;
  const top = 0.09 * H;
  const h = 0.57 * H;
  const left = s === 1 ? 0.765 * W : W - 0.765 * W - w;
  const cadre = 0.012 * W;

  const entree = Math.min(1, ressort("VERRE", i)); // pas de dépassement vers le haut
  const pivot = ressort("PIVOT", i);
  const chute = courbe(i, iSortie, 6, Easing.in(Easing.cubic));
  const vie = i > 14 && chute === 0 ? borne((i - 14) / 6) : 0;
  const ty = (1 - entree) * 0.95 * H + chute * 1.0 * H + vie * flotte(i) * 0.004 * H;
  const rx = 20 * (1 - borne(pivot, 0, 1.3)) + 30 * chute;
  const rz = s * (1.5 + vie * flotte(i, 20) * 0.5);
  const flou = (1 - courbe(i, 0, 4)) * 0.008 * W;
  const vitesse = Math.abs(ressort("VERRE", i) - ressort("VERRE", i - 1)) * 0.09 * H + chute * 0.03 * W;
  const rayonHaut = `${w / 2}px ${w / 2}px 0 0`;
  const rayonVideo = `${w / 2 - cadre}px ${w / 2 - cadre}px 0 0`;

  const taille = 0.048 * W;
  const lp = largeurPuce(p.etiquette, taille);
  const xPuce = s === 1 ? 0.975 * W - lp : 0.025 * W;
  const yPuce = top + h - 0.045 * H;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1400, perspectiveOrigin: `${s === 1 ? 80 : 20}% 100%` }}>
      <Bruitages
        debut={p.debut}
        liste={[
          [2, "whoosh-in", 0.6],
          [8, "drop_002", 0.8],
          [iSortie, "whoosh-out", 0.7],
        ]}
      />
      <FlouDir sx={0} sy={Math.min(0.02 * W, vitesse)} style={{ transform: `translateY(${ty}px) rotateX(${rx}deg) rotateZ(${rz}deg)`, transformOrigin: `${left + w / 2}px ${top + h}px` }}>
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: w,
            height: h,
            borderRadius: rayonHaut,
            background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.9)} 0%, ${alpha(NUANCES.ivoireCreux, 0.88)} 100%)`,
            boxShadow: [ombres(W, 1), `inset 0 ${0.0025 * W}px 0 ${alpha(NUANCES.ivoire, 0.8)}`].join(", "),
            filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
          }}
        >
          <div style={{ position: "absolute", left: cadre, top: cadre, right: cadre, bottom: cadre, borderRadius: `${w / 2 - cadre}px ${w / 2 - cadre}px ${cadre * 2}px ${cadre * 2}px`, overflow: "hidden", background: NUANCES.encreDouce }}>
            <VideoCover src={p.src} debut={p.debut} largeur={w - 2 * cadre} hauteur={h - 2 * cadre} depuisImage={p.depuisImage} />
            <Vignette gloss={false} />
            <Glint i={i} i0={14} W={W} largeur={w} />
            <Glint i={i} i0={46} W={W} largeur={w} />
            <div style={{ position: "absolute", inset: 0, borderRadius: rayonVideo, boxShadow: `inset 0 0 0 ${0.003 * W}px ${alpha(NUANCES.ivoire, 0.45)}`, pointerEvents: "none" }} />
          </div>
        </div>
        <Puce texte={p.etiquette} W={W} i={i} i0={7} iSortie={iSortie} x={xPuce} y={yPuce} taille={taille} inclinaison={-2 * s} decalage={{ x: 0, y: 0.03 * W }} />
      </FlouDir>
    </div>
  );
}
