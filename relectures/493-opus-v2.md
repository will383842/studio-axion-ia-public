# Relecture PR 493 (L7-06 suite) — seconde lecture, tête 571fc0f5 (ancienne 24b36ad9)

## Verdict : OK — fusion possible telle quelle

Le point bloquant de la première relecture est corrigé : Buffer n'est plus sélectionnable dans « Changer » pour un compte routé chez Zernio. Le 4.3 reste ouvert, mais il est documenté comme bloqué au journal, comme demandé. Rien d'autre n'a bougé.

## Points vérifiés

1. **Buffer non sélectionnable pour un compte Zernio : corrigé.** Voir `src/domaine/outil-publication.ts` (nouvelle fonction `outilSelectionnable`, et `outilsProposes` qui renvoie maintenant `desactive`) et `src/components/publication/LignesAPublier.tsx:691` (`disabled={o.desactive}` sur la case radio).
   - Compte chez Zernio : Buffer reste visible (« ancien outil ») mais il est désactivé.
   - Compte encore chez Buffer : Buffer est sélectionnable et marqué « outil actuel ». Zernio est sélectionnable dans les deux cas.
   - L'état initial `outilChoisi` vaut `null`, donc l'outil par défaut reste `complement.outil` (`LignesAPublier.tsx:325,353`). Aucun autre chemin de l'interface ne pose Buffer pour un compte Zernio.

2. **Test : mutation crédible, oui.** Voir `tests/publication/l7-06-suite-ancien-outil.test.ts`. J'ai lancé les mutations suivantes :
   - `outilSelectionnable` renvoie toujours `true` : **2 tests rouges**.
   - `desactive: false` en dur dans `outilsProposes` : **1 test rouge**.
   - `disabled={o.desactive}` retiré du composant : tous les tests restent verts. Le rendu n'est pas couvert, car le fieldset est derrière l'état `choix`. Ce n'est pas bloquant : la première relecture demandait « au moins la fonction qui décide », et c'est fait. Un test de rendu pourra venir plus tard.

3. **4.3 documenté comme bloqué : oui.** Voir `pilotage/journal/L7-06-suite.md`. Le journal cite `e2e-04-service.test.ts`, lignes 148, 160, 175, 213, 247 et 327. Il indique l'accord nécessaire et l'étape suivante : le refus serveur remplacera le grisage. `src/services/a-publier-zernio.ts` et `tests/zernio/**` ne sont pas modifiés.
   Rappel : côté serveur, `envoyerParOutilAction` accepte toujours `outil: "buffer"`. Une requête fabriquée à la main peut donc encore passer par Buffer. Ce risque est connu, il relève du 4.3 et reste à traiter hors de cette PR.

## Contrôles

- Fichiers touchés par 571fc0f5 : `outil-publication.ts`, `LignesAPublier.tsx`, le test `l7-06-suite-ancien-outil.test.ts` et le journal. Sur l'ensemble de la PR (master...tête) : les 7 mêmes fichiers qu'à la première relecture. Le merge 2b013fd5 n'ajoute rien d'autre au diff.
- Aucun test retiré ni affaibli : les deux attentes existantes gagnent seulement le champ `desactive`, et un test est ajouté.
- Aucun nom de personne dans le diff (seulement « fondateur » et « parcours viral », des rôles).
- `vitest run tests/publication tests/zernio` sur 571fc0f5 : **194 fichiers, 3111 tests verts, 7 todo, 0 échec**.
