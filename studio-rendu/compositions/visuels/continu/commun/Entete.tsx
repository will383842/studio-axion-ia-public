/**
 * En-tête d'une page, posé par le moteur (`[data-entete]`) : rubrique en pastille à gauche (point orange), marque « Axion-IA » en Instrument
 * Serif italique à droite. La marque reste à l'encre (ou crème sur une page sombre) : l'orange est réservé aux grands titres (≥ 64 px).
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { ENTETE, LARGEUR_PAGE, MARGE_SURE, TAILLES_CONTINU } from "../constantes-continu";
import { police, POLICE_SERIF, POLICE_TEXTE } from "./Primitives";

export function Entete({ index, rubrique, sombre }: { index: number; rubrique?: string; sombre: boolean }) {
  return (
    <div data-entete="" style={{ position: "absolute", left: index * LARGEUR_PAGE + MARGE_SURE, top: ENTETE.haut, width: LARGEUR_PAGE - 2 * MARGE_SURE, height: ENTETE.hauteur, display: "flex", justifyContent: "space-between", alignItems: "center", color: sombre ? C.creme : C.encre, zIndex: 10 }}>
      {rubrique ? (
        <span style={{ display: "inline-flex", gap: 12, alignItems: "center", ...police(700, TAILLES_CONTINU.chip, 1, POLICE_TEXTE), letterSpacing: "0.09em", textTransform: "uppercase", padding: "15px 24px", borderRadius: 999, background: sombre ? alpha(C.creme, 0.12) : alpha(C.encre, 0.075), whiteSpace: "nowrap" }}>
          <i style={{ width: 12, height: 12, borderRadius: "50%", background: C.orange, display: "block" }} />
          {rubrique}
        </span>
      ) : (
        <span />
      )}
      <span style={{ ...police(400, TAILLES_CONTINU.marque, 1, POLICE_SERIF, true), whiteSpace: "nowrap" }}>Axion-IA</span>
    </div>
  );
}
