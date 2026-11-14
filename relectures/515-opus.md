# Relecture PR 515 (ARG-R7-SUITE), tête 04a629f4

## VERDICT : À CORRIGER (fusion NON en l'état ; deux corrections courtes, aucune touche à src)

Le fond est juste : les anciens attendus décrivaient bien le mode bloquant du studio, la liste des rouges du journal est exacte, le test neuf est discriminant, rien hors `tests/` et `pilotage/` n'est touché. Deux points empêchent la fusion :

1. **Preuve Usine affaiblie sur « Réessayer »** — `tests/paquet4-relecture-exactitude.test.ts:212-243`. Avant, le chemin réel (`travaux.reessayerTravail`) était prouvé bloquant (CONFIRMATION_REQUISE, montant, message en euros, transport par `commun.essayer`, montant-1 → « Le prix a changé », montant juste → la relance part). Côté Usine, la PR ne teste plus que la garde nue `credits.verifierBudgetEtCredits(…, { origine: "usine" })`. Or `reessayerTravail` respecte l'origine (`src/services/travaux.ts:1037`, `reactiverSelonOrigine(versionAvant?.commande.origine, …)`) : on peut donc prouver l'Usine sur le vrai chemin. **À corriger** : garder un cas Usine sur `reessayerTravail` (version du travail avec `commande.origine = "usine"`, comme `versionUsine` dans `tests/r2-textes-publication.test.ts:130`) qui vérifie : refus CONFIRMATION_REQUISE avec montant, `essayer` → `{ ok:false, code, montant }`, montant-1 → « Le prix a changé » et le travail reste en échec, montant juste → la relance part. Les assertions sur la garde nue peuvent rester en plus.
2. **Prénom dans un dépôt public** — la PR ajoute « Will » dans `tests/voix/voix-epinglee-image-video.test.ts:149` (titre du cas Usine) et `pilotage/journal/ARG-R7-SUITE.md:10`. Remplacer par « du fondateur ». (Le prénom existe ailleurs sur master, hors de cette PR : à traiter à part.)

## Contrôles point par point

**(1) Les anciens attendus = l'ancien mode bloquant.** Rejoué : les fichiers de test de master (`git checkout origin/master -- tests/`) sur le code de la branche (src identique à master). Sont rouges sur master exactement les cas réalignés : a2 (1), c1 (3 + garde B6), e2e-bc (1), garde-fous (1), paquet4 (5), rerelecture (2), r2 (2), voix (« le lanceur » + 2 autres cas, autre cause). Chaque ancien attendu exigeait CONFIRMATION_REQUISE, BUDGET_DEPASSE, « plafond-atteint » ou l'arrêt sur crédit suivi **pour une commande du studio**. C'est bien ce que la décision du 08/11 supprime. Aucune vraie protection encore voulue n'est retirée, sauf la réserve du point 1 (preuve déplacée) et la remarque A ci-dessous.

**(2) Usine toujours prouvée bloquante, rien d'assoupli.** Chaque cas réaligné a son pendant Usine : a2 BUDGET_DEPASSE ; c1 `verifierAvantDeFabriquerLesN` / `verifierAvantDeCreer` (`true` refusé, montant-1 refusé, montant juste passe) ; e2e-bc `lancerFabrication({ origine:"usine" })` → CONFIRMATION_REQUISE (sans confirmation et avec `confirme:false`) ; garde-fous « plafond-atteint » au 1er tour ; paquet4 attente « seuil » sur le vrai chemin de l'écriture (origine figée dans les options) puis reprise ; rerelecture R2/R4 `true` refusé ; r2 aucun appel et textes en essai ; voix « pas été accordé », ni `verifierEtReserverSelonOrigine` ni `reserverPourUsine` appelés. Aucun `.skip/.only/.todo` ajouté (les `it.skipIf` de a2 existaient déjà). Aucun seuil assoupli.

**(3) Périmètre.** `git diff --stat` : 9 fichiers sous `tests/` + le journal. Aucun changement de `src/**`, `vitest.config.mts`, `tests/zernio/**` ni `.github`.

