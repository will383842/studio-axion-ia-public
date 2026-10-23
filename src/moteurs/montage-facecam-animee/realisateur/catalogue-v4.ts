/**
 * CATALOGUE DES PLAQUETTES « v4 » (face caméra animée, 17/10/2026) — PUR.
 *
 * Will a VALIDÉ (17/10, 17/10 en note) les 26 plaquettes du style « qui claque » (aplats, contours encre, ombres dures, palette unique
 * orange #F07C3E / encre / ivoire, ZÉRO turquoise) : `docs/facecam-animee-v4/STANDARD-DA-V4-2026-10-16.md`. Les composants vivent dans
 * `studio-rendu/compositions/interface-claire/motion-v4/lot1..lot5/` et leur liste complète (39, dont 13 « en coulisse ») dans
 * `motion-v4/catalogue-v4.ts` ; ce fichier en est la FICHE LISIBLE PAR LE RÉALISATEUR (consigne Opus, `consignes.ts`) ET PAR LES RÈGLES
 * (`regles-v4.ts`). Le conteneur de rendu n'importe rien de `src/` : les chiffres utiles au rendu sont recopiés dans
 * `motion-v4/registre-v4.tsx` (test d'égalité : `tests/facecam-animee/catalogue-v4.test.ts`).
 *
 * ┌─ `actif` est le SEUL endroit à changer pour retenir ou écarter une plaquette. ───────────────────────────────────────────────┐
 * │ true  (26) : le choix de Will. false (13, « en coulisse ») : le code reste, le réalisateur ne les choisit PAS (règle D0).     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * « Emplacement » (`slot`) : où la plaquette se pose ; la règle « jamais deux fois de suite le même emplacement » (V6) joue sur ces 5
 * valeurs : `tete` (M1, au-dessus de la tête, prise descendue de D1 = 0,06 H), `carte` (M2, carte haute, prise descendue de D2 = 0,26 H),
 * `fenetre` (M4, fenêtre qui COUVRE le visage), `plein-cadre` (M5, plein cadre qui couvre le visage : « coup de poing »), `bas` (M7,
 * pile de notifications sous le visage).
 *
 * Provenance des chiffres : en-têtes et fonctions `evenements*` des .tsx (déroulés en images à 30 i/s), standard § E (gabarits, descente),
 * § C.3 (sous-titres), § G (rythme), critique du 16/10 (images de visage partiel : « 1 à 2 images par glissement de fenêtre »).
 * Les événements (`evts`) sont ceux DÉCLARÉS par les composants ; la mesure sur le rendu est faite à part (COMPTE-RENDU de la répétition).
 */

import { ramene } from "./familles";
import { zoneProtegeeCombinee } from "@/reseaux";

export const SLOTS_V4 = ["tete", "carte", "fenetre", "plein-cadre", "bas"] as const;
export type SlotV4 = (typeof SLOTS_V4)[number];

export const FAMILLES_V4 = ["etiquette", "chiffre", "badge", "liste", "carte", "preuve", "fenetre", "coup-de-poing", "typo"] as const;
export type FamilleV4 = (typeof FAMILLES_V4)[number];

/** Descente de la prise (fraction de H) selon le gabarit : D1 (objet « tête »), D2 (carte haute), 0 sinon (standard § D.4). */
export const DESCENTE_V4 = Object.freeze({ D0: 0, D1: 0.06, D2: 0.26, D3: 0.32 });
/**
 * Boîte du visage (cheveux et menton compris) de la prise commune, translatée de la descente en cours : x 0,27 → 0,76 L, y 0,14 → 0,52 H
 * (standard § 0.5 : haut des cheveux 0,14 H, menton 0,49 H ; la zone interdite Z du standard ajoute une marge de 0,02 à 0,06 pour les objets posés).
 */
export const ZONE_VISAGE_V4 = Object.freeze({ x0: 0.27, y0: 0.14, x1: 0.76, y1: 0.52 });
/** Bande des YEUX (interdite aux sous-titres) : y 0,27 + D → 0,36 + D (standard § 0.5). */
export const BANDE_YEUX_V4 = Object.freeze([0.27, 0.36] as const);
/** Hauteur (fraction de H) de la boîte d'un groupe de sous-titres : plaque de 1,24 × 84 px + contour (`position-st.ts` du lot 5 : demi-hauteur 0,034). */
export const DEMI_HAUTEUR_SOUS_TITRES_V4 = 0.034;
/**
 * ZONE SÛRE COMBINÉE 9:16 : une même vidéo verticale part sur TikTok, Reels (Instagram/Facebook) et Shorts ; on prend le plus strict de chaque côté
 * (`zoneProtegeeCombinee`, `src/reseaux`, jamais recopiée). Valeurs actuelles (en % de l'image) : haut 14, droite 18, bas 30, gauche 6.
 * Aucune boîte de sous-titres ne sort de ce rectangle (boutons, légende et pseudo des réseaux).
 */
