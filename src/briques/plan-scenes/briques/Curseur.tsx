import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { adoucir, avecOpacite, CHARTE_AXION, entre, progression } from "../../jetons-motion";
import { BOITE_INCLUSE, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"curseur">;

/** Point du trajet à l'avancement `t` (0 → 1), réparti selon la longueur des segments. */
export function pointDuTrajet(trajet: P["trajet"], t: number): { x: number; y: number } {
  const seg = trajet.slice(1).map((b, i) => Math.hypot(b.x - trajet[i]!.x, b.y - trajet[i]!.y));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let reste = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (reste <= seg[i]! || i === seg.length - 1) {
      const u = seg[i]! ? Math.min(1, reste / seg[i]!) : 1;
      return { x: entre(trajet[i]!.x, trajet[i + 1]!.x, u), y: entre(trajet[i]!.y, trajet[i + 1]!.y, u) };
    }
    reste -= seg[i]!;
  }
  return trajet.at(-1)!;
}

/** Curseur de souris : déplacement lisse sur tout le trajet, clic doux (anneau qui s'efface) à l'arrivée. */
export function Curseur({ image, dureeImages, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const { largeur, hauteur } = TOILES.curseur;
  const duree = Math.max(1, Math.round(dureeImages * p.partDeplacement));
  const t = progression(image, 0, duree, adoucir);
  const pt = pointDuTrajet(p.trajet, t);
  const clic = p.clic ? progression(image, duree, 12, (x) => x) : 0;
  const enfonce = p.clic && clic > 0 && clic < 1 ? 1 - 0.08 * Math.sin(Math.PI * clic) : 1;
  const x = (pt.x / 100) * largeur;
  const y = (pt.y / 100) * hauteur;
  const couleurAnneau = fond === "noir" && accent === "orange" ? CHARTE_AXION.orange : CHARTE_AXION.terracotta;
  const remplissage = fond === "noir" ? CHARTE_AXION.ivoire : CHARTE_AXION.noir;
  const contour = fond === "noir" ? CHARTE_AXION.noir : CHARTE_AXION.ivoire;
  return (
    <div style={RACINE}>
      {clic > 0 && clic < 1 && (
        <span style={{ position: "absolute", left: round(x - 10 - 40 * clic), top: round(y - 10 - 40 * clic), width: round(20 + 80 * clic), height: round(20 + 80 * clic), borderRadius: "50%", border: `4px solid ${couleurAnneau}`, opacity: round(1 - clic), ...BOITE_INCLUSE }} />
      )}
      <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: "absolute", left: round(x), top: round(y), transform: `scale(${round(enfonce)})`, transformOrigin: "0 0", filter: `drop-shadow(0 4px 8px ${avecOpacite(CHARTE_AXION.noir, 0.25)})` }}>
        <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={remplissage} stroke={contour} strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
