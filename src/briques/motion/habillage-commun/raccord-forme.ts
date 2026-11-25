/**
 * Raccord par forme (X1-06). Choisit une paire de formes compatibles (cercle↔cercle, carré↔carte) et fabrique deux
 * chemins SVG de même structure (8 segments), prêts pour `interpolatePath` de `@remotion/paths` (MIT, déjà au dépôt).
 *
 * PUR : aucun hook, aucun hasard, aucune horloge, imports relatifs seulement (dossier lu par le rendu). Même entrée =
 * même chemin. Couleurs de la charte seulement. Jamais sur un plan avec visage. Branché par `plan-scenes/rendu.tsx` (BR-RACCORD-FORME-a),
 * qui n'a rien à dessiner tant que la porte `RACCORD_FORME_ACTIF` (cas concret) reste éteinte.
 */
import { CHARTE_AXION, type NomCouleurAxion } from "../../jetons-motion";

export const FORMES_RACCORD = ["cercle", "carre", "carte"] as const;
export type FormeRaccord = (typeof FORMES_RACCORD)[number];

export interface EntreeRaccordForme {
  de: FormeRaccord;
  vers: FormeRaccord;
  /** Vrai si le plan montre un visage : aucun raccord. */
  avecVisage: boolean;
  boite: { largeur: number; hauteur: number };
  couleur?: NomCouleurAxion;
}

export interface RaccordForme {
  de: FormeRaccord;
  vers: FormeRaccord;
  cheminDe: string;
  cheminVers: string;
  couleur: string;
}

const COMPATIBLES: ReadonlyArray<readonly [FormeRaccord, FormeRaccord]> = [
  ["cercle", "cercle"],
  ["carre", "carte"],
  ["carte", "carre"],
];

const r = (n: number) => Math.round(n * 100) / 100;
/** Poignée d'un huitième de cercle : 4/3 · tan(π/16). */
const K = 0.2652;

/** Demi-largeur et demi-hauteur de la forme dans la boîte. */
function demiTaille(forme: FormeRaccord, b: { largeur: number; hauteur: number }): [number, number] {
  const m = Math.min(b.largeur, b.hauteur);
  if (forme === "cercle") return [m * 0.3, m * 0.3];
  if (forme === "carre") return [m * 0.25, m * 0.25];
  return [b.largeur * 0.3, b.hauteur * 0.3];
}

/**
 * Huit points en partant du coin haut-gauche (sens horaire). Cercle : points tous les 45° ; rectangle : coins et milieux
 * de côtés. Huit segments cubiques dans les deux cas, donc morphose directe.
 */
function chemin(forme: FormeRaccord, b: { largeur: number; hauteur: number }): string {
  const [a, c] = demiTaille(forme, b);
  const cx = b.largeur / 2;
  const cy = b.hauteur / 2;
  let pts: Array<[number, number]>;
  let poignees: Array<[number, number]>; // vecteur sortant de chaque point
  if (forme === "cercle") {
    const angles = [-135, -90, -45, 0, 45, 90, 135, 180].map((d) => (d * Math.PI) / 180);
    pts = angles.map((t) => [cx + a * Math.cos(t), cy + c * Math.sin(t)]);
    poignees = angles.map((t) => [-Math.sin(t) * a * K, Math.cos(t) * c * K]);
  } else {
    pts = [
      [cx - a, cy - c], [cx, cy - c], [cx + a, cy - c], [cx + a, cy],
      [cx + a, cy + c], [cx, cy + c], [cx - a, cy + c], [cx - a, cy],
    ];
    const tiers = (dx: number, dy: number): [number, number] => [dx / 3, dy / 3];
    poignees = [
      tiers(a, 0), tiers(a, 0), tiers(0, c), tiers(0, c), tiers(-a, 0), tiers(-a, 0), tiers(0, -c), tiers(0, -c),
    ];
  }
  const n = pts.length;
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const o = poignees[i];
    const e = poignees[(i + 1) % n];
    // Poignée d'arrivée = opposée de la poignée sortante du point suivant.
    d += ` C ${r(p[0] + o[0])} ${r(p[1] + o[1])} ${r(q[0] - e[0])} ${r(q[1] - e[1])} ${r(q[0])} ${r(q[1])}`;
  }
  return `${d} Z`;
}

export function choisirRaccordForme(entree: EntreeRaccordForme): RaccordForme | null {
  if (entree.avecVisage) return null;
  const { de, vers, boite } = entree;
  if (!COMPATIBLES.some(([x, y]) => x === de && y === vers)) return null;
  const nom = entree.couleur ?? "terracotta";
  if (!Object.prototype.hasOwnProperty.call(CHARTE_AXION, nom)) return null;
  return { de, vers, cheminDe: chemin(de, boite), cheminVers: chemin(vers, boite), couleur: CHARTE_AXION[nom] };
}

/** Durée d'un raccord, en images (la forme est tracée de la première à la dernière). */
export const DUREE_RACCORD_IMAGES = 14;

const NOMBRE = /-?\d+(?:\.\d+)?/g;

/**
 * Chemin à l'avancement `t` (0 : forme de départ, 1 : forme d'arrivée, borné). Les deux chemins ont la même suite de
 * commandes (8 segments cubiques) : on interpole nombre à nombre, sans `@remotion/paths` (absent à la racine). PUR.
 */
export function cheminAuTemps(raccord: Pick<RaccordForme, "cheminDe" | "cheminVers">, t: number): string {
  if (!(t > 0)) return raccord.cheminDe;
  if (t >= 1) return raccord.cheminVers;
  const arrivee = raccord.cheminVers.match(NOMBRE) ?? [];
  let i = 0;
  return raccord.cheminDe.replace(NOMBRE, (x) => {
    const a = Number(x);
    const b = Number(arrivee[i++] ?? x);
    return String(r(a + (b - a) * t));
  });
}
