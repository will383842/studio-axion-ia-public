import React from "react";
/**
 * ÉLÉMENT 2 « SCOTCH-POSTIT » (Lot 1 « Papier & collage », standard DA v2, fiche § D).
 *
 *  - Emplacement E2 (gauche) : papier de 0,31 L × 0,27 H, de −0,065 à 0,245 L, de 0,05 à 0,32 H (visible ≈ 6,5 % de l'image). Pendu par son coin HAUT-DROIT
 *    (le côté qui regarde le visage) : en retombant, le balancier part vers l'EXTÉRIEUR (vers le bord gauche du cadre) et
 *    son retour est amorti (2e lobe ≈ 2°), si bien que le papier reste à x ≤ 0,25 L, hors de la zone Z du visage.
 *    Écart assumé avec le ressort BALANCER du standard (42 % de dépassement : le papier irait dans Z) : balancier
 *    amorti sur mesure, θ = −6° + 14° · e^(−k/6) · cos(2πk/22).
 *  - Forme F10 : papier sable-clair à bords déchirés (dents de 0,006 à 0,018 L) avec liseré de fibres ivoire, incliné de
 *    −6°, ombre dure vers le bas-droit, 2 bandes de scotch en croix (±25°, ivoire à 72 %).
 *  - Mouvement M9 : le papier tombe du haut du cadre en balancier (ressort de chute + balancier), puis les 2 scotchs
 *    claquent à 2 images d'écart (i8 et i10) ; le scotch fige le papier (le balancier s'éteint en 4 images).
 *  - Micro-vie : ±1° sur 1,6 s. Sortie : CHUTE (le scotch lâche : anticipation de 2 i, puis le papier tombe en pivotant).
 *  - Visage : ENTIER. Quand : une tâche, un rappel, « il faut penser à… ». Lignes = mots DITS (4 lignes au plus).
 */
import { POLICES, largeurTexte } from "../../charte";
import { C, FPS, Scotch, alea, bordHorizontal, bordVertical, clamp01, easeIn3, entre, ressort, versPoints } from "./commun-lot1";
import { spring } from "remotion";

export const FICHE_SCOTCH_POSTIT = Object.freeze({
  id: "scotch-postit",
  nom: "Papier collé au scotch qui se balance",
  emplacement: "E2" as const,
  forme: "F10" as const,
  mouvement: "M9" as const,
  sortie: "chute" as const,
  visage: "entier" as const,
  angle: -6,
  ouvertureAutorisee: true,
  dureeMin: 1.5,
  dureeMax: 3,
  quandUtiliser: "Une tâche, un rappel, « il faut penser à… » : 1 à 4 lignes courtes, mots DITS par Will.",
  sons: [
    { a: 0.27, fichier: "scotch (à sourcer, CC0)" },
    { a: 0.27, fichier: "drop_001" },
    { a: 0.33, fichier: "scotch (à sourcer, CC0)" },
  ],
  instantsPlanche: [0, 2, 4, 8, 22, "sortie"] as const,
});

export type ScotchPostitProps = {
  t: number;
  /** i0 : le papier part du haut du cadre. */
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** 1 à 4 lignes courtes DITES par Will. */
  lignes: string[];
};

export const IMAGES_SORTIE_POSTIT = 8;

/** Chute : ressort un peu mou, petit rebond à l'atterrissage. */
function chute(k: number): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.8 } });
}

