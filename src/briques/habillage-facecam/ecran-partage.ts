/**
 * ÉCRAN PARTAGÉ PAR PASSAGES (plan v4 L6, B.19) : texte en haut (carte de motion design), Will en bas, 3 à 8 s,
 * déclenché par le texte (énumérations, chiffres, étapes, comparaisons), 2 à 3 fois par vidéo, 25 % de la durée au
 * plus ; entrée en 8 à 10 images avec une courbe unique, sortie en coupe franche.
 */
import { estModeleEtendu } from "../motion/catalogue-etendu";
import { choisirModeleTous, type ChoixModeleTous } from "../motion/choix-etendu";
import { tientEnMoitieHaute } from "../motion/disposition-etendue";
import type { CarteModeleEtendu, CarteMotionTous } from "../motion/types-etendus";
import { PREFIXE_ENTREE, type EcranPartageScene, type PlanScene } from "../composition/scene";
import { miseEnPage } from "../motion/demande";
import { disposerListe } from "../motion/disposition-liste";
import type { RatioMotion } from "../motion/jetons";

export const REGLES_ECRAN_PARTAGE = {
  dureeSec: [3, 8] as const,
  parVideo: 3,
  partMax: 0.25,
  /** Entrée : 9 images (8 à 10). */
  entreeImages: 9,
  /** Écart minimal entre deux écrans partagés (s). */
  ecartMinSec: 6,
  /** Jamais pendant l'accroche (les 2 premières secondes). */
  pasAvantSec: 2,
  /** Confiance minimale du choix automatique. */
  confianceMin: 0.6,
} as const;

export interface PhraseHorodatee {
  texte: string;
  debutSec: number;
  finSec: number;
}

export interface PassageEcranPartage {
  debutSec: number;
  finSec: number;
  /** L'un des 13 modèles de la brique motion (mission L), jamais un titre. */
  carte: CarteMotionTous;
  raison: string;
}

/**
 * Passages d'écran partagé choisis d'après le texte : les phrases qui portent une liste, un chiffre, un avant / après,
 * des étapes ou une comparaison, les plus sûres d'abord, dans les bornes (3 à 8 s, 3 par vidéo, 25 % au plus,
 * 6 s d'écart, jamais dans l'accroche). Le titre n'est jamais choisi ici.
 * Mission L : le choix se fait parmi les 13 modèles (`choisirModeleTous` : graphique, check-list, problème → solution,
 * documentaire, icône + mot en plus) ; le titre plein écran jamais ; une carte 7 à 13 qui ne tient pas dans la moitié
 * haute (`tientEnMoitieHaute`) n'est pas retenue.
 */
export function planifierEcransPartages(phrases: PhraseHorodatee[], dureeVideoSec: number, regles = REGLES_ECRAN_PARTAGE): PassageEcranPartage[] {
  const candidats = phrases
    .map((p, i) => ({ p, i, choix: choisirModeleTous(p.texte) }))
    .filter((c): c is { p: PhraseHorodatee; i: number; choix: ChoixModeleTous } => !!c.choix && c.choix.modele !== "titre" && c.choix.modele !== "titre-plein-ecran" && c.choix.confiance >= regles.confianceMin)
    .filter((c) => !estModeleEtendu(c.choix.carte.modele) || tientEnMoitieHaute(c.choix.carte as CarteModeleEtendu))
    .sort((a, b) => b.choix.confiance - a.choix.confiance || a.p.debutSec - b.p.debutSec);
  const retenus: PassageEcranPartage[] = [];
  let total = 0;
  for (const c of candidats) {
    if (retenus.length >= regles.parVideo) break;
    const debut = Math.max(c.p.debutSec, regles.pasAvantSec);
    // Le passage couvre la phrase (et la suivante si elle est trop courte), borné à 3-8 s et à la vidéo.
    let fin = c.p.finSec;
    if (fin - debut < regles.dureeSec[0]) fin = Math.max(fin, phrases[c.i + 1]?.finSec ?? fin);
    fin = Math.min(dureeVideoSec - 0.5, Math.max(debut + regles.dureeSec[0], Math.min(fin, debut + regles.dureeSec[1])));
    if (fin - debut < regles.dureeSec[0] - 1e-6) continue;
    if (total + (fin - debut) > regles.partMax * dureeVideoSec + 1e-6) continue;
    if (retenus.some((r) => debut < r.finSec + regles.ecartMinSec && fin > r.debutSec - regles.ecartMinSec)) continue;
    retenus.push({ debutSec: +debut.toFixed(3), finSec: +fin.toFixed(3), carte: c.choix.carte, raison: c.choix.raison });
    total += fin - debut;
  }
  return retenus.sort((a, b) => a.debutSec - b.debutSec);
}

