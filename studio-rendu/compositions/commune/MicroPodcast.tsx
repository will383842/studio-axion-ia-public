/**
 * MICRO DE PODCAST DESSINÉ (lot M4b ; plan B.3) : utilisé tant que Will n'a pas d'image détourée de son micro.
 * Défaut corrigé (démonstration M4) : un rectangle gris strié, flou et coupé par le bord, qu'on ne reconnaissait pas.
 * Ici : un micro dynamique de studio (capsule à mousse orientée vers la bouche, corps, étrier et sa molette, pied),
 * légèrement incliné vers l'orateur, avec le liseré orange de la lumière de contour sur le dessus.
 *
 * Dessiné dans la boîte de l'accessoire (`boiteAccessoire`, cadre source) : la capsule en occupe le haut
 * (`MICRO_DESSINE.capsuleRatio`), le pied descend jusqu'au bas de la boîte, donc jusqu'au bas du cadre.
 * `versLaGauche` : la capsule regarde vers la gauche (orateur à gauche du micro, regard vers la droite).
 */
import { MICRO_DESSINE } from "../../../src/briques/composition/scene";

/** Lumière de contour : orange de la charte (sur le fond sombre du plateau). */
const COULEUR_LUMIERE = "#D97757";
/** Matières réalistes (métal, mousse et grille du micro), nommées par rôle ; gris neutres sans teinte bleue : ombrage d'une même matière. */
const MATIERE_METAL_CORPS_HAUT = "#60605F";
const MATIERE_METAL_CORPS_EPAULE = "#2C2C2B";
const MATIERE_METAL_CORPS_MILIEU = "#181817";
const MATIERE_METAL_CORPS_BAS = "#0F0F0E";
const MATIERE_MOUSSE_HAUT = "#3B3B3A";
const MATIERE_MOUSSE_MILIEU = "#20201F";
const MATIERE_MOUSSE_BAS = "#0C0C0B";
const MATIERE_METAL_PIED_BORD = "#10100F";
const MATIERE_METAL_PIED_CENTRE = "#3D3D3C";
const MATIERE_METAL_ETRIER_ARRIERE = "#151514";
const MATIERE_GRILLE_POINT_CLAIR = "#2F2F2E";
const MATIERE_GRILLE_POINT_SOMBRE = "#272726";
const MATIERE_METAL_PIED_SOCLE = "#1C1C1B";
const MATIERE_METAL_CORPS_EMBOUT = "#282827";
const MATIERE_METAL_BAGUE = "#4D4D4C";
const MATIERE_METAL_ETRIER_AVANT = "#2D2D2C";
const MATIERE_METAL_MOLETTE = "#414140";
const MATIERE_METAL_MOLETTE_CENTRE = "#1B1B1A";
const MATIERE_METAL_REFLET = "#8F8F8E";

export function MicroPodcast({ rapportHauteur, versLaGauche = true, lumiere = COULEUR_LUMIERE }: { rapportHauteur: number; versLaGauche?: boolean; lumiere?: string }) {
  const L = 200;
  const H = Math.max(L * MICRO_DESSINE.capsuleRatio + 10, L * rapportHauteur);
  const cy = 62;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="micro-corps" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={MATIERE_METAL_CORPS_HAUT} />
          <stop offset="0.18" stopColor={MATIERE_METAL_CORPS_EPAULE} />
          <stop offset="0.7" stopColor={MATIERE_METAL_CORPS_MILIEU} />
          <stop offset="1" stopColor={MATIERE_METAL_CORPS_BAS} />
        </linearGradient>
        <linearGradient id="micro-mousse" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={MATIERE_MOUSSE_HAUT} />
          <stop offset="0.25" stopColor={MATIERE_MOUSSE_MILIEU} />
          <stop offset="1" stopColor={MATIERE_MOUSSE_BAS} />
        </linearGradient>
        <linearGradient id="micro-pied" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={MATIERE_METAL_PIED_BORD} />
          <stop offset="0.45" stopColor={MATIERE_METAL_PIED_CENTRE} />
          <stop offset="1" stopColor={MATIERE_METAL_ETRIER_ARRIERE} />
        </linearGradient>
        <pattern id="micro-grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill={MATIERE_GRILLE_POINT_CLAIR} />
          <circle cx="4.5" cy="4.5" r="0.9" fill={MATIERE_GRILLE_POINT_SOMBRE} />
        </pattern>
      </defs>
      <g transform={versLaGauche ? undefined : `translate(${L} 0) scale(-1 1)`}>
        {/* Pied : du dessous de l'étrier jusqu'au bas de la boîte (bas du cadre). */}
        <rect x="112" y={cy + 40} width="13" height={H - cy - 40} rx="3" fill="url(#micro-pied)" />
        <rect x="104" y={cy + 46} width="29" height="10" rx="4" fill={MATIERE_METAL_PIED_SOCLE} />
        {/* Capsule, inclinée de 8° vers la bouche. */}
        <g transform={`rotate(8 118 ${cy})`}>
          {/* Étrier (côté caché), derrière le corps. */}
          <rect x="104" y={cy - 50} width="28" height="96" rx="10" fill={MATIERE_METAL_ETRIER_ARRIERE} />
          {/* Corps. */}
          <rect x="58" y={cy - 38} width="132" height="76" rx="30" fill="url(#micro-corps)" />
          <rect x="176" y={cy - 30} width="14" height="60" rx="6" fill={MATIERE_METAL_CORPS_EMBOUT} />
          {/* Bague entre la mousse et le corps. */}
          <rect x="62" y={cy - 40} width="12" height="80" rx="4" fill={MATIERE_METAL_BAGUE} />
          {/* Mousse anti-souffle, face à la bouche. */}
          <rect x="6" y={cy - 44} width="64" height="88" rx="38" fill="url(#micro-mousse)" />
          <rect x="6" y={cy - 44} width="64" height="88" rx="38" fill="url(#micro-grain)" opacity="0.9" />
          {/* Étrier (côté visible) et sa molette. */}
          <rect x="106" y={cy - 48} width="24" height="92" rx="9" fill={MATIERE_METAL_ETRIER_AVANT} />
          <circle cx="118" cy={cy} r="14" fill={MATIERE_METAL_MOLETTE} />
          <circle cx="118" cy={cy} r="7" fill={MATIERE_METAL_MOLETTE_CENTRE} />
          {/* Liseré de la lumière de contour (dessus de la capsule). */}
          <path d={`M 26 ${cy - 42} Q 40 ${cy - 47} 60 ${cy - 44} L 170 ${cy - 37}`} stroke={lumiere} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
          <path d={`M 80 ${cy - 35} L 168 ${cy - 31}`} stroke={MATIERE_METAL_REFLET} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        </g>
      </g>
    </svg>
  );
}
