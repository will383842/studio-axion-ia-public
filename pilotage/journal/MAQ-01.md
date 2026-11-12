# MAQ-01 : quatre maquettes hors calendrier (final, en attente de validation écrite du fondateur)
- Fait : docs/maquettes/{a-publier,stock,infographie,ecrans-sans-prix}/index.html (fichiers seuls, mêmes couleurs, mots et menu que la maquette du calendrier). Test autorisé : tests/maquettes/maq-01-maquettes.test.ts (rouge sans les pages, vérifié).
- Tests : 42 passés, 0 échoué (maq-01). Voisin tests/aucun-prix-affiche.test.ts : 1 échec déjà présent sur master (CreditClaude.tsx, Credits.tsx), sans lien. Suite complète non lancée (consigne).
- Critère 1 (quatre pages, mention « Maquette fictive… ») : tenu, test lignes 25-37. Critère 2 (aucun montant, vouvoiement) : tenu, lignes 38-51.
- Critère 3 (À publier : vidéo, carrousel, infographie avec icône et libellé) : tenu, lignes 84-107. Validation écrite du fondateur avant tout code (INF-01, NEW-ARG-01) : PAS encore donnée.
- CORRECTIF « le fondateur » : aucun nom écrit nulle part. Aucun fichier hors liste ; fiche sans dépendance de code en retard (maquette du calendrier présente sur master).
- Douteux : pictogrammes ▶ ▤ ▨ choisis par moi (la maquette du calendrier n'en fixe pas) ; menu complété par À publier, Stock, Infographie, Ma réserve.
- contrôle anti-fuite : vide

## Corrections après relecture (n2)
- Avis « Vide » qui met en pause : corrigé. Plus de « pause » ni de « reprend » ; le texte dit que rien n'est bloqué et que l'ajout à la main reste possible (test : « un stock vide alerte mais ne met rien en pause »).
- Nom « Ma réserve » déjà pris : corrigé. L'écran s'appelle « Mes quantités » (titre, menu des 4 pages, texte) ; test : aucune page ne contient « Ma réserve ».
- Remarque « prévues » : corrigé en « 12 prévus » pour les carrousels ; « infographies prévues » reste au féminin, correct.
- Remarque « Envoyer vers À publier » : corrigé en « Placer dans À publier » (test dédié).
- Remarque critère 3 (validation écrite du fondateur) : reporté, relève du pilotage ; les maquettes ne sont pas validées.
- Tests : tests/maquettes 46 passés, 0 échoué (5 tests nouveaux, rouges sans les corrections). tests/aucun-prix-affiche.test.ts : 1 échec déjà présent sur master, sans lien.
- origin/master fusionné d'abord. contrôle anti-fuite : vide
