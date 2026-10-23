import React from "react";
/**
 * ÉLÉMENT 37 `AppelFinalPile` (standard DA v4, lot 5). L'appel à l'action qui s'empile, comme la référence LinkedIn (74,8-77,5 s).
 * Gabarit M1 (prise à D1, pile y 0,02 → 0,185 H) : plaque ENCRE « COMMENTEZ « RELANCE » » (texte ACCENT_1, corps 60, guillemets français),
 * puis 2-3 lignes cochées dessous (plaques BLANC corps 38, case ACCENT_1 + coche ENCRE tracée), et une pastille ronde ACCENT_1 à flèche ENCRE
 * (96 px) à droite des sous-titres.
 * Déroulé (i0 = « commentez » dit) : plaque principale en CLAQUE · une ligne par bénéfice dit (E-ETIRE 4 i + coche tracée en 4 i, `ding`) ·
 * la flèche en POP puis pulsation 1 → 1,08 toutes les 20 i · la pile dure jusqu'au panneau de fin (sortie S-RETRECIT 3 i si elle s'arrête avant).
 * Interprétation : la flèche est posée à (0,86 L ; 0,80 H) et non 0,72 H, pour ne jamais toucher le groupe de sous-titres (0,72 H, jusqu'à 0,94 L).
 * Durée 3-4,5 s. Son : `ding` par ligne cochée.
 */
import { Easing } from "remotion";
import { accents, Bruitage, Coche, courbe, COULEURS, FPS, freinCubique, gestesDeVie, H, largeurTexte, Palette, Plaque, Pose, ressort, tick, W, TRAIT } from "./commun-lot5";

const CORPS_PRINCIPALE = 68;

export const ID_APPEL_FINAL = "appel-final-pile";
export const DUREE_APPEL_FINAL = 105; // 3,5 s
const SORTIE = 3;

export type AppelFinalProps = {
  frame: number; debut: number; palette: Palette;
  /** Mot-clé du commentaire (sans guillemets). */
  motCle: string;
  /** Bénéfices dits (2-3). */
  lignes: string[];
  /** Images (relatives) où chaque bénéfice est dit. */
  iLignes?: number[];
  /** Image (relative) où le mot-clé est dit : il se pose alors entre les guillemets. */
  iMotCle?: number;
  duree?: number;
  /** Si la pile court jusqu'au panneau de fin, elle n'a pas de sortie propre. */
  sansSortie?: boolean;
};

