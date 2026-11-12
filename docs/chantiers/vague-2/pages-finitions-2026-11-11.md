# pages-finitions-2026-11-11 — relecture visuelle des pages (code)

Périmètre relu : accueil, vidéos, bibliothèque, personnages, modèles, mesures, veille, nouvelle, et leurs composants (hors fichiers interdits).

## Corrigé
- `src/components/ciblage/FiltresCiblage.tsx` : puces de filtre et lien « anciens » à `min-h-9` (36 px) → `min-h-11` (44 px), cibles tactiles.

## Vérifié, rien à corriger
- Aucune classe de couleur sombre/claire en dur (pas de `text-white`, `bg-black`, gris Tailwind) : les pages utilisent les jetons (`text-texte`, `bg-surface-*`…). Les `#000`/`#fff6ec` de `EcranDecors` et `MaquetteNavigateur` sont des badges sur vignettes (fond sombre voulu).
- Un seul bouton principal par page (vidéos : « Nouvelle » ; veille : deux boutons principaux mais dans des feuilles distinctes, jamais ensemble). L'accueil n'a qu'un gros CTA rond orange.
- Aucun libellé anglais, aucune largeur fixe ≥ 100 px repérée dans les pages.
- Titres : un `h1` par page via `EnTetePage`, pas de doublon repéré.

## Laissé (non osé)
- Pastilles décoratives `size-6/7/9` non cliquables : sans objet.
- `CaseACocher` (case `size-7`) : la ligne fait déjà `min-h-12`, cible OK.
- `src/components/ui/{GroupeFiltres,PuceLien,PucesActives,LienRetour}.tsx` n'existent pas dans master (cités dans la consigne) ; `EnTeteSection` vit dans `EnTetePage.tsx`.
- Débordement à 390 px : relu au code seulement, pas de rendu navigateur lancé.

## Vérifications
- `npx vitest run tests/theme-clair.test.ts tests/ciblage` : 19 fichiers, 156 tests verts.
- `npx tsc --noEmit -p .` : 146 erreurs, dans `tests/` et `docs/` (module `remotion` absent, types de tests), non liées à ce changement ; Les 7 erreurs de `src/` sont des types globaux Next générés (`RouteContext`, `LayoutProps`) absents sans build.
- Note : pas de `package-lock.json` (seulement `pnpm-lock.yaml`), `npm ci` échoue ; installé avec `npm install --no-package-lock`.
