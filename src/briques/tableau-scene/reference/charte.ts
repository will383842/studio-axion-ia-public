/**
 * CHARTE DU STYLE « reference/1 » DU TABLEAU ANIMÉ (14/10/2026) : celle de la maquette validée par Will (« OK »),
 * branche `tableau/maquette-style-reference`, `maquettes/tableau-style-reference/animation.html` — le style d'un reel
 * de référence « tableau blanc ». PUR, sans React ni alias « @/ » : lu tel quel par `studio-rendu`.
 *
 *  - UN seul fond, blanc cassé chaud ; aucune boîte, aucune étiquette, aucun tampon, aucun filigrane.
 *  - UNE page qui se remplit de haut en bas, bloc après bloc ; rien n'est effacé ; nouvelle page = page blanche.
 *  - Texte centré, gras, UNE police (Montserrat ExtraBold), une taille (les titres un peu plus grands) ; blocs de 1 à 3
 *    lignes à écart régulier et serré, la page commence en haut.
 *  - Trois couleurs de texte, pour séparer les idées : encre (base), terracotta (problème, avertissement), vert sauge
 *    (solution, positif).
 *  - Un petit dessin coloré par idée, à côté de son bloc, en alternance gauche / droite (banque de dessins recoloriée :
 *    `cliparts.ts`).
 *  - UN crayon dessiné (jaune miel, pointe sable, gomme terracotta) qui ÉCRIT : le texte se dévoile de gauche à droite,
 *    la pointe suit le bord ; il trace les dessins (contour, puis couleur).
 *
 * Tailles en px pour l'image de référence 1080 × 1920 (`k` = petit côté ÷ 1080, comme les autres styles).
 */

export const STYLE_REFERENCE_1 = "reference/1";

export const COULEURS_REFERENCE = Object.freeze({
  /** Le fond, unique. */
  fond: "#F7F2E8",
  /** Texte de base. */
  encre: "#110A05",
  /** Problème, avertissement. */
  terracotta: "#B44F29",
  /** Solution, positif. */
  sauge: "#3F7A55",
} as const);

/** Les SEULES couleurs de texte du style. */
export const COULEURS_TEXTE_REFERENCE: readonly string[] = Object.freeze([COULEURS_REFERENCE.encre, COULEURS_REFERENCE.terracotta, COULEURS_REFERENCE.sauge]);

/** Palette des dessins (aplats) : terracotta, sable, encre, ivoire, jaune miel ; contour encre fin. */
export const PALETTE_DESSINS = Object.freeze({
  terracotta: "#B44F29",
  sable: "#D9B98A",
  encre: "#110A05",
  ivoire: "#E9DCC8",
  miel: "#E8B23A",
} as const);
export type TeinteDessin = keyof typeof PALETTE_DESSINS;

/** Couleurs permises dans un dessin. */
export const COULEURS_DESSINS: readonly string[] = Object.freeze(Object.values(PALETTE_DESSINS));

/**
 * Tailles (px de référence, 1080 de large). Réglées le 14/10/2026 après regard des planches par Will (« les pages sont
 * trop vides, le texte trop petit ») sur la méthode du reel de référence : texte plus grand, blocs plus larges, la page
 * commence en haut et se remplit vers le bas, blocs serrés à écart régulier.
 */
export const TAILLES_REFERENCE = Object.freeze({
  /** Taille de base du texte (≈ 52 px sur 1080 de large, comme le reel). */
  texte: 52,
  /** Taille d'une ligne « titre » de la fiche (58 px pour une base de 52 ; même rapport quand la base change, au plus
   * `titreMax`). */
  texteTitre: 58,
  titreMax: 64,
  /** Plus grande taille de base : une page peu chargée grandit jusque-là pour se remplir. */
  texteMax: 60,
  /** Plus petite taille permise quand une page très chargée doit tenir (jamais en dessous). */
  texteMin: 44,
  /** Interligne, en multiple de la taille (66 px pour 52). */
  interligne: 1.27,
  /** Écart régulier et serré entre deux blocs ; jamais moins que `ecartMin`, jamais plus que `ecartMax` (page peu chargée). */
  ecart: 44,
  ecartMin: 24,
  ecartMax: 900,
  /**
   * Bas visé du dernier bloc d'une page terminée, en part de la hauteur de la zone sûre (14/10, regard de Will sur une
   * vraie vidéo : « page remplie aux 2/3, bas vide ») : une page peu chargée est répartie (taille, puis écart) pour que
   * son dernier bloc descende jusque-là (85-90 %), jamais au-delà de la place.
   */
  basVise: 0.88,
  /** Largeur d'écriture (colonne centrée) : jusqu'à 88 % de la largeur, dans la zone sûre. */
  colonne: 950,
  /** Sortie horizontale : deux colonnes de blocs, séparées par cette gouttière. */
  gouttiere: 96,
  /** Plus petite colonne permise (en dessous, la page est refusée : elle serait illisible). */
  colonneMin: 420,
  /** Côté d'un dessin, et son écart au texte (jamais collé). */
  dessin: 120,
  ecartDessin: 30,
  /** Marges intérieures de la page, en haut et en bas de la zone sûre. */
  margeHaut: 24,
  margeBas: 24,
  /** Signature « axion-ia.com », en bas à gauche de la zone sûre. */
  signature: 24,
  /** Épaisseur des traits du crayon (souligné, entouré, barré, coche), et marge de l'entouré autour du texte. */
  trait: 4,
  margeEntoure: 16,
} as const);

