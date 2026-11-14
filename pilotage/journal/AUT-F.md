# AUT-F — l'aiguillage d'origine normalise l'origine

Réserve R1 de la relecture de la PR 531 : `verifierEtReserverSelonOrigine` (et donc `depenserSelonOrigine`) comparait l'origine brute à `"usine"` ; une origine `null`, `""`, `"Usine"` ou objet partait en Studio, sans jugement contre le plafond de l'Usine.

## Correctif (`src/services/credits.ts`)
- Aiguillage : `normaliserOrigine(origine) === "usine" ? reserverPourUsine(...) : verifierEtReserver(...)`. Une origine inattendue vaut Usine, jamais Studio.
- `verifierBudgetEtCredits` : `seuilIndicatif` se calcule sur l'origine normalisée (`!usine`).

## Tests
- `tests/l3-0-garde-origine.test.ts` (« reserverPourUsine fixe usine… ») adapté sans l'affaiblir : exige `normaliserOrigine(origine) === "usine" ? reserverPourUsine(`, refuse toute comparaison brute, et vérifie que `depenserSelonOrigine` passe par l'aiguillage. Seul ce test structurel rougissait réellement ; `l3-0-relecture-argent` D n'avait pas besoin d'adaptation (son échec « littéral » existe déjà sur master).
- `tests/autonomie-usine-garde.test.ts` : 5 cas nouveaux (null, « Usine », « », {} → USINE_PLAFOND_ATTEINT sur l'aiguillage et la dépense d'un coup ; sous plafond → accord inscrit ; éteint → BUDGET_USINE_ABSENT ; Studio inchangé ; seuilIndicatif).

## Mutations (rouges puis restaurées ; base = 2 échecs de master)
| Mutation | Échecs |
|---|---|
| aiguillage sans normaliserOrigine | 8 |
| seuilIndicatif sur origine brute | 4 |
| branche autonomie supprimée | 20 |
| inscrire avant controlerCredits | 4 |
| enveloppe dansVerrouCredits retirée | 15 |
| sousPlafond non exclu de BUDGET_USINE_ABSENT | 18 |
| confirme laissé à l'accord reçu | 12 |
| normalisation retirée | 6 |
| reserverLot sans cleUsine | 4 |

## Contrôles
Fichiers ciblés : 267 verts, 3 rouges tous présents sur master (garde-origine cas 2 et 3 ; relecture-argent D « littéral »). Lint des fichiers touchés propre ; tsc : 146 erreurs, identique à master. 0 €.
