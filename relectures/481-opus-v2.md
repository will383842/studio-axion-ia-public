# Relecture PR 481 (NEW-ARG-04, zone argent), v2 : tête 8e2a381d

## Verdict : OK

Les trois points du verdict précédent (`relecture/481-opus`, tête 87220842) sont corrigés. Rien de nouveau à reprendre.

## Vérifications (une par une)

1. **Branche à jour, 3 fichiers seulement** : master a été fusionnée dans la branche (5c8f74ea) ; la branche n'a plus
   aucun retard sur master. `git diff origin/master...origin/usine/NEW-ARG-04` ne montre plus que
   `src/services/mode-budget.ts`, `src/services/budget-mensuel.ts`, `tests/new-arg-04-mode-budget.test.ts`
   (99 ajouts, 20 retraits). GitHub compte aussi 3 fichiers.
2. **Aucun prénom ni nom de personne** dans ces trois fichiers entiers, à la tête de la branche (recherche sans
   distinction de casse : aucun résultat). Le dernier commit (8e2a381d) remplace 11 occurrences par « le fondateur »
   dans `budget-mensuel.ts` (en-tête, lignes 4-5, 11, 152, 164, 202, 222) et `mode-budget.ts` (lignes 2, 4, 28, 48).
3. **Aucun texte affiché changé de sens** : 8e2a381d ne touche que des commentaires (aucune chaîne, aucun code).
   Les phrases affichées (`messageArretSecurite`, `messageAuDelaDuBudgetIndicatif`) sont identiques à la version déjà
   relue. La fusion de master n'a rien changé à ces trois fichiers au-delà du contenu de la PR.
4. **Test R7 et mutations R1-R7 intacts** : `tests/new-arg-04-mode-budget.test.ts` est identique octet pour octet à
   celui de 87220842 (R7 appelle toujours le vrai `verifierPartVoix`). La description liste toujours les 7 mutations.
5. **Test moteur (b) signalé** : la description de la PR (lue par l'API GitHub, `gh pr view` étant indisponible ici)
   cite `tests/image-video/moteur.test.ts:787` « (b) secours Instagram refusé » parmi les échecs existants, explique
   la cause (le test attend encore « environ N,NN € ») et renvoie à une fiche de suite réalignée après la fusion de 481.
6. **Test relancé** : `npx vitest run tests/new-arg-04-mode-budget.test.ts` à la tête 8e2a381d : 7/7 verts.

## Remarque (sans blocage)

La description signale elle-même trois erreurs de typage `tsc` dans les fixtures du test (lignes 72-74). Le test
passe ; à nettoyer à l'occasion, pas une raison de retenir la PR.