const ZONE_RESEAUX_916 = zoneProtegeeCombinee("9:16", ["tiktok", "instagram", "facebook", "youtube-shorts"])!;
export const ZONE_SURE_916_V4 = Object.freeze({
  haut: ZONE_RESEAUX_916.haut / 100, droite: ZONE_RESEAUX_916.droite / 100, bas: ZONE_RESEAUX_916.bas / 100, gauche: ZONE_RESEAUX_916.gauche / 100,
});
/** Centre le plus bas / le plus haut d'une boîte de sous-titres (fraction de H) : le bas de la boîte reste ≤ 1 − bas (0,70 H), le haut ≥ haut (0,14 H). */
export const Y_SOUS_TITRES_MAX_V4 = 1 - ZONE_SURE_916_V4.bas - 0.034;
export const Y_SOUS_TITRES_MIN_V4 = ZONE_SURE_916_V4.haut + 0.034;
/** Bords horizontaux autorisés (fraction de L) pour la boîte : de `gauche` (0,06) à 1 − `droite` (0,82). Les sous-titres sont centrés (0,5) si ça tient dans 0,18 → 0,82, sinon décalés vers la gauche. */
export const X_SOUS_TITRES_MIN_V4 = ZONE_SURE_916_V4.gauche;
export const X_SOUS_TITRES_MAX_V4 = 1 - ZONE_SURE_916_V4.droite;
/** Marge (fraction de H) entre le haut de la boîte et le bas de la bande des yeux quand on replace les sous-titres juste au-dessus des yeux. */
const MARGE_AU_DESSUS_YEUX_V4 = 0.005;

/** Position par défaut des sous-titres (prise seule et gabarit M1) : 0,66 H + descente réelle (standard § C.3). */
export const Y_SOUS_TITRES_BASE_V4 = 0.66;
/** Carte haute : 0,375 H quand la prise est à D2 (0,26) ; le décalage suit la descente réelle (standard § C.3, M2). */
export const Y_SOUS_TITRES_CARTE_V4 = 0.375;

/** Un bruitage joué par le composant lui-même : fichier de `sons/` sans extension (aucune musique). */
export type SonV4 = string;

export interface FicheCatalogueV4 {
  /** Identifiant du catalogue studio (`motion-v4/catalogue-v4.ts`). */
  id: string;
  lot: 1 | 2 | 3 | 4 | 5;
  /** Nom du composant exporté et chemin du .tsx depuis la racine du dépôt. */
  composant: string;
  fichier: string;
  nom: string;
  famille: FamilleV4;
  slot: SlotV4;
  /** Gabarit du standard § E. */
  gabarit: "M1" | "M2" | "M4" | "M5" | "M7";
  /** Descente de la prise tant que la plaquette est posée (fraction de H). */
  descente: number;
  /** Le visage est couvert EN ENTIER à l'état posé ; sinon il reste entier (M1, M2, M7). Jamais à moitié. */
  couvreVisage: boolean;
  /** Plein écran qui couvre le visage : un « coup de poing » (jamais avant 8 s ; 2 à 4 par 60 s). */
  coupDePoing: boolean;
  /** Images pendant lesquelles le visage est PARTIELLEMENT couvert au passage de l'élément (tolérance de Will : 3 au plus). */
  imagesVisagePartiel: number;
  /** Durée à l'écran, en secondes (min, max). */
  dureeSec: readonly [number, number];
  /** Événements graphiques déclarés (images à 30 i/s depuis le début ; négatif : depuis la fin). */
  evts: readonly number[];
  /** Nombre de textes (`mots`), de lignes datées (`lignes`), d'instants dits (`instants`) et de vidéos (`recherches`). */
  textes: readonly [number, number];
  lignes: readonly [number, number];
  instants: readonly [number, number];
  videos: readonly [number, number];
  /** Il faut un NOMBRE dit par Will (jamais un chiffre inventé). */
  exigeNombreDit: boolean;
  /** Ce que la plaquette montre et ce que `mots` / `lignes` / `instants` y mettent, en une phrase. */
  contenu: string;
  /** Quand l'utiliser, en une phrase. */
  quand: string;
  /** Centre des sous-titres (fraction de H) : nombre fixe, « base » (0,66 + descente réelle), « carte » (0,375 + écart de descente) ou `null` (masqués). */
  sousTitres: number | "base" | "carte" | null;
  /** Bruitages joués par le composant. */
  sons: readonly SonV4[];
  /**
   * Apparitions au plus par vidéo de 90 s (`plafondParVideoV4` le ramène à la durée réelle) : 2 par défaut (variété, 19/10) ; 3 pour PileNotifications (seule dans le bas),
   * dalle-claquee (seul plein cadre toujours possible, V7c), BadgeProfil et CarteCommande (motifs récurrents du standard § G, R10), et les 3 fenêtres sans vidéo
   * (FenetreTelephone, CarrouselFeuillete, FenetreDouble : elles fournissent le 3ᵉ emplacement de D2a).
   */
  maxParVideo: number;
  /** ★ LE SEUL CHAMP À CHANGER pour retenir ou écarter la plaquette (voir l'en-tête). */
  actif: true;
}

/** Une plaquette « en coulisse » : connue du catalogue studio, jamais choisie par le réalisateur. */
export interface FicheCoulisseV4 { id: string; actif: false; raison: string }

const D = "studio-rendu/compositions/interface-claire/motion-v4";
type Saisie = Omit<FicheCatalogueV4, "fichier" | "actif" | "descente" | "gabarit" | "couvreVisage" | "coupDePoing" | "maxParVideo" | "lignes" | "instants" | "videos" | "exigeNombreDit" | "imagesVisagePartiel" | "sousTitres"> & {
  chemin: string;
  gabarit: FicheCatalogueV4["gabarit"];
  lignes?: readonly [number, number];
  instants?: readonly [number, number];
  videos?: readonly [number, number];
  exigeNombreDit?: boolean;
  imagesVisagePartiel?: number;
  sousTitres?: FicheCatalogueV4["sousTitres"];
  maxParVideo?: number;
};

