/**
 * CHARTE `charte-video/1` — habillage unique des vidéos « tableau animé » (pièce A du plan, ORG-10).
 * PUR, sans React ni Remotion et SANS alias « @/ » : lu tel quel par `studio-rendu`. FIGÉE (objets gelés) : aucun
 * format ne la modifie ; un changement de charte = une nouvelle version (`charte-video/2`), jamais une retouche.
 *
 * Décision de Will (11/10/2026) : la charte de ses posts. Page ivoire, écriture presque noire, mots importants en
 * NOIR SOULIGNÉS d'orange. L'orange n'est JAMAIS une couleur de texte (contraste insuffisant sur l'ivoire).
 *
 * Les zones sûres ne sont pas recopiées ici : elles se lisent dans `src/reseaux` (zonesProtegees).
 * Les jetons de face caméra (`motion-1`, `src/briques/motion/jetons.ts`) sont distincts et inchangés.
 */

export const VERSION_CHARTE_VIDEO = "charte-video/1";

/** Rôles de couleur. Chaque rôle dit à quoi sert la couleur ; l'orange ne figure dans aucun rôle de texte. */
export const COULEURS_VIDEO = Object.freeze({
  /** Page ivoire (fond de tout). */
  page: "#E9DCC8",
  /** Écriture : tout texte, y compris les mots importants (noir presque pur, chaud). */
  ecriture: "#110A05",
  /** Soulignement et marques (trait, entourage, barré, coche, corps du crayon) : jamais du texte. */
  soulignement: "#B44F29",
  /** Sable : remplissage des dessins (non porteur de sens, hors règle de contraste ; les contours restent en écriture). */
  sable: "#BFA88B",
} as const);

export type RoleCouleurVideo = keyof typeof COULEURS_VIDEO;

/** Rôles autorisés pour du texte : une seule couleur, l'écriture. Le test échoue si l'orange s'y glisse. */
export const ROLES_TEXTE: readonly RoleCouleurVideo[] = Object.freeze(["ecriture"] as const);

/** Couples (texte, fond) réellement utilisés : chacun doit atteindre `CONTRASTE_TEXTE_MIN`. */
export const COUPLES_TEXTE: readonly { texte: RoleCouleurVideo; fond: RoleCouleurVideo }[] = Object.freeze([
  Object.freeze({ texte: "ecriture", fond: "page" }),
] as const);

/** Couples (marque, fond) : chacun doit atteindre `CONTRASTE_MARQUE_MIN`. */
export const COUPLES_MARQUES: readonly { marque: RoleCouleurVideo; fond: RoleCouleurVideo }[] = Object.freeze([
  Object.freeze({ marque: "soulignement", fond: "page" }),
  Object.freeze({ marque: "ecriture", fond: "page" }),
] as const);

/** Seuils de contraste (rapport, 1 à 21). Texte : niveau AAA ; marque : élément graphique (WCAG 1.4.11). */
export const CONTRASTE_TEXTE_MIN = 7;
export const CONTRASTE_MARQUE_MIN = 3;

/**
 * Polices : Montserrat ExtraBold (800, titres) et Inter Bold (texte), toutes deux SIL OFL 1.1 et rangées dans
 * `studio-rendu/compositions/commune/polices/` (chargées par `commune/polices.ts`). Droits : `police-montserrat`.
 */
export const POLICES_VIDEO = Object.freeze({
  titre: Object.freeze({ famille: "Axion Montserrat ExtraBold", graisse: 800, voulue: "Montserrat ExtraBold", presente: true }),
  texte: Object.freeze({ famille: "Axion Inter Bold", graisse: 700, voulue: "Inter", presente: true }),
});

/** Taille minimale du texte : 3 % de la hauteur de la vidéo (garde-fou du plan). */
export const TAILLE_PLANCHER_VIDEO = 0.03;

/** Tailles par niveau, en fraction de la HAUTEUR de la vidéo (jamais sous `TAILLE_PLANCHER_VIDEO`). */
export const TAILLES_VIDEO = Object.freeze({ titre: 0.058, corps: 0.04, legende: 0.03 } as const);

/** Épaisseurs de trait, en fraction de la LARGEUR de la vidéo (1080 px de référence). */
export const EPAISSEURS_VIDEO = Object.freeze({
  /** Contour des dessins et du crayon. */
  trait: 0.0075,
  traitFin: 0.004,
  /** Soulignement sous un mot important. */
  soulignement: 0.009,
  /** Entourage, barré, coche. */
  marque: 0.008,
} as const);

/** Marges de la page, en fraction de la largeur (en plus des zones sûres du réseau). */
export const MARGES_VIDEO = Object.freeze({ page: 0.07, entreLignes: 0.025 } as const);

/**
 * Hauteur de la bande réservée aux sous-titres, en fraction de la hauteur, prise EN BAS de la zone sûre : la page
 * s'écrit au-dessus (valeur prudente : 3 lignes de légende à 3 % + interlignage).
 */
export const BANDE_SOUS_TITRES_HAUTEUR = 0.14;

/** Taille en px d'un niveau pour une vidéo de `hauteurVideo` px (jamais sous le plancher de 3 %). */
export function tailleVideoPx(niveau: keyof typeof TAILLES_VIDEO, hauteurVideo: number): number {
  return Math.round(Math.max(TAILLES_VIDEO[niveau], TAILLE_PLANCHER_VIDEO) * hauteurVideo);
}
