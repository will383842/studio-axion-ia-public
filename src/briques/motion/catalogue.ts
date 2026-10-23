/**
 * CATALOGUE DU MOTION DESIGN — brique commune `motion` (tous les formats). Constante du code (pas de type de
 * Bibliothèque, pas de migration, plan v4 B.5). Chaque modèle dit : sa composition Remotion (rendue par l'opération
 * `composition` EXISTANTE, sans mode), quand le choisir, sa durée, ses limites et des données d'exemple (planche de
 * validation de Will). PUR et sans alias « @/ ».
 */
import type { CarteModele, DonneesParModele, IdModeleMotion } from "./types";

export interface FicheModele<K extends IdModeleMotion = IdModeleMotion> {
  id: K;
  nom: string;
  /** Identifiant de la `<Composition>` dans `Racine.tsx`. */
  composition: string;
  /** Ce que le modèle montre (pour Claude et pour l'écran « Mes animations »). */
  description: string;
  /** Quand le choisir (repris dans la consigne donnée à Claude). */
  quand: string;
  /** Durée conseillée (s) ; garde-fou commun : 3 à 8 s. */
  dureeSec: [number, number];
  /** Choisi tout seul d'après le texte ? Le titre plein écran ne l'est JAMAIS (B.21) : seulement à la demande. */
  automatique: boolean;
  /** Données d'exemple (planche de validation, aperçu). */
  exemple: DonneesParModele[K];
}

/** Durée d'une carte : 3 à 8 s (garde-fou du plan, B.10). */
export const DUREE_CARTE_SEC = { min: 3, max: 8 } as const;

export const CATALOGUE_MOTION: { [K in IdModeleMotion]: FicheModele<K> } = {
  liste: {
    id: "liste",
    nom: "Liste",
    composition: "MotionListe",
    description: "Un titre puis 2 à 5 points qui arrivent au mot près, le point dit est mis en avant.",
    quand: "Une énumération : « trois questions », « les 4 erreurs », « d'abord… ensuite… ».",
    dureeSec: [4, 8],
    automatique: true,
    exemple: {
      titre: "Le diagnostic *fuite*",
      aSecTitre: 0.15,
      elements: [
        { texte: "Où se trouve la fuite ?", icone: "loupe", aSec: 0.95 },
        { texte: "Depuis combien de temps ?", icone: "horloge", aSec: 1.85 },
        { texte: "Quels dégâts autour ?", icone: "goutte", aSec: 2.75 },
      ],
    },
  },
  chiffre: {
    id: "chiffre",
    nom: "Chiffre qui compte",
    composition: "MotionChiffre",
    description: "Un grand chiffre qui compte jusqu'à sa valeur, son unité en orange et ce qu'il veut dire.",
    quand: "Un chiffre marquant : une durée, un pourcentage, un nombre de clients.",
    dureeSec: [3, 6],
    automatique: true,
    exemple: { surTitre: "En moyenne", valeur: 45, unite: "min", libelle: "pour un diagnostic fuite complet", icone: "horloge", aSec: 0.35 },
  },
  "avant-apres": {
    id: "avant-apres",
    nom: "Avant / après",
    composition: "MotionAvantApres",
    description: "Deux barres : la situation d'avant, puis celle d'après qui se réduit (ou grandit), avec l'écart.",
    quand: "Un gain chiffré : « de 12 h à 3 h », « au lieu de », « on passe de… à… ».",
    dureeSec: [4, 7],
    automatique: true,
    exemple: {
      titre: "La *paperasse* par semaine",
      avant: { valeur: 12, unite: "h", libelle: "à la main" },
      apres: { valeur: 3, unite: "h", libelle: "avec l'IA" },
      aSecApres: 1.7,
    },
  },
  "ligne-de-temps": {
    id: "ligne-de-temps",
    nom: "Ligne de temps",
    composition: "MotionLigneDeTemps",
    description: "Une ligne qui avance avec la parole d'étape en étape (processus) ou de jalon en jalon (feuille de route).",
    quand: "Un processus, des étapes, une feuille de route, un avant-pendant-après.",
    dureeSec: [4, 8],
    automatique: true,
    exemple: {
      titre: "Votre fuite en *4 étapes*",
      etapes: [
        { titre: "L'appel", detail: "Il décrit sa fuite", icone: "telephone", aSec: 0.75 },
        { titre: "Le diagnostic", detail: "45 min sur place", icone: "loupe", aSec: 1.5 },
        { titre: "Le devis", detail: "Envoyé le jour même", icone: "document", aSec: 2.25 },
        { titre: "La réparation", detail: "Garantie deux ans", icone: "cle", aSec: 3.0 },
      ],
    },
  },
  "deux-colonnes": {
    id: "deux-colonnes",
    nom: "Comparaison",
    composition: "MotionDeuxColonnes",
    description: "Deux cercles qui se croisent : chacun ses points, et la zone commune au centre.",
    quand: "Une comparaison : « contrairement à », « d'un côté… de l'autre », « la différence entre ».",
    dureeSec: [5, 8],
    automatique: true,
    exemple: {
      titre: "Le devis, *deux façons*",
      gauche: { titre: "À la main", points: ["2 heures", "Des oublis"], icone: "document" },
      droite: { titre: "Avec l'IA", points: ["10 minutes", "Zéro oubli"], icone: "eclair" },
      commun: { titre: "En commun", points: ["Votre expertise", "Votre prix"] },
      aSecDroite: 1.4,
      aSecCommun: 2.6,
    },
  },
  titre: {
    id: "titre",
    nom: "Titre ou générique",
    composition: "MotionTitre",
    description: "Un titre plein écran qui se construit lettre à lettre, ou une carte de fin.",
    quand: "Seulement à la demande : « mets un titre », « rajoute un générique ».",
    dureeSec: [3, 5],
    automatique: false,
    exemple: { variante: "titre", surTitre: "Épisode 1", titre: "Le diagnostic fuite", motCle: "fuite", sousTitre: "en 3 questions" },
  },
};

export const IDS_MODELES_MOTION = Object.keys(CATALOGUE_MOTION) as IdModeleMotion[];

/** Fiche d'un modèle (undefined si inconnu). */
export function ficheModele(id: string): FicheModele | undefined {
  return (CATALOGUE_MOTION as Record<string, FicheModele>)[id];
}

/** Composition de la carte sur mesure (HTML, CSS et GSAP écrits par Claude, dans une iframe isolée). */
export const COMPOSITION_SUR_MESURE = "CarteSurMesure";

/** Carte d'exemple d'un modèle (planche de validation). */
export function carteExemple(id: IdModeleMotion): CarteModele {
  return { modele: id, donnees: CATALOGUE_MOTION[id].exemple } as CarteModele;
}