const PAR_GABARIT = {
  M1: { descente: DESCENTE_V4.D1, couvreVisage: false, coupDePoing: false, sousTitres: "base" as const },
  M2: { descente: DESCENTE_V4.D2, couvreVisage: false, coupDePoing: false, sousTitres: "carte" as const },
  M4: { descente: DESCENTE_V4.D0, couvreVisage: true, coupDePoing: false, sousTitres: Y_SOUS_TITRES_MAX_V4 },
  M5: { descente: DESCENTE_V4.D0, couvreVisage: true, coupDePoing: true, sousTitres: Y_SOUS_TITRES_MAX_V4 },
  M7: { descente: DESCENTE_V4.D0, couvreVisage: false, coupDePoing: false, sousTitres: Y_SOUS_TITRES_MIN_V4 },
} as const;

function fiche(s: Saisie): Readonly<FicheCatalogueV4> {
  const g = PAR_GABARIT[s.gabarit];
  const { chemin, ...reste } = s;
  return Object.freeze({
    lignes: [0, 0] as const, instants: [0, 0] as const, videos: [0, 0] as const, exigeNombreDit: false, imagesVisagePartiel: 0, maxParVideo: 2,
    ...g,
    ...reste,
    ...(s.sousTitres !== undefined ? { sousTitres: s.sousTitres } : {}),
    fichier: `${D}/${chemin}.tsx`,
    actif: true as const,
  });
}

