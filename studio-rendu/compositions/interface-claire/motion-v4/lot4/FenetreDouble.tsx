import React from "react";
/**
 * ÉLÉMENT 27 ★ `FenetreDouble` (standard v4, lot 4, § F), REFAIT au tour 2 : deux fenêtres, chacune avec son étiquette qui chevauche un bord. Plus aucun clip : « le devis part,
 * il revient signé » est montré littéralement par deux écrans dessinés.
 * A (M4, x 0,06 → 0,94 L, y 0,09 → 0,63 H, -2°) = e-mail « VOTRE DEVIS » : le bouton ENVOYER est pressé, un avion de papier PART, « ENVOYÉ » + coche.
 * B (0,44 L × 0,30 H, bas droite, +4°) = le devis REVIENT : la signature se trace, tampon « SIGNÉ » (CLAQUE), coche ACCENT_1 de 64 px, B pulse 1 → 1,08 → 1.
 *
 * Mouvement (i0 = 1ᵉʳ mot) : A en E-COTE droite (`GLISSE`) · étiquette A « LE DEVIS » i4 puis « PART » à `iEnvoi` · B en E-COTE depuis le bas-droit à `iB` (`CHUTE`, secousse ±0,006 L)
 * avec « REVIENT », puis « SIGNÉ » au tampon · un geste de vie toutes les 12 i au plus jusqu'à la sortie (R4) · B sort 4 i AVANT A (S-COTE droite) · A sort S-COTE gauche 4 i.
 * Visage : couvert · bruitages : `whoosh-in` (i0), `tick_001` (envoi), `drop_002` (pose de B), `vibreur` (tampon).
 */
import { Coche, DocumentSigne, EmailEnvoi } from "./interfaces-lot4";
import { Ancre, CoqueFenetre, EtiquetteBord, Impact, H, L, Sons, accents, aspire, bornePuce, borne, lerp, prog, ress, rectTourne, secousse } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_FENETRE_DOUBLE = "fenetre-double";
const A = { x: 0.06 * L, y: 0.09 * H, l: 0.88 * L, h: 0.54 * H };
/** Rectangle de la carte B (fractions de L et H, avant secousse et rotation) : les sous-titres s'écartent de ce rectangle (`bandeSousTitresV4`). */
export const RECT_B_FENETRE_DOUBLE = { x0: 0.5, x1: 0.94, y0: 0.52, y1: 0.82 };
const B = { x: RECT_B_FENETRE_DOUBLE.x0 * L, y: RECT_B_FENETRE_DOUBLE.y0 * H, l: (RECT_B_FENETRE_DOUBLE.x1 - RECT_B_FENETRE_DOUBLE.x0) * L, h: (RECT_B_FENETRE_DOUBLE.y1 - RECT_B_FENETRE_DOUBLE.y0) * H };
const DEF_I_ENVOI = 14;
const DEF_I_B = 34;
const DEF_I_TAMPON = 46;
const SORTIE = 4;

export type PropsFenetreDouble = { f: number; duree: number; palette: Palette; srcA?: string; srcB?: string; etiquetteA?: string; etiquetteA2?: string; etiquetteB?: string; etiquetteB0?: string; iEnvoi?: number; iB?: number; iTampon?: number };

function geo(f: number, duree: number, I_B: number, I_T: number) {
  const iA = duree - SORTIE;
  const iB = iA - SORTIE;
  const eA = 1 - Math.min(1.05, ress("GLISSE", f));
  const sA = prog(f, iA, SORTIE, aspire);
  const txA = eA * L - sA * 1.12 * L;
  const rotA = -2 + (-4) * eA;
  const eB = 1 - Math.min(1.12, ress("CHUTE", f, I_B));
  const sB = prog(f, iB, SORTIE, aspire);
  const sec = secousse(f - (I_B + 7), 0.006 * L);
  const txB = eB * 0.6 * L + sB * 0.6 * L + sec;
  const tyB = eB * 0.45 * H;
  const rotB = 4 + 4 * eB;
  // B pulse (CLAQUE 1 → 1,08 → 1) à la coche et deux fois ensuite
  const pulseB = 1 + [I_T + 4, I_T + 20, I_T + 34].reduce((a, pf) => a + 0.08 * Math.sin(Math.PI * borne((f - pf) / 7)), 0);
  return { iA, iB, txA, rotA, txB, tyB, rotB, sA, sB, pulseB };
}

