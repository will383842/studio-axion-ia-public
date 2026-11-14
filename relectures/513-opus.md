# Relecture Opus — PR 513 (ARG-R7 : réaligner le test du double réel HeyGen)

## VERDICT : OK — fusion possible

Branche `usine/ARG-R7`, tête `79b4ba3b`, relue en lecture seule le 14/11/2026 contre `origin/master`.
Une remarque NON bloquante (origine illisible non verrouillée par un test, déjà le cas avant cette PR) : à traiter par une fiche de suite.

## 1. Le diagnostic (verdict A) est juste

Vérifié indépendamment dans le code :
- `src/services/mode-budget.ts:28-31` — `modeBudget()` rend toujours `"indicatif"` (décision écrite du fondateur du 08/11/2026, l.28).
- `src/services/mode-budget.ts:34-36` — `budgetIndicatifPour(origine)` = faux pour `"usine"` : l'Usine reste bloquante.
- `src/services/mode-budget.ts:121-137` — `accordAutomatique` : studio → l'accord devient le prix du jour, journal « Prix … accepté sans confirmation » ; Usine → accord inchangé.
- `src/services/credits.ts:326-334` puis `:348-353` — la garde R7 lève `CONFIRMATION_REQUISE` (`phraseAvatarParle`) seulement si l'accord ne couvre pas ; en studio l'accord automatique couvre, en Usine non.
- Décision écrite : `docs/blocages-inventaire.md:27` et `:35` (« Les anciens tests de ce mode sont réécrits ») ; `pilotage/REGLES-DE-FER.md:9` (« Aucun prix affiché ni bloquant ») ; en-tête de `mode-budget.ts:1-13`.
Le test d'origine attendait un refus pour une commande SANS origine (studio) : il décrivait le mode bloquant supprimé. Périmé, pas une régression.

## 2. Protection d'argent conservée par le test réaligné

`tests/r7-double-heygen.test.ts:388-406` :
- Usine, origine `"usine"`, budget Usine réglé à 1 000 centimes, double à 1,50 € (sous le seuil) : `CONFIRMATION_REQUISE` avec le message EXACT de la garde R7 (l.400) — le message prouve que c'est bien la garde R7 et non celle du seuil ; accord `false` refusé aussi (l.401). ✔
- Studio : passe, et la dépense est tracée au journal (l.396-397) — plus fort qu'un simple « passe ». ✔
- Double d'essai (simulation) : `partDoubleReel` nul, passe, aucun POST HeyGen (l.403-405). ✔
- Plafond 1,5 × secondes : test « ROUGE — plafond » (l.418-452) inchangé, `PLAFOND_DEPASSEMENT` = 1,5. ✔
- **Origine illisible : NON couverte** (ni avant ni après la PR) — voir § 4, mutation M3. Remarque non bloquante.

Petite faiblesse (non bloquante) : l.401 ne vérifie que le `code`, pas le message ; sous un seuil réglé bas, il pourrait venir de la garde du seuil. La l.400 suffit à verrouiller R7.

## 3. Aucun affaiblissement ailleurs

Le diff du test ne touche que ce cas (13 lignes, 3 retirées = l'ancien titre et les 2 attendus studio, remplacés). Aucun `.skip`/`.only`/`todo` ajouté, aucun seuil changé, les 18 autres cas intacts.

## 4. Test discriminant (copie jetable, `git worktree`, restaurée)

| Mutation | Résultat |
|---|---|
| M1 — `src/services/credits.ts` : garde R7 neutralisée (`if (false && double && …)`) | ROUGE : 1 échec / 18, `tests/r7-double-heygen.test.ts:400` « promise resolved "undefined" instead of rejecting » |
| M2 — `src/services/mode-budget.ts` : `budgetIndicatifPour` traite l'Usine comme le studio | ROUGE : même échec, l.400 |
| M3 — `src/services/mode-budget.ts` `origineDeLaVideo` : origine illisible → « studio » au lieu de « usine » | VERT 19/19 : non détectée ici ; ni par `tests/garde-fous-budget-relecture.test.ts`, `tests/interrupteurs-defaut.test.ts`, `tests/paquet4-rerelecture-exactitude.test.ts` (ses 2 échecs existaient déjà sans mutation) |

Le test réaligné est discriminant pour la garde R7 de l'Usine. **Fiche de suite recommandée** : ajouter un cas `verifierBudgetEtCredits(estimation, undefined, "Cette vidéo", { videoId })` avec `depots().versions.lister` qui lève → `CONFIRMATION_REQUISE` attendu (échec fermé de `mode-budget.ts:42-51`).

## 5. Périmètre des fichiers

`git diff --name-only` : `pilotage/journal/ARG-R7.md`, `tests/r7-double-heygen.test.ts`. `credits.ts`, `mode-budget.ts`, `vitest.config.mts` NON touchés. ✔
Aucun prénom ni nom de personne ajouté par la PR (seul « le fondateur »). ✔

## 6. Liste des autres tests au journal : complète

Grep `STUDIO_BUDGET_MODE_DEFAUT|CONFIRMATION_REQUISE|BUDGET_DEPASSE` dans `tests/` : 34 fichiers. Exécutés sur la branche : 9 fichiers rouges (27 cas), 24 verts, 1 sauté (`tests/l3-01-verrou-credits-postgres-reel.test.ts`, `skipIf` sans base réelle, préexistant).
Les 9 rouges sont TOUS au journal, avec le bon nombre de cas : c1-argent-b6-confirmation (4 = 3 + garde B6), paquet4-relecture-exactitude (5), paquet4-rerelecture-exactitude (2), garde-fous-reprise-sujet (1), r2-textes-publication (2), r8-bout-en-bout (10), e2e-verif1-bc-script-video (1), e2e-verif1-d-interrupteurs (1), garde-ecran (1).
Les fichiers cités hors grep ont été rejoués et échouent bien comme dit : a2-fabrication-avocat:143, voix-epinglee-image-video (3), l3-0-garde-origine (2), l3-0-relecture-argent (1).
Le journal signale aussi à juste titre `vitest.config.mts:18-20` (variable morte, commentaire trompeur).

## Exécution

`pnpm vitest run tests/r7-double-heygen.test.ts` sur `79b4ba3b` : **19/19 vert**.

## Conclusion

OK. Fusion possible. Suites (hors PR) : (a) test de l'origine illisible pour le double réel ; (b) réécrire les tests listés au journal et retirer `STUDIO_BUDGET_MODE_DEFAUT` de `vitest.config.mts`.
