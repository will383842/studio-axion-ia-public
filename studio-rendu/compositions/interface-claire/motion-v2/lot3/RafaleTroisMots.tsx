/**
 * ÉLÉMENT 13 — « RAFALE DE TROIS MOTS » (v2 énergie, lot 3, designer n° 3, 16/10/2026) = coup de poing P2 du standard (§ C).
 * E7 plein écran, formes F7 × 3 + F11, visage COUVERT en entier (jamais à moitié), coupes franches.
 *
 * Quand : une ÉNUMÉRATION de 3 mots dits à moins de 0,9 s d'écart (« devis, relances, factures »). Jamais avant 10 s
 * (règle E7), jamais deux E7 d'affilée. Si deux mots sont dits à moins de 6 images l'un de l'autre, l'élément RETARDE
 * le suivant à 6 images (le réalisateur doit alors préférer le coup de poing P1 « dalle claquée »).
 *
 * Chorégraphie (30 i/s ; i0 = mot 1, i1 = mot 2, i2 = mot 3 ; grain de 6 % sur tous les aplats) :
 *  - MOT 1 : coupe franche, aplat ENCRE. Le mot ivoire entre par la gauche, LETTRE PAR LETTRE (1 image par lettre, `GLISSER`),
 *            incliné de −10° vers 0°. Ombre dure orange. Son `click_001`.
 *  - MOT 2 : coupe franche, aplat ORANGE. Le mot encre TOMBE du haut avec `JAILLIR` (rebond), incliné de +5°. Son `click_002`.
 *  - MOT 3 : coupe franche, aplat IVOIRE. Le mot orange est CLAQUÉ (M4) : échelle ×1,4 → ×1 avec `CLAQUER`, 4 traits d'impact,
 *            secousse DE L'ÉLÉMENT (A = 0,012 L) de +3 à +11 images (jamais de la prise). Son `drop_002`.
 *  - RÉCAPITULATIF (mot 3 + 10 → + 18) : les 3 mots, réduits (×0,72 de leur taille, ≥ 0,10 L), pleinement opaques, encre / orange / encre, s'empilent en cascade de 2 images
 *            (M5), inclinés de −5°, +4°, −3°, sur l'aplat ivoire ; le mot 3 glisse à sa place, les deux premiers jaillissent.
 *  - SORTIE (5 dernières images : le front franchit le visage en UNE image, les mots fuient avec l'aplat) : balayage DIAGONAL à 30° (bas-gauche → haut-droit), bande orange en tête, qui découvre Will.
 *            Pendant le balayage, le visage n'est partiellement couvert que quelques images, en mouvement : la tolérance de
 *            3 images du standard (§ B.2) est vérifiée par `imagesVisagePartiel` (test dans le script de la planche).
 * Pas de visage visible pendant 1,2 à 2 s : à poser entre 10 et 16 s pour le premier coup de poing de la vidéo.
 * Les mots sont des mots DITS par Will (12 lettres au plus chacun). Aucun chiffre inventé.
 */
import React from "react";
import { avancesLettres, borne, Cadre, courbe, demiPlan, FPS, GrainAplat, lin, MotSvg, N3, ressort, secousse, TraitsImpact, usePoliceLot3 } from "./outils3";
import type { FicheLot3, PriseLot } from "./outils3";
import { PRISE_COMMUNE_LOT, zonePx, boiteTournee, dimensionsMot } from "./outils3";
import { POLICES } from "../../charte";

export const ID_RAFALE_TROIS_MOTS = "rafale-trois-mots";
export const DUREE_RAFALE = Object.freeze({ min: 1.2, max: 2.0 });

export const FICHE_RAFALE_TROIS_MOTS: FicheLot3 = Object.freeze({
  id: ID_RAFALE_TROIS_MOTS,
  numero: 13,
  nom: "Rafale de trois mots",
  emplacement: "E7 plein écran",
  forme: "F7 × 3 (encre, orange, ivoire) + F11",
  mouvement: "P2 : lettre par lettre, chute JAILLIR, claquement M4, cascade M5",
  sortie: "balayage diagonal à 30°",
  visage: "couvert" as const,
  ouvertureAutorisee: false,
  dureeMin: DUREE_RAFALE.min,
  dureeMax: DUREE_RAFALE.max,
  quandUtiliser: "Une énumération de 3 mots dits à moins de 0,9 s d'écart. Coup de poing : à partir de 10 s, jamais deux E7 de suite.",
  sons: [
    { k: 0, fichier: "click_001" },
    { k: 8, fichier: "click_002" },
    { k: 16, fichier: "drop_002" },
  ],
});

export type RafaleProps = {
  t: number;
  /** Instant du mot 1 (= i0). */
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Les 3 mots DITS (capitales automatiques, 12 lettres au plus). */
  mots: readonly [string, string, string];
  /** Instants (s, absolus) où Will dit les mots 2 et 3 ; par défaut 0,27 s puis 0,54 s après le mot 1. */
  tMots?: readonly [number, number];
  prise?: PriseLot;
};

const BEZ_BALAYAGE = [0.83, 0, 0.17, 1] as const;
const ANGLE_BALAYAGE = 30;

