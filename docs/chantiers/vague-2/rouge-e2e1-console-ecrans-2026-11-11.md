# Test rouge e2e1-console-ecrans, cas n° 21

**Cause** : test périmé. Il cherchait `{ id: "…", libelle: "…" }` dans `reglages/page.tsx`, mais depuis #257 (150849e2) les pastilles
viennent de `reglages/rubriques.ts` (`RUBRIQUES`), et la page lit ce même tableau pour la rangée de liens ET pour les titres h2.
Le code est correct (les noms sont identiques par construction) ; il n'y avait donc aucun défaut à corriger.

**Fichier touché** : `tests/e2e1-console-ecrans.test.ts` (cas n° 21 seul). Il vérifie maintenant que les rubriques de `rubriques.ts`
sont toutes affichées par la page, que la pastille et le h2 lisent le même `r.libelle`. Rien n'est affaibli.

**Résultat** : `e2e1-console-ecrans` 43/43 verts. `npx tsc --noEmit -p .` : erreurs déjà présentes sur master dans `tests/zernio/*`
(hors périmètre, aucune dans le fichier modifié).

**Laissé** : rien.
