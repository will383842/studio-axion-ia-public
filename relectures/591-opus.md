# Relecture PR 591 (Opus, zone argent, lecture seule)

## VERDICT : OK — FUSION POSSIBLE sur la tête complète b9d9a08eb03d6d83d8afef4eb7c2555186949f3d

Sujet : S1 budget Usine, « la porte reçoit le plafond de l'automatique ». Références : plan `usine/plan-budget-dans-usine-2026-11-15.md` (S1, branche `plan/budget-usine`), audit `usine/audit-plan-budget-2026-11-15.md` (branche `audit/budget-usine`), contrat `usine/CONTRATS-ECHANGE.md` + PR 50 du dépôt plans (tête 1cf852ac).

## Points vérifiés

| Point | Résultat | Preuve |
|---|---|---|
| Tête | conforme | `pulls/591` head = b9d9a08e… (2 commits sur master) |
| Diff limité à la liste fermée S1 | conforme | 7 fichiers : route.ts, autonomie-usine.ts, budget-mensuel.ts, credits.ts (l. 350 seule), 3 essais autorisés |
| Carte « L'Usine en automatique » (reglages) non touchée | conforme | `git diff master pr591 -- src/app/reglages` vide ; composant non touché |
| `scripts/echecs-connus.json` inchangé | conforme | diff vide |
| Toutes les validations AVANT toute écriture | conforme | sonde : 13 corps invalides (quotas valides + paire -1 / 10 000 001 ; budget + flottant ; `automatique` texte/null ; un seul champ ; allumer à 0 ; paire valide + quotas, mois ou budget invalides) → 400, aucun paramètre ajouté ni modifié, aucune dépense, aucune cloche ; seule la ligne de journal existante « porte refusée » de la garde |
| Paire seule écrite, `deja:false` ; rejeu `deja:true` ; quotas nouveaux + paire rejouée → `deja:false` | conforme | sonde |
| Bornes entier 0..10 000 000 | conforme | 10 000 000 accepté, 10 000 001, -1, 12.5, "100" refusés |
| Éteindre jamais refusé (`false`+0, `false`+10 000 000) | conforme | sonde → 200 |
| Aucun refus lié au plafond global | conforme | plafond global à 1 centime, absent ou illisible + paire seule → 200, clé écrite (`plafond_cents: null` si illisible) |
| Bascule à sens unique ; ancienne clé jamais réécrite | conforme | ancienne clé identique octet pour octet ; ses changements sans effet ; clé porte illisible ou à 0 allumée → confirmation (jamais retour à l'ancienne) ; aucun corps (null, absent) ne peut effacer la clé |
| Aucune suppression (dépenses, journal, `budget.engage.*`, registre `usine.autonomie.index/accord.*`) | conforme | sonde + essai de structure (aucun `supprimer/effacer/retirer`) |
| Cloche `budget` à chaque changement, sans montant, sans `{cloche:true}` | conforme | 4 changements → 4 cloches `budget`, aucun chiffre ni « € » |
| Règle du 25/10 | conforme | `credits.ts` : seule la phrase change ; `jugerSousPlafondUsine`, `inscrireAccordUsine`, `usageDeLaCle`, verrou inchangés ; critère 8 testé (studio/sans origine 50 € sous plafond 1 centime : passe) |
| Aucun montant en dur, aucun appel réel payant | conforme | seule la borne existante `PLAFOND_MAX_CENTIMES` ; essais en fournisseur `simulation`, lecteurs injectés |
| Réponse sans paire inchangée | conforme | clés identiques (`porte-usine-garde-budget` vert sans modification) |
| Structure : `usine.autonomie.porte` écrite seulement par `recevoirAutonomieUsine`, appelée seulement depuis `budget-mensuel.ts` ; `reglerAutonomieUsine` injoignable depuis `src/app/api/**` | conforme | `tests/autonomie-usine-structure.test.ts` + grep |
| Risque R3 noté dans la PR avec ses parades | conforme | section « Risque R3 » |
| Aucun nom de personne (diff et texte de PR) | conforme | grep |
| Essais ciblés | verts | 18 fichiers, 275 essais (`autonomie-usine*`, `porte-usine*`, `budget*`) ; eslint 0 erreur ; `tsc` : 149 erreurs d'environnement, même nombre sur master, aucune dans les fichiers touchés |
| Contrôles GitHub | 9/9 verts | next build, tests des fichiers touchés, eslint et tsc différentiels, garde de zone, règles de fer, cas concret, build Docker, nouveaux essais, garde interne |

## Remarques non bloquantes

1. `src/services/budget-mensuel.ts:135-138` (faible) : avec budget/quotas ET paire dans le même corps, le budget/quotas est écrit avant la paire ; une panne de base pendant `recevoirAutonomieUsine` laisserait une écriture partielle (500). Ce n'est pas une validation (toutes sont faites avant), et un rejeu répare. Acceptable.
2. `src/app/api/usine/reglages/budget/route.ts:28` (faible) : avec la paire, un plafond global illisible donne `plafond_cents: null`, indiscernable de « pas de plafond ». Choix déclaré dans la PR ; le contrat (PR 50) ne le décrit pas.
3. `tests/autonomie-usine-registre.test.ts:372` (info) : modifié en plus de la l. 358, imposé par la nouvelle phrase du plan ; écart déclaré.
4. `src/services/autonomie-usine.ts:105-123` (info) : la trace (cloche + journal) précède l'écriture ; une panne entre les deux donne une cloche sans changement, puis une nouvelle cloche au rejeu. Choix déclaré, sûr.

## Avis séparé : PR 50 du dépôt plans (`contrat/plafond-usine-porte`, 1cf852ac)

**Cohérente avec la PR 591 : OK sur le fond.** Paire indissociable, `400 champ_invalide`, bornes 0..10 000 000, allumer à 0 refusé, éteindre jamais refusé, rien écrit (ni quotas ni budget) en cas de refus, paire seule valide, `deja` composé, réponse sans paire inchangée, cloche `budget` sans montant à chaque changement et jamais au rejeu, aucun refus d'une commande du fondateur, aucun lien avec le plafond global : la PR 591 fait exactement cela.

Petites retouches suggérées (non bloquantes) :
1. `usine/CONTRATS-ECHANGE.md`, 5 bis : « C'est le seul montant permis sur la porte » contredit la note « Écart de route » juste au-dessus, qui liste `budget_mensuel_cents` comme accepté par la même route. Écrire « le seul montant nouveau » ou rappeler que `budget_mensuel_cents` reste toléré.
2. 5 bis, Idempotence : la réponse avec la paire renvoie `automatique` et `plafond_automatique_cents` (et `plafond_cents: null` si le plafond global est illisible) ; le contrat ne le dit pas. L'ajouter pour que l'Usine (S3/S4) lise la bonne forme.
3. Le dépôt plans étant privé, le prénom présent dans le contrat ne pose pas de problème ; il ne doit pas être recopié dans le Studio public (la PR 591 n'en contient aucun).

Méthode : clone neuf, sondes jetables (`tests/zz-sonde-591.test.ts`, 20 cas, verts) non poussées et supprimées.
