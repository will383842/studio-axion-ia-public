// R4 — textes de la fiche d'un mot et de l'écran « mots et cibles » (PUR : aucun import serveur, aucun réseau).
// Vocabulaire : on dit « suivre le compte ».
import type {
  EtatMotVue,
  EtatValidationVue,
  ReseauAutoVue,
  ReseauCompte,
} from "@/domaine/guide-reseau/vue-mots-cibles";

export const PHRASE_PLUSIEURS_MOTS_ETEINT =
  "Le réglage « plusieurs mots » est éteint : seul le mot GUIDE peut envoyer pour l'instant. Les autres mots restent en brouillon.";

export const NOM_RESEAU: Record<ReseauCompte, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

export const LIBELLES_FICHE = {
  titre: (mot: string) => `Fiche du mot ${mot}`,
  fermer: "Fermer la fiche",
  envoie: {
    titre: "Ce que le mot envoie",
    sansCible: "Choisissez d'abord une cible.",
    chargement: "Chargement des cibles…",
    adresse:
      "Une adresse de page n'est pas encore envoyée par message privé : pour l'instant, seuls les guides partent.",
    test: "Cible d'essai (TEST) : elle n'est jamais envoyée à de vraies personnes.",
    badgeTest: "TEST",
    guide: "Guide",
    adresseType: "Adresse de page",
  },
  textes: {
    titre: "Textes du mot, réseau par réseau",
    aide: "Relisez les textes tels qu'ils partiront pour ce mot. Ils se valident réseau par réseau. Valider n'envoie rien.",
    chargement: "Chargement des textes…",
    lien: "(lien personnel, créé au moment de l'envoi)",
    illisible: "Les textes n'ont pas pu être lus. Réessayez dans un instant.",
    valides: "Textes validés",
    aRevalider: "Textes à revalider",
    nonValides: "Textes non validés",
    explicationRevalider:
      "La cible, son titre ou un texte a changé depuis la validation : ce mot n'envoie plus rien sur ce réseau tant que vous ne validez pas de nouveau.",
    valider: (reseau: string) => `Valider les textes pour ${reseau}`,
    guide:
      "Les textes du mot GUIDE se valident dans le bloc « Mot GUIDE », plus bas sur cette page.",
    aLaMain:
      "LinkedIn et TikTok : réponse à la main seulement, depuis « À traiter ». Rien n'y part tout seul.",
  },
  etatValidation: {
    valide: "Textes validés",
    perimee: "Textes à revalider",
    absente: "Textes non validés",
  } satisfies Record<EtatValidationVue, string>,
  comptes: {
    titre: "Comptes",
    aucun: "Aucun compte n'est relié au parcours sur le serveur.",
    activer: "Activer",
    activerLe: (mot: string, nom: string) => `Activer le mot ${mot} sur ${nom}`,
    pause: "Mettre en pause",
    // Le nom accessible commence par le texte visible du bouton (« Mettre en pause »).
    pauseLe: (mot: string, nom: string) =>
      `Mettre en pause le mot ${mot} sur ${nom}`,
    etat: {
      actif: "Actif",
      pause: "En pause",
      pause_auto: "Pause automatique",
      non_pose: "Pas activé",
    },
    raisonInconnue: "Ce compte ne peut pas être activé pour le moment.",
    raisons: {
      textes_non_valides_reseau: "Validez d'abord les textes pour ce réseau.",
      reseau_a_la_main: "Ce réseau se traite à la main, dans « À traiter ».",
      reseau_du_compte_inconnu:
        "Le réseau de ce compte est inconnu : relancez « Tester » dans Réglages, Zernio.",
      plusieurs_mots_eteint: PHRASE_PLUSIEURS_MOTS_ETEINT,
      cible_test: "Cible d'essai (TEST) : elle ne s'active pas ici.",
      sans_cible: "Choisissez d'abord une cible.",
      cible_introuvable: "La cible n'est plus au catalogue ou elle est désactivée : choisissez-en une autre.",
      site_injoignable: "Le site ne répond pas : l'activation reprendra quand il répondra.",
      adresse_pas_encore: "Une adresse de page n'est pas encore envoyée par message privé : seuls les guides partent.",
      validation_perimee: "Les textes ont changé depuis la validation : validez-les de nouveau.",
      lecture_impossible: "Les réglages sont illisibles pour le moment : rien n'a changé.",
    } as Record<string, string>,
  },
  chiffres: {
    titre: "Chiffres (aucun nom n'est affiché)",
    aucun: "Pas encore de chiffres",
    fenetres: { j7: "7 jours", j30: "30 jours", total: "Au total" },
    ecrits: "Personnes qui ont écrit le mot",
    envoyes: "Messages privés envoyés",
    aVerifier: (n: number) => `dont ${n} à vérifier`,
    gagnees: "Personnes gagnées (qui ont fini par suivre le compte)",
    aucuneVue: "aucune vue pour l'instant",
    auMoins: (n: number) => `au moins ${n}`,
    bloques: "Commentaires bloqués par une sécurité",
    refuses: "Envois refusés",
  },
} as const;

export const LIBELLES_ECRAN = {
  vueNulle: {
    titre: "Le tableau des mots n'a pas pu être lu.",
    phrase: "Rechargez la page dans un instant.",
  },
  bandeauMotsEteint: PHRASE_PLUSIEURS_MOTS_ETEINT,
  bandeauCopie:
    "Le site ne répond pas : la dernière copie du catalogue est affichée. Aucune nouvelle cible ne peut être créée.",
  filtreGroupe: "Filtrer les mots",
  filtres: {
    tous: "Tous",
    actifs: "Actifs",
    brouillons: "Brouillons",
    pause: "En pause",
  } satisfies Record<string, string>,
  creer: "Créer un mot",
  motCree:
    "Mot créé en brouillon : il n'envoie rien tant que ses textes ne sont pas validés et qu'il n'est pas activé sur un compte.",
  annuler: "Annuler",
  geste: "Le geste n'a pas pu aboutir. Réessayez dans un instant.",
  apercuIllisible:
    "Les textes n'ont pas pu être lus. Réessayez dans un instant.",
  etatsMot: {
    actif: "Actif",
    pause: "En pause",
    brouillon: "Brouillon",
  } satisfies Record<EtatMotVue, string>,
  reseauAuto: { facebook: "Facebook", instagram: "Instagram" } satisfies Record<
    ReseauAutoVue,
    string
  >,
} as const;

/** Phrases de confirmation : un geste qui allume un envoi demande toujours un « oui » clair. */
export const PHRASES_CONFIRMATION = {
  valider: (mot: string, reseau: string, titre: string) => ({
    titre: `Valider les textes du mot ${mot} pour ${reseau} ?`,
    phrase: `Ce sont les textes affichés, avec le titre « ${titre} ». Rien n'est envoyé maintenant.`,
    bouton: "Oui, valider",
  }),
  activer: (mot: string, nom: string, reseau: string, titre: string) => ({
    titre: `Activer le mot ${mot} sur ${nom} (${reseau}) ?`,
    phrase: `Les personnes qui écriront ${mot} en commentaire recevront une réponse publique, puis un message privé avec le lien vers « ${titre} ».`,
    bouton: "Oui, activer",
  }),
  pause: (mot: string, nom: string) => ({
    titre: `Mettre le mot ${mot} en pause sur ${nom} ?`,
    phrase:
      "Plus aucun message ne partira pour ce mot sur ce compte. Rien n'est supprimé.",
    bouton: "Oui, mettre en pause",
  }),
} as const;
