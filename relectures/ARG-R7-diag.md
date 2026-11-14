# ARG-R7 — diagnostic du test rouge `tests/r7-double-heygen.test.ts`

## VERDICT : A — la règle est VOULUE, le test est PÉRIMÉ (pas de régression)

Le test exige qu'un double réel HeyGen demande la confirmation du prix pour une commande du studio. Le fondateur a supprimé
par écrit toute confirmation de prix pour le studio ; le code applique cette décision. Pour l'Usine, la confirmation du double réel
est TOUJOURS exigée (vérifié, voir § 4). Proposition ci-dessous : réaligner l'attendu (jamais de skip).

Relecture faite sur `origin/master` = `242b6f8d` (14/11/2026), en lecture seule. Aucun code ni test du dépôt modifié.

## 1. Échec exact

`pnpm install --frozen-lockfile && pnpm vitest run tests/r7-double-heygen.test.ts` → 1 échec, 18 réussis :

```
FAIL garde-fous de dépense du double réel > ROUGE — confirmation : un double réel exige TOUJOURS la confirmation du prix, même sous le seuil
AssertionError: promise resolved "undefined" instead of rejecting
 ❯ tests/r7-double-heygen.test.ts:393:80
```

`tests/r7-double-heygen.test.ts:393` appelle `verifierBudgetEtCredits(estimation, undefined, "Cette vidéo")` (double heygen à
1,50 €, SANS `origine`, donc commande du studio) et attend `CONFIRMATION_REQUISE`. L'appel réussit.