/** Les 26 plaquettes ACTIVES (`actif: true`), dans l'ordre des lots. */
export const CATALOGUE_V4: readonly Readonly<FicheCatalogueV4>[] = Object.freeze([
  /* Lot 1 — au-dessus de la tête (M1) */
  fiche({ id: "EtiquetteTete", lot: 1, chemin: "lot1/EtiquetteTete", composant: "EtiquetteTete", nom: "Étiquette au-dessus de la tête", famille: "etiquette", slot: "tete", gabarit: "M1", dureeSec: [1.0, 2.0], evts: [0, 4, 12, -6],
    textes: [1, 2], lignes: [0, 1], instants: [0, 1], contenu: "une plaque orange ou blanche (1 ou 2 lignes) posée juste au-dessus de la tête, coiffée en option d'une sur-étiquette ; « mots » = les lignes de la plaque, « lignes[0] » = la sur-étiquette, « instants[0] » = l'instant de la 2ᵉ ligne",
    quand: "Pour poser le mot-clé de la phrase juste au-dessus de la tête, au moment où Will le dit.", sons: ["select_001"] }),
  fiche({ id: "Interjection", lot: 1, chemin: "lot1/Interjection", composant: "Interjection", nom: "Interjection", famille: "etiquette", slot: "tete", gabarit: "M1", dureeSec: [0.8, 1.2], evts: [0, 6, 12, 17, -3],
    textes: [1, 1], contenu: "une plaque encre au texte orange qui claque, soulignée d'un trait ; « mots[0] » = l'exclamation DITE (« ATTENTION. », « REGARDEZ. »)",
    quand: "Pour une exclamation brève que Will prononce vraiment, sur un temps fort.", sons: ["drop_001"] }),
  fiche({ id: "BadgeCompteur", lot: 1, chemin: "lot1/BadgeCompteur", composant: "BadgeCompteur", nom: "Badge compteur", famille: "chiffre", slot: "tete", gabarit: "M1", dureeSec: [1.5, 2.8], evts: [0, 3, 5, 7, 9, 6, 18, -6],
    textes: [1, 1], instants: [0, 1], exigeNombreDit: true, contenu: "un titre, quatre pictogrammes et un compteur sur plaque qui défile jusqu'au NOMBRE DIT ; « mots[0] » = le titre (ce qui est compté), « nombre » = la valeur dite, « instants[0] » = l'instant où le compteur démarre",
    quand: "Pour un nombre que Will dit (clients, appels, euros, minutes) pendant qu'il le dit.", sons: ["tick_001", "ding-3", "drop_002"] }),
  fiche({ id: "BadgeProfil", lot: 1, chemin: "lot1/BadgeProfil", composant: "BadgeProfil", nom: "Badge profil", famille: "badge", slot: "tete", gabarit: "M1", dureeSec: [1.0, 2.6], evts: [0, 3, 5, 8, 14, 22, 30, 33, 35, 38, 44, 52, 60],
    textes: [1, 3], lignes: [1, 3], contenu: "des cartes de profil génériques (pastille à INITIALES, jamais de faux visage) qui défilent ; « lignes[k].texte » = le rôle DIT (nom de la carte), « mots[k] » = le métier DIT (puce)",
    quand: "Pour présenter un rôle ou un métier que Will nomme (le dirigeant, l'équipe).", sons: ["select_001", "select_002"], maxParVideo: 3 }),
  fiche({ id: "RangeePastilles", lot: 1, chemin: "lot1/RangeePastilles", composant: "RangeePastilles", nom: "Rangée de pastilles", famille: "liste", slot: "tete", gabarit: "M1", dureeSec: [1.5, 2.5], evts: [0, 4, 6, 8, 10, 12, 22, 30, 38, -3],
    textes: [1, 1], lignes: [3, 5], contenu: "un titre court et 3 à 5 pastilles carrées qui s'allument une à une ; « mots[0] » = le titre, « lignes[k] » = le contenu de la pastille (chiffre ou mot DIT) et l'instant où Will le dit",
    quand: "Pour énumérer 3 à 5 points numérotés que Will dit (« un… deux… trois »).", sons: ["tick_002"] }),
  fiche({ id: "MotSaute", lot: 1, chemin: "lot1/MotSaute", composant: "MotSaute", nom: "Mot qui saute", famille: "etiquette", slot: "tete", gabarit: "M1", dureeSec: [1.2, 1.8], evts: [0, 4, 8, 23, -6],
    textes: [1, 2], contenu: "le mot fort quitte le sous-titre et se pose sur une plaque orange au-dessus de la tête ; « mots[0] » = le mot DIT, « mots[1] » = la sur-étiquette DITE (option)",
    quand: "Pour faire sauter UN mot que Will vient de dire du sous-titre vers le haut de l'image.", sons: ["drop_003", "select_001"] }),
  fiche({ id: "Chrono", lot: 3, chemin: "lot3/Chrono", composant: "Chrono", nom: "Chrono", famille: "chiffre", slot: "tete", gabarit: "M1", dureeSec: [1.5, 3.0], evts: [0, 2, 10, 12, 14, 16, 18, 20, 22, 24, 20, 30, 42, -3],
    textes: [1, 1], instants: [1, 2], exigeNombreDit: true, contenu: "un cadran dont l'aiguille tourne et une plaque de temps qui défile ; « nombre » = la durée DITE en SECONDES (2700 pour 45 minutes), « mots[0] » = le libellé DIT, « instants » = début du défilement puis libellé",
    quand: "Pour une durée que Will annonce (« 45 minutes », « deux heures ») ou le temps qui file.", sons: ["tick_001", "tick_002", "feutre", "select_001", "ding-3"] }),
  fiche({ id: "element-barre", lot: 5, chemin: "lot5/ElementBarre", composant: "ElementBarre", nom: "Élément barré", famille: "typo", slot: "tete", gabarit: "M1", dureeSec: [1.5, 1.9], evts: [0, 8, 24, 29, 34, 11, 23, 35, 47],
    textes: [1, 2], lignes: [0, 1], instants: [1, 1], contenu: "ce qu'on évite (une agence, un montant) s'affiche puis est barré d'un trait ; « mots » = les textes barrés DITS, « instants[0] » = le mot de négation, « lignes[0] » = ce qu'on pose à la place (option)",
    quand: "Pour barrer ce que Will dit d'éviter (« un outil de plus », « une embauche de plus ») et poser le bon choix.", sons: ["select_001", "select_002", "feutre", "drop_003"] }),

  /* Lot 2 — cartes hautes (M2) */
  fiche({ id: "CarteChecklist", lot: 2, chemin: "lot2/CarteChecklist", composant: "CarteChecklist", nom: "Carte checklist", famille: "liste", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 10, 30, 50, 16, 36, 56, 60, -3],
    textes: [1, 1], lignes: [3, 5], contenu: "un en-tête et 3 à 5 lignes qui s'ajoutent au mot cité puis se cochent ; « mots[0] » = l'en-tête DIT, « lignes[k] » = le texte de la ligne et l'instant où Will la dit",
    quand: "Pour une liste de 3 à 5 points que Will énumère.", sons: ["whoosh-in", "tick_001", "tick_002", "tick_004", "ding-2"] }),
  fiche({ id: "CarteCommande", lot: 2, chemin: "lot2/CarteCommande", composant: "CarteCommande", nom: "Carte commande", famille: "carte", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 5, 7, 9, 11, 20, 25, 40, 43, 46, 49, 60, 64, 75, 83, 91, -3],
    textes: [3, 7], instants: [5, 5], contenu: "une commande tapée dans un champ (boutons, étiquette, frappe, envoi, réponse) ; « mots » = [commande, étiquette, réponse, puis 1 à 4 boutons], « instants » = [boutons, étiquette, début de la frappe, envoi, réponse]",
    quand: "Pour montrer qu'une seule commande déclenche une action que Will décrit.", sons: ["whoosh-in", "select_002", "confirmation_002", "whoosh-out"], maxParVideo: 3 }),
  fiche({ id: "CarteCommentaire", lot: 2, chemin: "lot2/CarteCommentaire", composant: "CarteCommentaire", nom: "Carte commentaire", famille: "carte", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4], evts: [0, 20, 23, 50, 54, 58, 70, 75, 79, -3],
    textes: [1, 2], instants: [3, 3], contenu: "le parcours du spectateur : un mot-clé est tapé puis publié, une notification arrive (texte neutre, jamais un faux avis) ; « mots[0] » = le mot-clé DIT, « mots[1] » = la notification DITE (option), « instants » = [frappe, publication, notification]",
    quand: "Pour mettre en scène un commentaire d'exemple à écrire (jamais un faux avis).", sons: ["whoosh-in", "click_001", "confirmation_002", "vibreur"] }),
  fiche({ id: "CarteStatuts", lot: 2, chemin: "lot2/CarteStatuts", composant: "CarteStatuts", nom: "Carte statuts", famille: "carte", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 10, 30, 50, 13, 33, 53, 30, 50, 80, -3],
    textes: [4, 5], lignes: [3, 4], instants: [0, 1], contenu: "des rôles au travail : chaque ligne s'allume (EN COURS) puis passe FAIT ; « lignes[k].texte » = le rôle DIT et l'instant où Will le cite, « mots[k] » = l'action DITE de ce rôle (autant que de lignes), puis « mots[n] » = l'en-tête DIT de la carte, « mots[n+1] » = la pastille d'en-tête (option) ; « instants[0] » = fin de la dernière ligne (option)",
    quand: "Pour suivre plusieurs états ou rôles que Will cite l'un après l'autre.", sons: ["whoosh-in", "select_001", "confirmation_002"] }),
  fiche({ id: "GraphiqueBarres", lot: 2, chemin: "lot2/GraphiqueBarres", composant: "GraphiqueBarres", nom: "Graphique en barres", famille: "chiffre", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 4, 8, 11, 14, 17, 20, 40, 43, 60, 64, -3],
    textes: [1, 2], instants: [2, 3], contenu: "des barres qui montent, la dernière claque ; « mots[0] » = le titre DIT, « mots[1] » = la puce (« ×2 » SEULEMENT si « deux fois » est dit), « instants » = [axe, mot fort, puce]",
    quand: "Pour une hausse ou une comparaison de 3 à 5 valeurs que Will décrit.", sons: ["whoosh-in", "select_002", "ding-3"] }),
  fiche({ id: "CarteCalendrier", lot: 2, chemin: "lot2/CarteCalendrier", composant: "CarteCalendrier", nom: "Carte calendrier", famille: "carte", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, -3],
    textes: [1, 1], instants: [2, 2], contenu: "la semaine qui se remplit de pastilles ; « mots[0] » = l'en-tête DIT de la carte (jamais un mot non dit) ; « instants » = [première pastille, « tout seul » / « tout d'un coup »]",
    quand: "Pour situer des rendez-vous, une semaine, un délai que Will évoque.", sons: ["whoosh-in"] }),
  fiche({ id: "CarteComparaison", lot: 2, chemin: "lot2/CarteComparaison", composant: "CarteComparaison", nom: "Carte comparaison", famille: "carte", slot: "carte", gabarit: "M2", dureeSec: [1.5, 4.5], evts: [0, 10, 14, 19, 24, 40, 43, 60, 64, 70, 76, -3],
    textes: [4, 4], lignes: [3, 3], instants: [3, 3], contenu: "deux colonnes face à face avec « VS » ; « mots » = [colonne gauche, colonne droite (1 à 2 mots), résultat, en-tête DIT de la carte], « lignes[k].texte » = les 3 lignes COURTES (≤ 14 lettres) de la colonne gauche, « instants » = [gauche, VS, droite]",
    quand: "Pour opposer deux options côte à côte que Will oppose dans sa phrase.", sons: ["whoosh-in", "tick_001", "tick_004", "drop_002", "ding-4"] }),
  fiche({ id: "JaugePourcentage", lot: 3, chemin: "lot3/JaugePourcentage", composant: "JaugePourcentage", nom: "Jauge de pourcentage", famille: "chiffre", slot: "carte", gabarit: "M2", dureeSec: [1.5, 3.5], evts: [0, 2, 4, 6, 4, 10, 16, 22, 24, 30, 42, 54, -3],
    textes: [1, 1], instants: [4, 4], exigeNombreDit: true, contenu: "un pourcentage qui monte par paliers jusqu'à la valeur DITE ; « mots[0] » = le titre DIT, « nombre » = la valeur finale dite (100 pour « cent pour cent »), « instants » = les 4 paliers",
    quand: "Pour un travail qui avance jusqu'à un pourcentage que Will annonce.", sons: ["whoosh-in", "tick_001", "tick_002", "ding-2"] }),

  /* Lot 3 — bas (M7) */
  fiche({ id: "PileNotifications", lot: 3, chemin: "lot3/PileNotifications", composant: "PileNotifications", nom: "Pile de notifications", famille: "preuve", slot: "bas", gabarit: "M7", dureeSec: [2.0, 3.5], evts: [0, 14, 28, 16, 30, 48, 50, 52, -3],
    textes: [0, 3], lignes: [1, 3], contenu: "1 à 3 bulles de notification qui s'empilent sous le visage ; « lignes[k].texte » = le titre de la bulle DIT et l'instant où Will le dit, « mots[k] » = sa sous-ligne DITE (option)",
    quand: "Pour une pile de messages ou de tâches que Will cite un à un.", sons: ["ding-5", "vibreur"], sousTitres: Y_SOUS_TITRES_MIN_V4, maxParVideo: 3 }),

  /* Lot 4 — fenêtres sur le visage (M4) */
  fiche({ id: "FenetreTelephone", lot: 4, chemin: "lot4/FenetreTelephone", composant: "FenetreTelephone", nom: "Fenêtre téléphone", famille: "fenetre", slot: "fenetre", gabarit: "M4", dureeSec: [2.0, 4.0], evts: [0, 4, 6, 14, 19, 15, 21, 29, 36, 44, 52, 60, 68, -4],
    textes: [3, 3], instants: [0, 1], imagesVisagePartiel: 2, contenu: "un téléphone dont l'écran dessiné est validé d'un doigt ; « mots » = [étiquette DITE, 2ᵉ étiquette DITE (puce « signé »), bouton DIT], « instants[0] » = l'instant de l'étiquette (option)",
    quand: "Pour montrer un écran de téléphone (signature, validation) sur le visage.", sons: ["maximize_004", "tick_001", "vibreur"], maxParVideo: 3 }),
  fiche({ id: "FenetreDouble", lot: 4, chemin: "lot4/FenetreDouble", composant: "FenetreDouble", nom: "Fenêtre double", famille: "fenetre", slot: "fenetre", gabarit: "M4", dureeSec: [2.0, 3.5], evts: [0, 4, 10, 14, 18, 24, 34, 38, 46, 50, 58, 66, 74, 82, -8, -4],
    textes: [4, 4], instants: [0, 3], imagesVisagePartiel: 2, contenu: "deux écrans dessinés (un devis qui part, il revient signé) ; « mots » = [étiquette A, étiquette A2 (quand A part), étiquette B0 (quand B revient), étiquette B (tampon)], « instants » = [envoi, retour de B, tampon]",
    quand: "Pour deux choses qui s'enchaînent ou se répondent (le devis part, il revient signé).", sons: ["whoosh-in", "tick_001", "drop_002", "vibreur"], maxParVideo: 3 }),
  fiche({ id: "AvantApres", lot: 4, chemin: "lot4/AvantApres", composant: "AvantApres", nom: "Avant / après", famille: "fenetre", slot: "fenetre", gabarit: "M4", dureeSec: [2.0, 3.5], evts: [0, 5, 8, 14, 40, 46, 55, 64, 73, 82, -4],
    textes: [3, 3], instants: [1, 2], videos: [1, 1], imagesVisagePartiel: 2, contenu: "une fenêtre coupée en deux (AVANT en noir et blanc, APRÈS en liste qui se coche) avec une poignée qui balaie ; « mots » = [étiquette AVANT, étiquette APRÈS, étiquette automatique] (3 mots DITS), « recherches[0] » = la vidéo de l'AVANT, « instants » = [balayage, coche]",
    quand: "Pour opposer un avant et un après que Will oppose (à la main / tout seul).", sons: ["whoosh-in", "select_002", "tick_002"] }),
  fiche({ id: "CarrouselFeuillete", lot: 3, chemin: "lot3/CarrouselFeuillete", composant: "CarrouselFeuillete", nom: "Carrousel feuilleté", famille: "fenetre", slot: "fenetre", gabarit: "M4", dureeSec: [2.5, 4.5], evts: [0, 3, 12, 22, 32, 42, 52, 62, 72, -4],
    textes: [1, 3], instants: [1, 3], imagesVisagePartiel: 2, sousTitres: Y_SOUS_TITRES_MAX_V4, contenu: "une publication dont les pages se feuillettent à 3 pages par seconde ; « mots » = les étiquettes DITES qui se succèdent, « instants » = l'instant de chacune",
    quand: "Pour feuilleter plusieurs idées ou pages que Will énumère vite.", sons: ["whoosh-in", "select_002"], maxParVideo: 3 }),

  /* Lot 4 et 5 — plein cadre (M5, coups de poing) */
  fiche({ id: "MosaiqueVideos", lot: 4, chemin: "lot4/MosaiqueVideos", composant: "MosaiqueVideos", nom: "Mosaïque de vidéos", famille: "coup-de-poing", slot: "plein-cadre", gabarit: "M5", dureeSec: [2.0, 3.5], evts: [0, 1, 4, 8, 12, 40, 44, 48, -4],
    textes: [1, 1], instants: [1, 1], videos: [4, 6], imagesVisagePartiel: 1, contenu: "une grille inclinée de 4 à 6 vidéos littérales qui défile ; au mot fort une tuile sort de la grille ; « mots[0] » = le mot fort DIT, « instants[0] » = l'instant du mot fort, « recherches » = ce que montre CHAQUE vidéo (littéral)",
    quand: "Pour un coup de poing visuel qui montre plusieurs choses nommées par Will.", sons: ["whoosh-in", "select_001", "whoosh-out"] }),
  fiche({ id: "dalle-claquee", lot: 5, chemin: "lot5/DalleClaquee", composant: "DalleClaquee", nom: "Dalle claquée", famille: "coup-de-poing", slot: "plein-cadre", gabarit: "M5", dureeSec: [0.8, 1.0], evts: [0, 4, 6, 11, 17, 24],
    textes: [1, 2], imagesVisagePartiel: 2, sousTitres: null, contenu: "un aplat orange plein cadre et un mot géant qui claque ; « mots[0] » = le mot DIT, « mots[1] » = la suite de la phrase DITE sur plaque encre (option)",
    quand: "Pour claquer UN mot que Will martèle, au moment le plus fort de la prise.", sons: ["drop_004", "boum"], maxParVideo: 3 }),
  fiche({ id: "rafale-trois-mots", lot: 5, chemin: "lot5/RafaleTroisMots", composant: "RafaleTroisMots", nom: "Rafale de trois mots", famille: "coup-de-poing", slot: "plein-cadre", gabarit: "M5", dureeSec: [1.5, 1.8], evts: [0, 9, 12, 21, 25, 33, 36, 39, 44, 48],
    textes: [3, 3], instants: [2, 2], imagesVisagePartiel: 2, sousTitres: null, contenu: "trois mots dits à moins de 0,9 s d'écart, chacun sur un aplat plein cadre, puis récapitulatif ; « mots » = les 3 mots DITS, « instants » = les instants des mots 2 et 3",
    quand: "Pour trois mots de rythme que Will enchaîne (« simple, rapide, efficace »).", sons: ["click_001", "click_002", "drop_002", "select_001"] }),
  fiche({ id: "duel-video", lot: 5, chemin: "lot5/DuelVideo", composant: "DuelVideo", nom: "Duel de vidéos", famille: "coup-de-poing", slot: "plein-cadre", gabarit: "M5", dureeSec: [1.5, 2.0], evts: [0, 2, 4, 14, 15, 27, 39, 18, 30, 42, 51],
    textes: [2, 2], instants: [0, 2], videos: [2, 2], imagesVisagePartiel: 3, sousTitres: Y_SOUS_TITRES_MAX_V4, contenu: "deux vidéos en diagonale (A noir et blanc, B couleur) qui se percutent, « VS » au centre ; « mots » = [mot A, mot B], « recherches » = [vidéo A, vidéo B], « instants » = [mot B, verdict] (option), « verdict »",
    quand: "Pour opposer deux mots sur deux vidéos avec un verdict que Will tranche.", sons: ["whoosh-in", "drop_001"] }),
  fiche({ id: "EclatChiffre", lot: 3, chemin: "lot3/EclatChiffre", composant: "EclatChiffre", nom: "Éclat de chiffre", famille: "chiffre", slot: "plein-cadre", gabarit: "M5", dureeSec: [1.2, 2.5], evts: [0, 1, 4, 7, 10, 13, 17, 20, 30, 21, 33, 41, -3],
    textes: [1, 2], instants: [1, 2], exigeNombreDit: true, imagesVisagePartiel: 2, sousTitres: null, contenu: "un chiffre géant qui éclate sur aplat orange plein cadre ; « nombre » = le chiffre DIT, « mots[0] » = l'unité DITE (« MINUTES »), « mots[1] » = la précision DITE (option), « instants » = unité puis précision",
    quand: "Pour un chiffre clé que Will martèle (« 45 minutes », « 3 jours »).", sons: ["tick_001", "tick_002", "eclats"] }),
]);

