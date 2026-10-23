import React from "react";
/**
 * ÉLÉMENT 20 « GERBE DE FORMES » (lot 4 « Impact / énergie », standard DA v2 § D).
 *  - Emplacement E4 (bas droit : origine 0,72 L ; 0,95 H, la gerbe part vers le haut-gauche) : une gerbe de 14 petites formes de la charte (disques F1, éclats F5, triangles) jaillit du bas du
 *    cadre avec GRAVITÉ (M7 : g = 0,002 H/i², retombée), puis une pastille orange F1 avec le mot dit arrive en M1 au sommet.
 *    La gerbe ne monte jamais au-dessus de 0,70 H (sous la bande des sous-titres, 0,60 → 0,68 H) : elle ne touche pas Z.
 *  - Quand : une réussite DITE (« c'est fait », « c'est parti »). Le texte de la pastille est TOUJOURS dit par Will.
 *  - Visage : ENTIER. Sortie : CHUTE (anticipation de 2 images puis la pastille tombe hors du cadre en tournant).
 *  - Micro-vie : respiration de ±2 % de la pastille. Prise : jamais touchée. Bruitage : confirmation_002.
 */
import { COULEURS, largeurTexte, POLICES } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { alea, BruitageMotion, borne, FPS, lerp, ressort, secousse, sortieCubique } from "./outils4";

export type DonneesGerbeFormes = {
  debut: number;
  fin: number;
  /** Texte DIT par Will, 1 ou 2 mots (« C'est fait »). */
  ligne1: string;
  ligne2?: string;
};

export const FICHE_GERBE_FORMES = Object.freeze({
  id: "gerbe-formes",
  nom: "Gerbe de formes",
  lot: 4,
  emplacement: "E4" as const,
  forme: "F1+F5+triangles" as const,
  mouvement: "M7+M1" as const,
  sortie: "chute" as const,
  visage: "entier" as const,
  dureeMin: 1.2,
  dureeMax: 2.2,
  quandUtiliser: "Réussite dite : « c'est fait », « c'est parti ».",
});

export const EXEMPLE_GERBE_FORMES: DonneesGerbeFormes = { debut: 0.2, fin: 2.0, ligne1: "C'est", ligne2: "fait" };
export const INSTANTS_GERBE_FORMES = [0, 3, 8, 12, 30] as const;

const N = 14;
const ARRIVEE_PASTILLE = 8;
const SORTIE = 7;

