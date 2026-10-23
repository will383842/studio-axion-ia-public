/**
 * Libellés et tonalités d'affichage (PUR, importable côté client).
 * Les tonalités sont des NOMS DE JETONS : « orange », « sauge », « ambre », « brique », « neutre ».
 */
import type { NomIcone } from "@/components/ui/Icone";
import { formaterMontant } from "@/lib/montants";
import type { BriqueFacultative, EtapeEditoriale, Montant, EtatVeille, NaturePersonnage, StatutNouveaute, StatutPreparation, StatutTravail, StatutVideo, TypeElement, VeilleNouveaute } from "./types";

export type Tonalite = "orange" | "sauge" | "ambre" | "brique" | "neutre";

export const STATUTS_VIDEO: Record<StatutVideo, { libelle: string; tonalite: Tonalite; icone: NomIcone }> = {
  brouillon: { libelle: "Brouillon", tonalite: "neutre", icone: "ecrire" },
  maquette: { libelle: "Maquette", tonalite: "neutre", icone: "oeil" },
  en_file: { libelle: "En attente", tonalite: "ambre", icone: "sablier" },
  en_fabrication: { libelle: "En fabrication", tonalite: "orange", icone: "chargement" },
  prete: { libelle: "Prête", tonalite: "sauge", icone: "valide" },
  echec: { libelle: "À corriger", tonalite: "brique", icone: "attention" },
  annulee: { libelle: "Arrêtée", tonalite: "neutre", icone: "fermer" },
  archivee: { libelle: "Archivée", tonalite: "neutre", icone: "archive" },
};

export const ETAPES_EDITORIALES: Record<EtapeEditoriale, { libelle: string; tonalite: Tonalite; icone: NomIcone }> = {
  a_relire: { libelle: "À relire", tonalite: "ambre", icone: "oeil" },
  validee: { libelle: "Validée", tonalite: "sauge", icone: "coche" },
  programmee: { libelle: "Programmée", tonalite: "orange", icone: "calendrier" },
  publiee: { libelle: "Publiée", tonalite: "sauge", icone: "megaphone" },
};

/**
 * Retirer sans effacer : UN SEUL vocabulaire pour les vidéos, la Bibliothèque, les modèles et les idées
 * (ordre permanent « on ne purge rien »). Rien n'est jamais supprimé ; « Restaurer » remet en place.
 */
export const LIBELLES_RETRAIT = { action: "Archiver", retour: "Restaurer", liste: "Archivés", listeFeminin: "Archivées" } as const;

export const STATUTS_TRAVAIL: Record<StatutTravail, { libelle: string; tonalite: Tonalite }> = {
  en_file: { libelle: "En attente", tonalite: "ambre" },
  en_cours: { libelle: "En cours", tonalite: "orange" },
  termine: { libelle: "Terminé", tonalite: "sauge" },
  echec: { libelle: "À corriger", tonalite: "brique" },
  annule: { libelle: "Annulé", tonalite: "neutre" },
};

export const STATUTS_PREPARATION: Record<StatutPreparation, { libelle: string; tonalite: Tonalite }> = {
  brouillon: { libelle: "À compléter", tonalite: "neutre" },
  en_preparation: { libelle: "En préparation", tonalite: "orange" },
  pret: { libelle: "Prêt", tonalite: "sauge" },
  a_verifier: { libelle: "À vérifier", tonalite: "ambre" },
  echec: { libelle: "À corriger", tonalite: "brique" },
};

export const NATURES_PERSONNAGE: Record<NaturePersonnage, { libelle: string; icone: NomIcone }> = {
  moi: { libelle: "Moi", icone: "personne" },
  reel: { libelle: "Personne réelle", icone: "bouclier" },
  invente: { libelle: "Personnage inventé", icone: "etincelles" },
};