Chemin dans le code :
- `src/services/credits.ts:326-334` — « Règle « le prix ne bloque jamais » : en mode indicatif (commande de l'utilisateur), le prix
  du jour vaut accord, y compris pour le double réel ». `accordAutomatique(accordRecu=false, 150, { origine: undefined })`.
- `src/services/mode-budget.ts:28-30` — `modeBudget()` rend TOUJOURS `"indicatif"` (plus de réglage ni de variable).
- `src/services/mode-budget.ts:34-36` — `budgetIndicatifPour(undefined)` = vrai (seule l'Usine reste bloquante).
- `src/services/mode-budget.ts:121-127` — l'accord devient le montant (150 centimes) ; journal « Prix 1,50 € accepté sans
  confirmation » + cloche (une fois par jour et par sujet).
- `src/services/credits.ts:348-353` — la garde R7 voit `accordCouvre(150, 0, seuil)` = vrai → ne lève rien.
- `vitest.config.mts:18-20` — la config des tests pose encore `STUDIO_BUDGET_MODE_DEFAUT: "bloquant"`, variable que le code
  IGNORE depuis le 08/11 : c'est pourquoi ce test (et d'autres, § 5) décrit encore l'ancien mode bloquant.

## 2. Quel commit a introduit la règle, et quand le test est devenu rouge

| Date | Commit / PR | Effet |
|---|---|---|
| 23/10 | `de44daf4` (version publique) | le test R7 « confirmation TOUJOURS » existe ; mode bloquant possible |
| 25/10 | `a58b7434` (#64) « Prix non bloquant, lot 1 : socle serveur (accord automatique en mode indicatif) » | introduit `accordAutomatique` et la règle « le prix ne bloque jamais » dans `credits.ts` / `mode-budget.ts`. Le test reste VERT car la config des tests force le mode bloquant |
| 25-26/10 | #65 à #70, #82, #83 | lots « prix non bloquant » suivants |
| **08/11** | **`5ce87f55` (#240) « feat(blocages): blocages restants levés »** | `modeBudget()` rend toujours « indicatif » ; la variable `STUDIO_BUDGET_MODE_DEFAUT` n'a plus d'effet → **le test passe au ROUGE ici** |
| 11/11 | `c42f816a` (#286) | touche le fichier de test sans changer ce cas |
| 14/11 | `b6ec49ed` (#481) « NEW-ARG-04 : le Studio ne bloque jamais pour un prix » | confirme la règle (en-tête de `mode-budget.ts`) |

Preuve par exécution (copies jetables, mêmes dépendances) : à `5ce87f55~1` → `Tests 15 passed (15)` ; à `5ce87f55` → ce même
test échoue (`1 failed | 14 passed`). Le dépôt local était superficiel : historique complété par `git fetch --unshallow`.

## 3. Décision écrite du fondateur

Trouvée, écrite, et répétée :
- `src/services/mode-budget.ts:28` — décision du fondateur du **08/11/2026** : « le budget est inopérant. Le mode « bloquant »
  n'existe plus : ni réglage, ni variable ne le rétablit ».
- `src/services/mode-budget.ts:2-12` — décision du 23/10 (mode indicatif), « Plus aucun arrêt pour un prix (NEW-ARG-04) » ;
  « Le double réel et le montage réel, eux, suivent le mode : en indicatif, le prix du jour vaut accord » ; 25/10 : plus aucun clic
  de confirmation à l'écran.
- `docs/blocages-inventaire.md:27` — « plus de `CONFIRMATION_REQUISE` ni de `BUDGET_DEPASSE` pour une commande » du fondateur ;
  `:35` — mode bloquant supprimé, « Les anciens tests de ce mode sont réécrits » (celui-ci a été oublié) ; `:37` — « plus aucune
  confirmation […] l'accord du prix du jour est automatique ».
- `pilotage/REGLES-DE-FER.md:9` — « Aucun prix affiché ni bloquant » (ajouté le 12/11, `f858a8cd`).
- `pilotage/annonces/ANNONCE-NEW-ARG-01-prix.md:3` — décision du 12/11/2026 : aucun prix ni montant affiché dans le Studio.

Réserve d'exactitude : je n'ai trouvé AUCUN écrit daté précisément du **11/11** sur le prix (les « CORRECTIF 11/11 » de
`pilotage/journal/` portent sur d'autres sujets). La décision écrite est datée du 08/11 (code + inventaire), confirmée le 12/11
(règles de fer) et le 14/11 (#481). Le fond est le même : plus de plafond d'argent ni de confirmation de prix pour le studio.

## 4. Pourquoi ce n'est PAS une régression (B écarté)

Un double réel HeyGen part bien sans clic de confirmation du prix pour une commande du studio : c'est exactement la décision.
Ce qui reste dur (vérifié dans le code) :
- **Usine** : `budgetIndicatifPour("usine")` = faux (`mode-budget.ts:34-36`) → `accordAutomatique` rend l'accord inchangé →
  la garde R7 (`credits.ts:348-353`) lève `CONFIRMATION_REQUISE` « Votre avatar parle dans cette vidéo : environ 1,50 €, à
  confirmer. » Vérifié par exécution (attendu réaligné ci-dessous, vert), et **discriminant** : garde R7 neutralisée dans une
  copie jetable → l'attendu réaligné devient rouge.
- **Origine illisible** traitée comme l'Usine (échec fermé) : `mode-budget.ts:42-51`.
- **Interrupteur du rendu avatar** éteint par défaut (`src/fournisseurs/heygen/visage.ts:79`, `src/moteurs/montage-avocat/index.ts:462`) ;
  le double d'essai refusé en montage réel (tests « ROUGE — montage réel… » et « côté console… » toujours verts).
- **Plafond de secondes** envoyées : 1,5 × les secondes annoncées (`src/moteurs/montage-avocat/double.ts:136`, test vert).
- **Solde réel HeyGen** (`controlerCredits`, `credits.ts:354`) et idempotence des réservations (tests verts).
- Trace : chaque prix accepté sans confirmation est journalisé + cloche (`mode-budget.ts:125-136`).

Risque résiduel (voulu, à connaître) : pour une commande du studio, le coût d'un double réel n'est plus borné que par le solde
HeyGen, le plafond 1,5 × secondes et le budget du mois (lui-même « indicatif »). Le geste qui engage la dépense est le clic de
lancement, plus une confirmation du montant.

## 5. Attendu réaligné proposé (PAS de skip) — vérifié vert, 19/19

Remplacer le cas `tests/r7-double-heygen.test.ts:388-399` par :

```ts
  it("double réel : studio = prix du jour vaut accord (journalisé) ; Usine = confirmation TOUJOURS exigée", async () => {
    const { verifierBudgetEtCredits } = await import("@/services/credits");
    const { partDoubleReel } = await import("@/moteurs/montage-avocat/double");
    const estimation = { lignes: [ligne("Double, angle principal", "heygen", 150)], total: { centimes: 150, devise: "EUR" as const } };
    expect(partDoubleReel(estimation.lignes)).toEqual({ centimes: 150, devise: "EUR" });
    // Studio (décision du fondateur, 08/11) : le prix du jour vaut accord, mais la dépense est tracée.
    await expect(verifierBudgetEtCredits(estimation, undefined, "Cette vidéo")).resolves.toBeUndefined();
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/accepté sans confirmation/);
    // Usine : la garde R7 tient, quel que soit le seuil.
    const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
    const { moisParis } = await import("@/services/couts");
    await reglerBudgetUsine({ budget_mensuel_cents: 1_000, mois: moisParis() });
    await expect(verifierBudgetEtCredits(estimation, undefined, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", message: "Votre avatar parle dans cette vidéo : environ 1,50 €, à confirmer." });
    await expect(verifierBudgetEtCredits(estimation, false, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Le double d'essai (simulation) ne demande rien de plus.
    expect(partDoubleReel([ligne("Double, angle principal", "simulation", 150)])).toBeNull();
    await expect(verifierBudgetEtCredits({ lignes: [ligne("Double, angle principal", "simulation", 150)], total: { centimes: 150, devise: "EUR" } }, undefined, "Cette vidéo")).resolves.toBeUndefined();
    expect(heygen.requetes.filter((r) => r.methode === "POST")).toEqual([]);
  });
```

Note : le budget Usine doit rester sous le plafond du mois de la config de test (1 000 centimes passe, 100 000 est refusé).
Retirer aussi `STUDIO_BUDGET_MODE_DEFAUT: "bloquant"` et son commentaire de `vitest.config.mts:18-20` (variable morte, trompeuse).

## 6. Autres tests d'argent touchés

Lancement des 58 fichiers de test qui appellent les portes d'argent (`verifierBudgetEtCredits`, `CONFIRMATION_REQUISE`,
`accordAutomatique`, `BUDGET_DEPASSE`, `partDoubleReel`, `verifierEtReserver`…) : **14 fichiers rouges, 35 tests** sur master.

**Même cause (ancien mode bloquant, périmés comme R7 — à réaligner, pas à sauter)** :
- `tests/c1-argent-b6-confirmation.test.ts` (3 cas « CONFIRMATION_REQUISE » attendue, la fabrication part)
- `tests/a2-fabrication-avocat.test.ts:143` (budget dépassé attendu)
- `tests/paquet4-relecture-exactitude.test.ts` (5 cas), `tests/paquet4-rerelecture-exactitude.test.ts` (2 cas)
- `tests/garde-fous-reprise-sujet.test.ts` (accord au plafond)
- `tests/voix/voix-epinglee-image-video.test.ts` (3 cas « sans accord, aucune réservation »)
- `tests/r2-textes-publication.test.ts` (2 cas : crédit Claude « suivi » insuffisant → aucun appel ; or `credits.ts:300`
  rend ce solde indicatif en mode indicatif)

**Cause DIFFÉRENTE, à regarder à part (gardes structurelles, pas la règle du prix)** :
- `tests/l3-0-garde-origine.test.ts` (cas 3) : **nouveau site de dépense non listé** `src/services/tutoriel-branchements.ts ·
  verifierEtReserverSelonOrigine × 1` — à ajouter à la liste fermée après relecture, ou à corriger.
- `tests/l3-0-garde-origine.test.ts` (cas 2) et `tests/l3-0-relecture-argent.test.ts` (D) : littéral `origine: "usine"` hors de
  `credits.ts` dans `src/app/api/usine/commandes/route.ts` et `src/services/porte-programmations.ts`.
- `tests/c1-argent-b6-confirmation.test.ts` (garde B6) : `confirme: true` écrit en dur dans `src/components/mots/gestes-mots-cibles.ts`.
- `tests/r8-bout-en-bout.test.ts` (10 cas, pile dans `publications.ts:681` → Buffer), `tests/e2e-verif1-bc-script-video.test.ts`,
  `tests/e2e-verif1-d-interrupteurs.test.ts`, `tests/garde-ecran.test.ts` : chemins de publication / écran, non diagnostiqués ici.
