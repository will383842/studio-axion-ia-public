# Relecture PR 517 — ARG-TESTS-SUITE (tête 1cbf58d1)

## Verdict : OK — fusion possible

Aucun point bloquant. Deux remarques non bloquantes en fin de document.

Périmètre du diff (`git diff origin/master...origin/usine/ARG-TESTS-SUITE`) : exactement les 3 fichiers attendus
(`tests/e2e-verif1-ef-reessayer-redemarrage.test.ts`, `tests/reseaux/t5-prix-plafond.test.ts`,
`pilotage/journal/ARG-TESTS-SUITE.md`), 47 ajouts, 5 retraits.

## (1) Cas E2 — `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts`

- Zernio par défaut est voulu : `src/domaine/outil-publication.ts:43-51` (`outilPour` renvoie `"zernio"` par défaut,
  commentaire « Défaut : Zernio »), introduit par d88c046b « L7-06 : Zernio outil d'envoi par défaut (#440) ».
- Sur master, le cas E2 est bien rouge (rejoué : 1 rouge, uniquement sur l'attendu `via: "buffer"`).
- Assertions d'argent : toutes conservées à l'identique (l. 504-518 : `lecturesVoix` = 1 avant et après redémarrage,
  1 seule ligne « Voix » heygen, lignes « Double » = rendus acceptés, compositions jamais envoyées deux fois).
  Seule l'assertion de canal change (l. 522) : `via: "buffer", statut: "brouillon"` → `via: "zernio"`. Le statut
  « brouillon » était propre à Buffer, ce n'est pas une assertion d'argent.
- Mutation (copie jetable, restaurée) : dans `src/moteurs/montage-avocat/double.ts`, phase « rendu », un rendu
  accepté et encore en cours est re-soumis avec une clé neuve (= repayé). Résultat : E2 ROUGE
  (`expected … to have a length of 8 but got 4` sur les lignes « Double » vs rendus acceptés) — et 7 autres cas du
  fichier rougissent aussi. Le test reste discriminant sur l'argent (le journal disait ne pas avoir trouvé de
  mutation : celle-ci en est une).
- Aucun appel réseau réel : clé factice, faux client Zernio injecté et remis à `null` dans `afterEach`.

## (2) t5-prix-plafond — `tests/reseaux/t5-prix-plafond.test.ts`

- Déterministe : `nouvelId` remplacé (l. 21-28) par une suite fixe remise à 0 dans `beforeEach` (l. 56) ; horloge de
  la boucle fixée à partir de `T0` (l. 243-247, `T0` défini l. 352) au lieu de `Date.now()`. Plus aucun
  `Math.random`, `Date.now`, `randomUUID` ni `uuid` dans le fichier.
- Aucun seuil relâché : le diff n'ajoute que des lignes ; `MARGE_SIMULEE = 1.1` (l. 269) et les assertions de
  plafond (l. 262, l. 434) sont identiques à master. Le code du « réel » simulé (×0,90 à ×1,09,
  `src/moteurs/montage-avocat/index.ts:329`, `src/moteurs/simulation.ts:166`) n'est pas touché.
- 10 exécutions consécutives : 10/10 vertes (21/21 à chaque fois).
- Pas un videoId « commode » : copie jetable avec un préfixe d'identifiant variable → 15 graines (fichier complet)
  + 40 graines (cas « Fabriquer les N ») = 55 jeux d'identifiants différents, tous verts sous la même marge ×1,1.
  (Le master d'origine, rejoué 12 fois en isolation, est resté vert aussi : l'instabilité observée par la PR 503
  n'a pas été reproduite ici, mais la suite fixe ne masque aucun dépassement sur 55 graines.)
- Mutation du plafond dans src (copie jetable, restaurée) :
  - `index.ts:329` `% 20` → `% 40` (réel jusqu'à ×1,29) → 3 rouges ;
  - `index.ts:329` `0.9 +` → `1.12 +` → 3 rouges (« réel ≤ annoncé × 1,1 » et « 4:5 : 0 € de plus » v-03, v-04).

## (3) Fichiers interdits

Aucune modification de `src/**`, `vitest.config.mts`, `tests/zernio/**`, `.github`, `scripts/echecs-connus.json`.

## (4) Entrées temporaires de la PR 503 (`scripts/echecs-connus.json`)

Les deux noms du journal (`pilotage/journal/ARG-TESTS-SUITE.md:18-19`) sont identiques caractère pour caractère à
ceux de la PR 503 (tête 120f612b) :
1. `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts` — « E2 — redémarrage du serveur en plein travail (montage réel
   allumé) redémarrage pendant le rendu du double (accepté par HeyGen, pas encore relu) : reprise sans rien repayer,
   jusqu'au brouillon Buffer »
2. `tests/reseaux/t5-prix-plafond.test.ts` — « T5 · « Fabriquer les N » (moteur avocat, hors T5) : tout en 9:16, prix
   annoncé = contrôlé annoncé = contrôlé au lancement, réel dans la marge de la simulation (≤ annoncé × 1,1) ; aucune
   sortie en 4:5, même LinkedIn »

Le journal signale à juste titre que E2 est renommé par la 517 : l'entrée 1 ne correspondra plus à rien. Sans
danger (`scripts/comparer-echecs.mjs` ne rougit pas sur une entrée périmée, il la liste « corrigé (à retirer) »),
mais les deux entrées sont à retirer. Conflit possible avec la 503 sur `t5-prix-plafond.test.ts` (`beforeEach`) :
garder les deux changements.

## (5) Noms de personnes

Aucun nom de personne dans le diff (données d'essai : « Exemple IG », « org-exemple »).

## (6) Fichiers touchés verts

`vitest run` des 2 fichiers : 40/40 verts. eslint propre sur les 2 fichiers.

## Remarques non bloquantes

- `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts:357-359` : `listerCanaux` et `envoyer` de Zernio sont
  espionnés (`vi.spyOn`) sans `vi.restoreAllMocks()` dans `afterEach` ; le faux client injecté l. 271 devient
  redondant pour `envoyer`. Sans effet sur l'argent ; un `vi.restoreAllMocks()` dans `afterEach` serait plus propre.
- l. 507 (préexistant, hors diff) : `acceptes` est mesuré mais jamais comparé après le redémarrage ; l'assertion
  l. 515 compare les lignes « Double » à `rendusHeygenAcceptes()` relu APRÈS, donc un renvoi qui serait aussi compté
  passerait. Ajouter `expect(rendusHeygenAcceptes()).toBe(acceptes)` après `tours(travailId)` durcirait le cas.
  À traiter dans une fiche dédiée, pas dans la 517.
