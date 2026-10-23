/**
 * SOUS-TITRES FACE CAMÉRA (plan v4 L6, B.22). Styles déjà décidés : Karaoké en base, Minimal, Impact et Bandeau en
 * accents ; mot-clé orange en 3 tailles ; crème #F6EEE0. Groupes de 1 à 4 mots coupés par le sens, calés sur une
 * coupe à moins de 0,2 s, horodatages pris dans l'aligneur. Position : 55-72 % de la hauteur, sous la bouche ; dans
 * l'écran partagé, dans la moitié basse sous la bouche (finitions du 10/10 : à la jonction, la ligne masquait la carte).
 */
import type { OptionsGroupement } from "../sous-titres/groupement";
import { sourceYMoitieBasse } from "./cadrage";

export const SOUS_TITRES_FACECAM = {
  base: "karaoke" as const,
  accents: ["minimal", "impact", "bandeau"] as const,
  couleurTexte: "#F6EEE0",
  /** Centre de la ligne : 55 à 72 % de la hauteur. */
  positionPct: [55, 72] as const,
  /** Centre par défaut quand la position de la bouche est inconnue. */
  positionParDefautPct: 62,
  /** Écart sous la bouche (en % de la hauteur) pour ne jamais la couvrir. */
  sousLaBouchePct: 9,
  /** Calage sur une coupe à moins de 0,2 s (B.22). */
  fenetreCoupeSec: 0.2,
} as const;

/** Options de groupement face caméra : 1 à 4 mots, coupés par le sens (mêmes règles typographiques que l'avocat). */
export const GROUPEMENT_FACECAM: Partial<OptionsGroupement> = { motsMin: 1, motsMax: 4 };

/**
 * Centre vertical de la ligne (% de la hauteur) d'après la bouche la plus basse de la vidéo (% de la hauteur,
 * piste du visage) : juste sous la bouche, borné à 55-72 %.
 */
export function positionSousTitresFacecam(bouchePct?: number): number {
  const [min, max] = SOUS_TITRES_FACECAM.positionPct;
  if (bouchePct === undefined || !Number.isFinite(bouchePct)) return SOUS_TITRES_FACECAM.positionParDefautPct;
  return Math.round(Math.min(max, Math.max(min, bouchePct + SOUS_TITRES_FACECAM.sousLaBouchePct)) * 10) / 10;
}

/** Centre (%) de la jonction d'un écran partagé : la limite haute / basse (50 % en 9:16, 45 % en 4:5 et 1:1). */
export function centreJonctionPct(hauteurHaut: number, hauteurImage: number): number {
  return Math.round((hauteurHaut / hauteurImage) * 1000) / 10;
}

/** Hauteur d'une ligne de sous-titres face caméra (px, lettre de 70 px et interligne). */
const LIGNE_SOUS_TITRES_PX = 84;

/**
 * Centre (%) de la ligne des sous-titres pendant un écran partagé haut / bas (finitions du 10/10). Avant : à la
 * JONCTION, la ligne masquait la dernière ligne de la carte (« Les chiffres qui arrivent trop tard »). Maintenant : dans
 * la moitié basse, sous la bouche de la personne telle qu'elle est posée (yeux à 37,5 % de la demi-hauteur), sur le
 * menton et le haut du torse — jamais sur la bouche ni sur la carte ; bornée à la moitié basse (air sous la jonction)
 * et au-dessus du bas de l'image.
 */
export function ligneSousTitresEcranPartage(visage: { yeuxPct?: number; bouchePct?: number } | undefined, hauteurHaut: number, hauteurImage: number): number {
  const yeuxPct = visage?.yeuxPct ?? 33;
  const bouchePct = visage?.bouchePct ?? yeuxPct + 12;
  const sourceY = sourceYMoitieBasse({ yeuxY: (yeuxPct / 100) * hauteurImage }, hauteurImage, hauteurImage - hauteurHaut);
  const boucheEcran = (bouchePct / 100) * hauteurImage - sourceY + hauteurHaut;
  const voulu = boucheEcran + (SOUS_TITRES_FACECAM.sousLaBouchePct / 100) * hauteurImage;
  const min = hauteurHaut + LIGNE_SOUS_TITRES_PX / 2 + 0.02 * hauteurImage;
  const max = hauteurImage - LIGNE_SOUS_TITRES_PX / 2 - 0.06 * hauteurImage;
  return Math.round((Math.min(max, Math.max(min, voulu)) / hauteurImage) * 1000) / 10;
}

/** Les textes d'une carte tels qu'affichés (titres, sur-titres, mots, points), pour ne pas les répéter en sous-titre. */
function textesDeCarte(donnees: unknown): string[] {
  if (typeof donnees === "string") return [donnees];
  if (Array.isArray(donnees)) return donnees.flatMap(textesDeCarte);
  if (donnees && typeof donnees === "object")
    return Object.entries(donnees as Record<string, unknown>).flatMap(([cle, v]) => (["icone", "variante", "motCle", "modele"].includes(cle) ? [] : textesDeCarte(v)));
  return [];
}

/**
 * Textes déjà affichés pendant une carte et que les sous-titres ne doivent pas répéter (finitions du 10/10) : le titre
 * (appel à l'action « Réservez votre appel diagnostic gratuit », en moitié haute comme en plein écran) et toute carte
 * plein écran (le visage n'est plus là, la carte parle). Les listes en écran partagé gardent leurs sous-titres.
 */
export function textesAffichesDesCartes(cartes: { debutSec: number; finSec: number; disposition: "plein-ecran" | "moitie-haute"; carte?: { modele: string; donnees: unknown } }[]): { debutSec: number; finSec: number; texte: string }[] {
  return cartes.flatMap((c) => {
    if (!c.carte || (c.disposition !== "plein-ecran" && c.carte.modele !== "titre" && c.carte.modele !== "titre-plein-ecran")) return [];
    const texte = textesDeCarte(c.carte.donnees).join(" ").replace(/\*/g, "").trim();
    return texte ? [{ debutSec: c.debutSec, finSec: c.finSec, texte }] : [];
  });
}
