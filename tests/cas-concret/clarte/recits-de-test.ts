/** Récits rédigés à la main pour les tests (les 96 récits du stock arrivent par l'import, jamais ici). */
export const RECIT_LT02 = {
  sujet: "Vos demandes de prix arrivent sans le poids.",
  scene: "Un client écrit : il lui faut un camion la semaine prochaine. Ni poids, ni adresse d'enlèvement. Votre exploitant recopie, rappelle, attend, et la demande dort dans la pile.",
  exemple: "la demande de ce client",
  motsCles: ["demandes", "prix", "poids"],
};

/** Récits de test de quelques autres cas du stock (par identifiant). */
export const RECITS_DE_TEST: Record<string, typeof RECIT_LT02> = {
  "garage-rendez-vous-rappeles": {
    sujet: "Vos clients oublient leur rendez-vous au garage.",
    scene: "Le matin, un pont reste vide : le client n'est pas venu. Personne ne l'avait rappelé la veille. Le mécanicien attend, et la journée prend du retard.",
    exemple: "le rendez-vous de ce client",
    motsCles: ["clients", "rendez-vous", "garage"],
  },
  "dg-emails-relus-avant-envoi": {
    sujet: "Vos e-mails de devis partent sans relecture.",
    scene: "Le soir, vous répondez vite à un client : un devis, un délai. Vous écrivez le délai à la légère. Le message part, et il vous engage.",
    exemple: "le message de ce client",
    motsCles: ["e-mails", "devis", "relecture"],
  },
  "plasturgie-commandes-clients": {
    sujet: "Vos commandes clients sont ressaisies à la main.",
    scene: "Une commande arrive par courriel. Vous l'ouvrez, vous ressaisissez la matière, le coloris, le moule. Puis vous cherchez la date de livraison.",
    exemple: "la commande de ce client",
    motsCles: ["commandes", "clients", "ressaisies"],
  },
  "site-stock-suivi-reappro": {
    sujet: "Vous découvrez la rupture de stock trop tard.",
    scene: "Un client demande un article. Vous allez voir en rayon : il n'y en a plus. Vous recomptez pour être sûr, mais la rupture est déjà là.",
    exemple: "l'article de ce client",
    motsCles: ["rupture", "stock", "tard"],
  },
};