/** Approche (espacement des lettres) : −0,39 px pour 52 px, comme la maquette. */
export const APPROCHE_REFERENCE = -0.0075;

/** Opacité de la signature (écrite à l'encre, discrète). */
export const OPACITE_SIGNATURE = 0.36;
export const SIGNATURE_REFERENCE = "axion-ia.com";

/** Rythme du crayon (secondes), celui de la maquette animée. */
export const RYTHME_REFERENCE = Object.freeze({
  /** Vitesse d'écriture (px de référence par seconde) : le bord dévoilé avance à vitesse constante. */
  vitessePxParSec: 620,
  /** Une ligne courte ne s'écrit jamais en moins de… */
  ligneMinSec: 0.3,
  /** Déplacement du crayon d'un bloc au suivant. */
  deplacementSec: 0.3,
  /** Retour à la ligne, dans un même bloc. */
  retourSec: 0.12,
  /** Dessin : la pointe trace le contour, puis la couleur se pose pendant que le crayon repart. */
  versDessinSec: 0.25,
  contourSec: 0.5,
  couleurSec: 0.3,
  /** Geste du crayon (souligner, entourer, barrer, cocher, pointer). */
  gesteSec: 0.5,
  /** Arrivée du crayon sur une page blanche, et pose à la fin. */
  arriveeSec: 0.3,
  poseSec: 0.3,
  /** Plus forte réduction des durées quand la scène est courte. */
  reductionMin: 0.25,
} as const);

/** Le crayon : inclinaison pendant l'écriture (corps vers le bas à droite, sur la page encore vide) et posé à la fin. */
export const CRAYON_REFERENCE = Object.freeze({
  /** Longueur du crayon (px de référence, pointe → gomme) : 70 % de la maquette (264), pour ne pas cacher le texte. */
  longueur: 185,
  /** Épaisseur du corps (px de référence). */
  epaisseur: 23,
  /** Inclinaison (degrés, sens horaire depuis l'horizontale vers la droite) : 50 = corps vers le bas à droite. */
  angle: 50,
  /** Posé, presque couché, sous le dernier bloc de la page finie. */
  anglePose: -6,
  /** Tremblement naturel (px de référence), plus marqué quand la mine touche le papier. */
  tremblement: 1,
  tremblementRepos: 0.6,
} as const);

/** Fin de la vidéo : la page finie tient 2,5 s après la voix, puis 0,4 s de fondu (comme le style « blocs/2 »). */
export const FIN_REFERENCE = Object.freeze({ tenueApresVoixMs: 2500, fonduImageMs: 400 });

/** Rôle d'une ligne de la fiche → couleur de son bloc. */
export function couleurDuRole(role: string | undefined): string {
  if (role === "alerte") return COULEURS_REFERENCE.terracotta;
  if (role === "resultat" || role === "avantage") return COULEURS_REFERENCE.sauge;
  return COULEURS_REFERENCE.encre;
}

/** Ton d'une ligne de preuve → couleur : « Avant » terracotta, « Après » sauge, sinon encre. */
export function couleurDuTon(ton: "avant" | "apres" | undefined): string {
  return ton === "avant" ? COULEURS_REFERENCE.terracotta : ton === "apres" ? COULEURS_REFERENCE.sauge : COULEURS_REFERENCE.encre;
}

