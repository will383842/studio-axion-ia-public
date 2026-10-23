export const TYPES_PAGE = ["T01", "T01B", "T01C", "T02", "T06", "T08", "T10", "T20", "T21"] as const;
export type TypePage = (typeof TYPES_PAGE)[number];

export interface DefinitionPage {
  id: TypePage;
  nom: string;
  /** Rôle de la page dans un carrousel (documentation). */
  role: string;
  /** Nombre maximal de cartes sur la page (0 : pas de cartes). */
  cartesMax: number;
  /** Éléments répétés de la page (items d'une liste, étapes d'un processus) : bornes du nombre ; 0 / 0 si la page n'en a pas. */
  elements: { min: number; max: number };
  /** Longueur maximale du titre (signes), MESURÉE au rendu réel : au-delà, le titre ne tient plus dans son cadre. */
  titreMax: number;
}

export const PAGES: Record<TypePage, DefinitionPage> = {
  T01: { id: "T01", nom: "Couverture A", role: "Première page : grand titre pleine largeur, trait, sous-titre.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 60 },
  T01B: { id: "T01B", nom: "Couverture B", role: "Première page : grand bloc orange décoré en haut, titre et sous-titre dessous.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 40 },
  T01C: { id: "T01C", nom: "Couverture C", role: "Première page : titre et sous-titre dans un cadre, grand disque orange décoré en bas à droite.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 40 },
  T02: { id: "T02", nom: "Page dense", role: "Page de contenu : grille de 2 à 6 cartes (mini-visuel, titre, texte court).", cartesMax: 6, elements: { min: 0, max: 0 }, titreMax: 30 },
  T06: { id: "T06", nom: "Liste numérotée", role: "Page de contenu : liste courte de 3 à 4 points, rang indiqué par des points.", cartesMax: 0, elements: { min: 3, max: 4 }, titreMax: 30 },
  T08: { id: "T08", nom: "Avant / après", role: "Page de contenu : deux panneaux, la situation avant puis après, reliés par une flèche.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 30 },
  T10: { id: "T10", nom: "Citation / message clé", role: "Page de contenu : un message clé en grand, légende facultative, bandeau orange décoré.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 0 },
  T20: { id: "T20", nom: "Étapes", role: "Page de contenu : processus de 3 à 5 étapes enchaînées (titre et texte court).", cartesMax: 0, elements: { min: 3, max: 5 }, titreMax: 30 },
  T21: { id: "T21", nom: "Dernière page sombre", role: "DERNIÈRE page, seule page sombre (fond encre) : invitation générique à écrire en message privé, texte posé par le code.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 0 },
};

/** Types de couverture : la première page d'un carrousel. */
export const TYPES_COUVERTURE: readonly TypePage[] = ["T01", "T01B", "T01C"];

/**
 * Budgets de texte (caractères) MESURÉS au rendu réel (`studio-rendu/scripts/essai-capacite-pages.ts`, puis contrôlés au titre le plus
 * haut — deux lignes pleines, 302 px — par `essai-capacites-max.ts`) : au-delà, le texte serait coupé et le rendu échoue. Ligne = « jusqu'à N éléments ». Les bornes générales
 * du schéma (`LIMITES`) restent des plafonds.
 */
function parNombre<T extends { jusqua: number }>(table: readonly T[], n: number): T {
  return table.find((l) => n <= l.jusqua) ?? table[table.length - 1];
}

/** Budget d'une carte de la page dense selon le nombre de cartes. */
const CAPACITE_CARTE = [
  { jusqua: 2, titre: 48, corps: 240 },
  { jusqua: 3, titre: 48, corps: 80 },
  { jusqua: 4, titre: 32, corps: 80 },
  { jusqua: 6, titre: 17, corps: 36 },
] as const;

export function capaciteCarte(nbCartes: number): { titre: number; corps: number } {
  const ligne = parNombre(CAPACITE_CARTE, nbCartes);
  return { titre: ligne.titre, corps: ligne.corps };
}

/**
 * Plus long MOT (signes) d'un titre de carte de la page dense selon le nombre de cartes : un mot ne se coupe pas, il doit tenir seul dans la
 * largeur de la carte (4 à 6 cartes : 472 px ; « accompagnement » 14 lettres et « automatiquement » 15 lettres débordent). MESURÉ au rendu réel
 * (`studio-rendu/scripts/essai-mot-long-carte.ts`) : tous les mots réels de 12 et 13 lettres passent en grille de 4 à 6, ceux de 14 et 15 lettres
 * échouent selon leurs lettres ; 15 lettres passent en grille de 2 ou 3 cartes. Contrôlé par la porte qualité (code MOT_TROP_LONG).
 */
export function capaciteMotCarte(nbCartes: number): number {
  return nbCartes <= 3 ? 15 : 12;
}

/** Budget d'un point de la liste numérotée (T06) selon le nombre de points. */
const CAPACITE_LISTE = [
  { jusqua: 3, texte: 110 },
  { jusqua: 4, texte: 58 },
] as const;

export function capaciteListe(nbPoints: number): { texte: number } {
  return { texte: parNombre(CAPACITE_LISTE, nbPoints).texte };
}

/** Budget d'une étape (T20) selon le nombre d'étapes. */
const CAPACITE_ETAPE = [
  { jusqua: 3, titre: 30, corps: 120 },
  { jusqua: 4, titre: 30, corps: 80 },
  { jusqua: 5, titre: 28, corps: 44 },
] as const;

export function capaciteEtape(nbEtapes: number): { titre: number; corps: number } {
  const ligne = parNombre(CAPACITE_ETAPE, nbEtapes);
  return { titre: ligne.titre, corps: ligne.corps };
}

/** Budget de chaque panneau de la page avant / après (T08). */
export const CAPACITE_PANNEAU = { texte: 50 } as const;

/** Budget de la citation (T10) : message clé et légende. */
export const CAPACITE_CITATION = { message: 50, legende: 60 } as const;