**(4) Test neuf `tests/r7-origine-illisible.test.ts` : discriminant.** Vert sur la branche. Mutations rejouées dans une copie jetable (git worktree), puis restaurées :
- `src/services/mode-budget.ts:49` (`origineDeLaVideo`, branche `catch`) `"usine"` → `"studio"` : **ROUGE** (`expected 'studio' to be 'usine'`, test:49).
- `src/services/credits.ts` (`verifierBudgetEtCredits`), `accordAutomatique(…, { origine: undefined, … })` (origine Usine ignorée) : **ROUGE** (`promise resolved "undefined" instead of rejecting`, test:52).
- Variante : `seuilIndicatif = true` (la garde du seuil ne voit plus l'Usine) : **ROUGE** (test:52).

**(5) Journal : les rouges non traités sont exacts.** `pnpm vitest run` fichier par fichier sur la branche :
- c1 : 1 rouge, garde B6 (`src/components/mots/gestes-mots-cibles.ts : confirme: true`) ✔
- l3-0-garde-origine : 2 rouges (littéral « usine » dans `src/app/api/usine/commandes/route.ts` et `src/services/porte-programmations.ts` ; site non listé `src/services/tutoriel-branchements.ts · verifierEtReserverSelonOrigine × 1`) ✔
- l3-0-relecture-argent : 1 rouge, garde D, mêmes fichiers ✔
- r8-bout-en-bout : 10 rouges ✔ ; e2e-verif1-d-interrupteurs : 1 rouge ✔ ; garde-ecran : 1 rouge (jargon) ✔
- voix : 2 rouges (« une vidéo : réserve… », « une vidéo d'un lot… »), cause confirmée : `expected "verifierEtReserver" to be called 1 times, but got 0 times` (cible de l'espion périmée) ✔
Aucun rouge en plus de cette liste, aucun rouge annoncé qui serait en fait vert.

**(6) Fichiers touchés verts.** a2 22✔/1 skip (déjà là), e2e-bc 8/8, garde-fous 3/3, paquet4 13/13, rerelecture 10/10, r2 43/43, r7-origine-illisible 1/1. c1 (5/6) et voix (9/11) : seuls restent les rouges de cause différente listés au journal. Noms de personnes : voir le point 2.

## Remarques (non bloquantes, pour la fiche dédiée)

A. `tests/garde-fous-reprise-sujet.test.ts:111` : `reprendreEcriture(id, centimes - 1)` → 2 **sur une écriture de l'Usine**. Cette assertion fige une reprise sans confirmation pour l'Usine (`src/services/boucle-generation.ts:772`, `accordAutomatique` sans origine). C'est défendable, puisque « Reprendre » est un geste du fondateur à l'écran. Mais le fondateur doit trancher : soit la reprise d'une écriture de l'Usine exige le montant (alors corriger src puis ce test), soit c'est voulu (alors l'écrire dans `docs/blocages-inventaire.md`). En attendant, le plus prudent est de reprendre avec `centimes` plutôt que `centimes - 1`, pour ne pas figer ce trou.
B. Le journal signale bien les preuves Usine faites par la garde commune plutôt que par le vrai chemin : série (`serie-ecriture.ts:217` n'a pas d'origine), `fabriquerLesN` / `fabriquerVariante`, et `manquesPour` qui ignore l'origine (le cas r2 Usine s'arrête sur « budget absent », pas sur le crédit suivi). Ce sont de vrais trous possibles pour l'Usine : à traiter dans la fiche dédiée.
C. `src/services/mode-budget.ts:40` : le commentaire dit « Illisible : studio », alors que le code renvoie « usine » (l.48-49). Commentaire faux, hors périmètre (src) : à corriger dans une fiche src.
D. `tests/paquet4-relecture-exactitude.test.ts:254` : le message attendu de la garde commune passe de « 2,50 € » à « coûte plus que d'habitude ». Le prix en euros reste prouvé par le cas du double réel (l.225-227) : c'est acceptable.

## Fusion
Pas en l'état. Possible une fois les points 1 et 2 corrigés et les fichiers touchés relancés (verts, hors rouges listés au journal).
