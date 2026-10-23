/**
 * MAQUETTES DU GÉNÉRATEUR (lot GM) — données de démonstration EN DUR.
 * Aucun appel, aucune base, aucun service : ces écrans servent à valider l'allure sur téléphone.
 * Les libellés suivent le lexique B.6.18 du plan v5 (voir `_lexique.ts`).
 */
import type { IdReseau } from "@/domaine/types";

/** Les 5 réseaux du générateur, dans l'ordre d'affichage. */
export const RESEAUX_GENERATEUR: IdReseau[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

/** État d'une case de la mini-grille (couleur ET signe). */
export type EtatCase = "vide" | "a-relire" | "valide" | "publie" | "probleme";

export interface LigneGrille {
  /** « Avocat », « Avocat · je lis »… */
  libelle: string;
  cases: Record<IdReseau, EtatCase | undefined>;
}

export interface SujetDemo {
  numero: number;
  version?: number;
  angle: string;
  lignes: LigneGrille[];
  quand: string;
}

function cases(tt: EtatCase, ig: EtatCase, yt: EtatCase, li: EtatCase, fb: EtatCase): Record<IdReseau, EtatCase | undefined> {
  return { tiktok: tt, instagram: ig, "youtube-shorts": yt, linkedin: li, facebook: fb, youtube: undefined };
}

export const SUJETS_DEMO: SujetDemo[] = [
  {
    numero: 42,
    angle: "Lire une facture, oui. La ranger sans erreur, non.",
    quand: "aujourd'hui",
    lignes: [
      { libelle: "Avocat", cases: cases("a-relire", "a-relire", "a-relire", "probleme", "a-relire") },
      { libelle: "Avocat · je lis", cases: cases("vide", "vide", "vide", "a-relire", "vide") },
    ],
  },
  {
    numero: 41,
    angle: "Le même fichier circule en 5 versions.",
    quand: "hier",
    lignes: [{ libelle: "Avocat", cases: cases("publie", "publie", "valide", "valide", "valide") }],
  },
  {
    numero: 40,
    version: 2,
    angle: "35 h par semaine, puis 0.",
    quand: "lundi",
    lignes: [
      { libelle: "Avocat", cases: cases("publie", "publie", "publie", "publie", "publie") },
      { libelle: "Podcast", cases: cases("valide", "vide", "vide", "a-relire", "vide") },
    ],
  },
  {
    numero: 39,
    angle: "Un tableau partagé n'est pas un outil de pilotage.",
    quand: "28/09",
    lignes: [{ libelle: "Avocat · je lis", cases: cases("publie", "publie", "publie", "publie", "publie") }],
  },
];

/** Brouillon sans numéro, en tête de liste. */
export const BROUILLON_DEMO = { idee: "Faut-il un DPO dans une PME de 20 personnes ?", manque: "une question client" };

export const SANS_SUJET_DEMO = ["Vidéo de Noël 2025", "Bande-annonce formation"];

/** Formats rangés par type de vidéo (bouton « Format »). */
export interface FormatDemo {
  code: string;
  nom: string;
  nbVideos: number;
  favori?: boolean;
}
export const FAMILLES_FORMATS_DEMO: { famille: string; formats: FormatDemo[] }[] = [
  {
    famille: "Face caméra",
    formats: [
      { code: "AV", nom: "Avocat", nbVideos: 31, favori: true },
      { code: "BUR", nom: "Derrière un bureau", nbVideos: 0 },
      { code: "SE", nom: "Selfie", nbVideos: 2 },
    ],
  },
  {
    famille: "Conversation",
    formats: [
      { code: "PO", nom: "Podcast", nbVideos: 4, favori: true },
      { code: "SAR", nom: "Podcast à deux", nbVideos: 0 },
    ],
  },
  {
    famille: "Écran et animation",
    formats: [
      { code: "EP", nom: "Écran partagé", nbVideos: 3 },
      { code: "MO", nom: "Motion", nbVideos: 1 },
    ],
  },
  {
    famille: "Témoignage",
    formats: [
      { code: "UG", nom: "Avis client filmé", nbVideos: 0 },
      { code: "TE", nom: "Témoignage", nbVideos: 0 },
    ],
  },
];

/** Écran Résultat : le sujet n° 42. */
export const RESULTAT_DEMO = {
  numero: 42,
  format: "Avocat",
  angle: "Lire une facture, oui. La ranger sans erreur, non.",
  limite: "vos factures viennent toutes du même fournisseur, au même format.",
  versions: [
    { reseau: "tiktok" as IdReseau, accroche: "ChatGPT lit vos factures. Il ne sait pas où les ranger.", duree: "0:34", voyant: "vert" as const },
    {
      reseau: "instagram" as IdReseau,
      accroche: "On me demande souvent si ChatGPT peut lire nos factures.",
      duree: "0:41",
      voyant: "ambre" as const,
      souci: "6 s de trop pour Instagram",
      action: { libelle: "Raccourcir", prix: "0,02 €" },
    },
    { reseau: "youtube-shorts" as IdReseau, accroche: "Une facture lue n'est pas une facture rangée.", duree: "0:29", voyant: "vert" as const },
    {
      reseau: "linkedin" as IdReseau,
      accroche: "Votre comptable vous l'a peut-être déjà dit : lire ne suffit pas.",
      duree: "0:52",
      voyant: "ambre" as const,
      souci: "Accroche lente : 4 s avant le sujet",
      action: { libelle: "Autre accroche", prix: "0,03 €" },
    },
    { reseau: "facebook" as IdReseau, accroche: "Trois factures, trois formats : voilà où ça coince.", duree: "0:38", voyant: "vert" as const },
  ],
  ajouts: [
    { libelle: "Je lis", prix: "0,40 €", icone: "texte" as const },
    { libelle: "Tu", prix: "0,35 €", icone: "personne" as const },
    { libelle: "Autre format", prix: "0,55 €", icone: "grille" as const },
  ],
  details: {
    gardeFous: ["Rien d'inventé", "Matière vraie : une question reçue", "Vouvoiement partout", "Durées sous le plafond"],
    notes: [
      { code: "0042-AV-TT", note: 88 },
      { code: "0042-AV-IG", note: 81 },
      { code: "0042-AV-YS", note: 86 },
      { code: "0042-AV-LI", note: 74 },
      { code: "0042-AV-FB", note: 84 },
    ],
    juges: "Accroche TikTok jugée la plus nette. Milieu B gardé (plus concret).",
    autreMilieu: "Milieu A : « Lire, c'est facile. Ranger, c'est un métier. »",
  },
};

/** Feuille de confirmation de fabrication (une version, en attendant la fabrication groupée). */
export const FABRICATION_DEMO = {
  prix: "3,50 €",
  totalJourAvant: "7,00 €",
  totalJourApres: "10,50 €",
  repereJour: "10,00 €",
  creditDouble: "41 min",
  creditEcriture: "12,40 €",
};

/** Carte « Il manque une matière ». */
export const MANQUE_DEMO = {
  idee: "Faut-il un DPO dans une PME de 20 personnes ?",
  typeSuggere: "une question client",
  reemploi: { texte: "On me demande souvent : est-ce qu'on a le droit de mettre nos fichiers clients dans ChatGPT ?", servie: "n° 31, le 12/08" },
};