/** Les 13 plaquettes en coulisse (code gardé, jamais choisies) : voir `motion-v4/catalogue-v4.ts` pour les raisons détaillées. */
export const COULISSE_V4: readonly Readonly<FicheCoulisseV4>[] = Object.freeze([
  ["LogoOutil", "note 7,55/10, logos génériques, risque de marque tierce"],
  ["Equation", "doublon avec EclatChiffre et BadgeCompteur"],
  ["FriseEtapes", "doublon avec CarteChecklist et CarteStatuts"],
  ["FilEtape", "redondant avec CarteStatuts"],
  ["AvisEtoiles", "risque DGCCRF (faux avis) : aucun faux avis"],
  ["PageWebDefile", "capture factice : fausse page"],
  ["FenetrePleinCadre", "doublon avec FenetreTelephone et MosaiqueVideos"],
  ["BandeVideo", "note 6,6/10 : à refaire"],
  ["CercleEpaule", "note 7,55/10, effet peu lisible"],
  ["mot-derriere", "texte libre derrière la tête : exception à confirmer par Will"],
  ["element-barre-pictos", "variante de ElementBarre"],
  ["appel-final-pile", "accent mangé et fin de vidéo à retravailler"],
  ["panneau-fin", "note 7,8/10, la plus basse du lot 5"],
].map(([id, raison]) => Object.freeze({ id, actif: false as const, raison })));

