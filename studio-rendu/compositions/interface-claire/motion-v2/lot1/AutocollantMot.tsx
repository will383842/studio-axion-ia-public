import React from "react";
/**
 * ÉLÉMENT 1 « AUTOCOLLANT-MOT » (Lot 1 « Papier & collage », standard DA v2, fiche § D).
 *
 *  - Emplacement E3 (droite) : la dernière lettre et le bord de découpe dépassent du cadre à droite (permis en E2/E3).
 *    Le bord gauche reste à x ≥ 0,81 L : même au pire de l'impact (échelle 1,25, 20°), l'autocollant n'entre jamais dans
 *    la zone Z du visage (rotation et échelle se font autour du bord GAUCHE, jamais vers le visage).
 *  - Forme F3 : fond orange, mot encre, marge de découpe ivoire de 0,014 L, ombre dure encre vers le bas-droit, incliné de
 *    +9°. Un coin (bas-gauche) se décolle : triangle sable-clair qui se rétrécit.
 *  - Mouvement M4 : pré-éclat à i-1, claquement (échelle 1,25 → 1, rotation +17° → +9°, ressort CLAQUER), 4 traits
 *    d'impact aux coins à i3, secousse DE L'AUTOCOLLANT de i3 à i12 (A = 0,012 L), le coin se décolle de 16 % à 6 % de
 *    la largeur (≈ 8 % à 3 % de la fiche, doublés pour rester lisible) de i8 à i14.
 *  - Micro-vie : oscillation de ±1° (F3). Sortie : ENVOL vers la droite (anticipation 2 i à 0,97, départ en 4 i).
 *  - Visage : ENTIER. Quand : un mot-clé nom DIT (« devis », « relances »). Pas de chiffre ni de mot non dit.
 */
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { C, FPS, alea, easeIn3, entre, ressort, secousse } from "./commun-lot1";

export const FICHE_AUTOCOLLANT_MOT = Object.freeze({
  id: "autocollant-mot",
  nom: "Autocollant découpé avec un mot-clé",
  emplacement: "E3" as const,
  forme: "F3" as const,
  mouvement: "M4" as const,
  sortie: "envol" as const,
  visage: "entier" as const,
  angle: 9,
  ouvertureAutorisee: true,
  dureeMin: 1.2,
  dureeMax: 3,
  quandUtiliser: "Un mot-clé nom dit par Will (« devis », « relances »). Le mot affiché est TOUJOURS un mot de la phrase.",
  sons: [
    { a: 0, fichier: "drop_002" },
    { a: 0.07, fichier: "autocollant (à sourcer, CC0)" },
  ],
  /** Instants clés relatifs à i0, en images : i0, i2, i4, i8, posé, sortie. */
  instantsPlanche: [0, 2, 4, 8, 20, "sortie"] as const,
});

export type AutocollantMotProps = {
  /** Temps courant (s), même horloge que `debut` et `fin`. */
  t: number;
  /** i0 : instant où Will dit le mot (s). */
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mot DIT par Will (capitales, 12 lettres au plus). */
  mot: string;
};

/** Durée de la sortie (images) : anticipation 2 + envol 4. */
export const IMAGES_SORTIE_AUTOCOLLANT = 6;

