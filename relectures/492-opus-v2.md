# Relecture PR 492 (v2) — STU-PORTE-PROG (porte v2, appel 4 « programmations »)

**Verdict : OK — fusion possible telle quelle.**

Tête relue : `3d0e962f` (ancienne `af6f2f54`), branche `usine/STU-PORTE-PROG`. Verdict précédent : `relecture/492-opus` (À CORRIGER). Lecture seule ; mutations jetables, toutes restaurées.

## Périmètre
- `git diff --stat origin/master...origin/usine/STU-PORTE-PROG` : 4 fichiers = les 3 autorisés (`src/app/api/usine/programmations/route.ts`, `src/services/porte-programmations.ts`, `tests/porte-v2/programmations.test.ts`) + `pilotage/journal/STU-PORTE-PROG.md`.
- `outils/gardes/zone-interdite.mjs --fichiers` : **vert**. Aucun fichier d'envoi, aucune zone Zernio. Le service n'importe que des types et `plan-editorial` (`porte-programmations.ts:9-11`).
- Aucun nom de personne, aucun prix.

## Points du verdict précédent
1. **Date du fondateur écrasée — levé.** La révision par `entreeId` est retirée ; `recevoirProgrammation` n'écrit une date qu'à la création d'une entrée neuve (`porte-programmations.ts:32-49`). Un rejeu ne touche jamais `jourVise`/`heuresParReseau` (`:34-38`). Test `programmations.test.ts:91-108` : `decaler()` réel par le fondateur, puis rejeu avec une autre date → entrée strictement identique (`toEqual(avant)`), 15/12, `decalages: 1`.
2. **Rejeu hors ordre — levé** (plus de révision, donc plus d'ordre à gérer). Le rejeu de la même `cle` est sans effet hors rattrapage « propose » → « a_valider ».
3. **Révision incohérente / sans `validerCreneau` — levé** (branche supprimée ; la création passe par `creerCreneau`).
4. **« Tout arrêter » — levé.** `route.ts:43-58` : même règle que `commandes/route.ts` (vide/0/false/non = éteint), 423 `tout_arrete` avant toute lecture ou écriture du plan. Test `programmations.test.ts:111-127` : 423 sans entrée créée, et 423 aussi sur une clé déjà connue sans changer la date.
5. **`entreeId` inconnu → création silencieuse — levé.** `entreeId` hors liste blanche (`route.ts:50`) → 400 `champ_invalide`, rien n'est écrit (tests `:71-90`, entrée « vous » et entrée « usine »).
6. **Retour trompeur — levé.** Seuls restent `deja: false` (201, création) et `deja: true` (200, rejeu réel). `date_du_fondateur_conservee` a disparu.
7. **Tests — levé.** Plus de titre trompeur sur la révision ; les nouveaux tests vérifient l'état complet. Mutations rejouées ici (fichier `programmations.test.ts`, 14 tests) :
   - `entreeId` de nouveau permis → 2 rouges ;
   - contrôle « Tout arrêter » neutralisé → 1 rouge ;
   - rejeu qui réécrit la date → 2 rouges ;
   - rattrapage « propose » retiré → 1 rouge ;
   - rejeu qui recrée/écrase toute entrée non validée → 2 rouges.
   Conforme à la ligne 14 du journal. Tests non tautologiques (ils passent par la vraie route et le vrai `decaler()`).
8. **Journal L0-13 — levé.** `pilotage/journal/STU-PORTE-PROG.md:10` : « L0-13 est absent de master et n'est pas utilisé ; CAL-21 non appelé. »

## Tests relancés
`npx vitest run tests/porte-v2` → **4 fichiers, 48 tests verts**.

## Remarques non bloquantes (ne pas retenir la fusion)
- `route.ts:50-55` et journal ligne 9 (« 423 en premier ») : le 423 vient après `garderPorte` (jeton, contrat, champs), comme dans `commandes/route.ts`. Un appel sans jeton reçoit donc 401 plutôt que 423, et un 423 laisse une ligne dans le journal d'accès de la porte (via `terminer`) — rien dans le plan. Cohérent avec l'appel 1 ; préciser « en premier après la garde » dans le journal si on y retouche.
- `porte-programmations.ts:34-38` : un rejeu de même `cle` avec un corps différent répond 200 `deja` sans le signaler. Choix d'idempotence acceptable et testé (`:139-148`) ; à mentionner dans le contrat de l'appel 4.
- Contrat de l'appel 4 (forme du corps, 201/200, future révision) toujours à confirmer par le fondateur avant l'ouverture en production — noté au journal ligne 13. Ne bloque pas la fusion de la création seule.
