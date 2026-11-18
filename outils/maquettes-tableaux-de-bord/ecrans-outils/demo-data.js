/*
 * T-EXT-49 · Données par défaut du « bureau exemple » : l'histoire « demande de devis ».
 * Tout est fictif et marqué « exemple » ; aucun montant ; adresses en @exemple.invalid.
 * Ces textes servent seulement à la preuve de capture : une vidéo remplace ce fichier par la copie
 * écrite depuis le scénario validé (T-EXT-50).
 */
window.DONNEES_ECRANS = {
  version: 1,
  etapes: [
    { id: "boite-avant", vue: "boite", etat: "avant" },
    { id: "boite-nouveau", vue: "boite", etat: "nouveau" },
    { id: "boite-etiquete", vue: "boite", etat: "etiquete" },
    { id: "boite-brouillon", vue: "boite", etat: "brouillon" },
    { id: "client-fiche", vue: "crm", etat: "fiche-remplie" },
    { id: "tableur-ligne", vue: "tableur", etat: "ligne-ajoutee" },
    { id: "equipe-notification", vue: "messagerie", etat: "notification" },
    { id: "equipe-tache", vue: "messagerie", etat: "tache-creee" },
    { id: "agenda-confirme", vue: "agenda", etat: "confirme" },
  ],
  contenus: {
    boite: {
      exemple: true,
      nouveau: "m5",
      dossiers: [
        { id: "devis", nom: "Devis", exemple: true },
        { id: "question", nom: "Question", exemple: true },
        { id: "apres-vente", nom: "Après-vente", exemple: true },
      ],
      messages: [
        {
          id: "m5",
          de: "Client exemple",
          adresse: "client@exemple.invalid",
          objet: "Demande de devis pour un chantier",
          corps: "Bonjour, je souhaite un devis pour un chantier de rénovation. Pouvez-vous me proposer un rendez-vous ?",
          dossier: "devis",
          exemple: true,
        },
        {
          id: "m1",
          de: "Fournisseur exemple",
          adresse: "fournisseur@exemple.invalid",
          objet: "Question sur vos horaires",
          corps: "Bonjour, quels sont vos horaires d'ouverture cette semaine ?",
          dossier: "question",
          exemple: true,
        },
        {
          id: "m2",
          de: "Voisin exemple",
          adresse: "voisin@exemple.invalid",
          objet: "Retour sur la dernière intervention",
          corps: "Bonjour, un détail reste à reprendre après votre passage.",
          dossier: "apres-vente",
          exemple: true,
        },
        {
          id: "m3",
          de: "Partenaire exemple",
          adresse: "partenaire@exemple.invalid",
          objet: "Question sur un document",
          corps: "Bonjour, pouvez-vous me renvoyer le document de la semaine passée ?",
          dossier: "question",
          exemple: true,
        },
        {
          id: "m4",
          de: "Contact exemple",
          adresse: "contact@exemple.invalid",
          objet: "Demande de devis pour un atelier",
          corps: "Bonjour, j'aimerais un devis pour l'aménagement d'un atelier.",
          dossier: "devis",
          exemple: true,
        },
      ],
      brouillon: {
        texte: "Bonjour, merci pour votre demande. Nous revenons vers vous avec un devis selon votre grille et proposons un rendez-vous cette semaine.",
        exemple: true,
      },
    },
    agenda: {
      exemple: true,
      jours: [
        { id: "lundi", nom: "Lundi", exemple: true },
        { id: "mardi", nom: "Mardi", exemple: true },
        { id: "mercredi", nom: "Mercredi", exemple: true },
        { id: "jeudi", nom: "Jeudi", exemple: true },
        { id: "vendredi", nom: "Vendredi", exemple: true },
      ],
      evenements: [
        { jour: "lundi", heure: "09:00", titre: "Point d'équipe", exemple: true },
        { jour: "mardi", heure: "14:00", titre: "Visite de chantier", exemple: true },
        { jour: "jeudi", heure: "16:00", titre: "Préparation de commande", exemple: true },
      ],
      creneau: { jour: "jeudi", heure: "10:00", titre: "Rendez-vous Client exemple", exemple: true },
    },
    tableur: {
      exemple: true,
      colonnes: ["Réf.", "Contact", "Demande", "Statut"],
      lignes: [
        { cellules: ["D-01", "Fournisseur exemple", "Horaires", "Réglé"], exemple: true },
        { cellules: ["D-02", "Voisin exemple", "Reprise", "En cours"], exemple: true },
        { cellules: ["D-03", "Contact exemple", "Atelier", "Reçu"], exemple: true },
      ],
      nouvelleLigne: { cellules: ["D-04", "Client exemple", "Chantier", "Reçu"], exemple: true },
      statut: { ligne: 3, colonne: 3, avant: "Reçu", apres: "Brouillon prêt", exemple: true },
    },
    crm: {
      exemple: true,
      etapes: [
        { id: "recu", nom: "Reçu", exemple: true },
        { id: "qualifie", nom: "Qualifié", exemple: true },
        { id: "devis", nom: "Devis", exemple: true },
      ],
      etapeDepart: 0,
      fiche: {
        titre: "Client exemple",
        exemple: true,
        champs: [
          { libelle: "Adresse", valeur: "client@exemple.invalid", exemple: true },
          { libelle: "Besoin", valeur: "Devis pour un chantier", exemple: true },
          { libelle: "Origine", valeur: "Demande reçue par e-mail", exemple: true },
          { libelle: "Suite", valeur: "Devis selon votre grille", exemple: true },
        ],
      },
    },
    messagerie: {
      exemple: true,
      fil: [
        { de: "Équipe exemple", texte: "Bonjour à toutes et à tous.", exemple: true },
        { de: "Atelier exemple", texte: "Le planning de la semaine est à jour.", exemple: true },
      ],
      notification: { de: "Équipe exemple", texte: "Nouvelle demande de devis reçue : la fiche est prête.", exemple: true },
      tache: { titre: "Relancer Client exemple", responsable: "Équipe exemple", exemple: true },
    },
  },
};
