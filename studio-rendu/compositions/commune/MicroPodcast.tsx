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

export function MicroPodcast({ rapportHauteur, versLaGauche = true, lumiere = "#C65A2E" }: { rapportHauteur: number; versLaGauche?: boolean; lumiere?: string }) {
  const L = 200;
  const H = Math.max(L * MICRO_DESSINE.capsuleRatio + 10, L * rapportHauteur);
  const cy = 62;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="micro-corps" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5C6068" />
          <stop offset="0.18" stopColor="#2A2C31" />
          <stop offset="0.7" stopColor="#17181B" />
          <stop offset="1" stopColor="#0E0F11" />
        </linearGradient>
        <linearGradient id="micro-mousse" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3A3B40" />
          <stop offset="0.25" stopColor="#1F2023" />
          <stop offset="1" stopColor="#0C0C0E" />
        </linearGradient>
        <linearGradient id="micro-pied" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0F1012" />
          <stop offset="0.45" stopColor="#3A3D44" />
          <stop offset="1" stopColor="#141518" />
        </linearGradient>
        <pattern id="micro-grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#2E2F34" />
          <circle cx="4.5" cy="4.5" r="0.9" fill="#26272B" />
        </pattern>
      </defs>
      <g transform={versLaGauche ? undefined : `translate(${L} 0) scale(-1 1)`}>
        {/* Pied : du dessous de l'étrier jusqu'au bas de la boîte (bas du cadre). */}
        <rect x="112" y={cy + 40} width="13" height={H - cy - 40} rx="3" fill="url(#micro-pied)" />
        <rect x="104" y={cy + 46} width="29" height="10" rx="4" fill="#1B1C20" />
        {/* Capsule, inclinée de 8° vers la bouche. */}
        <g transform={`rotate(8 118 ${cy})`}>
          {/* Étrier (côté caché), derrière le corps. */}
          <rect x="104" y={cy - 50} width="28" height="96" rx="10" fill="#141518" />
          {/* Corps. */}
          <rect x="58" y={cy - 38} width="132" height="76" rx="30" fill="url(#micro-corps)" />
          <rect x="176" y={cy - 30} width="14" height="60" rx="6" fill="#26282D" />
          {/* Bague entre la mousse et le corps. */}
          <rect x="62" y={cy - 40} width="12" height="80" rx="4" fill="#4A4D54" />
          {/* Mousse anti-souffle, face à la bouche. */}
          <rect x="6" y={cy - 44} width="64" height="88" rx="38" fill="url(#micro-mousse)" />
          <rect x="6" y={cy - 44} width="64" height="88" rx="38" fill="url(#micro-grain)" opacity="0.9" />
          {/* Étrier (côté visible) et sa molette. */}
          <rect x="106" y={cy - 48} width="24" height="92" rx="9" fill="#2B2D33" />
          <circle cx="118" cy={cy} r="14" fill="#3E4148" />
          <circle cx="118" cy={cy} r="7" fill="#1A1B1F" />
          {/* Liseré de la lumière de contour (dessus de la capsule). */}
          <path d={`M 26 ${cy - 42} Q 40 ${cy - 47} 60 ${cy - 44} L 170 ${cy - 37}`} stroke={lumiere} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
          <path d={`M 80 ${cy - 35} L 168 ${cy - 31}`} stroke="#8A8F98" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        </g>
      </g>
    </svg>
  );
}