/** Instants (images) des trois coupes : 6 images au moins entre deux mots. */
export function imagesRafale(debut: number, tMots?: readonly [number, number]) {
  const k2 = Math.max(6, Math.round(((tMots?.[0] ?? debut + 0.27) - debut) * FPS));
  const k3 = Math.max(k2 + 6, Math.round(((tMots?.[1] ?? debut + 0.54) - debut) * FPS));
  return { k2, k3 };
}

/** Normale du balayage et bornes de `s` sur le cadre : `s = x·dx + y·dy`, la part « effacée » est s < seuil. */
export function balayageDiagonal(W: number, H: number) {
  const d = { x: Math.cos((ANGLE_BALAYAGE * Math.PI) / 180), y: -Math.sin((ANGLE_BALAYAGE * Math.PI) / 180) };
  const vals = [0, W * d.x, H * d.y, W * d.x + H * d.y];
  return { d, smin: Math.min(...vals), smax: Math.max(...vals) };
}

/** Bornes (en `s`) du visage (boîte Z sans marge) sur la normale du balayage. */
function bornesVisage(W: number, H: number, prise: PriseLot) {
  const { d } = balayageDiagonal(W, H);
  const Z = zonePx(prise, W, H, 0);
  const sv = [Z.x0 * d.x + Z.y0 * d.y, Z.x1 * d.x + Z.y0 * d.y, Z.x0 * d.x + Z.y1 * d.y, Z.x1 * d.x + Z.y1 * d.y];
  return { a: Math.min(...sv), b: Math.max(...sv) };
}

/**
 * Seuil du balayage (5 images : kk = 0 … 5). Le front accélère, FRANCHIT LE VISAGE EN UNE SEULE IMAGE (de a − 30 à b + 30 :
 * jamais de visage à moitié couvert sur une image entière) puis finit de dégager les coins.
 */
export const seuilBalayage = (kk: number, smin: number, smax: number, prise: PriseLot = PRISE_COMMUNE_LOT, W = 1080, H = 1920) => {
  const { a, b } = bornesVisage(W, H, prise);
  const pts = [smin, smin + (a - smin) * 0.45, a - 30, b + 30, b + (smax - b) * 0.55, smax];
  const i = Math.min(4, Math.max(0, Math.floor(kk)));
  const f = Math.min(1, Math.max(0, kk - i));
  return pts[i] + (pts[i + 1] - pts[i]) * f;
};

/**
 * Nombre d'images (entières, de 0 à 6) pendant lesquelles le visage (boîte Z sans marge) est PARTIELLEMENT couvert par l'aplat
 * pendant le balayage de sortie. Tolérance du standard : 3 images d'affilée au plus.
 */
export function imagesVisagePartiel(W: number, H: number, prise: PriseLot = PRISE_COMMUNE_LOT): number {
  const { smin, smax } = balayageDiagonal(W, H);
  const { a, b } = bornesVisage(W, H, prise);
  let n = 0;
  for (let kk = 0; kk <= 5; kk++) {
    const seuil = seuilBalayage(kk, smin, smax, prise, W, H);
    // L'aplat (visible) est la part s > seuil ; le visage est partiellement couvert si le seuil coupe sa boîte.
    if (seuil > a && seuil < b) n++;
  }
  return n;
}

