/**
 * PASSAGES DE LA DÉMO FACECAM (G3-03) : le dessin lit, image par image, la mise en page ET le recadrage du moment. La
 * logique (passages valides, dispositions) vit dans `mise-en-page.ts` (G3-02) ; ici on ne fait que choisir quoi dessiner.
 * Champ `passages` absent, vide, ou instant hors de tout passage : les propriétés rendues telles quelles (mêmes objets,
 * moitié / moitié actuelle). N'importe que `mise-en-page.ts` et `proprietes.ts` (seuls copiés par le Dockerfile du rendu).
 */
import { miseEnPageA, normaliserPassages, type MiseEnPageDemo, type RectPx } from "../../../src/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "../../../src/moteurs/montage-demo-facecam/proprietes";

type Entree = Pick<ProprietesDemoFacecam, "miseEnPage" | "passages">;
type EntreeCadrage = Entree & Pick<ProprietesDemoFacecam, "recadrageEcran" | "recadrageFacecam" | "sourceEcran" | "sourceFacecam">;

/** Mise en page à dessiner à l'instant `ms`. Éteint = `p.miseEnPage`, même objet. */
export function miseEnPageDuMoment(p: Entree, ms: number): MiseEnPageDemo {
  const actif = normaliserPassages(p.passages).find((x) => ms >= x.debutMs && ms < x.finMs);
  // Hors de tout passage (ou disposition « moitie ») : exactement la mise en page des propriétés.
  return !actif || actif.disposition === "moitie" ? p.miseEnPage : miseEnPageA(p.miseEnPage.ratio, p.passages, ms);
}

/**
 * Recadrage aux proportions de la boîte du moment : même centre que le recadrage moitié / moitié, plus grande région
 * possible aux nouvelles proportions (rien d'étiré, ni bande vide). La partie de source (gauche, droite, haut, bas) n'est
 * pas dans les propriétés : on la déduit — la région permise est l'intersection des moitiés qui contenaient déjà le
 * recadrage moitié / moitié (donc jamais l'autre partie d'une vidéo déjà partagée, quitte à zoomer un peu plus).
 */
function recadrerPour(source: { largeur: number; hauteur: number }, actuel: RectPx, boite: RectPx): RectPx {
  if (boite.largeur <= 0 || boite.hauteur <= 0 || actuel.largeur <= 0 || actuel.hauteur <= 0) return actuel;
  const E = 0.05; // `recadrage()` arrondit au centième : une région collée au bord peut le dépasser de quelques centièmes
  const { largeur: l, hauteur: h } = source;
  const zone = { x0: 0, y0: 0, x1: l, y1: h };
  if (actuel.x + actuel.largeur <= Math.floor(l / 2) + E) zone.x1 = Math.floor(l / 2);
  else if (actuel.x >= Math.ceil(l / 2) - E) zone.x0 = Math.ceil(l / 2);
  if (actuel.y + actuel.hauteur <= Math.floor(h / 2) + E) zone.y1 = Math.floor(h / 2);
  else if (actuel.y >= Math.ceil(h / 2) - E) zone.y0 = Math.ceil(h / 2);
  const zl = zone.x1 - zone.x0;
  const zh = zone.y1 - zone.y0;
  const rapport = boite.largeur / boite.hauteur;
  const largeur = Math.min(zl, zh * rapport);
  const hauteur = largeur / rapport;
  const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const x = borne(actuel.x + actuel.largeur / 2 - largeur / 2, zone.x0, zone.x1 - largeur);
  const y = borne(actuel.y + actuel.hauteur / 2 - hauteur / 2, zone.y0, zone.y1 - hauteur);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(x), y: r(y), largeur: r(largeur), hauteur: r(hauteur) };
}

/** Mise en page + recadrages à dessiner à l'instant `ms`. Éteint = les objets des propriétés, inchangés. */
export function cadrageDuMoment(p: EntreeCadrage, ms: number): { miseEnPage: MiseEnPageDemo; recadrageEcran: RectPx; recadrageFacecam: RectPx } {
  const miseEnPage = miseEnPageDuMoment(p, ms);
  if (miseEnPage === p.miseEnPage) return { miseEnPage, recadrageEcran: p.recadrageEcran, recadrageFacecam: p.recadrageFacecam };
  return {
    miseEnPage,
    recadrageEcran: recadrerPour(p.sourceEcran, p.recadrageEcran, miseEnPage.ecran),
    recadrageFacecam: recadrerPour(p.sourceFacecam, p.recadrageFacecam, miseEnPage.facecam),
  };
}
