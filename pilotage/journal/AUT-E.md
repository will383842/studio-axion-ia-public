# AUT-E — Coût réel des appels Claude et arrêt net au plafond (14/11/2026)
1. `DepenseEnregistree.appelId?` ajouté (champ neutre, `depenseComptee` inchangé) ; rempli par l'écriture (`generation-claude.ts`) et les deux dépenses de `depense-claude-video.ts` (appel réel et appel interrompu soldé).
2. `autonomie-usine.ts` : la lecture du payé rattache aussi les dépenses dont `appelId` = clé : un appel Claude consommé est compté au réel, plus au réservé.
3. `generation-claude.ts` : `USINE_PLAFOND_ATTEINT` rejoint l'arrêt net « budget-usine » : rien n'est payé, la génération n'attend pas.
4. Interrupteur éteint = comportement inchangé ; Studio inchangé (aucun accord inscrit) ; tests existants non modifiés.
5. Tests : `tests/autonomie-usine-claude.test.ts` (4 tests, mémoire, faux fetch, 0 €).
6. Mutation 1 : ne pas lire `appelId` dans `payeDeLaCle` → test « coût réel » ROUGE (compté au réservé) ; restauré, vert.
7. Mutation 2 : retrait de `USINE_PLAFOND_ATTEINT` de l'arrêt net → test « arrêt net au plafond » ROUGE ; restauré, vert.
8. Branche empilée sur `usine/AUT-C` (PR 531) ; PR en brouillon, à rebaser sur master après fusion de 531.
9. Hors périmètre, non touchés : credits.ts, budget-mensuel.ts, mode-budget.ts, image-video.ts, Réglages.
10. Aucun nom de personne, aucun secret.
