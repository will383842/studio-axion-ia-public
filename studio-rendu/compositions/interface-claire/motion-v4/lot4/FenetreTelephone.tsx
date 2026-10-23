import React from "react";
/**
 * ÉLÉMENT 26 ★ `FenetreTelephone` (standard v4, lot 4, § F) : un téléphone (cadre ENCRE 24 px, rayon 64, îlot 0,16 L × 0,02 H) dont l'écran montre
 * un écran de signature d'appli (dessiné, tour 2 : une main qui signe un papier n'était pas « le client valide sur son téléphone ») ; un doigt (pastille BLANC 0,06 L, contour 5) touche le bouton « VALIDER » qui passe ACCENT_1 avec sa coche.
 *
 * Gabarit M4 réduit : x 0,20 → 0,80 L, y 0,07 → 0,66 H (couvre le visage). Mouvement (i0 = mot dit) : E-BAS (`CHUTE`, translateY +0,6 H → 0,
 * rotateZ 4° → 0) · i12 le doigt `POP` près du bouton · i16 toucher (`CLAQUE` 1 → 0,85 → 1, anneau ACCENT_1 de 0,04 → 0,10 L en 8 i, bouton
 * recoloré + coche) · étiquette sur le bord droit (`POP`, i6) · sortie S-BAS 4 i (translateY +0,7 H, Easing.in cubique), sans reste.
 * Visage : couvert · bruitages : `maximize_004` (i0), `tick_001` (toucher).
 */
import { Coche, EcranSignature } from "./interfaces-lot4";
import { Ancre, bornePuce, Impact, CoqueFenetre, EtiquetteBord, H, L, Sons, accents, aspire, borne, COULEURS, lerp, MONTSERRAT, prog, ress, rectTourne, RAYON, TRAIT, ombre } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_FENETRE_TELEPHONE = "fenetre-telephone";
const T = { x: 0.2 * L, y: 0.07 * H, l: 0.6 * L, h: 0.59 * H };
const I_TRACE = 4;
const I_DOIGT = 15;
const I_TOUCHE = 21;
const I_COCHE = 36; // 0,5 s après le toucher
const SORTIE = 4;
const { ENCRE, BLANC } = COULEURS;

export type PropsFenetreTelephone = { f: number; duree: number; palette: Palette; src?: string; depuisSec?: number; etiquette: string; etiquette2?: string; bouton?: string; iEtiq?: number; /** Textes décor de l'écran [en-tête, cadre, case] ; absent : « DEVIS », « SIGNATURE », « J'ACCEPTE ». */ textesEcran?: [string, string, string] };

function decalage(f: number, duree: number) {
  const entree = 1 - Math.min(1.1, ress("CHUTE", f));
  const sortie = prog(f, duree - SORTIE, SORTIE, aspire);
  return { ty: entree * 0.6 * H + sortie * 0.7 * H, rot: entree * 4, sortie };
}

export const mesuresFenetreTelephone: MesuresElement = {
  evenements: [0, 4, 6, 14, 19, I_DOIGT, I_TOUCHE, 29, I_COCHE, 44, 52, 60, 68, -SORTIE],
  couvre: (f, duree) => {
    const d = decalage(f, duree);
    if (d.sortie >= 1) return [];
    return [rectTourne(T.x, T.y, T.l, T.h, d.rot, 0, d.ty)];
  },
};

