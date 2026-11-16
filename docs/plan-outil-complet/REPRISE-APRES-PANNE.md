# Reprise après panne : restaurer le studio depuis R2

Document de secours, à lire AVANT d'agir. Principe : **on ne supprime rien, on n'écrase rien, on décide à la main.**

## Ce qui est sauvegardé, et où

| Donnée | Où | Cadence | Outil |
|---|---|---|---|
| Base (documents, vidéos, comptes) | `sauvegardes/` du serveur + copie R2 `studio/sauvegardes/` | 03 h 30 | `deploiement/sauvegarder.sh` |
| Médias (seau R2 principal) | second seau R2 (`R2_BUCKET_SECOURS`) | 04 h 00, delta, jamais de DELETE | `deploiement/sauvegarder-medias.sh` |
| Secrets | `.env` du serveur, copie gardée par le fondateur hors du serveur | à la main | — |

## Cas 1 : le serveur est perdu (nouvelle machine)

1. Réinstaller le serveur et cloner le dépôt sous `/opt/studio-axion-ia/source/` ; remettre le `.env` (modèle : `deploiement/env.exemple`).
2. Démarrer **seulement la base** : `docker compose --env-file /opt/studio-axion-ia/.env up -d base`.
3. **Simulation** (ne modifie rien) :
   `bash deploiement/restaurer-depuis-r2.sh --cle studio/sauvegardes/<nom>.sql.gz`
   ou, après téléchargement manuel depuis le tableau de bord R2 : `--fichier <copie.sql.gz>`.
   Le script vérifie la copie (`gunzip -t`, fin de dump) et annonce ce qu'il ferait.
4. Restauration réelle : même commande + `--executer`, depuis un terminal ; taper `RESTAURER` à la confirmation.
   Le travail est confié à `restaurer-base.sh` : le studio s'arrête, la base en service est **renommée**
   `studio_avant_restauration_<date>` (conservée), une base neuve est chargée et contrôlée, le studio redémarre.
   En cas d'échec, l'ancienne base reprend son nom.
5. Démarrer le reste (`mettre-a-jour.sh`), puis vérifier `/api/sante` et un document connu.

## Cas 2 : base corrompue, serveur intact

Même chose à partir de l'étape 3. Une copie locale récente (`sauvegardes/studio-*.sql.gz`) suffit : `--fichier`.

## Cas 3 : médias perdus ou seau principal vidé

Les médias se recopient depuis le second seau vers le principal, **sans écraser** (ne copier que les objets absents).
Rien dans ce dépôt ne le fait automatiquement. Exemple à lancer à la main, d'abord en simulation :
`aws s3 sync s3://<SECOURS> s3://<PRINCIPAL> --endpoint-url https://<COMPTE>.r2.cloudflarestorage.com --size-only --dryrun`
(retirer `--dryrun` seulement après relecture ; ne jamais ajouter `--delete`).

## Garde-fous

- Le script ne se lance jamais seul (aucun cron ne l'appelle).
- Simulation par défaut ; `--executer` + confirmation tapée obligatoires.
- Aucune suppression : ni de la base en service (renommée), ni dans R2. Les bases `studio_avant_restauration_*` et
  `studio_restauration_ratee_*` ne s'effacent qu'à la main, plus tard, par le fondateur.
- Aucun secret dans les fichiers : les clés R2 viennent de l'environnement ou du `.env` du serveur.
- Un seul verrou (`mise-a-jour.verrou`) : jamais en même temps qu'une mise à jour ou un retour arrière.

## Essai à blanc

Une fois par trimestre : `--fichier` sur une copie récente SANS `--executer`, puis l'essai en base à part décrit dans
`deploiement/README.md` (« Essai de restauration »).
