import React from "react";
/**
 * 18 — `Chrono` : le temps qui file, standard v4 § F.18 (M1 : cadran à gauche, temps sur plaque ACCENT_2, libellé).
 * i0 cadran POP ; i2 plaque du temps E-ETIRE ; l'aiguille fait 2 tours pendant que le temps défile jusqu'à la valeur DITE
 * (14 i, out cubic) ; CLAQUE à l'arrivée ; libellé en sur-étiquette. Option `trop-long` : le cadran passe GRIS et se fait barrer.
 * Cotes : cadran 250 px (fiche : 0,30 L ≈ 324 px, réduit pour tenir dans la zone M1 sous la bande ivoire), temps Montserrat 120.
 */
import { Easing, useCurrentFrame } from "remotion";
import { accents, Anim, COULEURS, courbe, DESCENTE, lerp, melange, MONTSERRAT, ombre, Plaque, ressort, secousse, Son, TRAIT } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsChrono = {
  palette: Palette;
  /** Valeur dite, en secondes (120 = « 2:00 »). */
  secondes?: number;
  libelle?: string;
  mode?: "gagne" | "trop-long";
  duree?: number;
  /** Images locales des mots : [cadran (0), début du défilement, libellé]. */
  mots?: number[];
  ding?: boolean;
};

export const dureeChrono = (p: PropsChrono): number => p.duree ?? 50;
export const clesPriseChrono = (): ClePrise[] => [{ i: 0, D: DESCENTE.D1 }];
const NB = 14;

export function evenementsChrono(p: PropsChrono): number[] {
  const d0 = p.mots?.[1] ?? 4, il = p.mots?.[2] ?? d0 + NB + 2;
  const ev = [0, 2];
  for (let k = 0; k <= NB; k += 2) ev.push(d0 + k);
  ev.push(d0 + NB, il);
  if (p.mode === "trop-long") ev.push(d0 + NB + 8);
  for (let t = d0 + NB + 6; t < dureeChrono(p) - 3; t += 12) ev.push(t);
  ev.push(dureeChrono(p) - 3);
  return ev;
}

const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function Chrono(props: PropsChrono) {
  const i = useCurrentFrame();
  const { palette, secondes = 120, libelle = "POUR CRÉER UN AGENT", mode = "gagne", ding = true } = props;
  const { ACCENT_2 } = accents(palette);
  const E = COULEURS.ENCRE;
  const d0 = props.mots?.[1] ?? 4, il = props.mots?.[2] ?? d0 + NB + 2;
  const duree = dureeChrono(props);
  const iSortie = duree - 3;
  const D = 250, cx = 80, cy = 100;
  const p = courbe(i, d0, NB, Easing.out(Easing.cubic));
  const valeur = secondes * p;
  const angle = 720 * p;
  const claque = i >= d0 + NB ? 1 + 0.12 * (1 - ressort("CLAQUE", i - (d0 + NB))) : 1;
  const iBarre = d0 + NB + 8;
  const gris = mode === "trop-long" ? courbe(i, iBarre + 5, 3) : 0;
  const pb = mode === "trop-long" ? courbe(i, iBarre, 5) : 0;
  const trait = E;
  const sons: React.ReactNode[] = [<Son key="c0" i0={0} fichier="select_001" volume={0.25} />];
  for (let k = 0; k < NB; k += 2) sons.push(<Son key={`t${k}`} i0={d0 + k} fichier={k % 4 ? "tick_002" : "tick_001"} volume={0.4} />);
  if (mode === "gagne" && ding) sons.push(<Son key="d" i0={d0 + NB} fichier="ding-3" volume={0.35} />);
  if (mode === "trop-long") sons.push(<Son key="f" i0={iBarre} fichier="feutre" volume={0.4} />);
  const sh = secousse(i - (d0 + NB), 0.006 * 1080) * (mode === "gagne" ? 1 : 0);
  return (
    <>
      {sons}
      {/* cadran */}
      <Anim i={i} i0={0} iSortie={iSortie} incl={-4} x={cx} y={cy + 18} w={D} h={D} z={4} extra={`scale(${claque.toFixed(3)})`} vie={{ debut: d0 + NB + 9 }} id="cadran">
        <div style={{ position: "relative", width: D, height: D, boxSizing: "border-box", borderRadius: "50%", border: `${TRAIT.FORT}px solid ${E}`, background: melange(COULEURS.BLANC, COULEURS.GRIS, gris), boxShadow: ombre("M") }}>
          {Array.from({ length: 12 }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: D / 2 - 3 - TRAIT.FORT, top: 14, width: 6, height: k % 3 === 0 ? 26 : 16, background: E, transformOrigin: `3px ${D / 2 - 14 - TRAIT.FORT}px`, transform: `rotate(${k * 30}deg)`, borderRadius: 3 }} />
          ))}
          <div style={{ position: "absolute", left: D / 2 - 4 - TRAIT.FORT, top: D / 2 - 0.4 * D - TRAIT.FORT + 6, width: 8, height: 0.4 * D, background: E, borderRadius: 4, transformOrigin: `4px ${0.4 * D - 6}px`, transform: `rotate(${angle.toFixed(2)}deg)` }} />
          <div style={{ position: "absolute", left: D / 2 - 14 - TRAIT.FORT, top: D / 2 - 14 - TRAIT.FORT, width: 28, height: 28, borderRadius: "50%", background: E, border: `${TRAIT.MOYEN}px solid ${E}`, boxSizing: "border-box" }} />
          {mode === "trop-long" && pb > 0 ? (
            <div style={{ position: "absolute", left: -20, top: D / 2 - 12 - TRAIT.FORT, width: (D + 40) * pb, height: 24, background: trait, border: `3px solid ${E}`, boxSizing: "border-box", borderRadius: 4, transform: "rotate(-8deg)", transformOrigin: "0 50%" }} />
          ) : null}
        </div>
      </Anim>
      {/* temps sur plaque ACCENT_2 */}
      <Anim i={i} i0={2} iSortie={iSortie} entree="etire" incl={2} x={352 + sh} y={cy + 6} z={4} origine="0% 50%" w={600} vie={{ debut: d0 + NB + 6 }} id="temps">
        <Plaque fond={ACCENT_2} corps={120} style={{ fontVariantNumeric: "tabular-nums" }} bord={TRAIT.MOYEN}>
          {fmt(Math.min(secondes, Math.round(valeur)))}
        </Plaque>
      </Anim>
      <Anim i={i} i0={il} iSortie={iSortie} incl={-2} x={360} y={cy + 150} z={5} origine="0% 100%" vie={{ debut: il + 8 }} id="libelle-chrono">
        <Plaque fond={E} texte={COULEURS.BLANC} corps={40}>{libelle}</Plaque>
      </Anim>
    </>
  );
}
