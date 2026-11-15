# Relecture PR 562 (lot AUT-G) — Opus

## VERDICT : OK — FUSION POSSIBLE sur la tête complète `f190b47a96aca2cdd94c06db4e3349abac68a10e`

(base master `98af97a5`. La branche a bougé pendant la relecture : e1f6822f → f190b47a (3 commits). Sur e1f6822f j'avais conclu
À CORRIGER, voir l'historique plus bas ; les 3 commits corrigent les points bloquants, revérifiés sur f190b47a.)

Remarques NON bloquantes (à reprendre dans un lot ultérieur) :
1. FAIBLE — même clé, deux `depenserSelonOrigine` en vol : dès que la première se clôt, la seconde sort du registre
   (sonde b3 : usage 0, une 3e de 7 € acceptée). Non atteignable aujourd'hui (tous les appelants tirent une clé `nouvelId`).
2. FAIBLE — `tests/autonomie-usine-cle-depense.test.ts`, cas 2, exige `usage < 1900` sur la ré-réservation par la clé du travail :
   il fige l'ancien défaut (il rougira si ce chemin est un jour corrigé) et ne détecte pas, malgré son titre, le retour à « remplacer ».
3. INFO — même `cleUsine` passée deux fois : registre 1×, engagement du travail 2× (sur-compte prudent). Après « Réessayer »,
   les anciennes clés de voix recomptent leur accord (sur-compte prudent, jamais de dépassement).
4. INFO — `pilotage/journal/AUT-G.md` garde la ligne « Limites connues … ne compte que pendant 15 min », devenue fausse.

## Points demandés (tête f190b47a)

| Point | Résultat |
|---|---|
| Diff | OK — les 9 fichiers attendus + 2 de plus, justifiés : `src/services/cle-depense-usine.ts` (clé seulement pour l'Usine) et `tests/autonomie-usine-cle-depense-temps.test.ts`. `scripts/echecs-connus.json` intact. |
| (a) sonde audit 15 € + 2×2 € + 18 € | OK — 18 € REFUSÉ `USINE_PLAFOND_ATTEINT`, usage 19 €, engagé 19 € (master : accepté, 37 €). |
| (b) clé par dépense, cumul, libération, fuites | OK — cumul correct ; +16 min et +60 min, travail en cours : usage reste 19 €, 5 € refusée (faille de e1f6822f corrigée) ; fin consommée : usage = payé exact (17 €) ; échec : la part libérée sort ; échec d'une dépense : 0 € d'usage et d'engagement ; libérer `K3` laisse `K2` intact. |
| (c) double clic / simultanées | OK — même `travailId` 2× : 1 accord, 1 engagement ; `Promise.all` à 1 centime du plafond : l'une passe, l'autre `USINE_PLAFOND_ATTEINT`, jamais > 2000. Remarques 1 et 3. |
| (d) Studio strictement inchangé | OK — origine absente / « studio » × interrupteur allumé / éteint / absent : résultats, engagement et **163 lectures** identiques à master ; aux 4 sites la demande Studio ne contient plus aucun champ `cleUsine`. |
| (e) changement de mois, `BUDGET_USINE_ABSENT` | OK — mois neuf : usage 0, commande acceptée ; plafond éteint ou absent : `BUDGET_USINE_ABSENT`, 0 engagé (comme master). |
| (f) mutations | OK — toutes ROUGES : couts « remplacer » ; autonomie-usine `ajouter` ignoré ; credits clé = `travailId` ; `depenserSelonOrigine` sans `ajouter` ; clé = `travailId` dans `cle-depense-usine.ts` ; un site qui retire la clé ; branche « travail parent engagé » retirée ; Studio qui reçoit une clé. |
| (g) tests, lint, tsc, noms, montants | OK — 182 fichiers de tests (argent, Usine, 4 sites) rejoués master vs f190b47a : 0 nouveau rouge, 56 rouges communs déjà sur master ; les 2 tests rougis par e1f6822f revenus au vert sans modification ; tsc 146 = 146 ; eslint propre ; aucun nom de personne, aucun montant codé en dur ajouté dans `src/`. |

Méthode : clone neuf, vrai `credits.ts`, dépôts en mémoire, lecteurs de solde vides, 0 €, sondes jetables non poussées
(horloge simulée). Suite complète > 1 h non terminée dans le temps imparti : remplacée par les 182 fichiers ciblés, sur les deux arbres.

## Historique — verdict sur la tête précédente e1f6822f : À CORRIGER (points 1 à 3 depuis corrigés)

1. **HAUTE — le plafond reste dépassable au bout de 15 min.** Les clés de voix `travailId#voix_…` n'ont ni engagement ni dépense
   à leur nom : `usageDeLaCle` (`src/services/autonomie-usine.ts:150-153`) ne les compte que pendant `LANCEMENT_EN_VOL_MS`
   (15 min), puis vaut « payé sous la clé » = 0 (la voix est payée sous `travailId`). La clé du travail, elle, compte
   `max(accord, payé)` (`:154`) et ignore l'engagement cumulé. Sonde rejouée (travail T **en cours**, plafond 20 €) :
   15 € lancés + 2 voix à 2 € → usage 19 € ; 16 min plus tard → usage **15 €** (engagement toujours 19 €) ; commande de 5 €
   **ACCEPTÉE** → **24 € engagés pour 20 €**. Une fabrication dure couramment plus de 15 min (rendu, attente de crédit).
   Le journal de lot le range en « limite connue » : c'est la même faille 1, décalée de 15 min. Piste : une clé `T#…` compte
   son accord tant que l'engagement du travail parent est actif (ou engager/accorder la voix sur sa propre clé, ou faire compter
   à la clé du travail `max(accord, engagement actif, payé)`). Test exigé : la sonde ci-dessus doit refuser.
2. **MOYENNE — 2 tests existants deviennent rouges** (verts sur master, rouges sur la PR, rejoué deux fois) :
   `tests/voix/voix-epinglee-image-video.test.ts:130` (« une vidéo : réserve le prix de la voix… ») et
   `tests/cas-concret/services/branchements/branchements.test.ts:205-210` (« S1b · la réservation de budget précède… ») :
   ils attendent `demande` strictement `{ videoId, travailId }` et reçoivent en plus `cleUsine`. Le journal affirme le contraire.
   Ne pas les affaiblir : les durcir (`cleUsine` commence par `<travailId>#voix`), ce qui couvre aussi le point 3.
3. **MOYENNE — mutation non détectée aux 4 sites.** Remplacer `cleUsine` par `travailId` seul (ou la retirer) dans
   image-video / tableau / cas-concret / tutoriel : le nouveau test reste VERT (il appelle `verifierEtReserverSelonOrigine`
   directement). Seuls les 2 tests du point 2 voient la demande, et ils sont déjà rouges. Il faut un test par site (ou une garde
   de structure) qui exige une clé `travailId#…` neuve à chaque lecture.
4. **FAIBLE — point 5 de l'audit partiel.** Deux `depenserSelonOrigine` sur la MÊME clé : comptées 2× tant que les deux volent,
   mais dès que la première se clôt (`libererReservation(cle)` passe l'engagement partagé en « consommee »/« liberee »), la
   seconde, encore en vol, sort du registre. Sonde : A finie pendant que B vole → usage 0, une 3e de 7 € acceptée.
   Non atteignable aujourd'hui (clés neuves `nouvelId`), comme l'audit.
5. **FAIBLE — test qui fige le défaut.** `tests/autonomie-usine-cle-depense.test.ts` cas 2 exige `usage < 1900` pour la ré-réservation
   sur la clé du travail : il échouera si quelqu'un corrige ce chemin (et ne détecte pas, contrairement à son titre, le retour à
   « remplacer »). À retirer ou à inverser.
6. **INFO** — même `cleUsine` passée deux fois : registre compté 1×, engagement du travail 2× (sur-compte prudent, sans dépassement).

## Points demandés

| Point | Résultat |
|---|---|
| Diff | OK — exactement les 9 fichiers attendus, aucun autre ; `scripts/echecs-connus.json` intact. |
| (a) sonde audit 15 € + 2×2 € + 18 € | OK — forme des sites (`cleUsine`) : 18 € REFUSÉ `USINE_PLAFOND_ATTEINT`, usage 19 €, engagé 19 € (master : accepté, 37 €). Forme brute sans `cleUsine` : toujours acceptée (plus aucun appelant ne l'emploie). |
| (b) clé par dépense, cumul, libération, fuites | **FAILLE** — cumul correct à t0 ; échec et dépense terminée : 0 € de fuite ; libérer une clé `K3` laisse `K2` intact. Mais point 1 (HAUTE) ; `libererReservation(T#voix)` est sans effet (pas de libération unitaire d'une voix, prudent). |
| (c) double clic / simultanées | OK — même `travailId` 2× : 1 seul accord, 1 seul engagement ; `Promise.all` à 1 centime du plafond : une passe, l'autre `USINE_PLAFOND_ATTEINT`, usage 2000 max (master : dépassement). Réserves points 4 et 6. |
| (d) Studio strictement inchangé | OK — origine absente / « studio » × interrupteur allumé / éteint / absent (6 cas) : mêmes résultats, même engagement, **163 lectures** de dépôt des deux côtés. |
| (e) changement de mois, `BUDGET_USINE_ABSENT` | OK — identiques à master (mois neuf : usage 0, ancien mois conservé ; plafond absent ou éteint : `BUDGET_USINE_ABSENT`, 0 engagé). |
| (f) mutations | Partiel — couts « remplacer » → rouge ; autonomie-usine `ajouter` ignoré → rouge ; credits clé = `travailId` → rouge ; `depenserSelonOrigine` sans `ajouter` → rouge ; **clé = travailId aux 4 sites → vert (point 3)**. |
| (g) tests, lint, tsc, noms, montants | **FAILLE** — 181 fichiers de tests voisins rejoués master vs PR : 2 nouveaux rouges (point 2), 56 rouges communs déjà présents sur master, aucun corrigé ni toléré en plus. tsc : 146 = 146, aucune nouvelle. eslint des 8 fichiers touchés : propre. Aucun nom de personne ajouté, aucun montant codé en dur dans `src/`. |

Méthode : clone neuf, vrai `credits.ts`, dépôts en mémoire, lecteurs de solde vides, 0 €, sondes jetables non poussées
(`zz-sonde-562*.test.ts`, horloge simulée pour les 15 min et le changement de mois). La suite complète (> 1 h) n'a pas pu finir
dans le temps imparti : remplacée par les 181 fichiers qui touchent l'argent, l'Usine et les 4 sites, rejoués sur les deux arbres.

