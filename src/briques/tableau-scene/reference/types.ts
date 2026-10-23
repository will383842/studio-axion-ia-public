/**
 * TYPES DU STYLE « reference/1 » (page blanche écrite au crayon, maquette validée le 14/10/2026). PUR.
 */

import type { StyleTableau } from "../trois-styles/styles";
import type { MiseEnPageTableauStyle } from "../trois-styles/types";

/** Styles de la page écrite au crayon : « reference/1 », et « reference/2 » (gabarit de page clair, 14/10/2026). */
export type StylePageCrayon = "reference/1" | "reference/2" | "reference/3";

/**
 * Style « reference/2 » : ce que le GABARIT pose autour du texte d'un élément (champ `gabarit` de `ElementPlace`).
 * Rectangles en px de l'image. Le rendu dessine, la mise en page décide.
 *  - `repere` : les points de progression des étapes (un par étape, le courant plus gros), sans texte ;
 *  - `bandeau` : le bandeau « Exemple » (texte clair sur fond encre) ;
 *  - `pastille` : le disque numéroté d'une étape (le crayon trace le rond, le disque se colore, le chiffre s'écrit) ;
 *  - `titre` : le titre, souligné d'un trait épais de la couleur du sens (sa marque « souligne ») ;
 *  - `detail` : un détail, avec le filet vertical à sa gauche ;
 *  - `etiquette` : l'étiquette « AVANT » ou « APRÈS » (texte clair sur fond terracotta ou sauge), et le séparateur
 *    pointillé posé sous la ligne « avant » ;
 *  - `puce` : le petit disque numéroté d'un élément de « À retenir » ;
 *  - `appel` : l'appel final, écrit en clair dans un cadre plein vert sauge (le crayon trace le cadre, il se remplit).
 */