/**
 * Plafond d'apparitions d'une plaquette pour une vidéo de `duree` s : le plafond de la fiche (pour 90 s) ramené à la durée comme les seuils des familles
 * (`ramene`), jamais sous 2 (une plaquette qui sert deux fois reste toujours permise).
 */
export const plafondParVideoV4 = (f: Pick<FicheCatalogueV4, "maxParVideo">, duree: number) => Math.max(Math.min(2, f.maxParVideo), ramene(f.maxParVideo, duree));

export const elementsV4Actifs = (): readonly Readonly<FicheCatalogueV4>[] => CATALOGUE_V4;
export const ficheV4 = (id: string): Readonly<FicheCatalogueV4> | Readonly<FicheCoulisseV4> | undefined =>
  CATALOGUE_V4.find((f) => f.id === id) ?? COULISSE_V4.find((f) => f.id === id);
export const estCoupDePoingV4 = (f: Pick<FicheCatalogueV4, "coupDePoing">) => f.coupDePoing;

/** Rectangle (fractions de l'image) de l'emprise POSÉE de chaque gabarit (standard § E), la descente comprise. */
export const EMPRISE_V4: Readonly<Record<FicheCatalogueV4["gabarit"], { x0: number; y0: number; x1: number; y1: number }>> = Object.freeze({
  M1: { x0: 0.1, y0: 0.02, x1: 0.9, y1: 0.185 },
  M2: { x0: 0.07, y0: 0.035, x1: 0.93, y1: 0.33 },
  M4: { x0: 0.06, y0: 0.09, x1: 0.94, y1: 0.63 },
  M5: { x0: 0, y0: 0, x1: 1, y1: 1 },
  M7: { x0: 0.04, y0: 0.52, x1: 0.96, y1: 0.7 }, // bas ≤ 0,70 H : zone sûre TikTok / Reels / Shorts
});

