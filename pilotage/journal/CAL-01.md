# CAL-01 : origine de la date dans la fiche du calendrier (BLOQUÉ, CORRECTIF requis, repris le 12/11/2026)
- Repris de usine/CAL-01, master et usine/LOT-12-11-H fusionnées (L4-04, L7-11, L4-06) ; usine/RC-35 et usine/L1-05 : déjà incluses. Maquette lue en entier : la fiche montre la date et l'heure de Paris, un geste « Déplacer au… », aucun libellé d'origine.
- Fait : rien d'écrit (ni test ni code). Constat : tests_requis = oui, mais fichiers_autorises = FicheEntree.tsx et types.ts seulement ; aucun chemin de test n'y figure. Règle 5 : bloqué, CORRECTIF requis (ajouter un fichier de test, p. ex. tests/calendrier-fiche-origine.test.ts, aux fichiers autorisés).
- Déjà présent sur la branche : OrigineEntree = « vous » | « usine » dans types.ts (CAL-14), donc le critère « une seule définition » tient déjà ; FicheEntree.tsx ne l'affiche pas encore.
- Reste après CORRECTIF : test rouge puis libellés « choisie par vous » / « proposée par l'usine » dans FicheEntree, et garde « date choisie à la main jamais écrasée » ; « usine » reste réservée en V1 (aucune alimentation avant la porte v2).
- PILOTAGE : ajouter le chemin du test aux fichiers_autorises de CAL-01 ; dire où vit la garde d'écrasement (décalage/ajout sont hors liste).
- Tests : aucun lancé. contrôle anti-fuite : vide
