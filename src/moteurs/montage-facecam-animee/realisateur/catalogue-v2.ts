/**
 * CATALOGUE DES 24 ÉLÉMENTS « v2 ÉNERGIE » (face caméra animée, 16/10/2026) — PUR.
 *
 * Will a jugé les premiers éléments monotones (« toujours carré, mêmes emplacements, pas d'énergie »). Les 24 éléments
 * de `studio-rendu/compositions/interface-claire/motion-v2/lot1..lot5/` y répondent ; ce catalogue en est la FICHE LISIBLE
 * PAR LE RÉALISATEUR : une entrée par élément, avec les 4 étiquettes de la grammaire du standard
 * (`docs/facecam-animee-v2/STANDARD-DA-V2-2026-10-16.md` § B : emplacement, forme, mouvement, sortie), l'inclinaison,
 * la taille, la durée, ce que l'élément montre, ses bruitages. Les règles D1 à D13 (`regles-v2.ts`) ne lisent QUE ce catalogue.
 *
 * ┌─ `actif` est le SEUL endroit à changer pour retenir ou écarter un élément. ─────────────────────────────────────────┐
 * │ true  : les favoris de Will (mot-vertical-bord, duel-triangles, rafale-trois-mots, eclat-chiffre, dalle-claquee,   │
 * │         tampon-dechirure, pile-de-lettres, bandes-diagonales, demi-lune-bas) + 8 autres retenus ;                  │
 * │ false : 7 éléments « à refaire plus grands », jugés faibles par le critique (fleche-feutre, onde-de-choc,          │
 * │         traits-vitesse, mot-barre-remplace, gerbe-formes, scotch-postit, ticket-dechire-haut).                     │
 * │ Un plan qui emploie un élément inactif est refusé par le contrôle (D0).                                             │
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Origine des chiffres : les en-têtes et les `FICHE_*` des .tsx (après les corrections du 16/10 déjà portées par les
 * designers), le standard § D, la critique du 16/10. Une taille ou un angle qui n'est pas écrit noir sur blanc dans le .tsx
 * est une ESTIMATION et porte `tailleSource: "estimée"` : à mesurer sur le rendu avant de s'y fier à 1 %.
 * Ids : ce sont ceux des .tsx (`traits-vitesse`, `gerbe-formes`, `pile-de-lettres`), pas ceux du texte de la demande.
 *
 * Tailles : % de l'image (1080 × 1920) couvert par la silhouette POSÉE (ou, pour un plein écran, 100). Petit < 6 %,
 * moyen de 6 à 15 %, grand > 15 % ou plein écran (D6).
 */

export const EMPLACEMENTS_V2 = ["E1", "E2", "E3", "E4", "E5", "E6", "E7"] as const;
export type EmplacementV2 = (typeof EMPLACEMENTS_V2)[number];
export const NOMS_EMPLACEMENTS_V2: Readonly<Record<EmplacementV2, string>> = Object.freeze({
  E1: "haut", E2: "gauche", E3: "droite", E4: "bas", E5: "halo", E6: "diagonale", E7: "plein écran",
});

/** F1 à F12 : les formes du standard § B.3. F13 : le losange (absent de la liste du standard, non rectangulaire). */
export const FORMES_V2 = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "F13"] as const;
export type FormeV2 = (typeof FORMES_V2)[number];
/** Formes « préférées » du quota D4 (au moins 50 % des apparitions). */
export const FORMES_PREFEREES_V2: readonly FormeV2[] = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6", "F9", "F11"]);

/** M1 à M11 : mouvements du standard § B.4 ; P1 à P5 : les 5 coups de poing du § C (mouvement ET type de coup de poing). */
export const MOUVEMENTS_V2 = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "P1", "P2", "P3", "P4", "P5"] as const;
export type MouvementV2 = (typeof MOUVEMENTS_V2)[number];

/** Façons de sortir (standard § B.4 : « jamais un simple fondu » ; deux éléments consécutifs ne sortent jamais de la même façon). */
export const SORTIES_V2 = ["envol", "aspiration", "balayage-inverse", "balayage-diagonal", "dechirure", "chute", "repli", "retrait", "plongeon", "eclatement", "elargissement", "morph-blob"] as const;
export type SortieV2 = (typeof SORTIES_V2)[number];

