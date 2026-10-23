/**
 * ÉLÉMENT 8 « DUEL-TRIANGLES » (standard v2, lot 2 « Géométrie franche ») = coup de poing P3 du § C.
 *
 * Emplacement E7 plein écran · forme F7 en DEUX TRIANGLES (encre en haut à gauche, orange en bas à droite, séparés par la
 * diagonale bas-gauche → haut-droit) avec un grain de 5 % · mouvement M8 : chaque triangle glisse depuis son coin (4 i, Easing.out cubic à la place de GLISSER, trop long pour la tolérance de visage,
 * étirement 6 % et 2 fantômes pendant 3 i), rencontre sèche sur la diagonale (liseré ivoire 1 i, les deux triangles se
 * secouent en sens opposés, 0,010 L, 7 i). Visage : COUVERT (les deux triangles couvrent tout le cadre) ; à l'entrée et à
 * la sortie le visage est partiellement couvert au plus 3-4 images, en mouvement (tolérance du standard § B.2).
 * Quand : une opposition dite (« à la main / automatisé »). Jamais avant 10 s, jamais avant la fin du plan de 5 s.
 *
 * Image par image (i0 = 1er mot dit) : i0-i5 triangle encre glisse · i1-i6 triangle orange glisse (ÉCART : 1 i d'avance sur
 * la fiche, 2 i dans le standard, pour tenir la tolérance de 3 i de visage partiel) · i2 mot A jaillit (ivoire, au centre de
 * gravité du triangle encre) · i4 mot B jaillit (encre sur orange) · i5 rencontre : liseré + secousse · i6 disque ivoire à
 * l'éclair, vrille (M3) — pas de « VS » écrit : Will ne le dit pas · verdict (s'il est dit) : le perdant passe au sable
 * et recule de 0,05 L, le gagnant pulse à 1,04 · sortie 5 i : chaque triangle retourne à son coin (Easing.in cubic).
 * Bruitage : `whoosh-in` à i0 puis `drop_004` à la rencontre.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { Icone } from "../../elements";
import { Easing } from "remotion";
import { aspiration, borne01, courbe, FPS_V2, imageDepuis, ressort, secousse } from "./outils";

/** Glissement des triangles : 3 images (CORRIGÉ le 16/10, 4 → 3), freinage net (le visage ne reste jamais plus de 3-4 images à moitié couvert). */
const glisse = (k: number) => courbe(k, 0, 3, Easing.out(Easing.cubic));
import type { BruitageMotion, FicheElementV2 } from "./outils";

export const ID_DUEL_TRIANGLES = "duel-triangles";
export const DUREE_DUEL = Object.freeze({ min: 1.5, max: 2.6 });

export const FICHE_DUEL_TRIANGLES: FicheElementV2 = Object.freeze({
  id: ID_DUEL_TRIANGLES,
  nom: "Duel en triangles (coup de poing P3)",
  emplacement: "E7 plein écran",
  forme: "F7 deux triangles",
  mouvement: "M8 glissement diagonal + rencontre secouée",
  visage: "couvert" as const,
  quandUtiliser: "Une opposition dite : « à la main / automatisé », « eux / vous ».",
  dureeMin: DUREE_DUEL.min,
  dureeMax: DUREE_DUEL.max,
});

export type DuelTrianglesProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Les deux termes DITS : A (triangle encre, en haut à gauche) et B (triangle orange, en bas à droite). */
  motA: string;
  motB: string;
  /** Si Will tranche : le gagnant pulse, le perdant passe au sable et recule. */
  verdict?: { gagnant: "A" | "B"; a: number };
};

const G = Object.freeze({ rencontre: 4, secousse: 0.01, sortieImages: 5, recouvrement: 70, marge: 40, disque: 0.13, decalageOrange: 1 });

