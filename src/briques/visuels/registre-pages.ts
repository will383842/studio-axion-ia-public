/** T22 à T28 : vague 1 des nouveaux gabarits (L9) ; T29 « relance » (L11) ; T25 reste réservé. */
export const TYPES_PAGE = ["T01", "T01B", "T01C", "T02", "T06", "T08", "T10", "T20", "T21", "T22", "T23", "T24", "T26", "T27", "T28", "T29"] as const;
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
  /** Famille de mise en page (règle de variété de la note) : deux pages de même famille ne se suivent pas. */
  famille: FamillePage;
}

export type FamillePage = "couverture" | "cartes" | "liste" | "contraste" | "message" | "etapes" | "cas" | "appel" | "fin";

export const PAGES: Record<TypePage, DefinitionPage> = {
  T01: { id: "T01", nom: "Couverture A", role: "Première page : grand titre pleine largeur, trait, sous-titre.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 52, famille: "couverture" },
  T01B: { id: "T01B", nom: "Couverture B", role: "Première page : grand bloc orange décoré en haut, titre et sous-titre dessous.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 40, famille: "couverture" },
  T01C: { id: "T01C", nom: "Couverture C", role: "Première page : titre et sous-titre dans un cadre, grand disque orange décoré en bas à droite.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 40, famille: "couverture" },
  T02: { id: "T02", nom: "Page dense", role: "Page de contenu : grille de 2 à 6 cartes (mini-visuel, titre, texte court).", cartesMax: 6, elements: { min: 0, max: 0 }, titreMax: 30, famille: "cartes" },
  T06: { id: "T06", nom: "Liste numérotée", role: "Page de contenu : liste courte de 3 à 4 points, rang indiqué par une pastille numérotée (le chiffre est dessiné par le code).", cartesMax: 0, elements: { min: 3, max: 4 }, titreMax: 30, famille: "liste" },
  T08: { id: "T08", nom: "Avant / après", role: "Page de contenu : deux panneaux, la situation avant puis après, reliés par une flèche.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 30, famille: "contraste" },
  T10: { id: "T10", nom: "Citation / message clé", role: "Page de contenu : un message clé en grand, légende facultative, bandeau orange décoré.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 0, famille: "message" },
  T20: { id: "T20", nom: "Étapes", role: "Page de contenu : processus de 3 à 5 étapes enchaînées (titre et texte court).", cartesMax: 0, elements: { min: 3, max: 5 }, titreMax: 30, famille: "etapes" },
  T21: { id: "T21", nom: "Dernière page sombre", role: "DERNIÈRE page, seule page sombre (fond encre) : invitation générique à écrire en message privé, texte posé par le code.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 0, famille: "fin" },
  T22: { id: "T22", nom: "Mythe / réalité", role: "Page de contenu : une idée reçue barrée (carte « MYTHE »), une flèche, la réalité (carte « RÉALITÉ »). Étiquettes posées par le code.", cartesMax: 0, elements: { min: 0, max: 0 }, titreMax: 30, famille: "contraste" },
  T23: { id: "T23", nom: "Questions", role: "Page de contenu : 2 à 4 questions à se poser (rang en pastille, question, aide, icône), annotation manuscrite en bas.", cartesMax: 0, elements: { min: 2, max: 4 }, titreMax: 30, famille: "liste" },
  T24: { id: "T24", nom: "Comparaison sans / avec", role: "Page de contenu : deux colonnes « SANS » et « AVEC », 3 à 5 lignes courtes face à face.", cartesMax: 0, elements: { min: 3, max: 5 }, titreMax: 30, famille: "contraste" },
  T26: { id: "T26", nom: "Cas concret", role: "Page de contenu : scénario type (étiquette posée par le code), carte AVANT, flèche, carte AVEC NOUS, bandeau « VOUS : … ».", cartesMax: 0, elements: { min: 2, max: 2 }, titreMax: 30, famille: "cas" },
  T27: { id: "T27", nom: "Checklist", role: "Page de contenu : 4 à 5 affirmations à cocher (interrupteur dessiné), jauge en bas posée par le code.", cartesMax: 0, elements: { min: 4, max: 5 }, titreMax: 30, famille: "liste" },
  T28: { id: "T28", nom: "Schéma de flux", role: "Page de contenu : 3 à 5 nœuds reliés par des flèches, texte court DANS chaque nœud.", cartesMax: 0, elements: { min: 3, max: 5 }, titreMax: 30, famille: "etapes" },
  T29: { id: "T29", nom: "Relance", role: "Avant-dernière page en général (jamais sombre) : une question directe ou une phrase courte et forte en grand, puis 2 à 3 rappels de ce que le lecteur a vu.", cartesMax: 0, elements: { min: 2, max: 3 }, titreMax: 0, famille: "appel" },
};

/** Types de couverture : la première page d'un carrousel. */
export const TYPES_COUVERTURE: readonly TypePage[] = ["T01", "T01B", "T01C"];

/**
 * Budgets de texte (caractères) MESURÉS au rendu réel (`studio-rendu/scripts/essai-capacite-pages.ts`, puis contrôlés au titre le plus
 * haut — deux lignes pleines, 302 px — par `essai-capacites-max.ts`), REMESURÉS au lot L1 (Inter, titres en capitales, rubrique) sur le Chrome Headless Shell 149 : au-delà, le texte serait coupé et le rendu échoue. Ligne = « jusqu'à N éléments ». Les bornes générales
 * du schéma (`LIMITES`) restent des plafonds.
 */
function parNombre<T extends { jusqua: number }>(table: readonly T[], n: number): T {
  return table.find((l) => n <= l.jusqua) ?? table[table.length - 1];
}

/** Budget d'une carte de la page dense selon le nombre de cartes. */
const CAPACITE_CARTE = [
  { jusqua: 2, titre: 48, corps: 130 },
  { jusqua: 3, titre: 44, corps: 64 },
  { jusqua: 4, titre: 28, corps: 46 },
  { jusqua: 6, titre: 12, corps: 20 },
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
  return nbCartes <= 3 ? 15 : 10;
}

/** Budget d'un point de la liste numérotée (T06) selon le nombre de points. */
const CAPACITE_LISTE = [
  { jusqua: 3, texte: 110 },
  { jusqua: 4, texte: 52 },
] as const;

export function capaciteListe(nbPoints: number): { texte: number } {
  return { texte: parNombre(CAPACITE_LISTE, nbPoints).texte };
}

/** Budget d'une étape (T20) selon le nombre d'étapes. */
const CAPACITE_ETAPE = [
  { jusqua: 3, titre: 30, corps: 76 },
  { jusqua: 4, titre: 26, corps: 44 },
  { jusqua: 5, titre: 28, corps: 36 },
] as const;

export function capaciteEtape(nbEtapes: number): { titre: number; corps: number } {
  const ligne = parNombre(CAPACITE_ETAPE, nbEtapes);
  return { titre: ligne.titre, corps: ligne.corps };
}

/** Budget de chaque panneau de la page avant / après (T08). */
export const CAPACITE_PANNEAU = { texte: 50 } as const;

/** Budget de la citation (T10) : message clé et légende. */
export const CAPACITE_CITATION = { message: 50, legende: 60 } as const;

/** Budget de la page mythe / réalité (T22). */
export const CAPACITE_MYTHE = { mythe: 60, realite: 80 } as const;

/** Budget d'une question (T23) selon le nombre de questions, et de l'annotation manuscrite. */
const CAPACITE_QUESTION = [
  { jusqua: 2, question: 56, aide: 72 },
  { jusqua: 3, question: 44, aide: 52 },
  { jusqua: 4, question: 34, aide: 36 },
] as const;

export function capaciteQuestion(nbQuestions: number): { question: number; aide: number } {
  const ligne = parNombre(CAPACITE_QUESTION, nbQuestions);
  return { question: ligne.question, aide: ligne.aide };
}
export const CAPACITE_ANNOTATION = 40;

/** Budget de chaque case de la comparaison sans / avec (T24) ; `mot` : plus long mot d'une case (il doit tenir seul dans la case SANS à 30 px, contrôlé par la porte, code MOT_TROP_LONG). */
export const CAPACITE_COMPARAISON = { case: 24, mot: 15 } as const;

/** Budgets du cas concret (T26) : lignes avant / avec nous, pastilles d'outils (texte, jamais de logo), bandeau « VOUS : … ». */
export const CAPACITE_CAS = { ligne: 35, outil: 16, outilsMax: 3, vous: 44 } as const;

/** Budget d'une ligne de checklist (T27). */
export const CAPACITE_CHECKLIST = { ligne: 55 } as const;

/** Budget d'un nœud du schéma de flux (T28). */
export const CAPACITE_NOEUD = { texte: 24 } as const;

/** Budget de la page de relance (T29) : la relance en capitales ajustées, chaque rappel (2 à 3) sous l'étiquette posée par le code. */
export const CAPACITE_RELANCE = { relance: 60, rappel: 44 } as const;