/** Types de la Bibliothèque : tuiles (mobile) et onglets (bureau), dans l'ordre d'affichage. */
export const TYPES_BIBLIOTHEQUE: { type: TypeElement | "prononciations" | "mes-images"; nom: string; icone: NomIcone; groupe: "style" | "medias" | "son" }[] = [
  { type: "couleurs", nom: "Couleurs", icone: "nuancier", groupe: "style" },
  { type: "police", nom: "Polices", icone: "texte", groupe: "style" },
  { type: "logo", nom: "Logo", icone: "certifie", groupe: "style" },
  { type: "lut", nom: "LUT", icone: "contraste", groupe: "style" },
  { type: "style-sous-titres", nom: "Sous-titres", icone: "sous-titres", groupe: "style" },
  { type: "habillage", nom: "Habillage", icone: "calques", groupe: "style" },
  { type: "style-montage", nom: "Montage", icone: "ciseaux", groupe: "style" },
  // Lot A2 : les images de Will (bureau, consoles, interventions), en tête de la cascade des illustrations.
  { type: "mes-images", nom: "Mes images", icone: "images", groupe: "medias" },
  { type: "illustration-image", nom: "Images", icone: "image", groupe: "medias" },
  { type: "illustration-video", nom: "Vidéos", icone: "film", groupe: "medias" },
  // Les anciens « Fonds » sont des décors en mode teinte (fusion, B.0 §6).
  { type: "decor", nom: "Décors", icone: "grille", groupe: "medias" },
  { type: "accessoire", nom: "Accessoires", icone: "micro", groupe: "medias" },
  { type: "musique", nom: "Musiques", icone: "musique", groupe: "son" },
  { type: "bruitage", nom: "Bruitages", icone: "volume", groupe: "son" },
  { type: "profil-son", nom: "Son", icone: "son", groupe: "son" },
  { type: "prononciations", nom: "Prononciations", icone: "micro", groupe: "son" },
];

export const LICENCES: Record<string, string> = {
  propriete: "À moi",
  libre: "Libre",
  abonnement: "Abonnement",
  achat: "Achetée",
  "generee-ia": "Créée par l'IA",
  "a-verifier": "À vérifier",
};

/** Libellés des briques facultatives (AV2.7) : LES MÊMES dans l'assistant et dans la fiche vidéo. */
export const LIBELLES_BRIQUES: Record<BriqueFacultative, { libelle: string; icone: NomIcone }> = {
  "sous-titres": { libelle: "Sous-titres", icone: "sous-titres" },
  etalonnage: { libelle: "Couleurs de cinéma (LUT)", icone: "contraste" },
  illustrations: { libelle: "Images d'illustration", icone: "images" },
  son: { libelle: "Musique et bruitages", icone: "musique" },
  habillage: { libelle: "Habillage (logo, fin)", icone: "calques" },
  "texte-ecran": { libelle: "Texte à l'écran", icone: "texte" },
  "mention-ia": { libelle: "Mention IA à l'écran", icone: "certifie" },
};

/* --- Veille des outils (lot B2) ------------------------------------- */

/** État d'une carte de la veille : ✅ à jour · 🟠 nouveauté · 🔴 attention · gris impossible de vérifier. */
export const ETATS_VEILLE: Record<EtatVeille, { libelle: string; tonalite: Tonalite; icone: NomIcone }> = {
  "a-jour": { libelle: "À jour", tonalite: "sauge", icone: "valide" },
  nouveaute: { libelle: "Nouveauté", tonalite: "orange", icone: "etincelles" },
  attention: { libelle: "Attention", tonalite: "brique", icone: "attention" },
  injoignable: { libelle: "Impossible de vérifier", tonalite: "neutre", icone: "hors-ligne" },
};

export const INTERETS_VEILLE: Record<VeilleNouveaute["resume"]["interet"], { libelle: string; tonalite: Tonalite }> = {
  fort: { libelle: "Intérêt fort", tonalite: "orange" },
  moyen: { libelle: "Intérêt moyen", tonalite: "ambre" },
  faible: { libelle: "Intérêt faible", tonalite: "neutre" },
};

