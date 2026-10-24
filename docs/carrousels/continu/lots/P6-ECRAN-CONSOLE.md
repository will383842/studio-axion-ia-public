# P6 — Écran du générateur (section 4 de la maquette) : branche `carrousels/continu-p6` (après P4, P4b, P5, P7)
Lis d'abord `node_modules/next/dist/docs/` (routes, server actions, `after`). Classes Tailwind du thème seulement (test `couleurs-theme-seulement`).
## Routes (`src/app/(studio)/carrousels/continus/`)
`page.tsx` (liste, onglets `OngletsCarrousels` avec `base="/carrousels/continus"`), `actions.ts`, `nouveau/page.tsx` + `nouveau/actions.ts` (création puis `after(lancerRenduToile)`, `redirect`), `[id]/page.tsx` + `[id]/actions.ts`. Chaque action commence par `exigerSession()`. Bouton « Carrousels continus » sur `src/app/(studio)/carrousels/page.tsx`.
## Composants (`src/components/visuels/continu/`)
- Formulaire, colonne sombre :
  - Sujet (3-200 signes, sans lien) et Intention (facultative) ;
  - Réseaux : puces Instagram et Facebook cochées, LinkedIn grisé « V2 » ;
  - Parcours : « Choisi par le studio » ou l'un des 8 ;
  - Plaquettes autorisées : puces des 6 familles ; Variété : 3 crans ;
  - Format : 4:5, ou 3:4 avec avertissement ; Pages : Auto ou 3…10 ;
  - Dépôt d'un texte de session (zone + fichier) et bouton « Copier la consigne ».
- Fiche : « Aperçu · N pages · L × H » ; bande des pages côte à côte, coutures visibles (case) ; simulateur téléphone à défilement par aimant (modèle `.ig .scr` de la maquette) avec la case « Zones sûres de la page 1 » ; encart « À corriger avant de valider » (phrases de la porte et des mesures) ; texte du post prêt à relire (copier) ; textes alternatifs.
- Note /100 + liste des critères. Le bouton Valider est désactivé sous 85, avec une phrase.
- Boutons Valider / Refaire / Refuser (motif) / Corbeille / Restaurer ; ZIP ; bandeau générateur éteint (`BandeauGenerateurEteint`).
- Aucun texte de l'interface ne nomme une personne. On écrit « présentable », jamais « présentable à … ».
## À modifier
`tests/visuels/garde-acces-carrousels.test.ts` : nouvelles listes attendues (6 actions, 6 pages), même règle `exigerSession`.
## Tests et preuves
- Tests de rendu des composants (modèle `ui1-fiche.test.ts`, `visionneuse-pages.test.ts`).
- Essai de bout en bout avec le studio en mode mémoire et un faux rendu (lire `playwright.ui.config.ts` et les tests existants de `test:e2e-ui`), captures dans un onglet NEUF : création, porte orange, rendu, fiche, téléphone, ZIP, Valider, Refuser avec motif, Refaire, Corbeille et Restaurer, générateur éteint.
- Captures jointes à la PR.
