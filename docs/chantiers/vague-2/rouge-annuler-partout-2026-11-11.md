# rouge-annuler-partout-2026-11-11

**Cause** : la garde « aucun autre écran avec un geste de reprise ou d'arrêt » repère `onReessayer=` par expression régulière. `src/components/reglages/Connexions.tsx` (arrivé avec #251) a un « Réessayer » qui recharge la liste des comptes reliés : ce n'est pas le suivi d'une vidéo, il n'y a rien à annuler. Le code est correct ; la garde n'avait pas ce cas. `BoutonAnnuler.tsx` n'est pas en cause.

**Fichier touché** : `tests/harmonisation/annuler-partout.test.ts` — Connexions.tsx ajouté à `EXCEPTIONS` avec sa raison écrite ; plafond « les exceptions ne grossissent pas » passé de 7 à 8 (une exception de plus, justifiée).

**Résultats** : `annuler-partout.test.ts` 25/25 verts. Dossier `tests/harmonisation` : 221/222, reste `image-video-adaptateurs.test.ts` (Depot / BarreActionCollee), déjà rouge sur master, sans lien (fichier interdit `image-video/Fabrication.tsx`). `npx tsc --noEmit -p .` : 146 erreurs déjà présentes sur master, dans `tests/zernio/*` entre autres, aucune dans les fichiers touchés.

**Points laissés** : le test `image-video-adaptateurs` rouge ; les erreurs tsc des tests zernio.
