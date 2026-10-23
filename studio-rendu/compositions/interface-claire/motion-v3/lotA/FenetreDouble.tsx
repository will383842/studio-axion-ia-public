/**
 * ÉLÉMENT 3 « FENÊTRE-DOUBLE » (standard v3, lot A) : deux exemples (ou un avant / après) dits l'un après l'autre.
 *
 * Fenêtre A : K1 SUR LE VISAGE (x 0,05-0,86 L, y 0,11-0,68 H), posée à −3° (côté `sens`), entre en N1. Fenêtre B (plan P2,
 * ombre ×1,3) : 0,44 L × 0,30 H en x 0,50-0,94, y 0,50-0,80, posée à +5°, entre 8 i plus tard en N4 (glissement diagonal
 * depuis le coin bas-droit, `GLISSER`, deux copies fantômes à 25 % puis 12 % pendant 3 i, flou directionnel), avec une
 * secousse de 0,006 L à l'arrêt (de B seule : jamais de la prise). Chacune porte SON B-roll littéral et sa puce.
 *
 * Sortie : B part en premier (rechute diagonale vers son coin, 6 i), A en T1 fouet vers le côté d'où elle est venue.
 * Visage : couvert (A le couvre dès sa pose, B ne fait que chevaucher son coin bas-droit). Bruitage : `whoosh-in` à i0 puis
 * `drop_001` quand B se pose.
 */
import React from "react";
import { alpha, NUANCES } from "../../variantes/premium-2";
import { aspiration, BoiteFenetre, courbe, entreeN1, FiltreDirectionnel, img, microVie, Perspective, Puce, refletsApresPose, ressort, secousse, Son, sortieFouet, styleFlou, VideoDans, vitesse } from "./commun-v3";

export const ID_FENETRE_DOUBLE = "fenetre-double";
export const DUREE_FENETRE_DOUBLE = Object.freeze({ min: 2.0, max: 3.0 });
export const RECT_DOUBLE_A = Object.freeze({ x0: 0.05, x1: 0.86, y0: 0.11, y1: 0.68 });
export const RECT_DOUBLE_B = Object.freeze({ x0: 0.47, x1: 0.91, y0: 0.5, y1: 0.8 });
const RETARD_B = 8;
const SORTIE_A = 6;
const SORTIE_B = 5;
/** B quitte la scène 4 images avant A. */
const AVANCE_SORTIE_B = 9;

export type PropsFenetreDouble = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  srcA: string;
  srcB: string;
  depuisSecA?: number;
  depuisSecB?: number;
  etiquetteA: string;
  etiquetteB: string;
  sens?: 1 | -1;
  avecSons?: boolean;
};

