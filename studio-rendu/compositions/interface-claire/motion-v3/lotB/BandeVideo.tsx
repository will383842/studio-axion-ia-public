/**
 * N° 7 `bande-video` (lot B, standard v3 § G, refonte après critique du 16/10) : une BANDE DIAGONALE de vidéo sous le
 * menton, d'un bord à l'autre ; visage ENTIER.
 *
 * Forme K7 : épaisseur 0,18 H (≈ 18 % de l'image), centre à 0,79 H, inclinée de -12°. Le bord haut ne remonte jamais au-dessus
 * de 0,62 H (au bord droit : ≈ 0,64 H). Contenu : UNE SEULE vidéo paysage continue et nette (plus de pellicule en cases),
 * qui DÉFILE latéralement dans la bande (la source glisse de ≈ 0,1 L, la prise de Will ne bouge pas) ; liserés ivoire.
 * Entrée N4 « glissement diagonal » : la bande arrive par la gauche le long de sa propre direction avec `GLISSER`, deux copies
 * fantômes (25 % puis 12 %) et un flou directionnel pris dans l'axe ; arrêt net avec une secousse de 0,006 L. Puce v3 orange
 * de 54 px sur le bord haut. Sortie : fouet vers la droite (`FOUET`, 6 images, flou) ; les fantômes n'existent QU'à l'entrée,
 * donc aucun reste à la sortie. Vie à la pose : flottement (±0,4 % H) et reflet qui passe à i10 et i42.
 * Profondeur (V6) : ombre portée verticale en 3 couches (en espace écran), flou de mouvement, fantômes, puce P2.
 */
import React from "react";
import { NUANCES, alpha } from "../../variantes/premium-2";
import { Bruitages, FPS, FlouDir, Glint, Puce, VideoCover, Vignette, borne, flotte, hauteurPuce, ombresFiltre, ressort, secousse } from "./commun-lotB";

export type BandeVideoProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Fichier vidéo paysage (staticFile). */
  src: string;
  /** Mot dit, en puce au bout de la bande. */
  etiquette: string;
  depuisImage?: number;
};

const ANGLE = -12;

export function BandeVideo(p: BandeVideoProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const i = (p.t - p.debut) * FPS;
  const iSortie = Math.round((p.fin - p.debut) * FPS) - 7;
  const L = 1.58 * W;
  const hb = 0.18 * H;
  const cy = 0.79 * H;
  const rayon = 0.014 * W;

  /** Position le long de l'axe (px) à l'image `k`. 0 = posée. */
  const u = (k: number): number => {
    const entree = -(1 - ressort("GLISSER", k)) * 1.5 * W;
    const arret = secousse(k - 9, 0.006 * W);
    const fouet = ressort("FOUET", k - iSortie) * 1.8 * W;
    return entree + arret + fouet;
  };
  const u0 = u(i);
  const vitesse = Math.abs(u0 - u(i - 1));
  const sx = Math.min(0.022 * W, vitesse * 0.12);
  const fantomes = vitesse > 0.04 * W && i < 8; // à l'entrée seulement
  const vie = i > 12 && i < iSortie ? borne((i - 12) / 6) : 0;
  const dy = vie * flotte(i) * 0.004 * H;

  // Défilement latéral de la source : la vidéo (plus large que la bande) glisse de ≈ 0,1 L sur 2,5 s.
  const lv = L + 0.12 * W;
  const glisse = Math.min(i, 75) * 0.0014 * W;

  const bande = (avecVideo: boolean) => (
    <div
      style={{
        position: "absolute",
        left: (W - L) / 2,
        top: cy - hb / 2,
        width: L,
        height: hb,
        borderRadius: rayon,
        overflow: "hidden",
        background: `linear-gradient(180deg, ${NUANCES.ivoire} 0%, ${NUANCES.ivoireCreux} 100%)`,
      }}
    >
      {avecVideo ? (
        <div style={{ position: "absolute", left: -glisse, top: 0, width: lv, height: hb }}>
          <VideoCover src={p.src} debut={p.debut} largeur={lv} hauteur={hb} depuisImage={p.depuisImage} />
        </div>
      ) : null}
      {avecVideo ? <Vignette gloss={false} /> : null}
      {avecVideo ? <Glint i={i} i0={10} W={W} largeur={L} /> : null}
      {avecVideo ? <Glint i={i} i0={42} W={W} largeur={L} /> : null}
      <div style={{ position: "absolute", inset: 0, borderRadius: rayon, pointerEvents: "none", boxShadow: `inset 0 ${0.004 * W}px 0 ${alpha(NUANCES.ivoire, 0.6)}, inset 0 -${0.004 * W}px 0 ${alpha(NUANCES.ivoire, 0.5)}` }} />
    </div>
  );

  const ghost = (k: number, op: number) => (
    <div key={k} style={{ position: "absolute", inset: 0, opacity: op, transform: `translateY(${dy}px) rotate(${ANGLE}deg) translateX(${u(i - k * 1.6)}px)`, transformOrigin: `${W / 2}px ${cy}px` }}>
      {bande(false)}
    </div>
  );

  // Puce sur le bord haut, côté droit.
  const taille = 0.05 * W;
  const xPuceCentre = 0.7 * W;
  const yBordHaut = cy - (xPuceCentre - W / 2) * Math.tan((-ANGLE * Math.PI) / 180) - hb / 2 / Math.cos((ANGLE * Math.PI) / 180);
  return (
    <div style={{ position: "absolute", inset: 0, filter: ombresFiltre(W, 1) }}>
      <Bruitages
        debut={p.debut}
        liste={[
          [0, "whoosh-in", 0.8],
          [9, "drop_001", 0.7],
          [iSortie, "whoosh-out", 0.7],
        ]}
      />
      {fantomes ? (
        <>
          {ghost(1, 0.25)}
          {ghost(2, 0.12)}
        </>
      ) : null}
      <FlouDir sx={sx} style={{ transform: `translateY(${dy}px) rotate(${ANGLE}deg)`, transformOrigin: `${W / 2}px ${cy}px` }}>
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${u0}px)` }}>{bande(true)}</div>
      </FlouDir>
      <Puce texte={p.etiquette} W={W} i={i} i0={12} iSortie={iSortie} x={xPuceCentre - 0.16 * W} y={yBordHaut - hauteurPuce(taille) * 0.6 + dy} taille={taille} inclinaison={2} decalage={{ x: 0, y: 0.02 * W }} />
    </div>
  );
}
