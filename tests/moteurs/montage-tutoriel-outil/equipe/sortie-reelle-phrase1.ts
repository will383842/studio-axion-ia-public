/** PHRASE-1 : la phrase et la sortie RÉELLE relevées sur le serveur (doubles de test, aucun appel). */
export const PHRASE_STOCKS = "Un tableau de bord qui suit les stocks d'une PME et prévient avant la rupture, pour ne plus compter à la main.";

/**
 * RECONSTITUTION de la sortie relevée sur le serveur (Opus), PAS le relevé lui-même. Ce que le relevé établit : « titre » dans les
 * zones (au lieu de « libelle ») et « modele » qui n'est pas un identifiant. Ce qu'il ne permet pas de reproduire : il décrit
 * « etats avant/maintenant avec 3 données chacun » (forme exacte inconnue) alors que ce double met deux textes dans `etats` ;
 * le relevé compte aussi 6 erreurs (tronquées à 6 par l'ancien code) là où ce double en donne 7. Aucun test ne doit en déduire
 * davantage que « refusée, avec ces deux défauts ».
 */
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
