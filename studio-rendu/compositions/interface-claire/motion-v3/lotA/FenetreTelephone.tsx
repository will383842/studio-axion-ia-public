/**
 * ÉLÉMENT 2 « FENÊTRE-TÉLÉPHONE » (standard v3, lot A) : un téléphone qui se redresse devant le visage et montre un B-roll
 * vertical sur son écran.
 *
 * Emplacement SUR LE VISAGE (x ≈ 0,20-0,80 L, y 0,065-0,705 H, ≈ 38 %) · forme K2 (écran de téléphone : cadre encre de
 * 0,012 L avec reflet, îlot, coins de 0,075 L) · contenu : un B-roll VERTICAL littéral, sans zoom, et un doigt (pastille
 * ivoire à 40 %) qui touche l'écran avec un anneau orange de 0,04 L qui s'étend en 8 i · une puce-étiquette (plan P2) qui
 * chevauche le bord droit.
 *
 * Mouvement (i0 = mot dit) : N2 « bascule depuis le bas » (translation de 0,85 H → 0 `VERRE`, rotateX 28° → 6° `PIVOT`
 * : le téléphone est couché puis se redresse, rotateZ +5° → +3°, flou directionnel vertical + mise au point) → micro-bascule
 * de ±0,6° → toucher à i24 → rechute vers le bas (6 i, rotateX vers 35°, Easing.in cubic) avec flou directionnel.
 * Visage : couvert (le téléphone et son ombre couvrent x 0,25-0,75 / y 0,12-0,58 une fois posé, même incliné de 3° et en
 * perspective de 6°). Bruitage : `maximize_004` à i0, `tick_001` au toucher, `minimize_004` à la rechute.
 */
import React from "react";
import { alpha, NUANCES } from "../../variantes/premium-2";
import { aspiration, courbe, FiltreDirectionnel, img, lerp, microVie, ombres, Perspective, Puce, Reflet, refletsApresPose, ressort, Son, styleFlou, Vignette, VideoDans, vitesse } from "./commun-v3";

export const ID_FENETRE_TELEPHONE = "fenetre-telephone";
export const DUREE_FENETRE_TELEPHONE = Object.freeze({ min: 1.5, max: 3.0 });
/** Emprise posée (fractions de l'image). */
export const RECT_TELEPHONE = Object.freeze({ x0: 0.1975, x1: 0.8025, y0: 0.065, y1: 0.705 });
const SORTIE = 6;
const IMAGE_TOUCHER = 22;

export type PropsFenetreTelephone = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  src: string;
  depuisSec?: number;
  etiquette: string;
  avecSons?: boolean;
};

