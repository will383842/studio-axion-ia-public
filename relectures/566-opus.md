# Relecture PR 566 — fiche RC-34

**VERDICT : À CORRIGER** (tête complète examinée : `4421eee8ba400d31c4cac281048848924b54bb3b`, branche usine/RC-34-v2). Le code remplit les critères ; les corrections portent sur le critère « jamais de suppression », mal gardé par les tests et non tenu sur un cas limite.

1. **src/services/stock-signatures.ts:83 — gravité MOYENNE (critère « jamais de suppression »).** Si la clé `stock.signatures` contient une valeur qui n'est pas une liste (ex. un objet), la première écriture l'écrase sans trace. Sonde : `{objet:"inconnu"}` rangé, puis `rangerSignatureStock` → la valeur a disparu. Correction attendue : refuser d'écrire (retourner faux et journaliser) au lieu d'écraser, ou mettre l'ancienne valeur de côté ; ajouter un test.
2. **tests/rc-34-stock-signatures.test.ts:65-73 — gravité MOYENNE (le test ne garde pas le critère).** La mutation `Array.isArray(brut) ? brut.filter(estSignature) : []` (ligne 83) purge toutes les lignes non conformes de la liste, et **les 6 tests restent verts**. Il faut un test qui range des lignes étrangères (ex. `[{ancien:"format"}, 42]`), écrit une signature, puis vérifie que les lignes sont toujours là.
3. **tests/rc-34-stock-signatures.test.ts:65-70 — gravité MINEURE.** La mutation de la ligne 87 qui laisse revenir « publié » à « planifié » survit aussi. Ajouter un rejeu « planifie » après « publie » et vérifier que l'état reste « publie ».
4. **Remarque (sans blocage) — src/services/stock-signatures.ts:45.** Chaque racine est hachée seule, avec un sel fixe écrit dans le code public (`rc34|`). Un dictionnaire de mots français suffit pour retrouver les racines. Le critère « seule l'empreinte hachée est stockée » est respecté à la lettre ; une clé secrète (HMAC avec un secret d'environnement) serait plus sûre. À trancher par le fondateur.
5. **Remarque — aucun branchement.** Rien dans `src/` n'appelle `ecarterSujetsProches` / `rangerSignatureStock` : le filtre ne s'applique encore à aucun parcours réel. C'est cohérent avec la fiche (2 fichiers autorisés), mais le branchement reste à faire dans une autre fiche.

## Vérifications faites
- Diff de la PR (trois points depuis la base 98af97a5) : 2 fichiers, tous deux autorisés. memoire-centrale.ts et memoire-ecriture.ts ne sont pas touchés. scripts/echecs-connus.json n'est pas touché. Aucun nom de personne dans le diff ni dans le message du commit.
- Fusion avec master f98e77a5 : aucun conflit. Tests RC-34 sur l'arbre fusionné : 6/6 verts.
- tsc : 146 erreurs sur master et les 146 mêmes après fusion (aucune nouvelle). eslint sur les 2 fichiers : propre.
- Sondes jetables (non poussées) :
  - stockage inspecté : {id, axes[hex 64], signature[hex 64], etat, date}, aucun mot en clair, `cle` en clair non rangée ;
  - 61 messages : le plus ancien est toujours écarté ;
  - mémoire centrale coupée, puis allumée : l'écart est maintenu ;
  - `fetch` n'est jamais appelé ;
  - les lignes étrangères d'une liste sont conservées par le code actuel ;
  - « publié » n'est jamais rétrogradé.
- Mutations faites à la main (le test doit passer au rouge) : texte brut rangé → rouge ✔ ; axes non hachés → rouge ✔ ; signature non hachée → rouge ✔ ; fenêtre de 60 → rouge ✔ ; dépendance à la mémoire centrale → rouge ✔ ; envoi réseau → rouge ✔ ; liste vidée → rouge ✔ ; garder 10 lignes → rouge ✔ ; **purge des lignes non conformes → VERT ✘ (point 2)** ; **rétrogradation → VERT ✘ (point 3)**.