export type DecorGabarit =
  | { sorte: "repere"; points: { x: number; y: number; diametre: number; plein: boolean; courant: boolean }[]; couleur: string; halo: string }
  | { sorte: "bandeau"; cadre: RectDecor; rayon: number }
  /** Pastille numérotée (« reference/3 » : à l'encre, et « Étape 2 sur 4 » à sa droite, `etape`). */
  | { sorte: "pastille"; n: number; disque: RectDecor; couleur: string; etape?: TexteDecor; peps?: true }
  | { sorte: "detail"; filet: RectDecor; couleur: string }
  | { sorte: "etiquette"; cadre: RectDecor; rayon: number; separateur?: { x: number; y: number; largeur: number } }
  | { sorte: "puce"; disque: RectDecor; couleur: string }
  | { sorte: "appel"; cadre: RectDecor; rayon: number; couleur: string }
  | { sorte: "dessin"; tache: RectDecor; couleur: string }
  /* Style « reference/3 » (gabarit par parties, charte Axion du 15/10/2026). */
  /** Repère discret « Exemple illustratif » (page de l'exemple) : un point sable et le texte, sans fond. */
  | { sorte: "partie"; role: string; point: RectDecor; couleur: string; couleurPoint: string }
  /** L'accroche, écrite dès la première image : les mots de la douleur, entourés au moment où la voix les dit. */
  | { sorte: "accroche"; mots: { k: number; kFin: number; zone: RectDecor; ligne: number }[]; couleur: string }
  /** Titre et phrase clé (« reference/2 » : sans décor ; « reference/3 » : la ligne écrite en orange (`accent`, index de ligne) et le surlignage orange pâle tracé dessous). */
  | { sorte: "titre" | "phrase"; accent?: number; surligne?: RectDecor; marqueur?: true }
  /** Élément d'une liste à pastilles : le disque à l'encre et son signe en ivoire (✓, ✎, ✕) ; le sens est dans la forme. */
  | { sorte: "code"; code: "vert" | "orange" | "rouge"; disque: RectDecor; couleur: string }
  /** Élément d'une liste cochée : la case, la coche ; `attente` : déjà là, pâle, avant d'être dit (« À retenir »). */
  | { sorte: "case"; boite: RectDecor; couleur: string; attente: boolean }
  /**
   * Exemple concret « Monsieur Martin → Client A », dans une carte arrondie : le mot d'avant (Inter, `tailleDe`), puis
   * la flèche et le mot d'après (Montserrat). Lignes : [avant, après].
   */
  | { sorte: "transformation"; fleche: { x1: number; y1: number; x2: number; y2: number }; couleur: string; carte: RectDecor; rayon: number; fond: string; tailleDe: number }
  /** Avant / après : « ✕ Avant » (texte barré dessous) ou « ✓ Après » (disque à l'encre), sans fond. */
  | { sorte: "avant-apres"; cadre: RectDecor; signe: "croix" | "coche"; disque: RectDecor }
  /** Idée reçue : « ✕ Idée reçue » au-dessus, le texte barré quand la voix a fini de le dire. */
  | { sorte: "idee"; cadre: RectDecor; signe: RectDecor; texte: TexteDecor; couleur: string }
  /** Page d'appel (même fond que les autres) : la phrase finale en grand, sa dernière ligne en orange. */
  | { sorte: "appel-plein"; fond: string; accent?: number }
  /** Bouton plein de la page d'appel (« Réservez un appel de diagnostic ») : il bat doucement. */
  | { sorte: "bouton"; cadre: RectDecor; rayon: number; fond: string }
  /*
   * Visuels dessinés et peps (maquette validée par Will le 15/10, PR #260), sur une page dont la fiche les choisit :
   */
  /**
   * Visuel de la banque fermée (`visuels-3.ts`) : `boite` = sa grille 400 × 400 posée sur la page, `encre` = ce qu'il
   * occupe, mouvements compris (jamais à moins de 12 px d'un texte) ; `options` : ce qu'il écrit ; `fleche` : la flèche
   * dessinée qui pointe du texte vers lui (corps puis pointe, px), quand la page en a une.
   */
  | { sorte: "visuel"; id: string; options: { chiffre?: string; libelle?: string; gauche?: string; droite?: string }; boite: RectDecor; encre: RectDecor; fleche?: { corps: { x: number; y: number }[]; tete: { x: number; y: number }[] } }
  /** Bloc orange plein (un par page au plus) : texte ivoire, compteur facultatif qui défile de `de` à `a`. */
  | { sorte: "bloc-orange"; cadre: RectDecor; rayon: number; fond: string; compteur?: { de: number; a: number; zone: RectDecor; taille: number } };

/** Un petit texte posé par le décor (px de l'image). */
export interface TexteDecor {
  texte: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  taille: number;
}