export function AppelFinalPile({ frame, debut, palette, motCle, lignes, iLignes = [24, 44, 64], iMotCle = 8, duree = DUREE_APPEL_FINAL, sansSortie = false }: AppelFinalProps) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const kS = i - (duree - SORTIE);
  const sortie = !sansSortie && kS >= 0 ? 1 - courbe(kS + 1, 0, 3, Easing.in(Easing.back(1.6))) : 1;
  const e0 = 1.12 - 0.12 * ressort("CLAQUE", i); // CLAQUE : 1,12 → 1
  const entree0 = i < 1 ? 0 : 1;
  const iFl = (iLignes[0] ?? 24) - 8; // la flèche arrive avant la 1ʳᵉ ligne
  const kMot = i - iMotCle; // le mot-clé se pose dans les guillemets au mot dit
  // La pile grandit en continu (1 → 1,08 sur 60 i) ; la plaque principale, large, est plafonnée pour rester à ≥ 0,05 L des bords.
  const wPrincipale = largeurTexte(`COMMENTEZ « ${motCle} »`, CORPS_PRINCIPALE) + 0.6 * CORPS_PRINCIPALE + 10;
  const plafond = Math.min(1.08, (0.9 * W) / (wPrincipale * 1.03));
  const croitLignes = 1 + 0.08 * courbe(i, 0, 60);
  const croit = Math.max(1, Math.min(plafond, croitLignes));
  const pulse = i >= iFl + 6 ? tick(i, iFl + 6, 6, 0.08) : 1;
  const aPos = 0.86;
  return (
    <>
      <Pose x={W / 2 - 10} y={0.063 * H} rotation={-3} echelle={Math.max(0, e0 * sortie * croit * tick(i, 8, 0, 0.03)) * entree0} z={60}>
        <Plaque texte={<span>COMMENTEZ « <span style={{ color: accents(palette).ACCENT_1, display: "inline-block", minWidth: motCle.length * 38, transform: `scale(${kMot >= 0 ? 1 + 0.25 * Math.sin(Math.PI * courbe(kMot, 0, 6)) : 0})`, opacity: kMot >= 0 ? 1 : 0 }}>{motCle}</span> »</span>} fond={COULEURS.ENCRE} couleurTexte={COULEURS.BLANC} corps={CORPS_PRINCIPALE} ombre="M" />
      </Pose>
      {lignes.map((l, n) => {
        const k = i - iLignes[n];
        if (k < 0) return null;
        const etire = 0.55 + 0.45 * freinCubique(courbe(k, 0, 4)); // jamais de plaque vide : texte et coche sont là dès la 1ʳᵉ image
        const coche = courbe(k, 3, 4);
        const corps = 48;
        const incl = [1.5, -1.5, 1][n % 3];
        return (
          <Pose key={n} x={W / 2 + [14, -16, 8][n % 3]} y={(0.113 + 0.052 * n) * H} rotation={incl} echelle={Math.max(0, sortie * croitLignes * tick(k, 8, 4 * n + 2))} origine="left center" z={50 - n}>
            <div style={{ transform: `scaleX(${etire})`, transformOrigin: "left center" }}>
              <Plaque
                texte={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 46, height: 46, boxSizing: "border-box", borderRadius: 10, background: ACCENT_1, border: `${TRAIT.FIN}px solid ${COULEURS.ENCRE}`, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + 0.18 * Math.sin(Math.PI * courbe(k, 4, 5))})` }}><Coche t={34} p={coche} epaisseur={4.5} /></span>
                    <span style={{ transform: `scale(${0.7 + 0.3 * ressort("POP", k)})`, display: "inline-block" }}>{l}</span>
                  </span>
                }
                fond={COULEURS.BLANC}
                corps={corps}
              />
            </div>
          </Pose>
        );
      })}
      {/* pastille ronde ACCENT_1 à flèche ENCRE */}
      <Pose x={0.86 * W} y={aPos * H} echelle={Math.max(0, (0.3 + 0.7 * ressort("POP", i - iFl)) * pulse * sortie)} opacite={i >= iFl ? 1 : 0} z={70}>
        <div style={{ width: 120, height: 120, borderRadius: 999, boxSizing: "border-box", background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, boxShadow: `5px 6px 0 0 ${COULEURS.ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={68} height={68} viewBox="0 0 24 24" fill="none" stroke={COULEURS.ENCRE} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5.5L19.5 12 13 18.5" /></svg>
        </div>
      </Pose>
    </>
  );
}

export function bruitagesAppelFinal(debut: number, iLignes = [24, 44, 64]): Bruitage[] {
  const t = (i: number) => (debut + i) / FPS;
  return [[t(0), "drop_001", 0.5], ...iLignes.map((x, n): Bruitage => [t(x + 4), `ding-${n + 1}`, 0.45])];
}
export const evenementsAppelFinal = (d: number, iL = [24, 44, 64], duree = DUREE_APPEL_FINAL) => {
  const iFl = iL[0] - 8;
  // gestes de vie : plaque principale, flèche et lignes pulsent toutes les 12 i
  const pulses = [...gestesDeVie(8, duree - SORTIE), ...gestesDeVie(iFl + 6, duree - SORTIE, 6)].map((x) => d + x);
  return [d, d + iFl, ...iL.flatMap((x) => [d + x, d + x + 4]), ...pulses, d + duree - SORTIE];
};