export function ScotchPostit(p: ScotchPostitProps) {
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kSortie = (t - fin) * FPS;
  if (k < 0 || kSortie >= IMAGES_SORTIE_POSTIT) return null;

  const w = W * 0.31; // 0,065 L dépasse à gauche du cadre : visible ≈ 0,245 L × 0,27 H
  const h = H * 0.27;
  const pivotX = W * 0.245; // coin haut-droit du papier (x) : jamais au-delà de 0,25 L (zone Z)
  const top0 = H * 0.05;
  const lignes = p.lignes.slice(0, 4).map((l) => l.toUpperCase());

  // Chute depuis le haut du cadre (translation du pivot), puis balancier amorti autour du coin haut-droit.
  const tombe = chute(k);
  const dyChute = -(top0 + h + W * 0.04) * (1 - tombe);
  const scotch1 = ressort(k - 8, "CLAQUER");
  const scotch2 = ressort(k - 10, "CLAQUER");
  const fige = k >= 10 ? 1 - entre(k, 10, 14) : 1; // amplitude restante du balancier
  // Balancier : départ à +32° (8° + 24°), lobes suivants jamais sous +4° (le papier ne rentre jamais dans Z).
  let theta = 8 + 24 * Math.exp(-k / 6) * Math.cos((2 * Math.PI * k) / 22) * (k >= 10 ? fige : 1);
  // Micro-vie ±1° (période 1,6 s) une fois figé.
  theta += Math.sin((2 * Math.PI * k) / 48) * 1 * entre(k, 18, 26);

  let dx = 0;
  let dy = dyChute;
  let rotSortie = 0;
  if (kSortie > 0) {
    const ant = entre(kSortie, 0, 2);
    const vol = easeIn3(entre(kSortie, 2, IMAGES_SORTIE_POSTIT));
    theta += 2 * ant + 34 * vol;
    dy += vol * H * 0.5;
    dx -= vol * W * 0.04;
    rotSortie = 0;
  }

  // Papier : polygone à bords déchirés (haut droit, trois autres côtés déchirés).
  const rng = alea(31);
  const dent = W * 0.006;
  const haut: [number, number][] = [
    [0, 0],
    [w, 0],
  ];
  const droite = bordVertical(rng, 0, h, w, dent, W);
  const bas = bordHorizontal(rng, w, 0, h, W * 0.007, W);
  const gauche = bordVertical(rng, h, 0, 0, dent, W);
  const pts: [number, number][] = [...haut, ...droite.slice(1), ...bas, ...gauche];
  const ombre = W * 0.0065;

  // Texte : chaque ligne ajustée à la largeur du papier (26 px au moins).
  const marge = W * 0.065; // partie du papier hors cadre
  const dispo = w - marge - W * 0.045;
  const tailles = lignes.map((l) => Math.max(W * 0.034, Math.min(W * 0.062, dispo / (largeurTexte(l, 100) / 100))));
  const totalH = tailles.reduce((a, b) => a + b * 1.25, 0);

  // Position : origine = coin haut-droit du papier ; le papier s'étend vers la gauche.
  const left = pivotX - w;

  const barre = entre(k, 14, 20); // soulignement feutre sous la dernière ligne

  const tape = (key: string, cx: number, cyT: number, angle: number, prog: number, graine: number) => (
    <div key={key} style={{ position: "absolute", left: cx, top: cyT, transform: `rotate(${angle}deg) scale(${1 + 0.3 * (1 - prog)})`, opacity: prog > 0 ? Math.min(1, prog * 3) : 0 }}>
      <Scotch l={W * 0.14} h={W * 0.04} graine={graine} />
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left,
          top: top0,
          width: w,
          height: h,
          transformOrigin: "100% 0",
          transform: `translate(${dx}px, ${dy}px) rotate(${theta + rotSortie}deg)`,
        }}
      >
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <polygon points={versPoints(pts)} transform={`translate(${ombre} ${ombre})`} fill={C.encre} />
          <polygon points={versPoints(pts)} fill={C.sableClair} stroke={C.ivoire} strokeWidth={3} strokeLinejoin="round" />
          {/* reflet de fibres sur le bord haut */}
          <line x1={4} y1={4} x2={w - 4} y2={4} stroke={C.ivoire} strokeOpacity={0.55} strokeWidth={2} />
        </svg>
        <div style={{ position: "absolute", left: marge, top: W * 0.07, width: w - marge, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {lignes.map((l, i) => (
            <div key={i} style={{ fontFamily: POLICES.titre, fontSize: tailles[i], lineHeight: 1.25, color: C.encre, whiteSpace: "nowrap", transform: `rotate(${i % 2 ? 1.2 : -0.8}deg)` }}>
              {l}
            </div>
          ))}
        </div>
        {/* Soulignement au feutre orange sous la dernière ligne. */}
        {barre > 0 && lignes.length > 0 && (
          <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <path
              d={`M${marge + (w - marge) * 0.12} ${W * 0.07 + totalH + 6} q${(w - marge) * 0.22} ${-8} ${(w - marge) * 0.4} ${-1} t${(w - marge) * 0.34} ${-3}`}
              fill="none"
              stroke={C.orange}
              strokeWidth={W * 0.011}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - clamp01(barre)}
            />
          </svg>
        )}
        {/* Deux scotchs en croix (gauche puis droite, 2 images d'écart). */}
        {tape("g", marge + W * 0.045, W * 0.012, -25, scotch1, 5)}
        {tape("d", w - W * 0.07, W * 0.012, 25, scotch2, 9)}
      </div>
    </div>
  );
}
