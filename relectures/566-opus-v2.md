# Relecture PR 566 (fiche RC-34) — seconde relecture

**VERDICT : OK — FUSION POSSIBLE** sur la tête complète `294d53a069c646a48827f435106ef28aeebd8a97` (branche usine/RC-34-v2, PR 566, fiche RC-34). Les points 1, 2 et 3 de la première relecture sont corrigés et gardés par des tests qui rougissent sous mutation. Les remarques 4 (sel fixe, HMAC à trancher par le fondateur) et 5 (aucun branchement dans `src/`) restent non bloquantes.

Tête relue : 294d53a069c646a48827f435106ef28aeebd8a97

## Vérifications (au fil de l'eau)
- Tête complète : `git rev-parse origin/usine/RC-34-v2` = 294d53a069c646a48827f435106ef28aeebd8a97 (conforme).
- Fusion avec master a24e3767 : sans conflit ; tests RC-34 : 9/9 verts.
- Mutations (sondes jetables, non poussées), chacune fait rougir un test :
  - purge `brut.filter(estSignature)` remise → rouge (test « lignes non conformes conservées ») ✔ point 2 ;
  - garde « non liste » retirée (écrasement) → rouge (test « valeur non liste jamais écrasée ») ✔ point 1 ;
  - rétrogradation de l'état remise → rouge (test « rejeu planifie après publie ») ✔ point 3 ;
  - texte en clair rangé → rouge ✔ ; axes non hachés → rouge ✔.
- Point 1 : src/services/stock-signatures.ts:84-87 refuse d'écrire (retour faux + console.error) si la valeur existante n'est pas une liste ; test tests/rc-34-stock-signatures.test.ts:76-87 (objet et chaîne gardés intacts).
- Point 2 : ligne 88 copie la liste entière (`[...brut]`) ; test lignes 89-99 (`[{ancien:"format"}, 42]` conservées après ajout et après passage à « publié »).
- Point 3 : ligne 92 ne passe que de « planifié » à « publié » ; test lignes 101-107.
- Jamais de suppression : aucune fonction d'effacement exportée, aucune ligne retirée, aucune valeur écrasée.
- Texte en clair jamais stocké : seuls des SHA-256 (axes, signature) sont rangés ; mutation « texte rangé » → rouge.
- Diff (trois points depuis master) : 2 fichiers, tous deux autorisés (src/services/stock-signatures.ts, tests/rc-34-stock-signatures.test.ts). memoire-centrale.ts et memoire-ecriture.ts non modifiés. scripts/echecs-connus.json inchangé.
- tsc : 146 erreurs sur master a24e3767, les 146 mêmes (même liste) sur l'arbre fusionné : aucune régression. eslint sur les 2 fichiers : propre.
- Aucun nom de personne dans le diff ni dans les messages de commit.
- Sondes et fusion faites dans des arbres jetables, rien n'a été poussé sur la branche relue.
