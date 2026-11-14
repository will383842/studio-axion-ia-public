# AUT-C : garde centrale de l'Usine sous plafond (FAIT, 14/11/2026)
- Plan lu en entier : origin/concepteur/usine-autonomie, pilotage/plans/USINE-AUTONOMIE-SOUS-PLAFOND.md (§ 1, 2.1 à 2.9, 3, 4 lot C, 5). Base : origin/master a928df5a (AUT-A PR 524 et ARG-ORIGINE-USINE PR 520 fusionnées).
- Livré : src/services/credits.ts (enveloppe `dansVerrouCredits` dans `sousVerrouCredits` ; `verifierBudgetEtCredits` : option `cleUsine`, origine normalisée, branche § 2.4 étapes 1-6 ; `reserverLot` passe `cleUsine: "lot:<id>"` ; docblocks), src/services/budget-mensuel.ts (option `sousPlafondUsine`), src/services/mode-budget.ts (docblock seulement), tests/r7-double-heygen.test.ts (cas réécrit en trois), tests/autonomie-usine-garde.test.ts (23 cas avec la course), tests/autonomie-usine-course.test.ts (3 cas), ce journal.
- Interrupteur ÉTEINT par défaut : tant que le fondateur ne l'allume pas, le code actuel s'applique (seuil, R7, budgets de l'Usine). Le Studio n'appelle que `normaliserOrigine` ; test de non-régression Studio (plafond de l'Usine à 1 centime sans effet, registre jamais écrit) et test « éteint » (CONFIRMATION_REQUISE / BUDGET_USINE_ABSENT inchangés).
- Ordre dans la garde : jugement (lecture seule) → `confirme` = max(montant bloquant, accord reçu) → `controlerBudgetDuMois(sousPlafondUsine)` → `controlerCredits` → inscription de l'accord EN DERNIER, seulement si une clé est connue (pré-vol sans clé : rien n'est écrit). Montant illisible (NaN) : le jugement est sauté, `BUDGET_ILLISIBLE` répond avant tout.
- `USINE_PLAFOND_ATTEINT` n'entre pas dans `lancementEnAttente` (vérifié par test). autonomie-usine.ts, image-video.ts, Réglages, generation-claude.ts, zernio/parcours/mots : NON touchés.
- Test rouge d'abord : sans les changements de src, 15 des 23 cas des tests de la garde et de la course échouent ; avec, 23/23 verts ; r7-double-heygen 21/21.
- Verts SANS modification : l1-09-budget-mensuel, new-arg-04-mode-budget, porte-usine-garde-budget, r7-origine-illisible, r7-origine-usine-*, autonomie-usine-* (A), budget-indicatif, d2-credits. l3-0-garde-origine : les 2 mêmes échecs que sur master (cas 2 et 3), identiques sans mes fichiers, aucun nouveau.
- MUTATIONS (chacune rejouée puis le fichier restauré) : voir le tableau ci-dessous.
| # | Mutation | Résultat (garde, course et R7 : 44 cas) |
|---|---|---|
| 1 | supprimer la branche autonomie | 15 rouges |
| 2 | inscrire AVANT `controlerCredits` | 1 rouge (CREDIT_INSUFFISANT : registre non vide) |
| 3 | retirer l'enveloppe `dansVerrouCredits` | 11 rouges (`VERROU_REQUIS` partout) |
| 4 | ne pas exclure `sousPlafondUsine` du refus `BUDGET_USINE_ABSENT` | 14 rouges |
| 5 | `confirme` laissé à l'accord reçu | 9 rouges (seuil et R7) |
| 6 | normalisation retirée (null → studio) | 2 rouges |
| 7 | `reserverLot` sans `cleUsine` | 1 rouge (pas d'inscription du lot) |
Chaque fichier restauré ensuite (diff vide avec la copie saine), tests de nouveau verts.
- Contrôles : tsc : aucune erreur dans les fichiers touchés, total inchangé (146, celles de master) ; lint propre sur les fichiers touchés ; zéro réseau, 0 €.
- Note pour l'auditeur : aucun correctif n'a été nécessaire dans autonomie-usine.ts. Rappel : `generation-claude.ts:678` n'arrête pas encore net sur `USINE_PLAFOND_ATTEINT` (lot E).
- Contrôle anti-fuite : aucun prénom ni nom de personne dans le diff.
