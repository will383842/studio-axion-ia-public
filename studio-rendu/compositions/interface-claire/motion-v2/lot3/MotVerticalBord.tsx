/**
 * ÉLÉMENT 12 — « MOT VERTICAL SUR LE BORD » (v2 énergie, lot 3, designer n° 3, 16/10/2026).
 * Standard : § D lot 3, ligne 12 ; E2 gauche ; F11 en creux puis rempli ; mouvement M2 (balayage) + défilement.
 *
 * Quand : le THÈME d'un passage (« TEMPS », « ÉQUIPE », « FACTURES ») : un mot qui reste le long du bord pendant que Will parle.
 * Visage : ENTIER (le mot vit dans la colonne de gauche, x 0 → 0,17 L, très loin de Z ; la prise ne bouge pas).
 *
 * Le mot est tourné de −90° (il se lit du bas vers le haut), ses lettres mesurent 0,18 L de haut, du bas du mot à y 0,80 H
 * jusqu'à y 0,15 H (réduit si le mot est long). Le haut des lettres est coupé de 17 % par le bord gauche du cadre : le
 * débordement est VOULU (E2, « ça vient de dehors », moins de 30 % de l'élément) et le mot reste lisible.
 *  - i0 → i7   : balayage M2 DU BAS VERS LE HAUT (courbe 0,83 / 0 / 0,17 / 1) qui révèle le mot EN CREUX (contour encre seul,
 *                la prise reste visible à travers les lettres) ; une bande orange de 0,04 L précède le bord du masque avec 2 images d'avance ;
 *  - i3 → i10  : le REMPLISSAGE ORANGE suit le même balayage, 3 images plus tard (texture d'encre : quelques taches retirées) ;
 *  - ensuite   : défilement de 0,2 % L par image au plus (le mot glisse doucement de ±20 px, période 2 s) — jamais immobile ;
 *  - sortie    : balayage INVERSE (7 images) : le mot est effacé du haut vers le bas, le remplissage part 1 image avant le creux.
 * Ombre dure encre vers le bas-droit sous le remplissage (une seule direction de lumière).
 * Bruitage : `whoosh-in` à i0.
 * Le mot est un mot que Will dit ; jamais un chiffre qu'il n'a pas dit.
 */
import React from "react";
import { avancesLettres, Cadre, courbe, FiltreEncre, FPS, lin, N3, TAILLE_MIN, usePoliceLot3 } from "./outils3";
import { POLICES } from "../../charte";
import type { FicheLot3 } from "./outils3";

export const ID_MOT_VERTICAL_BORD = "mot-vertical-bord";
export const DUREE_MOT_VERTICAL_BORD = Object.freeze({ min: 1.5, max: 3.5 });

export const FICHE_MOT_VERTICAL_BORD: FicheLot3 = Object.freeze({
  id: ID_MOT_VERTICAL_BORD,
  numero: 12,
  nom: "Mot vertical sur le bord",
  emplacement: "E2 gauche (x 0 → 0,17 L, y 0,15 → 0,80 H, haut des lettres coupé de 17 % par le bord)",
  forme: "F11 encre en creux puis rempli d'orange",
  mouvement: "M2 du bas vers le haut (7 i), remplissage 3 i plus tard, défilement 0,2 % par image",
  sortie: "balayage inverse",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_MOT_VERTICAL_BORD.min,
  dureeMax: DUREE_MOT_VERTICAL_BORD.max,
  quandUtiliser: "Le thème d'un passage (« TEMPS », « ÉQUIPE »). Un seul à la fois ; il peut rester 3 s.",
  sons: [{ k: 0, fichier: "whoosh-in" }],
});

export type MotVerticalBordProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le mot thème DIT par Will. */
  mot: string;
  /** Côté du cadre : « gauche » par défaut (miroir à droite si le réalisateur alterne, règle D5). */
  cote?: "gauche" | "droite";
};

const BEZ_BALAYAGE = [0.83, 0, 0.17, 1] as const;