export function FenetreTelephone(p: PropsFenetreTelephone) {
  const { ACCENT_1 } = accents(p.palette);
  const { f, duree } = p;
  const d = decalage(f, duree);
  if (f < 0 || d.sortie >= 1) return null;
  const bez = 24;
  const ecranL = T.l - 2 * bez;
  const ecranH = T.h - 2 * bez;
  // bouton dans l'écran (repère de l'écran)
  const bl = ecranL * 0.78;
  const bh = 104;
  const bx = (ecranL - bl) / 2;
  const by = ecranH - bh - 70;
  const touche = f >= I_TOUCHE;
  const recolore = touche ? 1 : 0;
  // doigt : arrive du bas-droite vers le centre du bouton
  const kd = f - I_DOIGT;
  const doigtPop = ress("POP", f, I_DOIGT);
  const approche = prog(f, I_DOIGT, I_TOUCHE - I_DOIGT, (x) => 1 - Math.pow(1 - x, 2));
  const dx = lerp(150, 0, approche);
  const dy = lerp(170, 0, approche);
  const frappe = f >= I_TOUCHE ? 1 - 0.15 * Math.sin(Math.PI * borne((f - I_TOUCHE) / 6)) : 1;
  const ring = prog(f, I_TOUCHE, 8);
  const cx = T.x + bez + bx + bl * 0.9;
  const cy = T.y + bez + by + bh / 2 + 16;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, transform: `translateY(${d.ty.toFixed(2)}px) rotate(${d.rot.toFixed(2)}deg)`, transformOrigin: `${T.x + T.l / 2}px ${T.y + T.h / 2}px` }}>
        {/* corps du téléphone : cadre ENCRE 24 px, anneau clair pour le détacher, ombre L */}
        <div style={{ position: "absolute", left: T.x, top: T.y, width: T.l, height: T.h, background: ENCRE, borderRadius: 64, border: `${TRAIT.MOYEN}px solid ${COULEURS.IVOIRE_CLAIR}`, boxSizing: "border-box", boxShadow: ombre("L") }} />
        <div style={{ position: "absolute", left: T.x + bez, top: T.y + bez, width: ecranL, height: ecranH, borderRadius: 42, overflow: "hidden", background: ENCRE }}>
          <EcranSignature f={f} l={ecranL} h={ecranH} palette={p.palette} iTrace={I_TRACE} iTouche={I_TOUCHE} bouton={p.bouton ?? "VALIDER"} textes={p.textesEcran} />
          {/* îlot */}
          <div style={{ position: "absolute", left: (ecranL - 0.16 * L) / 2, top: 16, width: 0.16 * L, height: 0.02 * H, borderRadius: 999, background: ENCRE }} />
        </div>
        {f >= I_COCHE ? (
          <>
            <Ancre x={T.x + T.l / 2} y={T.y + T.h * 0.5}>
              <Coche f={f} debut={I_COCHE} d={0.115 * L} fond={ACCENT_1} />
            </Ancre>
            {[I_COCHE + 8, I_COCHE + 24].map((r0) => {
              const q = prog(f, r0, 8);
              return q > 0 && q < 1 ? <div key={r0} style={{ position: "absolute", left: T.x + T.l / 2, top: T.y + T.h * 0.5, width: lerp(0.1 * L, 0.2 * L, q), height: lerp(0.1 * L, 0.2 * L, q), transform: "translate(-50%, -50%)", borderRadius: 999, border: `8px solid ${ACCENT_1}`, boxShadow: `0 0 0 3px ${ENCRE}`, boxSizing: "border-box", opacity: 1 - q }} /> : null;
            })}
          </>
        ) : null}
        {/* doigt et anneau du toucher (dans le repère du téléphone, donc solidaires) */}
        {kd >= 0 ? (
          <>
            {ring > 0 && ring < 1 ? (
              <div
                style={{
                  position: "absolute",
                  left: cx,
                  top: cy,
                  width: lerp(0.04 * L, 0.1 * L, ring) * 2,
                  height: lerp(0.04 * L, 0.1 * L, ring) * 2,
                  transform: "translate(-50%, -50%)",
                  borderRadius: 999,
                  border: `10px solid ${ACCENT_1}`,
                  boxShadow: `0 0 0 4px ${ENCRE}`,
                  boxSizing: "border-box",
                  opacity: ring > 0.8 ? 0 : 1,
                }}
              />
            ) : null}
            <Ancre x={cx + dx + 24} y={cy + dy + 30} transform={`scale(${(lerp(0.3, 1, doigtPop) * frappe).toFixed(3)})`}>
              <div style={{ width: 0.06 * L, height: 0.06 * L, borderRadius: 999, background: BLANC, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxShadow: ombre("S"), boxSizing: "border-box" }} />
            </Ancre>
          </>
        ) : null}
      </div>
      <Impact f={f} f0={I_TOUCHE} x={T.x + bez + bx + bl * 0.8} y={T.y + bez + by + bh / 2 + 16 + d.ty - 60} angles={[-125, -90, -55]} r0={30} />
      <EtiquetteBord f={f} debut={p.iEtiq ?? 6} fin={I_TOUCHE + 5} x={bornePuce(T.x + T.l - 40, p.etiquette, 64)} y={T.y + 0.075 * T.h + d.ty} texte={p.etiquette} fond={ACCENT_1} corps={64} inclinaison={4} />
      <EtiquetteBord f={f} debut={I_TOUCHE + 8} fin={duree - SORTIE - 2} x={bornePuce(T.x + T.l - 40, p.etiquette2 ?? "DEVIS SIGNÉ", 60)} y={T.y + 0.075 * T.h + d.ty} texte={p.etiquette2 ?? "DEVIS SIGNÉ"} fond={ACCENT_1} corps={60} inclinaison={4} pulses={[52, 64]} />
      <Sons
        liste={[
          { f: 0, nom: "maximize_004" },
          { f: I_TOUCHE, nom: "tick_001" },
          { f: I_COCHE, nom: "vibreur", volume: 0.8 },
        ]}
      />
    </>
  );
}

/** Sous-titres : sous le téléphone (0,72 H est dans le téléphone qui descend jusqu'à 0,66 H : on pose à 0,75 H). */
export const sousTitresFenetreTelephone = (): number => 0.745 * H;
