import React from "react";
/**
 * ÉLÉMENT 33 ★ `RafaleTroisMots` (standard DA v4, lot 5). Re-habillée : aplats pleins, contours encre, ombre dure, plus de verre.
 * Gabarit M5. 3 mots dits à moins de 0,9 s d'écart, chacun sur un aplat plein cadre différent (ACCENT_1, ENCRE, IVOIRE) en E-COUPE,
 * le mot en CLAQUE (échelle 1,5 → 1). Puis RÉCAPITULATIF à i(mot 3) + 8 : les 3 mots sur 3 plaques inclinées ±3°, alignées à gauche
 * (E-ETIRE en cascade de 3 i) sur un aplat ACCENT_1. Sortie avant 1,8 s : balayage diagonal 4 i, les mots partent avec l'aplat.
 * Son : `click`, `click`, `drop` (+ `select` discret au récapitulatif).
 */
import { AbsoluteFill } from "remotion";
import { accents, Bruitage, contourTexte, corpsAjuste, courbe, COULEURS, FPS, freinCubique, gestesDeVie, H, MONTSERRAT, Palette, Plaque, Pose, ressort, secousse, sortieRapide, tick, W } from "./commun-lot5";

export const ID_RAFALE = "rafale-trois-mots";
export const DUREE_RAFALE = 52; // ≈ 1,73 s
const SORTIE = 4;

export type RafaleProps = { frame: number; debut: number; palette: Palette; mots: [string, string, string]; /** Images d'apparition des mots 2 et 3 après le mot 1 (< 0,9 s = 27 i). */ ecarts?: [number, number]; duree?: number };

export function RafaleTroisMots({ frame, debut, palette, mots, ecarts = [12, 25], duree = DUREE_RAFALE }: RafaleProps) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const iMots = [0, ecarts[0], ecarts[1]];
  const iRecap = ecarts[1] + 8;
  const kS = i - (duree - SORTIE);
  const p = kS >= 0 ? sortieRapide((kS + 1) / SORTIE) : 0;
  const fonds = [ACCENT_1, COULEURS.ENCRE, COULEURS.IVOIRE];
  const idx = i >= iRecap ? 3 : i >= iMots[2] ? 2 : i >= iMots[1] ? 1 : 0;
  const fond = idx === 3 ? ACCENT_1 : fonds[idx];
  const k = i - (idx === 3 ? iRecap : iMots[idx]);
  const couleurTexte = [COULEURS.ENCRE, ACCENT_1, COULEURS.ENCRE][idx] ?? COULEURS.ENCRE;
  const contour = [COULEURS.BLANC, COULEURS.BLANC, accents(palette).ACCENT_1][idx] ?? COULEURS.BLANC;
  const s = (1.25 - 0.25 * ressort("CLAQUE", k)) * (idx < 3 ? tick(k, 6) : 1);
  const dx = secousse(k - 4, 0.004 * W);
  const motCourant = mots[Math.min(idx, 2)];
  const corps = corpsAjuste(motCourant, 0.78 * W, 320, 150, -0.01);
  const corpsRecap = Math.min(...mots.map((m) => corpsAjuste(m, 0.72 * W, 170, 90, 0.01)));
  const plaques: { fond: string; texte: string }[] = [
    { fond: COULEURS.BLANC, texte: COULEURS.ENCRE },
    { fond: COULEURS.IVOIRE_CLAIR, texte: COULEURS.ENCRE },
    { fond: COULEURS.ENCRE, texte: ACCENT_1 },
  ];
  return (
    <AbsoluteFill style={{ transform: `translate(${p * 1.25 * W}px, ${-p * 1.25 * H}px)`, zIndex: 100 }}>
      <AbsoluteFill style={{ background: fond }} />
      {idx < 3 ? (
        <Pose x={W / 2 + dx} y={0.45 * H} rotation={idx % 2 === 0 ? -2 : 1.5} echelle={s}>
          <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: "-0.01em", color: couleurTexte, whiteSpace: "nowrap", filter: `drop-shadow(11px 12px 0 ${COULEURS.ENCRE})`, ...contourTexte(corps, contour, 0.2) }}>{motCourant}</div>
        </Pose>
      ) : (
        mots.map((m, n) => {
          const kn = i - iRecap - 3 * n;
          const etire = 0.55 + 0.45 * freinCubique(courbe(kn, 0, 3)); // jamais de plaque vide : le texte arrive avec elle
          const pop = ressort("POP", kn);
          return (
            <Pose key={n} x={0.07 * W} y={(0.3 + 0.14 * n) * H} rotation={n % 2 === 0 ? -3 : 3} origine="left center" ancre="gauche" z={n}>
              <div style={{ transform: `scaleX(${etire}) scale(${tick(kn, 8, n * 4)})`, transformOrigin: "left center", opacity: kn >= 0 ? 1 : 0 }}>
                <Plaque texte={<span style={{ transform: `scale(${0.7 + 0.3 * pop})`, display: "inline-block" }}>{m}</span>} fond={plaques[n].fond} couleurTexte={plaques[n].texte} corps={corpsRecap} ombre="M" />
              </div>
            </Pose>
          );
        })
      )}
    </AbsoluteFill>
  );
}

export function bruitagesRafale(debut: number, ecarts: [number, number] = [12, 25]): Bruitage[] {
  const t = debut / FPS;
  return [[t, "click_001", 0.7], [t + ecarts[0] / FPS, "click_002", 0.7], [t + ecarts[1] / FPS, "drop_002", 0.65], [t + (ecarts[1] + 8) / FPS, "select_001", 0.3]];
}
export const evenementsRafale = (d: number, e: [number, number] = [12, 25], duree = DUREE_RAFALE) => [d, d + 9, d + e[0], d + e[0] + 9, d + e[1], d + e[1] + 8, d + e[1] + 11, d + e[1] + 14, ...[0, 4, 8].flatMap((dec) => gestesDeVie(e[1] + 16, duree - SORTIE, dec)).map((x) => d + x), d + duree - SORTIE];
