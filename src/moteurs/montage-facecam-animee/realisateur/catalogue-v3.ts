/**
 * CATALOGUE DES 23 ÉLÉMENTS « v3 » (face caméra animée, 16/10/2026) — PUR.
 *
 * Will a REJETÉ le style v2 (papier, autocollants). La direction v3 est la vidéo de référence MODERNISÉE : grandes fenêtres vidéo,
 * cartes en verre, profondeur, typographie vivante, coups de poing (`docs/facecam-animee-v3/STANDARD-DA-V3-2026-10-16.md`). Les 23
 * éléments sont codés dans `studio-rendu/compositions/interface-claire/motion-v3/lotA..lotE/` ; ce catalogue en est la FICHE LISIBLE
 * PAR LE RÉALISATEUR (consigne Opus, `consignes.ts`) ET PAR LES RÈGLES (`regles-v3.ts`). Le catalogue v2 (`catalogue-v2.ts`) reste
 * dans le code mais le réalisateur ne l'utilise plus.
 *
 * ┌─ `actif` est le SEUL endroit à changer pour retenir ou écarter un élément. ────────────────────────────────────────────────┐
 * │ true  (14) : le CHOIX DE WILL du 16/10 — mosaique-videos, mot-derriere, fenetre-plein-cadre, carte-verre, bande-video,       │
 * │              dalle-claquee, fenetre-telephone, notifications-verre, cercle-epaule, duel-video, rafale-trois-mots,           │
 * │              fenetre-double, eclat-chiffre, mot-saute ;                                                                      │
 * │ false (9)  : fenetre-pivot, pilule-cote, arche-bas, carte-preuve, widget-chiffre, carte-retournee, mot-vertical-bord,       │
 * │              citation-verre, mot-fenetre — Will ne les a PAS vus : ils attendent son avis.                                  │
 * │ Un plan qui emploie un élément inactif est refusé par le contrôle (D0).                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * « Famille » = le lot de l'élément (fenêtres sur le visage, formes vidéo, cartes en verre, typographie, coups de poing) : la règle
 * « jamais deux fois de suite la même famille » interdit donc d'enchaîner deux fenêtres, deux cartes, etc.
 * « Coup de poing » = plein écran (visage entièrement couvert, `emplacement: "plein-ecran"`).
 *
 * D'où viennent les chiffres : les en-têtes et constantes des .tsx (emprises `RECT_*`, durées `DUREE_*`, sons `SONS_*` /
 * `bruitages*`), le standard § G, la critique du 16/10. Une taille ou une emprise qui n'est pas écrite dans le .tsx est une
 * ESTIMATION et porte `tailleSource: "estimée"` : à mesurer sur le rendu avant de s'y fier à 1 %. `imagesVisagePartiel` vient de la
 * critique du 16/10 (comptage image par image à 30 i/s, extraits isolés) : ce n'est PAS une mesure sur le rendu final.
 */

export const EMPLACEMENTS_V3 = ["sur-le-visage", "haut", "gauche", "droite", "bas", "diagonale", "plein-ecran"] as const;
export type EmplacementV3 = (typeof EMPLACEMENTS_V3)[number];

export const FAMILLES_V3 = ["fenetre", "forme-video", "carte-verre", "typographie", "coup-de-poing"] as const;
export type FamilleV3 = (typeof FAMILLES_V3)[number];
export const LOT_DE_FAMILLE_V3: Readonly<Record<FamilleV3, "A" | "B" | "C" | "D" | "E">> = Object.freeze({
  fenetre: "A", "forme-video": "B", "carte-verre": "C", typographie: "D", "coup-de-poing": "E",
});

/** Rectangle posé (fractions de l'image : x en largeur, y en hauteur). */
export interface RectV3 { x0: number; y0: number; x1: number; y1: number }

/**
 * Zone interdite Z du visage (prise commune ; recalculée par prise dans `cadrage.ts`) : la boîte du visage cheveux et menton compris
 * (x 0,27-0,73, y 0,14-0,56) + 0,02. « Entier » : aucun pixel de l'élément posé dans Z ; « couvert » : Z entièrement sous l'élément.
 */
export const ZONE_VISAGE_V3: Readonly<RectV3> = Object.freeze({ x0: 0.25, y0: 0.12, x1: 0.75, y1: 0.58 });
/** Hauteur des yeux de la prise commune (fraction de H) et marge de la bande interdite aux sous-titres autour d'eux. */
export const YEUX_V3 = 0.34;
export const GARDE_YEUX_V3 = 0.03;

