# P3a — Couvertures (7) : branche `carrousels/continu-p3a`, fichier `familles/couvertures.ts`, dossier `gabarits/couvertures/`
| Type | Maquette | Rôle | Notes |
|---|---|---|---|
| C01 | Orbite | couverture | 4 tuiles en orbite (mail, calendar, chart, chat) |
| C02 | Question sur fond sombre | couverture | `sombre:true` (seule page sombre permise si choisie) |
| C03 | Sommaire illustré | couverture | sommaire 3 entrées |
| C04 | Cartes en éventail | couverture | `heroDeck` |
| C05 | Fenêtre d'application | couverture | `heroDash` |
| C06 | Manifeste et plaques | couverture | fond pâle (`pl:1`) ; la rubrique « Axion-IA » devient un champ rubrique libre |
| C07 | Téléphone | couverture | `heroPhone` |
Règles en plus : titre de page 1 ≤ 10 mots, lisible seul, au centre vertical de la zone 3:4 ; aucun texte dans les bandes de 135 px du haut et du bas (sauf `[data-entete]`) ; `bordsLibres.droite` doit offrir au moins un intervalle de 260 px (raccord de la couture 1/2). Test supplémentaire : `role === "couverture"` pour les 7.
