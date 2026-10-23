/**
 * CATALOGUE DES MODÈLES 7 À 13 (brique `motion`, lot F2) — même forme que `catalogue.ts` (composition Remotion rendue
 * par l'opération `composition` EXISTANTE, quand le choisir, durée, choix automatique, exemple), plus la phrase d'aide
 * du bouton « Que puis-je demander ? » de l'agent monteur. Constante du code : pas de migration. PUR, sans « @/ ».
 *
 * `CATALOGUE_MOTION` (6 modèles validés) reste inchangé ; `CATALOGUE_MOTION_TOUS` réunit les 13.
 */
import { CATALOGUE_MOTION, type FicheModele } from "./catalogue";
import { EXEMPLES_AXION_ETENDUS } from "./exemples-axion-etendus";
import type { IdModeleMotion } from "./types";
import type { CarteModeleEtendu, DonneesParModeleEtendu, IdModeleMotionEtendu, IdModeleMotionTous } from "./types-etendus";

export interface FicheModeleEtendu<K extends IdModeleMotionEtendu = IdModeleMotionEtendu> {
  id: K;
  /** Numéro du modèle dans le plan (7 à 13). */
  numero: number;
  nom: string;
  composition: string;
  description: string;
  quand: string;
  dureeSec: [number, number];
  /** Choisi tout seul d'après le texte ? Le titre plein écran ne l'est JAMAIS : seulement à la demande. */
  automatique: boolean;
  /** Phrase d'exemple touchable dans « Que puis-je demander ? ». */
  aide: string;
  exemple: DonneesParModeleEtendu[K];
}

export const CATALOGUE_MOTION_ETENDU: { [K in IdModeleMotionEtendu]: FicheModeleEtendu<K> } = {
  graphique: {
    id: "graphique",
    numero: 7,
    nom: "Graphique",
    composition: "MotionGraphique",
    description: "Des barres, une courbe ou un camembert qui se construisent au mot près, les valeurs comptent, la plus forte s'allume en orange.",
    quand: "Plusieurs chiffres à comparer (barres), une évolution dans le temps (courbe), une répartition en parts (camembert).",
    dureeSec: [4, 8],
    automatique: true,
    aide: "Fais un graphique en barres du temps perdu par tâche",
    exemple: EXEMPLES_AXION_ETENDUS.graphique,
  },
  "icone-mot": {
    id: "icone-mot",
    numero: 8,
    nom: "Icône + mot",
    composition: "MotionIconeMot",
    description: "Une icône qui se dessine trait par trait, puis un mot géant qui s'impose, avec ce qu'il veut dire dessous.",
    quand: "Un mot qui résume l'idée : « un seul mot : déléguer », « le maître-mot, c'est la confiance ».",
    dureeSec: [3, 5],
    automatique: true,
    aide: "Mets le mot « Déléguer » en grand avec une icône",
    exemple: EXEMPLES_AXION_ETENDUS["icone-mot"],
  },
  "probleme-solution": {
    id: "probleme-solution",
    numero: 9,
    nom: "Problème → solution",
    composition: "MotionProblemeSolution",
    description: "Le problème s'affiche puis se barre ; au mot de la solution, la carte bascule et la solution apparaît en orange.",
    quand: "Un problème puis sa réponse : « le problème, c'est… la solution, c'est… », « au lieu de… il suffit de… ».",
    dureeSec: [4, 7],
    automatique: true,
    aide: "Montre le problème puis la solution quand je dis « la solution »",
    exemple: EXEMPLES_AXION_ETENDUS["probleme-solution"],
  },
  "check-list": {
    id: "check-list",
    numero: 10,
    nom: "Check-list",
    composition: "MotionCheckList",
    description: "Des cases qui se cochent au rythme de la parole, un compteur qui avance, la dernière case fête la liste complète.",
    quand: "Des conditions à vérifier : « check-list », « vérifiez que… », « avez-vous… ? », « cochez ».",
    dureeSec: [4, 8],
    automatique: true,
    aide: "Fais une check-list qui se coche pendant que je parle",
    exemple: EXEMPLES_AXION_ETENDUS["check-list"],
  },
  "capture-annotee": {
    id: "capture-annotee",
    numero: 11,
    nom: "Capture annotée",
    composition: "MotionCaptureAnnotee",
    description: "Une capture d'écran ou une image (de Mes images ou du B-roll) avec cercles, flèches et surlignage qui se dessinent au mot près.",
    quand: "Quand on montre un écran ou un document : « regardez ici », « ce bouton », « sur ce tableau ». Il faut une image.",
    dureeSec: [4, 8],
    automatique: true,
    aide: "Montre ma capture du tableau de bord et entoure le chiffre",
    exemple: EXEMPLES_AXION_ETENDUS["capture-annotee"],
  },
  "titre-plein-ecran": {
    id: "titre-plein-ecran",
    numero: 12,
    nom: "Titre plein écran",
    composition: "MotionTitrePleinEcran",
    description: "Un titre géant qui remplit l'image, mot par mot, avec son numéro de chapitre en filigrane.",
    quand: "Seulement à la demande : « mets un titre plein écran », « un titre de chapitre ».",
    dureeSec: [3, 5],
    automatique: false,
    aide: "Mets un titre plein écran « Reprendre la main sur son temps »",
    exemple: EXEMPLES_AXION_ETENDUS["titre-plein-ecran"],
  },
  documentaire: {
    id: "documentaire",
    numero: 13,
    nom: "Documentaire",
    composition: "MotionDocumentaire",
    description: "Une carte sobre de reportage : lieu, date et chiffre clé qui s'écrivent, sans nom de personne ni bandeau.",
    quand: "Un fait situé : un lieu et une date, ou un lieu et un chiffre (« à Lyon, en mars 2026, une PME de 14 salariés… »).",
    dureeSec: [3, 6],
    automatique: true,
    aide: "Mets une carte documentaire : Lyon, mars 2026, 14 salariés",
    exemple: EXEMPLES_AXION_ETENDUS.documentaire,
  },
};

export const IDS_MODELES_MOTION_ETENDUS = Object.keys(CATALOGUE_MOTION_ETENDU) as IdModeleMotionEtendu[];

/** Les 13 identifiants, dans l'ordre du plan (1 à 13). */
export const IDS_MODELES_MOTION_TOUS = [...(Object.keys(CATALOGUE_MOTION) as IdModeleMotion[]), ...IDS_MODELES_MOTION_ETENDUS] as IdModeleMotionTous[];

/** Fiche commune aux 13 modèles (ce que lisent l'agent, l'écran « Mes animations » et la demande de rendu). */
export type FicheMotion = (FicheModele | FicheModeleEtendu) & { numero?: number; aide?: string };

/** Les 13 fiches. */
export const CATALOGUE_MOTION_TOUS = { ...CATALOGUE_MOTION, ...CATALOGUE_MOTION_ETENDU } as Record<IdModeleMotionTous, FicheMotion>;

export function estModeleEtendu(id: string): id is IdModeleMotionEtendu {
  return (IDS_MODELES_MOTION_ETENDUS as string[]).includes(id);
}

/** Fiche d'un des 13 modèles (undefined si inconnu). */
export function ficheModeleTous(id: string): FicheMotion | undefined {
  return (CATALOGUE_MOTION_TOUS as Record<string, FicheMotion>)[id];
}

/** Carte d'exemple d'un modèle 7 à 13. */
export function carteExempleEtendue(id: IdModeleMotionEtendu): CarteModeleEtendu {
  return { modele: id, donnees: CATALOGUE_MOTION_ETENDU[id].exemple } as CarteModeleEtendu;
}
