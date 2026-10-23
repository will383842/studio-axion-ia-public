# Journal — suite Vitest verte après l'activation du face caméra (09/10/2026)

Branche `fix/tests-rouges-activation-facecam`, partie de `origin/master` (fd856d6). Rien n'a été fusionné ni déployé, aucun serveur n'a été touché et aucun appel réseau réel n'a été fait (les tests utilisent de faux `fetch`).

## Constat de départ (master, suite complète)

`Test Files  5 failed | 273 passed | 1 skipped (279)` · `Tests  14 failed | 3379 passed | 3 skipped (3396)` (613,86 s).

Sur ces 14 échecs, 13 viennent de l'activation du face caméra (commit 9267233 : `statut: "actif"`, chaîne réelle allumée par défaut). Le 14e (« Reprendre l'écriture » après 3 pannes, 5960 ms) est un délai de 5 s sous charge, connu : il passe quand on le lance seul.

## Deux vrais défauts corrigés dans le code (b)

1. **La carte Montage annonçait « Face caméra » monté pour de vrai sans la chaîne réelle** (`src/services/reglages.ts`, `formatsMontesPourDeVrai`).
   - La carte ajoutait « Face caméra » dès que `STUDIO_RENDU_URL` existait.
   - Or le moteur `montage-facecam` refuse le lancement (`FACECAM_EN_CHANTIER`) tant que la chaîne réelle n'existe pas. Celle-ci exige le réglage `facecam.aligneur.reel` (allumé par défaut) **et** `STUDIO_ALIGNEUR_URL`.
   - La carte et le lancement se contredisaient, ce qui viole la règle « une seule règle » des lots R0/R6.
   - Correction : la carte applique la même condition que `dependancesChaineParDefaut`.
   - Avec la configuration de production (les deux serveurs posés), « Face caméra » apparaît bien : c'est le comportement voulu.
2. **« Essai : rien ne sera payé » disparaissait de la feuille « Fabriquer »** (`src/services/generateur-depenses.ts`, `partPayee`).
   - Sans format précisé, `partPayee` regarde tous les formats actifs. Le face caméra, actif, a un moteur réel : avec les interrupteurs avocat éteints, la feuille annonçait donc la voix HeyGen comme payée et retirait la pastille Essai.
   - Pourtant, la vidéo avocat part bien au moteur d'essai.
   - Le face caméra est un format sans prix (Will se filme, sans voix ni double), il ne paie rien.
   - Correction : les formats `sansPrix` ne décident plus si la fabrication est un essai. Le comportement est inchangé pour les autres formats et pour un appel qui précise les formats.

## Test par test

| # | Fichier › test | Cause | Décision | Résultat |
|---|---|---|---|---|
| 1 | e2e-verif1-a1-eteints › CORRIGÉ G3 — interrupteurs éteints, voix HeyGen reliée : pastille Essai | défaut n° 2 (`partPayee`) | **b** — code corrigé, test inchangé | vert |
| 2 | e2e-verif1-a1-eteints › CORRIGÉ — interrupteurs éteints, voix d'essai : la feuille annonce l'essai | défaut n° 2 | **b** — code corrigé, test inchangé | vert |
| 3 | e2e-verif1-bc-serie › CORRIGÉ — « Fabriquer les N » en simulation : « Essai : rien ne sera payé » | défaut n° 2 | **b** — code corrigé, test inchangé | vert |
| 4 | e2e-verif1-bc-serie › CORRIGÉ — « Reprendre l'écriture » après 3 pannes (3 sur 3) | délai de 5 s sous charge (5960 ms), sans lien avec le face caméra | aucun changement | vert seul (14/14 dans le fichier) |
| 5 | e2e-verif1-d-interrupteurs › D1 — Réglages › Connexions, config. de production | attente périmée : la config. pose `STUDIO_ALIGNEUR_URL`, donc le face caméra est vraiment monté | **a** — attendu `["Face caméra"]` (avocat toujours absent) | vert |
| 6 | e2e-verif1-d-interrupteurs › D3 — confirmer puis fabrication de bout en bout | attente périmée (même cause) | **a** — attendu `["Type avocat", "Face caméra"]` | vert |
| 7 | e2e-verif1-d-interrupteurs › D4 — montage réel allumé puis avatar coupé | attente périmée (même cause) | **a** — attendu `["Face caméra"]` : l'avocat n'est toujours plus annoncé | vert |
| 8 | r0-connexions › liste 390 px : « Montage réel pour : — » | défaut n° 1 : pas de `STUDIO_ALIGNEUR_URL` dans ce test, la carte promettait à tort le face caméra | **b** — code corrigé, test inchangé | vert |
| 9 | r0-connexions › « — » sans serveur de rendu ; « — » sans moteur réel | défaut n° 1 | **b** — code corrigé, test inchangé | vert |
| 10 | r0-connexions › ROUGE (relecture) — `moteur.avocat` : le type avocat EST monté | défaut n° 1 | **b** — code corrigé, test inchangé | vert |
| 11 | r6-je-lis-reel › montage ou stockage non relié : l'interrupteur n'agit pas | défaut n° 1 | **b** — code corrigé, test inchangé | vert |
| 12 | r6-je-lis-reel › carte Montage : « Type avocat · je lis » | défaut n° 1 | **b** — code corrigé, test inchangé | vert |
| 13 | r6-je-lis-reel › une seule règle — moteur réel déjà choisi, allumé | défaut n° 1 | **b** — code corrigé, test inchangé | vert |
| 14 | r6-je-lis-reel › une seule règle — moteur réel déjà choisi, éteint | défaut n° 1 | **b** — code corrigé, test inchangé | vert |

