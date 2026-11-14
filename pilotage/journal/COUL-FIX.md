# COUL-FIX : test coul-01-jetons rouge sur master

## Cause
Le test `tests/visuels/coul-01-jetons` (garde de l'orange) est rouge : 294 usages de classes orange / lueur dans `src/` pour un plafond de 293 (`ORANGE_MAX`, « ne peut que baisser »).
Ce n'est pas l'attendu qui a changé (dernier changement du test : #444) ni les jetons (`globals.css`) : c'est le **code** qui a régressé.

Le surplus vient de `src/components/calendrier/VueAgenda.tsx` (ajouté par #474, CAL-12b) :
- ligne 103 : `border-orange` sur le jour courant ;
- ligne 105 : `text-orange-vif` sur le titre du jour courant.
Ces 2 usages sont arrivés pendant que `calendrier/page.tsx` en perdait 1 (branchement CAL-13b/14P0) : net +1, le plafond 293 est dépassé.

## Décision
La charte 2026 réserve l'orange au seul bouton principal. Le test ne doit pas être assoupli (pas de relèvement de `ORANGE_MAX`, pas de `.skip`).
Correctif attendu, minimal : dans `VueAgenda.tsx`, `border-orange` → `border-accent` et `text-orange-vif` → `text-accent` (classes déjà utilisées partout dans `src/`). Le compte retombe à 292 (≤ 293).

## Pourquoi ce correctif n'est pas dans cette PR
La fiche n'autorise à modifier que `tests/visuels/coul-01-jetons*`, le fichier de jetons et ce journal. `VueAgenda.tsx` est hors périmètre, et relever le plafond reviendrait à affaiblir le test. La correction est donc laissée à validation du propriétaire (2 classes, une ligne chacune).

## Preuve
`pnpm vitest run tests/visuels/coul-01-jetons` sur master : 1 échec sur 118, `expected 294 to be less than or equal to 293`.
