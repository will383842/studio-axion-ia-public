/**
 * ÉLÉMENT 19 — « CITATION EN VERRE » (v3, lot D ; standard § G ligne 19, remplace `bulle-cri`).
 *
 * Quand : Will CITE quelqu'un (« j'ai pas le temps »). Le texte affiché est EXACTEMENT la citation dite, jamais un mot de plus.
 * Visage : ENTIER. La bulle est au-dessus de la tête, à droite (x 0,57 → 0,98 L, 0,41 L de large, entièrement dans le cadre), sur 2 lignes
 * de 62 px (31 px à 540 de large) ; la queue en goutte pointe vers la tête et s'arrête à plus de 0,03 L des cheveux (pointe à x = 0,668 L, y ≈ 0,18 H).
 *
 * Matière : bulle de messagerie en VERRE IVOIRE (dégradé ivoire → ivoire creux, opaque à 92 %, jamais « fantôme »), reflet de lumière qui la
 * traverse à l'arrivée, ombre douce en 3 couches (lumière du haut), queue de la même pièce que le corps (une seule forme, un seul filtre).
 * Contenu : une barre de citation orange en `degradeOrange` + la citation en Inter Bold encre, 62 px à 1 080 de large.
 * Chorégraphie (30 i/s, i0 = début de la citation) :
 *  - i0 → i6   : l'indicateur « en train d'écrire » (3 points qui pulsent) sort de la pointe de la queue (`JAILLIR`) ;
 *  - i6        : la bulle GRANDIT depuis la pointe de sa queue (échelle de 0,15 à 1, `JAILLIR`, mise au point en 4 i), l'indicateur s'efface ;
 *  - i9 → i17  : le texte se TAPE (2 lettres par image) ; un reflet traverse la bulle (10 i) ;
 *  - ensuite   : micro-vie (±0,25 % de translation, rotation ±0,8°) ;
 *  - sortie    : FOUET vers la droite en 5 images (`FOUET`), flou directionnel horizontal croissant.
 * Profondeur (V6) : ombre en couches + croissance depuis la queue avec mise au point + flou de mouvement. Ressorts : `JAILLIR`, `FOUET`.
 * Bruitages : `vibreur` à i0, `tick_001` à i9, `tick_002` à i13.
 */
import React from "react";
import { alpha, courbe, entrant, FlouDir, FPS, lin, N3, POLICES, PRISE_COMMUNE_LOT, rs, usePolicesD, zonePx } from "./communD";
import type { FicheLot3, PriseLot, SonD } from "./communD";

export const ID_CITATION_VERRE = "citation-verre";
export const DUREE_CITATION_VERRE = Object.freeze({ min: 1.5, max: 2.5 });
export const SONS_CITATION_VERRE: readonly SonD[] = [
  { k: 0, fichier: "vibreur", volume: 0.6 },
  { k: 9, fichier: "tick_001" },
  { k: 13, fichier: "tick_002" },
];

export const FICHE_CITATION_VERRE: FicheLot3 = Object.freeze({
  id: ID_CITATION_VERRE,
  numero: 19,
  nom: "Citation en verre",
  emplacement: "Au-dessus de la tête, à droite : x 0,57 → 0,98 L, y 0,028 → 0,16 H ; queue pointe à (0,668 L ; 0,18 H)",
  forme: "Bulle de messagerie en verre ivoire, queue en goutte, indicateur « en train d'écrire »",
  mouvement: "3 points (6 i) → croissance depuis la queue (JAILLIR) → texte tapé 2 lettres/i → fouet à droite",
  sortie: "fouet vers la droite avec flou directionnel",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_CITATION_VERRE.min,
  dureeMax: DUREE_CITATION_VERRE.max,
  quandUtiliser: "Will cite quelqu'un (« j'ai pas le temps »). Texte = la citation dite, deux lignes de 10 caractères au plus.",
  sons: SONS_CITATION_VERRE,
});

export type CitationVerreProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** La citation DITE, en deux lignes (8 caractères au plus chacune pour tenir dans la bulle). */
  lignes: readonly string[];
  prise?: PriseLot;
  /** Bord droit réel du visage (fraction de L), sur la hauteur de la bulle. Défaut 0,727 (prise commune). */
  bordVisage?: number;
};

