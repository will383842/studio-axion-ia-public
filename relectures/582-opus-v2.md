# Relecture PR 582 (FB-REEL-b), seconde après correction

**VERDICT : OK — FUSION POSSIBLE sur la tête complète cfc40c134752fb9913cfcad74daecea56825daac** (= `origin/usine/FB-REEL-b`).

## Points du premier verdict (`relecture/582-opus-bis`)
1. **Résolu.** `tests/publication/fb-reel-envoi.test.ts:14` : la ligne vaut maintenant `"simulation"`. `FOURNISSEUR_PUBLICATION` n'est lu nulle part dans `src/`, donc la variable est inerte et la valeur neutre ne change rien. Le fichier de test ne contient plus le nom de l'ancien fournisseur (vérifié par grep, et par le test auto-contrôlant des lignes 155 à 160).
2. **Résolu.** `src/services/publications.ts:392` : l'avertissement porte un code propre, `CODE_AVERTISSEMENT_REEL_FACEBOOK = "reel-facebook-hors-regles"`, au lieu de `"legende-trop-longue"`. Le test le vérifie (lignes 139 à 141). Le code reste non bloquant : les seuls lecteurs bloquants (`FeuilleEnvoyerBuffer.tsx:77`, `a-publier.ts:183`, `mesures.ts:246`) ne filtrent que `trop-longue` et `ratio-absent`. Aucun `switch` ni table indexée par ce code dans `src/` ne pourrait casser sur une valeur inconnue.

## Dette notée (non bloquante)
- `src/services/publications.ts:392` : `as unknown as AvertissementReseau["code"]`. À l'exécution, la valeur sort de l'union déclarée dans `src/reseaux/index.ts:237`. Le commentaire (l. 447) le signale comme dette. Une prochaine fiche qui autorise `src/reseaux/index.ts` devra ajouter `"reel-facebook-hors-regles"` à l'union, puis retirer le cast.
- Toujours hors fiche : `KitPublication.tsx:267` n'affiche pas le texte de l'avertissement Reel (observation du premier verdict).

## Vérifié, conforme
- Diff contre master limité à `src/services/publications.ts` et `tests/publication/fb-reel-envoi.test.ts`, les fichiers autorisés. `scripts/echecs-connus.json` est inchangé.
- Pas de régression sur YouTube Shorts (#572) : la condition `reseau === "youtube-shorts" || reseau === "facebook"` (l. 988) est intacte, et les autres réseaux ne reçoivent toujours ni format ni durée.
- HSH-01c : `texteAEnvoyer`, `commentairePour` et les types exportés ne sont pas touchés. Le seul ajout public est une constante exportée, donc le contrat n'est pas dégradé.
- Aucun appel réel, aucune publication ni suppression (`fetch` simulé, clé fictive). Aucun nom de personne dans le diff.
- Fusion à blanc avec master à jour (edbc2e5) : sans conflit. Fait dans une sonde jetable, non poussée.
- Tests locaux sur la fusion : `tests/publication/` + `tests/youtube-zernio/` + `src/reseaux/` donnent 16 fichiers et 181 tests verts. Les 119 fichiers de `tests/zernio/` qui parlent de Facebook ou de Reel donnent 2118 tests verts.
- Contrôles GitHub sur cfc40c13 : 9 sur 9 terminés et verts (règles de fer, garde des fichiers autorisés, eslint et tsc, next build, build Docker, tests touchés, nouveaux et ciblés, garde interne).