/** État du visage une fois la plaquette posée : « entier » (rien ne le touche), « couvert » (Z entièrement sous l'emprise) ou « partiel ». */
export function etatVisagePoseV4(f: Pick<FicheCatalogueV4, "gabarit" | "descente">): "entier" | "couvert" | "partiel" {
  const r = EMPRISE_V4[f.gabarit];
  const z = { x0: ZONE_VISAGE_V4.x0, x1: ZONE_VISAGE_V4.x1, y0: ZONE_VISAGE_V4.y0 + f.descente, y1: ZONE_VISAGE_V4.y1 + f.descente };
  const dedans = r.x0 <= z.x0 && r.x1 >= z.x1 && r.y0 <= z.y0 && r.y1 >= z.y1;
  const dehors = r.x1 <= z.x0 || r.x0 >= z.x1 || r.y1 <= z.y0 || r.y0 >= z.y1;
  return dedans ? "couvert" : dehors ? "entier" : "partiel";
}

/**
 * Centre vertical des sous-titres (fraction de H) pour la fiche, à descente RÉELLE `d` (calcul image par image).
 * 1) position voulue de la fiche (base 0,66 + d, carte 0,375 + écart, ou valeur fixe) ; 2) BORNÉE dans la zone sûre 9:16
 * [`Y_SOUS_TITRES_MIN_V4` ; `Y_SOUS_TITRES_MAX_V4`] ; 3) si le bornage les pose sur la bande des yeux (prise très descendue), ils passent
 * JUSTE AU-DESSUS de la bande des yeux (jamais sur les yeux, règle V5a) — et au minimum au haut de la zone sûre.
 */
