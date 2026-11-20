// Données d'exemple (marquées « exemple »).
window.donneesAtelier = {
  commandes: [
    { client: "Cuisine Dupont (exemple)", etape: "Découpe", pret: "vendredi" },
    { client: "Escalier Martin (exemple)", etape: "Assemblage", pret: "mardi" },
    { client: "Bibliothèque Lefèvre (exemple)", etape: "Finition", pret: "jeudi" }
  ],
  machines: [
    { nom: "Scie à format", jour: "lundi", tache: "Cuisine Dupont (exemple)" },
    { nom: "Toupie", jour: "mardi", tache: "Escalier Martin (exemple)" },
    { nom: "Ponceuse", jour: "mercredi", tache: "Bibliothèque Lefèvre (exemple)" }
  ],
  stocks: [
    { bois: "Chêne (exemple)", planches: 42, seuil: 20 },
    { bois: "Hêtre (exemple)", planches: 11, seuil: 15 },
    { bois: "Frêne (exemple)", planches: 27, seuil: 10 }
  ]
};
