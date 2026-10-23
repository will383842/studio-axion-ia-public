import React from "react";
/**
 * ÉLÉMENT 34 ★ `DuelVideo` (standard DA v4, lot 5). Re-habillé : plus de duotone teinté ni de verre ni d'éclair.
 * Gabarit M5 (≥ 8 s). 2 triangles le long de la diagonale bas-gauche → haut-droit, chacun une VRAIE vidéo (A, en haut à gauche, en
 * NOIR ET BLANC ; B, en bas à droite, en couleur) ; liseré ENCRE 14 px sur la diagonale ; mot A sur plaque BLANC, mot B sur plaque ACCENT_1 ;
 * disque ENCRE de 0,14 L au centre avec « VS » ACCENT_1.
 * Déroulé (i0 = mot A dit) : triangles depuis leurs coins en 3 i (B 1 i après : tolérance visage 3 i) · i3 liseré tracé · i4 disque en CLAQUE
 * + secousse 0,010 L · mot A en POP à i2, mot B au mot B · verdict (s'il est dit) : le perdant passe en noir et blanc assombri et recule de
 * 0,05 L · sortie : retour aux coins en 3 i. Aucun zoom des vidéos (cover 1080 × 1920 natif).
 * Son : `whoosh-in` à i0 + `drop` à la rencontre.
 */
import { AbsoluteFill, OffthreadVideo, Sequence } from "remotion";
import { mediaV4 } from "../communs/medias-v4";
import { accents, Bruitage, borne, courbe, COULEURS, FPS, freinCubique, gestesDeVie, H, MONTSERRAT, Palette, Plaque, Pose, ressort, secousse, sortieRapide, tick, W } from "./commun-lot5";

export const ID_DUEL_VIDEO = "duel-video";
export const DUREE_DUEL_VIDEO = 54; // ≈ 1,8 s
const SORTIE = 3;

export type DuelVideoProps = {
  frame: number; debut: number; palette: Palette;
  motA: string; motB: string; videoA: string; videoB: string;
  /** Image (relative à `debut`) où le mot B est dit. */
  iMotB?: number;
  /** Verdict dit : le gagnant, et l'image (relative) où il est dit. */
  verdict?: { gagnant: "A" | "B"; i: number };
  duree?: number;
  /** Mesure du visage : vidéos remplacées par du gris uni. */
  sansVideo?: boolean;
};