export function ySousTitresV4(f: Pick<FicheCatalogueV4, "sousTitres">, d: number): number | null {
  const s = f.sousTitres;
  if (s === null) return null;
  const voulu = s === "base" ? Y_SOUS_TITRES_BASE_V4 + d : s === "carte" ? (d >= 0.2 ? Y_SOUS_TITRES_CARTE_V4 + (d - DESCENTE_V4.D2) : Y_SOUS_TITRES_BASE_V4 + d) : s;
  return placerDansZoneSureV4(voulu, d);
}

/** Borne un centre voulu dans la zone sûre ; au-dessus de la bande des yeux si le bornage tombe dessus. */
export function placerDansZoneSureV4(voulu: number, d: number): number {
  const y = Math.min(Y_SOUS_TITRES_MAX_V4, Math.max(Y_SOUS_TITRES_MIN_V4, voulu));
  if (!sousTitresSurLesYeuxV4(y, d)) return y;
  return Math.max(Y_SOUS_TITRES_MIN_V4, BANDE_YEUX_V4[0] + d - MARGE_AU_DESSUS_YEUX_V4 - DEMI_HAUTEUR_SOUS_TITRES_V4);
}

/**
 * Bord gauche (fraction de L) d'un groupe de sous-titres de largeur `largeur` (fraction de L) : centré, sauf s'il déborde la zone sûre
 * (gauche 0,06 / droite 0,82), auquel cas il est décalé vers la gauche. Renvoie aussi si la largeur dépasse la zone (à réduire).
 */
export function bordGaucheSousTitresV4(largeur: number): number {
  const centre = Math.min(0.5, X_SOUS_TITRES_MAX_V4 - largeur / 2);
  return Math.max(X_SOUS_TITRES_MIN_V4, centre - largeur / 2);
}

/** La boîte des sous-titres (y ± demi-hauteur) touche-t-elle la bande des yeux de la prise descendue de `d` ? */
export function sousTitresSurLesYeuxV4(y: number | null, d: number): boolean {
  if (y === null) return false;
  const [e0, e1] = [BANDE_YEUX_V4[0] + d, BANDE_YEUX_V4[1] + d];
  return y - DEMI_HAUTEUR_SOUS_TITRES_V4 < e1 - 1e-9 && y + DEMI_HAUTEUR_SOUS_TITRES_V4 > e0 + 1e-9;
}

/** Geste de vie VISIBLE rendu sur TOUTES les plaquettes (`GesteVisible` de `registre-v4.tsx`, recopié ici : test d'égalité) : premier à l'image 8, un toutes les 13, le dernier finit 5 images avant la fin. */
export const GESTE_VIE_V4 = Object.freeze({ debut: 8, pas: 13, duree: 6, margeFin: 5 });
/** Images (depuis le début de la plaquette) des gestes de vie visibles d'une plaquette de `dureeImages` images. */
export function gestesDeVieV4(dureeImages: number): number[] {
  const g = GESTE_VIE_V4;
  const t: number[] = [];
  for (let i = g.debut; i + g.duree <= dureeImages - g.margeFin; i += g.pas) t.push(i);
  return t;
}
/**
 * Événements d'un élément en images depuis son début, durée `dureeImages` : événements de la fiche (entrée, lignes, étapes) + gestes de vie VISIBLES
 * (voir `GESTE_VIE_V4`), tels que le rendu les produit — plus de « geste tous les 12 images » déclaré sans être rendu (critique du 17/10).
 */
export function evenementsDeLElementV4(f: Pick<FicheCatalogueV4, "evts">, dureeImages: number): number[] {
  const propres = f.evts.map((e) => (e < 0 ? dureeImages + e : e)).filter((e) => e >= 0 && e <= dureeImages);
  return [...new Set([0, ...propres, ...gestesDeVieV4(dureeImages)])].sort((a, b) => a - b).filter((e) => e < dureeImages);
}

/** Plus long calme INTERNE (images) d'une plaquette de `dureeImages` images : de son début à sa fin, événements à moins de 4 images regroupés (comme `evenementsDuPlanV4`). */
export function plusLongCalmeInterneV4(f: Pick<FicheCatalogueV4, "evts">, dureeImages: number): number {
  const e: number[] = [];
  for (const x of [...evenementsDeLElementV4(f, dureeImages), dureeImages]) if (!e.length || x - e[e.length - 1] >= 4) e.push(x);
  let pire = 0;
  for (let k = 1; k < e.length; k++) pire = Math.max(pire, e[k] - e[k - 1]);
  return pire;
}

/** Fourchettes de durée (s) de la fiche sans calme interne de plus de `maxImages` images (22 = 0,75 s) : ce qu'Opus peut choisir sans être refusé par H1b. */
export function dureesSansCalmeV4(f: Pick<FicheCatalogueV4, "evts" | "dureeSec">, maxImages = 22): [number, number][] {
  const plages: [number, number][] = [];
  for (let n = Math.round(f.dureeSec[0] * 30); n <= Math.round(f.dureeSec[1] * 30); n++) {
    if (plusLongCalmeInterneV4(f, n) > maxImages) continue;
    const dernier = plages[plages.length - 1];
    if (dernier && Math.round(dernier[1] * 30) === n - 1) dernier[1] = n / 30;
    else plages.push([n / 30, n / 30]);
  }
  return plages;
}
