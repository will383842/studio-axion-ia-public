# rouge-final-b-mobile — cas n° 10

**Cause** : test périmé. Les chiffres de la fiche vidéo (`<li key={c.libelle} className="min-w-0">` et la ligne `flex flex-wrap …`) ont été sortis de `videos/[id]/page.tsx` vers `src/components/fabrication/ChiffresVideo.tsx` (refonte #304). Le code garde bien les classes qui font passer le texte à la ligne ; seul le fichier lu par le test avait changé.

**Fichier touché** : `tests/final-b-mobile.test.ts` (le cas n° 10 lit maintenant `ChiffresVideo.tsx`, mêmes assertions, aucune affaiblie).

**Résultat** : `tests/final-b-mobile.test.ts` 10/10 vert. `npx tsc --noEmit -p .` : une seule erreur, préexistante et sans rapport (`tests/zernio/pv3-mots.test.ts:268`).

**Points laissés** : aucun. Installation faite avec `pnpm install --frozen-lockfile` (le dépôt n'a pas de package-lock, `npm ci` ne marche pas).
