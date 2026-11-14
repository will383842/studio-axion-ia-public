# Relecture PR 522 — L8-06 (seuils d'échelle, stockage, test de charge simulé)

**Verdict : OK — fusion possible.** Les remarques ci-dessous ne bloquent pas la fusion.

Branche `usine/L8-06`, tête `20ebf572`. Diff relu : `git diff origin/master...origin/usine/L8-06`.

## Contrôles
1. **Limites** : `niveauSeuil` (src/services/seuils-echelle.ts:51-56). 69 et 69,99 → normal ; 70 → attention ; 89 et 89,99 → attention ; 90 → critique ; 100 et 150 → critique ; -1, NaN, +Infini → invalide. `pourcentage` (src/services/seuils-echelle.ts:45-48) renvoie NaN si la capacité est nulle ou négative, si l'usage est négatif ou si une valeur n'est pas finie. Tous ces cas sont testés (tests/charge/charge-simulee.test.ts:131-160). Une mesure invalide produit une alerte « invalide » au lieu d'être ignorée (src/services/seuils-echelle.ts:72-77, test l.185-189).
2. **Aucune suppression réelle** : aucune correspondance pour delete, remove, unlink, purge ou rm dans le module. Le module n'a aucun import. Il ne fait que décrire des règles (`REGLES_RETENTION`, l.102-105). Les deux règles visent uniquement `media-genere-non-publie`. `regleVisePersonne` (l.108-110) signale toute autre catégorie, y compris une catégorie inconnue.
3. **Réseau** : le module n'a aucun import et ne contient ni fetch ni URL. Le test remplace `fetch` par un espion et vérifie qu'il n'est jamais appelé (test l.164-181).
4. **Périmètre** : exactement 3 fichiers (src/services/seuils-echelle.ts, tests/charge/charge-simulee.test.ts, pilotage/journal/L8-06.md). Rien dans src/services/alertes.ts ni src/domaine/alertes/.
5. **Mutations rejouées en copie jetable** :
   - seuil d'attention passé à 71 → 3 tests rouges ;
   - seuil critique passé à 89 → 4 rouges ;
   - `>=` remplacé par `>` sur l'attention → 2 rouges ;
   - première règle de rétention visant `contact` → 1 rouge ;
   - `regleVisePersonne` forcé à `false` → 1 rouge.
6. **.skip/.only** : aucun. **Noms de personnes** : aucun dans le diff.
7. **Install et contrôles** :
   - `pnpm install --frozen-lockfile` : OK.
   - Tests de la PR : 19/19 au vert.
   - eslint sur les 2 fichiers : 0 erreur.
   - `tsc --noEmit` : les erreurs existaient déjà, toutes dans des fichiers que la PR ne touche pas. Aucune ne cite seuils-echelle ou charge-simulee, donc aucune erreur nouvelle.
   - La suite complète n'a pas été menée à terme : arrêtée après plus de 10 min, elle n'était pas requise.

## Remarques non bloquantes
- src/services/seuils-echelle.ts:108 — « un média publié n'est jamais candidat » repose seulement sur le nom de catégorie. Aucun test ne vérifie explicitement qu'une catégorie `media-genere-publie` est refusée. Elle l'est bien (≠ non-publié → `true`), mais il manque le test. Le nom `regleVisePersonne` est aussi trompeur pour ce cas. Proposition : ajouter ce cas au test l.207-212, ou renommer la fonction en `regleHorsPerimetre`.
- tests/charge/charge-simulee.test.ts:171 — la montée de charge s'arrête à 100 %. Un cas `evaluerCharge` avec un usage supérieur à la capacité (par exemple 1200/1000 → critique) compléterait le test ; ce cas n'est aujourd'hui couvert que par `niveauSeuil(150)`.
- Comme l'indique le journal, le branchement sur l'envoi d'alerte reste à faire.
