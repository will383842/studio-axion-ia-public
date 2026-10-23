# RELECTURE — FINAL3 (assemblage D1 + UI2) — branche `outils/final3` (04/10/2026)

Assemblage : `origin/master` (7fd6eab) + `--no-ff origin/outils/d1` (3e53a42) + `--no-ff origin/outils/ui2` (16ce42b).
Les deux fusions passent sans conflit (aucun fichier commun). Aucun appel réseau réel, aucune clé. `master` n'est pas touché.
Lus : `docs/controles/CORRECTEUR-D1.md`, `docs/controles/CORRECTEUR-UI2.md`, et tout `git diff origin/master origin/outils/final3`.

## Contrôles (après fusion)

Préparation : `pnpm install --frozen-lockfile`, `npx next typegen`, `(cd studio-rendu && npm ci --ignore-scripts)`.

| Contrôle | Résultat |
| --- | --- |
| `npx tsc --noEmit` (racine) | OK |
| `npx tsc --noEmit` (studio-rendu) | OK |
| `npx eslint .` | OK, 0 erreur |
| `pnpm build` (Turbopack) | OK |
| `npx vitest run` (complet, après `pnpm build`) | **235 fichiers OK (1 ignoré), 2 894 verts, 2 sautés, 0 rouge** |
| `npx next build --webpack` | OK |

Après l'ajout du relecteur (un test, voir plus bas) : `tests/r8-bout-en-bout.test.ts` 11/11 verts, `tsc` et `eslint` OK.

## Verdicts

- **EXACTITUDE (argent) : ACCEPTÉ.**
- **SÉCURITÉ : PAS DE VETO.**

## Lentille 1 — EXACTITUDE

### D1 — refus net de HeyGen pendant le suivi d'un rendu accepté

Le cas est bien fermé.

- `src/moteurs/montage-avocat/double.ts:333` : une erreur **non réessayable**, sur une pièce en phase `rendu` **avec** un
  `idExterne`, met la pièce en échec avec `suiviRefuse`. L'identifiant est gardé.
- `lignesDouble` (`double.ts:218`) la compte encore. Elle n'est comptée qu'une fois, car c'est la même pièce et le même
  identifiant.
- « Réessayer » (`index.ts:1415`) passe par `renduARelire`. La pièce repart en `rendu` + `reverifier`, sans nouvel envoi :
  - **HeyGen y travaille encore** : la branche E1 existante (`double.ts:318`) la remet en échec, sans renvoi. Elle reste
    comptée (`delaiDepasse`).
  - **HeyGen a fini** : le rendu est récupéré.
  - **HeyGen a échoué** : seule cette pièce repart, avec une clé neuve, sous le plafond 1,5× cumulé.
- Un refus en phase `envoi` (avant acceptation) garde la règle d'avant : les secondes sont rendues.
- Les erreurs sans drapeau `reessayable` sont traitées comme réessayables (valeur par défaut `true`) : elles ne passent pas
  par ce chemin.

**PREUVE ROUGE** : `double.ts` et `index.ts` du montage remis à 7fd6eab, avec les tests de la branche. Fichier
`tests/e2e-verif1-ef-reessayer-redemarrage.test.ts` : **3 rouges / 19**, les 3 tests D1 du bloc E2. Les 16 autres restent verts.

| Test | Rouge brut | Rouge « argent » seul (copie jetable du test, sans les assertions de phrase, supprimée) |
| --- | --- | --- |
| D1 (a) clé refusée au suivi, puis « Réessayer » pendant que HeyGen travaille | phrase D1 absente | `expected [] to have a length of 4 but got +0`, soit 4 rendus acceptés et **0 compté**. Sans cette assertion : `expected 8 to be 4`, soit **4 renvois payants** `POST /v3/videos` alors que HeyGen travaille encore |
| D1 (b) téléchargement refusé après la fin | phrase D1 absente | `expected [] to have a length of 4 but got +0`. Sans cette assertion : `expected 8 to be 4`, soit **4 renvois** de rendus déjà finis et facturés |
| D1 (c) refus, puis un passage déclaré échoué | `expected 8 to be 5`, soit **3 renvois de trop** | idem |

Code restauré (`git checkout HEAD -- src/moteurs/montage-avocat/`), arbre propre. Fichier E2 + `correcteur-ui2` : 31/31 verts.

### UI2 — « Essai gratuit » et décision essai

Aucune dépense réelle n'est possible sans la feuille « Confirmer ce prix ».

- **Aperçu périmé / interrupteur allumé dans un autre onglet.** Le bouton principal et « Fabriquer l'essai » appellent
  `lancer(false…)`. Cette fonction **recharge toujours l'Aperçu** avant de décider (`Express.tsx:177`, `!confirme` force
  `chargerCout()`). La décision vient donc de l'Aperçu du moment, jamais de celui affiché.
- **Double défense dans `decisionLancement`** (`logique.ts`).
  - `montageReel` ou `double` ajoutent toujours une raison, ce qui donne `confirmer`. C'est vrai même avec
    `essaiGratuit: true` et `manquesAcceptes: true` (test `correcteur-ui2` l.106).
  - Avec des manques et sans essai gratuit, la décision est `completer`, même si l'essai avait été accepté.
