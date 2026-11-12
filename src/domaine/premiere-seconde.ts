/**
 * PREMIÈRE SECONDE (GV-VG-03) — contrôle pur, commun à tous les générateurs : une alerte, JAMAIS un échec.
 * Sur LinkedIn la vidéo démarre sans son : du texte doit se lire dès la première image, avec une accroche courte.
 * Ne mesure PAS l'image qui bouge ni le sujet visible (cela demanderait d'extraire des images au rendu).
 */
import type { AlerteQualite, SegmentSousTitres } from "./types";

/** Au-delà de ce délai (en secondes) sans rien d'écrit, la vidéo démarre « muette » à l'œil. */
export const SEUIL_TEXTE_SEC = 0.5;
/** Durée (en secondes) qu'on appelle « la première seconde ». */
export const FENETRE_SEC = 1;
/** Nombre de mots lisibles attendu dans la première seconde : de 3 à 6 (bornes comprises). */
export const MOTS_ACCROCHE: readonly [number, number] = [3, 6];
/** Début de chaque message : sert aussi à retrouver, puis remplacer, ces alertes à chaque passage. */
export const PREFIXE = "Première seconde : ";

export interface EncadrePremiereSeconde {
  de: number;
  a: number;
  /** Nombre de mots écrits dans l'encadré, s'il est connu. Inconnu : le contrôle P2 ne se prononce pas. */
  mots?: number;
}

const virgule = (n: number): string => String(Math.round(n * 10) / 10).replace(".", ",");

/** Contrôles P1 (rien d'écrit avant 0,5 s) et P2 (3 à 6 mots dans la première seconde). Aucun segment connu : aucune alerte. */
export function controlerPremiereSeconde(entree: { segments: SegmentSousTitres[]; encadre?: EncadrePremiereSeconde | null }): AlerteQualite[] {
  const segments = (entree.segments ?? []).filter((s) => s.mots?.length);
  if (!segments.length) return [];
  const encadre = entree.encadre ?? null;
  // Un encadré affiché dès la première image (commencé à 0) compte comme du texte lisible.
  const encadreDes0 = !!encadre && encadre.de <= 0 && encadre.a > 0;
  const alertes: AlerteQualite[] = [];

  const premier = Math.min(...segments.map((s) => s.debutSec));
  if (!encadreDes0 && premier > SEUIL_TEXTE_SEC) {
    alertes.push({
      code: "defaut-visuel",
      gravite: "attention",
      message: `${PREFIXE}rien n'est écrit avant ${virgule(premier)} s. Sur LinkedIn la vidéo démarre sans son ; l'accroche doit se lire dès la première image.`,
    });
  }

  // Les mots de l'encadré ne sont comptés que s'ils sont connus ; sinon on ne juge pas (jamais de fausse alerte).
  const encadreInconnu = encadreDes0 && encadre?.mots === undefined;
  if (!encadreInconnu) {
    const dansSegments = segments.filter((s) => s.debutSec < FENETRE_SEC).reduce((n, s) => n + s.mots.length, 0);
    const mots = dansSegments + (encadreDes0 ? (encadre?.mots ?? 0) : 0);
    if (mots > 0 && (mots < MOTS_ACCROCHE[0] || mots > MOTS_ACCROCHE[1])) {
      alertes.push({
        code: "defaut-visuel",
        gravite: "info",
        message: `${PREFIXE}${mots} mot${mots > 1 ? "s" : ""} lisible${mots > 1 ? "s" : ""} dans la première seconde ; une accroche de ${MOTS_ACCROCHE[0]} à ${MOTS_ACCROCHE[1]} mots se lit mieux.`,
      });
    }
  }
  return alertes;
}
