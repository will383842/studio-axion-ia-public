/**
 * CATALOGUE DU MONTEUR (plan facecam v4, B.14, B.26 et L11). PUR : constante du code (pas de type de Bibliothèque, pas
 * de migration). Il sert trois fois : dans la consigne de Claude, pour les règles fixes de la version simple, et pour le
 * bouton « Que puis-je demander ? » (exemples à toucher).
 */
import type { TypeOperationFacecam } from "./operations";
import { ENTREE_CATALOGUE_EFFET_REALISTE, exemplesEffetsMentionnes, type ExempleMentionne } from "@/briques/monteur/effet-realiste";
import { CATALOGUE_EFFETS, estEffetSpecial } from "./effets";
import { exemplesModelesEtendus, regleModelesEtendus } from "./catalogue-motion-etendu";
import { estDisponible } from "./disponibilite";

/** Options du catalogue. Mission L : les modèles d'animation 7 à 13 sont présentés PAR DÉFAUT (planche validée). */
export interface OptionsCatalogue {
  /**
   * Modèles d'animation 7 à 13 (règle de `ajouterCarte`, exemples de « Que puis-je demander ? »). Vrai par défaut ;
   * `false` rend le texte des 6 premiers modèles seulement (comparaison, formats qui n'ont que la base).
   */
  modelesEtendus?: boolean;
}

export interface EntreeCatalogue {
  type: TypeOperationFacecam;
  /** Ce que Will voit (mots simples). */
  libelle: string;
  /** Ce que Claude lit (règles de l'opération). */
  regle: string;
  /** Exemples de phrases de Will (touchables dans « Que puis-je demander ? »). */
  exemples: string[];
}

export const CATALOGUE_MONTEUR: EntreeCatalogue[] = [
  {
    type: "ajouterCarte",
    libelle: "Carte animée",
    regle:
      "Style : sobre (par défaut) ou spectaculaire (profondeur 3D, lumière, mots géants, éclats) ; il se lit dans la phrase de Will (« en spectaculaire », « plus sobre »), sinon ses habitudes, sinon l'intensité (Très dynamique → spectaculaire). Modèles : liste (points qui apparaissent au mot), chiffre (qui compte), avant-apres, ligne-de-temps (l'étape active suit la parole), deux-colonnes (avec la zone commune), titre. Tout le reste : carte sur mesure (modele null, html = { html, css, timeline GSAP }), 3 à 8 s, zones sûres, texte d'au moins 3 % de la hauteur, Poppins, charte Axion (fond sombre chaud #16120F, orange #E07040, crème #F6EEE0 ; jetons de la brique motion quand ils existent), aucune ressource réseau, aucun nom ni marque.",
    // Mission L : les phrases d'aide des modèles 7 à 13 suivent celles des 6 premiers.
    exemples: ["À 0:32, montre les 3 étapes en escalier, en orange", "Quand je dis Certifexemple, mets une carte avec le chiffre 32 %", "Compare les deux offres côte à côte", "Fais cette animation en spectaculaire", ...exemplesModelesEtendus()],
  },
  { type: "zoom", libelle: "Zoom", regle: "zoom net (punch-in) : plan serré sur le visage, 2 s au moins, calé sur le début d'un mot important (style punch-in, cible visage ; le zoom lent, le zoom flou et le zoom sur la main ne sont pas encore possibles).", exemples: ["Zoome quand je dis « gratuit »", "Un zoom sur la dernière phrase"] },
  { type: "ecranPartage", libelle: "Écran partagé", regle: "texte en haut, Will en bas, 3 à 8 s, 2 à 3 fois par vidéo, 25 % de la durée au plus.", exemples: ["Divise l'écran en deux quand j'énumère les avantages"] },
  { type: "miseEnPage", libelle: "Mise en page", regle: "cote : Will rétréci dans un cadre à gauche ou à droite, l'explication de l'autre côté ; vignette : Will en petit (image dans l'image). Aucun détourage.", exemples: ["Mets-moi à droite pendant l'explication", "Une petite version de moi en bas"] },
  { type: "couleurs", libelle: "Image", regle: "réglage lumiere, couleurs, mine ou dents, en 3 crans moins / juste / plus ; teinte plus-chaud ou plus-froid.", exemples: ["Ajoute des couleurs", "Un peu plus chaud", "Moins de blanc sur les dents"] },
  { type: "son", libelle: "Son", regle: "nettoyer (voix isolée), bruitage de la banque du studio (precision : whoosh, pop, tic, papier, vibration ou verre), plus-fort, moins-fort. La musique n'est pas encore possible (aucune musique branchée).", exemples: ["Nettoie le son", "Mets un whoosh quand je dis « attention »", "Parle plus fort"] },
  { type: "masquerPersonne", libelle: "Me cacher puis me faire revenir", regle: "À LA DEMANDE SEULEMENT : fondu vers la plaque vide filmée au début, la pièce vide continue de parler, puis Will revient.", exemples: ["Cache-moi pendant la phrase sur le prix, puis fais-moi revenir"] },
  { type: "texteDerriere", libelle: "Texte entre le mur et moi", regle: "À LA DEMANDE SEULEMENT : texte placé derrière Will (détourage sur les seules secondes demandées).", exemples: ["Écris « 2026 » derrière moi au début"] },
  { type: "vitesse", libelle: "Vitesse", regle: "facteur 0,5 à 2, la voix garde sa hauteur.", exemples: ["Accélère ce passage", "Ralentis la dernière phrase"] },
  { type: "arretImage", libelle: "Arrêt sur image", regle: "image figée 0,5 à 4 s sur un mot, avec un texte ou un chiffre facultatif.", exemples: ["Fais un arrêt sur image quand je souris à la fin"] },
  { type: "titre", libelle: "Titre", regle: "titre fixe pendant toute la vidéo (debutMot et finMot null) ou sur un passage ; plein écran seulement si Will le demande.", exemples: ["Mets le titre « 3 erreurs à éviter »"] },
  { type: "generique", libelle: "Générique", regle: "au début ou à la fin, 2 à 8 s, jamais de nom ni de marque.", exemples: ["Rajoute un générique de fin"] },
  { type: "couper", libelle: "Couper un passage", regle: "retire les mots de debutMot à finMot (la prise d'origine n'est jamais modifiée).", exemples: ["Coupe la phrase où je bafouille"] },
  { type: "retablir", libelle: "Rétablir un passage", regle: "remet un passage retiré par le studio (coupeId de la liste des coupes).", exemples: ["Remets le début, je veux garder le bonjour"] },
  { type: "retirer", libelle: "Retirer un élément", regle: "retire une carte, un zoom ou un écran partagé déjà posé (passageId de la liste des éléments).", exemples: ["Enlève la carte du chiffre"] },
  { type: "remettre", libelle: "Remettre une carte", regle: "remet une carte automatique retirée ou effacée (passageId d'un élément carte-auto-retiree ou carte-auto-effacee) : la même carte, mêmes textes, même instant.", exemples: ["Remets la carte que tu as enlevée"] },
  { type: "changerTitreCouverture", libelle: "Titre de couverture", regle: "change le titre de la COUVERTURE (<couverture> : miniature choisie, image montrée avant la lecture) ; l'image est refaite, la vidéo n'est PAS remontée. texte = nouveau titre, 5 mots au plus, sans code interne.", exemples: ["Mets « 3 erreurs à éviter » sur la couverture"] },
  // Lot K : effet réaliste par IA (payant, toujours confirmé ; la version 3D gratuite reste juste après).
  { ...ENTREE_CATALOGUE_EFFET_REALISTE, exemples: [...ENTREE_CATALOGUE_EFFET_REALISTE.exemples] },
  // Lot F3 : effets spéciaux, à la demande seulement.
  ...CATALOGUE_EFFETS,
];