/** Un bruitage : `ref` = instant de référence (début ou fin de l'élément), `decalage` en secondes (négatif = avant la fin). */
export interface BruitageV3 { ref: "debut" | "fin"; decalage: number; son: string; volume: number }

export interface FicheCatalogueV3 {
  /** Identifiant du .tsx (`ID_*`). */
  id: string;
  /** Numéro du standard v3 (1 à 24 ; le 9, `blob-video`, est abandonné). */
  numero: number;
  lot: "A" | "B" | "C" | "D" | "E";
  famille: FamilleV3;
  nom: string;
  /** Chemin du .tsx depuis la racine du dépôt, et nom du composant exporté. */
  fichier: string;
  composant: string;
  emplacement: EmplacementV3;
  /** Forme (masque K1-K10 du standard § C.2, ou carte/typo) et mouvement d'entrée principal. */
  forme: string;
  mouvement: string;
  sortie: string;
  /** Inclinaison posée, en degrés (informatif). */
  angle: number;
  /** Le visage est couvert EN ENTIER à l'état posé ; sinon il reste entier. Jamais à moitié (décision de Will). */
  couvreVisage: boolean;
  /** Le mot est derrière la tête (détourage) : le visage reste entier même si le rectangle recoupe Z. */
  derriereVisage: boolean;
  /** Plein écran qui couvre le visage : un « coup de poing » (jamais avant 8 s, au plus un par 20 à 25 s). */
  coupDePoing: boolean;
  /** Images pendant lesquelles le visage est PARTIELLEMENT couvert au passage de l'élément (tolérance de Will : 3 au plus). */
  imagesVisagePartiel: number;
  /** Emprise posée (fractions de l'image). */
  rect: RectV3;
  /** Taille de la silhouette posée, en % de l'image. */
  taillePct: number;
  tailleSource: "en-tête" | "fiche" | "estimée";
  /** Centre horizontal de l'élément posé (fraction de la largeur). */
  centreX: number;
  /** Durée de l'élément, en secondes (min, max) et en images à 30 i/s. */
  dureeSec: readonly [number, number];
  dureeImages: readonly [number, number];
  /** Ce que l'élément montre, et combien de textes (`mots`) et de lignes datées (`lignes`) il en prend. */
  contenu: string;
  textes: readonly [number, number];
  lignes: readonly [number, number];
  /** Nombre de vidéos (B-roll littéraux) qu'il faut lui fournir. */
  videos: readonly [number, number];
  /** Il faut un NOMBRE dit par Will (jamais un chiffre inventé). */
  exigeNombreDit: boolean;
  /** Quand l'utiliser, en une phrase. */
  quand: string;
  /** Hauteur du centre des sous-titres pendant l'élément (fraction de H) ; `null` : sous-titres masqués (plein écran). */
  sousTitresY: number | null;
  /** La prise de Will DESCEND sous l'élément (descente permise par Will, `carte-verre` seulement). */
  descentePrise: boolean;
  bruitages: readonly BruitageV3[];
  /** Apparitions au plus par vidéo. */
  maxParVideo: number;
  /** ★ LE SEUL CHAMP À CHANGER pour retenir ou écarter l'élément (voir l'en-tête). */
  actif: boolean;
}

const D = "studio-rendu/compositions/interface-claire/motion-v3";
const img = (s: readonly [number, number]) => [Math.round(s[0] * 30), Math.round(s[1] * 30)] as const;
const b = (ref: BruitageV3["ref"], decalage: number, son: string, volume: number): BruitageV3 => ({ ref, decalage, son, volume });

type Saisie = Omit<FicheCatalogueV3, "fichier" | "dureeImages" | "lot" | "famille" | "derriereVisage" | "coupDePoing" | "descentePrise" | "lignes" | "videos" | "exigeNombreDit"> & {
  famille: FamilleV3;
  fichierTsx: string;
  lignes?: readonly [number, number];
  videos?: readonly [number, number];
  exigeNombreDit?: boolean;
  derriereVisage?: boolean;
  descentePrise?: boolean;
};

function fiche(s: Saisie): FicheCatalogueV3 {
  const { fichierTsx, lignes, videos, exigeNombreDit, derriereVisage, descentePrise, ...reste } = s;
  const lot = LOT_DE_FAMILLE_V3[s.famille];
  return Object.freeze({
    ...reste,
    lot,
    fichier: `${D}/lot${lot}/${fichierTsx}`,
    dureeImages: img(s.dureeSec),
    lignes: lignes ?? ([0, 0] as const),
    videos: videos ?? ([0, 0] as const),
    exigeNombreDit: exigeNombreDit ?? false,
    derriereVisage: derriereVisage ?? false,
    descentePrise: descentePrise ?? false,
    coupDePoing: s.emplacement === "plein-ecran",
    bruitages: Object.freeze([...s.bruitages]),
  });
}