export function AutocollantMot(p: AutocollantMotProps) {
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kSortie = (t - fin) * FPS;
  if (k < -1 || kSortie >= IMAGES_SORTIE_AUTOCOLLANT) return null;

  const mot = p.mot.toUpperCase();
  const pad = W * 0.022;
  const em = largeurTexte(mot, 100) / 100;
  const w = W * 0.42;
  const taille = Math.min(W * 0.085, (w - 2 * pad - W * 0.03) / em);
  const h = H * 0.15;
  const xL = W * 0.59;
  const cy = H * 0.72;
  const yT = cy - h / 2;

  // Pré-éclat : un point orange à l'emplacement, 1 image.
  if (k < 0) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: xL + w / 2 - W * 0.015, top: cy - W * 0.015, width: W * 0.03, height: W * 0.03, borderRadius: "50%", background: COULEURS.orange }} />
      </div>
    );
  }

  // Claquement : échelle 1,25 → 1 et rotation +17° → +9° avec CLAQUER ; secousse de l'élément seul.
  const r = ressort(k, "CLAQUER");
  let echelle = 1 + 0.6 * (1 - r);
  let rot = 9 + 19 * (1 - r);
  let dx = secousse(k - 3, W * 0.012);
  let dy = 0;
  // Micro-vie : ±1° après la pose.
  rot += Math.sin((2 * Math.PI * k) / 54) * 1 * entre(k, 12, 20);
  // Sortie : envol.
  let opacite = 1;
  if (kSortie > 0) {
    const ant = entre(kSortie, 0, 2);
    const vol = easeIn3(entre(kSortie, 2, IMAGES_SORTIE_AUTOCOLLANT));
    echelle *= 1 - 0.03 * ant;
    dx += vol * W * 0.55;
    dy -= vol * H * 0.05;
    rot += vol * 26;
    opacite = 1 - 0.3 * vol;
  }

  // Forme : rectangle à coins arrondis, coins irréguliers (découpe au ciseau), coin bas-gauche décollé.
  const rng = alea(11 + mot.length * 7);
  const j = () => (rng() - 0.5) * 6;
  const rc = W * 0.028;
  const pel = w * 0.17 * (1 - 0.6 * entre(k, 8, 14));
  const x0 = 0;
  const y0 = 0;
  const trace =
    `M${x0 + rc + j()} ${y0 + j()} L${x0 + w - rc} ${y0 + j()} Q${x0 + w + j()} ${y0 + j()} ${x0 + w + j()} ${y0 + rc}` +
    ` L${x0 + w + j()} ${y0 + h - rc} Q${x0 + w + j()} ${y0 + h + j()} ${x0 + w - rc} ${y0 + h + j()}` +
    ` L${x0 + pel} ${y0 + h + j()} L${x0 + j()} ${y0 + h - pel} L${x0 + j()} ${y0 + rc} Q${x0 + j()} ${y0 + j()} ${x0 + rc} ${y0 + j()} Z`;

  const marge = W * 0.014;
  const ombre = W * 0.0065;
  const traitsImpact = k >= 3 && k < 7 ? entre(k, 3, 5) : 0;
  const traitsFondu = k >= 5 ? 1 - entre(k, 5.5, 7) : 1;
  const L = W * 0.06;
  const coins: [number, number, number, number][] = [
    [0, 0, -1, -1],
    [w, 0, 1, -1],
    [0, h, -1, 1],
    [w, h, 1, 1],
  ];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: xL,
          top: yT,
          width: w,
          height: h,
          transformOrigin: "0 50%",
          transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${echelle})`,
          opacity: opacite,
        }}
      >
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {/* Ombre dure (vers le bas-droit), puis marge de découpe ivoire, puis fond orange. */}
          <path d={trace} transform={`translate(${ombre} ${ombre})`} fill={C.encre} stroke={C.encre} strokeWidth={marge * 2} strokeLinejoin="round" />
          <path d={trace} fill={C.ivoire} stroke={C.ivoire} strokeWidth={marge * 2} strokeLinejoin="round" />
          <path d={trace} fill={C.orange} />
          {/* Reflet fin sur le bord haut. */}
          <line x1={rc} y1={3} x2={w - rc} y2={3} stroke={C.ivoire} strokeOpacity={0.35} strokeWidth={2} />
          {/* Coin décollé : triangle sable-clair replié sur l'autocollant, avec sa petite ombre. */}
          <polygon points={`${x0},${h - pel} ${x0 + pel},${h} ${x0 + pel},${h - pel}`} fill={C.sableClair} stroke={C.sableProfond} strokeWidth={1.5} strokeLinejoin="round" />
          {/* 4 traits d'impact aux coins (encre), qui jaillissent puis disparaissent. */}
          {traitsImpact > 0 &&
            coins.map(([cx, cyy, sx, sy], i) => {
              const d = (marge + W * 0.012) * 1.0;
              const a = cx + sx * (d + 0);
              const b = cyy + sy * (d + 0);
              const lg = L;
              const e = cx + sx * (d + lg * traitsImpact);
              const f = cyy + sy * (d + lg * traitsImpact);
              return <line key={i} x1={a} y1={b} x2={e} y2={f} stroke={C.encre} strokeWidth={W * 0.0065} strokeLinecap="round" opacity={traitsFondu} />;
            })}
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: w - W * 0.03,
            height: h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: POLICES.titre,
            fontSize: taille,
            lineHeight: 1,
            color: C.encre,
            letterSpacing: 0,
            whiteSpace: "nowrap",
          }}
        >
          {mot}
        </div>
      </div>
    </div>
  );
}
