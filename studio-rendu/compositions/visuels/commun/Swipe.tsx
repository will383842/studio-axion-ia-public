import { useContext } from "react";
import { chargerPoliceInter } from "../polices";
import { ContexteCadre, flecheVisible } from "./cadre";
import { COULEURS, POLICE_CORPS, TAILLE_SIGNATURE } from "./constantes";

function Fleche({ trait }: { trait: string }) {
  return (
    <svg width={80} height={36} viewBox="0 0 80 36" role="img" aria-hidden>
      <path d="M4 18 H72 M56 5 L74 18 L56 31" fill="none" stroke={trait} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pied de page, MÊME règle sur toutes les pages (couvertures et page sombre comprises, ART-1) : marque « Axion-IA » à gauche, points de
 * position AU CENTRE (x ≈ 540, loin des zones réservées), flèche vers la page suivante à droite (absente sur la dernière page, et dans le
 * cadre LinkedIn, H2 : sa propre flèche et son bouton plein écran recouvrent ce coin).
 * Points et flèche à l'encre (crème sur la page sombre) ; sur un bloc orange (`surOrange`), le point de la page courante passe en crème.
 */
export function Swipe({ index, total, sombre = false, surOrange = false, signature }: { index: number; total: number; sombre?: boolean; surOrange?: boolean; signature?: string }) {
  chargerPoliceInter();
  const trait = sombre ? COULEURS.creme : COULEURS.encre;
  const fleche = flecheVisible(index, total, useContext(ContexteCadre));
  const pas = 26;
  const largeurPoints = Math.max(1, total) * pas;
  const points = (
    <svg width={largeurPoints} height={26} viewBox={`0 0 ${largeurPoints} 26`} role="img" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <circle key={i} cx={i * pas + 13} cy={13} r={i === index ? 9 : 5} fill={i === index ? (surOrange ? COULEURS.creme : COULEURS.orange) : trait} />
      ))}
    </svg>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", height: 56 }}>
      <div style={{ flex: 1, whiteSpace: "nowrap", fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_SIGNATURE, letterSpacing: 1, color: trait }}>{signature}</div>
      {points}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{fleche && <Fleche trait={trait} />}</div>
    </div>
  );
}
