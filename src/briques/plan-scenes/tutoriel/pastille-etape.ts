/**
 * PASTILLE « Étape N/M · libellé » DU TUTORIEL (G5-02) — géométrie PURE, sans React ni import `@/…`.
 * Le dessin est `PastilleEtape.tsx` (Manrope). Couleurs = NOMS de jetons de la charte, jamais de valeur hexadécimale.
 * Inscrite nulle part (pas de catalogue) : éteinte. Dossier lu par le rendu (déjà copié : `src/briques/plan-scenes/`).
 */
import type { RectanglePx, ToilePx } from "./cadre-zone";

/** Noms de jetons de `SUR_CLAIR` (charte), résolus par le dessin. */
export interface CouleursPastille {
  fond: "accent";
  texte: "fond";
}

export interface PastilleEtapePx extends RectanglePx {
  /** « Étape 2/5 · Ouvrir les réglages » (libellé tronqué par « … » si besoin). */
  texte: string;
  taillePolice: number;
  rayon: number;
  couleurs: CouleursPastille;
}

export interface OptionsPastille {
  /** Marge à la toile en px (défaut 48, plafonnée au tiers de la largeur). */
  marge?: number;
  /** Taille de police en px (défaut : 3 % de la largeur, entre 22 et 48). */
  taillePolice?: number;
  /** Nombre maximal de caractères du libellé avant « … » (défaut 40). */
  libelleMax?: number;
}

export const MARGE_PASTILLE_DEFAUT = 48;
export const LIBELLE_MAX_DEFAUT = 40;
const LARGEUR_CARACTERE = 0.58; // largeur moyenne d'un caractère Manrope, en fraction de la taille
const RELIEF = { x: 0.9, y: 0.55 }; // remplissage horizontal / vertical, en fraction de la taille

/** Tronque proprement (sur un mot si possible) avec « … » ; ne dépasse jamais `max` caractères. */
export function tronquerLibelle(libelle: string, max: number): string {
  const propre = libelle.replace(/\s+/g, " ").trim();
  const m = Math.max(1, Math.floor(max));
  if (propre.length <= m) return propre;
  if (m === 1) return "…";
  let coupe = propre.slice(0, m - 1).trimEnd();
  const espace = coupe.lastIndexOf(" ");
  if (espace >= (m - 1) / 2) coupe = coupe.slice(0, espace).trimEnd();
  return `${coupe}…`;
}

/** Pastille en haut à gauche de la toile, bornée à la toile. `null` si étape/total invalides ou toile vide. */
export function pastilleEtape(
  etape: number,
  total: number,
  libelle: string,
  toile: ToilePx,
  options?: OptionsPastille,
): PastilleEtapePx | null {
  if (![etape, total, toile.largeur, toile.hauteur].every(Number.isFinite)) return null;
  if (!Number.isInteger(etape) || !Number.isInteger(total) || etape < 1 || total < 1 || etape > total) return null;
  if (toile.largeur <= 0 || toile.hauteur <= 0) return null;

  const demande = options?.taillePolice;
  const base = typeof demande === "number" && Number.isFinite(demande) && demande > 0 ? demande : toile.largeur * 0.03;
  const taillePolice = Math.round(Math.min(48, Math.max(22, base)));
  const libelleMax = options?.libelleMax !== undefined && Number.isFinite(options.libelleMax) ? options.libelleMax : LIBELLE_MAX_DEFAUT;
  const margeDemandee = options?.marge;
  const marge = Math.round(
    Math.min(
      typeof margeDemandee === "number" && Number.isFinite(margeDemandee) && margeDemandee >= 0 ? margeDemandee : MARGE_PASTILLE_DEFAUT,
      toile.largeur / 3,
      toile.hauteur / 3,
    ),
  );

  const debut = `Étape ${etape}/${total}`;
  const propre = libelle.replace(/\s+/g, " ").trim();
  const placeMax = Math.max(1, Math.floor((toile.largeur - 2 * marge) / (taillePolice * LARGEUR_CARACTERE) - 2 * RELIEF.x));
  const reste = Math.min(libelleMax, placeMax - debut.length - 3);
  const texte = propre && reste >= 1 ? `${debut} · ${tronquerLibelle(propre, reste)}` : debut;

  const largeurVoulue = Math.round(texte.length * taillePolice * LARGEUR_CARACTERE + 2 * RELIEF.x * taillePolice);
  const hauteurVoulue = Math.round(taillePolice * (1 + 2 * RELIEF.y));
  const largeur = Math.min(largeurVoulue, Math.max(1, toile.largeur - 2 * marge));
  const hauteur = Math.min(hauteurVoulue, Math.max(1, toile.hauteur - 2 * marge));
  return {
    x: marge,
    y: marge,
    largeur,
    hauteur,
    texte,
    taillePolice,
    rayon: Math.round(hauteur / 2),
    couleurs: { fond: "accent", texte: "fond" },
  };
}