export function GerbeFormes({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_GERBE_FORMES }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesGerbeFormes }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const k = (t - d.debut) * FPS;
  const kFin = (d.fin - d.debut) * FPS;
  if (k < -1 || k >= kFin) return null;
  const g = 0.002 * H; // px / image²
  const x0 = W * 0.72;
  const y0 = H * 0.95;
  // Plafond : 0,70 H (sous la bande des sous-titres) → montée maximale = 0,25 H. v² / 2g = montée.
  const vyMax = Math.sqrt(2 * g * (0.25 * H));

  const formes = k >= 0 ? Array.from({ length: N }, (_, j) => {
    const dir = (j / (N - 1) - 0.5) * 2; // −1 … 1
    const vy = vyMax * (0.82 + 0.18 * alea(j * 1.7 + 2));
    const vx = -W * 0.021 + dir * W * 0.012 * (0.8 + 0.4 * alea(j * 2.9));
    const retard = (j % 4) * 0.4;
    const kk = k - retard;
    if (kk < 0) return null;
    const x = x0 + (alea(j + 8) - 0.5) * W * 0.08 + vx * kk;
    const y = y0 - vy * kk + 0.5 * g * kk * kk;
    if (y > H + 60 || x < -60 || x > W + 60) return null;
    const r = W * (0.02 + 0.015 * alea(j * 4.4 + 1));
    const rot = kk * (15 + 25 * alea(j + 3)) * (j % 2 ? 1 : -1);
    const couleur = [COULEURS.orange, COULEURS.ivoire, COULEURS.encre, COULEURS.sable][j % 4];
    const type = j % 3;
    const contour = 0.004 * W;
    const trait = couleur === COULEURS.encre ? COULEURS.ivoire : COULEURS.encre;
    return (
      <g key={j} transform={`translate(${x} ${y}) rotate(${rot})`}>
        {type === 0 ? <circle r={r} fill={couleur} stroke={trait} strokeWidth={contour} /> : null}
        {type === 1 ? <polygon points={`0,${-r * 1.3} ${r * 1.15},${r * 0.9} ${-r * 1.15},${r * 0.9}`} fill={couleur} stroke={trait} strokeWidth={contour} strokeLinejoin="round" /> : null}
        {type === 2 ? <path d={`M 0 ${-r * 1.3} L ${r * 0.35} ${-r * 0.35} L ${r * 1.3} 0 L ${r * 0.35} ${r * 0.35} L 0 ${r * 1.3} L ${-r * 0.35} ${r * 0.35} L ${-r * 1.3} 0 L ${-r * 0.35} ${-r * 0.35} Z`} fill={couleur} stroke={trait} strokeWidth={contour} strokeLinejoin="round" /> : null}
      </g>
    );
  }) : null;

  // Pastille F1 : M1 au sommet de la gerbe.
  const kp = k - ARRIVEE_PASTILLE;
  const D = 0.34 * W;
  const px = W * 0.68;
  const py = H * 0.8;
  const s = ressort(kp, "JAILLIR");
  const vie = 1 + 0.02 * Math.sin(Math.max(0, kp) * 0.26);
  const kS = k - (kFin - SORTIE);
  const antic = kS > 0 ? -Math.sin(Math.PI * 0.5 * borne(kS / 2, 0, 1)) * 0.03 : 0;
  const chute = kS > 2 ? sortieCubique((kS - 2) / (SORTIE - 2)) : 0;
  const rotP = lerp(-10, 8, ressort(kp, "TOUPIE")) + chute * 40;
  const dxP = secousse(kp - 4, 0.006 * W);
  const L1 = d.ligne1.toUpperCase();
  const L2 = d.ligne2?.toUpperCase();
  const maxL = Math.max(largeurTexte(L1, 1), L2 ? largeurTexte(L2, 1) : 0);
  const taille = Math.min(D * 0.26, (D * 0.74) / Math.max(1, maxL));
  const ombre = 0.008 * W;
  const contour = 0.006 * W;
  const echelle = Math.max(0.0001, s * vie * (1 + antic));

  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "hidden" }}>
      {k < 0 ? <circle cx={x0} cy={H * 0.9} r={0.015 * W} fill={COULEURS.orange} /> : formes}
      {kp > -1 && kp < 0 ? <circle cx={px} cy={py} r={0.015 * W} fill={COULEURS.orange} /> : null}
      {kp > 0 ? (
        <g transform={`translate(${px + dxP} ${py + chute * H * 0.5}) rotate(${rotP}) scale(${echelle})`}>
          <circle cx={ombre} cy={ombre} r={D / 2} fill={COULEURS.encre} />
          <circle r={D / 2} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} />
          <path d={`M ${-D * 0.36} ${-D * 0.18} A ${D * 0.4} ${D * 0.4} 0 0 1 ${-D * 0.05} ${-D * 0.39}`} fill="none" stroke={COULEURS.ivoire} strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />
          <text x={0} y={L2 ? -taille * 0.08 : taille * 0.36} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.ivoire}>{L1}</text>
          {L2 ? <text x={0} y={taille * 0.98} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.ivoire}>{L2}</text> : null}
        </g>
      ) : null}
    </svg>
  );
}

export function bruitagesGerbeFormes(d: DonneesGerbeFormes = EXEMPLE_GERBE_FORMES): BruitageMotion[] {
  return [[d.debut + ARRIVEE_PASTILLE / FPS - 0.05, "confirmation_002", 0.14]];
}