const PLEIN: RectV3 = Object.freeze({ x0: 0, y0: 0, x1: 1, y1: 1 });
const K1: RectV3 = Object.freeze({ x0: 0.05, y0: 0.11, x1: 0.86, y1: 0.68 });

export const CATALOGUE_V3: readonly FicheCatalogueV3[] = Object.freeze([
  /* ---------------- Lot A « Fenêtres sur le visage » ---------------- */
  fiche({ id: "fenetre-pivot", numero: 1, famille: "fenetre", nom: "Fenêtre vidéo qui pivote", fichierTsx: "FenetrePivot.tsx", composant: "FenetrePivot",
    emplacement: "sur-le-visage", forme: "K1 carte arrondie inclinée", mouvement: "pivot-lateral", sortie: "fouet-lateral", angle: -2.5,
    couvreVisage: true, imagesVisagePartiel: 2, rect: K1, taillePct: 46, tailleSource: "en-tête", centreX: 0.455, dureeSec: [1.2, 3.0],
    contenu: "1 B-roll littéral et une puce-étiquette (1 mot dit, en capitales)", textes: [1, 1], videos: [1, 1],
    quand: "Une action ou un lieu concret que Will nomme : on le montre en grand sur son visage.", sousTitresY: 0.8, bruitages: [b("debut", 0, "whoosh-in", 0.1), b("fin", -0.2, "whoosh-out", 0.08)], maxParVideo: 3, actif: false }),
  fiche({ id: "fenetre-telephone", numero: 2, famille: "fenetre", nom: "Fenêtre en écran de téléphone", fichierTsx: "FenetreTelephone.tsx", composant: "FenetreTelephone",
    emplacement: "sur-le-visage", forme: "K2 écran de téléphone", mouvement: "bascule-bas", sortie: "rechute-bas", angle: 3,
    couvreVisage: true, imagesVisagePartiel: 3, rect: { x0: 0.1975, y0: 0.065, x1: 0.8025, y1: 0.705 }, taillePct: 38.7, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.5, 3.0],
    contenu: "1 B-roll vertical (écran d'appli, geste) et une puce-étiquette (1 mot dit)", textes: [1, 1], videos: [1, 1],
    quand: "Une application, un message, un appel : tout ce qui se passe sur un téléphone.", sousTitresY: 0.835,
    bruitages: [b("debut", 0, "maximize_004", 0.1), b("debut", 22 / 30, "tick_001", 0.08), b("fin", -0.2, "minimize_004", 0.08)], maxParVideo: 3, actif: true }),
  fiche({ id: "fenetre-double", numero: 3, famille: "fenetre", nom: "Double fenêtre (deux exemples)", fichierTsx: "FenetreDouble.tsx", composant: "FenetreDouble",
    emplacement: "sur-le-visage", forme: "K3 double fenêtre", mouvement: "pivot-puis-diagonale", sortie: "fouet-decale", angle: -3,
    couvreVisage: true, imagesVisagePartiel: 3, rect: { x0: 0.05, y0: 0.11, x1: 0.91, y1: 0.8 }, taillePct: 52, tailleSource: "estimée", centreX: 0.48, dureeSec: [2.0, 3.0],
    contenu: "2 B-roll (deux exemples, un avant / un après) et 2 puces-étiquettes (2 mots dits)", textes: [2, 2], videos: [2, 2],
    quand: "Deux choses dites ensemble : avant / après, deux exemples, deux cas.", sousTitresY: 0.075,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 14 / 30, "drop_001", 0.08), b("fin", -0.47, "select_002", 0.06), b("fin", -0.2, "whoosh-out", 0.08)], maxParVideo: 2, actif: true }),
  fiche({ id: "fenetre-plein-cadre", numero: 4, famille: "fenetre", nom: "Fenêtre qui s'ouvre en plein cadre", fichierTsx: "FenetrePleinCadre.tsx", composant: "FenetrePleinCadre",
    emplacement: "plein-ecran", forme: "K4 plein cadre", mouvement: "pivot-rapide-puis-ouverture", sortie: "fermeture-en-cercle", angle: 0,
    couvreVisage: true, imagesVisagePartiel: 3, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.5, 2.5],
    contenu: "1 B-roll plein cadre (sans zoom) et une grande puce en verre (1 mot dit)", textes: [1, 1], videos: [1, 1],
    quand: "Le moment fort d'une scène concrète que Will décrit : la vidéo prend tout l'écran.", sousTitresY: null,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 20 / 30, "maximize_006", 0.1), b("fin", -0.5, "minimize_004", 0.08)], maxParVideo: 1, actif: true }),

  /* ---------------- Lot B « Formes vidéo, visage entier » ---------------- */
  fiche({ id: "pilule-cote", numero: 5, famille: "forme-video", nom: "Pilule vidéo sur le côté", fichierTsx: "PiluleCote.tsx", composant: "PiluleCote",
    emplacement: "gauche", forme: "K5 pilule verticale", mouvement: "depliage", sortie: "repliage-haut", angle: -2.5,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0, y0: 0.1, x1: 0.214, y1: 0.6 }, taillePct: 10.7, tailleSource: "en-tête", centreX: 0.107, dureeSec: [1.5, 3.0],
    contenu: "1 B-roll vertical net et une puce sous la pilule (1 mot dit) ; miroir à droite permis", textes: [1, 1], videos: [1, 1],
    quand: "Un geste ou un objet dit, en gros plan vertical, à côté du visage.", sousTitresY: 0.075, bruitages: [b("debut", 0, "whoosh-in", 0.08), b("fin", -0.2, "whoosh-out", 0.06)], maxParVideo: 3, actif: false }),
  fiche({ id: "cercle-epaule", numero: 6, famille: "forme-video", nom: "Cercle vidéo sous l'épaule", fichierTsx: "CercleEpaule.tsx", composant: "CercleEpaule",
    emplacement: "bas", forme: "K6 cercle avec anneau orange", mouvement: "ouverture-masque", sortie: "aspiration-bord", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.44, y0: 0.614, x1: 0.96, y1: 0.906 }, taillePct: 11.9, tailleSource: "en-tête", centreX: 0.7, dureeSec: [1.2, 2.5],
    contenu: "1 B-roll carré net dans un cercle cerné d'un anneau orange qui se trace ; aucun texte ; miroir à gauche permis", textes: [0, 0], videos: [1, 1],
    quand: "Un détail concret que Will nomme (un outil, un objet, un lieu) : un coup d'œil sans cacher son visage.", sousTitresY: 0.075,
    bruitages: [b("debut", 0, "select_002", 0.08), b("debut", 0.3, "tick_002", 0.06)], maxParVideo: 3, actif: true }),
  fiche({ id: "bande-video", numero: 7, famille: "forme-video", nom: "Bande vidéo diagonale", fichierTsx: "BandeVideo.tsx", composant: "BandeVideo",
    emplacement: "diagonale", forme: "K7 bande diagonale", mouvement: "glissement-diagonal", sortie: "sortie-droite", angle: -12,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0, y0: 0.64, x1: 1, y1: 0.94 }, taillePct: 18, tailleSource: "estimée", centreX: 0.5, dureeSec: [1.2, 2.0],
    contenu: "1 B-roll paysage continu qui défile, et une puce au bout de la bande (1 mot dit)", textes: [1, 1], videos: [1, 1],
    quand: "Une action en mouvement (livrer, taper, parcourir) : la bande file sous le menton.", sousTitresY: 0.075, bruitages: [b("debut", 0, "whoosh-in", 0.08), b("fin", -0.2, "whoosh-out", 0.06)], maxParVideo: 3, actif: true }),
  fiche({ id: "arche-bas", numero: 8, famille: "forme-video", nom: "Arche vidéo en verre", fichierTsx: "ArcheBas.tsx", composant: "ArcheBas",
    emplacement: "droite", forme: "K8 arche", mouvement: "bascule-bas", sortie: "rechute-bas", angle: 3,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.765, y0: 0.09, x1: 0.975, y1: 0.66 }, taillePct: 12, tailleSource: "en-tête", centreX: 0.87, dureeSec: [1.5, 3.0],
    contenu: "1 B-roll vertical dans une arche de verre et une puce (1 mot dit) ; miroir à gauche permis", textes: [1, 1], videos: [1, 1],
    quand: "Une scène concrète dite, sur le côté droit, sans toucher au visage.", sousTitresY: 0.075, bruitages: [b("debut", 0, "drop_002", 0.08)], maxParVideo: 3, actif: false }),

  /* ---------------- Lot C « Cartes en verre » ---------------- */
  fiche({ id: "carte-verre", numero: 10, famille: "carte-verre", nom: "Carte en verre qui se remplit", fichierTsx: "CarteVerre.tsx", composant: "CarteVerre",
    emplacement: "haut", forme: "carte de verre ivoire", mouvement: "chute-3d", sortie: "fouet-haut", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.08, y0: 0.05, x1: 0.92, y1: 0.39 }, taillePct: 28.6, tailleSource: "en-tête", centreX: 0.5, dureeSec: [3, 8],
    contenu: "Un titre (1 mot ou groupe dit) et 2 à 4 lignes dites qui se tapent sur leurs mots ; la prise descend sous la carte", textes: [1, 1], lignes: [2, 4],
    quand: "Une liste, des étapes ou des tâches que Will énumère : la carte les écrit au fil de sa voix.", sousTitresY: 0.865, descentePrise: true,
    bruitages: [b("debut", 1 / 30, "drop_003", 0.12), b("debut", 8 / 30, "tick_001", 0.07), b("debut", 20 / 30, "tick_001", 0.07), b("debut", 32 / 30, "tick_001", 0.07), b("fin", -0.35, "whoosh-out", 0.08)], maxParVideo: 2, actif: true }),
  fiche({ id: "carte-preuve", numero: 11, famille: "carte-verre", nom: "Carte-preuve (capture d'écran animée)", fichierTsx: "CartePreuve.tsx", composant: "CartePreuve",
    emplacement: "sur-le-visage", forme: "fenêtre de navigateur en verre", mouvement: "pivot-lateral", sortie: "fouet-lateral", angle: 2,
    couvreVisage: true, imagesVisagePartiel: 2, rect: K1, taillePct: 46, tailleSource: "en-tête", centreX: 0.455, dureeSec: [2, 4],
    contenu: "Une capture d'écran animée (défilement, curseur qui clique, ligne citée surlignée) et un titre de page (1 groupe de mots dits)", textes: [1, 1], videos: [1, 1],
    quand: "Une preuve à montrer : une page, un tableau de suivi, un message que Will cite.", sousTitresY: 0.775,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 34 / 30, "click_002", 0.1), b("fin", -0.2, "whoosh-out", 0.07)], maxParVideo: 2, actif: false }),
  fiche({ id: "notifications-verre", numero: 12, famille: "carte-verre", nom: "Pile de notifications en verre", fichierTsx: "NotificationsVerre.tsx", composant: "NotificationsVerre",
    emplacement: "bas", forme: "bulles de verre empilées", mouvement: "montee-pile", sortie: "glissement-haut-droite", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.08, y0: 0.66, x1: 0.92, y1: 0.92 }, taillePct: 21.8, tailleSource: "en-tête", centreX: 0.5, dureeSec: [2, 3],
    contenu: "2 à 3 messages courts DITS (« Relance envoyée », « Devis signé »), chacun avec une icône", textes: [0, 0], lignes: [2, 3],
    quand: "Des messages ou des événements automatiques que Will décrit (relance envoyée, devis signé, rendez-vous pris).", sousTitresY: 0.625,
    bruitages: [b("debut", 0, "vibreur", 0.08), b("debut", 1 / 30, "ding-1", 0.08), b("debut", 14 / 30, "ding-2", 0.08), b("debut", 27 / 30, "ding-3", 0.08), b("fin", -0.45, "whoosh-out", 0.07)], maxParVideo: 2, actif: true }),
  fiche({ id: "widget-chiffre", numero: 13, famille: "carte-verre", nom: "Widget-chiffre à jauge", fichierTsx: "WidgetChiffre.tsx", composant: "WidgetChiffre",
    emplacement: "droite", forme: "widget de verre vertical avec anneau-jauge", mouvement: "glissement-diagonal", sortie: "glissement-bord", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.75, y0: 0.18, x1: 1, y1: 0.5 }, taillePct: 8, tailleSource: "fiche", centreX: 0.875, dureeSec: [1.5, 2.5],
    contenu: "Un NOMBRE dit qui défile jusqu'au chiffre dit, son unité et une précision dites", textes: [1, 2], exigeNombreDit: true,
    quand: "Un nombre que Will dit (heures, jours, clients) : le compteur monte avec sa voix.", sousTitresY: 0.625,
    bruitages: [b("debut", 0, "whoosh-in", 0.08), b("debut", 14 / 30, "tick_001", 0.06), b("debut", 18 / 30, "tick_001", 0.06), b("debut", 26 / 30, "ding-2", 0.08), b("fin", -0.2, "whoosh-out", 0.07)], maxParVideo: 2, actif: false }),
  fiche({ id: "carte-retournee", numero: 14, famille: "carte-verre", nom: "Carte qui se retourne (problème / solution)", fichierTsx: "CarteRetournee.tsx", composant: "CarteRetournee",
    emplacement: "gauche", forme: "carte de verre verticale", mouvement: "retournement", sortie: "fouet-lateral", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0, y0: 0.18, x1: 0.25, y1: 0.54 }, taillePct: 11, tailleSource: "fiche", centreX: 0.13, dureeSec: [2, 3.5],
    contenu: "Recto : le problème dit ; verso : la solution dite (2 groupes de mots dits)", textes: [2, 2],
    quand: "Un renversement dit : « avant c'était X, maintenant Y ».", sousTitresY: 0.625,
    bruitages: [b("debut", 0, "whoosh-in", 0.07), b("debut", 36 / 30, "select_001", 0.09), b("fin", -0.2, "whoosh-out", 0.07)], maxParVideo: 2, actif: false }),

  /* ---------------- Lot D « Typographie vivante » ---------------- */
  fiche({ id: "mot-vertical-bord", numero: 15, famille: "typographie", nom: "Mot vertical sur le bord", fichierTsx: "MotVerticalBord.tsx", composant: "MotVerticalBord",
    emplacement: "gauche", forme: "mot vertical en dégradé orange", mouvement: "balayage-vertical", sortie: "fouet-vertical", angle: -90,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0, y0: 0.07, x1: 0.18, y1: 0.56 }, taillePct: 10, tailleSource: "estimée", centreX: 0.09, dureeSec: [1.5, 3.0],
    contenu: "Le thème d'un passage (1 mot dit) ; miroir à droite permis", textes: [1, 1],
    quand: "Le thème d'un passage : un seul mot qui reste sur le bord pendant que Will en parle.", sousTitresY: 0.66, bruitages: [b("debut", 0, "whoosh-in", 0.1)], maxParVideo: 3, actif: false }),
  fiche({ id: "mot-saute", numero: 16, famille: "typographie", nom: "Mot qui saute du sous-titre", fichierTsx: "MotSaute.tsx", composant: "MotSaute",
    emplacement: "haut", forme: "puce orange en dégradé", mouvement: "arc-parabolique", sortie: "aspiration-coin", angle: -8,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.57, y0: 0.055, x1: 0.99, y1: 0.115 }, taillePct: 6.5, tailleSource: "fiche", centreX: 0.78, dureeSec: [1.0, 2.0],
    contenu: "Le mot fort de la phrase (1 mot dit, capitales) qui part du sous-titre et atterrit en haut à droite", textes: [1, 1],
    quand: "Le mot que Will appuie : il saute du sous-titre vers le coin.", sousTitresY: 0.66,
    bruitages: [b("debut", 0, "select_001", 0.08), b("debut", 14 / 30, "drop_003", 0.08)], maxParVideo: 2, actif: true }),
  fiche({ id: "mot-derriere", numero: 17, famille: "typographie", nom: "Mot derrière Will", fichierTsx: "MotDerriere.tsx", composant: "MotDerriere",
    emplacement: "haut", forme: "mot géant en dégradé orange derrière la tête", mouvement: "montee-lettres", sortie: "chute-en-cascade", angle: 0,
    couvreVisage: false, derriereVisage: true, imagesVisagePartiel: 0, rect: { x0: 0.05, y0: 0.05, x1: 0.95, y1: 0.12 }, taillePct: 20, tailleSource: "estimée", centreX: 0.5, dureeSec: [1.5, 2.5],
    contenu: "1 mot dit de 8 lettres au plus, derrière la tête (repli sans détourage : au-dessus des cheveux)", textes: [1, 1],
    quand: "Un mot dit, court et concret, qu'on veut voir en très grand derrière Will.", sousTitresY: 0.66, bruitages: [b("debut", 0, "whoosh-in", 0.1)], maxParVideo: 2, actif: true }),
  fiche({ id: "rafale-trois-mots", numero: 18, famille: "typographie", nom: "Rafale de trois mots", fichierTsx: "RafaleTroisMots.tsx", composant: "RafaleTroisMots",
    emplacement: "plein-ecran", forme: "3 aplats en dégradé radial", mouvement: "lettre-par-lettre", sortie: "balayage-diagonal", angle: -5,
    couvreVisage: true, imagesVisagePartiel: 3, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.2, 1.8],
    contenu: "3 mots dits à moins de 0,9 s d'écart, 12 lettres au plus chacun", textes: [3, 3],
    quand: "Une énumération de trois mots dits (« devis, relances, factures »).", sousTitresY: null,
    bruitages: [b("debut", 0, "click_001", 0.08), b("debut", 8 / 30, "click_002", 0.08), b("debut", 16 / 30, "drop_002", 0.1)], maxParVideo: 1, actif: true }),
  fiche({ id: "citation-verre", numero: 19, famille: "typographie", nom: "Citation en bulle de verre", fichierTsx: "CitationVerre.tsx", composant: "CitationVerre",
    emplacement: "droite", forme: "bulle de messagerie en verre", mouvement: "points-puis-croissance", sortie: "fouet-droite", angle: 0,
    couvreVisage: false, imagesVisagePartiel: 0, rect: { x0: 0.76, y0: 0.028, x1: 1, y1: 0.16 }, taillePct: 6.4, tailleSource: "fiche", centreX: 0.78, dureeSec: [1.5, 2.5],
    contenu: "La citation DITE par Will, sur deux lignes courtes (8 caractères au plus par ligne)", textes: [1, 2],
    quand: "Will cite quelqu'un (« j'ai pas le temps »).", sousTitresY: 0.66,
    bruitages: [b("debut", 0, "vibreur", 0.07), b("debut", 9 / 30, "tick_001", 0.06), b("debut", 13 / 30, "tick_002", 0.06)], maxParVideo: 2, actif: false }),

  /* ---------------- Lot E « Coups de poing » ---------------- */
  fiche({ id: "duel-video", numero: 20, famille: "coup-de-poing", nom: "Duel de vidéos en triangles", fichierTsx: "DuelVideo.tsx", composant: "DuelVideo",
    emplacement: "plein-ecran", forme: "2 triangles vidéo et disque de verre", mouvement: "glissement-triangles", sortie: "retrait-aux-coins", angle: 0,
    couvreVisage: true, imagesVisagePartiel: 3, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.5, 2.5],
    contenu: "2 termes dits en opposition (A / B) et 2 B-roll, un par côté ; verdict optionnel", textes: [2, 2], videos: [2, 2],
    quand: "Une opposition dite : « à la main / en automatique », « eux / vous ».", sousTitresY: null,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 4 / 30, "drop_004", 0.12)], maxParVideo: 1, actif: true }),
  fiche({ id: "dalle-claquee", numero: 21, famille: "coup-de-poing", nom: "Dalle claquée", fichierTsx: "DalleClaqueeV3.tsx", composant: "DalleClaqueeV3",
    emplacement: "plein-ecran", forme: "aplat orange radial avec mot en relief", mouvement: "claque-mise-au-point", sortie: "masque-circulaire", angle: -4,
    couvreVisage: true, imagesVisagePartiel: 2, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [0.9, 1.4],
    contenu: "1 ou 2 mots dits : la phrase choc, 12 lettres au plus", textes: [1, 2],
    quand: "La phrase choc, un basculement (« stop », « fuite »).", sousTitresY: null,
    bruitages: [b("debut", 0, "drop_004", 0.14), b("fin", -0.1, "whoosh-out", 0.16)], maxParVideo: 1, actif: true }),
  fiche({ id: "eclat-chiffre", numero: 22, famille: "coup-de-poing", nom: "Éclat-chiffre", fichierTsx: "EclatChiffreV3.tsx", composant: "EclatChiffreV3",
    emplacement: "plein-ecran", forme: "aplat encre radial avec éclat orange", mouvement: "compteur", sortie: "aspiration", angle: 0,
    couvreVisage: true, imagesVisagePartiel: 2, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.0, 1.4],
    contenu: "1 chiffre DIT qui défile de 0 au chiffre dit, plus son unité dite (« min », « h »)", textes: [0, 1], exigeNombreDit: true,
    quand: "Un chiffre dit et important (« quarante-cinq minutes »). Jamais sans chiffre dit.", sousTitresY: null,
    bruitages: [b("debut", 0, "whoosh-in", 0.08), b("debut", 12 / 30, "drop_002", 0.14), b("debut", 12 / 30 + 0.02, "eclats", 0.1)], maxParVideo: 1, actif: true }),
  fiche({ id: "mot-fenetre", numero: 23, famille: "coup-de-poing", nom: "Mot-fenêtre", fichierTsx: "MotFenetre.tsx", composant: "MotFenetre",
    emplacement: "plein-ecran", forme: "K10 lettres-fenêtres", mouvement: "lettres-en-cascade", sortie: "fouet-pivot", angle: 0,
    couvreVisage: true, imagesVisagePartiel: 3, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.5, 2.2],
    contenu: "1 mot dit de 8 lettres au plus dont les lettres sont des fenêtres sur un B-roll littéral", textes: [1, 1], videos: [1, 1],
    quand: "Un mot dit, fort et concret, qui se montre (« devis », « chantier »).", sousTitresY: null,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 0.7, "maximize_004", 0.12), b("fin", -0.2, "whoosh-out", 0.16)], maxParVideo: 1, actif: false }),
  fiche({ id: "mosaique-videos", numero: 24, famille: "coup-de-poing", nom: "Mosaïque de vidéos", fichierTsx: "MosaiqueVideos.tsx", composant: "MosaiqueVideos",
    emplacement: "plein-ecran", forme: "plan incliné de tuiles vidéo", mouvement: "defilement-de-grille", sortie: "bascule-haut", angle: -8,
    couvreVisage: true, imagesVisagePartiel: 2, rect: PLEIN, taillePct: 100, tailleSource: "en-tête", centreX: 0.5, dureeSec: [1.8, 2.6],
    contenu: "4 à 6 B-roll de la même scène dite, et le mot fort (1 mot dit) sur la tuile qui vient au premier plan", textes: [1, 1], videos: [4, 6],
    quand: "Une énumération dite, « des dizaines de… » (sans chiffre inventé).", sousTitresY: null,
    bruitages: [b("debut", 0, "whoosh-in", 0.1), b("debut", 34 / 30, "select_002", 0.14), b("fin", -0.2, "whoosh-out", 0.16)], maxParVideo: 1, actif: true }),
]);

