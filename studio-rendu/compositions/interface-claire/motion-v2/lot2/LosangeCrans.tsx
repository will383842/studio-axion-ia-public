/**
 * ÉLÉMENT 10 « LOSANGE-CRANS » (standard v2, lot 2 « Géométrie franche »).
 *
 * Emplacement E1 haut, coin droit, DÉBORDANT (CORRIGÉ le 16/10 : centre 0,80 L ; 0,115 H, côté 0,34 L, soit ≈ 6,5 % de l'image ; l'ancien 0,16 L = 1,2 % était illisible) ·
 * forme : losange orange (carré à 45°) à contour encre, ombre dure, icône `Icone` ivoire · mouvement M3 PAR CRANS : un quart
 * de tour (CLAQUER) à chaque étape dite, l'icône change à chaque cran (la nouvelle tourne de −90° à 0 avec TOUPIE, l'ancienne
 * se rétracte). Visage : ENTIER (la pointe gauche, à 0,718 L et 0,10 H, reste au-dessus de la zone du visage ; la pointe
 * basse finit à 0,17 H, loin à droite). Le losange dépasse 0,10 H de haut : prévoir la DESCENTE existante de la prise (E1).
 * Quand : étapes dites (« d'abord… ensuite… enfin »).
 *
 * Image par image (i0 = 1re étape dite, puis un cran à chaque étape) : i-1 pré-éclat · i0-i14 vrille d'entrée (TOUPIE,
 * échelle 0,6 → 1 JAILLIR) · à chaque cran : quart de tour (CLAQUER ≈ 7 i), 4 traits d'impact aux pointes pendant 3 i,
 * échange d'icône · sortie : ÉCLATEMENT (10 éclats orange / encre / ivoire, vitesse 0,025-0,045 L/i, frein 0,86, gravité,
 * partent vers le haut et la droite, aucun n'entre dans la zone du visage). 14 i.
 * Bruitage : `click_001` à chaque cran.
 */
import React from "react";
import { COULEURS } from "../../charte";
import { Icone } from "../../elements";
import { alea, borne01, courbe, FPS_V2, imageDepuis, ressort, trace } from "./outils";
import type { BruitageMotion, FicheElementV2 } from "./outils";

export const ID_LOSANGE_CRANS = "losange-crans";
export const DUREE_LOSANGE = Object.freeze({ min: 2, max: 6 });

export const FICHE_LOSANGE_CRANS: FicheElementV2 = Object.freeze({
  id: ID_LOSANGE_CRANS,
  nom: "Losange à crans (étapes)",
  emplacement: "E1 haut, coin droit",
  forme: "Losange orange + Icone",
  mouvement: "M3 par crans, puis éclatement",
  visage: "entier" as const,
  quandUtiliser: "Des étapes dites : d'abord, ensuite, enfin.",
  dureeMin: DUREE_LOSANGE.min,
  dureeMax: DUREE_LOSANGE.max,
});

export type EtapeLosange = { /** Nom d'icône de `elements.tsx`. */ icone: string; /** Instant (s) où Will dit l'étape. */ a: number };

export type LosangeCransProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Les étapes DITES, dans l'ordre : la 1re à `debut`, une par cran ensuite. Aucun numéro affiché. */
  etapes: EtapeLosange[];
  centre?: { x: number; y: number };
};

const G = Object.freeze({ centre: { x: 0.8, y: 0.115 }, cote: 0.34, eclatImages: 14, nbEclats: 10 });