export function RafaleTroisMots(p: RafaleProps) {
  usePoliceLot3();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const { k2, k3 } = imagesRafale(debut, p.tMots);
  const mots = p.mots.map((m) => m.toUpperCase().slice(0, 12)) as [string, string, string];
  const kSortie = (fin - debut) * FPS - 5;
  const kR = k3 + 10;

  // Taille de chaque mot : au plus 0,30 L de corps, et 0,86 L de large.
  const tailles = mots.map((m) => {
    const em = avancesLettres(m, 100).reduce((a, b) => a + b, 0) / 100;
    return Math.max(0.06 * W, Math.min(0.3 * W, (0.86 * W) / em));
  });
  const cy0 = 0.47 * H;
  const contourPx = Math.max(3, 0.004 * W);
  const phase = k < k2 ? 1 : k < k3 ? 2 : 3;
  const fond = phase === 1 ? N3.encre : phase === 2 ? N3.orange : N3.ivoire;

  const contenu: React.ReactNode[] = [];

  if (phase === 1) {
    // Mot 1 : lettre par lettre depuis la gauche, −10° → 0°.
    const adv = avancesLettres(mots[0], tailles[0]);
    const total = adv.reduce((a, b) => a + b, 0);
    const rot = -10 * (1 - lin(k, 0, 6));
    let x = -total / 2;
    const lettres = [...mots[0]].map((c, i) => {
      const cx = x + adv[i] / 2;
      x += adv[i];
      const kk = k - i;
      const e = ressort(kk, "GLISSER");
      const dxl = -(1 - borne(e, 0, 1.15)) * 0.3 * W;
      const op = lin(kk, 0, 2);
      const commun = { fontFamily: POLICES.titre, fontWeight: 800, fontSize: tailles[0], textAnchor: "middle" as const };
      return (
        <g key={i} opacity={op} transform={`translate(${cx + dxl} 0)`}>
          <text x={0.008 * W} y={tailles[0] * 0.36 + 0.008 * W} {...commun} fill={N3.orange}>
            {c}
          </text>
          <text x={0} y={tailles[0] * 0.36} {...commun} fill={N3.ivoire}>
            {c}
          </text>
        </g>
      );
    });
    contenu.push(
      <g key="m1" transform={`translate(${0.5 * W} ${cy0}) rotate(${rot})`}>
        {lettres}
      </g>,
    );
  } else if (phase === 2) {
    // Mot 2 : tombe du haut avec JAILLIR, +5°.
    const kk = k - k2;
    const e = ressort(kk, "JAILLIR");
    const cy = cy0 - (1 - e) * 0.62 * H;
    contenu.push(<MotSvg key="m2" texte={mots[1]} cx={0.5 * W} cy={cy} taille={tailles[1]} rot={5} remplissage={N3.encre} contour={N3.encre} contourPx={0} ombrePx={0.008 * W} ombreCouleur={N3.orangeProfond} />);
  } else {
    // Mot 3 : claqué (M4), puis récapitulatif des 3 mots empilés.
    const kk = k - k3;
    const claque = 1.4 - 0.4 * ressort(kk, "CLAQUER");
    const dx = secousse(kk - 3, 0.012 * W);
    const kr = k - kR;
    const lignes = [0.38, 0.5, 0.62].map((f) => f * H);
    const tailleRecap = tailles.map((s) => Math.max(0.1 * W, s * 0.72));
    const inclin = [-5, 4, -3];
    const m3 = kr < 0 ? 0 : ressort(kr, "GLISSER");
    const cy3 = cy0 + (lignes[2] - cy0) * m3;
    const taille3 = tailles[2] * claque * (1 + (tailleRecap[2] / tailles[2] - 1) * m3);
    const rot3 = -3 + (inclin[2] + 3) * m3;
    if (kr >= 2) {
      const e1 = ressort(kr - 2, "JAILLIR");
      contenu.push(<MotSvg key="r1" texte={mots[0]} cx={0.5 * W} cy={lignes[0]} taille={tailleRecap[0]} rot={inclin[0]} echelle={0.4 + 0.6 * e1} opacite={lin(kr, 2, 3)} remplissage={N3.encre} contour={N3.encre} contourPx={0} ombrePx={0.006 * W} ombreCouleur={N3.sableProfond} />);
    }
    if (kr >= 4) {
      const e2 = ressort(kr - 4, "JAILLIR");
      contenu.push(<MotSvg key="r2" texte={mots[1]} cx={0.5 * W} cy={lignes[1]} taille={tailleRecap[1]} rot={inclin[1]} echelle={0.4 + 0.6 * e2} opacite={lin(kr, 4, 5)} remplissage={N3.orange} contour={N3.encre} contourPx={contourPx * 0.8} ombrePx={0.005 * W} />);
    }
    contenu.push(<MotSvg key="m3" texte={mots[2]} cx={0.5 * W + (kr < 0 ? dx : 0)} cy={cy3} taille={taille3} rot={rot3} remplissage={kr < 0 ? N3.orange : N3.encre} contour={N3.encre} contourPx={contourPx} ombrePx={0.006 * W} ombreCouleur={kr < 0 ? N3.encre : N3.sableProfond} />);
    if (kk >= 3 && kr < 0) {
      const d = dimensionsMot(mots[2], tailles[2]);
      contenu.push(<TraitsImpact key="imp" boite={boiteTournee(0.5 * W, cy0, d.w, d.h, -3)} kLocal={kk - 3} W={W} />);
    }
  }

  // Sortie : balayage diagonal à 30° (bas-gauche → haut-droit) ; bande orange en tête.
  const sortant = k >= kSortie;
  const { d, smin, smax } = balayageDiagonal(W, H);
  const kk = k - kSortie;
  const seuil = sortant ? seuilBalayage(kk, smin, smax, p.prise ?? PRISE_COMMUNE_LOT, W, H) : smin - 10;
  // Les mots PARTENT AVEC l'aplat : ils glissent plus vite que le front du balayage (aucun reste de lettre sur le visage découvert).
  const fuite = sortant ? 1.9 * (seuil - smin) : 0;
  const bande = 0.035 * W;
  const polyAplat = demiPlan(W, H, d, seuil + (sortant ? bande : 0));
  const polyBande = demiPlan(W, H, d, seuil);

  return (
    <Cadre W={W} H={H}>
      <defs>
        <clipPath id="aplat-rafale">
          <polygon points={polyAplat} />
        </clipPath>
      </defs>
      {sortant ? <polygon points={polyBande} fill={N3.orange} /> : null}
      <g clipPath={sortant ? "url(#aplat-rafale)" : undefined}>
        <rect x={0} y={0} width={W} height={H} fill={fond} />
        <GrainAplat id="grain-rafale" W={W} H={H} force={0.06} />
        <g transform={`translate(${d.x * fuite} ${d.y * fuite})`}>{contenu}</g>
      </g>
    </Cadre>
  );
}
