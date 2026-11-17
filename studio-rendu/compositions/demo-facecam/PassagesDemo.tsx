/**
 * PASSAGES DE LA DÉMO FACECAM (G3-03) : le dessin lit, image par image, la mise en page du moment. La logique (passages
 * valides, dispositions) vit dans `mise-en-page.ts` (G3-02) ; ici on ne fait que choisir quelle mise en page dessiner.
 * Champ `passages` absent, vide, ou instant hors de tout passage : la mise en page des propriétés, rendue telle quelle
 * (moitié / moitié actuelle). N'importe que `mise-en-page.ts` et `proprietes.ts` (seuls copiés par le Dockerfile du rendu).
 */
import { miseEnPageA, type MiseEnPageDemo } from "../../../src/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "../../../src/moteurs/montage-demo-facecam/proprietes";

/** Mise en page à dessiner à l'instant `ms`. Éteint = `p.miseEnPage`, même objet. */
export function miseEnPageDuMoment(p: Pick<ProprietesDemoFacecam, "miseEnPage" | "passages">, ms: number): MiseEnPageDemo {
  if (!Array.isArray(p.passages) || p.passages.length === 0) return p.miseEnPage;
  const actuelle = miseEnPageA(p.miseEnPage.ratio, p.passages, ms);
  const base = miseEnPageA(p.miseEnPage.ratio, undefined, ms);
  // Hors de tout passage (ou disposition « moitie ») : on garde exactement la mise en page des propriétés.
  return JSON.stringify(actuelle) === JSON.stringify(base) ? p.miseEnPage : actuelle;
}
