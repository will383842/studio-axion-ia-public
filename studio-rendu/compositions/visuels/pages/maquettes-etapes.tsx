import type { ReactElement } from "react";
import { HAUTEUR_MAQUETTE, LARGEUR_MAQUETTE, type Maquette } from "../../../../src/briques/visuels/maquettes-etapes";
import { COULEURS } from "../commun/constantes";

const L = LARGEUR_MAQUETTE;
const H = HAUTEUR_MAQUETTE;
/** Zone d'écran sous la barre du haut (viewBox 150 × 100). */
const HAUT = 24;

/** Barre de texte simulée (aucun caractère : un trait plein arrondi). */
const Barre = ({ x, y, l, couleur = COULEURS.encre, h = 6 }: { x: number; y: number; l: number; couleur?: string; h?: number }) => <rect x={x} y={y} width={l} height={h} rx={h / 2} fill={couleur} />;

/** Coche tracée (deux segments). */
const Coche = ({ x, y, t, couleur }: { x: number; y: number; t: number; couleur: string }) => (
  <path d={`M${x} ${y + t * 0.5} L${x + t * 0.38} ${y + t * 0.85} L${x + t} ${y + t * 0.1}`} fill="none" stroke={couleur} strokeWidth={t * 0.22} strokeLinecap="round" strokeLinejoin="round" />
);

/** Contenu de chaque écran : rectangles, barres, coches ; jamais de texte, de marque ni de capture. */
const ECRANS: Record<Maquette, ReactElement> = {
  liste: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={16} y={HAUT + 10 + i * 22} width={14} height={14} rx={3} fill={i < 2 ? COULEURS.orange : COULEURS.blanc} stroke={COULEURS.encre} strokeWidth={2} />
          {i < 2 && <Coche x={18.5} y={HAUT + 12.5 + i * 22} t={9} couleur={COULEURS.creme} />}
          <Barre x={40} y={HAUT + 14 + i * 22} l={[86, 64, 76][i]} couleur={i < 2 ? COULEURS.encre : COULEURS.pale} />
        </g>
      ))}
    </>
  ),
  formulaire: (
    <>
      <Barre x={16} y={HAUT + 6} l={40} />
      <rect x={16} y={HAUT + 14} width={118} height={12} rx={4} fill={COULEURS.blanc} stroke={COULEURS.encre} strokeWidth={2} />
      <Barre x={16} y={HAUT + 32} l={52} />
      <rect x={16} y={HAUT + 40} width={118} height={12} rx={4} fill={COULEURS.blanc} stroke={COULEURS.encre} strokeWidth={2} />
      <rect x={92} y={HAUT + 58} width={42} height={12} rx={6} fill={COULEURS.orange} />
    </>
  ),
  messages: (
    <>
      <rect x={14} y={HAUT + 8} width={78} height={22} rx={8} fill={COULEURS.pale} />
      <Barre x={22} y={HAUT + 16} l={58} />
      <rect x={58} y={HAUT + 38} width={78} height={22} rx={8} fill={COULEURS.orange} />
      <Barre x={66} y={HAUT + 46} l={56} couleur={COULEURS.creme} />
      <circle cx={20} cy={HAUT + 69} r={3} fill={COULEURS.encre} />
      <circle cx={30} cy={HAUT + 69} r={3} fill={COULEURS.encre} />
      <circle cx={40} cy={HAUT + 69} r={3} fill={COULEURS.encre} />
    </>
  ),
  agenda: (
    <>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect key={`${r}-${c}`} x={14 + c * 25} y={HAUT + 8 + r * 22} width={21} height={18} rx={3} fill={r === 1 && c === 2 ? COULEURS.orange : COULEURS.blanc} stroke={COULEURS.encre} strokeWidth={r === 1 && c === 2 ? 0 : 1.5} />
        )),
      )}
    </>
  ),
  tableau: (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={22 + i * 30} y={HAUT + 66 - [22, 34, 28, 48][i]} width={20} height={[22, 34, 28, 48][i]} rx={3} fill={i === 3 ? COULEURS.orange : COULEURS.pale} stroke={COULEURS.encre} strokeWidth={1.5} />
      ))}
      <rect x={14} y={HAUT + 66} width={122} height={2.5} fill={COULEURS.encre} />
    </>
  ),
  validation: (
    <>
      <circle cx={L / 2} cy={HAUT + 30} r={22} fill={COULEURS.orange} />
      <Coche x={L / 2 - 12} y={HAUT + 19} t={24} couleur={COULEURS.creme} />
      <Barre x={L / 2 - 36} y={HAUT + 62} l={72} couleur={COULEURS.pale} h={7} />
    </>
  ),
};

/**
 * Mini-maquette d'écran d'une étape (L10) : cadre d'écran arrondi au filet COULEURS.encre, barre du haut à trois points, et le contenu de l'écran
 * choisi par le code (`maquettesDesEtapes`). SVG maison, sans aucun texte : à poser dans l'enveloppe `Dessin`.
 */
export function MiniMaquette({ maquette }: { maquette: Maquette }) {
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-hidden style={{ display: "block" }}>
      <rect x={1.5} y={1.5} width={L - 3} height={H - 3} rx={12} fill={COULEURS.blanc} stroke={COULEURS.encre} strokeWidth={3} />
      <path d={`M1.5 ${HAUT - 6} V13.5 A12 12 0 0 1 13.5 1.5 H${L - 13.5} A12 12 0 0 1 ${L - 1.5} 13.5 V${HAUT - 6} Z`} fill={COULEURS.encre} />
      {[12, 22, 32].map((x) => (
        <circle key={x} cx={x} cy={(HAUT - 4) / 2 + 1} r={3} fill={x === 12 ? COULEURS.orange : COULEURS.creme} />
      ))}
      {ECRANS[maquette]}
    </svg>
  );
}