/** Rectangle (px de l'image). */
export interface RectDecor {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Ce que la mise en page « reference/1 » (ou « reference/2 ») ajoute aux pages (`MiseEnPageTableau.styleReference`). */
export interface MiseEnPageReference {
  style: StylePageCrayon;
  /** Échelle des tailles du style (petit côté de l'image ÷ 1080). */
  k: number;
  /** Signature « axion-ia.com » : coin bas gauche de la zone sûre (position de sa ligne de texte, taille). */
  signature: { x: number; y: number; largeur: number; hauteur: number; taillePx: number };
  /** Pages qui ne montrent pas la signature (celle où la fin écrit déjà « axion-ia.com »). */
  pagesSansSignature: number[];
  /** Blocs ajoutés par la fin de la sortie (phrase de la fin, adresse du site) : ils s'écrivent après la scène. */
  ajouts: string[];
  /** Éléments de la fiche qui ne sont pas écrits (même texte déjà écrit sur la page : écrit une fois). */
  ecritsUneFois: string[];
  /**
   * Style « reference/2 » : éléments posés par le gabarit (repère, bandeau, étiquette, puce) → l'élément avec lequel ils
   * apparaissent (`null` : au début de leur scène). Absent : « reference/1 ».
   */
  suivent?: Record<string, string | null>;
  /**
   * Style « reference/3 » : ce qui ARRIVE AVEC LA PAGE (étiquette de partie, titre, premier bloc, accroche, appel) —
   * déjà écrit quand la page glisse, jamais une page vide ; la barre de progression des parties (en haut de la zone
   * sûre) ; le rôle (partie) de chaque page.
   */
  poses?: string[];
  barre?: RectDecor;
  /** Style « reference/3 » : rangée des noms des chapitres, sous la barre (taille du nom en px). */
  nomsChapitres?: RectDecor & { taille: number };
  parties?: Record<number, string>;
  /**
   * Trois styles du tableau (16/10/2026, maquettes validées PR #280) : le style (tableau blanc, ardoise, paperboard),
   * les libellés des chapitres, la surface d'écriture, le bas du support. Absent : la page ivoire d'avant.
   */
  tableau?: MiseEnPageTableauStyle;
}

/** Ce qu'une scène du style « reference/1 » reçoit en plus (`ProprietesTableauScene.reference`). */
export type ProprietesReference = {
  style: StylePageCrayon;
  k: number;
  /** Signature à montrer sur cette page (absente : rien). */
  signature: MiseEnPageReference["signature"] | null;
  /** Fin de la voix (le crayon se pose) et fin de la vidéo (fondu de l'image), ms, horloge de la vidéo. */
  finVoixMs: number;
  finVideoMs: number;
  /** Dernière scène de la vidéo : le crayon se pose sous la page finie, puis l'image s'efface. */
  derniere: boolean;
  /**
   * Heures (ms, horloge de la vidéo) de TOUT ce qui s'écrit sur la page (éléments et gestes de toutes ses scènes) et
   * les scènes de la page : le crayon est planifié page par page, il ne saute jamais d'une scène à la suivante.
   */
  heuresPage: Record<string, number>;
  scenesPage: { id: string; debutMs: number; finMs: number }[];
  /** Bloc d'accroche déjà écrit à la première image de la vidéo (absent : aucun). */
  accroche?: string;
  /** La page finit la vidéo : le crayon s'y pose à la fin. */
  pageFinale: boolean;
  /**
   * Style « reference/2 » : ce qui s'écrit AU MOMENT où la voix le dit (la phrase de la fin de TikTok et Shorts) ; ce
   * qui le précède dans sa scène s'écrit plus vite au besoin (absent : rien).
   */
  aLHeure?: string[];
  /**
   * Style « reference/3 » : heures fines (ms, horloge de la vidéo) lues dans la voix — `<id>~fin` : la voix a fini de dire
   * le bloc (il est écrit au plus tard à cette heure) ; `<id>~mot:<k>` / `<id>~motfin:<k>` : début et fin du k-ième
   * mot important dit ; `<id>~vers` : le mot d'après d'une transformation.
   */
  temps3?: Record<string, number>;
  /** Style « reference/3 » : ce qui arrive avec la page (voir `MiseEnPageReference.poses`). */
  poses?: string[];
  /**
   * Style « reference/3 » : barre des chapitres (rangée des barres), rangée de leurs noms, et chapitres de la vidéo dans
   * l'ordre (`role` : id du chapitre, `nom` affiché, début et fin en ms).
   */
  barre?: RectDecor;
  nomsChapitres?: RectDecor & { taille: number };
  parties?: { role: string; nom: string; couleur: string; debutMs: number; finMs: number }[];
  /** Style « reference/3 » : début (ms) de la page (la coupe), et page d'avant pour la transition de 300 ms. */
  debutPageMs?: number;
  /**
   * Trois styles du tableau : fin réelle de la page (ms), l'arrivée de la page suivante (`debutPage3`), un peu après sa
   * coupe : la page finie y reste visible, l'outil sorti (critique #291, I1). Absente : la fin de sa dernière scène.
   */
  finPageMs?: number;
  /** Trois styles du tableau : la géométrie du style (voir `MiseEnPageReference.tableau`) et la partie de la page. */
  tableau?: MiseEnPageTableauStyle & { partie: string; /** La partie de la page d'avant (sa barre reste pendant l'attente). */ partieAvant?: string };
};
export type { StyleTableau };
