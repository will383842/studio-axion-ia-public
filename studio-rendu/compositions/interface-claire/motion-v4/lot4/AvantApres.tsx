import React from "react";
/**
 * ÉLÉMENT 31 `AvantApres` (standard v4, lot 4, § F) : une fenêtre M4 coupée en deux. À gauche « AVANT » (vidéo en NOIR ET BLANC), à droite « APRÈS » (vidéo en
 * couleur) ; une poignée ronde ENCRE (flèches ACCENT_1) sur la ligne de séparation balaie de gauche à droite sur le mot de bascule.
 *
 * Mouvement (i0 = « avant ») : E-COTE droite (`GLISSE`, rotateZ 6° → 2°) · la ligne commence à 0,85 de la largeur (AVANT presque plein) · à `iBalaie`
 * (« maintenant ») la poignée balaie jusqu'à 0,15 en 10 i (`GLISSE`) · étiquettes AVANT (GRIS) / APRÈS (ACCENT_1) collées en haut de chaque côté, à cheval sur
 * le bord (`POP`) · sortie S-COTE gauche 4 i. AVANT = vidéo (écriture à la main) ; APRÈS (tour 2) = liste qui se coche toute seule, dessinée (l'homme assis immobile ne disait pas « automatique »).
 * Visage : couvert · bruitages : `whoosh-in` (i0), `select_002` (balayage).
 */
import { Coche, ListeAuto } from "./interfaces-lot4";
import { Ancre, Clip, CoqueFenetre, EtiquetteBord, H, L, Sons, accents, aspire, bornePuce, COULEURS, lerp, prog, ress, rectTourne, TRAIT } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_AVANT_APRES = "avant-apres";
const W4 = { x: 0.06 * L, y: 0.09 * H, l: 0.88 * L, h: 0.54 * H };
const SORTIE = 4;
const { ENCRE, GRIS } = COULEURS;

export type PropsAvantApres = { f: number; duree: number; palette: Palette; srcAvant: string; srcApres?: string; depuisAvant?: number; depuisApres?: number; iBalaie: number; etiqAvant?: string; etiqApres?: string; etiqAuto?: string; iAuto?: number };

function geo(f: number, duree: number, iBalaie: number) {
  const e = 1 - Math.min(1.05, ress("GLISSE", f));
  const iS = duree - SORTIE;
  const s = prog(f, iS, SORTIE, aspire);
  const tx = e * L - s * 1.12 * L;
  const rot = 2 + 4 * e;
  const ligne = lerp(0.85, 0.15, Math.min(1, ress("GLISSE", f * 1, iBalaie) * 1));
  return { tx, rot, s, iS, ligne };
}

export const mesuresAvantApres = (iBalaie: number): MesuresElement => ({
  evenements: [0, 5, 8, 14, iBalaie, iBalaie + 6, iBalaie + 15, iBalaie + 24, iBalaie + 33, iBalaie + 42, -SORTIE],
  couvre: (f, duree) => {
    const g = geo(f, duree, iBalaie);
    return g.s >= 1 ? [] : [rectTourne(W4.x, W4.y, W4.l, W4.h, g.rot, g.tx)];
  },
});

export function AvantApres(p: PropsAvantApres) {
  const { ACCENT_1 } = accents(p.palette);
  const { f, duree } = p;
  const g = geo(f, duree, p.iBalaie);
  if (f < 0 || g.s >= 1) return null;
  const xl = g.ligne * W4.l;
  const iAuto = p.iAuto ?? p.iBalaie + 16;
  return (
    <>
      <CoqueFenetre
        x={W4.x}
        y={W4.y}
        l={W4.l}
        h={W4.h}
        rot={g.rot}
        tx={g.tx}
        dessus={
          <>
            {/* ligne de séparation ENCRE (7 px) et poignée ronde */}
            <div style={{ position: "absolute", left: xl - 3.5, top: 0, width: 7, height: "100%", background: ENCRE }} />
            <div style={{ position: "absolute", left: xl, top: W4.h / 2, transform: "translate(-50%, -50%)", width: 132, height: 132, borderRadius: 999, background: ENCRE, border: `${TRAIT.MOYEN}px solid ${COULEURS.BLANC}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `5px 6px 0 0 ${ENCRE}` }}>
              <svg width="92" height="54" viewBox="0 0 68 40">
                <path d="M20 4 L4 20 L20 36 Z" fill={ACCENT_1} />
                <path d="M48 4 L64 20 L48 36 Z" fill={ACCENT_1} />
              </svg>
            </div>
          </>
        }
      >
        <ListeAuto f={f} l={W4.l} h={W4.h} palette={p.palette} depuis={p.iBalaie + 6} gauche={0.2 * W4.l} />
        <div style={{ position: "absolute", left: 0, top: 0, width: xl, height: "100%", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W4.l, height: W4.h }}>
            <Clip nom={p.srcAvant} depuisSec={p.depuisAvant ?? 0.3} gris />
          </div>
        </div>
      </CoqueFenetre>
      <EtiquetteBord f={f} debut={5} fin={g.iS - 3} x={bornePuce(W4.x + 0.17 * W4.l, p.etiqAvant ?? "AVANT", 56) + g.tx} y={W4.y + 6} texte={p.etiqAvant ?? "AVANT"} fond={GRIS} corps={56} inclinaison={-3} largeurMin={0.22 * L} pulses={[14]} />
      <EtiquetteBord f={f} debut={8} fin={g.iS - 3} x={bornePuce(W4.x + 0.84 * W4.l, p.etiqApres ?? "APRÈS", 56) + g.tx} y={W4.y + 6} texte={p.etiqApres ?? "APRÈS"} fond={ACCENT_1} corps={56} inclinaison={2.5} largeurMin={0.22 * L} pulses={[p.iBalaie + 12, p.iBalaie + 26]} />
      {f >= iAuto ? (
        <>
          <EtiquetteBord f={f} debut={iAuto} fin={g.iS - 3} x={bornePuce(W4.x + 0.5 * W4.l, p.etiqAuto ?? "AUTOMATIQUE", 60) + g.tx} y={W4.y + W4.h + 8} texte={p.etiqAuto ?? "AUTOMATIQUE"} fond={ACCENT_1} corps={60} inclinaison={-2} pulses={[iAuto + 16, iAuto + 32]} />
          <Ancre x={W4.x + W4.l - 70 + g.tx} y={W4.y + 84}>
            <Coche f={f} debut={iAuto + 3} d={72} fond={ACCENT_1} />
          </Ancre>
        </>
      ) : null}
      <Sons
        liste={[
          { f: 0, nom: "whoosh-in" },
          { f: p.iBalaie, nom: "select_002" },
          { f: iAuto, nom: "tick_002" },
        ]}
      />
    </>
  );
}

export const sousTitresAvantApres = (): number => 0.745 * H;