export function CitationVerre(p: CitationVerreProps) {
  usePolicesD();
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const kSortie = (fin - debut) * FPS - 5;
  const prise = p.prise ?? PRISE_COMMUNE_LOT;
  const Z = zonePx(prise, W, H, 0);
  // Géométrie (px). La bulle est AU-DESSUS de la tête, à droite (x 0,56 → 0,98 L) : au-dessus des cheveux, rien ne la coupe, et elle tient
  // entièrement dans le cadre. Sa queue en goutte pointe vers la tête et s'arrête à plus de 0,03 L des cheveux (pointe à x = 0,668 L).
  void Z;
  const fs = 0.058 * W;
  const nbLignes = Math.min(2, p.lignes.length);
  const L0 = 0.57 * W;
  const w = 0.41 * W;
  const T0 = 0.028 * H;
  const h = nbLignes * fs * 1.25 + 0.085 * W;
  const r = 0.04 * W;
  const tipX = 0.668 * W;
  const tipY = T0 + h + 0.027 * H;
  const qa = L0 + 0.13 * W; // départ de la queue sur le bas de la bulle
  const qb = L0 + 0.27 * W;
  const corps =
    `M ${L0 + r} ${T0} H ${L0 + w - r} Q ${L0 + w} ${T0} ${L0 + w} ${T0 + r} V ${T0 + h - r} Q ${L0 + w} ${T0 + h} ${L0 + w - r} ${T0 + h} H ${qb} ` +
    `Q ${qb - 0.02 * W} ${T0 + h + 0.004 * H} ${tipX} ${tipY} Q ${qa + 0.01 * W} ${T0 + h + 0.006 * H} ${qa - 0.02 * W} ${T0 + h} H ${L0 + r} ` +
    `Q ${L0} ${T0 + h} ${L0} ${T0 + h - r} V ${T0 + r} Q ${L0} ${T0} ${L0 + r} ${T0} Z`;

  // Temps.
  const kGrow = 6;
  const grow = k < kGrow ? 0.15 : 0.15 + 0.85 * Math.min(1.03, rs(k - kGrow, "JAILLIR"));
  const focus = k >= kGrow ? 0.006 * W * (1 - lin(k, kGrow, kGrow + 4)) : 0;
  const pointsOp = k < kGrow ? 1 : 1 - lin(k, kGrow, kGrow + 3);
  const pointsE = k < kGrow ? 0.6 + 0.4 * Math.min(1.1, rs(k, "JAILLIR")) : 1;
  const vie = k > kGrow + 14 && k < kSortie ? 1 : 0;
  const ty = vie * 0.0025 * H * Math.sin((2 * Math.PI * (k - kGrow - 14)) / 72);
  const rotVie = vie * 0.8 * Math.sin((2 * Math.PI * (k - kGrow - 14)) / 96);
  const rotBase = -2;
  const ks = k - kSortie;
  const sortie = ks > 0 ? 1.02 * W * rs(ks, "FOUET") : 0;
  const flou = ks > 0 ? 0.03 * W * lin(ks, 0, 3) : 0;

  const reflet = k >= kGrow + 2 && k <= kGrow + 14 ? courbe(k, kGrow + 2, kGrow + 12, [0.65, 0, 0.35, 1]) : k >= kGrow + 36 && k <= kGrow + 48 ? courbe(k, kGrow + 36, kGrow + 46, [0.65, 0, 0.35, 1]) : -1;
  const lig = p.lignes.slice(0, 2).map((l) => l.slice(0, 10));
  const n = k < kGrow + 3 ? 0 : Math.floor(2 * (k - (kGrow + 3)) + 2);
  let reste = n;
  const nVis = lig.map((l) => {
    const v = Math.max(0, Math.min(reste, l.length));
    reste -= l.length;
    return v;
  });
  const tx = L0 + 0.05 * W;
  const y1 = T0 + 0.05 * W + fs * 0.88;
  const gx0 = L0 - 0.1 * W + (w + 0.2 * W) * (reflet < 0 ? 2 : reflet);

  const txt = (ligne: string, nVis: number, y: number) => (
    <text x={tx} y={y} fontFamily={POLICES.texte} fontWeight={700} fontSize={fs} fill={N3.encre}>
      <tspan>{ligne.slice(0, nVis)}</tspan>
      <tspan fillOpacity={0}>{ligne.slice(nVis)}</tspan>
    </text>
  );

  const contenu = (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id="verre-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N3.ivoire} stopOpacity={0.96} />
          <stop offset="1" stopColor={N3.ivoireCreux} stopOpacity={0.92} />
        </linearGradient>
        <linearGradient id="verre-orange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N3.orangeChaud} />
          <stop offset="1" stopColor={N3.orangeProfond} />
        </linearGradient>
        <linearGradient id="verre-reflet" gradientUnits="userSpaceOnUse" x1={gx0 - 0.07 * W} y1={T0} x2={gx0 + 0.07 * W} y2={T0 + h} gradientTransform={`rotate(20 ${gx0} ${T0 + h / 2})`}>
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.75} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <clipPath id="verre-clip">
          <path d={corps} />
        </clipPath>
        <filter id="verre-ombre" filterUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H} colorInterpolationFilters="sRGB">
          <feDropShadow dx={0} dy={0.004 * W} stdDeviation={0.005 * W} floodColor={N3.encre} floodOpacity={0.2} />
          <feDropShadow dx={0} dy={0.018 * W} stdDeviation={0.022 * W} floodColor={N3.encre} floodOpacity={0.24} />
          <feDropShadow dx={0} dy={0.045 * W} stdDeviation={0.055 * W} floodColor={N3.encre} floodOpacity={0.16} />
        </filter>
      </defs>
      <g transform={`translate(0 ${ty}) translate(${tipX} ${tipY}) rotate(${rotBase + rotVie}) scale(${grow}) translate(${-tipX} ${-tipY})`} style={{ filter: focus > 0.3 ? `blur(${focus}px)` : undefined }}>
        <g filter="url(#verre-ombre)">
          <path d={corps} fill="url(#verre-fond)" />
        </g>
        <path d={corps} fill="none" stroke={alpha(N3.ivoire, 0.9)} strokeWidth={0.003 * W} />
        <g clipPath="url(#verre-clip)">
          <rect x={L0 - 0.1 * W} y={T0} width={w + 0.2 * W} height={h} fill="url(#verre-reflet)" opacity={reflet < 0 ? 0 : 0.9} />
          <rect x={L0} y={T0} width={w} height={0.004 * W} fill="#fff" opacity={0.7} />
        </g>
        <rect x={L0 + 0.022 * W} y={T0 + 0.04 * W} width={0.009 * W} height={h - 0.08 * W} rx={0.0045 * W} fill="url(#verre-orange)" />
        {lig.map((l, i) => <React.Fragment key={i}>{txt(l, nVis[i], y1 + i * fs * 1.25)}</React.Fragment>)}
      </g>
      {pointsOp > 0.01 ? (
        <g opacity={pointsOp} transform={`translate(${tipX} ${tipY}) scale(${pointsE}) translate(${-tipX} ${-tipY})`}>
          <g filter="url(#verre-ombre)">
            <rect x={tipX + 0.004 * W} y={tipY - 0.03 * W} width={0.13 * W} height={0.06 * W} rx={0.03 * W} fill="url(#verre-fond)" />
          </g>
          {[0, 1, 2].map((i) => {
            const pulse = 0.5 + 0.5 * Math.sin(((k - i * 2) / 6) * Math.PI * 2 * 0.5);
            return <circle key={i} cx={tipX + 0.03 * W + i * 0.035 * W} cy={tipY - 0.0025 * W * pulse} r={0.0075 * W * (0.85 + 0.3 * pulse)} fill={N3.encre} fillOpacity={0.45 + 0.4 * pulse} />;
          })}
        </g>
      ) : null}
    </svg>
  );

  void entrant;
  void Z;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateX(${sortie}px)` }}>
        <FlouDir cx={W / 2} cy={H / 2} cote={1.3 * H} angle={0} px={flou}>
          <div style={{ position: "relative", width: W, height: H }}>{contenu}</div>
        </FlouDir>
      </div>
    </div>
  );
}
