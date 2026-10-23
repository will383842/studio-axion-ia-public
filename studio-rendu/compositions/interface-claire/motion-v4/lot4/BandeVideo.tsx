import React from "react";
/**
 * ÉLÉMENT 28 ★ `BandeVideo` (standard v4, lot 4, § F), REFAIT au tour 2 : une bande diagonale pleine largeur (épaisseur 0,24 H, -8°, contour 7 en haut et en bas),
 * entièrement sous le menton (bord haut ≥ 0,60 H), qui porte une BOÎTE DE RÉCEPTION animée (`BoiteReception` : une demande tombe toutes les 9 i). Aucun clip :
 * « les demandes arrivent » est montré littéralement, sans faux nom ni faux chiffre. Deux puces successives sur le bord haut (« LES DEMANDES » puis
 * « TOUTE LA JOURNÉE ») et un compteur ACCENT_2 « +1 » qui pulse à chaque demande. Toutes les puces restent dans les marges 0,05 L.
 *
 * Mouvement (i0 = mot dit) : E-COTE gauche le long de son axe (`GLISSE`) · demande neuve toutes les 9 i · puce 1 `POP` à i5, puce 2 à i30 · sortie S-COTE droite
 * 4 i (Easing.in cubique) sans bande vide, puces rétrécies avant. Visage : entier (bord haut de la bande mesuré ≥ 0,60 H).
 * Bruitages : `whoosh-in` (i0), `drop_001` (puce 1), `drop_002` (puce 2).
 */
import { BoiteReception } from "./interfaces-lot4";
import { EtiquetteBord, Impact, H, L, Sons, accents, aspire, bornePuce, prog, ress, TRAIT, ENCRE_BORD } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_BANDE_VIDEO = "bande-video";
const ANGLE = -8;
const LONG = 1.6 * L;
const EPAIS = 0.24 * H;
const CY = 0.775 * H;
const SORTIE = 4;
const I_PUCE = 5;
const I_PUCE_2 = 30;
const TH = (ANGLE * Math.PI) / 180;

export type PropsBandeVideo = { f: number; duree: number; palette: Palette; src?: string; depuisSec?: number; etiquette: string; etiquette2?: string; iPuce?: number; iPuce2?: number };

/** Position le long de l'axe de la bande (px) : 0 = posée. */
const axe = (f: number, duree: number): number => -(1 - Math.min(1.02, ress("GLISSE", f))) * 1.25 * L + prog(f, duree - SORTIE, SORTIE, aspire) * 1.3 * L;

export const mesuresBandeVideo: MesuresElement = { evenements: [0, 5, 9, 18, 27, 30, 36, 45, 54, 63, -SORTIE], couvre: () => [] };

/** Point du bord haut de la bande à l'abscisse écran voulue `x` (bande posée), décalé de `u` le long de l'axe. */
function surBordHaut(x: number, u: number, bas = false) {
  const vP = bas ? EPAIS / 2 : -EPAIS / 2;
  const uP = (x - L / 2 + vP * Math.sin(TH)) / Math.cos(TH);
  return { x: L / 2 + (uP + u) * Math.cos(TH) - vP * Math.sin(TH), y: CY + (uP + u) * Math.sin(TH) + vP * Math.cos(TH) };
}

export function BandeVideo(p: PropsBandeVideo) {
  const { ACCENT_1, ACCENT_2 } = accents(p.palette);
  const { f, duree } = p;
  const u = axe(f, duree);
  const iS = duree - SORTIE;
  if (f < 0 || f >= duree) return null;
  const e2 = p.etiquette2 ?? "TOUTE LA JOURNÉE";
  const i1 = p.iPuce ?? I_PUCE;
  const i2 = p.iPuce2 ?? I_PUCE_2;
  const x1 = bornePuce(0.36 * L, p.etiquette, 58);
  const x2 = bornePuce(0.62 * L, e2, 58);
  const xc = bornePuce(0.86 * L, "+1", 52);
  const a = surBordHaut(x1, u);
  const b = surBordHaut(x2, u);
  const c = surBordHaut(xc, u, true);
  const pulsesCompteur: number[] = [];
  for (let k = 9; k < duree; k += 9) pulsesCompteur.push(k);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, filter: `drop-shadow(11px 12px 0 #110A05)` }}>
        <div style={{ position: "absolute", left: (L - LONG) / 2, top: CY - EPAIS / 2, width: LONG, height: EPAIS, transform: `rotate(${ANGLE}deg) translateX(${u.toFixed(2)}px)`, transformOrigin: "50% 50%", overflow: "hidden", background: "#110A05" }}>
          <BoiteReception f={f} l={LONG} h={EPAIS} palette={p.palette} />
          <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: TRAIT.FORT, background: ENCRE_BORD }} />
          <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: TRAIT.FORT, background: ENCRE_BORD }} />
        </div>
      </div>
      <Impact f={f} f0={i1 + 2} x={a.x} y={a.y - 40} angles={[-100, -60, -20]} r0={50} />
      <EtiquetteBord f={f} debut={i1} fin={i2 + 2} x={a.x} y={a.y} texte={p.etiquette} fond={ACCENT_1} corps={58} inclinaison={-5} />
      <EtiquetteBord f={f} debut={i2} fin={iS - 3} x={b.x} y={b.y} texte={e2} fond={ACCENT_1} corps={58} inclinaison={-4} pulses={[i2 + 18, i2 + 36]} />
      <EtiquetteBord f={f} debut={i1 + 4} fin={iS - 3} x={c.x} y={c.y} texte="+1" fond={ACCENT_2} corps={52} inclinaison={4} pulses={pulsesCompteur} largeurMin={0.1 * L} />
      <Sons
        liste={[
          { f: 0, nom: "whoosh-in" },
          { f: i1, nom: "drop_001" },
          { f: i2, nom: "drop_002" },
        ]}
      />
    </>
  );
}

/** Sous-titres en haut (M7 : 0,075 H, au-dessus des cheveux). */
export const sousTitresBandeVideo = (): number => 0.075 * H;
