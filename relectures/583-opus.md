# Relecture PR 583 (fiche L6-06) — relecteur Opus

**VERDICT : À CORRIGER** — tête complète relue : `5c5f047aa730112a1fc4b61cc59d1aec3e97b668` (branche `usine/L6-06`, à jour de `master` be7d73c8).

## Corrections demandées

1. **`src/app/api/usine/visuels/route.ts:52-60` — MAJEURE : aucun « refus propre budget_epuise ».**
   La fiche (Contexte : « Route protégée ; refus propre budget_epuise ») et la consigne de relecture l'exigent. La route ne lit jamais le budget de l'usine.
   Sonde jetable : budget de l'usine du mois à 0 et plafond du studio à 0 → **201 `{"etat":"recue"}`** ; aucun budget reçu pour le mois → **201** aussi.
   Le passage commun (`controlerBudgetDuMois`, `src/services/budget-mensuel.ts`) refuserait pourtant l'origine usine (`BUDGET_MENSUEL_ATTEINT`, `BUDGET_USINE_ABSENT`).
   Attendu : un refus propre (code `budget_epuise`, sans montant, jamais 402) avant toute réservation de quota. Comme `budget-mensuel.ts` est hors des fichiers autorisés, il faut seulement LIRE le budget (`lireBudgetUsine` / `plafondStudioCentimes`) depuis la route, puis ajouter le test qui couvre ce cas.

2. **`src/app/api/usine/visuels/route.ts:52` — MAJEURE : un couple réseau/type sans quota passe sans aucune borne.**
   `reserverQuota` rend une réservation vide quand aucun quota ne couvre le couple. La route accepte alors sans limite. Sonde : 200 commandes `tiktok`/`video` d'affilée → **200 × 201**.
   Cela contredit la règle du dépôt pour l'origine usine : « jamais "passe" par défaut » (`BUDGET_USINE_SANS_BORNE` dans `budget-mensuel.ts`).
   Attendu : refus propre (ou mise de côté) quand aucune borne ne s'applique, avec un test. Les tests actuels écrivent toujours un quota pour `instagram/image` et ne couvrent pas ce cas.

3. **`tests/usine-visuels-route.test.ts:64-113` — MOYENNE : les tests ne couvrent ni le budget épuisé ni l'absence de quota pour le couple.** Ils sont à ajouter avec les points 1 et 2.

4. **Procédure — MOYENNE, à trancher par le fondateur.** La fiche porte toujours `statut: suspendu` et `attend_decision` (quantités à fixer dans l'usine), avec la consigne « Ne pas lancer avant la réponse ». La PR le reconnaît. Ne pas fusionner sans décision écrite levant la suspension.

5. **`src/app/api/usine/visuels/route.ts:52` — MINEURE.** Une unité de quota est consommée (clé `visuel:<cle>`) dès la commande enregistrée. Aucun consommateur de `usine-visuel-commande:*` n'existe encore, et la fabrication en aval réserve avec une autre clé (`budget:<travailId>`). Il y a donc un risque de double décompte quand le branchement viendra : le documenter, ou réutiliser la même clé.

## Points vérifiés conformes
- Sans jeton : **401** (sonde) ; mauvais jeton 401 ; porte éteinte 404 ; « Tout arrêter » 423 sans écriture.
- Quota du mois/jour/semaine atteint (origine usine) : `quota_atteint`. Conformément au CORRECTIF du 11/11 (qui l'emporte), l'excédent est **mis de côté (202)**, jamais refusé. Aucun appel au fournisseur (fetch espionné : 0 appel).
- Aucun montant dans les réponses (400/426/201/202 sondés) ; jamais de 402 ; champ `montant` refusé (400).
- Fondateur jamais bloqué : la route force l'origine « usine » ; l'origine « studio » passe dans `reserverQuota` (sonde : passe malgré quota atteint).
- Aucun appel réel (fournisseur, réseau) dans le code ni les tests ; aucune suppression.
- Fichiers touchés : exactement les deux fichiers nouveaux autorisés (`src/services/budget-mensuel.ts`, cité dans « À faire », non touché).
- `scripts/echecs-connus.json` inchangé ; aucun nom de personne dans le diff.
- Tests ciblés : 9/9 verts en local ; eslint propre ; tsc sans erreur sur ces fichiers.
- Contrôles GitHub : 9/9 verts sur la tête 5c5f047a.

Sondes jetables exécutées puis supprimées, rien poussé hors de ce fichier.