export function DuelVideo({ frame, debut, palette, motA, motB, videoA, videoB, iMotB = 14, verdict, duree = DUREE_DUEL_VIDEO, sansVideo = false }: DuelVideoProps) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const kS = i - (duree - SORTIE);
  const sortie = kS >= 0 ? sortieRapide((kS + 1) / SORTIE) : 0;
  const gA = freinCubique(courbe(i, 0, 3));
  const gB = freinCubique(courbe(i - 1, 0, 3));
  const dA = 1 - gA + sortie;
  const dB = 1 - gB + sortie;
  const sh = secousse(i - 4, 0.01 * W);
  // Verdict : le perdant recule de 0,05 L le long de la diagonale et passe en noir et blanc assombri.
  const iV = verdict ? i - verdict.i : -1;
  const recul = verdict && iV >= 0 ? ressort("GLISSE", iV) : 0;
  const perdant = verdict ? (verdict.gagnant === "A" ? "B" : "A") : null;
  const grisP = verdict && iV >= 0 ? borne(iV / 6) : 0;
  const nx = H / Math.hypot(W, H); // normale (vers le coin haut-gauche) de la diagonale
  const ny = W / Math.hypot(W, H);
  const reculPx = 0.05 * W * recul;
  const dxA = -dA * W * 1.05 + sh + (perdant === "A" ? -nx * reculPx : 0);
  const dyA = -dA * H * 1.05 + (perdant === "A" ? -ny * reculPx : 0);
  const dxB = dB * W * 1.05 - sh + (perdant === "B" ? nx * reculPx : 0);
  const dyB = dB * H * 1.05 + (perdant === "B" ? ny * reculPx : 0);
  const ov = 0.03; // recouvrement le long de la diagonale (aucune fente pendant la secousse)
  const polyA = `polygon(-60px -60px, ${W * (1 + ov) + 60}px -60px, -60px ${H * (1 + ov) + 60}px)`;
  const polyB = `polygon(${W + 60}px ${H + 60}px, ${W + 60}px ${-H * ov - 60}px, ${-W * ov - 60}px ${H + 60}px)`;
  const filtreA = perdant === "A" ? `grayscale(1) contrast(1.05) brightness(${1 - 0.4 * grisP})` : "grayscale(1) contrast(1.08)";
  const filtreB = perdant === "B" ? `grayscale(${grisP}) brightness(${1 - 0.4 * grisP})` : undefined;
  const video = (nom: string, filtre?: string) => (sansVideo ? <AbsoluteFill style={{ background: "#666" }} /> : (
    <Sequence from={debut} layout="none"><OffthreadVideo src={mediaV4(`broll/${nom}`)} muted style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover", filter: filtre }} pauseWhenBuffering={false} /></Sequence>
  ));
  const lisere = freinCubique(courbe(i, 3, 3)) * (1 - sortie);
  const hyp = Math.hypot(W, H);
  const angle = (Math.atan2(-H, W) * 180) / Math.PI;
  const dDisque = 0.14 * W;
  const popA = 0.3 + 0.7 * ressort("POP", i - 2);
  const popB = 0.3 + 0.7 * ressort("POP", i - iMotB);
  const pulseGagnant = verdict && iV >= 0 ? 1 + 0.06 * Math.sin(Math.PI * borne(iV / 9)) : 1;
  return (
    <AbsoluteFill style={{ zIndex: 100, background: "transparent" }}>
      <AbsoluteFill style={{ transform: `translate(${dxA}px, ${dyA}px)`, clipPath: polyA }}>{video(videoA, filtreA)}</AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${dxB}px, ${dyB}px)`, clipPath: polyB }}>{video(videoB, filtreB)}</AbsoluteFill>
      {/* liseré ENCRE 14 px sur la diagonale */}
      <div style={{ position: "absolute", left: W / 2, top: H / 2, width: hyp * 1.06 * lisere, height: 14, background: COULEURS.ENCRE, transform: `translate(-50%, -50%) rotate(${angle}deg)` }} />
      {/* mots */}
      <Pose x={0.32 * W + dxA * 0.9} y={0.085 * H + dyA * 0.9} rotation={-5} echelle={Math.max(0, popA) * (verdict?.gagnant === "A" ? pulseGagnant : 1) * tick(i, 10)} opacite={i >= 2 ? 1 : 0}>
        <Plaque texte={motA} fond={perdant === "A" ? COULEURS.GRIS : COULEURS.BLANC} corps={84} ombre="M" />
      </Pose>
      <Pose x={0.68 * W + dxB * 0.9} y={0.915 * H + dyB * 0.9} rotation={3} echelle={Math.max(0, popB) * (verdict?.gagnant === "B" ? pulseGagnant : 1) * tick(i, iMotB + 6, 6)} opacite={i >= iMotB ? 1 : 0}>
        <Plaque texte={motB} fond={perdant === "B" ? COULEURS.GRIS : ACCENT_1} corps={84} ombre="M" />
      </Pose>
      {/* disque VS */}
      <Pose x={W / 2 + sh * 0.4} y={H / 2} echelle={Math.max(0, (1 - sortie) * (0.3 + 0.7 * ressort("CLAQUE", i - 4))) * tick(i, 12, 3, 0.07)} opacite={i >= 4 ? 1 : 0} z={10}>
        <div style={{ width: dDisque, height: dDisque, borderRadius: 999, boxSizing: "border-box", background: COULEURS.ENCRE, border: `5px solid ${COULEURS.ENCRE}`, boxShadow: `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}, 8px 9px 0 0 ${COULEURS.ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 64, color: ACCENT_1, letterSpacing: "0.01em" }}><svg width={80} height={80} viewBox="0 0 64 64" style={{ display: "block" }}><path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" fill={ACCENT_1} stroke={ACCENT_1} strokeWidth={4} strokeLinejoin="round" /></svg></div>
      </Pose>
    </AbsoluteFill>
  );
}

export function bruitagesDuelVideo(debut: number): Bruitage[] {
  const t = debut / FPS;
  return [[t, "whoosh-in", 0.6], [t + 4 / FPS, "drop_001", 0.65]];
}
/** Événements : entrée, mot A, disque, mot B, verdict (+ pic de pulsation du gagnant 9 i plus tard), sortie. */
export const evenementsDuelVideo = (d: number, iB = 14, iV?: number, duree = DUREE_DUEL_VIDEO) => [d, d + 2, d + 4, d + iB, ...(iV !== undefined ? [d + iV, d + iV + 9] : []), ...[0, 3, 6].flatMap((dec) => gestesDeVie(12, duree - SORTIE, dec, 12)).map((x) => d + x), d + duree - SORTIE];