/**
 * Pose les écrans partagés sur les plans de la composition : les plans sont coupés aux bornes de chaque passage ; le
 * premier plan d'un passage porte l'entrée (9 images), les suivants sont déjà en place et lisent la carte décalée.
 * Un plan d'illustration pendant un passage reste plein écran (il est prioritaire).
 */
export function poserEcransPartages(plans: PlanScene[], passages: { debutSec: number; finSec: number; carte: string; sourceY: number; cote?: "gauche"; largeurCarte?: number; sourceX?: number }[], hauteurHaut: number, entreeImages: number = REGLES_ECRAN_PARTAGE.entreeImages): PlanScene[] {
  if (!passages.length) return plans;
  // 1. Coupes aux bornes des passages.
  const bornes = passages.flatMap((p) => [p.debutSec, p.finSec]);
  const coupes: PlanScene[] = [];
  for (const pl of plans) {
    const internes = bornes.filter((b) => b > pl.debutSec + 1e-6 && b < pl.finSec - 1e-6).sort((a, b) => a - b);
    let debut = pl.debutSec;
    for (const b of [...internes, pl.finSec]) {
      coupes.push({ ...pl, debutSec: +debut.toFixed(3), finSec: +b.toFixed(3) });
      debut = b;
    }
  }
  // 2. Écran partagé sur les plans « double » dans un passage.
  return coupes.map((pl) => {
    const passage = passages.find((p) => pl.debutSec >= p.debutSec - 1e-6 && pl.finSec <= p.finSec + 1e-6);
    if (!passage || pl.type !== "double") return pl;
    const premier = Math.abs(pl.debutSec - passage.debutSec) < 1e-6;
    const ecranPartage: EcranPartageScene = {
      carte: passage.carte.startsWith(PREFIXE_ENTREE) ? passage.carte : `${PREFIXE_ENTREE}${passage.carte}`,
      hauteurHaut,
      sourceY: passage.sourceY,
      entreeImages: premier ? entreeImages : 0,
      carteDebutSec: +(pl.debutSec - passage.debutSec).toFixed(3),
      // Facecam F1 (ajout pur) : côte à côte en 16:9.
      ...(passage.cote === "gauche" ? { cote: passage.cote, largeurCarte: passage.largeurCarte, sourceX: passage.sourceX } : {}),
    };
    // Pas de zoom pendant un écran partagé : le cadre de la moitié basse est fixé par le cadrage par calque.
    return { ...pl, cadrage: { ...pl.cadrage, zoom: 1, zoomFin: 1 }, ecranPartage };
  });
}

/**
 * Disposition qui tient (finitions du 10/10) : une liste dont les points ne tiennent pas dans la moitié haute, même
 * resserrée ou en deux colonnes (`disposerListe`), passe en plein écran — jamais un point coupé par le bas du panneau.
 */
export function dispositionQuiTient(carte: CarteMotionTous | undefined, disposition: "plein-ecran" | "moitie-haute", ratio: RatioMotion = "9:16"): "plein-ecran" | "moitie-haute" {
  if (disposition !== "moitie-haute" || carte?.modele !== "liste") return disposition;
  const mp = miseEnPage(ratio, "moitie-haute", 5);
  return disposerListe({ titre: carte.donnees.titre, textes: carte.donnees.elements.map((e) => e.texte), mp }).tient ? disposition : "plein-ecran";
}