export const STATUTS_NOUVEAUTE: Record<StatutNouveaute, { libelle: string; tonalite: Tonalite }> = {
  nouvelle: { libelle: "À regarder", tonalite: "orange" },
  essayer: { libelle: "À essayer", tonalite: "ambre" },
  ignoree: { libelle: "Ignorée", tonalite: "neutre" },
  appliquee: { libelle: "Appliquée", tonalite: "sauge" },
};

/** « 2 nouveautés », « 1 alerte », « 6 à jour », « 3 impossibles à vérifier » (bilan de la veille). */
export function compteEtatVeille(e: EtatVeille, n: number): string {
  const s = n > 1 ? "s" : "";
  if (e === "a-jour") return `${n} à jour`;
  if (e === "nouveaute") return `${n} nouveauté${s}`;
  if (e === "attention") return `${n} alerte${s}`;
  return `${n} impossible${s} à vérifier`;
}

/* ------------------------------------------------------------------ */
/* Générateur de scripts, lot G1b : lexique de l'écran (plan v5 B.6.18) */
/* Les SEULS mots que Will voit pour le générateur. Un test vérifie     */
/* qu'aucun mot interdit n'y figure.                                   */
/* ------------------------------------------------------------------ */

/** Mots jamais affichés (B.6, consigne de Will) : vérifiés par `tests/g1b-lexique.test.ts`. */
export const MOTS_INTERDITS_ECRAN: readonly string[] = ["job", "render", "prompt", "token", "api", "upload", "pipeline", "workflow", "mock", "fictif", "dashboard", "avatar"];

/** Lexique B.6.18 : terme interne → mot affiché. `null` = jamais affiché. */
export const LEXIQUE_GENERATEUR: Readonly<Record<string, string | null>> = {
  variante: "version TikTok",
  "corps distinct": "vidéo refaite en entier",
  "corps commun": "le milieu",
  mode: "Qui parle",
  "famille d'accroche": "style d'accroche",
  "famille de format": "type de vidéo",
  marqueur: null,
  "plan de script": null,
  "choix conjoint": null,
  relachement: "Variété : on a dû répéter",
  ScriptMaitre: "sujet",
  Matiere: "matière",
  ancrage: "l'élément vrai du sujet",
  phraseWill: "une phrase à vous (facultatif)",
  exception: "la limite (Sauf si…)",
  ANCRAGE_MANQUANT: "il manque une matière",
  PREUVE_MANQUANTE: "il manque une preuve",
  "a-reverifier": "milieu modifié, à revoir",
  "en-attente-credit": "crédit Claude épuisé, à reprendre",
  "plafond-atteint": "plafond atteint",
  echec: "à corriger",
  "bloquee-modele": "modèle d'écriture à mettre à jour",
  brouillon: "sujet sans numéro",
  objectif: "But",
  pilier: "thème",
  "point de vue": null,
  emotion: null,
  "-L": "je lis",
  "-I": "j'improvise",
  "-V": "voix off",
  "-T": "tu",
  "-A2": "2e accroche",
  "etiquette IA": "étiquette IA (facultative)",
  demarrage: "compte débutant",
  retrait: "retirée",
  MATIERE_INSUFFISANTE: "pas assez de matière pour une vidéo",
  MATIERE_A_PRECISER: "une phrase à préciser",
  TERME_A_CONFIRMER: "même chose pour vous ?",
  "[LIMITE À VALIDER]": "limite proposée, à valider",
  sujetSensible: "sujet sensible : vous en personne conseillé",
  "duel des deux corps": null,
};

/** Signe d'une case : une couleur ET un signe, lisible sans les couleurs. */
export type SigneCase = "vide" | "point" | "coche" | "film" | "calendrier" | "avion" | "probleme";

/** État d'une version par réseau (`etatReseau`, B.2.5) tel qu'il s'affiche dans la mini-grille. */
export const ETATS_RESEAU_GENERATEUR: Record<
  "absent" | "a-relire" | "a-completer" | "a-reverifier" | "validee" | "en-video" | "programmee" | "publiee" | "probleme",
  { libelle: string; signe: SigneCase; tonalite: Tonalite }
