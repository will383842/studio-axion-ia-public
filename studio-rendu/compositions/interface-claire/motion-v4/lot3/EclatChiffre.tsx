import React from "react";
/**
 * 20 — `EclatChiffre` (★ gardé par Will, re-habillé v4), standard § F.20 : plein cadre ACCENT_1 uni SANS dégradé ; chiffre géant ENCRE
 * (contour BLANC 10 px, ombre L) ; unité sur plaque ENCRE/BLANC ; anneau ENCRE de 0,9 L (trait 18 px) qui se trace ; 8 éclats
 * rectangulaires ENCRE 14 × 70 px qui jaillissent en étoile, sans flou.
 * i0 aplat par balayage diagonal 3 i ; i1 compteur 0 → valeur DITE en 12 i ; i13 CLAQUE 1,3 → 1 + anneau (8 i) + éclats (6 i) ;
 * i20 unité POP ; sortie : l'aplat part en balayage vers le haut-droit en 3 i, le chiffre part avec lui.
 * Gabarit M5 : plein cadre (à n'employer qu'à partir de 8 s dans une vraie vidéo).
 */
import { Easing, useCurrentFrame } from "remotion";
import { accents, Anim, onde, COULEURS, contourTexte, courbe, H, lerp, MONTSERRAT, Plaque, ressort, Son, TRAIT, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsEclatChiffre = {
  palette: Palette;
  valeur?: number;
  unite?: string;
  precision?: string;
  duree?: number;
  /** Images locales des mots : [chiffre (0), unité, précision]. */
  mots?: number[];
};

export const dureeEclatChiffre = (p: PropsEclatChiffre): number => p.duree ?? 42;
/** La prise n'est pas visible (plein cadre) : elle ne bouge pas. */
export const clesPriseEclatChiffre = (): ClePrise[] => [];
export function evenementsEclatChiffre(p: PropsEclatChiffre): number[] {
  const iu = p.mots?.[1] ?? 20, ip = p.mots?.[2] ?? iu + 6;
  const ev = [0, 1, 4, 7, 10, 13, 17, iu, ip];
  for (let t = 21; t < dureeEclatChiffre(p) - 3; t += 12) ev.push(t);
  return [...ev, dureeEclatChiffre(p) - 3];
}

/** Largeur d'une plaque de texte (Montserrat Black, capitales) : 0,78 em par lettre + 0,6 em de marge, jamais plus de 0,88 L. */
const largeur = (t: string, corps: number): number => Math.min(0.88 * W, Math.round(t.length * 0.78 * corps + 0.6 * corps));
const CX = W / 2, CY = 900, RAYON_ANNEAU = 0.45 * W;

export function EclatChiffre(props: PropsEclatChiffre) {
  const i = useCurrentFrame();
  const { palette, valeur = 45, unite = "MINUTES", precision } = props;
  const { ACCENT_1 } = accents(palette);
  const E = COULEURS.ENCRE;
  const iu = props.mots?.[1] ?? 20, ip = props.mots?.[2] ?? iu + 6;
  const iS = dureeEclatChiffre(props) - 3;
  // balayage d'entrée (3 i) et de sortie (3 i) : polygone diagonal, aucun flou
  const e = courbe(i, 0, 3, Easing.out(Easing.cubic));
  const s = courbe(i, iS, 3, Easing.in(Easing.cubic));
  if (i >= iS + 3) return null;
  const d = 0.6 * H; // inclinaison du front de balayage
  const frontE = lerp(-d, W + d, e), frontS = lerp(-d, W + d, s);
  // entrée : visible la partie à gauche du front (qui avance vers la droite) ; sortie : la partie qui reste est à droite du front
  const clip = i < iS
    ? `polygon(0px 0px, ${frontE}px 0px, ${frontE - d}px ${H}px, 0px ${H}px)`
    : `polygon(${frontS}px 0px, ${W + d}px 0px, ${W + d}px ${H}px, ${frontS - d}px ${H}px)`;
  const cpt = courbe(i, 1, 12, Easing.out(Easing.cubic));
  const val = Math.round(valeur * cpt);
  const iC = 13;
  const claque = (i >= iC ? 1 + 0.3 * (1 - ressort("CLAQUE", i - iC)) : 1) * (1 + 0.05 * onde(i - (iC + 8), 12));
  const taille = Math.min(420, Math.floor(880 / (String(valeur).length * 0.78)));
  const anneau = courbe(i, iC, 8, Easing.out(Easing.cubic));
  const longueur = 2 * Math.PI * RAYON_ANNEAU;
  const eclats = Array.from({ length: 8 }, (_, k) => {
    const a = (22.5 + k * 45) * (Math.PI / 180);
    const q = courbe(i, iC, 6, Easing.out(Easing.cubic));
    const r0 = lerp(0.82, 1.12, q);
    const x = CX + Math.cos(a) * 500 * r0, y = CY + Math.sin(a) * 640 * r0;
    const vis = i >= iC && i < iC + 7;
    return vis ? <div key={k} style={{ position: "absolute", left: x - 7, top: y - 35, width: 14, height: 70 * (1 - 0.5 * q), background: E, borderRadius: 3, transform: `rotate(${(a * 180) / Math.PI + 90}deg)` }} /> : null;
  });
  const sons: React.ReactNode[] = [];
  for (let k = 0; k < 12; k += 2) sons.push(<Son key={`t${k}`} i0={1 + k} fichier={k % 4 ? "tick_002" : "tick_001"} volume={0.4} />);
  sons.push(<Son key="e" i0={iC} fichier="eclats" volume={0.5} />);
  const chiffreStyle = {
    fontFamily: MONTSERRAT, fontWeight: 900, fontSize: taille, lineHeight: 1, color: E, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const,
    ...contourTexte(taille, COULEURS.BLANC, 0.05), filter: `drop-shadow(11px 12px 0 ${E})`,
  };
  return (
    <>
      {sons}
      <div data-fond="1" style={{ position: "absolute", inset: 0, background: ACCENT_1, clipPath: clip, zIndex: 3, overflow: "hidden" }}>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx={CX} cy={CY} r={RAYON_ANNEAU} fill="none" stroke={E} strokeWidth={18} strokeLinecap="butt" strokeDasharray={longueur} strokeDashoffset={longueur * (1 - anneau)}
            transform={`rotate(-90 ${CX} ${CY})`} />
        </svg>
        {eclats}
        <div style={{ position: "absolute", left: 0, width: W, top: CY - taille * 0.5, display: "flex", justifyContent: "center", transform: `scale(${claque.toFixed(3)})`, transformOrigin: `${W / 2}px ${taille * 0.5}px` }}>
          <div data-objet="chiffre" style={chiffreStyle}>{val}</div>
        </div>
        <Anim i={i} i0={iu} incl={-3} x={(W - largeur(unite, 96)) / 2} y={CY + taille * 0.5 + 30} w={largeur(unite, 96)} z={4} sortie="aucune" vie={{ debut: iu + 8 }} id="unite">
          <Plaque fond={E} texte={COULEURS.BLANC} corps={96} ombreT="L" style={{ width: largeur(unite, 96), textAlign: "center" }}>{unite}</Plaque>
        </Anim>
        {precision ? (
          <Anim i={i} i0={ip} incl={2} x={(W - largeur(precision, 64)) / 2} y={CY + taille * 0.5 + 190} w={largeur(precision, 64)} z={4} sortie="aucune" vie={{ debut: ip + 8 }} id="precision">
            <Plaque fond={COULEURS.BLANC} corps={64} ombreT="M" style={{ width: largeur(precision, 64), textAlign: "center" }}>{precision}</Plaque>
          </Anim>
        ) : null}
      </div>
    </>
  );
}
