/**
 * ÉLÉMENT 15 — « MOT VERTICAL SUR LE BORD » (v3, lot D « La typo vivante », rhabillé de la v2 ; standard § G ligne 15).
 *
 * Quand : le THÈME d'un passage (« TEMPS », « ÉQUIPE »). Un mot DIT par Will, jamais un chiffre non dit.
 * Visage : ENTIER (le mot vit dans la colonne du bord, tourné de ∓90°, de y 0,11 H à y 0,61 H ; la prise ne bouge pas).
 * Côté : « gauche » (se lit du bas vers le haut) ou « droite » (miroir RÉEL : le texte reste lisible, il se lit du haut vers le bas).
 *
 * Chorégraphie (30 i/s, i0 = mot dit) :
 *  - i0 → i7   : balayage du bas vers le haut qui révèle le mot EN CREUX (contour encre fin de 0,004 L, la prise se voit dedans),
 *                bord du balayage ADOUCI (masque dégradé) ; en même temps le mot pivote sur son bord (perspective 1 400 px, rotateY de 52° à 0, `PIVOT`) ;
 *  - i3 → i10  : le REMPLISSAGE en `degradeOrange` (clair en haut, foncé en bas) suit le balayage 3 images plus tard, avec reflet de bord,
 *                ombre douce portée vers le bas et grain de 2 % (le biseau et l'extrusion sombres de la première version sont retirés : effet daté, critique du 16/10) ;
 *  - i12 → i22 : un reflet de lumière ivoire (bande à 20°) traverse les lettres une fois ;
 *  - ensuite   : défilement de 0,2 % L par image (vers le bas), jamais immobile ;
 *  - sortie    : FOUET VERTICAL (6 images, `Easing.in`) vers le haut avec flou directionnel vertical croissant.
 * Profondeur (V6) : ombre douce + perspective d'entrée + mise au point (flou de 0,006 L → 0 en 4 i) + flou de mouvement à la sortie.
 * Ressorts : `GLISSER` (défilement), `PIVOT` (pivot), `FOUET` (sortie). Bruitage : `whoosh-in` à i0 (whoosh-out sur le fouet).
 */
import React from "react";
import { avancesLettres, courbe, entrant, FPS, N3, POLICES, TAILLE_MIN, lin, rs, usePolicesD, alpha } from "./communD";
import type { FicheLot3, SonD } from "./communD";

export const ID_MOT_VERTICAL_BORD = "mot-vertical-bord";
export const DUREE_MOT_VERTICAL_BORD = Object.freeze({ min: 1.5, max: 3.0 });
export const SONS_MOT_VERTICAL_BORD: readonly SonD[] = [{ k: 0, fichier: "whoosh-in", volume: 0.7 }];

export const FICHE_MOT_VERTICAL_BORD: FicheLot3 = Object.freeze({
  id: ID_MOT_VERTICAL_BORD,
  numero: 15,
  nom: "Mot vertical sur le bord",
  emplacement: "Bord gauche (miroir droit réel) : mot de 0,18 L tourné de 90°, y ≈ 0,07 → 0,50 H (puis 0,56 H avec le défilement), 1re lettre coupée à 18 % par le bord",
  forme: "Lettres en creux puis dégradé orange, reflet, relief léger, grain 2 %",
  mouvement: "balayage bas → haut (7 i) + pivot 3D, remplissage +3 i, défilement 0,2 % L/i, fouet vertical flou",
  sortie: "fouet vertical",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_MOT_VERTICAL_BORD.min,
  dureeMax: DUREE_MOT_VERTICAL_BORD.max,
  quandUtiliser: "Le thème d'un passage. Un seul à la fois ; il peut rester 3 s.",
  sons: SONS_MOT_VERTICAL_BORD,
});

export type MotVerticalBordProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le mot thème DIT par Will. */
  mot: string;
  cote?: "gauche" | "droite";
};

const BEZ_BALAYAGE = [0.83, 0, 0.17, 1] as const;

