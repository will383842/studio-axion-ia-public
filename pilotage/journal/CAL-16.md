# CAL-16 : contrôleur de diversité (final)
- Fait : controlerDiversite (format > 2 jours de suite par réseau = alerte, 2 = rien ; textes trop proches = alerte via empreinte L3-11, signature de l'usine lue telle quelle) ; seuils réglables (SEUILS_DIVERSITE + paramètre) ; bloquant toujours false ; aucun appel IA.
- Fichiers : src/domaine/calendrier/diversite.ts, tests/domaine/cal-16-diversite.test.ts, ce journal. Dépendances CAL-15 et L3-15 fusionnées (journaux finaux).
- Tests : fiche + proximite + cadence : 34 passés, 0 échoué. Suite complète non lancée (consigne).
- Reste : pilier/cible le même jour et mot-clé par semaine laissés à l'usine (correctif de la fiche) ; branchement à l'écran.
- Douteux : seuil de proximité 0,6 et fenêtre 14 jours par défaut, à valider.
- contrôle anti-fuite : vide
