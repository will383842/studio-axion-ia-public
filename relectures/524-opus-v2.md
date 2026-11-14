# Relecture PR 524 (AUT-A) — vérification du delta — tête 8c55f4c4 — relecteur Opus, argent et sécurité

## VERDICT : OK — fusion POSSIBLE sur la tête 8c55f4c4

Les deux bloquants de la première relecture (tête 2f2d9aaf, `relectures/524-opus.md`) sont corrigés. Chacun est couvert par un test qui rougit sans la correction. Le reste n'a pas bougé. Les 3 remarques ci-dessous ne bloquent pas la fusion.

Diff réel `origin/master...origin/usine/AUT-A` : exactement 4 fichiers, tous nouveaux (`src/services/autonomie-usine.ts`, `tests/autonomie-usine-registre.test.ts`, `tests/autonomie-usine-structure.test.ts`, `pilotage/journal/AUT-A.md`). Delta 2f2d9aaf → 8c55f4c4 : uniquement ces 4 fichiers, en dehors de la fusion de master.

## 1. Bloquant 1 (origine de la vidéo) : CORRIGÉ
`accordSansClicPour` (l.267-273) : quand l'origine reçue vaut `undefined` et qu'un `videoId` est fourni, l'origine est lue par `origineDeLaVideo(videoId)` AVANT `normaliserOrigine`, puis vient `budgetIndicatifPour(o)`.
Sonde rejouée (dépôts en mémoire), avec `accordSansClicPour(...)` d'un côté et `budgetIndicatifPourVideo(...)` de l'autre :
- vidéo `commande.origine: "usine"`, origine non transmise, autonomie ÉTEINTE → **false / false** (la première relecture donnait true / false) ;
- vidéo d'origine Studio → true / true ; version sans `origine` → true / true ; version sans commande → true / true ; vidéo inexistante → true / true (inchangé) ;
- « studio » transmis sur une vidéo Usine → true / true ; « usine » transmis sur une vidéo Studio → false / false ;
- autonomie ALLUMÉE + vidéo Usine, origine non transmise → **true** ; `accordSansClicPour("usine")` allumée → true.
Tests ajoutés : `describe("accord sans clic : origine non transmise")`. Mutation (retour à l'ancienne résolution) → **1 rouge**.

## 2. Bloquant 2 (marqueur réservé à credits.ts) : CORRIGÉ
- Nouveau test de structure : `dansVerrouCredits(` n'est appelé, hors commentaires, que dans `src/services/credits.ts` (et dans le module lui-même). Mutation : appel littéral posé dans `src/services/zz-fautif.ts` → **1 rouge**.
- Le test séquentiel est renommé « deux accords SÉQUENTIELS… (ne prouve aucune simultanéité ; la vraie course relève de autonomie-usine-course.test.ts, lot C) ».
- Le docblock (l.93-99) dit en clair : « ce marqueur seul ne protège RIEN ». Il n'est valable que posé par `sousVerrouCredits`. Il signale aussi l'héritage d'AsyncLocalStorage par les tâches détachées (point 3 de la première relecture).

## 3. Points 4 à 8
- Point 4 FAIT : `MOIS = () => moisParis(maintenant())`.
- Points 5 à 8 : notés dans `pilotage/journal/AUT-A.md` (section « Correctif relecture Opus »), à traiter par les lots suivants et l'auditeur.

## 4. Rien d'autre n'a changé
- Les 7 mutations du plan, rejouées en copie jetable, rougissent toujours : ≤→< : 3 ; « − usage de la clé » retiré : 2 ; consommée sans dépense→0 : 1 ; absent→0 : 7 ; `normaliserOrigine(null)`→studio : 2 ; `VERROU_REQUIS` retiré : 1 ; marque 80 % posée avant l'envoi : 1. Copie supprimée ensuite.
- Aucun fichier existant modifié par la PR : `credits.ts`, `mode-budget.ts` et `budget-mensuel.ts` sont identiques à master.

## 5. Contrôles
- Tests AUT-A + `tests/l1-09-budget-mensuel.test.ts` : **80/80 verts**.
- `tests/l3-0-garde-origine.test.ts` : 2 échecs (cas 2 « origine usine en dur » et cas 3 « liste fermée des sites »), identiques sur master f6236241 sans la PR, donc préexistants.
- Lint des 3 fichiers : propre. `tsc` : 146 erreurs sur la tête comme sur master, aucune dans `autonomie-usine*`.
- Aucun prénom ni nom de personne dans le diff.

## Remarques non bloquantes (pour le lot C ou l'auditeur)
a. **Le test du marqueur ne voit que l'appel littéral.** Un alias le contourne : `import { dansVerrouCredits as d }` puis `d(...)` dans `src/app/zz/x.ts` → test vert (rejoué). Ce contournement est délibéré, pas une erreur d'inattention. Durcissement possible : interdire tout *import* de `dansVerrouCredits` hors de `credits.ts` (`/\bdansVerrouCredits\b/` hors commentaires), ce qui couvre aussi la déstructuration d'un `await import`.
b. **`null` est désormais plus strict qu'avant.** `accordSansClicPour(null, vidéoStudio)` = false, alors que `budgetIndicatifPourVideo(vidéoStudio, null)` = true, car `??` laisse retomber `null` sur la vidéo. C'est l'échec fermé voulu par le plan (« null = usine »). Lot D : un chemin Studio qui transmettrait `dep.origine = null` perdrait l'accord sans clic. Il faut passer `undefined` ou la vraie origine.
c. Le 3ᵉ test du nouveau bloc crée `v-o3` sans rien affirmer dessus : la moitié « origine transmise studio l'emporte » du titre n'est pas testée (la sonde ci-dessus la confirme : true).
