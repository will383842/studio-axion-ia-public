# Rapport — test rouge `garde-ecran` (branche rouge-garde-ecran-2026-11-11)

## Cause
Le test est juste, c'est le code qui était fautif : 20 textes visibles par Will contenaient du jargon (mot « simulation », identifiant interne, code HTTP, message brut d'exception, variable d'environnement).

## Corrigé (13 textes, texte seulement)
- `src/components/migration/EcranMigration.tsx` (×2), `src/components/visuels/{FormulaireNouveauCarrousel,MessagesFiche}.tsx`, `src/visuels/texte/simulation.ts` : « simulation » → « essai » (et retrait d'un montant « 0 $ »).
- `src/moteurs/montage-image-video/{assemblage,secours}.ts`, `src/moteurs/montage-tutoriel-outil/index.ts`, `src/services/depense-claude-video.ts`, `src/services/import-buffer/lire-buffer.ts`, `src/usine/garde-porte.ts` : plus d'identifiant, de code HTTP ni de message brut.
- Test mis à jour : `tests/zernio/z3m-migration.test.tsx` (« Mode simulation » → « Mode essai »).

## Laissé (fichiers interdits) — 7 constats restants, le test reste rouge
- `src/components/mots/etat-mots.ts:20` et `:46` : remplacer « simulation » par « essai » (« Éteint : essai seulement », « Éteint : rien n'a été envoyé (essai). »).
- `src/services/budget-mensuel.ts:140` : le message journalisé interpole `${motif}` ; ne mettre que `message` (motif en console.warn).
- `src/services/parcours-mot.ts:58` : la constante `SITE_GUIDES_RESEAU_SECRET` est vue comme texte affiché ; ligne 357 : message d'alerte citant `GUIDES_RESEAU_HMAC_SECRET` et « (401) » → dire « le site refuse la signature : vérifier la clé partagée dans Réglages > Connexions » et mettre le détail en console.warn.
- `src/services/zernio.ts:85` : `${erreur.message}` dans le journal → phrase simple (« Zernio ne répond pas pour la lecture des comptes »), détail en console.warn.

## Résultats
- `npx tsc --noEmit -p .` : erreurs seulement dans `tests/zernio/pv2-t2-format-reel.test.ts` et `pv3-mots.test.ts` (déjà présentes, hors fichiers touchés).
- `garde-ecran` : 7 constats restants, tous dans des fichiers interdits (6 tests sur 6 verts sauf le test de balayage).
- Tests `tests/zernio`, `porte-usine-garde-budget`, `garde-fous-budget` : tout vert sauf `garde-fous-budget` « le message d'attente ne promet plus de reprise » — rouge déjà sur origin/master, sans lien (non traité).
- Installation : le dépôt utilise pnpm (`pnpm install --frozen-lockfile`), pas de package-lock : `npm ci` échoue.