export type LotV2 = 1 | 2 | 3 | 4 | 5;

export interface FicheCatalogueV2 {
  /** Identifiant du .tsx (`FICHE_*.id`). */
  id: string;
  /** Numéro du standard (1 à 24). */
  numero: number;
  lot: LotV2;
  nom: string;
  /** Chemin du .tsx depuis la racine du dépôt, et nom du composant exporté. */
  fichier: string;
  composant: string;
  /** Emplacement déclaré dans la fiche (E1 à E7). */
  emplacement: EmplacementV2;
  /** Forme principale (la forme qui compte pour « jamais deux fois la même ») et toutes les formes employées. */
  forme: FormeV2;
  formes: readonly FormeV2[];
  /** Mouvement d'entrée principal (« jamais deux fois le même ») ; P1 à P5 pour un coup de poing. */
  mouvement: MouvementV2;
  sortie: SortieV2;
  /** Inclinaison posée, en degrés (positif = sens horaire) ; le plan peut la remplacer (`elementsV2[].angle`). */
  angle: number;
  /** Le visage est couvert EN ENTIER (les 5 coups de poing) ; sinon il reste entier. Jamais à moitié (décision de Will). */
  couvreVisage: boolean;
  /**
   * Images pendant lesquelles le visage est PARTIELLEMENT couvert à l'entrée ou à la sortie (TOLÉRANCE À VALIDER par Will :
   * 3 images au plus, non validée). `null` : un plein écran dont le .tsx ne chiffre pas ce nombre ; 0 : jamais (pas un plein écran).
   */
  imagesVisagePartiel: number | null;
  /** Taille de la silhouette posée, en % de l'image ; `tailleSource` dit d'où vient le chiffre. */
  taillePct: number;
  tailleSource: "en-tête" | "fiche" | "estimée";
  /** Centre horizontal de l'élément posé (fraction de la largeur) : « centré sur l'axe » = entre 0,4 et 0,6 (D5). */
  centreX: number;
  /** Surface d'ORANGE PLEINE, en % de l'image (D7 : au moins 3 % pour compter comme « élément orange »). */
  orangePct: number;
  /** Durée de l'élément, en secondes (fiche) et en images à 30 i/s. */
  dureeSec: readonly [number, number];
  dureeImages: readonly [number, number];
  /** Ce que l'élément montre (mots / chiffre DITS par Will), et combien de textes il en prend. */
  contenu: string;
  textes: readonly [number, number];
  /** Il faut un NOMBRE dit par Will (jamais un chiffre inventé). */
  exigeNombreDit: boolean;
  /** Quand l'utiliser (extrait de la fiche). */
  quand: string;
  /** Bruitages (noms de fichiers de `sons/` sans extension) dans l'ordre ; ceux marqués « à sourcer » n'existent pas encore. */
  bruitages: readonly string[];
  bruitagesASourcer: readonly string[];
  /** Instant (s après i0) de la secousse de l'élément, ou null s'il n'en a pas (D8 : une secousse au plus par tranche de 4 s). */
  secousseSec: number | null;
  /** Fait partie des 6 éléments de la micro-accroche à 0,8-2 s (D9). */
  accrocheOuverture: boolean;
  /** Apparitions au plus par vidéo (standard § E : 3, ou 2 pour 1, 11, 23 ; 1 si la fiche du .tsx dit « un par vidéo »). */
  maxParVideo: number;
  /** ★ LE SEUL CHAMP À CHANGER pour retenir ou écarter l'élément (voir l'en-tête). */
  actif: boolean;
}

const D = "studio-rendu/compositions/interface-claire/motion-v2";
const img = (s: readonly [number, number]) => [Math.round(s[0] * 30), Math.round(s[1] * 30)] as const;

type Saisie = Omit<FicheCatalogueV2, "fichier" | "dureeImages" | "formes" | "bruitagesASourcer"> & {
  dossier: string;
  fichierTsx: string;
  formes?: readonly FormeV2[];
};

/** Sons annoncés par les fiches mais absents de `studio-rendu/.../sons/` (à chercher en CC0, aucune banque payante). */
const A_SOURCER = new Set(["autocollant", "scotch", "papier", "tampon", "dechirure", "dechirure-courte", "pop", "bloup", "boum"]);

