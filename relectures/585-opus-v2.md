# Relecture PR 585, seconde passe (fiche RC-25 : valeur d'abord)

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `4cfb4a7e7cbf838364c3a356dddba3d0089fdb1f`**

J'ai vérifié la tête avec `git rev-parse origin/usine/RC-25`, qui donne `4cfb4a7e`. C'est aussi la tête que GitHub indique pour la PR. La base de la PR est `be7d73c8`. `master` a avancé depuis (il est maintenant à `888e5a4a`), mais aucun des fichiers modifiés depuis ne touche ceux de la PR. Une fusion d'essai faite avec `git merge-tree` passe sans conflit, et GitHub indique `mergeable_state: clean`.

## Les 6 points du premier verdict sont résolus

Ce premier verdict est sur la branche `relecture/585-opus`. J'ai vérifié chaque point avec des sondes jetables, non poussées et supprimées après usage.

1. **Borne haute de la fenêtre** : résolu. Elle est appliquée en `valeur-d-abord.ts:111-113` (`ms(p.jour) <= ms(candidate.jour)`). Dans la sonde « offre du 2026-12-20, candidate du 2026-12-01 », il n'y a plus aucun avertissement. Si on ajoute une offre postérieure à un historique valide, seule l'offre antérieure est comptée, et `derniere` désigne bien la publication qui précède la candidate. Une offre datée du même jour que la candidate est comptée comme précédente, ce qui est cohérent.
2. **Exception avec motif, auteur et date** : résolu en `valeur-d-abord.ts:143-152`. L'exception est refusée (`exceptionRefusee: true`, aucune entrée au journal, avertissement maintenu) dans chacun de ces cas : `par` vide, `date` vide ou faite d'espaces, date `"demain"`, motif fait d'espaces. Elle est acceptée avec motif, auteur et date `2026-11-30` : l'avertissement est levé et une entrée de journal est produite.
3. **Borne des 30 jours** : résolu. Elle est documentée en `valeur-d-abord.ts:116` (« de J-30 inclus à J inclus ») et appliquée avec `>=` en `:119`. Une offre à J-30 est comptée, une offre à J-31 ne l'est pas.
4. **Jour invalide signalé** : résolu en `valeur-d-abord.ts:96-110`. L'avertissement `jour-invalide` est émis dans deux cas : pour la candidate (la règle n'est alors pas évaluée) et pour les publications de l'historique, qui sont listées puis ignorées. Sonde : trois offres de page à `"xx"` donnent un avertissement explicite.
5. **Candidate non comptée deux fois** : résolu en `valeur-d-abord.ts:103` (`p.id !== candidate.id`). Dans la sonde `dejadans`, il n'y a plus d'avertissement.
6. **Message D-4 présenté comme hypothèse** : résolu en `valeur-d-abord.ts:127` (« au plus N ; hypothèse en attente de D-4 »).

## Absence de régression et respect du cadre

- **Diff** : il ne contient que les 2 fichiers autorisés, tous deux nouveaux : `src/domaine/calendrier/valeur-d-abord.ts` et `tests/domaine/valeur-d-abord.test.ts`. Il compte 299 lignes ajoutées et 0 supprimée. Le commit de correction ne retire aucun test et en ajoute 6, un par point.
- **Aucune suppression, aucun appel réel** : la fonction reste pure. Elle ne fait aucun appel réseau, ne lit aucune variable d'environnement et n'écrit rien. L'historique gelé (`Object.freeze`) n'est pas modifié. `bloquant` vaut toujours `false`.
- **Cas déjà conformes** : ils le restent. Une candidate de nature `valeur` ne produit aucun avertissement. La famille `autre` est avertie dès la 1re offre. La fenêtre de 20 publications (25 publications, offres anciennes) ne produit aucun avertissement.
- **Tests ciblés** : `vitest run tests/domaine/valeur-d-abord.test.ts` passe à 19/19, et `vitest run tests/domaine` à 258/258. `eslint` ne signale rien sur les 2 fichiers. `tsc --noEmit` signale 146 erreurs, autant que sur `master` à jour, et aucune ne concerne les fichiers de la PR.
- **`scripts/echecs-connus.json`** : inchangé.
- **Noms de personne** : aucun (« le fondateur », codes de compte). Aucune mention de Buffer.
- **Contrôles GitHub** : 12/12 terminés et verts (`success`) sur `4cfb4a7e`.

## Remarques non bloquantes (aucune correction exigée)

- `valeur-d-abord.ts:73` : `Date.parse` accepte une date de calendrier impossible comme `2026-02-31` et la décale au 3 mars. Elle n'est donc pas signalée comme invalide. C'est sans effet pour un format AAAA-MM-JJ produit par l'application, mais un contrôle aller-retour pourra être ajouté plus tard.
- `valeur-d-abord.ts:147` : une date d'exception avec heure (`2026-11-30T10:00:00Z`) est refusée. Ce choix est strict mais sûr. Si c'est le format voulu, il faudrait préciser en commentaire « date AAAA-MM-JJ ».
- La description de la PR mentionne encore « 13/13 ». Il y a maintenant 19 tests : c'est à mettre à jour lors du passage hors brouillon.

Les sondes jetables ont été exécutées hors dépôt. Seul ce fichier a été poussé.
