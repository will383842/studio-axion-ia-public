# Relecture Opus n° 2 : PR 520 (ARG-ORIGINE-USINE)

Branche `usine/ARG-ORIGINE-USINE`, tête exacte `fb761e8e` (3 commits d'avance sur master), relue contre `origin/master`
(`git diff origin/master...origin/usine/ARG-ORIGINE-USINE`). Première relecture : `relectures/520-opus.md` (tête `6144eeeb`).

## Verdict : À CORRIGER (un seul point, court). Pas de fusion sur la tête `fb761e8e`.

A1, A2, A3, M1 et M3 sont réellement corrigés. Les mutations demandées font toutes rougir un test. « Reprendre » est identique
à master. Le Studio est inchangé : mêmes 5 rouges que master, aucun nouveau. tsc et lint sont identiques à master.

Mais le correctif A1 ouvre un nouveau chemin par lequel **l'origine vient du navigateur** (point 5 de la consigne) :

**B1. Une clé `origine` forgée par le client devient l'origine de l'écriture.**
- `lancerGeneration` (`src/services/boucle-generation.ts:264` et `:267`) prend maintenant `origine` dans son objet d'entrée.
  Elle la fige dans les options de l'écriture, sans contrôler sa valeur.
- L'action serveur `creerSujetAction` (`src/app/(studio)/ecrire/sujets/actions.ts:47` à `:55`) passe à `lancerGeneration` le
  `brief` reçu du navigateur (`...reste`). Elle retire `estDemo`, `origineUsine` et `typeAutomatisation`, mais **pas `origine`**.
- Je l'ai prouvé avec une sonde jetable, sur le modèle de `tests/ciblage/action-cible.test.ts`. J'ai appelé
  `creerSujetAction({ …, origine: "usine" })` : l'appel à `lancerGeneration` reçoit bien `"origine":"usine"`.
- Gravité faible, car « usine » est le cas le plus strict : un client qui forge la clé se bloque lui-même. Une autre valeur, par
  exemple `"x"` ou un objet, se résout comme le Studio, mais elle est quand même écrite telle quelle dans
  `generateur.chaine-options.<id>`.
- Cela reste contraire à la règle « l'origine ne vient jamais du client ». Sur master, cette clé n'atteignait aucune décision
  d'argent.
- **Correctif** :
  - ajouter `delete reste.origine;` dans `creerSujetAction`, à côté de `delete reste.origineUsine` (l.51) ;
  - si possible, ne garder dans `lancerGeneration` que `origine === "usine" ? "usine" : undefined` ;
  - ajouter une assertion dans `tests/ciblage/action-cible.test.ts` : avec `origine: "usine"` dans le brief, l'appel à
    `lancerGeneration` ne contient pas `origine`.

Une fois B1 corrigé (et rien d'autre modifié), la PR est fusionnable sans nouvelle relecture complète. Il suffira de vérifier ce
diff et le test.

## 1. Les points de la première relecture

| Point | État | Où |
|---|---|---|
| A1 série | Corrigé | `serie-ecriture.ts:189` passe `origine` à `lancerGeneration`. Celle-ci la met dans `OptionsGeneration`, écrite par `lancerSurSujet` (`boucle-generation.ts:329`, `cleOptions`). Elle est relue par `executeurFacture`, la réserve de la chaîne, `indicatifDeLEcriture` et `devisReprise`. |
| A2 versions qui attendent leur mère | Corrigé | `fabrication-reseaux.ts:784` garde l'origine dans la déclinaison. `:889` la retransmet à `lancerFabricationConfirmee`. `:901` la garde si la version passe en attente de crédit. |
| A3 relance après crédit | Corrigé | `types.ts:805` ajoute `origine?` à `lancementEnAttente`. `fabrication-reseaux.ts:721` l'écrit (`mettreEnAttenteDeCredit`). `credits.ts:766` la retransmet à `lancerFabrication`. |
| M1 | Corrigé | `lancerVideoDeVersion` passe l'origine à `lancerFabrication` (`fabrication-reseaux.ts:707`). Assertion : `commande.origine === "usine"`. |
| M3 | Corrigé | `empechementLeve(…, origine)` puis `manquesPour(a.lignes, origine)` (`generation-claude.ts:871`). L'origine est lue par `origineDeLEcriture`. |
| M2 | Non fait, volontairement | Décision du fondateur, notée dans le journal. |

Recherche d'autres chemins oubliés (`lancerGeneration`, `lancerFabrication*`, `lancerFabricationConfirmee`,
`lancerVariantesEnAttente`, `lancerVideosEnAttente`, `mettreEnAttenteDeCredit`, `manquesPour`, `accordAutomatique`,
`verifierBudgetEtCredits`) : rien de bloquant. Points mineurs, à noter ou à trancher :
- **m1.** `confirmerFabricationComplete` (`fabrication-reseaux.ts:845` et `:852`). Une version d'un « Fabriquer les N »
  de l'Usine qui passe en « Fabriquer en entier » (raccord visible, `:881`) est relancée sans `decl.origine`. Le repli
  `origineDeLaVideo` donne « studio », parce que la vidéo n'a pas encore de version. C'est un geste fait à l'écran du Studio,
  donc l'origine « studio » se défend. Il suffirait de passer `decl.origine` si l'on veut que l'origine suive la vidéo.
- **m2.** `garderEnAttente` (`credits.ts:726`, geste « lancer dès que possible » à l'écran) remplace `lancementEnAttente` sans
  origine. C'est un geste du Studio, donc c'est acceptable.
- **m3.** Ces deux chemins ne sont couverts par aucun test : M3 (`empechementLeve`) et la mise en attente d'une version partie
  après sa mère (`fabrication-reseaux.ts:901`). J'ai muté chacun : aucun nouveau rouge, seul le rouge déjà connu de
  `garde-fous-budget` reste. Ce n'est pas bloquant.
- Inchangé et acceptable : `manquesPour` sans origine dans `credits.ts:699`, `:701` et `:1104` (affichage et surveillance).
  `image-video-*` et `creation-format` sont hors du périmètre de cette fiche.

## 2. « Reprendre » : inchangé

`reprendreEcriture`, `reprendreEcritureArretee` et `devisReprise` sont identiques à master, ligne à ligne : j'ai extrait et
comparé le corps de chaque fonction. `tests/garde-fous-reprise-sujet.test.ts` est vert, comme les 3 fichiers `r7-origine-usine-*`
(14 tests sur 14).

## 3. Studio : inchangé

Sans origine, tout se résout comme sur master :
- `budgetIndicatifPour(undefined)` vaut `budgetIndicatif()` ;
- chaque ajout est écrit sous la forme `...(origine ? { origine } : {})`, donc rien n'est écrit quand il n'y a pas d'origine ;
- les tests vérifient que `origine` est `undefined` côté Studio.

Fichiers relancés : 22 fichiers `r7-*`, `paquet4-*`, `c1-argent-b6-confirmation`, `garde-fous-*` et `c5-serie-ecriture`. Sur master,
le même motif donne 19 fichiers, car les 3 fichiers `r7-origine-usine-*` sont neufs.

| | Rouges | Verts | Total |
|---|---|---|---|
| Master | 5 | 180 | 185 |
| Branche | 5 | 191 | 196 |

Ce sont exactement les rouges déjà connus :
- `c1-argent-b6` : garde `confirme: true` ;
- `c5-serie-ecriture` : 2 tests ;
- `garde-fous-budget` : message d'attente ;
- `paquet4-jonctions` : jonction 4.

Aucun nouveau rouge.

## 4. Mutations, rejouées dans un worktree jetable puis supprimé

Chaque mutation a été annulée par `git checkout -- src` avant la suivante.

| Mutation | Rouges |
|---|---|
| Origine retirée de `lancerGeneration` dans la série (`serie-ecriture.ts:189`) | 1 : `r7-origine-usine-serie` |
| Versions en attente : mémorisation et retransmission retirées | 1 : `r7-…-fabrication` A2 |
| Versions en attente : retransmission seule retirée (`:889`) | 1 : A2 |
| Relance après crédit (`credits.ts:766`) | 1 : A3 |
| Origine de l'attente retirée (`mettreEnAttenteDeCredit`) | 1 : A3 |
| `lancerVideoDeVersion` → `lancerFabrication` sans origine | 3 : M1, A2, A3 |

Les 4 mutations demandées sont discriminantes.

## 5. L'origine ne vient jamais du client : NON, voir B1

Les autres entrées sont saines :
- `lancerSerieAction` (`ecrire/serie/actions.ts:18`) passe 5 arguments, donc pas d'origine ;
- `generateur-ecran.ts:334` et `:338` construisent les options champ par champ, sans origine ;
- `garderEnAttente` n'accepte pas d'origine ;
- aucun service touché n'est en `"use server"`.

## 6. Hygiène

- Aucun nom de personne ajouté.
- Aucun `.skip`, `.only` ou `todo`.
- Fichiers dans le périmètre : rien dans `tests/zernio`, `mots-*`, `.github`, `vitest.config.mts` ou `echecs-connus.json`.
- `src/domaine/types.ts` : seul ajout, un champ optionnel `origine?: "studio" | "usine"` dans `lancementEnAttente`. C'est purement
  additif : les attentes existantes restent valides, et il n'est écrit que si une origine est donnée. Il est donc neutre pour le Studio.

## 7. Outils

- `pnpm install --frozen-lockfile` : OK.
- `tsc --noEmit` : 146 erreurs sur la branche comme sur master, même répartition par fichier, aucune dans les fichiers touchés.
- ESLint sur les fichiers `src` touchés : 0 erreur et 5 avertissements, les mêmes que sur master (seuls les numéros de ligne
  sont décalés).
