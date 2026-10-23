import { COULEURS, POLICE_CORPS, TAILLE_SIGNATURE } from "./constantes";

function Fleche({ trait }: { trait: string }) {
  return (
    <svg width={96} height={44} viewBox="0 0 96 44" role="img" aria-hidden>
      <path d="M6 22 H84 M62 4 L86 22 L62 40" fill="none" stroke={trait} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Repère de défilement, MÊME règle sur toutes les pages : trois emplacements, signature (pages intérieures) à gauche, points de position
 * AU CENTRE (x ≈ 540, loin des zones réservées), flèche vers la page suivante à droite (absente sur la dernière page).
 */
export function Swipe({ index, total, sombre = false, signature }: { index: number; total: number; sombre?: boolean; signature?: string }) {
  const trait = sombre ? COULEURS.creme : COULEURS.encre;
  const dernier = index >= total - 1;
  const pas = 30;
  const largeurPoints = Math.max(1, total) * pas;
  const points = (
    <svg width={largeurPoints} height={30} viewBox={`0 0 ${largeurPoints} 30`} role="img" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <circle key={i} cx={i * pas + 15} cy={15} r={i === index ? 11 : 8} fill={i === index ? COULEURS.orange : trait} />
      ))}
    </svg>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", height: 56 }}>
      <div style={{ flex: 1, whiteSpace: "nowrap", fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_SIGNATURE, letterSpacing: 1, color: trait }}>{signature}</div>
      {points}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{!dernier && <Fleche trait={trait} />}</div>
    </div>
  );
}
