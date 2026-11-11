# Échecs connus et CI des nouveaux tests

La suite complète est trop longue pour la CI d'une PR. Le workflow `tests-nouveau.yml` lance donc seulement les fichiers de test
**ajoutés ou modifiés** par la PR (dossier existant, nouveau dossier ou racine de `tests/`) et compare leurs échecs à
`scripts/echecs-connus.json` avec `scripts/comparer-echecs.mjs`.

- Un échec absent de la liste : **rouge** (la PR est bloquée).
- Un échec présent dans la liste : toléré, affiché « connu ».
- Un échec de la liste qui passe maintenant : signalé « corrigé », à retirer de la liste dans une PR dédiée.
- Le script imprime toujours « N tests lancés » ; zéro test lancé est rouge si des fichiers étaient à lancer.

Format : `{ "version": 1, "echecs": [{ "fichier": "tests/x.test.ts", "nom": "titre complet du test" }] }`.
Un fichier qui plante avant tout test s'écrit avec `"nom": "(fichier)"`.

La liste est vide au départ : l'inventaire des échecs de `master` se fait dans le cloud, fichier par fichier, jamais sur un poste.
`tests-cibles.yml` et `tests-visuels.yml` ne sont pas modifiés.

Essai à la main :
`pnpm exec vitest run --reporter=json --outputFile=rapport.json <fichiers>` puis `node scripts/comparer-echecs.mjs rapport.json`.
