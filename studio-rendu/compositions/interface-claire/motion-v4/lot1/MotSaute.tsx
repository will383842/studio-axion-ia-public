import React from "react";
/**
 * 8. ★ MotSaute (re-habillé v4) — le mot fort quitte le sous-titre et va se poser au-dessus de la tête, sur une plaque ACCENT_1 de 0,42 L.
 * Départ : au centre du sous-titre (0,5 L ; 0,72 H) · arrivée M1 en (0,70 L ; 0,10 H) à -6°. Déroulé : 0 la plaque se détache (le sous-titre masque son mot) ·
 * 0-8 arc passant À DROITE de la zone du visage (elle déborde un peu du cadre à droite), échelle 1 → ≈ 1,2-1,6 dans les dernières images · 8 CLAQUE à l'arrivée + 2 traits d'impact ENCRE (12 px, 0,05 L) qui jaillissent en 4 i ·
 * 15 sur-étiquette qui pop · sortie S-RETRECIT 3 i.
 */
import { Easing, useCurrentFrame } from "remotion";
import { Anim, COULEURS, H, Plaque, Son, SurEtiquette, W, accents, courbe, entreePop, largeurTexte, lerp, ressort } from "./commun-lot1";
import type { Palette } from "./commun-lot1";

export type MotSauteProps = {
  palette: Palette;
  mot: string;
  surEtiquette?: string;
  /** Centre de départ (px) : celui du mot dans le sous-titre. */
  depart?: { x: number; y: number };
  /** Image de l'arrivée (défaut 8). */
  arrivee?: number;
  /** Image de la sur-étiquette (défaut arrivée + 15). */
  instantSur?: number;
  sortie?: number;
  muet?: boolean;
};
export const DUREE_DEFAUT = 48;
export const CORPS_SOUS_TITRE = 84;
export const ARRIVEE = { x: 0.7 * W, y: 0.1 * H };
export const evenements = (p: Pick<MotSauteProps, "arrivee" | "instantSur" | "sortie">): number[] => [0, 4, p.arrivee ?? 8, p.instantSur ?? (p.arrivee ?? 8) + 15, p.sortie ?? 42];

/** L'échelle ne grossit que dans les dernières images (la plaque vole petite, loin de la zone du visage, puis gonfle en se posant). */
export const ECHELLE_EXPOSANT = 4;
/** Échelle au départ du vol (la plaque quitte le sous-titre un peu plus petite). */
export const ECHELLE_DEPART = 0.9;
/** Bord droit maximal de la plaque pendant tout le vol (jamais coupée par le bord du cadre). */
export const X_MAX = 0.95 * W;
const P0 = { x: 0.5 * W, y: 0.72 * H };
const C1 = { x: 1.2 * W, y: 0.85 * H };
const C2 = { x: 1.1 * W, y: 0.05 * H };
/** Point de la trajectoire à la progression `t` (Bézier cubique qui contourne la zone du visage par la droite). */
export function pointTrajetBrut(t: number, a = ARRIVEE, d = P0): { x: number; y: number } {
  const u = 1 - t;
  const f = (p0: number, p1: number, p2: number, p3: number) => u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  return { x: f(d.x, C1.x, C2.x, a.x), y: f(d.y, C1.y, C2.y, a.y) };
}
/** Position réelle du centre : trajectoire brute, bornée pour que le bord droit de la plaque reste ≤ 0,95 L. */
export function pointTrajet(t: number, mot: string, a = ARRIVEE, d = P0): { x: number; y: number; s: number } {
  const p = pointTrajetBrut(t, a, d);
  const s = lerp(ECHELLE_DEPART, echelleArrivee(mot), Math.pow(t, ECHELLE_EXPOSANT));
  return { x: Math.min(p.x, X_MAX - (largeurBase(mot) * s) / 2), y: p.y, s };
}
export const largeurBase = (mot: string): number => Math.round(largeurTexte(mot, CORPS_SOUS_TITRE) + 0.48 * CORPS_SOUS_TITRE + 10);
export const hauteurBase = (): number => Math.round(CORPS_SOUS_TITRE * 1.2 + 10);
export const echelleArrivee = (mot: string): number => Math.min(1.8, (0.42 * W) / largeurBase(mot));

export function MotSaute({ palette, mot, surEtiquette, depart = P0, arrivee = 8, instantSur, sortie = 42, muet }: MotSauteProps) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const sur = instantSur ?? arrivee + 15;
  const f = Math.max(0, 1 - courbe(i, sortie, 3, Easing.in(Easing.back(1.6))));
  if (i >= sortie + 3 || i < 0) return null;
  const p = courbe(i, 0, arrivee, Easing.inOut(Easing.quad));
  const pos = pointTrajet(p, mot, ARRIVEE, depart);
  const s1 = echelleArrivee(mot);
  const echelle = pos.s * (i >= arrivee ? 1 + 0.12 * (1 - Math.min(1, ressort("CLAQUE", i - arrivee))) : 1) * f;
  const incl = lerp(-2, -6, p);
  const bw = largeurBase(mot);
  const bh = hauteurBase();
  const impact = i >= arrivee && i < arrivee + 6;
  const k = i - arrivee;
  const trait = (angle: number, long: number) => {
    const e = courbe(k, 0, 4, Easing.out(Easing.cubic));
    const r = (bh * s1) / 2 + 16 + 24 * e;
    const ox = (bw * s1) / 2 * Math.cos((angle * Math.PI) / 180) * 0.95;
    const oy = (bh * s1) / 2 * Math.sin((angle * Math.PI) / 180) * 0.95;
    return <div key={angle} style={{ position: "absolute", left: ARRIVEE.x + ox + (r - (bh * s1) / 2) * Math.cos((angle * Math.PI) / 180) - long / 2, top: ARRIVEE.y + oy + (r - (bh * s1) / 2) * Math.sin((angle * Math.PI) / 180) - 6, width: long * Math.min(1, e * 1.4), height: 12, borderRadius: 6, background: COULEURS.ENCRE, transform: `rotate(${angle}deg)` }} />;
  };
  return (
    <>
      <div style={{ position: "absolute", left: pos.x, top: pos.y, width: 0, height: 0, transform: `scale(${echelle}) rotate(${incl}deg)` }}>
        <div style={{ position: "absolute", left: -bw / 2, top: -bh / 2 }}>
          <Plaque fond={ACCENT_1} corps={CORPS_SOUS_TITRE} largeur={bw} padV={0.1} padH={0.24} style={{ height: bh, padding: `${0.1 * CORPS_SOUS_TITRE}px ${0.24 * CORPS_SOUS_TITRE}px` }}>{mot}</Plaque>
        </div>
      </div>
      {impact && f >= 1 && (
        <>
          {trait(-150, 0.05 * W)}
          {trait(-100, 0.05 * W)}
        </>
      )}
      {surEtiquette && i >= sur ? (
        <Anim etat={entreePop(i - sur, { incl: -1.5, depart: 0.2, sortie: sortie - sur })} origine="0% 100%" style={{ position: "absolute", left: ARRIVEE.x - (bw * s1) / 2, top: ARRIVEE.y - (bh * s1) / 2 }}>
          <SurEtiquette texte={surEtiquette} />
        </Anim>
      ) : null}
      {!muet && <Son t={0} fichier="select_001" volume={0.2} />}
      {!muet && <Son t={arrivee} fichier="drop_003" volume={0.25} />}
    </>
  );
}
