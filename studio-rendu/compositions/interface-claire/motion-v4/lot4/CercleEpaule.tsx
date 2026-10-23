import React from "react";
/**
 * ÉLÉMENT 29 ★ `CercleEpaule` (standard v4, lot 4, § F) : une vidéo dans un cercle de 0,46 L (contour 7, ombre L) entièrement dans le cadre
 * (centre x 0,74 L, y 0,72 H, ou miroir à gauche) ; un anneau ACCENT_1 décalé de 0,012 L, fait de 3 arcs, se trace puis tourne ; une puce sous le cercle.
 *
 * Mouvement (i0 = mot dit) : le cercle `POP` depuis 0,1 · l'anneau se trace en 9 i puis tourne à 0,6°/i · la puce s'étire (E-ETIRE) à i9 ·
 * sortie S-RETRECIT 3 i vers le bord du cadre (cercle, anneau et puce ensemble), sans reste.
 * Visage : entier · bruitages : `select_001` (i0), `tick_002` (puce).
 */
import { AppelEntrant } from "./interfaces-lot4";
import { Ancre, EtiquetteBord, Impact, H, L, Sons, accents, bornePuce, COULEURS, lerp, prog, ress, retrecit, ombre, TRAIT } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_CERCLE_EPAULE = "cercle-epaule";
const D = 0.46 * L;
const R = D / 2;
const CY = 0.69 * H;
const I_PUCE = 9;
const { ENCRE } = COULEURS;

export type PropsCercleEpaule = { f: number; duree: number; palette: Palette; src?: string; depuisSec?: number; etiquette: string; cote?: "droite" | "gauche"; iBarre?: number; etiquetteBarre?: string };

export const mesuresCercleEpaule: MesuresElement = { evenements: [0, 5, I_PUCE, I_PUCE + 9, 21, 30, 34, 42, 52, -3], couvre: () => [] };

export function CercleEpaule(p: PropsCercleEpaule) {
  const { ACCENT_1 } = accents(p.palette);
  const { f, duree } = p;
  if (f < 0) return null;
  const droite = (p.cote ?? "droite") === "droite";
  const CX = (droite ? 0.69 : 0.31) * L;
  const iS = duree - 3;
  const sortie = retrecit(f, iS, 3);
  if (sortie === null) return null;
  const pop = lerp(0.1, 1, ress("POP", f));
  const echelle = pop * sortie;
  // vers le bord du cadre pendant la sortie
  const versBord = 1 - sortie;
  const dx = (droite ? 1 : -1) * versBord * (0.2 * L);
  // Anneau : 3 arcs qui grandissent de 0 à 80° en 9 i, puis rotation continue 0,6°/i.
  const rAnneau = R + 0.012 * L + 14;
  const C = 2 * Math.PI * rAnneau;
  const arc = (C / 3) * 0.7 * prog(f, 0, 9);
  const rot = f * 0.6;
  const taille = 2 * (rAnneau + 14);
  const sortiePuce = iS - 1;
  const iB = p.iBarre ?? 34;
  // trait ACCENT_2 qui barre le cercle (diagonale tracée en 4 i, contour encre), puis puce « −1 APPEL » qui CLAQUE
  const barre = prog(f, iB, 4);
  const xb = bornePuce(CX - 0.1 * L, p.etiquetteBarre ?? "−1 APPEL", 46);
  return (
    <>
      <Ancre x={CX + dx} y={CY} transform={`scale(${echelle.toFixed(3)})`}>
        <div style={{ width: D, height: D, borderRadius: 999, boxSizing: "border-box", border: `${TRAIT.FORT}px solid ${ENCRE}`, boxShadow: ombre("L"), overflow: "hidden", position: "relative", background: ENCRE }}>
          <AppelEntrant f={f} d={D} palette={p.palette} calme={iB} />
          {f >= iB ? (
            <svg width={D} height={D} viewBox="0 0 100 100" style={{ position: "absolute", left: 0, top: 0 }}>
              <line x1="18" y1="82" x2={18 + 64 * barre} y2={82 - 64 * barre} stroke={ENCRE} strokeWidth="19" strokeLinecap="round" />
              <line x1="18" y1="82" x2={18 + 64 * barre} y2={82 - 64 * barre} stroke={accents().ACCENT_1} strokeWidth="12" strokeLinecap="round" />
            </svg>
          ) : null}
        </div>
        <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} style={{ position: "absolute", left: (D - taille) / 2, top: (D - taille) / 2, transform: `rotate(${rot}deg)`, overflow: "visible" }}>
          <circle cx={taille / 2} cy={taille / 2} r={rAnneau} fill="none" stroke={ENCRE} strokeWidth={22} strokeDasharray={`${arc + 8} ${C / 3 - arc - 8}`} />
          <circle cx={taille / 2} cy={taille / 2} r={rAnneau} fill="none" stroke={ACCENT_1} strokeWidth={10} strokeDasharray={`${arc} ${C / 3 - arc}`} strokeDashoffset={-4} />
        </svg>
      </Ancre>
      <Impact f={f} f0={5} x={CX} y={CY} r0={R + 20} angles={droite ? [-50, -90, -130] : [-130, -90, -50]} />
      <EtiquetteBord f={f} debut={iB + 3} fin={sortiePuce} x={xb + dx} y={CY - R - 52} texte={p.etiquetteBarre ?? "−1 APPEL"} fond={accents(p.palette).ACCENT_2} corps={46} inclinaison={droite ? -5 : 5} pulses={[iB + 17, iB + 31]} />
      <EtiquetteBord f={f} debut={I_PUCE} fin={sortiePuce} x={bornePuce(CX, p.etiquette, 52) + dx} y={CY + R + 6} texte={p.etiquette} fond={ACCENT_1} corps={52} inclinaison={droite ? -3 : 3} pulses={[21, iB + 8, iB + 22]} />
      <Sons
        liste={[
          { f: 0, nom: "select_001" },
          { f: I_PUCE, nom: "tick_002" },
        ]}
      />
    </>
  );
}

/** Sous-titres en haut (M6 : 0,075 H). */
export const sousTitresCercleEpaule = (): number => 0.075 * H;