/* ------------------------------------------------------------------ */
/* Style « reference/2 » : gabarit de page clair (14/10/2026)            */
/* ------------------------------------------------------------------ */

/**
 * Style « reference/2 » : le style « reference/1 » (même fond, même crayon, mêmes trois couleurs, Montserrat
 * ExtraBold) avec un GABARIT de page clair (maquette `maquettes/tableau-gabarit-clair/`). Corrections après regard de
 * la maquette (14/10) : texte un tiers plus grand et page répartie sur la zone sûre, la page commençant en haut. Après
 * la première vraie vidéo (14/10) : titre 90 px, phrase clé 72, détails 54 (sur 1080 de large), texte couvrant 85 à
 * 90 % de la zone sûre ; une page restée courte est centrée.
 */
export const STYLE_REFERENCE_2 = "reference/2";

/** Teintes pâles (formes seulement, jamais du texte) : filet des détails, halo du point courant, tache des dessins. */
export const TEINTES_PALES_GABARIT = Object.freeze({ terracotta: "#EED3C4", sauge: "#D6E3D6" } as const);

/** Tailles du gabarit clair (px de référence, 1080 de large). */
export const TAILLES_GABARIT = Object.freeze({
  /**
   * Trois tailles de texte : titre, phrase clé (et éléments de « À retenir », et l'appel), détails (et avant / après).
   * Agrandies le 14/10 après regard de Will sur la première vraie vidéo (« bas de page vide ») : 84 / 66 / 50 → 90 / 72 / 54.
   */
  titre: 90,
  phrase: 72,
  detail: 54,
  /** Étiquettes (« Exemple », « AVANT », « APRÈS ») et chiffre des puces : jamais sous la taille des détails. */
  etiquette: 46,
  /**
   * Plus petites tailles permises quand une page chargée (ou une sortie basse) doit tenir : les minimums lisibles
   * (14/10, après la vidéo v-b19aefb21d57 : 62 / 50 → 70 / 56). Plus bas, la page passe à une page de plus.
   */
  titreMin: 70,
  phraseMin: 56,
  detailMin: 44,
  /** Interlignes (multiples de la taille). */
  interligneTitre: 1.12,
  interlignePhrase: 1.2,
  interligneDetail: 1.3,
  /** Repère : points de progression, le courant plus gros, avec un halo. */
  point: 28,
  pointCourant: 44,
  ecartPoints: 18,
  halo: 7,
  /** Pastille numérotée (diamètre, en part de la taille du titre) et son écart au titre. */
  pastille: 1.42,
  ecartPastille: 30,
  /** Trait du titre souligné (épaisseur, et écart sous la ligne). */
  souligne: 9,
  ecartSouligne: 8,
  /** Filet des détails : largeur et retrait du texte. */
  filet: 8,
  retraitDetail: 36,
  /** Dessin, en haut à droite (côté) et sa tache pâle. */
  dessin: 150,
  /** Avant / après : largeur de la colonne des étiquettes, écart au texte, marges et rayon des étiquettes. */
  colonneEtiquette: 236,
  ecartEtiquette: 28,
  margeEtiquette: 16,
  rayonEtiquette: 14,
  /** « À retenir » : puce numérotée (diamètre en part de la taille de l'élément) et écart au texte. */
  puce: 1.12,
  ecartPuce: 26,
  /** Cadre de l'appel : marges intérieures et rayon. */
  margeAppelX: 38,
  margeAppelY: 26,
  rayonAppel: 30,
  /** Écarts de base entre les parties de la page (répartis ensuite pour remplir la page). */
  ecartRepere: 36,
  ecartTitre: 64,
  ecartPhrase: 56,
  ecartDetails: 30,
  ecartListe: 18,
  /** Une page peu chargée grandit au plus de ce facteur (titre ~99 px), avant d'ouvrir ses écarts. */
  grandirMax: 1.1,
  /** Un écart grandit au plus de ce facteur pour remplir la page (au-delà, la page ressemblerait à une diapositive). */
  ecartMaxFacteur: 4,
  /**
   * Bas visé du dernier élément, en part de la hauteur de la zone sûre : le texte de la page finie couvre 85 à 90 % de
   * la zone sûre (14/10, regard de Will sur la première vraie vidéo : pages remplies aux trois quarts seulement).
   */
  basVise: 0.92,
  /** Marges intérieures de la page dans la zone sûre (gauche, droite, haut, bas). */
  margeGauche: 24,
  margeDroite: 8,
  margeHaut: 20,
  margeBas: 20,
} as const);