export function LosangeCrans(p: LosangeCransProps) {
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const c = p.centre ?? G.centre;
  const cx = c.x * W;
  const cy = c.y * H;
  const i = imageDepuis(t, debut);
  const iEclat = (t - (fin - G.eclatImages / FPS_V2)) * FPS_V2;
  if (i < -1 || t >= fin) return null;
  const cote = G.cote * W;
  const contour = Math.max(4, Math.round(0.006 * W));
  const ombre = Math.round(0.008 * W);

  if (i < 0) {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: cx - 0.015 * W, top: cy - 0.015 * W, width: 0.03 * W, height: 0.03 * W, borderRadius: "50%", background: COULEURS.orange }} />
      </div>
    );
  }

  // --- Éclatement : le losange est remplacé par ses éclats.
  if (iEclat >= 0) return <Eclats k={iEclat} cx={cx} cy={cy} W={W} H={H} cote={cote} />;

  const entree = ressort("TOUPIE", i);
  const jaillir = ressort("JAILLIR", i);
  const crans = p.etapes.slice(1).map((e) => imageDepuis(t, e.a));
  const sommeCrans = crans.reduce((s, k) => s + ressort("CLAQUER", k), 0);
  // Inclinaison de repos 45° ± 8° en alternant à chaque cran (jamais un carré posé bien droit).
  const rotation = 45 - 90 * (1 - entree) + 90 * sommeCrans - 8 * Math.cos(Math.PI * sommeCrans);
  const echelle = 0.6 + 0.4 * jaillir;
  const opacite = borne01(i / 2);

  // Icône courante et sortante : l'étape n est visible de a_n à a_(n+1).
  const icones = p.etapes.map((e, n) => {
    const k = imageDepuis(t, n === 0 ? debut : e.a);
    const suivant = p.etapes[n + 1];
    const kSortie = suivant ? imageDepuis(t, suivant.a) : -1;
    const entree = n === 0 ? ressort("JAILLIR", k) : ressort("JAILLIR", k - 1);
    const sort = kSortie < 0 ? 0 : courbe(kSortie, 0, 2);
    const tourne = n === 0 ? 0 : -90 * (1 - ressort("TOUPIE", k - 1));
    const s = entree * (1 - sort);
    return s > 0.001 && (n === 0 || k >= 1) ? { n, s, tourne: tourne + 90 * sort, nom: e.icone } : null;
  });

  // Traits d'impact aux 4 pointes à chaque cran (3 i).
  const impacts = crans.map((k, n) => {
    if (k < 0 || k > 3) return null;
    const u = courbe(k, 0, 2, trace);
    const dem = (cote * Math.SQRT2) / 2 * 1.08;
    return [0, 90, 180, 270].map((a) => {
      const ang = (a * Math.PI) / 180;
      const r0 = dem + contour * 1.5;
      const r1 = r0 + 0.05 * W * u;
      return <line key={`${n}${a}`} x1={cx + r0 * Math.cos(ang)} y1={cy + r0 * Math.sin(ang)} x2={cx + r1 * Math.cos(ang)} y2={cy + r1 * Math.sin(ang)} stroke={COULEURS.encre} strokeWidth={contour} strokeLinecap="round" />;
    });
  });

  const S = cote * 1.6;
  const o = S / 2;
  const tailleIcone = cote * 0.6;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{impacts}</svg>
      <div style={{ position: "absolute", left: cx - o, top: cy - o, width: S, height: S, opacity: opacite, filter: `drop-shadow(${ombre}px ${ombre}px 0 ${COULEURS.encre})`, transform: `scale(${echelle})`, transformOrigin: "50% 50%" }}>
        <svg width={S} height={S} style={{ overflow: "visible" }}>
          <g transform={`rotate(${rotation} ${o} ${o})`}>
            <rect x={o - cote / 2} y={o - cote / 2} width={cote} height={cote} rx={0.014 * W} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" />
            <rect x={o - cote / 2 + cote * 0.1} y={o - cote / 2 + cote * 0.1} width={cote * 0.8} height={cote * 0.8} rx={0.008 * W} fill="none" stroke={COULEURS.ivoire} strokeWidth={Math.max(2, contour * 0.4)} strokeDasharray="10 9" opacity={0.55} />
          </g>
        </svg>
        {icones.map((ic) =>
          ic ? (
            <div key={ic.n} style={{ position: "absolute", left: o - tailleIcone / 2, top: o - tailleIcone / 2, width: tailleIcone, height: tailleIcone, transform: `rotate(${ic.tourne}deg) scale(${ic.s})` }}>
              <Icone nom={ic.nom} taille={tailleIcone} couleur={COULEURS.ivoire} epaisseur={2.6} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Éclatement : 10 éclats qui partent vers le haut et la droite (angle −120° → +50°), jamais vers le visage. */
function Eclats({ k, cx, cy, W, H, cote }: { k: number; cx: number; cy: number; W: number; H: number; cote: number }) {
  const couleurs = [COULEURS.orange, COULEURS.encre, COULEURS.ivoire, COULEURS.orange, COULEURS.sable];
  const contour = Math.max(3, Math.round(0.004 * W));
  const eclats = Array.from({ length: G.nbEclats }, (_, j) => {
    const angle = ((-120 + (j * 170) / (G.nbEclats - 1) + (alea(j + 1) - 0.5) * 14) * Math.PI) / 180;
    const v = (0.025 + 0.02 * alea(j + 11)) * W;
    const dist = (v * (1 - Math.pow(0.86, k))) / 0.14;
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle) + 0.5 * 0.002 * H * k * k;
    const tourne = (15 + 25 * alea(j + 21)) * k * (j % 2 ? 1 : -1);
    const taille = cote * (0.1 + 0.1 * alea(j + 31));
    const op = k <= 8 ? 1 : borne01(1 - (k - 8) / 6);
    const forme = j % 3;
    const col = couleurs[j % couleurs.length];
    const s = taille / 2;
    const pts = forme === 0 ? `0,${-s} ${s},0 0,${s} ${-s},0` : forme === 1 ? `0,${-s} ${s},${s} ${-s},${s}` : "";
    return (
      <g key={j} transform={`translate(${x} ${y}) rotate(${tourne})`} opacity={op}>
        {forme === 2 ? <circle r={s * 0.7} fill={col} stroke={COULEURS.encre} strokeWidth={contour} /> : <polygon points={pts} fill={col} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" />}
      </g>
    );
  });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{eclats}</svg>
    </div>
  );
}

/** Bruitage : `click_001` à chaque cran (donc à chaque étape après la première) et au départ. */
export function bruitagesLosangeCrans(p: Pick<LosangeCransProps, "debut" | "etapes">): BruitageMotion[] {
  return p.etapes.map((e, n): BruitageMotion => [n === 0 ? p.debut : e.a, n === 0 ? "select_002" : "click_001", 0.07]);
}

/** Exemple : « d'abord… ensuite… enfin » (trois étapes dites). */
export const EXEMPLE_LOSANGE_CRANS = {
  phrase: "D'abord on écoute, ensuite on automatise, enfin on mesure.",
  proprietes: {
    debut: 1.0,
    fin: 3.6,
    etapes: [
      { icone: "loupe", a: 1.0 },
      { icone: "eclair", a: 1.8 },
      { icone: "graphique", a: 2.6 },
    ],
  } satisfies Omit<LosangeCransProps, "t" | "largeurImage" | "hauteurImage">,
  /** Planche : vrille d'entrée, élan, 1er cran en cours, éclatement, éclats. */
  imagesPlanche: [1, 4, 26, 58, 68],
};