/**
 * Style des cartes animées (lot C2) : « sobre » (validé, par défaut) ou « spectaculaire ». Le choix se fait par
 * `choisirStyleMotion` de la brique `motion` (demande > habitude > intensité).
 */
export const STYLE_CARTE_MONTEUR = {
  styles: ["sobre", "spectaculaire"] as const,
  libelle: "Style des animations",
  exemple: "Fais cette animation en spectaculaire",
} as const;

/** Nombre d'exemples des modèles 7 à 13 dans la liste courte de « Que puis-je demander ? ». */
export const EXEMPLES_MODELES_ETENDUS_COURTS = 3;

/**
 * Exemples proposés par « Que puis-je demander ? » (un par famille, dans l'ordre du catalogue ; le style des animations
 * juste après la carte). `max` borne les familles ; les exemples des modèles 7 à 13 (mission L : par défaut) se placent
 * juste après la carte et son style, sans chasser aucune famille ; les effets spéciaux s'ajoutent toujours à la fin.
 */
export function exemplesDemandes(max = 8, options: OptionsCatalogue = {}): string[] {
  // V6 « interdit de mentir » : seules les opérations rendues dans la vidéo sont proposées.
  const exemples = catalogueDisponible().filter((e) => !estEffetSpecial(e) && e.type !== "effetRealisteIA").map((e) => e.exemples[0]).filter(Boolean);
  exemples.splice(1, 0, STYLE_CARTE_MONTEUR.exemple);
  const familles = exemples.slice(0, max);
  if (options.modelesEtendus !== false) familles.splice(Math.min(2, familles.length), 0, ...exemplesModelesEtendus(EXEMPLES_MODELES_ETENDUS_COURTS));
  // Les effets spéciaux (lot F3) s'ajoutent toujours à la liste : ils ne se devinent pas.
  return [...familles, ...CATALOGUE_EFFETS.map((e) => e.exemples[0])];
}


/** V6 : le catalogue sans les opérations que la vidéo ne rend pas encore (vitesse, arrêt sur image, détourage). */
export function catalogueDisponible(): EntreeCatalogue[] {
  return CATALOGUE_MONTEUR.filter((e) => estDisponible(e.type));
}

/** Catalogue tel que Claude le lit (bloc de consigne, mis en cache). */
export function catalogueTexte(options: OptionsCatalogue = {}): string {
  return catalogueDisponible().map((e) => `- ${e.type} (${e.libelle}) : ${e.regle}${options.modelesEtendus !== false && e.type === "ajouterCarte" ? `\n${regleModelesEtendus()}` : ""}`).join("\n");
}

/**
 * Lot K : exemples d'effets de « Que puis-je demander ? » AVEC leur mention : « réaliste, payant » (effet réaliste par
 * IA, toujours confirmé) ou « en 3D, gratuit » (objet 3D, vitre, écran plié — aussi le repli de l'effet réaliste).
 */
export function exemplesEffets(): ExempleMentionne[] {
  return exemplesEffetsMentionnes(CATALOGUE_EFFETS.map((e) => e.exemples[0]));
}
