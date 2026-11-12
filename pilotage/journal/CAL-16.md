# CAL-16 : contrôleur de diversité (final)
- Fait : controlerDiversite (format > 2 jours de suite par réseau = alerte, 2 = rien ; textes trop proches = alerte via empreinte L3-11, signature de l'usine lue telle quelle) ; seuils réglables (SEUILS_DIVERSITE + paramètre) ; bloquant toujours false ; aucun appel IA.
- Fichiers : src/domaine/calendrier/diversite.ts, tests/domaine/cal-16-diversite.test.ts, ce journal. Dépendances CAL-15 et L3-15 fusionnées (journaux finaux).
- Tests : fiche + proximite + cadence : 34 passés, 0 échoué. Suite complète non lancée (consigne).
- Reste : pilier/cible le même jour et mot-clé par semaine laissés à l'usine (correctif de la fiche) ; branchement à l'écran.
- Douteux : seuil de proximité 0,6 et fenêtre 14 jours par défaut, à valider.
- contrôle anti-fuite : vide
## Corrections après relecture
- à corriger (signature diluée) : corrigé. Deux contrôles séparés : « sujet-repete » si et seulement si les deux signatures de l'usine sont égales (aucun calcul, dans la fenêtre de 14 jours) ; « texte-proche » sur les mots seuls, signature exclue. Cas (a) et (b) ajoutés au test (le cas (a) et le test de signature étaient rouges avant). Pour (b), l'alerte de texte reste voulue : elle juge les mots, pas le sujet de l'usine.
- remarque « texte » = champ `sujet` : documenté dans le type (renommer casserait l'interface). Remarque `jour` = date civile de Paris : écrit dans le commentaire du type.
- remarque seuils non validés : corrigé (valeur par défaut si non fini, < 0, ou < 1 pour les jours) ; test ajouté.
- remarque pilier/cible/mot-clé par semaine : reporté, laissé à l'usine par le correctif de la fiche ; à confirmer par le fondateur.
- Tests : cal-16 + proximite + cal voisins : 25 passés, 0 échoué.
- contrôle anti-fuite : vide
