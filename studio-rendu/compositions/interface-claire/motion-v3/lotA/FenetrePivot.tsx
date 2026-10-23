/**
 * ÉLÉMENT 1 « FENÊTRE-PIVOT » (standard v3, lot A) : la fenêtre vidéo de la référence, en mieux.
 *
 * Emplacement SUR LE VISAGE (x 0,05-0,86 L, y 0,11-0,68 H, ≈ 46 %, rapport 4:5) · forme K1 (carte arrondie, coins 0,045 L,
 * posée à −2,5°) · matière C.3 (ombre douce en 3 couches, liseré ivoire, vignette, reflet qui passe) · contenu : un B-roll
 * littéral SANS zoom + une puce-étiquette qui chevauche le bas-gauche (+6 i, plan P2, parallaxe ×1,35).
 *
 * Mouvement (i0 = mot dit) : N1 pivot latéral (translation 1,0 L → 0 `VERRE`, rotateY 38° → 0 `PIVOT`, rotateZ 7° → 2,5°,
 * flou directionnel pendant les images rapides, mise au point en 4 i) → flottement + reflet qui passe à i14 → T1 FOUET
 * (5 i) vers le côté d'où elle est venue, avec flou directionnel. Le visage est COUVERT au plus tôt possible : à l'entrée
 * et à la sortie il n'est partiellement couvert que quelques images, en mouvement (vérifié sur les images rendues).
 * Visage : couvert · bruitage : `whoosh-in` à i0, `whoosh-out` au départ. Aucune prise déplacée ni zoomée.
 */
import React from "react";
import { BoiteFenetre, courbe, entreeN1, FiltreDirectionnel, img, microVie, Perspective, refletsApresPose, Puce, ressort, Son, sortieFouet, styleFlou, VideoDans, vitesse } from "./commun-v3";

export const ID_FENETRE_PIVOT = "fenetre-pivot";
export const DUREE_FENETRE_PIVOT = Object.freeze({ min: 1.2, max: 3.0 });
/** Emprise posée (fractions de l'image) : couvre toute la zone du visage (x 0,25-0,75, y 0,12-0,58) même inclinée de 2,5°. */
export const RECT_FENETRE_PIVOT = Object.freeze({ x0: 0.05, x1: 0.86, y0: 0.11, y1: 0.68 });
/** Images de sortie (T1 fouet). */
const SORTIE = 6;

export type PropsFenetrePivot = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Chemin de la vidéo (par défaut un clip du pool, via `staticFile` côté planche). */
  src: string;
  depuisSec?: number;
  /** Mot dit, en capitales dans la puce. */
  etiquette: string;
  /** +1 : arrive de la droite (référence) ; −1 : miroir, arrive de la gauche. */
  sens?: 1 | -1;
  avecSons?: boolean;
};

export function FenetrePivot(p: PropsFenetrePivot) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const sens = p.sens ?? 1;
  const r = RECT_FENETRE_PIVOT;
  const x = r.x0 * W;
  const y = r.y0 * H;
  const l = (r.x1 - r.x0) * W;
  const h = (r.y1 - r.y0) * H;
  const i = img(p.t, p.debut);
  const iSortie = img(p.fin, p.debut) - SORTIE;
  const k = i - iSortie;

  // Entrée N1 puis sortie fouet (la sortie prend le relais de l'entrée, sans couture : l'entrée vaut 0 à ce moment).
  const e = entreeN1(i, sens, W);
  const s = k > 0 ? sortieFouet(k, sens, W) : { dx: 0, rotY: 0, q: 0 };
  const mv = microVie(p.t, i, 14, H);
  const dx = e.dx + s.dx;
  const rotZ = e.rotZ * (1 - 0.35 * s.q);
  // Flou directionnel : proportionnel à la vitesse réelle (px/image), borné à 0,025 L.
  const vit = Math.max(vitesse((j) => entreeN1(j, sens, W).dx + (j - iSortie > 0 ? sortieFouet(j - iSortie, sens, W).dx : 0), i), 0);
  const sx = Math.min(0.025 * W, vit * 0.07);
  const reflet = refletsApresPose(i, 12);
  const transform = `translate(${dx.toFixed(2)}px, ${mv.ty.toFixed(2)}px) rotateX(${mv.rx.toFixed(3)}deg) rotateY(${(e.rotY + s.rotY).toFixed(2)}deg) rotateZ(${rotZ.toFixed(3)}deg)`;
  const idFiltre = "flou-pivot";

  // Puce (plan P2) : +6 i, chevauche le bas de la fenêtre côté entrée ; parallaxe ×1,35 ; part avant la fenêtre.
  const puceX = sens === 1 ? 0.065 * W : x + l - 0.005 * W;
  const puceDx = 1.35 * (e.dx + s.dx) + (k > 0 ? -sens * W * 0.2 * ressort("FOUET", k) : 0);

  return (
    <>
      <FiltreDirectionnel id={idFiltre} sx={sx} sy={0} />
      <div style={{ position: "absolute", inset: 0, ...styleFlou(idFiltre, sx, 0) }}>
        <Perspective W={W}>
          <BoiteFenetre W={W} x={x} y={y} l={l} h={h} rayon={0.045 * W} transform={transform} flou={e.flou} reflet={reflet}>
            <VideoDans src={p.src} depuisSec={p.depuisSec ?? 0} debut={p.debut} />
          </BoiteFenetre>
        </Perspective>
      </div>
      <Puce texte={p.etiquette} W={W} x={puceX} y={y + h - 0.004 * H} i={i} i0={6} rotation={sens * 2} dx={puceDx} sortie={courbe(k, 0, 4)} ancre={sens === 1 ? "gauche" : "droite"} />
      <Son t0={p.debut} fichier="whoosh-in" actif={p.avecSons ?? true} />
      <Son t0={p.fin - SORTIE / 30} fichier="whoosh-out" volume={0.7} actif={p.avecSons ?? true} />
    </>
  );
}