**Test ajouté** dans r0-connexions : « face caméra (format actif) : annoncé monté pour de vrai seulement avec le serveur d'alignement, comme au lancement ». Il vérifie 4 cas :

- sans serveur d'alignement : `[]` ;
- avec le serveur d'alignement : `["Face caméra"]`, puis « Montage réel pour : Type avocat, Face caméra » une fois `moteur.avocat` choisi ;
- `facecam.aligneur.reel = false` : face caméra retiré ;
- sans serveur de rendu : `[]`.

Aucun test supprimé, aucun `skip` ajouté.

## Test instable : r2-textes-publication › « pré-vol : crédit Claude suivi insuffisant → aucun appel »

- **Cause :** `brancherClaude` lançait `void credits.declarerRecharge("anthropic", 500)` sans l'attendre. La recharge de 5 $ d'un test pouvait donc s'écrire après le début du test suivant, et après le `beforeEach` qui remet les dépôts à zéro. Dans le test du pré-vol (1 centime déclaré), une recharge tardive fournissait le crédit et un appel partait.
- **Correction :** `brancherClaude` est désormais `async` et attend la recharge (`await`). Les 31 appels sont devenus `await brancherClaude(...)`.
- **Contrôle :** trois exécutions du fichier seul, `Tests  40 passed (40)` à chaque fois.

## Résultats exacts

- `next typegen` : OK.
- `tsc --noEmit` : 0 erreur.
  - Au premier lancement, 9 erreurs, toutes dans `studio-rendu/`, dues à ses dépendances non installées (sous-paquet séparé). Elles ont disparu après `npm ci --ignore-scripts` dans `studio-rendu/`, une installation locale non commitée.
- `eslint .` : 0 erreur, 0 avertissement.
- **Suite Vitest complète, passe 1 :**
  - `Test Files  1 failed | 277 passed | 1 skipped (279)` · `Tests  2 failed | 3392 passed | 3 skipped (3397)` (598,90 s).
  - Les 2 échecs sont des `Test timed out in 5000ms` dans e2e-verif1-bc-serie (« Reprendre l'écriture » après 3 pannes ; « CORRECTEUR FINAL A — la reprise va au bout »).
- **Suite Vitest complète, passe 2 :**
  - `Test Files  1 failed | 277 passed | 1 skipped (279)` · `Tests  2 failed | 3392 passed | 3 skipped (3397)` (592,34 s).
  - Mêmes 2 délais de 5 s, aucune assertion en échec.
- **Les 2 délais relancés seuls** (`e2e-verif1-bc-serie` + `r2-textes-publication`) : `Test Files  2 passed (2)` · `Tests  54 passed (54)`.

Hors délais de 5 s sous charge, la suite n'a plus aucun échec.

## Reste à voir (non traité ici)

- Les trois tests « Reprendre l'écriture » de e2e-verif1-bc-serie dépassent régulièrement 5 s sous la charge de la suite complète. Ils passent seuls.
- Leur donner un délai explicite (comme les autres tests longs du fichier, à 120 000 ms) supprimerait ce bruit. Ce changement n'a pas été fait sans accord.