export function DuelTriangles(p: DuelTrianglesProps) {
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const i = imageDepuis(t, debut);
  if (i < 0 || t >= fin) return null;

  const iSortie = (t - (fin - G.sortieImages / FPS_V2)) * FPS_V2;
  const sortie = aspiration(courbe(iSortie, 0, G.sortieImages));
  const iO = i - G.decalageOrange;

  // Verdict.
  const iV = p.verdict ? imageDepuis(t, p.verdict.a) : -1;
  const recul = p.verdict && iV >= 0 ? ressort("POSER", iV) : 0;
  const perdant = p.verdict ? (p.verdict.gagnant === "A" ? "B" : "A") : null;
  const pulse = p.verdict && iV >= 0 ? 1 + 0.04 * Math.sin(Math.PI * borne01(iV / 8)) : 1;
  const sableA = perdant === "A" && iV >= 0;
  const sableB = perdant === "B" && iV >= 0;

  // Position des triangles : glissement depuis le coin (en multiples de L et H), secousse en sens opposés, sortie.
  const gA = glisse(i);
  const gB = glisse(iO);
  const sh = secousse(i - G.rencontre, G.secousse * W);
  const decA = (1 - gA) + sortie;
  const decB = (1 - gB) + sortie;
  const dxA = -decA * W * 1.04 + sh + (perdant === "A" ? -0.05 * W * recul * 0.7 : 0);
  const dyA = -decA * H * 1.04 + (perdant === "A" ? -0.05 * W * recul * 0.7 : 0);
  const dxB = decB * W * 1.04 - sh + (perdant === "B" ? 0.05 * W * recul * 0.7 : 0);
  const dyB = decB * H * 1.04 + (perdant === "B" ? 0.05 * W * recul * 0.7 : 0);
  const etire = (k: number) => 1 + (k < 3 ? 0.06 * (1 - k / 3) : 0);

  // Triangle encre élargi de `recouvrement` px au-delà de la diagonale (aucune fente ne s'ouvre pendant la secousse).
  const m = G.marge;
  const hyp = Math.hypot(W, H);
  const c0 = H * W + G.recouvrement * hyp;
  const A: [number, number][] = [[-m, -m], [(c0 + W * m) / H, -m], [-m, (c0 + H * m) / W]];
  const B: [number, number][] = [[W + m, H + m], [W + m, -m], [-m, H + m]];
  const pts = (poly: [number, number][]) => poly.map((q) => q.join(",")).join(" ");

  // Mots : au centre de gravité de chaque triangle, horizontaux, légèrement inclinés.
  const taille = (mot: string) => Math.min(0.14 * W, (0.62 * W) / Math.max(1, largeurTexte(mot, 1, 0.01)));
  const mot = (texte: string, x: number, y: number, couleur: string, angle: number, k: number, pulser: number) => {
    const s = ressort("JAILLIR", k);
    if (s <= 0) return null;
    return (
      <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${s * pulser})`}>
        <text textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille(texte)} letterSpacing={taille(texte) * 0.01} fill={couleur}>
          {texte.toUpperCase()}
        </text>
      </g>
    );
  };

  const ombre = Math.round(0.008 * W);
  const triangle = (poly: [number, number][], fond: string, dx: number, dy: number, k: number, op = 1, cle = "") => {
    const coin = poly === A ? [0, 0] : [W, H];
    return (
      <g key={cle} opacity={op} transform={`translate(${dx} ${dy})`}>
        <polygon points={pts(poly)} fill={fond} transform={`translate(${coin[0]} ${coin[1]}) scale(${etire(k)}) translate(${-coin[0]} ${-coin[1]})`} />
      </g>
    );
  };
  const fantomes = (poly: [number, number][], fond: string, sens: 1 | -1, k: number, retard: number) =>
    [1, 2].map((n) => {
      const kk = k - n;
      if (kk < 0 || k >= 3 + n) return null;
      const g = 1 - glisse(kk);
      return triangle(poly, fond, sens * g * W * 1.04, sens * g * H * 1.04, kk, n === 1 ? 0.3 : 0.15, `f${fond}${n}${retard}`);
    });

  // Disque ivoire à l'éclair (M3 vrille) au milieu de la diagonale.
  const iD = i - 5;
  const dDisque = G.disque * W;
  const sD = ressort("JAILLIR", iD) * (1 - sortie);
  const tourne = -90 * (1 - ressort("TOUPIE", iD)) + 60 * sortie;
  const contour = Math.max(4, Math.round(0.006 * W));

  // Liseré ivoire sur la diagonale : 1 image à la rencontre.
  const liseré = i >= G.rencontre && i < G.rencontre + 1;
  const dec = (dx: number, dy: number) => `translate(${dx} ${dy})`;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="grain-duel" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        {fantomes(A, COULEURS.encre, -1, i, 0)}
        {triangle(A, sableA ? COULEURS.sable : COULEURS.encre, dxA, dyA, i)}
        {fantomes(B, COULEURS.orange, 1, iO, 1)}
        {triangle(B, sableB ? COULEURS.sable : COULEURS.orange, dxB, dyB, iO)}
        {/* mots (collés à leur triangle : ils partagent son déplacement) */}
        <g transform={dec(dxA, dyA)}>{mot(p.motA, W / 3, H / 3, sableA ? COULEURS.encre : COULEURS.ivoire, -8, i - 2, p.verdict?.gagnant === "A" ? pulse : 1)}</g>
        <g transform={dec(dxB, dyB)}>{mot(p.motB, 0.66 * W, 0.7 * H, COULEURS.encre, 6, iO - 3, p.verdict?.gagnant === "B" ? pulse : 1)}</g>
        {liseré ? <line x1={0} y1={H} x2={W} y2={0} stroke={COULEURS.ivoire} strokeWidth={0.012 * W} /> : null}
        {sD > 0.001 ? (
          <g transform={`translate(${W / 2} ${H / 2}) rotate(${tourne}) scale(${sD})`}>
            <circle cx={ombre} cy={ombre} r={dDisque / 2} fill={COULEURS.encre} />
            <circle r={dDisque / 2} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour} />
          </g>
        ) : null}
        {/* grain de 5 % sur tout l'aplat */}
        <rect width={W} height={H} filter="url(#grain-duel)" opacity={0.05} style={{ mixBlendMode: "multiply" }} />
      </svg>
      {sD > 0.001 ? (
        <div style={{ position: "absolute", left: W / 2 - dDisque * 0.3, top: H / 2 - dDisque * 0.3, width: dDisque * 0.6, height: dDisque * 0.6, transform: `rotate(${tourne}deg) scale(${sD})` }}>
          <Icone nom="eclair" taille={dDisque * 0.6} couleur={COULEURS.encre} epaisseur={2.6} />
        </div>
      ) : null}
    </div>
  );
}

/** Bruitage : `whoosh-in` au départ des triangles, `drop_004` à leur rencontre. */
export function bruitagesDuelTriangles(p: Pick<DuelTrianglesProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "whoosh-in", 0.08],
    [+(p.debut + G.rencontre / FPS_V2).toFixed(3), "drop_004", 0.09],
  ];
}

/** Exemple : « à la main » contre « automatisé », Will tranche pour l'automatisé. */
export const EXEMPLE_DUEL_TRIANGLES = {
  phrase: "Entre faire à la main et automatisé, le choix est vite fait.",
  proprietes: { debut: 1.0, fin: 3.0, motA: "À la main", motB: "Automatisé", verdict: { gagnant: "B" as const, a: 1.55 } } satisfies Omit<DuelTrianglesProps, "t" | "largeurImage" | "hauteurImage">,
  imagesPlanche: [1, 3, 5, 9, 28],
};
