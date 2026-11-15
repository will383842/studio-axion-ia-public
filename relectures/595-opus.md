# Relecture PR 595 (L8-08, règles de republication par réseau)

**VERDICT FINAL : À CORRIGER**

Tête relue : `5ed1b4b795a8f777cbd79c19729ab0d7fcc7cffd` (= `git rev-parse origin/usine/L8-08`). PR en brouillon, base `1d8d0afa`.

## À corriger

1. `src/domaine/republication/regles.ts:66` — **une date invalide laisse passer la republication.** Si `datePublication` ou `maintenant` vaut `NaN`, `NaN < x` vaut faux, donc le motif « délai trop court » n'est jamais ajouté. Sonde : `{reseau:"tiktok", datePublication:NaN, maintenant:<date valide>}` donne `{autorise:true, motifs:[]}`, pareil avec `maintenant:NaN`. Une garde de prudence doit refuser dans ce cas : vérifier `Number.isFinite` sur les deux dates et refuser (motif dédié, ou `delai-trop-court`), puis ajouter un test.
2. `src/domaine/republication/regles.ts:37` et `:62` — **un réseau inconnu fait planter la fonction au lieu d'être refusé proprement.** Sonde : `evaluerRepublication({reseau:"x" as any, ...})` lève `TypeError: Cannot read properties of undefined (reading 'refuseIdentique')`, et `regleRepublication("x")` renvoie `undefined` malgré son type de retour. Le type `IdReseau` protège à la compilation, mais pas une donnée lue en base ou reçue d'une API. Il faut soit une erreur explicite (`réseau inconnu : x`), soit un refus avec motif, plus un test.

## Mineur (sans effet sur la fusion)

- `tests/republication/regles.test.ts:20` impose `seuilPerformance.statut === "hypothese"`, alors que le type `ValeurSourcee` autorise aussi `source`. Le jour où un seuil sera sourcé, ce test cassera sans raison. Mieux vaut le même contrôle que pour `delaiMinJours` (ligne 18).
- `seuilPerformance` est défini mais `evaluerRepublication` ne l'utilise pas. C'est acceptable si la fiche ne demande que la constante, à confirmer.
- `REGLES_REPUBLICATION` n'est protégé que par `Readonly` (le type), pas par `Object.freeze` à l'exécution. Ce n'est pas bloquant.

## Vérifié et conforme

- Fichiers modifiés : exactement `src/domaine/republication/regles.ts` et `tests/republication/regles.test.ts`. Le commit de démarrage est vide.
- Fonctions pures : pas de `Date.now`, pas d'aléa, pas de `process`, pas d'accès disque ni réseau, entrées non modifiées. Aucun appel réel, aucune suppression de données.
- Aucune mention de Buffer. Aucun nom de personne dans les deux fichiers.
- Toutes les valeurs chiffrées sont marquées `hypothese`. `contenuNeufDerive: true` et `refuseIdentique: true` sur les 6 réseaux. TikTok refuse aussi le filigrane.
- Bornes de délai correctes : exactement N jours → autorisé ; N jours moins 1 ms → refusé. Une date de publication dans le futur → refusée. Les 3 motifs se cumulent.
- Tests ciblés lancés localement (`vitest run tests/republication`) : 7/7 verts.
- `scripts/echecs-connus.json` inchangé.
- Contrôles GitHub sur la tête : 8/8 terminés, tous verts.

## Limite de la relecture

`fiches/L8-08.md` n'existe ni dans ce dépôt ni sur aucune de ses branches : la fiche est dans le dépôt de plans, et la PR le dit. Les critères ont été vérifiés d'après la consigne de relecture, la description de la PR et la note de blocage (branche `relecture/L8-08-blocage`), pas d'après le texte de la fiche lui-même.