export function FenetreTelephone(p: PropsFenetreTelephone) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const r = RECT_TELEPHONE;
  const x = r.x0 * W;
  const y = r.y0 * H;
  const l = (r.x1 - r.x0) * W;
  const h = (r.y1 - r.y0) * H;
  const i = img(p.t, p.debut);
  const iSortie = img(p.fin, p.debut) - SORTIE;
  const k = i - iSortie;

  // N2 : bascule depuis le bas. Le ressort de translation est « vif » (×1,3) pour que le visage ne reste pas plus de 3 images à moitié couvert.
  const ty = (j: number) => 0.85 * H * (1 - ressort("VERRE", j * 1.3)) + (j - iSortie > 0 ? 0.98 * H * aspiration(Math.min(1, (j - iSortie) / SORTIE)) : 0);
  const pPivot = ressort("PIVOT", i);
  const sortie = k > 0 ? aspiration(Math.min(1, k / SORTIE)) : 0;
  const rotX = 6 + 22 * (1 - pPivot) + 29 * sortie;
  const rotZ = 3 + 2 * (1 - ressort("VERRE", i * 1.3));
  const mv = microVie(p.t, i, 12, H);
  const vit = vitesse(ty, i);
  const sy = Math.min(0.022 * W, vit * 0.07);
  const flouMiseAuPoint = 0.008 * W * (1 - courbe(i, 0, 4));
  const bascule = 0.6 * Math.sin((2 * Math.PI * p.t) / 2.4) * courbe(i, 12, 10);
  const transform = `translateY(${(ty(i) + mv.ty).toFixed(2)}px) rotateX(${(rotX + mv.rx).toFixed(3)}deg) rotateZ(${(rotZ + bascule).toFixed(3)}deg)`;

  const cadre = 0.012 * W;
  const rayon = 0.075 * W;
  const rayonEcran = rayon - cadre * 0.8;
  const reflet = refletsApresPose(i, 13);

  // Toucher : pastille ivoire à 40 % (3 i), anneau orange qui s'étend en 8 i.
  const kt = i - IMAGE_TOUCHER;
  const tx = 0.6 * (l - 2 * cadre);
  const tyy = 0.64 * (h - 2 * cadre);
  const pastille = kt >= 0 && kt < 10 ? courbe(kt, 0, 3) * (1 - courbe(kt, 5, 5)) : 0;
  const anneau = courbe(kt, 0, 8, (v) => 1 - (1 - v) * (1 - v));
  const diametreAnneau = lerp(0.02, 0.085, anneau) * W;
  const idFiltre = "flou-telephone";

  return (
    <>
      <FiltreDirectionnel id={idFiltre} sx={0} sy={sy} />
      <div style={{ position: "absolute", inset: 0, ...styleFlou(idFiltre, 0, sy) }}>
        <Perspective W={W}>
          <div
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: l,
              height: h,
              borderRadius: rayon,
              transform,
              transformOrigin: "50% 50%",
              filter: flouMiseAuPoint > 0.2 ? `blur(${flouMiseAuPoint.toFixed(2)}px)` : undefined,
              background: `linear-gradient(150deg, ${NUANCES.encreDouce} 0%, ${NUANCES.encre} 38%, ${NUANCES.encre} 100%)`,
              boxShadow: `${ombres(W)}, inset 0 0 0 ${(0.0022 * W).toFixed(1)}px ${alpha(NUANCES.ivoire, 0.3)}, inset 0 ${(0.004 * W).toFixed(1)}px 0 ${alpha(NUANCES.ivoire, 0.22)}`,
            }}
          >
            {/* boutons latéraux : petits reliefs encre qui dépassent du cadre */}
            <div style={{ position: "absolute", left: -0.004 * W, top: h * 0.2, width: 0.006 * W, height: h * 0.07, borderRadius: 0.003 * W, background: NUANCES.encreDouce }} />
            <div style={{ position: "absolute", left: -0.004 * W, top: h * 0.29, width: 0.006 * W, height: h * 0.07, borderRadius: 0.003 * W, background: NUANCES.encreDouce }} />
            <div style={{ position: "absolute", right: -0.004 * W, top: h * 0.26, width: 0.006 * W, height: h * 0.11, borderRadius: 0.003 * W, background: NUANCES.encreDouce }} />
            {/* écran */}
            <div style={{ position: "absolute", left: cadre, top: cadre, right: cadre, bottom: cadre, borderRadius: rayonEcran, overflow: "hidden", background: NUANCES.encre }}>
              <VideoDans src={p.src} depuisSec={p.depuisSec ?? 0} debut={p.debut} />
              <Vignette force={0.8} />
              {/* verre de l'écran : reflet diagonal fixe */}
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(118deg, ${alpha(NUANCES.ivoire, 0.13)} 0%, ${alpha(NUANCES.ivoire, 0)} 32%)` }} />
              <Reflet l={l - 2 * cadre} h={h - 2 * cadre} p={reflet} />
              {/* îlot */}
              <div style={{ position: "absolute", left: "50%", top: 0.014 * W, width: 0.15 * W, height: 0.04 * W, transform: "translateX(-50%)", borderRadius: 0.02 * W, background: NUANCES.encre, boxShadow: `0 0 0 ${(0.0016 * W).toFixed(1)}px ${alpha(NUANCES.ivoire, 0.1)}` }} />
              {/* toucher du doigt */}
              {kt >= 0 ? (
                <>
                  <div style={{ position: "absolute", left: tx - diametreAnneau / 2, top: tyy - diametreAnneau / 2, width: diametreAnneau, height: diametreAnneau, borderRadius: "50%", border: `${(0.006 * W).toFixed(1)}px solid ${alpha(NUANCES.orange, 1 - anneau * 0.85)}` }} />
                  <div style={{ position: "absolute", left: tx - 0.05 * W, top: tyy - 0.05 * W, width: 0.1 * W, height: 0.1 * W, borderRadius: "50%", background: alpha(NUANCES.ivoire, 0.45), transform: `scale(${(0.6 + 0.4 * pastille).toFixed(3)})`, opacity: pastille, boxShadow: `0 ${(0.004 * W).toFixed(1)}px ${(0.012 * W).toFixed(1)}px ${alpha(NUANCES.encre, 0.3)}` }} />
                </>
              ) : null}
            </div>
            {/* liseré de verre autour du cadre */}
            <div style={{ position: "absolute", left: cadre, top: cadre, right: cadre, bottom: cadre, borderRadius: rayonEcran, boxShadow: `inset 0 0 0 ${(0.0016 * W).toFixed(1)}px ${alpha(NUANCES.ivoire, 0.18)}`, pointerEvents: "none" }} />
          </div>
        </Perspective>
      </div>
      <Puce texte={p.etiquette} W={W} x={r.x1 * W + 0.09 * W} y={y + h * 0.84} i={i} i0={8} rotation={-2} ancre="droite" dy={1.35 * ty(i)} dx={0} sortie={courbe(k, 0, 4)} />
      <Son t0={p.debut} fichier="maximize_004" actif={p.avecSons ?? true} />
      <Son t0={p.debut + IMAGE_TOUCHER / 30} fichier="tick_001" actif={p.avecSons ?? true} />
      <Son t0={p.fin - SORTIE / 30} fichier="minimize_004" volume={0.7} actif={p.avecSons ?? true} />
    </>
  );
}