/* ------------------------------------------------------------------ */
/* Style « reference/3 » : gabarit par parties, charte Axion (15/10/2026) */
/* ------------------------------------------------------------------ */

/**
 * Style « reference/3 » : le gabarit par PARTIES (regard de Will du 14/10 sur la vidéo v-f1739d6a4f51), habillé le
 * 15/10 aux couleurs de la charte Axion, direction A « Page ivoire » choisie par Will (maquette
 * `maquettes/tableau-charte-axion/`, PR #241 : « vraiment plus moderne », très clair, le crayon écrit toujours).
 *
 *  - QUATRE couleurs de charte, et leurs teintes dérivées seulement : encre `#110A05`, orange brûlé `#B44F29`, ivoire
 *    `#E9DCC8`, sable `#BFA88B`. Ni vert, ni rouge, ni jaune miel : le positif et le négatif se voient à la FORME
 *    (✓, ✕, texte barré, flèche).
 *  - Page ivoire très clair ; texte à l'encre ; UNE seule ligne en orange par page (le mot-clé), surlignée d'orange
 *    pâle ou entourée au crayon ; mentions (repère de partie, « Étape 2 sur 4 », détails) en brun foncé (contraste mesuré, voir `COULEURS_REFERENCE_3`).
 *  - Titres en Montserrat ExtraBold, très gros ; détails et mentions en Inter Medium.
 *  - Barre fine segmentée en haut, repère de partie discret (point sable + texte), une icône au trait fin par page,
 *    pastille d'étape à l'encre, carte arrondie pour l'exemple concret, page d'appel au même fond (bouton plein).
 *  - Bande basse réservée aux sous-titres communs du studio : la page n'y descend jamais.
 *
 * Tailles en px pour l'image de référence 1080 × 1920 (`k` = petit côté ÷ 1080).
 */
export const STYLE_REFERENCE_3 = "reference/3";

/** Couleurs du style « reference/3 » (charte Axion, direction A). Aucune autre couleur n'est dessinée. */
export const COULEURS_REFERENCE_3 = Object.freeze({
  /** Charte. */
  encre: "#110A05",
  accent: "#B44F29",
  ivoire: "#E9DCC8",
  sable: "#BFA88B",
  /** Teintes dérivées (maquette A). Fond de page : ivoire très clair. */
  fond: "#F6F1E8",
  /**
   * CONTRASTE (regard de Will du 15/10 : « il manque un peu de contraste ») : règle MESURÉE, tout texte ≥ 4,5 pour 1
   * (WCAG AA) sur son fond, tout trait, icône ou élément graphique porteur de sens ≥ 3 pour 1
   * (`tests/tableau/reference-3/contraste.test.ts`). Rapports donnés sur le fond `#F6F1E8`.
   *
   * Mentions (repère, étape, détails, « Avant », adresse du site) : brun foncé, un cran plus doux que l'encre (7,0 pour 1 ;
   * avant `#796955`, 4,7).
   */
  mention: "#5E4F3E",
  /** Texte en orange (le mot-clé, une ligne par page) et traits orange du crayon : orange brûlé assombri (6,1 pour 1 ;
   * 4,7 sur le surlignage). `accent` (#B44F29) reste celui des aplats (barre en cours). */
  accentTexte: "#993F1E",
  /** Carte de l'exemple concret (avant `#EEE5D7`) et son bord fin brun (3,7 pour 1). */
  carte: "#ECE1D0",
  bordCarte: "#8E7A62",
  /** Surlignage orange pâle, sous le mot-clé. */
  surlignage: "#E9D1C2",
  /** Barre des chapitres : le rail d'une partie pas finie (le reste à venir), nettement visible (3,3 pour 1 ; avant
   * `#E0D4C3`, 1,3). */
  barreFond: "#96816A",
  /** Nom d'un chapitre à venir (5,1 pour 1 ; avant `#BFA88B`, 2,0) : un cran plus doux que le nom d'un chapitre fait. */
  chapitreAVenir: "#75644F",
  /** Élément de « À retenir » pas encore dit (même teinte, avant `#BFA88B`). */
  attente: "#75644F",
  /** Icône au trait (avant le sable `#BFA88B`, 2,0 pour 1) : brun foncé du crayon (12,0 pour 1). */
  icone: "#3A2C20",
  /**
   * VISUELS DESSINÉS ET PEPS (maquette validée par Will le 15/10, PR #260) : trait du crayon (mine brune, 14,3 pour 1),
   * hachures sable (texture de remplissage, jamais porteuse de sens : le contour à la mine la porte), marqueur orange
   * franc qui balaie sous le mot-clé (fond du texte à l'encre, 11,6 pour 1), trace du temps du chrono (orange pâle).
   * La touche orange d'un visuel et le BLOC ORANGE plein sont à l'`accent` (#B44F29) ; le texte du bloc est ivoire
   * (`fond`, 4,56 pour 1 sur l'accent : mesuré, ≥ 4,5).
   */
  mine: "#2B1F16",
  hachure: "#BFA88B",
  marqueur: "#E2C0AF",
  traceTemps: "#E9D1C2",
} as const);

