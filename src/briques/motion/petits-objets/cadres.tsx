/** PETITS OBJETS — cadres (famille trait) : rectangle, quatre coins (viseur), cadre de passage. Pièces pures, non inscrites. Tracé par `<TraceSvg>`. Imports relatifs seulement. */
import type { JSX } from "react";
import { progres } from "../courbes";
import { DUREES, FPS_MOTION } from "../jetons";
import { DUREE_SEC, SURFACE_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { tremblement } from "./tremblement";
import { TraceSvg } from "./TraceSvg";

/** Boîte, en % de la toile. */
export interface BoiteCadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
/** Cadre de passage : boîte de départ + boîte d'arrivée. */
export interface BoiteCadrePassage extends BoiteCadre {
  vers: BoiteCadre;
}

const TOILE = { largeur: 1080, hauteur: 1920 } as const;

function lireBoite(p: unknown): BoiteCadre | null {
  if (typeof p !== "object" || p === null) return null;
  const { x, y, largeur, hauteur } = p as Record<string, unknown>;
  if (![x, y, largeur, hauteur].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const b: BoiteCadre = { x: x as number, y: y as number, largeur: largeur as number, hauteur: hauteur as number };
  if (b.largeur <= 0 || b.hauteur <= 0 || b.x < 0 || b.y < 0 || b.x + b.largeur > 100 || b.y + b.hauteur > 100) return null;
  if ((b.largeur * b.hauteur) / 10000 > SURFACE_MAX) return null;
  return b;
}

function lirePassage(p: unknown): BoiteCadrePassage | null {
  const a = lireBoite(p);
  if (!a) return null;
  const vers = lireBoite((p as Record<string, unknown>).vers);
  return vers ? { ...a, vers } : null;
}

const px = (b: BoiteCadre) => ({
  x: (b.x * TOILE.largeur) / 100,
  y: (b.y * TOILE.hauteur) / 100,
  l: (b.largeur * TOILE.largeur) / 100,
  h: (b.hauteur * TOILE.hauteur) / 100,
});

const f = (n: number) => n.toFixed(1);
const rayon = (l: number, h: number) => Math.min(28, l / 4, h / 4);

/** Rectangle à coins arrondis (quarts de courbe), un seul chemin fermé. */
export function cheminRectangle(x: number, y: number, l: number, h: number): string {
  const r = rayon(l, h);
  const [x2, y2] = [x + l, y + h];
  return `M ${f(x + r)} ${f(y)} L ${f(x2 - r)} ${f(y)} Q ${f(x2)} ${f(y)} ${f(x2)} ${f(y + r)} L ${f(x2)} ${f(y2 - r)} Q ${f(x2)} ${f(y2)} ${f(x2 - r)} ${f(y2)} L ${f(x + r)} ${f(y2)} Q ${f(x)} ${f(y2)} ${f(x)} ${f(y2 - r)} L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)}`;
}

/** Quatre équerres (viseur) : 4 sous-chemins, tracés ensemble. */
export function cheminCoins(x: number, y: number, l: number, h: number): string {
  const r = rayon(l, h);
  const c = Math.max(r, Math.min(l, h) * 0.22);
  const [x2, y2] = [x + l, y + h];
  return [
    `M ${f(x)} ${f(y + c)} L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} L ${f(x + c)} ${f(y)}`,
    `M ${f(x2 - c)} ${f(y)} L ${f(x2 - r)} ${f(y)} Q ${f(x2)} ${f(y)} ${f(x2)} ${f(y + r)} L ${f(x2)} ${f(y + c)}`,
    `M ${f(x2)} ${f(y2 - c)} L ${f(x2)} ${f(y2 - r)} Q ${f(x2)} ${f(y2)} ${f(x2 - r)} ${f(y2)} L ${f(x2 - c)} ${f(y2)}`,
    `M ${f(x + c)} ${f(y2)} L ${f(x + r)} ${f(y2)} Q ${f(x)} ${f(y2)} ${f(x)} ${f(y2 - r)} L ${f(x)} ${f(y2 - c)}`,
  ].join(" ");
}

const melange = (a: number, b: number, k: number) => a + (b - a) * k;

type Dessin = (x: number, y: number, l: number, h: number) => string;

/** Un chemin par coin : chacun porte son propre `pathLength={1}` pour être tracé à t = 1 en tenue. */
function rendu<P extends BoiteCadre>(dessin: Dessin, arrivee?: (p: P) => BoiteCadre, separe = false) {
  return function Rendu({ image, fps, dureeImages, fond, ton = "neutre", graine, parametres }: ProprietesObjet<P>): JSX.Element {
    const { trace, opacite } = phaseObjet(image, dureeImages);
    const p = parametres as P | null;
    const depart = p ? px(p) : { x: 0, y: 0, l: 1, h: 1 };
    const fin = p && arrivee ? px(arrivee(p)) : depart;
    /** Le cadre se trace, puis glisse (même durée, même courbe de la table commune). */
    const k = arrivee ? progres(image / FPS_MOTION, DUREES.entree, DUREES.entree) : 0;
    const x = melange(depart.x, fin.x, k), y = melange(depart.y, fin.y, k);
    const l = melange(depart.l, fin.l, k), h = melange(depart.h, fin.h, k);
    const t = tremblement(graine, image, fps);
    const d = dessin(x, y, l, h);
    return (
      <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
        {p ? (
          <g opacity={opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${t.angle.toFixed(2)} ${f(x + l / 2)} ${f(y + h / 2)})`}>
            {separe ? d.split(" M ").map((s, i) => <TraceSvg key={i} d={i === 0 ? s : `M ${s}`} t={trace} ton={ton} fond={fond} />) : <TraceSvg d={d} t={trace} ton={ton} fond={fond} />}
          </g>
        ) : null}
      </svg>
    );
  };
}

function definir<P extends BoiteCadre>(id: DefinitionObjet<P>["id"], valider: (p: unknown) => P | null, rendre: DefinitionObjet<P>["Rendu"], dureeMin: number, dureeMax: number): DefinitionObjet<P> {
  return { id, famille: "trait", capacite: "objet.trait", valider, toile: TOILE, dureeSec: { min: dureeMin, max: dureeMax }, donnees: "aucune", Rendu: rendre };
}

export const DEF_CADRE_RECTANGLE = definir<BoiteCadre>("objet-cadre-rectangle", lireBoite, rendu<BoiteCadre>(cheminRectangle), DUREE_SEC.min, 2.5);
/** Les quatre équerres sont dessinées par 4 `<TraceSvg>` (4 sous-chemins, tracés ensemble). */
export const DEF_CADRE_COINS = definir<BoiteCadre>("objet-cadre-coins", lireBoite, rendu<BoiteCadre>(cheminCoins, undefined, true), DUREE_SEC.min, 2.5);
/** Trace (0,42 s) puis glisse (0,42 s) puis tient ≥ 6 images de sortie : durée minimale 1,4 s. */
export const DEF_CADRE_PASSAGE = definir<BoiteCadrePassage>("objet-cadre-passage", lirePassage, rendu<BoiteCadrePassage>(cheminRectangle, (p) => p.vers), 1.4, 3);

/** Données de planche (C9-39/C9-40) : entrées valides. */
export const EXEMPLES_CADRES = {
  rectangle: [{ x: 15, y: 70, largeur: 30, hauteur: 12 }, { x: 55, y: 72, largeur: 25, hauteur: 10 }],
  coins: [{ x: 10, y: 72, largeur: 40, hauteur: 10 }, { x: 60, y: 72, largeur: 25, hauteur: 18 }],
  passage: [{ x: 10, y: 72, largeur: 30, hauteur: 10, vers: { x: 55, y: 72, largeur: 30, hauteur: 10 } }],
} as const satisfies Record<string, readonly (BoiteCadre | BoiteCadrePassage)[]>;