- **Garde du serveur inchangée.** Montage réel sans accord : `CONFIRMATION_REQUISE` (`fabrication.ts:709`). Double réel sans
  accord : `CONFIRMATION_REQUISE` (`credits.ts:308`). Au-delà du seuil, idem. Simulation en production : refusée.
- **`essaiGratuit` côté serveur** (`fabrication.ts:528`). Il faut à la fois :
  - un moteur d'essai ;
  - ni montage réel, ni double réel ;
  - **chaque** ligne simulée ou à 0.

  Une seule ligne réelle payante (par exemple une vraie voix) suffit à afficher le prix au lieu d'« Essai gratuit ».
- **Chemin payant** : la feuille « Avant de fabriquer » (`lancer(prixAConfirmer…)`) n'a pas changé.
- **Test ajouté par le relecteur** : `tests/r8-bout-en-bout.test.ts`, étape 2 du parcours. Interrupteur allumé : l'Aperçu du
  moment dit `essaiGratuit: false`, et `decisionLancement(... manquesAcceptes: true)` donne `confirmer`, `completer` ou
  `budget`, jamais `direct`, avec ou sans manques. C'est un test de non-régression. Pas de preuve rouge propre ici : dans ce
  parcours, la voix reliée est réelle, donc l'Aperçu n'était pas « gratuit » même avant l'allumage.
- **U5 (durée)** : sans voix choisie, le débit passe de 4,4 à 2,6 mots/s. La durée et le prix estimés montent pour s'aligner
  sur la vraie lecture : c'est plus juste et plus prudent. Le plafond 1,5× du double se calcule désormais sur une durée
  réaliste. Les débits de la voix d'essai et d'une voix HeyGen ne changent pas.

### Rien de présenté comme réel qui soit un essai

- La feuille Buffer d'une vidéo d'essai ne propose plus l'envoi (`FeuilleEnvoyerBuffer.tsx:108`). Le raccourci dit
  « Vidéo d'essai ».
- **Le refus du serveur reste en place** (`publications.ts:591-595` : `VIDEO_EXEMPLE`, `VIDEO_ESSAI`, et `estCleDemo` sur
  les fichiers).
- « Essai gratuit » n'apparaît que si `essaiGratuit` est vrai. Le prix « en vrai » reste écrit en petit.

## Lentille 2 — SÉCURITÉ

- **Aucune clé** dans le diff (les tests utilisent des faux `fetch` et des clés d'essai déjà en place).
- **Nouvelle entrée** : `GET /api/travaux?video=…` (`src/app/api/travaux/route.ts`).
  - Elle est protégée par `sessionApi()` (401 sans session).
  - Le paramètre sert seulement de filtre d'égalité en mémoire ou dans le dépôt (`derniereFabricationDeLaVideo`) : pas
    d'interpolation, pas d'accès fichier.
  - La réponse passe par la même vue `versVue` que `?id=` : rien de plus n'est exposé.
- **Détails techniques à l'écran** :
  - D1 : `messagePourWill` = phrase fixe + « Raison : » + le `message` de l'erreur. Les messages non réessayables de
    HeyGen (`client.ts`, `telechargement.ts`, `visage.ts`, `rendus.ts`) sont des phrases françaises, sans code HTTP ni
    adresse. La raison brute (identifiant du rendu) reste dans `detailTechnique`.
  - U7 : l'écran « Sans suivi » ne montre que des phrases fixes et un lien `/videos/{id}`.

## Défauts et petits points (non bloquants, rien corrigé dans le code applicatif)

1. **`src/moteurs/montage-avocat/double.ts:337`** : « Raison : » reprend `x.message` de **toute** erreur marquée
   `reessayable: false`.
   - Aujourd'hui, seules des erreurs HeyGen en français arrivent là.
   - Scénario : une future erreur non réessayable d'une autre source (stockage, par exemple) avec un message technique
     s'afficherait telle quelle.
   - Suggestion : ne reprendre que le message d'une `ErreurHeygen`, ou passer par une liste de phrases connues.
2. **`src/services/publications.ts:362`** : `videoEssai` vaut `false` pour une vidéo d'exemple (`estDemo`). La feuille
   Buffer propose donc l'envoi, puis le serveur refuse en réel (`VIDEO_EXEMPLE`).
   - Ce n'est pas un risque d'argent ni de sécurité : c'est seulement une phrase de refus tardive.
3. **`src/assistant/etapes/Express.tsx:357`** (avant ce lot) : la pastille « Essai » du bouton suit `fabricationEssai`
   (ni montage réel ni double). Elle peut s'afficher à côté d'un prix réel, par exemple avec une vraie voix sous le seuil.
   - Le libellé montre alors le prix (`essaiGratuit` faux), donc rien n'est présenté comme gratuit à tort.
   - Seule la pastille peut prêter à confusion.
4. **D1, limite connue** : si la clé reste refusée, chaque « Réessayer » relit le rendu et retombe en échec, sans renvoi.
   Le rendu reste compté une fois. C'est voulu, et c'est noté par le correcteur.

## Modifications du relecteur

- `tests/r8-bout-en-bout.test.ts` : ajout de la vérification « interrupteur allumé : ni “Essai gratuit”, ni décision
  `direct` » (test seulement).
- Ce rapport.