/** Couleurs du crayon de la charte (corps brun ; bois, bague et gomme dans les teintes de la charte). */
export const CRAYON_REFERENCE_3 = Object.freeze({
  corps: ["#3A2C20", "#241811", "#110A05"] as readonly string[],
  bois: "#E9DCC8",
  veine: "#BFA88B",
  bague: "#BFA88B",
  stries: "#8E7A62",
  gomme: "#D8C7AE",
  trait: "#110A05",
  mine: "#110A05",
  ombre: "rgba(17,10,5,.22)",
});

/** Repère de partie (jamais « Le problème » ni « La méthode » : c'est une DOULEUR, puis une SOLUTION). */
export const LIBELLES_PARTIES_3: Readonly<Record<string, string>> = Object.freeze({
  accroche: "L'accroche",
  douleur: "La douleur",
  solution: "La solution",
  exemple: "Exemple illustratif",
  retenir: "À retenir",
  appel: "À vous",
});

export function libellePartie3(role: string | undefined): string {
  return (role && LIBELLES_PARTIES_3[role]) || "";
}

/**
 * BARRE DES CHAPITRES NOMMÉS (choix de Will, 15/10/2026, variante « 1. Chapitres nommés ») : en haut de la page, UNE
 * barre arrondie par chapitre présent dans la vidéo, son nom en petit dessous. Quatre chapitres au plus, dans l'ordre :
 * Douleur, Solution, Exemple, À vous. Règle de rattachement (la plus lisible : jamais plus de 4 barres, jamais un
 * chapitre qui recule) :
 *  - l'ACCROCHE est la douleur dite en une phrase : elle ouvre le chapitre « Douleur » ;
 *  - « À RETENIR » est le résumé qui prépare l'appel : il ouvre le chapitre « À vous » (s'il n'y a pas d'appel, il
 *    reste dans le chapitre qui le précède).
 * Deux pages de suite du même chapitre ne font qu'une barre.
 */
export const CHAPITRES_3: readonly { id: string; nom: string }[] = Object.freeze([
  { id: "douleur", nom: "Douleur" },
  { id: "solution", nom: "Solution" },
  { id: "exemple", nom: "Exemple" },
  { id: "appel", nom: "À vous" },
]);

/** Chapitre de chaque partie (voir `CHAPITRES_3`) ; « retenir » n'en a qu'en présence d'un appel. */
const CHAPITRE_DE_PARTIE_3: Readonly<Record<string, string>> = Object.freeze({ accroche: "douleur", douleur: "douleur", solution: "solution", exemple: "exemple", retenir: "appel", appel: "appel" });

/**
 * Chapitres d'une suite de parties (dans l'ordre de la vidéo) : pour chaque partie, l'id de son chapitre (`""` : aucun,
 * partie inconnue en tête de vidéo). « À retenir » sans page d'appel reste dans le chapitre précédent.
 */
export function chapitresDesParties3(roles: readonly string[]): string[] {
  const avecAppel = roles.includes("appel");
  const res: string[] = [];
  for (const role of roles) {
    const c = role === "retenir" && !avecAppel ? undefined : CHAPITRE_DE_PARTIE_3[role];
    res.push(c ?? res.at(-1) ?? "");
  }
  return res;
}

export function nomChapitre3(id: string): string {
  return CHAPITRES_3.find((c) => c.id === id)?.nom ?? "";
}

/**
 * Remplissage de la barre du chapitre en cours : temps écoulé dans le chapitre ÷ sa durée, adouci aux deux bouts (la
 * moitié de la courbe du style : la barre démarre et s'arrête en douceur, sans jamais s'éloigner du temps de plus de 6 %).
 */