export function MotVerticalBord(p: MotVerticalBordProps) {
  usePoliceLot3();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kFin = (fin - debut) * FPS;
  const kSortie = kFin - 7;
  const droite = p.cote === "droite";
  const mot = p.mot.toUpperCase();

  // Taille : lettres de 0,18 L de haut (capitales ≈ 0,7 em), réduite pour que le mot tienne entre y 0,15 H et y 0,80 H.
  const longueurMax = 0.43 * H; // de y 0,15 H à y 0,58 H (hors de la bande des sous-titres)
  const avances1 = avancesLettres(mot, 100).reduce((a, b) => a + b, 0) / 100;
  const tailleIdeale = (0.3 * W) / 0.7;
  const taille = Math.max(TAILLE_MIN(W), Math.min(tailleIdeale, (longueurMax * 0.97) / avances1));
  const cap = taille * 0.7;
  const longueur = avances1 * taille;
  const yc = 0.365 * H;
  const yBas = yc + longueur / 2;
  const yHaut = yc - longueur / 2;
  // Ligne de base à 83 % de la hauteur des capitales depuis le bord : le haut des lettres (17 %) est coupé par le cadre.
  const xBase = 0.8 * cap; // 20 % du haut des lettres coupé par le bord

  // Défilement doux : ±20 px à 1,5 px/image au plus (≈ 0,15 % L par image).
  const derive = k > 10 && k < kSortie ? 20 * Math.sin((2 * Math.PI * (k - 10)) / 60) : 0;

  // Révélations (position du bord du masque, de y bas vers y haut) ; `marge` évite de couper un trait de contour.
  const marge = 0.02 * W;
  const bord = (kk: number) => yBas + marge - (yBas - yHaut + 2 * marge) * courbe(kk, 0, 7, BEZ_BALAYAGE);
  const bordRempli = (kk: number) => yBas + marge - (yBas - yHaut + 2 * marge) * courbe(kk, 3, 10, BEZ_BALAYAGE);
  // Sortie inverse : le masque se referme du haut vers le bas.
  const ks = k - kSortie;
  const sortieCreux = ks > 0 ? courbe(ks, 0, 7, BEZ_BALAYAGE) : 0;
  const sortieRempli = ks > 0 ? courbe(ks, -1, 6, BEZ_BALAYAGE) : 0;
  const yTop = yHaut - marge;
  const yBot = yBas + marge;
  const hautVisibleCreux = ks > 0 ? yTop + (yBot - yTop) * sortieCreux : yTop;
  const hautVisibleRempli = ks > 0 ? yTop + (yBot - yTop) * sortieRempli : yTop;

  const topCreux = Math.max(bord(k), hautVisibleCreux);
  const topRempli = Math.max(bordRempli(k), hautVisibleRempli);
  const sens = droite ? -1 : 1;
  const miroir = droite ? `translate(${W} 0) scale(-1 1)` : undefined;
  void sens;

  const contourPx = Math.max(3, 0.004 * W);
  const ombrePx = Math.max(4, 0.006 * W);
  const commun = { fontFamily: POLICES.titre, fontWeight: 800, fontSize: taille, textAnchor: "middle" as const, strokeLinejoin: "round" as const };
  const transfo = `translate(${xBase} ${yc + derive}) rotate(-90)`;

  // Bande de couleur de 0,04 L qui PRÉCÈDE le bord du masque de 2 images (double balayage).
  const kBande = k + 2;
  const bandeVisible = k < 9.5 && kBande > 0 && kBande < 7.5;
  const yBande = bord(kBande);

  return (
    <Cadre W={W} H={H}>
      <defs>
        <FiltreEncre id="encre-mot-vertical" seed={9} trou={0.04} grain={0.04} />
        <clipPath id="masque-creux-vertical">
          <rect x={0} y={topCreux} width={W} height={Math.max(0, yBot - topCreux)} />
        </clipPath>
        <clipPath id="masque-rempli-vertical">
          <rect x={0} y={topRempli} width={W} height={Math.max(0, yBot - topRempli)} />
        </clipPath>
        <clipPath id="masque-bande-vertical">
          <rect x={0} y={yTop} width={W} height={yBot - yTop} />
        </clipPath>
      </defs>
      <g transform={miroir}>
        {/* Creux : contour encre seul (la prise se voit à travers les lettres). */}
        <g clipPath="url(#masque-creux-vertical)" transform={`translate(0 0)`}>
          <g transform={transfo}>
            <text x={0} y={taille * 0.36} {...commun} fill="none" stroke={N3.encre} strokeWidth={contourPx * 1.15}>
              {mot}
            </text>
          </g>
        </g>
        {/* Remplissage orange, 3 images plus tard, avec ombre dure et taches d'encre retirées. */}
        <g clipPath="url(#masque-rempli-vertical)">
          <g transform={transfo}>
            <text x={ombrePx} y={taille * 0.36 + ombrePx} {...commun} fill={N3.encre} stroke={N3.encre} strokeWidth={contourPx}>
              {mot}
            </text>
            <g filter="url(#encre-mot-vertical)">
              <text x={0} y={taille * 0.36} {...commun} fill={N3.orange} stroke={N3.encre} strokeWidth={contourPx} paintOrder="stroke fill">
                {mot}
              </text>
            </g>
          </g>
        </g>
        {bandeVisible ? (
          <g clipPath="url(#masque-bande-vertical)" opacity={1 - lin(k, 5, 9.5)}>
            <rect x={0} y={yBande - 0.02 * W} width={xBase + cap * 0.3} height={0.04 * W} fill={N3.orange} />
          </g>
        ) : null}
      </g>
    </Cadre>
  );
}
