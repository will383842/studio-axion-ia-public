// Profils par réseau (LinkedIn, Instagram, Facebook) : données pures, sans dépendance.
// Copié tel quel dans l'image studio-rendu : imports relatifs seulement, rien d'autre.
export type Reseau = "linkedin" | "instagram" | "facebook";
export type Cadre = "linkedin" | "meta";

export interface Rect {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  nom: string;
  fiabilite: "mesure-tiers-2026-09" | "hypothese" | "officiel";
}

export interface ProfilReseau {
  cadre: Cadre;
  format: { largeur: number; hauteur: number };
  livrable: "pdf" | "images";
  pagesMax: number;
  titreDocumentMax?: number;
  altMax: number;
  legendeMax: number;
  ratioApi?: { min: number; max: number };
}

const FORMAT = { largeur: 1080, hauteur: 1350 } as const;

export const PROFILS_RESEAUX: Record<Reseau, ProfilReseau> = {
  linkedin: {
    cadre: "linkedin",
    format: FORMAT,
    livrable: "pdf",
    pagesMax: 10,
    titreDocumentMax: 40,
    altMax: 125,
    legendeMax: 3000,
  },
  instagram: {
    cadre: "meta",
    format: FORMAT,
    livrable: "images",
    pagesMax: 10,
    altMax: 125,
    legendeMax: 2200,
    ratioApi: { min: 0.8, max: 1.91 },
  },
  facebook: {
    cadre: "meta",
    format: FORMAT,
    livrable: "images",
    pagesMax: 10,
    altMax: 125,
    legendeMax: 5000,
  },
};

const MESURE = "mesure-tiers-2026-09" as const;

const LINKEDIN_COMMUN: readonly Rect[] = [
  { x: 920, y: 560, largeur: 160, hauteur: 230, nom: "flecheSuivante", fiabilite: MESURE },
  { x: 860, y: 1080, largeur: 220, hauteur: 270, nom: "pleinEcran", fiabilite: MESURE },
];

const LINKEDIN_COUVERTURE: readonly Rect[] = [
  { x: 0, y: 0, largeur: 1080, hauteur: 170, nom: "pastilleTitre", fiabilite: MESURE },
  ...LINKEDIN_COMMUN,
];

const META_COUVERTURE: readonly Rect[] = [
  { x: 920, y: 0, largeur: 160, hauteur: 120, nom: "compteurInstagram", fiabilite: "hypothese" },
  { x: 0, y: 0, largeur: 40, hauteur: 1350, nom: "grilleGauche", fiabilite: "hypothese" },
  { x: 1040, y: 0, largeur: 40, hauteur: 1350, nom: "grilleDroite", fiabilite: "hypothese" },
  { x: 0, y: 0, largeur: 1080, hauteur: 135, nom: "carreFacebookHaut", fiabilite: "hypothese" },
  { x: 0, y: 1215, largeur: 1080, hauteur: 135, nom: "carreFacebookBas", fiabilite: "hypothese" },
];

export function cadreDe(reseau: Reseau): Cadre {
  return PROFILS_RESEAUX[reseau].cadre;
}

// index 0 = couverture (base 0).
export function zonesInterdites(cadre: Cadre, index: number): readonly Rect[] {
  if (cadre === "linkedin") return index === 0 ? LINKEDIN_COUVERTURE : LINKEDIN_COMMUN;
  return index === 0 ? META_COUVERTURE : [];
}

type RectLike = { x: number; y: number; largeur: number; hauteur: number };

// Les bords qui se touchent ne comptent pas comme une intersection.
export function intersecte(a: RectLike, b: RectLike): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

export function ratioPermisInstagram(largeur: number, hauteur: number): boolean {
  if (!(largeur > 0) || !(hauteur > 0)) return false;
  const ratio = largeur / hauteur;
  const { min, max } = PROFILS_RESEAUX.instagram.ratioApi!;
  return ratio >= min && ratio <= max;
}

export function retraitCouverture(_cadre: Cadre): { haut: number; bas: number } {
  return { haut: 170, bas: 135 };
}