export const mesuresFenetreDouble: MesuresElement = {
  evenements: [0, 4, 10, 14, 18, 24, 34, 38, 46, 50, 58, 66, 74, 82, -SORTIE * 2, -SORTIE],
  couvre: (f, duree) => {
    const g = geo(f, duree, DEF_I_B, DEF_I_TAMPON);
    const r = [];
    if (g.sA < 1) r.push(rectTourne(A.x, A.y, A.l, A.h, g.rotA, g.txA));
    return r;
  },
};

export function FenetreDouble(p: PropsFenetreDouble) {
  const { ACCENT_1, ACCENT_2 } = accents(p.palette);
  const { f, duree } = p;
  const I_E = p.iEnvoi ?? DEF_I_ENVOI;
  const I_B = Math.max(p.iB ?? DEF_I_B, I_E + 14);
  const I_T = Math.max(p.iTampon ?? DEF_I_TAMPON, I_B + 12);
  const g = geo(f, duree, I_B, I_T);
  if (f < 0 || (g.sA >= 1 && g.sB >= 1)) return null;
  const eA = p.etiquetteA ?? "LE DEVIS";
  const eA2 = p.etiquetteA2 ?? "PART";
  const eB0 = p.etiquetteB0 ?? "REVIENT";
  const eB = p.etiquetteB ?? "SIGNÉ";
  const xLA = bornePuce(A.x + 0.78 * A.l, eA, 64) + g.txA;
  const yLA = A.y + 4;
  const xLB = bornePuce(B.x + 0.5 * B.l, eB0, 62) + g.txB;
  const yLB = B.y + B.h + g.tyB + 6;
  return (
    <>
      {g.sA < 1 ? (
        <>
          <CoqueFenetre x={A.x} y={A.y} l={A.l} h={A.h} rot={g.rotA} tx={g.txA}>
            <EmailEnvoi f={f} l={A.l} h={A.h} palette={p.palette} iEnvoi={I_E} />
          </CoqueFenetre>
          <EtiquetteBord f={f} debut={4} fin={I_E + 1} x={xLA} y={yLA} texte={eA} fond={ACCENT_1} corps={64} inclinaison={-3} />
          <EtiquetteBord f={f} debut={I_E + 4} fin={g.iA - 3} x={xLA} y={yLA} texte={eA2} fond={ACCENT_1} corps={64} inclinaison={-3} pulses={[I_E + 26, I_E + 44, I_E + 60]} />
        </>
      ) : null}
      {g.sB < 1 && f >= I_B ? (
        <>
          <CoqueFenetre x={B.x} y={B.y} l={B.l} h={B.h} rot={g.rotB} tx={g.txB} ty={g.tyB} echelle={g.pulseB}>
            <DocumentSigne f={f} l={B.l} h={B.h} palette={p.palette} iTrace={I_B + 6} iTampon={I_T} />
          </CoqueFenetre>
          <EtiquetteBord f={f} debut={I_B + 3} fin={I_T - 1} x={xLB} y={yLB} texte={eB0} fond={ACCENT_2} corps={62} inclinaison={3} />
          <EtiquetteBord f={f} debut={I_T} fin={g.iB - 3} x={bornePuce(B.x + 0.5 * B.l, eB, 62) + g.txB} y={yLB} texte={eB} fond={ACCENT_2} corps={62} inclinaison={3} pulses={[I_T + 20, I_T + 34]} />
          {f >= I_T + 4 ? (
            <Ancre x={B.x + B.l - 66 + g.txB} y={B.y + 14 + g.tyB}>
              <Coche f={f} debut={I_T + 4} d={64} fond={ACCENT_1} />
            </Ancre>
          ) : null}
        </>
      ) : null}
      {g.sB < 1 ? <Impact f={f} f0={I_B + 5} x={B.x + 20} y={B.y + 10} angles={[190, 225, 260]} r0={26} /> : null}
      <Sons
        liste={[
          { f: 0, nom: "whoosh-in" },
          { f: I_E, nom: "tick_001" },
          { f: I_B + 5, nom: "drop_002" },
          { f: I_T, nom: "vibreur", volume: 0.8 },
        ]}
      />
    </>
  );
}

/** Sous-titres sous B (qui descend à 0,82 H) : 0,91 H. */
export const sousTitresFenetreDouble = (): number => 0.91 * H;
