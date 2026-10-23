/**
 * IMAGE → VIDÉO · Seuils de la mise en scène et de ses contrôles (lot L11, plan 50 § 7 Q13-Q15, Q19). PUR. Seule
 * source : la mise en scène les vise, les contrôles les vérifient.
 */
import { AVANCE_NOEUD_IV } from "@/briques/schema-motion/types";

export const REGLES_SCENE_IV = Object.freeze({
  /** Un élément surgit un peu avant son mot : `AVANCE_NOEUD_IV`, la valeur que lit aussi `TEMPS_IV.avanceNoeud` (L7). */
  avance: AVANCE_NOEUD_IV,
  /** Rythme (Q14) : écart maximal entre deux changements visibles, moyenne visée. */
  ecartMax: 2.4,
  moyenneMin: 1.5,
  moyenneMax: 2.2,
  /** Deux changements à moins de 0,4 s l'un de l'autre font un seul temps (moyenne du rythme). */
  fusion: 0.4,
  /** Plans : jamais plus de 5 s, jamais deux de suite de plus de 4 s. */
  planMax: 5,
  planLong: 4,
  /** Scène « Ensemble » : 1 à 1,5 s. */
  ensemble: 1.2,
  ensembleMin: 1.0,
  ensembleMax: 1.5,
  /** Récapitulatif des bénéfices inséré quand la fiche n'en a pas. */
  recap: 1.5,
  /** Fenêtre du chiffre dit = chiffre montré (Q13). */
  chiffreAvant: 0.3,
  chiffreApres: 0.6,
  /** La vidéo dure 1,6 s de plus que la voix ; contrôle : voix finie ≥ 1,5 s avant la fin (Q19). */
  queue: 1.6,
  queueMin: 1.5,
  /** Écart minimal entre un élément et le suivant quand un appui est choisi (lisibilité). */
  ecartMin: 0.6,
  /** Un texte d'écran plus long ne tient plus au plancher de la charte (≈ 2 lignes de 35 signes). */
  signesMax: 70,
  fps: 25,
});
