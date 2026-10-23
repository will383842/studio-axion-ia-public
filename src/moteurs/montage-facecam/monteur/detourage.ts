/**
 * EFFETS À DÉTOURAGE, À LA DEMANDE SEULEMENT (plan facecam v4, B.16). PUR.
 *
 * Règle unique : jamais par défaut, à la demande, sans demande de confirmation.
 * - « Cache-moi / fais-moi revenir » (`masquerPersonne`) : fondu vers la PLAQUE VIDE (3 s de pièce vide filmées au
 *   début). Sans plaque, on reconstruit une médiane des images où Will a bougé ; si c'est impossible, on le dit.
 *   Aucun détourage n'est calculé : seule la plaque fond (jamais de fondu sur le visage lui-même).
 * - « Texte entre le mur et moi » (`texteDerriere`, A14) : segmentation MediaPipe affinée par différence avec la plaque,
 *   calculée sur les SEULES secondes demandées (route `/segmenter` du studio-aligneur).
 * - Pas de RVM (GPL-3) ni de MatAnyone.
 * - Bords ratés (mesures du masque, ou relecture Claude « bords-detourage ») : la variante SANS détourage est livrée,
 *   avec « Effet non réussi — Réessayer ».
 */
import type { PassageMonteur } from "./appliquer";

export const LIBELLE_EFFET_RATE = "Effet non réussi — Réessayer";

/** Ce que l'on sait de la pièce vide. */
export interface PlaqueVide {
  /** 3 s filmées sans Will au début (repérées à la réception). */
  filmee?: { debutSec: number; finSec: number };
  /** Part de l'image où Will a bougé assez pour reconstruire le fond par médiane (0 à 1). */
  couvertureMediane?: number;
}

/** Couverture du fond nécessaire pour une médiane propre (au-delà, il resterait une silhouette fantôme). */
export const COUVERTURE_MEDIANE_MIN = 0.97;

export type SourcePlaque = { source: "filmee"; debutSec: number; finSec: number } | { source: "mediane" } | { source: "aucune"; message: string };

export function sourcePlaque(p: PlaqueVide): SourcePlaque {
  if (p.filmee && p.filmee.finSec - p.filmee.debutSec >= 1) return { source: "filmee", ...p.filmee };
  if ((p.couvertureMediane ?? 0) >= COUVERTURE_MEDIANE_MIN) return { source: "mediane" };
  return { source: "aucune", message: "Impossible de vous faire disparaître : il manque la pièce vide. La prochaine fois, filmez 3 s sans vous au début." };
}

/** Demande de segmentation (route `/segmenter`), limitée aux secondes des effets « texte derrière ». */
export interface DemandeSegmentation {
  /** Plages de la PRISE à segmenter (marge de 0,3 s pour les fondus), fusionnées. */
  plages: { debutSec: number; finSec: number }[];
  /** Différence avec la plaque pour affiner le masque (si elle existe). */
  plaque: SourcePlaque["source"];
  modele: "mediapipe-selfie-multiclass";
}

const MARGE_SEC = 0.3;

export function demandeSegmentation(passages: PassageMonteur[], plaque: PlaqueVide, dureePriseSec: number): DemandeSegmentation | null {
  const plages = passages
    .filter((p) => p.detourage && !p.sansDetourage && p.operation.type === "texteDerriere")
    .map((p) => ({ debutSec: Math.max(0, p.ancre.debutPriseSec - MARGE_SEC), finSec: Math.min(dureePriseSec, p.ancre.finPriseSec + MARGE_SEC) }))
    .sort((a, b) => a.debutSec - b.debutSec);
  if (!plages.length) return null;
  const fusion: DemandeSegmentation["plages"] = [];
  for (const p of plages) {
    const der = fusion[fusion.length - 1];
    if (der && p.debutSec <= der.finSec) der.finSec = Math.max(der.finSec, p.finSec);
    else fusion.push({ ...p });
  }
  const s = sourcePlaque(plaque);
  return { plages: fusion, plaque: s.source, modele: "mediapipe-selfie-multiclass" };
}

/** Mesures du masque rendues par `/segmenter` (par plage). */
export interface MesuresMasque {
  /** Part des images où le contour saute de plus de 6 px d'une image à l'autre (0 à 1). */
  instabiliteContour: number;
  /** Part des images où la main ou les cheveux sortent du masque (différence avec la plaque) (0 à 1). */
  fuitesBords: number;
  /** Part des images sans personne détectée (0 à 1). */
  imagesSansPersonne: number;
}

export const SEUILS_BORDS = { instabiliteContour: 0.08, fuitesBords: 0.05, imagesSansPersonne: 0.02 } as const;

/** Les bords sont-ils assez bons pour livrer l'effet ? (Sinon : variante sans détourage.) */
export function bordsAcceptables(m: MesuresMasque): boolean {
  return m.instabiliteContour <= SEUILS_BORDS.instabiliteContour && m.fuitesBords <= SEUILS_BORDS.fuitesBords && m.imagesSansPersonne <= SEUILS_BORDS.imagesSansPersonne;
}

export interface DecisionEffet {
  passageId: string;
  livre: "avec-effet" | "sans-detourage" | "impossible";
  /** Phrase pour Will (absente : rien à dire). */
  message?: string;
  geste?: "Réessayer";
  /** Lot I2 : conseil simple pour le nouvel essai (« montrez la paume ouverte vers le haut »). */
  conseil?: string;
}

/**
 * Décide, pour chaque effet à détourage, ce qui est livré. `mesures` : par passage (texte derrière) ; `plaque` : pour
 * « cache-moi ». Une brique ratée n'empêche jamais la livraison : au pire, la variante sans l'effet.
 */
export function deciderEffets(passages: PassageMonteur[], plaque: PlaqueVide, mesures: Record<string, MesuresMasque | undefined>): DecisionEffet[] {
  const s = sourcePlaque(plaque);
  return passages
    .filter((p) => p.detourage)
    .map((p): DecisionEffet => {
      if (p.sansDetourage) return { passageId: p.id, livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" };
      if (p.operation.type === "masquerPersonne") {
        return s.source === "aucune" ? { passageId: p.id, livre: "impossible", message: s.message } : { passageId: p.id, livre: "avec-effet" };
      }
      const m = mesures[p.id];
      if (!m) return { passageId: p.id, livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" };
      return bordsAcceptables(m) ? { passageId: p.id, livre: "avec-effet" } : { passageId: p.id, livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" };
    });
}

/** « Réessayer » un effet raté : le passage redevient à détourer (une nouvelle segmentation sera demandée). */
export function reessayerEffet<T extends { id: string }>(passages: T[], passageId: string): T[] {
  return passages.map((p) => (p.id === passageId ? { ...p, sansDetourage: false } : p));
}
