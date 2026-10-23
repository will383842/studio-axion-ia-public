import { COULEURS } from "./constantes";

/** Repère de défilement sans texte : points de position de la page et flèche vers la page suivante. */
export function Swipe({ index, total, sombre = false }: { index: number; total: number; sombre?: boolean }) {
  const trait = sombre ? COULEURS.creme : COULEURS.encre;
  const dernier = index >= total - 1;
  const pas = 30;
  const largeurPoints = Math.max(1, total) * pas;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height: 56 }}>
      <svg width={largeurPoints} height={30} viewBox={`0 0 ${largeurPoints} 30`} role="img" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <circle key={i} cx={i * pas + 15} cy={15} r={i === index ? 11 : 8} fill={i === index ? COULEURS.orange : trait} />
        ))}
      </svg>
      {!dernier && (
        <svg width={96} height={44} viewBox="0 0 96 44" role="img" aria-hidden>
          <path d="M6 22 H84 M62 4 L86 22 L62 40" fill="none" stroke={trait} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
