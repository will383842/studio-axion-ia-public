# Relecture Opus n° 3 : PR 520 (ARG-ORIGINE-USINE), vérification du delta B1

Branche `usine/ARG-ORIGINE-USINE`, tête exacte `d70006db`. Delta relu : `git diff fb761e8e..d70006db`.
Relectures précédentes : `relectures/520-opus.md` (tête `6144eeeb`), `relectures/520-opus-v2.md` (tête `fb761e8e`).

## Verdict : OK. Fusion possible sur la tête `d70006db`.

B1 est corrigé : le navigateur ne peut plus fixer l'origine. Le delta ne contient que B1. Les deux mutations font rougir un test.
Rien de nouveau ne rougit par rapport à master. Lint donne 0 erreur et tsc donne 146 erreurs, comme sur master.

## 1. Le delta ne contient que B1

Le delta touche 5 fichiers, +32/−1 :

- `src/app/(studio)/ecrire/sujets/actions.ts` (+2) : un commentaire et `delete (reste as { origine?: unknown }).origine;`.
  La ligne est placée à côté des `delete` de `estDemo`, `origineUsine` et `typeAutomatisation`.
- `src/services/boucle-generation.ts` (+3/−1) : dans `lancerGeneration`, la clé est lue sous le nom `origineRecue`. Ensuite,
  `origine = origineRecue === "usine" ? "usine" : undefined`.
- `tests/ciblage/action-cible.test.ts` et `tests/r7-origine-usine-serie.test.ts` : un test neuf dans chaque fichier.
- `pilotage/journal/ARG-ORIGINE-USINE.md` : le journal.

Le delta ne contient rien d'autre.

« Reprendre » n'a pas changé. Le corps de `reprendreEcriture` (29 lignes) et celui de `reprendreEcritureArretee` (42 lignes)
sont identiques octet pour octet à `origin/master` (`f6236241`). Le delta ne touche ni `devisReprise` ni ses 3 appels.

## 2. Le chemin client est fermé, et l'Usine passe toujours

**Côté navigateur.** `creerSujetAction` retire désormais `origine` avant d'appeler `lancerGeneration`. Le nouveau test vérifie
trois valeurs : « usine », « x » et un objet. Pour chacune, l'appel à `lancerGeneration` n'a pas de clé `origine`.

**Côté service.** Le filtre ne retient que « usine ». Toute autre valeur devient `undefined`, et rien n'est écrit dans les options.

**Les appelants de `lancerGeneration`** (recherche dans tout `src`) :

| Appelant | Ce qu'il passe en `origine` |
|---|---|
| `src/services/serie-ecriture.ts:189` | `...(origine ? { origine } : {})`, avec `origine?: OrigineLancement` reçu par `lancerSerie` |
| `src/services/boucle-generation.ts:1102` | aucune origine (`{ scriptMaitreId }`) |
| `src/services/boucle-generation.ts:1282` | aucune origine (`{ scriptMaitreId }`) |
| `src/app/(studio)/ecrire/sujets/actions.ts:57` | aucune origine (clé retirée) |

Le type `OrigineLancement` vaut `"studio" | "usine"` (`src/services/budget-mensuel.ts:153`). La seule autre valeur valide est donc
« studio ». Le filtre la change en `undefined`, ce qui est déjà la sémantique du Studio : une origine absente veut dire Studio.
Aucun appelant légitime ne change de comportement.

## 3. Les mutations (rejouées dans une copie jetable, puis code restauré)

| Mutation | Test qui rougit |
|---|---|
| Retirer le `delete` de l'action | `action-cible` « B1 : une clé `origine` forgée par le navigateur n'atteint jamais lancerGeneration » |
| Retirer le filtre (`const origine = origineRecue`) | `r7-origine-usine-serie` « B1 : lancerGeneration ignore toute origine autre que « usine » » |

Chacune des deux mutations fait rougir son test B1.

Remarque sans rapport avec la PR : lancé seul, le test « refuse sans cible… » de `action-cible` dépasse le délai de 5 s du
premier import. Il fait pareil sur master. Avec `--testTimeout=30000`, ou lancé avec d'autres fichiers, il passe. Ce n'est pas
une régression.

## 4. Tests, lint, tsc, noms de personnes

- **Tests demandés, tous verts.** Ils couvrent 5 fichiers et 20 tests : `tests/ciblage/action-cible.test.ts`,
  `tests/r7-origine-usine-{serie,manques,fabrication}.test.ts` et `tests/garde-fous-reprise-sujet.test.ts`.
- **Pas de nouveau rouge.** J'ai comparé la tête et master sur un même lot : `r7-*`, `paquet4-*`, `c1-argent-b6*`,
  `garde-fous-*`, `c5-serie*`, `ciblage/*`, plus `l3-0-garde-origine` et `v4-argent`. J'ai lancé le lot avec
  `--testTimeout=60000 --maxWorkers=2`.
  - Tête : 8 rouges. Master : 8 rouges. Ce sont exactement les mêmes intitulés. Le seul écart vient des 3 fichiers
    `r7-origine-usine-*`, qui n'existent pas sur master et sont verts sur la tête.
  - Parmi ces 8 rouges, on trouve les 5 déjà connus : c1-argent-b6, c5-serie-ecriture ×2, le message d'attente de
    garde-fous-budget, et la jonction 4 de paquet4-jonctions.
  - Les 3 autres rougissent aussi sur master : l3-0-garde-origine ×2 et v4-argent ×1. Ces deux fichiers n'étaient pas dans la
    liste des 5 parce qu'ils ne faisaient pas partie du lot de référence.
- **Suite complète.** Elle a été lancée, mais la machine était saturée et beaucoup de tests ont dépassé leur délai. Le résultat
  n'est pas exploitable pour comparer avec master, donc je ne m'en sers pas.
- **Lint.** 0 erreur sur les 4 fichiers de code et de tests touchés, avec 3 avertissements déjà présents avant.
- **tsc.** 146 erreurs sur la tête comme sur master. Aucune ne concerne les fichiers touchés. Les seules différences de texte
  viennent de l'ordre d'affichage des unions dans deux fichiers de tests `image-video`, que la PR ne touche pas.
- **Noms de personnes.** Le delta n'en contient aucun.
