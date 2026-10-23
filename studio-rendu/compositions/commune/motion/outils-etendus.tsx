/**
 * OUTILS COMMUNS DES MODÈLES 7 À 13 (lot F2), dans les deux styles : valeurs formatées, mise en avant d'un graphique,
 * tracés vectoriels propres aux nouveaux modèles (repère de lieu, coche) et image d'une capture. Tout reste dans la
 * charte (jetons de la brique `motion`) ; rien ici ne modifie le noyau des 6 modèles validés.
 */
import { Img } from "remotion";
import { CAPTURE_EXEMPLE } from "../../../../src/briques/motion/exemples-axion-etendus";
import type { DonneesGraphique } from "../../../../src/briques/motion/types-etendus";
import { formaterNombre } from "./noyau";
import captureExemple from "./exemples/capture-tableau-de-bord.png";

/** Valeur et unité à la française : « 9 h », « 38 % » (espace fine insécable), « 14 salariés ». */
export function texteValeur(valeur: number, unite?: string, decimales = 0): string {
  const n = formaterNombre(valeur, decimales);
  if (!unite) return n;
  return unite === "%" ? `${n} %` : `${n} ${unite}`;
}

/** Unité d'un graphique (camembert sans unité : « % »). */
export const uniteGraphique = (d: DonneesGraphique) => d.unite ?? (d.variante === "camembert" ? "%" : undefined);

/** Index mis en avant : celui demandé, sinon la plus grande valeur (barres, camembert) ou la dernière (courbe). */
export function indexFort(d: DonneesGraphique): number {
  if (d.miseEnAvant !== undefined && d.miseEnAvant < d.series.length) return d.miseEnAvant;
  if (d.variante === "courbe") return d.series.length - 1;
  return d.series.reduce((m, s, i, a) => (s.valeur > a[m].valeur ? i : m), 0);
}

/** Instants des valeurs (s) : ceux de l'aligneur, sinon répartis après le titre ; croissants, 0,3 s d'écart au moins. */
export function heuresSeries(d: DonneesGraphique, debut: number, fin: number): number[] {
  const n = d.series.length;
  let dernier = debut - 0.3;
  return d.series.map((s, i) => {
    const v = s.aSec ?? debut + ((fin - debut) * i) / Math.max(1, n - 1);
    dernier = Math.max(dernier + 0.3, v);
    return dernier;
  });
}

/** Repère de lieu (tracé Lucide « map-pin », ISC) : absent du jeu d'icônes généré, dessiné ici. */
export const TRACES_REPERE = { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", cercle: { cx: 12, cy: 10, r: 3 } } as const;

/** Adresse lisible par le rendu d'une capture (l'exemple de la planche est fourni avec les compositions). */
export function adresseCapture(src: string): string {
  return src === CAPTURE_EXEMPLE ? captureExemple : src;
}

/** Image de la capture, couvrant son cadre sans déformation (Remotion attend son chargement). */
export function ImageCapture({ src, style }: { src: string; style?: React.CSSProperties }) {
  return <Img src={adresseCapture(src)} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", ...style }} />;
}

/**
 * Taille d'un titre qui laisse sa place au contenu : la plus grande des tailles proposées dont la hauteur mesurée tient
 * dans `hauteurMax` (moitié haute de l'écran partagé : le titre se resserre au lieu de pousser le contenu hors cadre).
 * Les tailles proposées ne descendent jamais sous la légende (3 % de la hauteur de la vidéo).
 */
export function tailleTitreAjustee(tailles: number[], hauteur: (taille: number) => number, hauteurMax: number): number {
  for (const t of tailles) if (hauteur(t) <= hauteurMax) return t;
  return tailles[tailles.length - 1];
}