export function FenetreDouble(p: PropsFenetreDouble) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const sens = p.sens ?? -1;
  const i = img(p.t, p.debut);
  const iFin = img(p.fin, p.debut);

  /* ---------------- A : N1 puis fouet ---------------- */
  const a = RECT_DOUBLE_A;
  const ax = a.x0 * W;
  const ay = a.y0 * H;
  const al = (a.x1 - a.x0) * W;
  const ah = (a.y1 - a.y0) * H;
  const iSortieA = iFin - SORTIE_A;
  const kA = i - iSortieA;
  const eA = entreeN1(i, sens, W);
  const sA = kA > 0 ? sortieFouet(kA, sens, W) : { dx: 0, rotY: 0, q: 0 };
  const mvA = microVie(p.t, i, 14, H);
  const dxA = (j: number) => entreeN1(j, sens, W).dx + (j - iSortieA > 0 ? sortieFouet(j - iSortieA, sens, W).dx : 0);
  const sxA = Math.min(0.025 * W, vitesse(dxA, i) * 0.07);
  const transformA = `translate(${(eA.dx + sA.dx).toFixed(2)}px, ${mvA.ty.toFixed(2)}px) rotateX(${mvA.rx.toFixed(3)}deg) rotateY(${(eA.rotY + sA.rotY).toFixed(2)}deg) rotateZ(${(eA.rotZ * (1 - 0.3 * sA.q)).toFixed(3)}deg)`;
  const refletA = refletsApresPose(i, 12);

  /* ---------------- B : N4 diagonal ---------------- */
  const b = RECT_DOUBLE_B;
  const bx = b.x0 * W;
  const by = b.y0 * H;
  const bl = (b.x1 - b.x0) * W;
  const bh = (b.y1 - b.y0) * H;
  const iB = i - RETARD_B;
  const iSortieB = iFin - AVANCE_SORTIE_B - SORTIE_B;
  const kB = i - iSortieB;
  // Position le long de la diagonale d'entrée (coin bas-droit, ≈ 35° sous l'horizontale).
  const DEPART = { x: 0.72 * W, y: 0.3 * H };
  const posB = (j: number) => {
    const jb = j - RETARD_B;
    const entree = 1 - ressort("GLISSER", jb);
    const sortie = j - iSortieB > 0 ? aspiration(Math.min(1, (j - iSortieB) / SORTIE_B)) : 0;
    const choc = secousse(jb - 8, 0.006 * W);
    return { x: DEPART.x * entree + DEPART.x * 1.15 * sortie + choc, y: DEPART.y * entree + DEPART.y * 1.15 * sortie + choc * 0.35 };
  };
  const pB = posB(i);
  const vB = Math.hypot(posB(i).x - posB(i - 1).x, posB(i).y - posB(i - 1).y);
  const dirX = posB(i).x - posB(i - 1).x;
  const dirY = posB(i).y - posB(i - 1).y;
  const norme = Math.hypot(dirX, dirY) || 1;
  // Le flou suit la diagonale : approximé par ses deux composantes (flou séparé en x et en y).
  const sbx = Math.min(0.022 * W, vB * 0.06) * Math.abs(dirX / norme);
  const sby = Math.min(0.022 * W, vB * 0.06) * Math.abs(dirY / norme);
  const rotB = 5 + 4 * (1 - ressort("GLISSER", iB)) + 3 * aspiration(Math.min(1, Math.max(0, kB / SORTIE_B)));
  const mvB = microVie(p.t, iB, 10, H);
  const reflet2 = refletsApresPose(iB, 12);
  const fantome = (retard: number, opacite: number) => {
    const q = posB(i - retard);
    return iB >= 0 && iB < 4 ? (
      <div key={retard} style={{ position: "absolute", left: bx, top: by, width: bl, height: bh, borderRadius: 0.045 * W, transform: `translate(${q.x}px, ${q.y}px) rotateZ(${rotB}deg)`, background: `linear-gradient(160deg, ${alpha(NUANCES.ivoire, opacite * 1.4)}, ${alpha(NUANCES.orangeVoile, opacite)})` }} />
    ) : null;
  };
  const idA = "flou-double-a";
  const idB = "flou-double-b";

  return (
    <>
      <FiltreDirectionnel id={idA} sx={sxA} sy={0} />
      <FiltreDirectionnel id={idB} sx={sbx} sy={sby} />
      <div style={{ position: "absolute", inset: 0, ...styleFlou(idA, sxA, 0) }}>
        <Perspective W={W}>
          <BoiteFenetre W={W} x={ax} y={ay} l={al} h={ah} rayon={0.045 * W} transform={transformA} flou={eA.flou} reflet={refletA}>
            <VideoDans src={p.srcA} depuisSec={p.depuisSecA ?? 0} debut={p.debut} />
          </BoiteFenetre>
        </Perspective>
      </div>
      <Puce texte={p.etiquetteA} W={W} x={sens === 1 ? ax - 0.004 * W : ax + al + 0.004 * W} y={ay + 0.045 * H} i={i} i0={6} rotation={-sens * 2} dx={1.35 * (eA.dx + sA.dx)} ancre={sens === 1 ? "gauche" : "droite"} sortie={courbe(kA, 0, 4)} />

      <div style={{ position: "absolute", inset: 0, ...styleFlou(idB, sbx, sby) }}>
        {iB >= 0 ? (
          <>
            {fantome(1.5, 0.18)}
            {fantome(3, 0.09)}
            <BoiteFenetre W={W} x={bx} y={by} l={bl} h={bh} rayon={0.04 * W} proche={1.3} transform={`translate(${(pB.x).toFixed(2)}px, ${(pB.y + mvB.ty).toFixed(2)}px) rotateZ(${rotB.toFixed(2)}deg)`} flou={0.008 * W * (1 - courbe(iB, 0, 4))} reflet={reflet2}>
              <VideoDans src={p.srcB} depuisSec={p.depuisSecB ?? 0} debut={p.debut + RETARD_B / 30} />
            </BoiteFenetre>
          </>
        ) : null}
      </div>
      <Puce texte={p.etiquetteB} W={W} x={bx + bl * 0.5} y={by + bh - 0.002 * H} i={i} i0={RETARD_B + 6} rotation={-3} dx={1.35 * pB.x} dy={1.35 * pB.y} ancre="centre" sortie={courbe(kB, 0, 4)} variante="orange" />

      <Son t0={p.debut} fichier="whoosh-in" actif={p.avecSons ?? true} />
      <Son t0={p.debut + (RETARD_B + 6) / 30} fichier="drop_001" actif={p.avecSons ?? true} />
      <Son t0={p.fin - (SORTIE_A) / 30} fichier="whoosh-out" volume={0.7} actif={p.avecSons ?? true} />
      <Son t0={p.fin - (AVANCE_SORTIE_B + SORTIE_B) / 30} fichier="select_002" volume={0.5} actif={p.avecSons ?? true} />
    </>
  );
}

