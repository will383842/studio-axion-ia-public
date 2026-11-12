# Test rouge `bandeau-generateur` (11/11/2026)

**Fichier de test** : `tests/bandeau-generateur.test.ts` (2 échecs sur master). Les deux tests étaient périmés ; le code est correct.

## Causes
1. `tutoriel-outil : nom court…` : le rendu HTML statique écrit l'apostrophe sous la forme `&#x27;`, donc « Tutoriel d'outil » n'était pas trouvé tel quel. Le bandeau est correct ; la comparaison ne tenait pas compte de l'échappement HTML.
2. `le bandeau est placé avant la grille…` : la PR #304 (cf7965a1) a déplacé la mise en page de `videos/[id]/page.tsx` vers `GabaritFicheVideo`. La page lui passe désormais `bandeau={<BandeauGenerateur …/>}` à côté de `retour` (« Mes vidéos »). Le marqueur `lg:grid-cols-[minmax(0,420px)` n'est plus dans la page, mais dans le gabarit, qui place `retour` et `bandeau` au-dessus de la grille.

## Fichiers touchés
- `tests/bandeau-generateur.test.ts` : le nom attendu est échappé comme le fait React ; le test d'ordre vérifie la page (`bandeau=` après `retour=`) et le gabarit (zone du haut avant la grille).
- Aucun fichier de `src/` modifié (la page `videos/[id]/page.tsx` est interdite).

## Résultats
- `npx vitest run tests/bandeau-generateur.test.ts` : 23/23 passent.
- `npx tsc --noEmit -p .` : 146 erreurs déjà présentes sur master, dans d'autres fichiers de test (par ex. `tests/zernio/*`), aucune dans `bandeau-generateur`.
- Suite `tests/` complète : voir le dernier commentaire du commit si elle a fini.

## Points laissés
- Les erreurs `tsc` des tests `zernio` (hors périmètre).
- `npm ci` échoue (pas de `package-lock.json`, le dépôt utilise `pnpm-lock.yaml`) : installation faite avec `npm install --no-package-lock`.