> = {
  absent: { libelle: "pas écrit", signe: "vide", tonalite: "neutre" },
  "a-relire": { libelle: "à relire", signe: "point", tonalite: "ambre" },
  "a-completer": { libelle: "à compléter", signe: "point", tonalite: "ambre" },
  "a-reverifier": { libelle: "milieu modifié, à revoir", signe: "point", tonalite: "ambre" },
  validee: { libelle: "validé", signe: "coche", tonalite: "sauge" },
  "en-video": { libelle: "vidéo prête", signe: "film", tonalite: "sauge" },
  programmee: { libelle: "programmé", signe: "calendrier", tonalite: "orange" },
  publiee: { libelle: "publié", signe: "avion", tonalite: "orange" },
  probleme: { libelle: "problème", signe: "probleme", tonalite: "brique" },
};

/** État d'un sujet (`etatSujet`) : les états propres au sujet, puis ceux de sa version la moins avancée. */
export const ETATS_SUJET_GENERATEUR: Record<string, { libelle: string; tonalite: Tonalite }> = {
  brouillon: { libelle: "sujet sans numéro", tonalite: "ambre" },
  "en-ecriture": { libelle: "en écriture", tonalite: "orange" },
  "a-completer": { libelle: "à compléter", tonalite: "ambre" },
  echec: { libelle: "à corriger", tonalite: "brique" },
  "bloquee-modele": { libelle: "modèle d'écriture à mettre à jour", tonalite: "brique" },
  ...Object.fromEntries(Object.entries(ETATS_RESEAU_GENERATEUR).map(([k, v]) => [k, { libelle: v.libelle, tonalite: v.tonalite }])),
};

/** Arrêts gratuits, avant toute dépense (B.6.9). */
export const MANQUES_GENERATEUR: Record<string, string> = {
  ANCRAGE_MANQUANT: "Il manque une matière",
  PREUVE_MANQUANTE: "Il manque une preuve",
  MATIERE_INSUFFISANTE: "Pas assez de matière pour une vidéo",
  MATIERE_A_PRECISER: "Une phrase à préciser",
  EXCEPTION_A_VALIDER: "Limite proposée, à valider",
  TERME_A_CONFIRMER: "Même chose pour vous ?",
  HORS_DOMAINE: "Hors du domaine d'Axion-IA",
};

/** « But » du sujet (`ObjectifSujet`). « Faire partager » par défaut. */
export const BUTS_SUJET: Record<"notoriete" | "sauvegarde" | "conversation" | "rendez-vous", { libelle: string; icone: NomIcone }> = {
  notoriete: { libelle: "Faire partager", icone: "partager" },
  sauvegarde: { libelle: "Faire garder", icone: "signet" },
  conversation: { libelle: "Faire réagir", icone: "citation" },
  "rendez-vous": { libelle: "Rendez-vous", icone: "calendrier" },
};

/** « Qui parle » (`ModeDiction`), avec la lettre du code. */
export const QUI_PARLE: Record<"avatar" | "teleprompteur" | "trame" | "voix-off", { libelle: string; court: string; lettre: string; icone: NomIcone }> = {
  avatar: { libelle: "Mon double", court: "", lettre: "", icone: "visage" },
  teleprompteur: { libelle: "Je lis", court: "je lis", lettre: "L", icone: "texte" },
  trame: { libelle: "J'improvise", court: "j'improvise", lettre: "I", icone: "micro" },
  "voix-off": { libelle: "Voix off", court: "voix off", lettre: "V", icone: "volume" },
};

export const ADRESSES: Record<"vous" | "tu", { libelle: string; lettre: string }> = {
  vous: { libelle: "Vous", lettre: "" },
  tu: { libelle: "Tu", lettre: "T" },
};

