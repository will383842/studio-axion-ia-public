# Relecture PR 577 (fiche L2-12a) : copie du delta des médias vers le seau de secours

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `9e3f1c7647fbc3aefc0c899dfb7f471a8acab70b`**
(fiche sensible : la fusion attend toujours la validation du fondateur ; la PR est encore en brouillon).

Relecture en lecture seule, le 15/11/2026, sur un clone neuf ; tête obtenue par `git rev-parse origin/usine/L2-12a`.

## Contrôles

| Point | Résultat |
|---|---|
| Diff limité aux fichiers autorisés | OK : `deploiement/copier-r2.mjs`, `tests/deploiement-sauvegarde-medias.test.ts` (nouveau), rien d'autre |
| Aucune suppression ni écrasement (source et secours) | OK : aucun DELETE, rm, `--delete`, purge, déplacement ; méthodes émises : GET, HEAD, PUT seulement ; aucun PUT vers le seau source (sonde) |
| Fichier déjà copié et identique : pas recopié | OK : relance = `{"copies":0,"deja":5,"echecs":0}` (test et sonde) |
| Fichier différent au même nom : ancienne copie intacte | OK : autre taille → `echecs` + message, rien n'est remplacé ; même taille → compté `deja`, rien n'est remplacé (voir remarque 1) |
| Lecture source tronquée | OK : échec, aucun PUT (sonde) |
| Seau de secours introuvable (404) | OK : erreur avant toute copie, aucun PUT, sortie 1 (sonde) |
| R2_* ou R2_BUCKET_SECOURS absent | OK : `ErreurSecoursAbsent`, zéro requête, sortie 3 en ligne de commande (sonde CLI) |
| Clés spéciales (espaces, accents, `& < ? # %`) | OK : signature encodée RFC 3986 par segment, déséchappement XML de la liste (sonde) |
| Tests doublés, aucun réseau, aucune clé | OK : faux S3 injecté via `appeler`, valeurs factices, le faux S3 lève sur DELETE et sur écrasement |
| Contrat attendu par L2-12b | OK : `lister <source|secours>` (une ligne JSON `{cle,taille}`, ListObjectsV2 paginé), `medias-delta` (dernière ligne `{"copies","deja","echecs"}`, sorties 0 / 1 / 3) ; conforme à la section L2-12 de la fiche de précision et compatible avec `sauvegarder-medias.sh` de la PR 578 (`tail -n 1`, `case` 0/3/autre) |
| Tests ciblés | OK : `deploiement-sauvegarde-medias` 8/8, `audit-d-production` et `paquet4-relecture-securite` verts. `v5-serveur-scripts` : 3 échecs **identiques sur origin/master** (mettre-a-jour.sh, budgets mémoire), sans lien avec la PR |
| `scripts/echecs-connus.json` | OK : inchangé |
| Aucun nom de personne | OK : diff, commits et description de PR vérifiés |
| Contrôles GitHub | OK : 8/8 verts sur la tête (dont garde des fichiers autorisés, règles de fer, next build, eslint/tsc) |

## Remarques non bloquantes (suites possibles, hors fiche)

1. `deploiement/copier-r2.mjs:204` — gravité faible : même clé et même taille mais contenu différent est compté `deja` (conforme au contrat, qui ne compare que la taille). Rien n'est écrasé, mais la divergence n'est pas signalée ; une comparaison d'ETag ou de somme serait plus sûre.
2. `deploiement/copier-r2.mjs:216` — gravité faible : le PUT vers le secours n'est pas conditionnel (`If-None-Match: *`). Si un objet apparaissait dans le secours entre la liste et le PUT (autre écrivain), il serait remplacé. Risque très faible (seul le cron écrit dans ce seau).
3. `deploiement/copier-r2.mjs:149` — gravité faible : `R2_BUCKET_SECOURS` égal à `R2_BUCKET` n'est pas refusé ; la copie « réussit » avec 0 copie et aucun secours réel n'existe. Refuser ce cas (sortie 3) éviterait une fausse assurance.
4. `deploiement/copier-r2.mjs:213` — gravité faible : chaque objet est lu entièrement en mémoire avant envoi ; une très grosse vidéo pourrait dépasser la mémoire du conteneur jetable. Le `Content-Type` d'origine n'est pas recopié.
5. Description de PR : la syntaxe Markdown de `lister <source|secours>` est cassée (cosmétique).
