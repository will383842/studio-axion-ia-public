/**
 * ÉLÉMENT 4 « FENÊTRE-PLEIN-CADRE » (standard v3, lot A) : la fenêtre K1 qui s'ouvre jusqu'aux bords (K4), puis se referme
 * en cercle vers le coin haut-droit. Élément « coup de poing » (E7) : jamais avant 10 s dans une vidéo.
 *
 * La vidéo est une couche FIXE de 1,0 L × 1,0 H ; seul le MASQUE (le rectangle arrondi) change de taille : l'ouverture est
 * donc une ouverture de masque (N3), PAS un zoom de la vidéo ni de la prise. Les coins passent de 0,045 L à 0.
 *
 * Mouvement (i0 = mot dit) : entre en N1 rapide (translation `VERRE`, rotateY `PIVOT`, flou directionnel) comme la fenêtre-
 * pivot → reflet qui passe (i12) → à i20 s'OUVRE jusqu'aux bords en 8 i (`POSER`, ombre qui s'efface, voile de vignette qui
 * monte) → une grande puce en verre encre se pose en bas → à la fin le masque SE REFERME en cercle (8 i, Easing.in cubic)
 * vers (0,90 L ; 0,07 H), diamètre 0,30 L, cerclé d'orange, puis le cercle s'éteint dans le coin (4 i) : le visage est
 * découvert en quelques images.
 * Visage : couvert · bruitage : `whoosh-in` à i0, `maximize_006` à l'ouverture, `minimize_004` à la fermeture.
 */
import React from "react";
import { alpha, NUANCES } from "../../variantes/premium-2";
import { aspiration, BoiteFenetre, courbe, entreeN1, FiltreDirectionnel, img, lerp, lisere, microVie, ombres, Perspective, Puce, Reflet, refletsApresPose, ressort, Son, styleFlou, Vignette, VideoDans, vitesse } from "./commun-v3";

export const ID_FENETRE_PLEIN_CADRE = "fenetre-plein-cadre";
export const DUREE_FENETRE_PLEIN_CADRE = Object.freeze({ min: 1.5, max: 2.5 });
export const RECT_PLEIN_CADRE_K1 = Object.freeze({ x0: 0.05, x1: 0.86, y0: 0.11, y1: 0.68 });
const IMAGE_OUVERTURE = 20;
const FERMETURE = 8;
const EXTINCTION = 4;
const MARGE_FIN = 3;

export type PropsFenetrePleinCadre = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  src: string;
  depuisSec?: number;
  etiquette: string;
  sens?: 1 | -1;
  avecSons?: boolean;
};