/* ---------------- Lecture ---------------- */

const PAR_ID = new Map(CATALOGUE_V3.map((f) => [f.id, f] as const));

/** La fiche d'un élément (undefined si l'id n'existe pas). */
export const ficheV3 = (id: string): FicheCatalogueV3 | undefined => PAR_ID.get(id);

/** Les éléments retenus (`actif: true`) : seuls ceux-là sont proposés au réalisateur. */
export const elementsV3Actifs = (): FicheCatalogueV3[] => CATALOGUE_V3.filter((f) => f.actif);

/** Un coup de poing : plein écran, visage entièrement couvert. */
export const estCoupDePoingV3 = (f: Pick<FicheCatalogueV3, "coupDePoing">) => f.coupDePoing;

export type ClasseTailleV3 = "petit" | "moyen" | "grand";
/** Petit < 6 % de l'image, moyen de 6 à 15 %, grand au-delà (ou plein écran). */
export function classeTailleV3(f: Pick<FicheCatalogueV3, "taillePct" | "emplacement">): ClasseTailleV3 {
  if (f.emplacement === "plein-ecran" || f.taillePct > 15) return "grand";
  return f.taillePct < 6 ? "petit" : "moyen";
}

const inter = (a: RectV3, b2: RectV3) => a.x0 < b2.x1 && b2.x0 < a.x1 && a.y0 < b2.y1 && b2.y0 < a.y1;
const contient = (a: RectV3, b2: RectV3) => a.x0 <= b2.x0 && a.y0 <= b2.y0 && a.x1 >= b2.x1 && a.y1 >= b2.y1;

