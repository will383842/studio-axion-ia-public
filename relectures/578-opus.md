# Relecture PR 578 (L2-12b) : sauvegarde nocturne des médias

**VERDICT : OK — FUSION POSSIBLE sur la tête complète 77349570fdf106a53ef851fbaa34e8071daa4194**

Condition d'ordre : fusionner la PR 577 (L2-12a) **avant** celle-ci. Sinon, une fois le cron installé à la main, `copier-r2.mjs` répondrait « usage » (code 2) et la sauvegarde enverrait une alerte ÉCHEC chaque nuit (sonde faite : code 2 → ligne ÉCHEC + alerte, rien d'effacé).

## Vérifications (relecture seule, sondes jetables non poussées)

| Point | Résultat |
|---|---|
| Tête vérifiée (`git rev-parse origin/usine/L2-12b` = ls-remote) | 77349570fdf106a53ef851fbaa34e8071daa4194 |
| Diff limité à 4 fichiers : `deploiement/crontab`, `deploiement/env.exemple`, `deploiement/sauvegarder-medias.sh`, `tests/deploiement-sauvegarde-medias-script.test.ts` | OK (garde « fichiers autorisés » verte) |
| Cron écrit mais ni installé ni lancé : seule une ligne ajoutée au fichier versionné ; l'installation reste manuelle (`install … /etc/cron.d`, deploiement/README.md:167) ; aucun script ni test ne l'installe | OK |
| Aucune suppression ni écrasement : ni DELETE, ni `rm`, ni `--delete`, ni sync, ni purge ; journal en ajout (`tee -a`) ; seul `docker run --rm` (conteneur jetable, comme `sauvegarder.sh`) | OK |
| Échec → alerte, rien d'effacé : codes 1, 2, 3 et R2 absent sondés → ligne ÉCHEC, alerte, sortie non nulle | OK |
| Tests doublés : faux `docker` (tests/helpers/faux-docker.sh) et faux `node` dans le PATH ; aucun seau, aucun réseau | OK |
| Aucune clé ni secret : clés passées par `-e NOM` sans valeur ; valeurs de test fictives (`cle-essai`) | OK |
| Contrat PR 577 respecté (0/1/3, dernière ligne `{"copies","deja","echecs"}`, `alerte "<titre>" "<message>"`), comparé au code de usine/L2-12a ; aucun import de ce code | OK |
| Tests ciblés : 7/7 verts en local | OK |
| Mutations : ajout de `--delete`, `rm -rf`, alerte retirée (code 1 / R2 absent), `exit 0` en échec → chacune détectée par les tests | OK |
| `scripts/echecs-connus.json` inchangé | OK |
| Aucun nom de personne (diff, messages de commit, auteur « Claude ») | OK |
| Contrôles GitHub : 8/8 verts | OK |

## Remarques non bloquantes (à corriger dans une fiche suivante si souhaité)

1. `tests/deploiement-sauvegarde-medias-script.test.ts:76` (mineure) : le test « seau de secours absent (sortie 3) » passe `secours: false`, donc c'est la pré-vérification du script (`sauvegarder-medias.sh:53-57`) qui répond ; la branche `3)` (`sauvegarder-medias.sh:66-70`, code 3 rendu par `copier-r2.mjs`) n'est jamais exercée. Sonde : vider cette branche laisse les 7 tests verts.
2. `tests/deploiement-sauvegarde-medias-script.test.ts:79` (mineure) : l'absence de clé dans l'alerte n'est vérifiée que sur ce chemin ; ajouter la clé dans l'alerte du cas d'échec (`sauvegarder-medias.sh:74`) laisse les tests verts. Le code actuel ne fuit rien.
3. `deploiement/sauvegarder-medias.sh:59-61` (mineure) : seule la dernière ligne de sortie est journalisée ; les lignes « ÉCHEC : <clé d'objet> » de `copier-r2.mjs` sont perdues, ce qui complique le diagnostic.
4. `deploiement/sauvegarder-medias.sh:59` (information) : aucun délai maximal sur la copie ; une copie longue peut chevaucher `nettoyer-disque.sh` (04:15). Pas de risque de perte.
