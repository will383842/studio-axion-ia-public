/**
 * N° 5 `pilule-cote` (lot B, standard v3 § G, refonte après critique du 16/10) : une PILULE VERTICALE de vidéo sur le côté
 * gauche (miroir : droite), ENTIÈREMENT dans le cadre (aucun débordement), visage ENTIER.
 *
 * Forme K5 (demi-cercles aux extrémités) de 0,214 L × 0,50 H (≈ 10 % de l'image) posée à -2,5° ; la colonne x < 0,25 L est
 * la seule place libre à côté de la zone du visage, d'où une pilule haute et fine plutôt que large (0,32 L aurait
 * traversé le visage). B-roll vertical net (chantier), en « cover » SANS ZOOM.
 * Entrée N5 « dépliage » depuis le haut en ≈ 0,55 s (la hauteur grandit, la vidéo reste FIXE) avec `POSER` pendant que la
 * rotation passe de -9° à -2,5° ; mise au point (flou → net en 4 images). Vie à la pose : flottement (±0,4 % H, ±0,7°) en
 * continu et reflet qui passe à i14 et i46. Puce v3 de 54 px qui chevauche le bas de la pilule (plan P2, parallaxe ×1,35).
 * Sortie : repliage vers le haut (`Easing.in(cubic)`, 6 images) jusqu'à 0 : aucun reste.
 * Profondeur (V6) : ombre en 3 couches, mise au point, chevauchement et parallaxe de la puce (4 indices).
 */
import React from "react";
import { Easing } from "remotion";
import { NUANCES, alpha } from "../../variantes/premium-2";
import { Bruitages, FPS, Glint, Lisere, Puce, VideoCover, Vignette, borne, courbe, flotte, largeurPuce, ombres, ressort } from "./commun-lotB";

export type PiluleCoteProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Fichier vidéo vertical (staticFile). */
  src: string;
  /** Mot dit, en puce sous la pilule. */
  etiquette: string;
  cote?: "gauche" | "droite";
  depuisImage?: number;
};

export function PiluleCote(p: PiluleCoteProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const s = p.cote === "droite" ? -1 : 1;
  const i = (p.t - p.debut) * FPS;
  const iSortie = Math.round((p.fin - p.debut) * FPS) - 7;
  const w = 0.214 * W;
  const hPleine = 0.5 * H;
  const y0 = 0.1 * H;
  const centreX = 0.094 * W; // centre de la pilule, mesuré depuis le bord de son côté
  const left = s === 1 ? centreX - w / 2 : W - centreX - w / 2;

  const pose = ressort("POSER", i * 0.7);
  const repli = courbe(i, iSortie, 6, Easing.in(Easing.cubic));
  const croissance = borne(pose, 0, 1.0) * (1 - repli);
  const h = Math.max(0.5, hPleine * croissance);
  const rot = s * (-2.5 - 3.5 * (1 - borne(pose, 0, 1)) - 2 * repli);
  const vie = i > 12 && repli === 0 ? borne((i - 12) / 6) : 0;
  const ty = vie * flotte(i) * 0.004 * H;
  const rz = vie * flotte(i, 18) * 0.7 * s;
  const flou = (1 - courbe(i, 0, 4)) * 0.008 * W;
  const rayon = Math.min(w / 2, h / 2);

  const taille = 0.05 * W;
  const lP = largeurPuce(p.etiquette, taille);
  const xPuce = s === 1 ? 0.01 * W : W - 0.01 * W - lP;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Bruitages
        debut={p.debut}
        liste={[
          [0, "whoosh-in", 0.8],
          [14, "tick_002", 0.5],
          [iSortie, "whoosh-out", 0.7],
        ]}
      />
      <div
        style={{
          position: "absolute",
          left,
          top: y0,
          width: w,
          height: h,
          borderRadius: rayon,
          transformOrigin: "50% 0%",
          transform: `translateY(${ty}px) rotate(${rot + rz}deg)`,
          boxShadow: ombres(W, 1),
          filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
          background: alpha(NUANCES.encreDouce, 0.9),
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: rayon, overflow: "hidden" }}>
          {/* La vidéo garde sa taille pleine et son ancre en haut : la pilule se déroule dessus, rien ne zoome. */}
          <div style={{ position: "absolute", left: 0, top: 0, width: w, height: hPleine }}>
            <VideoCover src={p.src} debut={p.debut} largeur={w} hauteur={hPleine} depuisImage={p.depuisImage} />
          </div>
          <Vignette gloss={false} />
          <Glint i={i} i0={14} W={W} largeur={w} />
          <Glint i={i} i0={46} W={W} largeur={w} />
        </div>
        <Lisere W={W} rayon={rayon} />
      </div>
      {croissance > 0.6 ? (
        <Puce texte={p.etiquette} W={W} i={i} i0={6} iSortie={iSortie} x={xPuce} y={y0 + hPleine - 0.0055 * H} taille={taille} inclinaison={-2 * s} decalage={{ x: 0, y: 0.03 * W }} origine={s === 1 ? "0% 50%" : "100% 50%"} />
      ) : null}
    </div>
  );
}