/** Descente de la prise sous la carte du haut (`DESCENTE_PRISE` de `CarteVerre.tsx`, fraction de H) : permise par Will. */
export const DESCENTE_PRISE_V3 = 0.27;

/**
 * État du visage une fois l'élément posé : « couvert » (l'emprise contient toute la zone Z), « entier » (elle n'y touche pas, ou
 * l'élément est derrière la tête) ou « partiel » (interdit : Will veut le visage entier ou entièrement couvert). Quand la prise
 * descend sous l'élément (`descentePrise`), la zone Z descend avec elle.
 */
export function etatVisagePose(f: Pick<FicheCatalogueV3, "rect" | "derriereVisage" | "descentePrise">, zone: RectV3 = ZONE_VISAGE_V3): "entier" | "couvert" | "partiel" {
  if (f.derriereVisage) return "entier";
  const z = f.descentePrise ? { ...zone, y0: zone.y0 + DESCENTE_PRISE_V3, y1: zone.y1 + DESCENTE_PRISE_V3 } : zone;
  if (contient(f.rect, z)) return "couvert";
  return inter(f.rect, z) ? "partiel" : "entier";
}

/** Bande des yeux (fraction de H), avec sa marge. */
export const bandeYeuxV3 = (yeux = YEUX_V3): readonly [number, number] => [yeux - GARDE_YEUX_V3, yeux + GARDE_YEUX_V3];
