/** PHRASE-1 : la phrase et la sortie RÉELLE relevées sur le serveur (doubles de test, aucun appel). */
export const PHRASE_STOCKS = "Un tableau de bord qui suit les stocks d'une PME et prévient avant la rupture, pour ne plus compter à la main.";

/** La sortie RÉELLE relevée sur le serveur (Opus) : « titre » dans les zones, « modele » qui n'est pas un identifiant. */
export const SORTIE_REELLE_SERVEUR = {
  manque: "maquette",
  contenu: {
    version: "description-maquette.v1",
    nom: "Espace démo · Gestion des stocks",
    entreprise: "Entreprise exemple",
    metier: "Gestion des stocks",
    etats: { avant: "Avant : tout à la main", maintenant: "Maintenant : alertes prêtes" },
    ecrans: [
      {
        id: "ecran-stocks",
        titre: "Vos stocks du jour",
        modele: "Tableau de bord",
        zones: [
          { id: "ruptures", type: "kpi", titre: "Ruptures proches", donnees: [{ id: "r-avant", libelle: "Ruptures proches", valeur: 6, exemple: true, etat: "avant" }, { id: "r-maint", libelle: "Ruptures proches", valeur: 1, exemple: true, etat: "maintenant" }] },
          { id: "articles", type: "liste", titre: "Articles à commander", donnees: [{ id: "a1", libelle: "Cartons", valeur: "À commander", exemple: true }] },
          { id: "suivi", type: "graphique", titre: "Stock de la semaine", donnees: [{ id: "s1", libelle: "Articles suivis", valeur: 120, exemple: true }] },
        ],
      },
    ],
  },
};