function fiche(s: Saisie): FicheCatalogueV2 {
  const { dossier, fichierTsx, formes, ...reste } = s;
  return Object.freeze({
    ...reste,
    fichier: `${D}/${dossier}/${fichierTsx}`,
    formes: Object.freeze(formes ?? [s.forme]),
    dureeImages: img(s.dureeSec),
    bruitagesASourcer: Object.freeze(s.bruitages.filter((b) => A_SOURCER.has(b))),
  });
}

export const CATALOGUE_V2: readonly FicheCatalogueV2[] = Object.freeze([
  /* ---------------- Lot 1 « Papier & collage » ---------------- */
  fiche({ id: "autocollant-mot", numero: 1, lot: 1, nom: "Autocollant découpé avec un mot-clé", dossier: "lot1", fichierTsx: "AutocollantMot.tsx", composant: "AutocollantMot",
    emplacement: "E3", forme: "F3", mouvement: "M4", sortie: "envol", angle: 9, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6.3, tailleSource: "en-tête", centreX: 0.8, orangePct: 5.5, dureeSec: [1.2, 3],
    contenu: "1 mot-clé nom dit (« devis », « relances »), capitales, 12 lettres au plus", textes: [1, 1], exigeNombreDit: false,
    quand: "Un mot-clé nom dit par Will.", bruitages: ["drop_002", "autocollant"], secousseSec: 0.1, accrocheOuverture: true, maxParVideo: 2, actif: true }),
  fiche({ id: "scotch-postit", numero: 2, lot: 1, nom: "Papier collé au scotch qui se balance", dossier: "lot1", fichierTsx: "ScotchPostit.tsx", composant: "ScotchPostit",
    emplacement: "E2", forme: "F10", mouvement: "M9", sortie: "chute", angle: -6, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6.5, tailleSource: "en-tête", centreX: 0.09, orangePct: 0, dureeSec: [1.5, 3],
    contenu: "1 à 4 lignes courtes, mots dits", textes: [1, 4], exigeNombreDit: false,
    quand: "Une tâche, un rappel, « il faut penser à… ».", bruitages: ["scotch", "drop_001"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: false }),
  fiche({ id: "tampon-dechirure", numero: 3, lot: 1, nom: "Tampon sur papier, puis déchirure (coup de poing P4)", dossier: "lot1", fichierTsx: "TamponDechirure.tsx", composant: "TamponDechirure",
    emplacement: "E7", forme: "F7", formes: ["F7", "F9", "F10"], mouvement: "P4", sortie: "dechirure", angle: -12, couvreVisage: true, imagesVisagePartiel: 1,
    taillePct: 100, tailleSource: "en-tête", centreX: 0.5, orangePct: 0.5, dureeSec: [1, 1.3],
    contenu: "1 mot dit (verdict, validation : « réglé », « fini »), capitales, 12 lettres au plus", textes: [1, 1], exigeNombreDit: false,
    quand: "Un verdict, une validation. Jamais avant 10 s.", bruitages: ["papier", "tampon", "dechirure"], secousseSec: 0.1, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "fleche-feutre", numero: 4, lot: 1, nom: "Flèche dessinée au feutre avec un mot", dossier: "lot1", fichierTsx: "FlecheFeutre.tsx", composant: "FlecheFeutre",
    emplacement: "E6", forme: "F4", formes: ["F4", "F11"], mouvement: "M6", sortie: "balayage-inverse", angle: -6, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 2.6, tailleSource: "estimée", centreX: 0.2, orangePct: 0.5, dureeSec: [1.2, 2.5],
    contenu: "1 mot dit au départ de la flèche (« regardez », « ça », « moi »)", textes: [1, 1], exigeNombreDit: false,
    quand: "Pour désigner.", bruitages: ["feutre"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: false }),
  fiche({ id: "ticket-dechire-haut", numero: 5, lot: 1, nom: "Bande de papier orange déchirée en haut du cadre", dossier: "lot1", fichierTsx: "TicketDechireHaut.tsx", composant: "TicketDechireHaut",
    emplacement: "E1", forme: "F10", mouvement: "M10", sortie: "repli", angle: -5, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6, tailleSource: "en-tête", centreX: 0.38, orangePct: 6, dureeSec: [1.5, 3],
    contenu: "1 titre dit (« le problème »), capitales, 12 lettres environ", textes: [1, 1], exigeNombreDit: false,
    quand: "Un titre de séquence ou une question.", bruitages: ["dechirure-courte"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: false }),

  /* ---------------- Lot 2 « Géométrie franche » ---------------- */
  fiche({ id: "pastille-chiffre", numero: 6, lot: 2, nom: "Pastille-chiffre qui tourne et s'entoure", dossier: "lot2", fichierTsx: "PastilleChiffre.tsx", composant: "PastilleChiffre",
    emplacement: "E2", forme: "F1", mouvement: "M3", sortie: "aspiration", angle: -8, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 7, tailleSource: "en-tête", centreX: 0.14, orangePct: 7.8, dureeSec: [1.2, 2.6],
    contenu: "1 nombre DIT par Will, tel qu'il le dit (« 3 », « 20 »)", textes: [1, 1], exigeNombreDit: true,
    quand: "Un nombre dit, et seulement celui-là.", bruitages: ["select_002", "tick_001"], secousseSec: null, accrocheOuverture: true, maxParVideo: 3, actif: true }),
  fiche({ id: "bandes-diagonales", numero: 7, lot: 2, nom: "Bandes diagonales (deux mots qui vont ensemble)", dossier: "lot2", fichierTsx: "BandesDiagonales.tsx", composant: "BandesDiagonales",
    emplacement: "E6", forme: "F8", mouvement: "M8", sortie: "envol", angle: -18, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 16, tailleSource: "en-tête", centreX: 0.5, orangePct: 8, dureeSec: [1.4, 2.8],
    contenu: "2 mots dits, un par bande (« simple · rapide »)", textes: [2, 2], exigeNombreDit: false,
    quand: "Deux mots dits qui vont ensemble.", bruitages: ["whoosh-in", "drop_001"], secousseSec: 0.27, accrocheOuverture: false, maxParVideo: 3, actif: true }),
  fiche({ id: "duel-triangles", numero: 8, lot: 2, nom: "Duel en triangles (coup de poing P3)", dossier: "lot2", fichierTsx: "DuelTriangles.tsx", composant: "DuelTriangles",
    emplacement: "E7", forme: "F7", mouvement: "P3", sortie: "retrait", angle: 0, couvreVisage: true, imagesVisagePartiel: 3,
    taillePct: 100, tailleSource: "en-tête", centreX: 0.5, orangePct: 50, dureeSec: [1.5, 2.6],
    contenu: "2 termes dits en opposition (A / B), 12 lettres au plus chacun", textes: [2, 2], exigeNombreDit: false,
    quand: "Une opposition dite (« à la main / automatisé »). Jamais avant 10 s.", bruitages: ["whoosh-in", "drop_004"], secousseSec: 0.17, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "demi-lune-bas", numero: 9, lot: 2, nom: "Demi-lune du bas (le mot suit l'arc)", dossier: "lot2", fichierTsx: "DemiLuneBas.tsx", composant: "DemiLuneBas",
    emplacement: "E4", forme: "F1", mouvement: "M1", sortie: "plongeon", angle: -8, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 20, tailleSource: "estimée", centreX: 0.46, orangePct: 19, dureeSec: [1.4, 3],
    contenu: "1 ou 2 mots dits, 12 lettres au plus (« et voilà »)", textes: [1, 2], exigeNombreDit: false,
    quand: "Un résultat ou une conclusion.", bruitages: ["maximize_004"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: true }),
  fiche({ id: "losange-crans", numero: 10, lot: 2, nom: "Losange à crans (étapes)", dossier: "lot2", fichierTsx: "LosangeCrans.tsx", composant: "LosangeCrans",
    emplacement: "E1", forme: "F13", mouvement: "M3", sortie: "eclatement", angle: 45, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6.5, tailleSource: "en-tête", centreX: 0.8, orangePct: 6.5, dureeSec: [2, 6],
    contenu: "2 à 4 étapes dites (une icône par étape, aucun numéro affiché)", textes: [0, 0], exigeNombreDit: false,
    quand: "Des étapes dites : d'abord, ensuite, enfin.", bruitages: ["click_001"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: true }),

  /* ---------------- Lot 3 « La typo est le personnage » ---------------- */
  fiche({ id: "mot-saute", numero: 11, lot: 3, nom: "Mot qui saute", dossier: "lot3", fichierTsx: "MotSaute.tsx", composant: "MotSaute",
    emplacement: "E5", forme: "F11", mouvement: "M4", sortie: "envol", angle: -8, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6.9, tailleSource: "fiche", centreX: 0.63, orangePct: 1.5, dureeSec: [1, 2],
    contenu: "Le mot fort de la phrase (1 mot dit, capitales)", textes: [1, 1], exigeNombreDit: false,
    quand: "Le mot que Will appuie ; idéal pour la micro-accroche à 0,8-2 s.", bruitages: ["select_001", "drop_003"], secousseSec: 0.57, accrocheOuverture: true, maxParVideo: 2, actif: true }),
  fiche({ id: "mot-vertical-bord", numero: 12, lot: 3, nom: "Mot vertical sur le bord", dossier: "lot3", fichierTsx: "MotVerticalBord.tsx", composant: "MotVerticalBord",
    emplacement: "E2", forme: "F11", mouvement: "M2", sortie: "balayage-inverse", angle: -90, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 11, tailleSource: "estimée", centreX: 0.09, orangePct: 5, dureeSec: [1.5, 3.5],
    contenu: "Le thème d'un passage (1 mot dit : « temps », « équipe »)", textes: [1, 1], exigeNombreDit: false,
    quand: "Le thème d'un passage ; il peut rester 3 s.", bruitages: ["whoosh-in"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: true }),
  fiche({ id: "rafale-trois-mots", numero: 13, lot: 3, nom: "Rafale de trois mots (coup de poing P2)", dossier: "lot3", fichierTsx: "RafaleTroisMots.tsx", composant: "RafaleTroisMots",
    emplacement: "E7", forme: "F7", formes: ["F7", "F11"], mouvement: "P2", sortie: "balayage-diagonal", angle: -5, couvreVisage: true, imagesVisagePartiel: null,
    taillePct: 100, tailleSource: "en-tête", centreX: 0.5, orangePct: 100, dureeSec: [1.2, 2],
    contenu: "3 mots dits à moins de 0,9 s d'écart (« devis, relances, factures »), 12 lettres au plus chacun", textes: [3, 3], exigeNombreDit: false,
    quand: "Une énumération de 3 mots dits. Jamais avant 10 s.", bruitages: ["click_001", "click_002", "drop_002"], secousseSec: 0.17, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "pile-de-lettres", numero: 14, lot: 3, nom: "Pile de lettres", dossier: "lot3", fichierTsx: "PileLettres.tsx", composant: "PileLettres",
    emplacement: "E3", forme: "F11", mouvement: "M5", sortie: "envol", angle: 7, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 8.3, tailleSource: "fiche", centreX: 0.91, orangePct: 3.5, dureeSec: [1.4, 3],
    contenu: "1 nom ou liste courte dite : 4 à 6 lettres (au-delà, l'élément REFUSE au lieu de tronquer)", textes: [1, 1], exigeNombreDit: false,
    quand: "Un nom ou une liste courte dite. Au plus un par vidéo.", bruitages: ["drop_001"], secousseSec: null, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "mot-barre-remplace", numero: 15, lot: 3, nom: "Mot barré, mot remplacé", dossier: "lot3", fichierTsx: "MotBarreRemplace.tsx", composant: "MotBarreRemplace",
    emplacement: "E1", forme: "F11", mouvement: "M6", sortie: "aspiration", angle: -8, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 5.5, tailleSource: "estimée", centreX: 0.42, orangePct: 2, dureeSec: [1.4, 2.8],
    contenu: "2 mots dits : le mot barré (A) puis le mot de remplacement (B)", textes: [2, 2], exigeNombreDit: false,
    quand: "Une correction : « pas X, mais Y ». Au plus une par vidéo.", bruitages: ["feutre", "select_001"], secousseSec: null, accrocheOuverture: false, maxParVideo: 1, actif: false }),

  /* ---------------- Lot 4 « Impact / énergie » ---------------- */
  fiche({ id: "eclat-mot", numero: 16, lot: 4, nom: "Éclat-mot", dossier: "lot4", fichierTsx: "EclatMot.tsx", composant: "EclatMot",
    emplacement: "E1", forme: "F5", mouvement: "M1", sortie: "envol", angle: -10, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 7, tailleSource: "en-tête", centreX: 0.18, orangePct: 5.5, dureeSec: [1, 2.2],
    contenu: "1 mot dit : annonce, nouveauté (« nouveau », « enfin »), 12 lettres au plus", textes: [1, 1], exigeNombreDit: false,
    quand: "Une annonce ou une nouveauté dite.", bruitages: ["maximize_006", "pop"], secousseSec: null, accrocheOuverture: true, maxParVideo: 3, actif: true }),
  fiche({ id: "eclat-chiffre", numero: 17, lot: 4, nom: "Éclat-chiffre (coup de poing P5)", dossier: "lot4", fichierTsx: "EclatChiffre.tsx", composant: "EclatChiffre",
    emplacement: "E7", forme: "F7", formes: ["F7", "F5"], mouvement: "P5", sortie: "aspiration", angle: 0, couvreVisage: true, imagesVisagePartiel: 2,
    taillePct: 100, tailleSource: "en-tête", centreX: 0.5, orangePct: 60, dureeSec: [1, 1.4],
    contenu: "1 chiffre DIT par Will qui défile de 0 au chiffre dit, plus son unité (« min », « h »)", textes: [1, 2], exigeNombreDit: true,
    quand: "Un chiffre dit et important. Jamais sans chiffre dit ; jamais avant 10 s.", bruitages: ["drop_002", "eclats"], secousseSec: 0.4, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "onde-de-choc", numero: 18, lot: 4, nom: "Onde de choc", dossier: "lot4", fichierTsx: "OndeDeChoc.tsx", composant: "OndeDeChoc",
    emplacement: "E5", forme: "F1", mouvement: "M5", sortie: "elargissement", angle: 0, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 4, tailleSource: "estimée", centreX: 0.5, orangePct: 1, dureeSec: [0.6, 1],
    contenu: "Aucun texte : trois anneaux autour de la tête (affirmation forte)", textes: [0, 0], exigeNombreDit: false,
    quand: "Une affirmation forte, sans rien à écrire.", bruitages: ["drop_004"], secousseSec: null, accrocheOuverture: true, maxParVideo: 3, actif: false }),
  fiche({ id: "traits-vitesse", numero: 19, lot: 4, nom: "Traits de vitesse", dossier: "lot4", fichierTsx: "TraitsVitesse.tsx", composant: "TraitsVitesse",
    emplacement: "E3", forme: "F11", mouvement: "M8", sortie: "balayage-inverse", angle: 0, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 3, tailleSource: "estimée", centreX: 0.9, orangePct: 1.5, dureeSec: [1, 2],
    contenu: "1 mot court dit (6 lettres au plus : « vite », « clic »)", textes: [1, 1], exigeNombreDit: false,
    quand: "Vitesse : « vite », « en un clic », « tout de suite ».", bruitages: ["whoosh-in"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: false }),
  fiche({ id: "gerbe-formes", numero: 20, lot: 4, nom: "Gerbe de formes", dossier: "lot4", fichierTsx: "GerbeFormes.tsx", composant: "GerbeFormes",
    emplacement: "E4", forme: "F1", formes: ["F1", "F5"], mouvement: "M7", sortie: "chute", angle: 8, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 5, tailleSource: "estimée", centreX: 0.7, orangePct: 3.5, dureeSec: [1.2, 2.2],
    contenu: "1 ou 2 mots dits sur la pastille (« c'est fait »)", textes: [1, 2], exigeNombreDit: false,
    quand: "Une réussite dite : « c'est fait », « c'est parti ».", bruitages: ["confirmation_002"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: false }),

  /* ---------------- Lot 5 « Organique & objets » ---------------- */
  fiche({ id: "blob-mot", numero: 21, lot: 5, nom: "Blob-mot", dossier: "lot5", fichierTsx: "BlobMot.tsx", composant: "BlobMot",
    emplacement: "E4", forme: "F6", mouvement: "M11", sortie: "aspiration", angle: -9, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 12, tailleSource: "en-tête", centreX: 0.33, orangePct: 11, dureeSec: [0.9, 3],
    contenu: "1 ou 2 mots dits : un bénéfice doux (« sereinement », « enfin »), 12 lettres au plus", textes: [1, 2], exigeNombreDit: false,
    quand: "Un bénéfice doux dit.", bruitages: ["drop_001", "bloup"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: true }),
  fiche({ id: "dalle-claquee", numero: 22, lot: 5, nom: "Dalle claquée (coup de poing P1)", dossier: "lot5", fichierTsx: "DalleClaquee.tsx", composant: "DalleClaquee",
    emplacement: "E7", forme: "F7", formes: ["F7", "F11"], mouvement: "P1", sortie: "morph-blob", angle: -4, couvreVisage: true, imagesVisagePartiel: 2,
    taillePct: 100, tailleSource: "en-tête", centreX: 0.5, orangePct: 100, dureeSec: [0.9, 1.4],
    contenu: "1 ou 2 mots dits : la phrase choc (« fuite », « stop »), 12 lettres au plus", textes: [1, 2], exigeNombreDit: false,
    quand: "La phrase choc, un basculement. Jamais avant 10 s.", bruitages: ["drop_004", "boum"], secousseSec: 0.13, accrocheOuverture: false, maxParVideo: 1, actif: true }),
  fiche({ id: "bulle-cri", numero: 23, lot: 5, nom: "Bulle-cri", dossier: "lot5", fichierTsx: "BulleCri.tsx", composant: "BulleCri",
    emplacement: "E3", forme: "F3", mouvement: "M4", sortie: "envol", angle: 9, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 5.5, tailleSource: "estimée", centreX: 0.87, orangePct: 0.8, dureeSec: [0.8, 2.5],
    contenu: "La citation dite par Will, telle quelle (3 à 5 mots, ponctuation comprise)", textes: [1, 1], exigeNombreDit: false,
    quand: "Will cite quelqu'un (« j'ai pas le temps ! »).", bruitages: ["click_003", "minimize_004"], secousseSec: 0.1, accrocheOuverture: true, maxParVideo: 2, actif: true }),
  fiche({ id: "badge-roulant", numero: 24, lot: 5, nom: "Badge-roulant", dossier: "lot5", fichierTsx: "BadgeRoulant.tsx", composant: "BadgeRoulant",
    emplacement: "E6", forme: "F1", mouvement: "M11", sortie: "balayage-inverse", angle: 0, couvreVisage: false, imagesVisagePartiel: 0,
    taillePct: 6.4, tailleSource: "en-tête", centreX: 0.92, orangePct: 4, dureeSec: [1, 3],
    contenu: "2 mots ou groupes de mots dits sur le pourtour (« en ligne · partout »), plus une icône", textes: [1, 2], exigeNombreDit: false,
    quand: "Une portée, une modalité dite (« à distance », « partout en France »).", bruitages: ["select_002"], secousseSec: null, accrocheOuverture: false, maxParVideo: 3, actif: true }),
]);

/* ---------------- Lecture ---------------- */

const PAR_ID = new Map(CATALOGUE_V2.map((f) => [f.id, f] as const));

/** La fiche d'un élément (undefined si l'id n'existe pas). */
export const ficheV2 = (id: string): FicheCatalogueV2 | undefined => PAR_ID.get(id);

/** Les éléments retenus (`actif: true`) : seuls ceux-là sont proposés au réalisateur. */
export const elementsV2Actifs = (): FicheCatalogueV2[] => CATALOGUE_V2.filter((f) => f.actif);

/** Un coup de poing (P1 à P5) : plein écran, visage entièrement couvert. */
export const estCoupDePoingV2 = (f: Pick<FicheCatalogueV2, "mouvement">) => f.mouvement.startsWith("P");

export type ClasseTailleV2 = "petit" | "moyen" | "grand";
/** D6 : petit < 6 % de l'image, moyen de 6 à 15 %, grand > 15 % ou plein écran. */
export function classeTailleV2(f: Pick<FicheCatalogueV2, "taillePct" | "emplacement">): ClasseTailleV2 {
  if (f.emplacement === "E7" || f.taillePct > 15) return "grand";
  return f.taillePct < 6 ? "petit" : "moyen";
}

/** Signe d'inclinaison : -1, 0 ou +1 (D1 : on alterne + et −). */
export const signeAngleV2 = (angle: number): -1 | 0 | 1 => (angle > 0 ? 1 : angle < 0 ? -1 : 0);