export function MotVerticalBord(p: MotVerticalBordProps) {
  usePolicesD();
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const kSortie = (fin - debut) * FPS - 6;
  const droite = p.cote === "droite";
  const sgn = droite ? -1 : 1; // sens de la lumière : +1 = « local +x » regarde vers le haut de l'écran
  const mot = p.mot.toUpperCase();

  const em = avancesLettres(mot, 100).reduce((a, b) => a + b, 0) / 100;
  const taille = Math.max(TAILLE_MIN(W), Math.min((0.18 * W) / 0.7, (0.42 * H * 0.97) / em));
  const cap = taille * 0.7;
  const L = em * taille;
  const yc = 0.28 * H;
  const yBas = yc + L / 2;
  const yHaut = yc - L / 2;
  const xBase = 0.3 * cap; // 18 % de la hauteur des lettres coupés par le bord
  const xc = droite ? W - xBase : xBase;
  const rot = droite ? 90 : -90;

  // Défilement continu de 0,2 % L par image (vers le bas) dès la pose : le mot ne reste jamais figé ; la sortie le fouette vers le haut.
  const derive = k > 8 ? 0.002 * W * (Math.min(k, kSortie) - 8) : 0;
  const ks = k - kSortie;
  const sortie = ks > 0 ? entrant(ks, 0, 6) : 0;
  const ty = derive - sortie * 1.05 * H;
  const flouV = ks > 0 ? 0.03 * W * lin(ks, 0, 4) : 0;

  const marge = 0.02 * W;
  const fe = 0.06 * W; // adoucissement du bord du balayage
  const bord = (kk: number) => yBas + marge - (yBas - yHaut + 2 * marge + fe) * courbe(kk, 0, 7, BEZ_BALAYAGE);
  const bordR = (kk: number) => yBas + marge - (yBas - yHaut + 2 * marge + fe) * courbe(kk, 3, 10, BEZ_BALAYAGE);

  const contour = Math.max(3, 0.004 * W);
  const commun = { fontFamily: POLICES.titre, fontWeight: 800 as const, fontSize: taille, textAnchor: "middle" as const, strokeLinejoin: "round" as const };
  const yTexte = taille * 0.36;
  const T = `translate(${xc} ${yc}) rotate(${rot})`;
  const focus = 0.006 * W * (1 - lin(k, 0, 4));

  // Pivot 3D autour du bord : le mot « se pose ».
  const pivot = (droite ? -1 : 1) * 52 * Math.max(0, 1 - rs(k, "PIVOT"));
  const xBordCadre = droite ? W : 0;

  // Reflet qui passe (bande à 20°, de l'arrière vers l'avant du mot, une seule fois).
  const bande = 0.25 * W;
  const centre = sgn * (-L / 2 - bande + (L + 2 * bande) * (k < 40 ? courbe(k, 12, 22, [0.65, 0, 0.35, 1]) : courbe(k, 48, 58, [0.65, 0, 0.35, 1])));

  const mask = (id: string, y: number) => (
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={-2 * H} width={W} height={5 * H}>
      <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={y + fe}>
        <stop offset="0" stopColor="#000" />
        <stop offset="1" stopColor="#fff" />
      </linearGradient>
      <rect x={0} y={-2 * H} width={W} height={5 * H} fill={`url(#${id}-g)`} />
    </mask>
  );

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", perspective: 1400, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: `${xBordCadre}px 50%`, transform: `rotateY(${pivot}deg)`, filter: focus > 0.3 ? `blur(${focus}px)` : undefined }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "hidden" }}>
          <defs>
            {mask("m-creux", bord(k))}
            {mask("m-rempli", bordR(k))}
            <linearGradient id="orange-mot" gradientUnits="userSpaceOnUse" x1={-sgn * L / 2} y1={0} x2={sgn * L / 2} y2={0}>
              <stop offset="0" stopColor={N3.orangeProfond} />
              <stop offset="1" stopColor={N3.orangeChaud} />
            </linearGradient>
            <linearGradient id="reflet-mot" gradientUnits="userSpaceOnUse" x1={centre - bande / 2} y1={0} x2={centre + bande / 2} y2={0} gradientTransform={`rotate(20 ${centre} 0)`}>
              <stop offset="0" stopColor={N3.ivoire} stopOpacity={0} />
              <stop offset="0.5" stopColor={N3.ivoire} stopOpacity={0.6} />
              <stop offset="1" stopColor={N3.ivoire} stopOpacity={0} />
            </linearGradient>
            <filter id="ombre-mot" filterUnits="userSpaceOnUse" x={-W} y={-2 * H} width={3 * W} height={5 * H} colorInterpolationFilters="sRGB">
              <feDropShadow dx={0} dy={0.014 * W} stdDeviation={0.012 * W} floodColor={N3.encre} floodOpacity={0.3} />
              <feDropShadow dx={0} dy={0.004 * W} stdDeviation={0.004 * W} floodColor={N3.encre} floodOpacity={0.22} />
            </filter>
            <filter id="grain-mot" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="g" />
              <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 0.35 -0.145" result="gs" />
              <feComposite in="gs" in2="SourceGraphic" operator="atop" />
            </filter>
            <filter id="flou-v" filterUnits="userSpaceOnUse" x={-W} y={-2 * H} width={3 * W} height={5 * H}>
              <feGaussianBlur stdDeviation={`0 ${Math.max(0.01, flouV).toFixed(2)}`} />
            </filter>
          </defs>
          <g transform={`translate(0 ${ty})`} filter={flouV > 0.4 ? "url(#flou-v)" : undefined}>
            {/* Creux : contour encre fin, la prise se voit à travers les lettres. */}
            <g mask="url(#m-creux)">
              <g transform={T}>
                <text x={0} y={yTexte} {...commun} fill="none" stroke={N3.encre} strokeWidth={contour}>{mot}</text>
              </g>
            </g>
            {/* Remplissage : dégradé orange, reflet qui passe, grain 2 %. */}
            <g mask="url(#m-rempli)">
              <g filter="url(#ombre-mot)">
                <g filter="url(#grain-mot)">
                  <g transform={T}>
                    <text x={0} y={yTexte} {...commun} fill="url(#orange-mot)">{mot}</text>
                  </g>
                </g>
                <g transform={T}>
                  <text x={0} y={yTexte} {...commun} fill="url(#reflet-mot)">{mot}</text>
                  <text x={0} y={yTexte} {...commun} fill="none" stroke={alpha(N3.encre, 0.5)} strokeWidth={contour * 0.6}>{mot}</text>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
