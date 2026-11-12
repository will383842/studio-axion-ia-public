# Sans prix — passage 2

Règle de Williams : aucun prix dans le studio, les limites se disent en quantités. Seuls des textes ont changé (aucune condition, aucun calcul, aucun blocage).

## Fichiers modifiés
- `src/domaine/credits.ts` : `messageAlerteCredit` (« Il reste ≈ 8 vidéos restantes. Rechargez votre compte X. », ou « Le crédit X baisse. … » sans estimation) et `messageEpuise` (le « Solde 12,00 $ » devient « Il reste ≈ N … »). `disponibleTexte` reste dans la signature mais n'est plus affiché.
- `src/moteurs/montage-cas-concret/index.ts` : `annonceNouvelEssai` ne dit plus « coûte environ X € » mais « il lance un seul nouvel essai d'écriture » ; import `formaterMontant` retiré (devenu inutile).
- Tests ajustés sans être affaiblis : `tests/alertes-credits-claires.test.ts`, `tests/cas-concret/x12/ecriture-reprise.test.ts`.

## Vérifications
- `npx tsc --noEmit -p .` : 146 erreurs, identiques à `origin/master` (aucune dans les fichiers touchés).
- `npx vitest run tests/alertes-credits-claires.test.ts tests/cas-concret/x12 tests/source-claude` : 14 fichiers, 224 tests passés.

## Points laissés
- `formaterDollars` (credits.ts) et `src/services/credits.ts` (qui fournit `disponibleTexte`) : hors périmètre, non touchés.
- `tests/cas-concret/x12/ecran-relance.test.ts` contient encore « 0,29 € » dans une donnée de test (autre lot, ecran-relance).
