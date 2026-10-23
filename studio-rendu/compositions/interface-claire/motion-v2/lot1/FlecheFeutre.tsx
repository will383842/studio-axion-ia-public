import React from "react";
/**
 * ÉLÉMENT 4 « FLÈCHE-FEUTRE » (Lot 1 « Papier & collage », standard DA v2, fiche § D).
 *
 *  - Emplacement E6 (diagonale) : du coin bas-gauche (0,06 L ; 0,88 H) vers l'épaule (0,215 L ; 0,53 H). La pointe
 *    s'arrête à 0,215 L (et non 0,24) : les deux traits de la pointe et l'épaisseur du feutre restent à gauche du
 *    bord de la zone Z (0,25 L), le visage reste libre.
 *  - Forme F4 : trait de feutre ORANGE à épaisseur variable (0,014 L ± 15 %), courbe de Bézier à UNE inflexion,
 *    pointe ouverte (2 traits de 0,05 L), tremblement de 0,6 px renouvelé toutes les 2 images tant que le trait est
 *    visible (aléa fixé). Un ombrage encre décalé vers le bas-droit le détache de n'importe quel fond. Au départ :
 *    un mot en F11 (Montserrat ExtraBold, 0,08 L de haut, orange à contour encre).
 *  - Mouvement M6 : tracé de i0 à i9 (courbe 0,33 / 0 / 0,2 / 1), pointe en M1 (JAILLIR, 6 images) à i9 ; le mot
 *    jaillit à i0 (M1, rotation +15° → −6°).
 *  - Micro-vie : tremblement du trait + léger balancement du mot. Sortie : BALAYAGE INVERSE (le trait se rétracte de la
 *    pointe vers le départ en 6 images, le mot se replie ensuite).
 *  - Visage : ENTIER. Quand : désigner (« regardez », « ça », « moi »). Mot = un mot DIT.
 */
import { POLICES, largeurTexte } from "../../charte";
import { C, FPS, alea, easeIn3, easeTrace, entre, ressort } from "./commun-lot1";

export const FICHE_FLECHE_FEUTRE = Object.freeze({
  id: "fleche-feutre",
  nom: "Flèche dessinée au feutre avec un mot",
  emplacement: "E6" as const,
  forme: "F4+F11" as const,
  mouvement: "M6" as const,
  sortie: "balayage inverse" as const,
  visage: "entier" as const,
  angle: -6,
  ouvertureAutorisee: true,
  dureeMin: 1.2,
  dureeMax: 2.5,
  quandUtiliser: "Pour désigner : « regardez », « ça », « moi ». Le mot au départ est un mot DIT.",
  sons: [{ a: 0, fichier: "feutre" }],
  instantsPlanche: [0, 2, 4, 8, 20, "sortie"] as const,
});

export type FlecheFeutreProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mot DIT par Will, au départ de la flèche. */
  mot: string;
};

export const IMAGES_SORTIE_FLECHE = 8;

type Pt = [number, number];

/** Point et tangente d'une Bézier cubique. */
function bezier(p: Pt[], s: number): Pt {
  const u = 1 - s;
  return [u * u * u * p[0][0] + 3 * u * u * s * p[1][0] + 3 * u * s * s * p[2][0] + s * s * s * p[3][0], u * u * u * p[0][1] + 3 * u * u * s * p[1][1] + 3 * u * s * s * p[2][1] + s * s * s * p[3][1]];
}
function tangente(p: Pt[], s: number): Pt {
  const u = 1 - s;
  const x = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * s * (p[2][0] - p[1][0]) + 3 * s * s * (p[3][0] - p[2][0]);
  const y = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * s * (p[2][1] - p[1][1]) + 3 * s * s * (p[3][1] - p[2][1]);
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}

