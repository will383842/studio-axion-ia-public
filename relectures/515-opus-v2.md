# Seconde relecture PR 515 (ARG-R7-SUITE), tête 560af84a

## VERDICT : OK (fusion POSSIBLE)

Les deux points de la première relecture sont corrigés. `scripts/echecs-connus.json` est propre. L'Usine reste prouvée bloquante partout. Le périmètre est respecté. Les remarques A-D sont reportées au journal. Il reste deux retouches de texte, non bloquantes (voir « Remarques »).

## Contrôles

**(1) POINT 1, « Réessayer » sur le vrai chemin : RESTAURÉ.** Fichier `tests/paquet4-relecture-exactitude.test.ts:220-275`. Une aide `enUsine` (l.196) passe la version du travail à `commande.origine = "usine"`, et c'est `travaux.reessayerTravail` qui est appelé. Comparaison ligne à ligne avec master (l.195-227 de master) :
- seuil à 0, refus `CONFIRMATION_REQUISE` : identique ✔
- `montant > 0` : identique ✔
- transport par `commun.essayer` → `{ ok:false, code:"CONFIRMATION_REQUISE", montant }` : identique ✔
- `confirme: montant - 1` → `CONFIRMATION_REQUISE` avec le même montant, message « Le prix a changé », le travail reste `echec` : identique ✔
- `confirme: montant` → la relance part : identique ✔
- **Seul écart** : le message en euros (`/\d+,\d{2}\s?€/`) devient `/coûte plus que d'habitude/` (l.235). J'ai vérifié que l'écart vient du code et non du test. `src/services/credits.ts:345`, identique sur master, écrit `${quoi} coûte plus que d'habitude…` sans montant. L'attendu en euros de master ne pouvait donc plus passer, même pour l'Usine. Le prix en euros reste prouvé sur le double réel (garde commune avec `origine:"usine"`, `2,50 €`). Cet écart est acceptable.
- Mutation de contrôle (copie jetable, restaurée) : à `src/services/travaux.ts:1037`, `reactiverSelonOrigine(undefined, …)` (origine ignorée) fait passer les deux cas « Réessayer » au **ROUGE** (`expected {…} to match object { code: 'CONFIRMATION_REQUISE' }`). La preuve sur le vrai chemin est donc discriminante.

**(2) POINT 2, noms de personnes : CORRIGÉ.** `grep -iE 'will|williams|jullin'` sur les lignes ajoutées du diff ne trouve rien. Le titre du cas voix dit « sans accord du fondateur ».

**(3) `scripts/echecs-connus.json` : OK.** Le JSON est valide. Le diff ne fait qu'**ajouter** une entrée : aucune n'est retirée ni modifiée. Cette entrée vise la garde B6 de `tests/c1-argent-b6-confirmation.test.ts`, avec un nom identique au `fullName` vitest et la cause exacte. Rejoué sur master : la garde B6 est rouge (`expected [ Array(1) ] to deeply equal []`). Elle l'est encore sur la branche, et `grep "confirme: true" src` ne trouve que `src/components/mots/gestes-mots-cibles.ts` (l.58, 69, 87, 101). L'entrée correspond donc à un échec réel et ne masque aucun cas qui devrait passer. Les trois autres rouges de c1 sur master (ancien mode bloquant) sont réalignés et verts, et ne sont pas dans la liste. Voix rejoué sur master : 3 rouges (2 avec une cible d'espion périmée, plus « le lanceur »). Sur la branche, les 3 sont réalignés et verts, si bien qu'aucune entrée voix n'est nécessaire et aucune n'a été ajoutée.

**(4) Réalignement voix : l'Usine reste bloquante.** Les espions visent maintenant `verifierEtReserverSelonOrigine` (`src/services/image-video.ts:317`), et les indices d'arguments sont décalés de 1 (montant en [2], ids en [4]). Les attendus 150, 220 et `{videoId, travailId}` sont inchangés. Le cas « le lanceur, Usine » (`origine:"usine"`) attend toujours « pas été accordé », sans appel à `verifierEtReserverSelonOrigine` ni à `reserverPourUsine`. Ce dernier attendu est même ajouté.

**(5) Rien d'affaibli, périmètre intact.** Aucune ligne retirée du diff ne mentionne l'Usine. Aucun `.skip`, `.only` ni `todo` n'a été ajouté. Les 11 fichiers touchés sont sous `tests/`, `scripts/echecs-connus.json` et `pilotage/journal/`. `src/**`, `vitest.config.mts`, `tests/zernio/**` et `.github` sont intacts.

**(6) Remarques A-D :** elles sont recopiées dans `pilotage/journal/ARG-R7-SUITE.md`, à la section « À TRANCHER / FICHE DÉDIÉE ». ✔

**(7) Mutations et rejeu.** Mutations faites dans une copie jetable, puis restaurées :
- `src/services/mode-budget.ts:49` (`origineDeLaVideo`, branche illisible) `"usine"` → `"studio"` : `tests/r7-origine-illisible.test.ts` passe au **ROUGE** (`expected 'studio' to be 'usine'`).
- `src/services/credits.ts:334` `accordAutomatique(…, { origine: undefined, … })` (garde Usine neutralisée) : **ROUGE** (`promise resolved "undefined" instead of rejecting`).

Les 9 fichiers de test touchés ont été rejoués sur la branche : 118 cas lancés. a2 22 verts et 1 ignoré (ignoré déjà sur master), c1 5/6 (rouge B6 connu), e2e-bc 8/8, garde-fous 3/3, paquet4 13/13, rerelecture 10/10, r2 43/43, r7 1/1, voix 11/11. `node scripts/comparer-echecs.mjs` sur le rapport JSON : **VERT** (code 0). Seul échec : B6, « connu ».

## Remarques (non bloquantes, à retoucher quand l'occasion se présente)

E. `pilotage/journal/ARG-R7-SUITE.md:20` : la ligne range encore les 2 cas voix à cible périmée dans « NON MODIFIÉS, à réaligner par la fiche dédiée ». Or le commit 17bf560a les a réalignés, et ils sont verts. La l.4 (« c1 et voix gardent des rouges ») est elle aussi périmée pour voix. Enfin, le journal ne cite pas l'entrée ajoutée à `scripts/echecs-connus.json`.
F. `tests/paquet4-relecture-exactitude.test.ts:220` : le titre annonce « Usine = prix en euros », mais sur le chemin « Réessayer » le message attendu est « coûte plus que d'habitude ». Les euros ne sont prouvés que par la garde commune (double réel). Mieux vaut préciser le titre.
G. Rappels hors périmètre : `src/services/mode-budget.ts:40` (commentaire « Illisible : studio » faux, remarque C) et le prénom présent dans des commentaires de `src/services/credits.ts` (l.339 et 348, déjà sur master, hors de cette PR) sont à traiter dans une fiche src.

## Fusion
Possible.
