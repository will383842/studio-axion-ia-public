# Test rouge s1-reglages-ui

- **Cause** : test périmé. Il exigeait « Sur le site » juste après « Votre site » dans une liste `{ id, libelle }` de `reglages/page.tsx`. Depuis #257 (150849e2), les rubriques vivent dans `rubriques.ts` et « Sur le site » est une carte de la rubrique « Publication » (« Votre site » est dans « Services reliés »). Le code est voulu ainsi, aucun défaut.
- **Fichier touché** : `tests/site-videos/s1-reglages-ui.test.ts` seulement (le test vérifie maintenant : carte unique, dans la rubrique Publication, après « Envoi programmé »). Rien modifié sous `src/`.
- **Résultat** : `tests/site-videos` : 33 fichiers, 278 tests verts.
- `npx tsc --noEmit -p .` : une erreur déjà présente sur master, hors périmètre : `tests/zernio/pv3-mots.test.ts(268,36)` TS2345.
- **Points laissés** : l'erreur tsc ci-dessus. Note : le dépôt utilise pnpm (pas de package-lock), `npm ci` échoue ; `pnpm install --frozen-lockfile` fonctionne.
