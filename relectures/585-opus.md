# Relecture PR 585 (fiche RC-25 : valeur d'abord et équilibre des activités)

**VERDICT : À CORRIGER** — tête complète vérifiée `bccad837746c0879e79ccb7613e2dbdd63b359fc` (`git rev-parse origin/usine/RC-25`), base `master` `be7d73c8` (branche à jour).

Deux corrections de gravité moyenne sont à faire : (1) des publications datées après la candidate sont comptées ; (2) une exception levée est journalisée sans auteur ni date. Le reste est conforme.

## Corrections demandées

1. **Moyenne** : `src/domaine/calendrier/valeur-d-abord.ts:101-103` et `:114`. La fenêtre de 30 jours n'a qu'une borne basse, sans borne haute. Une offre datée **après** la candidate (calendrier planifié) entre dans le compte, même plusieurs mois plus tard. De plus, `derniere` (l.114) est la dernière publication **dans le temps**, pas celle qui précède la candidate. Sonde : historique `[offre 2026-12-20]` et candidate offre `2026-12-01` donnent `trop-d-offres` et `offres-de-suite` (« deux offres de suite » alors qu'elles sont à 19 jours d'écart, dans l'ordre inverse). À corriger : borner la fenêtre à `jour <= candidate.jour`, ou traiter explicitement les voisins avant et après. Ajouter un test.
2. **Moyenne** : `src/domaine/calendrier/valeur-d-abord.ts:120-124`. L'exception n'est validée que sur `motif`. Avec `par: ""` et `date: ""`, l'avertissement est quand même levé, et l'entrée de journal n'a ni auteur ni date (sonde `parvide`). Le critère de la fiche demande une exception « journalisée » : elle doit rester traçable. Exiger `par` et `date` non vides (date valide), sinon `exceptionRefusee: true`. Ajouter un test.
3. **Mineure** : `valeur-d-abord.ts:102`. La comparaison stricte `>` exclut une offre datée exactement 30 jours avant (sonde : offre 2026-11-01 et candidate 2026-12-01, aucun avertissement). Préciser en commentaire si la borne est voulue (fenêtre de 30 jours candidate incluse) ou passer à `>=`.
4. **Mineure** : `valeur-d-abord.ts:73` et `:102`. Un `jour` invalide donne `NaN`, et la publication sort de la fenêtre sans aucun signal (sonde : 3 offres de page à `jour: "xx"`, aucun avertissement). Ajouter un avertissement ou ignorer de façon explicite et documentée.
5. **Mineure** : `valeur-d-abord.ts:95-96`. Si la candidate figure déjà dans `historique` (même `id`), elle est comptée deux fois (sonde `dejadans` : `trop-d-offres` et `offres-de-suite` contre elle-même). Exclure `p.id === candidate.id`.
6. **Mineure** : `valeur-d-abord.ts:111`. Le message « (au plus 1) » présente la valeur D-4 comme une règle. Suggestion : ajouter « hypothèse en attente de D-4 » au message, ou au moins à la documentation.

## Points vérifiés conformes

- **Avertissement, exception motivée et journalisée** : la règle est non bloquante (`bloquant: false`). Avec un motif non vide, l'avertissement est levé et une entrée de journal est produite. Un motif vide ou fait d'espaces est refusé, l'avertissement reste et rien n'est journalisé. Exception sans avertissement : rien à journaliser. Réserve : voir le point 2.
- **D-4** : toutes les valeurs chiffrées (20, 30, 1, 3, 0, de suite) sont dans la constante nommée `HYPOTHESE_D4` (l.8-27), commentée « HYPOTHESE… pas une décision ». La PR la présente aussi comme une hypothèse. `JOUR_MS` n'est pas une valeur D-4.
- **Aucun appel réel ni publication** : fonction pure, aucune requête réseau, aucune variable d'environnement, aucune écriture. Sonde : l'historique gelé n'est pas modifié.
- **Aucune suppression** : la PR ajoute seulement 2 fichiers (227 lignes ajoutées, 0 supprimée).
- **Fichiers autorisés** : exactement la liste fermée de la fiche (`src/domaine/calendrier/valeur-d-abord.ts` et `tests/domaine/valeur-d-abord.test.ts`, tous deux nouveaux).
- **Tests ciblés** : `vitest run tests/domaine/valeur-d-abord.test.ts` donne 13/13 verts. eslint ne signale rien sur les 2 fichiers. `tsc --noEmit` signale 146 erreurs, identiques sur master, dont aucune dans les nouveaux fichiers.
- **`scripts/echecs-connus.json`** : inchangé.
- **Aucun nom de personne**. Les codes `LW`, `FA`, `IG`, `GR` sont des codes de compte. Le test emploie « le fondateur ».
- **Aucune mention de Buffer**.
- **Contrôles GitHub** : 12/12 verts sur `bccad837`.

Sondes jetables exécutées hors dépôt, rien n'a été poussé à part ce fichier.
