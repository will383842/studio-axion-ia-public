/** PETITS OBJETS — entourages (famille trait) : cercle, ovale, double boucle. Pièces pures, non inscrites. Un seul chemin tracé par `<TraceSvg>`. Imports relatifs seulement. */
import type { JSX } from "react";
import { DUREE_SEC, SURFACE_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { tremblement } from "./tremblement";
import { TraceSvg, cheminCercleObjet } from "./TraceSvg";

/** Boîte à entourer, en % de la toile. */
export interface BoiteEntourage {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const TOILE = { largeur: 1080, hauteur: 1920 } as const;
/** Le tracé déborde de la boîte (jusqu'à ×1,64 en surface pour la double boucle, mesuré) : la boîte seule ne dépasse pas ce seuil pour que le tracé reste sous SURFACE_MAX. */
const SURFACE_BOITE_MAX = SURFACE_MAX * 0.6;
const RAPPORT_OVALE_MIN = 1.2;

function lireBoite(p: unknown): BoiteEntourage | null {
  if (typeof p !== "object" || p === null) return null;
  const { x, y, largeur, hauteur } = p as Record<string, unknown>;
  if (![x, y, largeur, hauteur].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const b = { x, y, largeur, hauteur } as BoiteEntourage;
  if (b.largeur <= 0 || b.hauteur <= 0 || b.x < 0 || b.y < 0 || b.x + b.largeur > 100 || b.y + b.hauteur > 100) return null;
  if ((b.largeur * b.hauteur) / 10000 > SURFACE_BOITE_MAX) return null;
  return b;
}

function lireOvale(p: unknown): BoiteEntourage | null {
  const b = lireBoite(p);
  if (!b) return null;
  const r = (b.largeur * TOILE.largeur) / (b.hauteur * TOILE.hauteur);
  return r >= RAPPORT_OVALE_MIN || r <= 1 / RAPPORT_OVALE_MIN ? b : null;
}

const px = (b: BoiteEntourage) => ({
  x: (b.x * TOILE.largeur) / 100,
  y: (b.y * TOILE.hauteur) / 100,
  l: (b.largeur * TOILE.largeur) / 100,
  h: (b.hauteur * TOILE.hauteur) / 100,
});

/** Deux tours décalés par la graine, un seul chemin continu (angle cumulé ≈ 2,2 tours). */
export function cheminDoubleBoucle(x: number, y: number, l: number, h: number, graine = 0): string {
  const N = 128;
  const decalage = 0.06 + aleaGraine(graine, 1) * 0.06;
  const depart = -110 + (aleaGraine(graine, 2) - 0.5) * 30;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const a = ((depart + k * 800) * Math.PI) / 180;
    const echelle = 1 + decalage * Math.sin(k * Math.PI * 4 + graine) + k * 0.12;
    const rx = (l / 2) * 1.12 * echelle + 6;
    const ry = (h / 2) * 1.22 * echelle + 6;
    pts.push(`${(x + l / 2 + Math.cos(a) * rx).toFixed(1)},${(y + h / 2 + Math.sin(a) * ry).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

type Dessin = (x: number, y: number, l: number, h: number, graine: number) => string;

function rendu(dessin: Dessin) {
  return function Rendu({ image, fps, dureeImages, fond, ton = "neutre", graine, parametres }: ProprietesObjet<BoiteEntourage>): JSX.Element {
    const { trace, opacite } = phaseObjet(image, dureeImages);
    const b = lireBoite(parametres);
    const { x, y, l, h } = px(b ?? { x: 0, y: 0, largeur: 1, hauteur: 1 });
    const t = tremblement(graine, image, fps);
    return (
      <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
        {b ? (
          <g opacity={opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${t.angle.toFixed(2)} ${(x + l / 2).toFixed(1)} ${(y + h / 2).toFixed(1)})`}>
            <TraceSvg d={dessin(x, y, l, h, graine)} t={trace} ton={ton} fond={fond} />
          </g>
        ) : null}
      </svg>
    );
  };
}

function definir(id: DefinitionObjet<BoiteEntourage>["id"], valider: (p: unknown) => BoiteEntourage | null, dessin: Dessin): DefinitionObjet<BoiteEntourage> {
  return { id, famille: "trait", capacite: "objet.trait", valider, toile: TOILE, dureeSec: { min: DUREE_SEC.min, max: 2 }, donnees: "aucune", Rendu: rendu(dessin) };
}

export const DEF_CERCLE = definir("objet-cercle", lireBoite, cheminCercleObjet);
export const DEF_OVALE = definir("objet-ovale", lireOvale, cheminCercleObjet);
export const DEF_DOUBLE_BOUCLE = definir("objet-double-boucle", lireBoite, cheminDoubleBoucle);

/** Données de planche (C9-39/C9-40) : entrées valides. */
export const EXEMPLES_ENTOURAGES = {
  cercle: [{ x: 15, y: 70, largeur: 20, hauteur: 12 }, { x: 50, y: 72, largeur: 25, hauteur: 10 }],
  ovale: [{ x: 10, y: 72, largeur: 40, hauteur: 8 }, { x: 60, y: 72, largeur: 15, hauteur: 20 }],
  doubleBoucle: [{ x: 20, y: 72, largeur: 30, hauteur: 12 }],
} as const satisfies Record<string, readonly BoiteEntourage[]>;
