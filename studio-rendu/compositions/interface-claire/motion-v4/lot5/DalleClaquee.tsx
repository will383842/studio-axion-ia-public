import React from "react";
/**
 * ÉLÉMENT 32 ★ `DalleClaquee` (standard DA v4, lot 5 « Coups de poing »). La dalle « STOP », re-habillée en v4.
 * Gabarit M5 (plein cadre, jamais avant 8 s) : aplat ACCENT_1 uni (aucun dégradé), mot géant ENCRE à contour BLANC 10 px et ombre dure L,
 * soulignement ENCRE de 24 px tracé, 4 traits d'impact ENCRE.
 * Déroulé (i0 = image où le mot déclencheur commence) : i0 aplat en E-COUPE · mot échelle 1,5 → 1 (CLAQUE, pic ≈ i4) ·
 * i4-i8 traits d'impact · i6-i12 soulignement tracé · micro-secousse ±0,004 L pendant la pose · sortie : l'aplat ET le mot partent
 * ensemble en balayage diagonal (haut-droit) en 3 i, visage découvert en ≤ 2 i.
 * Durée ≈ 0,9 s. Son : `drop` à i0 + « boum » (synthèse maison, `sons/boum.wav`) à l'impact i4.
 */
import { AbsoluteFill } from "remotion";
import { accents, Bruitage, contourTexte, corpsAjuste, courbe, COULEURS, FPS, freinCubique, gestesDeVie, H, largeurTexte, MONTSERRAT, Palette, Plaque, Pose, ressort, secousse, sortieRapide, tick, TraitsImpact, W } from "./commun-lot5";

export const ID_DALLE_CLAQUEE = "dalle-claquee";
export const DUREE_DALLE_CLAQUEE = 27; // images (≈ 0,9 s), sortie comprise
const SORTIE = 3;

/** Image (relative) où la suite de la phrase dite se pose sur sa plaque. */
export const I_SUITE_DALLE = 11;
export type DalleClaqueeProps = { frame: number; debut: number; palette: Palette; mot: string; /** Suite de la phrase dite (« À LA MAIN »), sur une plaque ENCRE à 0,60 H. */ suite?: string; duree?: number };

export function DalleClaquee({ frame, debut, palette, mot, suite, duree = DUREE_DALLE_CLAQUEE }: DalleClaqueeProps) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const kS = i - (duree - SORTIE);
  // balayage diagonal vers le haut-droit : 3 images à 12 % (visage encore couvert), 80 % puis 100 % (visage découvert) — aucune image à moitié couverte.
  const p = kS >= 0 ? [0.12, 0.8, 1][Math.min(2, kS)] : 0;
  const corps = corpsAjuste(mot, 0.74 * W, 420, 200);
  const lm = largeurTexte(mot, corps, -0.01);
  const cx = W / 2;
  const cy = 0.45 * H;
  // CLAQUE : échelle 1,5 → 1, pic à ≈ i4.
  const s = (1.25 - 0.25 * ressort("CLAQUE", i)) * tick(i, 14);
  const dx = secousse(i - 4, 0.004 * W);
  const dy = secousse(i - 4.8, 0.003 * W);
  const hauteurMot = corps * 0.72;
  const traitSouligne = courbe(i, 6, 6, freinCubique);
  const kSuite = i - I_SUITE_DALLE;
  return (
    <AbsoluteFill style={{ transform: `translate(${p * 1.25 * W}px, ${-p * 1.25 * H}px)`, zIndex: 100 }}>
      <AbsoluteFill style={{ background: ACCENT_1 }} />
      <div style={{ position: "absolute", left: cx + dx, top: cy + dy, width: 0, height: 0 }}>
        <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%, -50%) scale(${s}) rotate(-2deg)`, transformOrigin: "center center", filter: `drop-shadow(11px 12px 0 ${COULEURS.ENCRE})` }}>
          <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: "-0.01em", color: COULEURS.ENCRE, whiteSpace: "nowrap", ...contourTexte(corps, COULEURS.BLANC, 0.1 * 2) }}>{mot}</div>
          <div style={{ position: "absolute", left: lm * 0.1, top: corps * 1.0, height: 24, width: lm * 0.8, background: COULEURS.ENCRE, transform: `scaleX(${traitSouligne})`, transformOrigin: "left center", borderRadius: 4, boxShadow: `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}` }} />
        </div>
      </div>
      {suite && kSuite >= 0 ? (
        <Pose x={W / 2} y={0.62 * H} rotation={1.5} echelle={(0.4 + 0.6 * ressort("POP", kSuite)) * tick(i, I_SUITE_DALLE + 6)} z={5}>
          <Plaque texte={suite} fond={COULEURS.ENCRE} couleurTexte={COULEURS.BLANC} corps={84} ombre="M" />
        </Pose>
      ) : null}
      <TraitsImpact cx={cx} cy={cy} rayon={Math.hypot(lm, hauteurMot) / 2 * 0.95} k={i - 4} angles={[-38, -142, 38, 142]} duree={5} />
    </AbsoluteFill>
  );
}

export function bruitagesDalleClaquee(debut: number): Bruitage[] {
  const t = debut / FPS;
  return [[t, "drop_004", 0.55], [t + 4 / FPS, "boum", 0.8]];
}
/** Images où le contenu change (pour la mesure de densité R1). */
export const evenementsDalleClaquee = (d: number) => [d, d + 4, d + 6, d + I_SUITE_DALLE, ...gestesDeVie(14, DUREE_DALLE_CLAQUEE - SORTIE).map((x) => d + x), d + DUREE_DALLE_CLAQUEE - SORTIE];