export function remplissageChapitre3(x: number): number {
  const u = Math.max(0, Math.min(1, x));
  return 0.5 * u + 0.5 * u * u * (3 - 2 * u);
}

/** Icône au trait d'une page sans dessin (dessins de la banque, tracés au trait fin). */
export const ICONES_PARTIES_3: Readonly<Record<string, string>> = Object.freeze({
  accroche: "document",
  douleur: "eclair",
  solution: "ampoule",
  exemple: "fleche-boucle",
  retenir: "liste-cochee",
  appel: "calendrier",
});

/** Texte du bouton de la page d'appel. */
export const BOUTON_APPEL_3 = "Réservez un appel de diagnostic";

/** Tailles (px de référence, 1080 de large). */
export const TAILLES_GABARIT_3 = Object.freeze({
  /** L'accroche (la douleur), en très grand dès la première image. */
  accroche: 112,
  accrocheMin: 80,
  /** Texte principal (titre, phrase clé) : Montserrat ExtraBold, jamais sous 72 px. */
  titre: 110,
  titreMin: 76,
  phrase: 80,
  phraseMin: 72,
  /** Détails (Inter Medium) : jamais sous 52 px. */
  detail: 60,
  detailMin: 52,
  /** Éléments de liste (pastilles, cases, « À retenir ») et exemple concret. */
  item: 60,
  itemMin: 52,
  /** Phrase finale de la page d'appel, bouton, adresse du site. */
  appel: 104,
  appelMin: 72,
  bouton: 60,
  site: 56,
  /** Repère de partie (Inter Medium, sable assombri) et son point sable. */
  partie: 52,
  point: 14,
  /** Pastille d'étape (diamètre) et « Étape 2 sur 4 ». */
  pastille: 128,
  etape: 56,
  /** Icône au trait (côté) et épaisseur de son trait (grille 24). */
  icone: 112,
  traitIcone: 2,
  /** Interlignes. */
  interligneAccroche: 1.08,
  interligneTitre: 1.06,
  interlignePhrase: 1.1,
  interligneDetail: 1.3,
  /**
   * Barre des chapitres (px de référence, 1080 de large, maquette « Chapitres nommés ») : hauteur d'une barre (~1,3 %
   * de la largeur), écart entre deux barres (~1,5 %), écart barre → nom, taille du nom (Inter SemiBold, ~3,2 %) et son
   * espacement des lettres (em).
   */
  barre: 14,
  ecartBarre: 16,
  ecartNomChapitre: 12,
  nomChapitre: 34,
  approcheNomChapitre: 0.02,
  /** Écarts : barre des chapitres → repère (ou contenu), repère → contenu, entre deux blocs, entre deux éléments de liste. */
  ecartEtiquette: 40,
  ecartContenu: 60,
  ecartBlocs: 64,
  ecartItems: 26,
  /** Disque d'une liste à pastilles et case (en part de l'élément) ; écart au texte. */
  disque: 1.15,
  case: 0.9,
  ecartPuce: 30,
  /** Traits du crayon (entouré, barré, coche, flèche) ; 6 avant le 15/10 (contraste). */
  trait: 7.5,
  /** Bord fin de la carte de l'exemple concret. */
  bordCarte: 2.5,
  /** Carte de l'exemple concret : marges intérieures et rayon. */
  margeCarteX: 44,
  margeCarteY: 36,
  rayonCarte: 40,
  /** Bouton de la page d'appel : marges intérieures et rayon. */
  margeBoutonX: 56,
  margeBoutonY: 40,
  rayonBouton: 48,
  /** Surlignage : haut (part de la ligne, depuis son haut) et épaisseur (part de la ligne). */
  surlignageHaut: 0.5,
  surlignageHauteur: 0.36,
  /** Bande basse réservée aux sous-titres (px de référence, en bas de la zone sûre, par sortie), et l'air au-dessus. */
  bandeSousTitres: { vertical: 150, portrait: 140, carre: 120, horizontal: 120 },
  airSousTitres: 24,
  /**
   * Une page peu chargée grandit au plus de ce facteur (sans dépasser les plafonds) ; ses écarts s'ouvrent au plus de
   * ce facteur (entre deux blocs, entre deux éléments d'une liste).
   */
  grandirMax: 1.5,
  ecartMaxFacteur: 4.5,
  /** Plafonds (px de référence) : une page très légère ne grossit pas au-delà ; elle s'aère. */
  plafonds: { accroche: 150, titre: 140, phrase: 108, detail: 72, item: 76, appel: 120 },
  /** Ce qui ARRIVE avec la page (titre, phrase qui le suit) grandit encore, jusqu'à ces plafonds (15/10). */
  grandirTeteMax: 1.6,
  plafondsTete: { accroche: 150, titre: 150, phrase: 120, detail: 76, item: 80, appel: 120 },
  teteVisee: 0.55,
  /**
   * Le CONTENU fini de la page couvre au moins cette part de la hauteur utile (sous le repère, jusqu'au bas de la zone
   * sûre) et son centre est au plus à `centreEcartMax` du centre de la zone sûre. La mise en page vise `remplissageVise`.
   */
  remplissageMin: 0.6,
  remplissageVise: 0.68,
  centreEcartMax: 0.12,
  /** Décalage du centre du contenu au-dessus du centre de la zone utile (part de la hauteur de la zone sûre). */
  centreOptique: 0.02,
} as const);