export function FlecheFeutre(p: FlecheFeutreProps) {
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kSortie = (t - fin) * FPS;
  if (k < 0 || kSortie >= IMAGES_SORTIE_FLECHE) return null;
  const mot = p.mot.toUpperCase();

  // Courbe : départ bas-gauche, arrivée sur l'épaule, une seule inflexion (S allongé).
  const P: Pt[] = [
    [W * 0.08, H * 0.91],
    [W * 0.0, H * 0.8],
    [W * 0.12, H * 0.71],
    [W * 0.235, H * 0.625],
  ];

  // Progression du tracé : avance de i0 à i9, recule en sortie (balayage inverse).
  const avance = entre(k, 0, 9, easeTrace);
  const recul = kSortie > 0 ? entre(kSortie, 0, 5, easeIn3) : 0;
  const prog = avance * (1 - recul);
  const largeurBase = W * 0.017;
  const N = 56;
  const graineTremble = Math.floor(k / 2) * 17 + 3;
  const rng = alea(graineTremble);
  const rngForme = alea(8); // épaisseur : fixe
  const phases = [rngForme() * 6, rngForme() * 6];
  const nPts = Math.max(2, Math.round(prog * N) + 1);
  const gauche: Pt[] = [];
  const droite: Pt[] = [];
  for (let i = 0; i < nPts; i++) {
    const s = Math.min(prog, 1) * (i / (nPts - 1));
    const c = bezier(P, s);
    const tg = tangente(P, s);
    const nx = -tg[1];
    const ny = tg[0];
    const ep = (largeurBase / 2) * (1 + 0.15 * Math.sin(5 * s + phases[0]) + 0.08 * Math.sin(13 * s + phases[1])) * (0.55 + 0.45 * Math.min(1, s * 14 + 0.2));
    const tr = 0.6;
    const jx = (rng() - 0.5) * 2 * tr;
    const jy = (rng() - 0.5) * 2 * tr;
    gauche.push([c[0] + nx * ep + jx, c[1] + ny * ep + jy]);
    droite.push([c[0] - nx * ep + jx, c[1] - ny * ep + jy]);
  }
  const poly = [...gauche, ...droite.reverse()].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const bout = bezier(P, Math.min(prog, 1));

  // Pointe ouverte : 2 traits de 0,05 L, JAILLIR à i9 sur 6 images ; disparaît dès les 2 premières images de la sortie.
  const tgFin = tangente(P, 1);
  const lp = W * 0.07;
  const ouv = (28 * Math.PI) / 180;
  const arriere: Pt = [-tgFin[0], -tgFin[1]];
  const rot = (v: Pt, a: number): Pt => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const a1 = rot(arriere, ouv);
  const a2 = rot(arriere, -ouv);
  const tete = k >= 9 ? ressort(k - 9, "JAILLIR") * (1 - entre(kSortie, 0, 2)) : 0;
  const tip = P[3];

  // Mot : JAILLIR à i0 (rotation +15° → −6°), micro-balancement, repli en sortie.
  const rm = ressort(k, "JAILLIR");
  const motEchelle = rm * (1 - easeIn3(entre(kSortie, 3, 8)));
  const motRot = -8 + 21 * (1 - rm) + Math.sin((2 * Math.PI * k) / 45) * 0.8 * entre(k, 10, 18);
  const taille = Math.min(W * 0.1, (W * 0.38) / (largeurTexte(mot, 100) / 100));
  const motX = W * 0.035;
  const motY = H * 0.965;

  const ombre = W * 0.004;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* Ombrage encre décalé vers le bas-droit. */}
        <g transform={`translate(${ombre} ${ombre})`} opacity={0.9}>
          {nPts > 1 && <polygon points={poly} fill={C.encre} />}
          {tete > 0 && (
            <g transform={`translate(${tip[0]} ${tip[1]}) scale(${tete}) translate(${-tip[0]} ${-tip[1]})`}>
              <line x1={tip[0]} y1={tip[1]} x2={tip[0] + a1[0] * lp} y2={tip[1] + a1[1] * lp} stroke={C.encre} strokeWidth={largeurBase * 0.95} strokeLinecap="round" />
              <line x1={tip[0]} y1={tip[1]} x2={tip[0] + a2[0] * lp} y2={tip[1] + a2[1] * lp} stroke={C.encre} strokeWidth={largeurBase * 0.95} strokeLinecap="round" />
            </g>
          )}
        </g>
        {nPts > 1 && <polygon points={poly} fill={C.orange} />}
        {prog > 0 && <circle cx={bout[0]} cy={bout[1]} r={largeurBase * 0.5} fill={C.orange} />}
        <circle cx={P[0][0]} cy={P[0][1]} r={largeurBase * 0.42} fill={C.orange} />
        {tete > 0 && (
          <g transform={`translate(${tip[0]} ${tip[1]}) scale(${tete}) translate(${-tip[0]} ${-tip[1]})`}>
            <line x1={tip[0]} y1={tip[1]} x2={tip[0] + a1[0] * lp} y2={tip[1] + a1[1] * lp} stroke={C.orange} strokeWidth={largeurBase * 0.95} strokeLinecap="round" />
            <line x1={tip[0]} y1={tip[1]} x2={tip[0] + a2[0] * lp} y2={tip[1] + a2[1] * lp} stroke={C.orange} strokeWidth={largeurBase * 0.95} strokeLinecap="round" />
          </g>
        )}
      </svg>
      {/* Mot au départ de la flèche (F11 : le mot est la forme). */}
      <div
        style={{
          position: "absolute",
          left: motX,
          top: motY,
          transformOrigin: "0 100%",
          transform: `translate(0, -100%) rotate(${motRot}deg) scale(${Math.max(0, motEchelle)})`,
          fontFamily: POLICES.titre,
          fontSize: taille,
          lineHeight: 1,
          color: C.orange,
          WebkitTextStroke: `${Math.max(3, W * 0.0045)}px ${C.encre}`,
          paintOrder: "stroke fill",
          textShadow: `${W * 0.0065}px ${W * 0.0065}px 0 ${C.encre}`,
          whiteSpace: "nowrap",
        }}
      >
        {mot}
      </div>
    </div>
  );
}
