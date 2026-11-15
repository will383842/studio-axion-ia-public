# Relecture PR 584 (L6-07) : date visée et validation propagées dans le générateur

## VERDICT : OK — FUSION POSSIBLE sur la tête complète 4acc6d0324fa52498ddcfd2a94554116c889262e

(branche `usine/L6-07-v2`, base master be7d73c8 ; relu le 2026-11-15)

**Attention, branche :** la consigne désignait `usine/L6-07` (tête 6d8a1e80). Cette branche n'est PAS celle de la PR 584 : elle ne contient qu'un journal « bloquée » ; fusionnée sur master, elle n'ajouterait que `pilotage/journal/L6-07.md` et aucun code. Ne pas la fusionner. La PR 584 a pour tête `usine/L6-07-v2` ; c'est elle qui est relue ici. La tête a bougé pendant la relecture (f226cac → 4acc6d0, correctif de typage du test seulement) ; le verdict vaut pour 4acc6d0 uniquement.

## Contrôles

| Point | Résultat |
|---|---|
| Un sujet garde sa `dateVisee` | OK : `creerSujet` l'écrit (jour AAAA-MM-JJ) ; `ecrireSujetDeLUsine` la transmet ; dépôt Postgres en JSONB, donc le champ en plus est conservé. Testé (création directe + passage par l'usine). |
| Un ANCIEN sujet sans ces champs se charge | OK : test « ancien sujet » (champs retirés, réenregistré, relu, listé) ; lecture par `dateViseeDuSujet` / `etatValidationDuSujet`, jamais fatale. |
| `etatValidation` = « propose » par défaut | OK : absent, inconnu ou ancien → « propose » ; « valide » seulement s'il est donné explicitement. |
| Aucune régression du générateur | OK : les 37 fichiers de test qui importent `services/generateur` ou `services/usine-sujet` (hors nouveau test) donnent 401 réussis / 42 échoués sur la PR ET sur master, avec exactement la même liste d'échecs (échecs préexistants, liés à l'environnement). |
| Tests ciblés | OK : `tests/usine-sujet-date.test.ts` + `tests/usine-format-inconnu.test.ts` : 18/18. |
| tsc | OK sur 4acc6d0 (les 3 erreurs TS2339 du test, présentes sur f226cac, sont corrigées). |
| Aucun appel réel ni publication | OK : dépôts en mémoire, variables d'environnement de l'usine retirées dans le test, aucun réseau. |
| Aucune suppression | OK : 3 lignes retirées, toutes remplacées par une version étendue (signature, `extends`, type de `m`). |
| Fichiers autorisés (fiche L6-07) | OK : exactement `src/services/generateur.ts`, `src/services/usine-sujet.ts`, `tests/usine-sujet-date.test.ts` (nouveau). |
| `scripts/echecs-connus.json` | inchangé. |
| Aucun nom de personne | OK : rien d'ajouté (le champ `phraseWill` existait déjà sur master). |
| Contrôles GitHub | 9/9 verts sur 4acc6d0. |
| Fusion | sans conflit avec master. |

## Remarques non bloquantes (à traiter dans une fiche ultérieure)

1. `src/app/(studio)/ecrire/sujets/actions.ts:48-53` (hors périmètre de L6-07), gravité faible aujourd'hui : `creerSujetAction` retire les clés forgées venues du navigateur (`estDemo`, `origineUsine`, `origine`, `typeAutomatisation`) mais pas `etatValidation` ni `dateVisee`. Un appel forgé, avec session ouverte, peut donc créer un sujet « valide ». Rien ne lit encore cet état, donc pas d'effet tout de suite ; la fiche qui s'appuiera sur « valide » devra retirer ces clés ou ignorer `etatValidation` à la création (`src/services/generateur.ts:236`).
2. `src/services/generateur.ts:150` (`dateViseeDuSujet`), gravité faible : `Date.parse` accepte « 2026-02-30 » (testé par sonde jetable) ; une date impossible passe. Un contrôle aller-retour (AAAA-MM-JJ reconstruit) suffirait.
3. Comme le signale la PR, les champs sont typés dans `generateur.ts` (`ChampsDateSujet`) et non sur `ScriptMaitre` (`src/domaine/types.ts`, hors périmètre). Il faudra une fiche qui autorise `types.ts` pour les y remonter.
4. La PR est encore en brouillon : elle doit passer en « prête » avant la fusion.