/**
 * Tailles VISÉES (px réels) par sortie : en vertical (1080 × 1920) titre 110, phrase clé 80, détails et listes 60 ; un
 * peu moins dans les sorties plus basses. Une page qui ne tient pas descend vers les minimums de sa sortie
 * (`MINIMUMS_GABARIT_3`), jamais plus bas.
 */
export const CIBLES_GABARIT_3: Readonly<Record<"vertical" | "portrait" | "carre" | "horizontal", { accroche: number; titre: number; phrase: number; detail: number; item: number; appel: number }>> = Object.freeze({
  vertical: { accroche: 112, titre: 110, phrase: 80, detail: 60, item: 60, appel: 104 },
  portrait: { accroche: 100, titre: 100, phrase: 76, detail: 58, item: 58, appel: 96 },
  carre: { accroche: 92, titre: 90, phrase: 72, detail: 54, item: 54, appel: 88 },
  horizontal: { accroche: 96, titre: 96, phrase: 72, detail: 56, item: 56, appel: 92 },
});

/**
 * Plus petites tailles permises par sortie (px réels). Vertical : texte principal 72, détails 52 (décision de Will).
 * Les sorties basses (carré, horizontal), où la bande des sous-titres prend plus de place, descendent un peu plus.
 */
export const MINIMUMS_GABARIT_3: Readonly<Record<"vertical" | "portrait" | "carre" | "horizontal", { accroche: number; titre: number; phrase: number; detail: number; item: number; appel: number }>> = Object.freeze({
  vertical: { accroche: 80, titre: 76, phrase: 72, detail: 52, item: 52, appel: 72 },
  portrait: { accroche: 80, titre: 76, phrase: 72, detail: 52, item: 52, appel: 72 },
  carre: { accroche: 68, titre: 64, phrase: 56, detail: 46, item: 46, appel: 60 },
  horizontal: { accroche: 72, titre: 68, phrase: 60, detail: 48, item: 48, appel: 64 },
});

/**
 * VISUELS DESSINÉS ET PEPS (maquette validée par Will le 15/10, PR #260), px de référence (1080 de large) :
 *  - le visuel occupe 35 à 45 % de la largeur de référence (son encre, mouvements compris), vise 40 % ;
 *  - il ne touche jamais un texte : 12 px d'air au moins (on en pose `ecartVisuel`) ; jamais dans la bande des
 *    sous-titres ;
 *  - le bloc orange plein (texte ivoire en Montserrat ExtraBold, compteur facultatif en très grand) : marges, rayon ;
 *  - la flèche dessinée (texte → visuel) : épaisseur du trait.
 */
export const VISUELS_GABARIT_3 = Object.freeze({
  partMin: 0.35,
  partMax: 0.45,
  partVisee: 0.4,
  airMin: 12,
  ecartVisuel: 40,
  bloc: { taille: 72, tailleCompteur: 178, margeX: 40, margeY: 20, ecartCompteur: 30, rayon: 40, tailleMin: 56 },
  traitFleche: 7,
} as const);

/**
 * Rythme du visuel et des gestes de peps (secondes, maquette) : le visuel se trace en `visuelSec` ; le bloc orange
 * apparaît en rebond (`blocSec`), son compteur défile en `compteurSec` ; la poussée douce (×1,06 puis retour) dure
 * `pousseeSec`, calée sur l'instant où la voix dit le mot ; le marqueur balaie en `marqueurSec` ; la pastille d'étape
 * rebondit en `pastilleSec` ; la flèche dessinée prend `flecheSec` (+ `teteSec` pour sa pointe).
 */
