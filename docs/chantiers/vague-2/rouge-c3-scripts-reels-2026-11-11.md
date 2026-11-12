# rouge-c3-scripts-reels-2026-11-11

**Cause.** Sur `origin/master`, le cas B9 de `tests/c3-scripts-reels.test.ts` est vert (ses vérifications de texte sur `FicheSujet.tsx` et `ecrire/sujets/[id]/page.tsx` passent). Le seul échec constaté est un dépassement de délai (5 s par défaut de vitest) du cas B1 « le texte d'une version écrite par le générateur revient dans la vidéo » : il lance la vraie boucle de génération et dure 5,8 à 6,2 s. Le code n'est pas fautif, le test était trop juste.

**Correction.** Délai explicite de 30 s sur ce seul cas (aucune assertion changée ni retirée). Fichier touché : `tests/c3-scripts-reels.test.ts`.

**Résultat.** `tests/c3-scripts-reels.test.ts` : 14/14 verts. `npx tsc --noEmit -p .` : 146 erreurs déjà présentes sur master (par ex. dans `tests/zernio/*`), aucune dans le fichier touché. Installation par `pnpm install --frozen-lockfile` (pas de package-lock : `npm ci` ne marche pas). Les autres tests du dossier n'ont pas été relancés en entier (suite complète trop longue).

**Points laissés.** B9 dépend de textes de `src/components/generateur/FicheSujet.tsx` et de `src/app/(studio)/ecrire/sujets/[id]/page.tsx` (fichiers du lot « sans prix », interdits) : si ce lot modifie ces chaînes, B9 devra être relu à ce moment-là.
