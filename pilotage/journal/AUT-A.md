# AUT-A : registre et réglage de l'autonomie de l'Usine sous plafond (FAIT, 14/11/2026)
- Plan lu : origine/concepteur/usine-autonomie, pilotage/plans/USINE-AUTONOMIE-SOUS-PLAFOND.md (§ 2, 3 et 4 lot A).
- Livré, fichiers NOUVEAUX seulement : src/services/autonomie-usine.ts, tests/autonomie-usine-registre.test.ts (46 cas), tests/autonomie-usine-structure.test.ts (7 cas), ce journal. Aucun fichier existant touché ; rien n'est branché dans la garde : aucun comportement réel ne change.
- Test rouge d'abord : les deux fichiers de test échouaient (module absent) avant l'écriture du module, puis 53/53 verts.
- Règles tenues : éteint par défaut, absent/0/illisible = confirmation ; origine inconnue = Usine ; égalité au plafond acceptée ; registre écrit seulement sous dansVerrouCredits (VERROU_REQUIS sinon) ; mois et jour de Paris ; aucun montant dans la cloche.
- MUTATIONS (chacune rejouée puis le fichier restauré, diff vide) : `≤`→`<` : 3 rouges ; sans « − usage de la clé » : 2 rouges ; consommée sans dépense→0 : 1 rouge ; absent→0 : 7 rouges ; normaliserOrigine(null)→studio : 2 rouges ; garde VERROU_REQUIS retirée : 1 rouge ; marque 80 % posée avant l'envoi : 1 rouge.
- Vérifs : pnpm install --frozen-lockfile ok ; tests/l1-09-budget-mensuel.test.ts vert ; tests/l3-0-garde-origine.test.ts : 2 échecs DÉJÀ présents sur master (cas 2 et 3, identiques sans mes fichiers, voir ARG-R7), aucun nouveau.
- Lint propre sur les fichiers ajoutés ; tsc : 146 erreurs, identiques à master, aucune dans autonomie-usine*.
- Suite : lots B (écran), C (garde, après ARG-ORIGINE-USINE), D (image→vidéo) importent ce module.
- Contrôle anti-fuite : aucun prénom ni nom de personne dans le diff.

## Correctif relecture Opus (PR 524) : bloquants 1 et 2 corrigés, point 4 fait
- À traiter par les lots suivants / l'auditeur (notes, non codées) :
  - 5 : ré-accord d'une clé « consommée sans dépense rattachée » = remplace l'ancien coût au lieu de l'additionner (conforme § 2.4) ; l'auditeur vérifie que le lot E rattache les dépenses et que les clés `appel-…` restent uniques.
  - 6 : `lireAccord`/`lireEngagement` : une ligne corrompue compte 0 / « absent » ; « en cas de doute, le plus haut » voudrait un refus (risque faible, code de confiance seul).
  - 7 : `vueAutonomieUsine` éteint → `plafondCents: 0` : le lot B ne peut pas préremplir le dernier plafond (confort).
  - 8 : `jugerSousPlafondUsine` renvoie `effectif: 0` si le besoin est illisible (sans effet : `ok` vaut false).