export const PEPS_REFERENCE_3 = Object.freeze({
  visuelSec: 1.7,
  /** Sur la première page, le visuel part après… (s) : la première image (la miniature) montre l'accroche seule. */
  premierVisuelSec: 0.4,
  blocSec: 0.5,
  compteurSec: 0.55,
  pousseeSec: 0.5,
  pousseeAmplitude: 0.06,
  marqueurSec: 0.42,
  pastilleSec: 0.55,
  flecheSec: 0.42,
  teteSec: 0.16,
} as const);

/** Rythme et mouvement du style (secondes) : UNE courbe pour tout, une transition de page, une écriture rapide. */
export const RYTHME_REFERENCE_3 = Object.freeze({
  /**
   * Transition de page « fondu + montée » (maquette A) : la page d'avant monte un peu et s'efface en `sortieSec`, la
   * nouvelle arrive d'un peu plus bas en `fonduMonteeSec`. Le crayon reprend à `transitionSec` (la nouvelle page est
   * déjà presque en place : jamais de retard d'écriture dû à la transition).
   */
  transitionSec: 0.4,
  fonduMonteeSec: 0.85,
  sortiePageSec: 0.45,
  /** Montée de la page qui arrive, et de celle qui part (px de référence). */
  monteeArriveePx: 90,
  monteeDepartPx: 70,
  /** Vitesse d'écriture (px de référence par seconde) ; une ligne jamais en moins de… */
  vitessePxParSec: 1700,
  ligneMinSec: 0.18,
  /** Marge avant la fin de la phrase dite : le bloc est fini un peu AVANT que la voix ait fini de le dire. */
  avanceSec: 0.1,
  /** Déplacement du crayon, trait d'un geste (souligné, entouré, barré, coche), retour à la ligne. */
  deplacementSec: 0.22,
  gesteSec: 0.32,
  retourSec: 0.06,
  /** Apparition (fondu + montée) d'un repère, d'une case, d'une carte ; pastille avec léger rebond ; icône tracée. */
  apparitionSec: 0.26,
  rebondSec: 0.36,
  iconeSec: 0.5,
  /** Surlignage orange pâle, tracé sous le mot-clé. */
  surlignageSec: 0.5,
  /** Crayon : au repos plus de `sortieSec`, il quitte la page (et y revient) ; il ne tremble jamais. */
  sortieSec: 0.9,
  /**
   * Page d'appel : jamais immobile plus de `immobileMaxSec`. Après son arrivée, le crayon souligne l'adresse du site
   * (à `appelSouligneSec`), puis le bouton bat doucement (échelle 1 → 1 + `battementAmplitude` → 1, en
   * `battementSec`), le premier à `battementPremierSec`, puis toutes les `battementPeriodeSec`.
   */
  immobileMaxSec: 3,
  appelSouligneSec: 1.6,
  battementPremierSec: 3.6,
  battementPeriodeSec: 2.4,
  battementSec: 0.9,
  battementAmplitude: 0.035,
} as const);

/**
 * La courbe du style (douce à l'entrée et à la sortie, la même pour tout mouvement : transition, crayon, traits).
 * Équivalent de cubic-bezier(0.45, 0, 0.25, 1) en plus simple : une cubique symétrique adoucie.
 */
export function courbeReference3(x: number): number {
  const u = Math.max(0, Math.min(1, x));
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** Sortie douce (la page qui arrive ralentit en fin de montée). */
export function sortieReference3(x: number): number {
  const u = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - u, 3);
}

/** Léger rebond (apparition des pastilles) : monte à 1,05 puis revient à 1. */
export function rebondReference3(x: number): number {
  const u = Math.max(0, Math.min(1, x));
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

/** Signes des codes (grille 24, tracés en ivoire dans le disque à l'encre) : ✓ on peut, ✎ avec précaution, ✕ jamais. */
export const SIGNES_CODES_3 = Object.freeze({ vert: "M6 12.5l4 4 8-9", orange: "M6 18l1-4 8.5-8.5 3 3L10 17l-4 1z M13.5 7.5l3 3", rouge: "M7 7l10 10 M17 7L7 17" } as const);
