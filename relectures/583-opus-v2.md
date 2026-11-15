# Relecture PR 583 (fiche L6-06) — relecteur Opus, seconde relecture

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `b8dc38ed90c14a10b8c536e14d2c6b02174d4566`** (branche `usine/L6-06`, vérifiée par `git rev-parse origin/usine/L6-06`).

Point 4 (statut `suspendu` de la fiche) : hors verdict, laissé au pilotage comme demandé.

## Points du premier verdict (`relectures/583-opus.md`, tête 5c5f047a)

1. **Refus propre `budget_epuise` — RÉSOLU.** `src/app/api/usine/visuels/route.ts:58-66` : simple lecture (`lireBudgetUsine`, `plafondStudioCentimes`, `resumeBudget`), avant toute réservation de quota ; `budget-mensuel.ts` n'est pas touché. Sondes jetables :
   - aucun budget reçu → 409 `budget_epuise` ; budget d'un autre mois → 409 ;
   - budget de l'usine à 0 seul (sans plafond du studio) → 409 `{"erreur":"Le budget du mois est épuisé : la commande n'est pas prise.","code":"budget_epuise"}`, sans montant ;
   - plafond du studio à 0 seul (budget en quantités) → 409 ;
   - budget positif non atteint → 201 ; plafond illisible → refus (500 `erreur_interne`, échec fermé, aucune écriture).
   - Aucune unité de quota consommée sur un refus de budget : couvert par le test `tests/usine-visuels-route.test.ts:82-93`.
2. **Couple réseau/type sans quota — RÉSOLU (échec fermé).** `route.ts:67-71` : 422 `quota_absent`. Sonde : 200 commandes `tiktok`/`video` d'affilée → 60 × 422 puis 140 × 429 (limite de 60 appels par minute de la porte). Aucun 201, rien n'est écrit (`usine-visuel-commande:*` et `usine-visuel-cote:*` vides), 0 appel à `fetch`. Sans quotas enregistrés (quotas par défaut `fal/*`), `instagram/image` est aussi refusé en 422.
3. **Tests — RÉSOLU.** Trois tests ajoutés (`tests/usine-visuels-route.test.ts:70-103`) : budget absent, budget à zéro et plafond à zéro (sans consommation de quota), couple sans quota. 12/12 verts en local, et aussi 12/12 sur la fusion d'essai avec le `master` actuel.
5. **Double décompte — RÉSOLU (documenté).** `route.ts:19-20` : le commentaire indique la clé `visuel:<cle>` et la clé aval `budget:<travailId>`, avec la consigne de réutiliser la même clé au branchement.

## Contrôles toujours conformes
- Sans jeton : 401 (sonde et test).
- Quota atteint : 202 `quota_atteint`, excédent mis de côté, aucun appel au fournisseur (`fetch` espionné : 0 appel).
- Aucun montant dans les réponses, jamais de 402.
- Le fondateur n'est jamais bloqué : la route force l'origine « usine » ; aucun service partagé n'est modifié.
- Aucun appel réel, aucune suppression.
- Diff limité aux 2 fichiers autorisés : `src/app/api/usine/visuels/route.ts` et `tests/usine-visuels-route.test.ts`.
- `scripts/echecs-connus.json` inchangé. Aucun nom de personne dans le diff.
- eslint propre ; tsc sans erreur sur ces fichiers.
- Contrôles GitHub : 9/9 terminés et verts sur `b8dc38ed` (dont « eslint et tsc différentiels », terminé à 10:28 UTC).

## Remarques non bloquantes
- `master` a avancé depuis la base de la PR (be7d73c8 → 888e5a4a, #584 et #590). Ces commits ne touchent aucun des services utilisés par la route. La fusion d'essai passe sans conflit et les tests restent verts.
- La description de la PR annonce encore « 9 passent » : il y en a maintenant 12. La PR est toujours en brouillon.

Sondes jetables exécutées puis supprimées. Rien n'est poussé en dehors de ce fichier.
