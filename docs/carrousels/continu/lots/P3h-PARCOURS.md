# P3h — Les 8 parcours continus : branche `carrousels/continu-p3h`, `registre-parcours.ts`, `studio-rendu/compositions/visuels/continu/parcours/`
PA Le chemin (4) · PB Avant / avec nous (3) · PC Le grand mot (3) · PD L'objet à cheval (3) · PE Bento continu (4) · PF La courbe (4) · PG L'escalier (4) · PH Le circuit (4). Les nombres de pages et les fonds sombres (`dk:[3]` pour PA et PH) sont lus dans `pano(n,…)`.
Pour chacun :
- un composant qui dessine les k pages en coordonnées de toile (port exact du `html:function()`) ;
- k gabarits de page `PX1…` (schéma : les textes posés dans CETTE page ; alt) ;
- `commence` = la page 1 porte une rubrique ET un titre ;
- `termine` = la dernière page porte l'appel (« Racontez-nous… ») ;
- objets à cheval marqués `[data-a-cheval]` ;
- mots-affiches éventuels `[data-mot-affiche]` (PC : aucun mot n'est coupé ; ne pas en déclarer sans besoin) ;
- `bordsLibres` de sa première et de sa dernière page (raccords avec les plaquettes voisines) ;
- en 3:4, calque décalé de +45 px.
Pièges :
- la courbe PF a une aire en dégradé doux : pas de bord net vertical sur une couture ;
- les tirets de PB (`stroke-width 6`) ne doivent pas tomber pile sur une couture (décaler la phase) ;
- `traitsFinsSurCouture` doit valoir 0.
Tests : flags `commence`/`termine` de chaque parcours écrits dans le test, après lecture de la maquette ; `pagesTypes.length === pages` ; essai réel de chaque parcours seul et suivi de X00, en 4:5 et 3:4, toutes mesures à 0 et `debordCouture1 ≥ 1` quand le parcours commence ; planche des 8 bandes.
