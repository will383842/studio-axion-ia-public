# ARG-ORIGINE-USINE : l'origine « usine » ne se perd plus (série, fabriquerLesN, fabriquerVariante, manquesPour)

Décision du fondateur (14/11) : le Studio ne demande jamais de confirmation de prix (08/11) ; l'Usine, toujours.
Diagnostic : `relectures/515-opus.md` et `ARG-R7-SUITE.md` (section « À trancher »). Relecture Opus obligatoire avant fusion.

## Les trous étaient réels (preuve)

1. **Série** : `lancerSerie` n'avait aucun paramètre d'origine ; `exigerTotalConfirme` testait `budgetIndicatif()` (sans origine) et appelait `accordAutomatique` sans origine : une série de l'Usine était traitée comme le Studio. Corrigé : 6e paramètre optionnel `origine`, passé à `budgetIndicatifPour(origine)` et à `accordAutomatique`. Test : `tests/r7-origine-usine-serie.test.ts`.
2. **`fabriquerLesN` / `fabriquerVariante`** : pas d'option `origine`, alors que `verifierAvantDeCreer` et `verifierAvantDeFabriquerLesN` l'acceptaient déjà ; `lancerVideoDeVersion` ne la transmettait pas à `lancerFabrication`. Corrigé : option `origine` descendue jusqu'aux deux pré-vols et au lancement. Test : `tests/r7-origine-usine-fabrication.test.ts`.
3. **`manquesPour`** : utilisait `budgetIndicatif()` sans origine, donc le solde seulement « suivi » (fal.ai) n'était jamais opposé, même à l'Usine. Corrigé : paramètre `origine`, `budgetIndicatifPour(origine)`, transmis par `controlerCredits` depuis `verifierBudgetEtCredits`. Les autres appelants (`detailCreditVideo`, `surveillerCredits`) restent sans origine : inchangés. Test : `tests/r7-origine-usine-manques.test.ts`.

## Preuves par mutation (restaurées)

Chaque fichier source remis à l'état de master, le test neuf du trou devient rouge : série 1 rouge, fabrication 2 rouges, manques 2 rouges. Les corrections sont ensuite restaurées, tout est vert.

## Ce qui n'a pas changé

- Studio (sans origine) : le prix du jour vaut accord, journalisé « accepté sans confirmation » (testé).
- « Reprendre » d'une écriture (`boucle-generation.ts` ~l.772, `tests/garde-fous-reprise-sujet.test.ts:111`) : intact, décision du fondateur.

## Points à relire (Opus)

- `planSerie` calcule son plan avec `budgetIndicatif()` sans origine : une série de l'Usine n'est donc pas bornée par le budget dans le plan (seule la confirmation est exigée). Hors fiche : à décider.
- Aucun appelant de l'Usine ne passe encore `origine: "usine"` à `lancerSerie`, `fabriquerLesN` ou `fabriquerVariante` ; la garde est prête, le branchement reste à faire côté Usine.
- Rouges déjà présents sur master (inchangés) : `c1-argent-b6-confirmation` (garde « confirme: true »), `c5-serie-ecriture` (2 tests).