export function FenetrePleinCadre(p: PropsFenetrePleinCadre) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const sens = p.sens ?? 1;
  const k1 = RECT_PLEIN_CADRE_K1;
  const i = img(p.t, p.debut);
  const iFin = img(p.fin, p.debut);
  const iFerme = iFin - (FERMETURE + EXTINCTION + MARGE_FIN);
  const kF = i - iFerme;

  // Ouverture (POSER accéléré ×1,5 : ≈ 8 images) puis fermeture en cercle.
  const q = ressort("POSER", (i - IMAGE_OUVERTURE) * 1.5);
  const qBorne = Math.min(1, q);
  const q2 = kF > 0 ? courbe(kF, 0, FERMETURE, aspiration) : 0;
  const ext = kF > 0 ? courbe(kF, FERMETURE, EXTINCTION, aspiration) : 0;
  const cx = 0.9 * W;
  const cy = 0.07 * H;
  const rf = 0.15 * W * (1 - 0.5 * ext);
  const ccx = lerp(cx, 1.22 * W, ext);
  const ccy = lerp(cy, -0.14 * H, ext);
  // Rectangle de la fenêtre : K1 → plein cadre → cercle.
  const g = lerp(k1.x0 * W, 0, q);
  const hh = lerp(k1.y0 * H, 0, q);
  const d = lerp(k1.x1 * W, W, q);
  const b = lerp(k1.y1 * H, H, q);
  const L = lerp(g, ccx - rf, q2);
  const T = lerp(hh, ccy - rf, q2);
  const R = lerp(d, ccx + rf, q2);
  const B = lerp(b, ccy + rf, q2);
  const rayon = lerp(lerp(0.045 * W, 0, qBorne), rf, q2);

  const e = entreeN1(i, sens, W, 1.3);
  const mv = microVie(p.t, i, 12, H);
  const libre = 1 - qBorne;
  const dxj = (j: number) => entreeN1(j, sens, W, 1.3).dx;
  const sx = Math.min(0.025 * W, vitesse(dxj, i) * 0.07);
  const transform = `translate(${e.dx.toFixed(2)}px, ${(mv.ty * libre).toFixed(2)}px) rotateX(${(mv.rx * libre).toFixed(3)}deg) rotateY(${(e.rotY * libre).toFixed(2)}deg) rotateZ(${(e.rotZ * libre).toFixed(3)}deg)`;
  const origine = `${((k1.x0 + k1.x1) / 2) * W}px ${((k1.y0 + k1.y1) / 2) * H}px`;
  const reflet = refletsApresPose(i, 12);
  const ombre = Math.max(0, 1 - qBorne * 1.4) + q2 * (1 - ext);
  const idFiltre = "flou-plein-cadre";
  const l = R - L;
  const h = B - T;
  void BoiteFenetre;

  return (
    <>
      <FiltreDirectionnel id={idFiltre} sx={sx} sy={0} />
      <div style={{ position: "absolute", inset: 0, ...styleFlou(idFiltre, sx, 0) }}>
        <Perspective W={W}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform, transformOrigin: origine }}>
            {/* ombre douce (s'efface quand la fenêtre touche les bords, revient autour du cercle) */}
            <div style={{ position: "absolute", left: L, top: T, width: l, height: h, borderRadius: rayon, boxShadow: ombres(W), opacity: Math.min(1, ombre) }} />
            {/* la fenêtre : masque arrondi sur une vidéo FIXE plein cadre */}
            <div style={{ position: "absolute", left: L, top: T, width: l, height: h, borderRadius: rayon, overflow: "hidden", background: NUANCES.encre, filter: e.flou > 0.2 ? `blur(${e.flou.toFixed(2)}px)` : undefined }}>
              <div style={{ position: "absolute", left: -L, top: -T, width: W, height: H }}>
                <VideoDans src={p.src} depuisSec={p.depuisSec ?? 0} debut={p.debut} largeur={W} hauteur={H} />
                {/* voile de vignette qui monte à l'ouverture (coins sombres) */}
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(95% 80% at 50% 48%, ${alpha(NUANCES.encre, 0)} 52%, ${alpha(NUANCES.encre, 0.6)} 100%)`, opacity: qBorne * (1 - q2) }} />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0, width: l, height: h }}>
                <Vignette force={0.8} />
                <Reflet l={l} h={h} p={reflet} />
              </div>
            </div>
            {/* liseré ivoire (visible tant que la fenêtre n'est pas plein cadre) */}
            <div style={{ position: "absolute", left: L, top: T, width: l, height: h, borderRadius: rayon, boxShadow: lisere(W), opacity: 1 - qBorne * (1 - q2), pointerEvents: "none" }} />
            {/* anneau orange du cercle de fermeture */}
            {q2 > 0 && rf > 2 ? (
              <div style={{ position: "absolute", left: L - 0.012 * W, top: T - 0.012 * W, width: l + 0.024 * W, height: h + 0.024 * W, borderRadius: rayon + 0.012 * W, border: `${(0.007 * W).toFixed(1)}px solid ${alpha(NUANCES.orange, Math.min(1, q2 * 1.5))}`, boxSizing: "border-box", opacity: 1 - ext, pointerEvents: "none" }} />
            ) : null}
          </div>
        </Perspective>
      </div>
      <Puce texte={p.etiquette} W={W} x={0.5 * W} y={0.855 * H} i={i} i0={IMAGE_OUVERTURE + 7} rotation={-sens * 1.5} ancre="centre" taille={0.06 * W} variante="verreEncre" sortie={courbe(kF, 0, 4)} />
      <Son t0={p.debut} fichier="whoosh-in" actif={p.avecSons ?? true} />
      <Son t0={p.debut + IMAGE_OUVERTURE / 30} fichier="maximize_006" actif={p.avecSons ?? true} />
      <Son t0={p.debut + iFerme / 30} fichier="minimize_004" volume={0.8} actif={p.avecSons ?? true} />
    </>
  );
}
