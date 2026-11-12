// MG-4 — tous les textes de l'écran des mots, en un seul fichier (PUR : aucun import serveur, aucun réseau).
// Vocabulaire : on dit « suivre le compte ». « Messages envoyés » = le premier message privé, une fois par personne et par mot.
import type {
  ReseauSite,
  TypeElement,
} from "@/domaine/guide-reseau/cibles-contrat";

export const LIBELLES_MOTS = {
  titre: "Mots et cibles",
  aide: "Un mot mène à une seule cible, pour tous les réseaux.",
  aucunMot: "Aucun mot pour le moment.",
  aucunMotAide:
    "Créez un premier mot pour qu'il envoie un guide ou une adresse de page.",
  siteSilencieux:
    "Le site n'a pas répondu : les mots ne sont pas affichés pour le moment.",
  lignesIgnorees: (n: number) =>
    n === 1
      ? "1 ligne du site n'a pas pu être lue."
      : `${n} lignes du site n'ont pas pu être lues.`,
  legendeTableau: "Mots, cible, réseaux et chiffres",
  colonnes: {
    mot: "Mot",
    cible: "Cible",
    reseaux: "Réseaux",
    ecrits: "Personnes qui ont écrit le mot",
    envoyes: "Messages envoyés",
    gagnees: "Personnes gagnées",
    etat: "État",
    action: "Action",
  },
  aideEnvoyes: "Premier message privé, une fois par personne et par mot.",
  aideGagnees: "Personnes qui ont fini par suivre le compte.",
  fenetres: { j7: "7 jours", j30: "30 jours", total: "Au total" },
  auMoins: (n: number) => `au moins ${n}`,
  pasDeChiffres: "Pas encore de chiffres",
  etatActif: "Actif",
  etatPause: "En pause",
  tousReseaux: "Tous les réseaux",
  typeElement: { guide: "Guide", adresse: "Adresse de page" } satisfies Record<
    TypeElement,
    string
  >,
  reseau: {
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    tous: "Tous les réseaux",
  } satisfies Record<ReseauSite, string>,
  sansCible: "Aucune cible",
  alerteIntrouvable:
    "Cible introuvable : elle n'est plus au catalogue ou elle est désactivée. Choisissez-en une autre.",
  alerteDivergent:
    "Le site pointe une autre cible que celle attendue par le Studio. Vérifiez-la ou changez-la.",
  badgeTest: "TEST",
  changerCible: "Changer la cible",
  changerCibleDuMot: (mot: string) => `Changer la cible du mot ${mot}`,
  confirmation: {
    titre: (mot: string, cible: string) =>
      `Le mot ${mot} enverra désormais : ${cible}.`,
    groupe: "Confirmation du changement de cible",
    rassurance: "Les chiffres restent sur le mot.",
    confirmer: "Confirmer le changement",
    annuler: "Annuler",
  },
  choix: {
    libelleRecherche: "Chercher une cible",
    aideRecherche:
      "Tapez une partie du titre, sans vous soucier des accents ni des majuscules.",
    liste: "Cibles disponibles",
    aucune: "Aucune cible ne correspond à cette recherche.",
    choisie: "Choisie",
    choisir: (titre: string) => `Choisir ${titre}`,
  },
  nouveau: {
    titre: "Créer un mot",
    libelleMot: "Le mot à écrire",
    aideMot: "De 2 à 20 lettres ou chiffres, sans espace.",
    creer: "Créer le mot",
    erreurMotVide: "Écrivez un mot avant de continuer.",
    erreurCibleVide:
      "Choisissez ce que le mot envoie : un guide ou une adresse de page.",
  },
  suivreLeCompte:
    "Les personnes gagnées sont celles qui ont fini par suivre le compte : le chiffre est un minimum (« au moins »).",
} as const;
