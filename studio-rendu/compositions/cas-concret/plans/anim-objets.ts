/**
 * L7 · ANIMATIONS DES OBJETS D'ÉTAPE (chantier « variété du motion ») : chaque objet de la banque a 3 animations — n° 0
 * = celle de la v4, au plan près ; n° 1 et 2 = deux variations sobres (ordre d'apparition des pièces, déploiement,
 * empilement, glissement des rangées, coche qui se dessine…). Les pièces, couleurs, polices et textes restent ceux de
 * la v4 : seul leur mouvement change, et rien ne bouge pendant qu'une coche se pose.
 *
 * Le numéro vient du `jeu` de l'écran (`animObjet`, tiré par la graine dans `variete.ts`) et passe à l'objet par son
 * contexte (`anim`). Absent, 0 ou illisible : l'animation de la v4, et le plan ne porte aucune clé de plus.
 *
 * PUR : ni `remotion` ni React.
 */
import { c01, doux, progres, rebond } from "./commun";

/** Animations par objet (n° 0 = v4). */
export const ANIMS_PAR_OBJET = 3;

/** Ce que les objets lisent en plus de leurs propriétés : le numéro d'animation tiré. */
export type AvecAnim = { anim?: number };

/** Numéro d'animation (0 à `n − 1`) lu dans les propriétés d'un objet ; absent ou illisible : 0 (la v4). */
export function animDe(p: object, n = ANIMS_PAR_OBJET): number {
  const a = (p as AvecAnim).anim;
  return typeof a === "number" && Number.isInteger(a) && a > 0 ? a % n : 0;
}

/** Mouvement d'une pièce, posé PAR-DESSUS son dessin de la v4 (repos : opacité 1, aucun décalage, échelle 1). */
export type Mouvement = { sorte: "mouvement"; opacite: number; dx: number; dy: number; echelleX: number; echelleY: number; rotation: number; origine?: string };

/** Un mouvement (valeurs absentes : celles du repos). */
export function bouger(m: Partial<Omit<Mouvement, "sorte">> = {}): Mouvement {
  return { sorte: "mouvement", opacite: c01(m.opacite ?? 1), dx: m.dx ?? 0, dy: m.dy ?? 0, echelleX: m.echelleX ?? 1, echelleY: m.echelleY ?? 1, rotation: m.rotation ?? 0, ...(m.origine ? { origine: m.origine } : {}) };
}

/** Vrai si le mouvement est au repos (la pièce est dessinée exactement comme dans la v4). */
export const auRepos = (m: Mouvement) => m.opacite === 1 && m.dx === 0 && m.dy === 0 && m.echelleX === 1 && m.echelleY === 1 && m.rotation === 0;

/** Arrivée d'une pièce : `x` de 0 à 1, depuis un décalage, une échelle et une rotation, avec un fondu rapide. */
export function arrivee(x: number, depuis: { dx?: number; dy?: number; echelle?: number; echelleX?: number; echelleY?: number; rotation?: number; origine?: string }, courbe: (x: number) => number = doux): Mouvement {
  const y = courbe(c01(x));
  const reste = 1 - y;
  const e = depuis.echelle ?? 1;
  return bouger({
    opacite: c01(x * 2.5),
    dx: (depuis.dx ?? 0) * reste,
    dy: (depuis.dy ?? 0) * reste,
    echelleX: 1 + ((depuis.echelleX ?? e) - 1) * reste,
    echelleY: 1 + ((depuis.echelleY ?? e) - 1) * reste,
    rotation: (depuis.rotation ?? 0) * reste,
    ...(depuis.origine ? { origine: depuis.origine } : {}),
  });
}

/** Petit surgissement avec rebond (pastille, puce) : de 60 % à 100 %, fondu rapide. */
export function surgie(x: number): Mouvement {
  const y = c01(x);
  const e = 0.6 + 0.4 * rebond(y);
  return bouger({ opacite: c01(y * 3), echelleX: e, echelleY: e });
}

/** Style CSS d'une pièce : son style de la v4 (`base`), plus le mouvement s'il y en a un (sinon `base` tel quel). */
export function styleMouvement(m: Mouvement | undefined, base: { opacity?: number; transform?: string } = {}): { opacity?: number; transform?: string; transformOrigin?: string } {
  if (!m) return base;
  const t = `translate(${m.dx}px, ${m.dy}px) rotate(${m.rotation}deg) scale(${m.echelleX}, ${m.echelleY})`;
  return { ...base, opacity: (base.opacity ?? 1) * m.opacite, transform: base.transform ? `${t} ${base.transform}` : t, ...(m.origine ? { transformOrigin: m.origine } : {}) };
}

/**
 * Coche qui se dessine (variante du surgissement) : le rond paraît en fondu, puis le trait court, puis le long.
 * `x` de 0 à 1. `trace` : part du tracé (0 à 1).
 */
export function cocheTracee(x: number) {
  const y = c01(x);
  return { opacite: c01(y * 4), echelle: 0.85 + 0.15 * doux(c01(y * 3)), rotation: 0, trace: doux(c01((y - 0.2) / 0.8)) };
}

/** Coche tracée au temps `t` d'une coche qui commence à `debut` et dure `duree` (s). */
export const cocheTraceeA = (t: number, debut: number, duree: number) => cocheTracee(progres(t, debut, duree));

/** Points de la coche dessinée, dans un carré de 100 × 100 (le rond qui la porte). */
export const POINTS_COCHE = "29,52 44,67 72,36";

/** Le mouvement porté par une pièce d'un plan (aucun : la pièce de la v4). */
export const mvt = (piece: object): Mouvement | undefined => (piece as { mouvement?: Mouvement }).mouvement;
/** Une valeur numérique facultative d'une pièce d'un plan (`trace`, `revele`…), lue sans dépendre de sa forme. */
export const valeurDe = (piece: object, cle: string): number | undefined => {
  const v = (piece as Record<string, unknown>)[cle];
  return typeof v === "number" ? v : undefined;
};
