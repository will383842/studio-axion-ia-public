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

## Correcteur (relecture Opus 520) : l'origine ne se perd plus APRÈS le geste

- **A1 série** : `lancerGeneration` n'avait en réalité aucun moyen de recevoir l'origine (elle n'était jamais écrite dans les options de l'écriture). Elle accepte maintenant `origine` (hors du sujet, figée dans les options) ; chaque écriture d'une série « usine » la porte. Sans origine : rien n'est écrit, Studio inchangé.
- **A2 `fabriquerLesN`** : l'origine est mémorisée dans la déclinaison (avec `prixConfirme`), retransmise à `lancerFabricationConfirmee` quand la version part après sa mère, et gardée si elle passe en attente de crédit.
- **A3 attente de crédit** : `lancementEnAttente` garde `origine` (`lancerVideoDeVersion`, `lancerVariantesEnAttente`), et `lancerVideosEnAttente` la retransmet à `lancerFabrication`. Couvre la mère, les versions et `fabriquerVariante`.
- **M1** : assertion « la version créée a `commande.origine === "usine"` » ; **M3** : `empechementLeve` passe l'origine déjà figée à `manquesPour`.
- **Non fait, volontairement** : M2 (`planSerie`, décision du fondateur) ; « Reprendre » (`reprendreEcriture`, `reprendreEcritureArretee`, `devisReprise`) identique à master.
- **Mutations rejouées (rouges)** : origine retirée de la série (1 rouge), des versions en attente (mémorisation et retransmission : 1 rouge chacune), de la relance après attente de crédit (1 rouge), de `lancerVideoDeVersion` (3 rouges).
- **Vérifié** : 22 fichiers r7-*, paquet4-*, c1-argent-b6, garde-fous-*, c5-serie : mêmes 5 rouges que master, aucun nouveau. tsc : 146 erreurs comme master, aucune dans les fichiers touchés. Lint : 0 erreur.

## Correcteur (relecture Opus 520, 2e tour) : B1, l'origine ne vient jamais du navigateur

- **B1** : `creerSujetAction` retire désormais la clé `origine` du brief reçu (à côté de `origineUsine`) ; `lancerGeneration` ne retient que `origine === "usine"` (toute autre valeur est ignorée, rien n'est écrit dans les options).
- **Tests** : `action-cible` (avec `origine` = « usine », « x », un objet : l'appel à `lancerGeneration` n'a pas de clé `origine`) ; `r7-origine-usine-serie` (origine « x » ou objet : aucune origine écrite dans `generateur.chaine-options.<id>`).
- **Mutations rejouées (rouges)** : retrait du `delete` dans l'action (1 rouge) ; retrait du filtre dans `lancerGeneration` (1 rouge). Code restauré.
- **Inchangé** : « Reprendre » (`reprendreEcriture`, `reprendreEcritureArretee`, `devisReprise`) et Studio. Mêmes 5 rouges que master, aucun nouveau ; lint 0 erreur ; tsc 146 erreurs comme avant, aucune dans les fichiers touchés.
