# Relecture PR 481 (NEW-ARG-04, le Studio ne bloque jamais pour un prix) : tête 87220842

## Verdict : À CORRIGER

Le code est juste et sans régression : aucun écran ni blocage n'impose plus un prix en mode indicatif. Deux points
restent à reprendre, petits et rapides : le test moteur « (b) » n'est ni traité ni signalé, et `mode-budget.ts`, déjà
touché par la PR, contient encore des prénoms visibles dans le diff.

## Périmètre réel de la PR

`git diff origin/master...origin/usine/NEW-ARG-04` montre 23 fichiers. Ce n'est qu'un effet d'affichage : NEW-ARG-05
a été fusionnée en squash (#468) et la branche n'a pas repris master depuis. La fusion simulée
(`git merge-tree origin/master origin/usine/NEW-ARG-04`) se fait sans conflit et ne change que **3 fichiers** par
rapport à master :
`src/services/mode-budget.ts`, `src/services/budget-mensuel.ts`, `tests/new-arg-04-mode-budget.test.ts`.
Conseil : fusionner master dans la branche pour que la PR n'affiche plus que ces 3 fichiers.

## Corrections du précédent verdict (vérifiées une par une)

1. **Prénom** : corrigé dans les lignes ajoutées. `src/services/budget-mensuel.ts:187` dit maintenant
   « prévient le fondateur ». Aucune ligne ajoutée ou retirée par la PR ne contient de nom. Voir le point A
   pour ce qui reste.
2. **Description de la PR** : corrigée. Elle annonce les 3 fichiers, la correction z30, les mutations R1 à R7, et
   avoue franchement ce qui reste (constante encore lue dans 3 fichiers, phrase « 5 fois » à `generation-claude.ts:1022`,
   blocage du lot Usine figé par R6). Ces constats sont exacts (vérifiés).
3. **Test R7** : corrigé. `tests/new-arg-04-mode-budget.test.ts:67-75` appelle maintenant le vrai
   `verifierPartVoix` (`src/moteurs/montage-cas-concret/fabriquer.ts:361-370`) : 2 lectures déjà payées, ça passe ;
   3 lectures, ça lève `ErreurFabricationCasConcret` ; même avec 3 lectures, un autre texte (`prise: "fin"`) passe.
   Le test prouve donc le comportement, plus seulement la valeur de la constante. Il est vert.

## Points à corriger

A. **Prénoms encore présents dans un fichier touché, visibles dans le diff** (dépôt public).
   `src/services/mode-budget.ts:2` et `:4` (lignes de contexte du premier bloc du diff) ainsi que `:28` et `:48`
   contiennent encore le prénom du fondateur ou sa forme longue. Ce n'est pas une nouveauté (déjà sur master), mais la
   PR réécrit les lignes 5, 22-25 et 77-83 du même en-tête : les remplacer par « le fondateur » coûte quatre mots et
   éteint la question pour ce fichier.

B. **Test `tests/image-video/moteur.test.ts:787` « (b) secours Instagram refusé » : ni traité ni signalé.**
   Il échoue sur master et de la même façon sur la branche fusionnée. Il attend (`:796`)
   `… (1 lecture payée au plus, environ \d+,\d\d €) …`, mais l'écran affiche
   `… (1 lecture payée au plus) ; …`, sans prix. Le code est donc conforme à l'esprit de NEW-ARG-04 (n'imposer aucun
   prix) et c'est le test qui est en retard. La PR ne le corrige pas et ne le cite pas parmi les « échecs existants »
   de sa description (elle ne cite que c1-argent-b6-confirmation, e2e1-restes-09-limite-machine et garde-fous-budget).
   À faire : soit retirer `, environ \d+,\d\d €` de l'attente à la ligne 796 (si la fiche autorise ce fichier de
   test), soit au minimum l'ajouter à la liste des échecs existants dans la description, en renvoyant à une fiche de
   suite.

## Exactitude, cas limites, blocages restants (aucun à corriger dans cette PR)

- `jugerPlafond` (`src/services/budget-mensuel.ts:190-197`) : en mode indicatif, rend toujours `"ok"`, quel que soit
  le multiple (R1 le vérifie de 1,01 à 100 fois). En mode bloquant (Usine), rend `"bloque"`, comme prévu.
- `messageAuDelaDuBudgetIndicatif` (`mode-budget.ts:82-84`) n'annonce plus d'arrêt. `messageArretSecurite` /
  `MESSAGE_ARRET_SECURITE` (`:78-80`, `:89`) ne citent plus de prix. Remarque : aucun fichier de `src/` ne les
  appelle plus (code mort, seul le test les lit). Pas gênant, à retirer un jour.
- Lot image-vidéo : `src/moteurs/montage-image-video/fabrication.ts:1385` sort avant le contrôle de prix
  (`if (options.prixIndicatif) return null`). En mode indicatif, le facteur 5 passé à la ligne 1367 ne peut donc plus
  mettre un script de côté. Seule l'Usine (bloquante) peut le faire : la description l'annonce, et c'est une décision
  du fondateur.
- `generation-claude.ts:1022` (« 5 fois le prix annoncé ») : n'est affiché que si une réserve porte
  `securite: true`, or plus rien dans `src/` ne pose ce champ (seule sa déclaration à la ligne 992 reste). Il ne peut
  donc apparaître que pour une ancienne réserve déjà en base. Bien signalé dans la description, risque faible.
- `FACTEUR_SECURITE_BUDGET` est gardée et marquée obsolète (`mode-budget.ts:22-26`). Elle sert encore à
  `generation-claude.ts:446` (`limiteSecuriteUsd`) et à `cas-concret-branchements.ts:689` : c'est la suite annoncée.

## Tests lancés (arbre de fusion simulée avec master, comparé à master)

- `tests/new-arg-04-mode-budget.test.ts` : 7/7 verts.
- `tests/image-video/moteur.test.ts` : 1 échec, le « (b) » du point B, identique sur master.
- Fichiers argent et budget (c1-argent-b6, garde-fous-budget, v4-argent, e2e2-gen-argent, reglages-plafond-sujet,
  l3-0-relecture-argent, supplements-plafond, garde-fous-reprise-sujet) : **les mêmes 14 échecs sur master et sur
  la branche**, aucun nouveau. La description sous-estime donc le nombre d'échecs déjà présents (« 6 échecs dans
  3 fichiers ») : à ajuster par honnêteté, sans incidence sur le verdict.
- Suite complète non terminée ici : arrêtée au bout de 40 min, 86 fichiers lancés. Les échecs vus en parallèle
  touchent des fichiers que la PR ne modifie pas ; les trois fichiers vérifiés un par un (moteur, garde-origine,
  argent) échouent de la même façon sur master.

## Aucun nom de personne

Aucune ligne ajoutée ou retirée par la PR, ni ce fichier de relecture, ne contient de prénom ou de nom. Seule réserve :
le point A (lignes de contexte déjà sur master).
