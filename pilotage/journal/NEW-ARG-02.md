# NEW-ARG-02 : garde « règles de fer » (final)
- Fait : outils/gardes/regles-de-fer.mjs (7 règles : montant, workflow externe, Haiku, purge, date Buffer 18/11 et 20/11, push, nom du fondateur) + job « regles-de-fer » AJOUTÉ à verifier.yml (départ origin/master à jour avec VERIF-REPAUTO ; rien retiré : étape réponses-auto conservée).
- Fichiers : verifier.yml, regles-de-fer.mjs, tests/outils/regles-de-fer.test.ts, ce journal. Test écrit d'abord : rouge (module absent), puis vert.
- Critère 1 (rouge par règle) : tenu, tests/outils/regles-de-fer.test.ts (un test par règle, cas fautifs). Critère 2 (vert sur le dépôt conforme) : tenu, même fichier ; garde sur la branche : 0 défaut. Critère 3 (sans IA, secret ni réseau) : tenu, fonctions pures + lecture de fichiers.
- Critère 4 / CORRECTIF 11/11 (aucun fichier ne contient le nom du fondateur, exceptions vides) : bloqué, CORRECTIF requis. PILOTAGE : ~168 fichiers hors fichiers_autorises à nettoyer (fiche de nettoyage), puis liste de mots fournie (secret ou fichier hors dépôt) ; sans elle la règle est dite « non vérifiée ». Les exceptions « montant » (écrans) restent listées avec leur nombre, à vider par NEW-ARG-01.
- « Aucun push » : sens non précisé par la fiche ; la garde refuse git push dans un workflow (PILOTAGE : à confirmer).
- Tests (cloud) : tests/outils + tests/gardes + tests/scripts + garde-reponses-auto : 209 passés, 0 échoué, 1 sauté (test L0-15 qui exige la liste privée).
- Suite complète non lancée (consigne). Aucune PR.
- contrôle anti-fuite : vide
