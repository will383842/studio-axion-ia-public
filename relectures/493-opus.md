# Relecture PR 493 (L7-06 suite, points 4.3 à 4.6) — tête 24b36ad9

## Verdict : À CORRIGER

Un point bloquant : le 4.5 tel que livré **rouvre dans l'interface un chemin vers Buffer sur le parcours d'envoi par défaut Zernio**, alors que le 4.3 (refus serveur de `outil: "buffer"`) n'est pas fait. À corriger avant fusion (retirer ou griser l'option Buffer), le reste est bon.

## Points précis

1. **Bloquant : régression de direction sur le chemin Zernio par défaut** — `src/domaine/outil-publication.ts:25-26` + `src/components/publication/LignesAPublier.tsx:689-693`.
   Sur master, « Changer » ne proposait que Zernio. Désormais, pour **tout** compte routé chez Zernio, dès que `bufferDisponible` est vrai (`finitions-envoi.ts:161`), la liste propose aussi « Buffer (ancien outil) ». Le choix est envoyé tel quel (`LignesAPublier.tsx:353` → `:361`), et `envoyerParOutilAction` l'accepte (`src/services/a-publier-zernio.ts:107`) : l'envoi part par Buffer, en contournant au passage les gardes propres au chemin Zernio (calendrier fermé, vidéo d'exemple, vidéo d'essai, lignes 112-117). Le journal le reconnaît lui-même (« choisir Buffer dans « Changer » envoie encore par Buffer »).
   Correctif attendu : tant que 4.3 n'est pas tranché, `outilsProposes` ne doit pas rendre Buffer sélectionnable pour un compte Zernio — soit le retirer, soit le renvoyer avec `desactive: true` et un `disabled` sur la case radio (l'option peut rester visible et marquée « outil actuel » pour un compte encore chez Buffer). Ajouter le test correspondant.

2. **4.3 non fait — blocage justifié, à remonter** — `pilotage/journal/L7-06-suite.md:7-9`.
   Vérifié : `tests/zernio/e2e-04-service.test.ts:148,160,175,213,247,327` appellent `envoyerParOutilAction(..., { outil: "buffer" })` et attendent un succès ; un refus serveur les ferait rougir, et ce dossier est interdit. La contradiction des consignes est réelle et bien documentée ; décision à prendre hors de cette PR (adapter e2e-04-service, puis refus `OUTIL_REFUSE` sans effet de bord).

3. **4.5 : rendu non testé** — `tests/publication/l7-06-suite-ancien-outil.test.ts:46-53`.
   Seule la fonction pure `outilsProposes` est testée. Mutation essayée en pensée : remettre `(["zernio"] as const)` dans le composant laisse tous les tests verts (le fieldset est derrière l'état `choix`, invisible au rendu statique). Après le correctif du point 1, tester au moins la fonction qui décide de la sélectionnabilité de Buffer.

4. **4.4 : OK** — `LignesAPublier.tsx:671`, `BlocZernio.tsx:62`, `outil-publication.ts:20`. Mutation exécutée (pastilles remplacées par `false`) : 2 tests rouges sur 5. Tests non tautologiques.

5. **4.6 : OK** — `src/services/routage-publication.ts:69-70`. Mutation exécutée (fichier de master remis) : le test « chemin buffer » rougit (2 lectures au lieu d'1). Le test « chemin zernio » ne discrimine pas la modification (1 lecture avant comme après) mais sert de garde de non-régression, acceptable.

## Contrôles

- Fichiers touchés : `LignesAPublier.tsx`, `BlocZernio.tsx`, `outil-publication.ts`, `routage-publication.ts`, 2 tests neufs dans `tests/publication/`, journal. Conforme (`a-publier-zernio.ts` non modifié, faute de 4.3). Aucun fichier `tests/zernio/**`, `parcours-*.ts`, guide-reseau ni `boucle.ts`.
- Aucun test existant retiré ni affaibli (diff : uniquement des ajouts côté tests).
- Aucun nom de personne dans le diff (seulement « fondateur », un rôle).
- `vitest run tests/publication tests/zernio` sur la tête 24b36ad9 : **194 fichiers, 3110 tests verts, 7 todo, 0 échec**.
- Chemin Zernio par défaut côté serveur (`outilDeEnvoi`) : comportement inchangé, une seule lecture. Le risque est côté interface (point 1).