/** Motifs de refus en un toucher (B.6.7). */
export const MOTIFS_REFUS: Record<"pas-moi" | "faux" | "deja-dit" | "trop-long" | "trop-vendeur" | "autre", string> = {
  "pas-moi": "pas moi",
  faux: "faux",
  "deja-dit": "déjà dit",
  "trop-long": "trop long",
  "trop-vendeur": "trop vendeur",
  autre: "autre",
};

/** « Type de vidéo » (famille de format), pour le bouton Format. */
export const FAMILLES_FORMAT: Record<string, string> = {
  "face-camera": "Face caméra",
  conversation: "Conversation",
  "ecran-partage": "Écran et démonstration",
  motion: "Animation et voix off",
  ugc: "Spontané au téléphone",
  temoignage: "Témoignage",
  autre: "Autres",
};

/** Libellé d'une ligne de la mini-grille : « Avocat », « Avocat · je lis », « Avocat · je lis · tu ». */
export function libelleLigneGrille(nomFormat: string, mode: keyof typeof QUI_PARLE, adresse: keyof typeof ADRESSES): string {
  return [nomFormat, QUI_PARLE[mode].court, adresse === "tu" ? "tu" : ""].filter(Boolean).join(" · ");
}

/** Nom d'un format dans la grille et sur les boutons : « Type avocat » → « Avocat ». */
export function nomFormatGenerateur(nomCourt: string): string {
  const n = nomCourt.replace(/^type\s+/i, "");
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Suivi d'une fabrication (écrans de suivi) : UNE phrase par état, la même pour tous les formats. */
export const PHRASES_SUIVI = {
  "en-cours": { titre: "Votre vidéo se fabrique", phrase: "Vous pouvez fermer." },
  coincee: { titre: "La fabrication s'est arrêtée", phrase: "Une étape n'a pas abouti. Vous pouvez reprendre." },
  arretee: { titre: "Vous avez arrêté la fabrication", phrase: "Rien n'est perdu." },
  "a-relire": { titre: "Votre script attend votre relecture", phrase: "Relisez-le, puis lancez la suite." },
  prete: { titre: "Votre vidéo est prête", phrase: "Vous pouvez la regarder." },
} as const;

/** Actions d'un suivi, dans les trois verbes (« Reprendre », « Refaire », « Recommencer »). */
export const ACTIONS_FABRICATION = {
  arreter: "Arrêter",
  passerDevant: "Passer devant",
  reprendreEtape: "Reprendre cette étape",
  recommencer: "Recommencer",
  annuler: "Annuler cette vidéo",
} as const;

/** « Annuler cette vidéo » : le même mot et la même promesse partout (mettre à la corbeille, jamais effacer). */
export const ANNULER_VIDEO = {
  libelle: "Annuler cette vidéo",
  confirmation: "Elle ira à la corbeille, restaurable 30 jours.",
  /** Fabrication en cours : on l'arrête d'abord, seules les étapes déjà faites sont payées. */
  arretEtConfirmation: "La fabrication s'arrête, puis la vidéo ira à la corbeille, restaurable 30 jours. Seules les étapes déjà faites sont payées.",
} as const;

/** L'argent d'une fabrication, dit de quatre façons seulement. */
export const LIBELLES_ARGENT = { estime: "Coût estimé", auPlus: "Au plus", dejaPaye: "Déjà payé", essai: "Essai, pas payé" } as const;

/** Texte du bouton « Fabriquer » : jamais de montant pour un format sans prix. */
export function libelleFabriquer({ montant, dureeSec, n, sansPrix, essai }: { montant?: Montant; dureeSec?: number; n?: number; sansPrix: boolean; essai: boolean }): string {
  const parties = [n && n > 1 ? `Fabriquer ${n} vidéos` : "Fabriquer"];
  if (dureeSec) parties.push(dureeSec < 60 ? `${Math.round(dureeSec)} s` : `${Math.round(dureeSec / 60)} min`);
  if (montant && !sansPrix) parties.push(formaterMontant(montant));
  const texte = parties.join(" · ");
  return essai && !sansPrix ? `${texte} (essai)` : texte;
}
