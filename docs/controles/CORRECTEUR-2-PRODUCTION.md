# CORRECTEUR 2 — Production (audit D : B8, B9, B10 et déploiement)

- **Branche** : `outils/production`, partie de `origin/master` @ `d186500` (version EN LIGNE).
- **Référence** : `docs/controles/AUDIT-D-PRODUCTION.md` (branche `controles/audit-d-production`).
- **Hors périmètre, non touchés** : les fichiers d'argent (`credits.ts`, `fabrication*.ts`, `decors.ts`, `fal.ts`, `heygen/voix.ts`, `travaux.ts`). Un autre correcteur y travaille.
- **Garanties** :
  - aucune clé ajoutée ;
  - aucun appel réseau réel pendant les essais : faux `fetch`, faux transports, faux `docker` ;
  - aucune donnée effacée.

---

## 1. Ce qui est corrigé

### B8 — Sauvegardes : vérifiées, copiées hors site, rotation sûre, alerte

| Fichier | Rôle |
|---|---|
| `deploiement/sauvegarder.sh` | réécrit |
| `deploiement/copier-r2.mjs` | nouveau, Node sans dépendance |
| `deploiement/crontab` | nouveau, format `/etc/cron.d` |
| `deploiement/README.md` | nouveau |

1. **Dump vérifié** :
   - `pg_dump` est écrit dans un fichier temporaire `.studio-XXXXXX.sql.gz.part` ;
   - le fichier est vérifié par `gunzip -t`, par une **taille minimale** (20 000 octets) et par la ligne de fin `PostgreSQL database dump complete` ;
   - il est ensuite rangé par `mv` sous `studio-AAAA-MM-JJ_HHMMSS.sql.gz`, ce qui n'écrase jamais une sauvegarde du même jour.
   - Un dump raté ne ressemble plus jamais à une sauvegarde valide.
2. **Copie hors site vers R2**, sous le préfixe `studio/sauvegardes/` :
   - elle réutilise les variables `R2_*` du `.env` : **aucune nouvelle clé** ;
   - `copier-r2.mjs` tourne dans un conteneur jetable de l'image du studio, qui contient déjà Node 22 ;
   - les secrets passent par `-e NOM`, sans valeur sur la ligne de commande ;
   - le fichier passe par l'entrée standard ;
   - la signature V4 est **identique** à celle du studio (vérifiée par un test).
   - Déroulé : HEAD (absent ?), puis PUT, puis HEAD (taille identique ?).
   - **Aucun DELETE** n'est jamais envoyé. Un objet déjà présent :
     - avec la même taille : déjà copié, rien n'est renvoyé ;
     - avec une autre taille : refusé, rien n'est écrasé.
   - Une copie confirmée laisse le témoin `….sql.gz.r2`. Une copie ratée est retentée au passage suivant.
3. **Rotation locale de 14 jours** : un fichier local de plus de 14 jours n'est effacé **que si sa copie R2 est confirmée** (témoin `.r2`).
   - Les copies R2 ne sont **jamais** supprimées.
   - Une ancienne sauvegarde illisible, par exemple un dump vide de l'ancien script, est renommée `.invalide` : ni effacée, ni copiée.
4. **Journal d'échec** :
   - `sauvegardes/sauvegardes.log`, avec des lignes `OK` ou `ÉCHEC (étape …)` ;
   - les fichiers `DERNIER-ECHEC` et `DERNIER-SUCCES` ;
   - un message sur la sortie d'erreur (`cron.log`) ;
   - un **e-mail d'alerte** ZeptoMail, avec les variables `EMAIL_SECOURS_*` déjà présentes.
5. **Cron versionné** : `deploiement/crontab`, à 03:30. Les instructions d'installation et l'essai de restauration mensuel sont dans `deploiement/README.md`.
6. `docs/PLAN.md` promettait `studio/backups/`, ce qui n'existait pas. Il décrit maintenant ce qui est réalisé.

### B9 — Une boucle bloquée se voit

- **`/api/sante` répond 503** si aucun tour de boucle ne s'est terminé depuis **3 min**.
  - Fichiers : `src/services/sante.ts`, avec la fonction pure `santeBoucle`.
  - Au démarrage, la boucle a 3 min de grâce : l'état est `demarrage`, et la sonde répond 200.
  - Avec la boucle coupée (`STUDIO_BOUCLE=0`, ou en développement), l'état est `inactive` et la sonde répond 200.
  - La réponse porte un champ court `boucle` : `ok`, `demarrage`, `inactive`, `bloquee` ou `verrou-ailleurs`.
- **Délai global par tour** : `DELAI_TOUR_MS = 150 s` (`src/services/boucle.ts`, `executerTour`).
  - Au-delà, le tour est **abandonné** : le drapeau tombe, la boucle repart, et `toursAbandonnes` augmente.
  - `dernierTour` n'avance pas. Si les abandons se répètent, la sonde passe en 503.
  - Chaque travail est désormais « en vol » pendant **tout** son traitement, et plus seulement après un délai dépassé. Le tour suivant ne relance donc jamais un travail encore en cours dans un tour abandonné : aucun double appel payant.
- **Tâches annexes bornées**, une seule à la fois (`lancerAnnexe`) :
  - suites (miniatures, kit) : 45 s ;
  - surveillance des crédits : 20 s ;
  - notifications : 20 s.
  - Au-delà, elles continuent hors du tour.
- **Synchronisation Buffer HORS du tour** : elle n'est plus attendue (avant : jusqu'à environ 25 min dans le tour), et une seule tourne à la fois.
- **Postgres** (`src/donnees/postgres/index.ts`, `optionsPool`) :
  - `statement_timeout` à 30 s ;
  - `query_timeout` à 35 s côté client ;
  - `idle_in_transaction_session_timeout` à 60 s.
  - Une requête muette ne bloque plus le verrou global, ni donc « Arrêter » ou « Réessayer ».

### B10 — Notifications : file persistée, réessayée

- La file n'est plus sur `globalThis`. Elle est **en base**, dans le champ `envoi` de la notification (`src/domaine/types.ts`, `EnvoiNotification`), avec un statut et un nombre d'essais. Aucune nouvelle collection n'a été créée.
- Statuts :

| Statut | Signification |
|---|---|
| `a-envoyer` | en attente d'envoi |
| `envoyee` | partie |
| `ignoree` | les préférences ne demandent que la cloche |
| `sans-canal` | carte en simulation ou rien de joignable : écrit et éteint, comme avant |
| `echec` | `ESSAIS_MAX_NOTIFICATION = 6` essais ratés ; journalisé, et la notification reste dans la cloche |

- **Réessai aux tours suivants**, avec une attente de 1, 2, 4, 8 puis 16 min, plafonnée à 30 min.
- **Rien n'est perdu au redémarrage**.
- Une notification déjà partie n'est jamais renvoyée. Pour une alerte grave dont l'e-mail est réessayé, le téléphone déjà servi n'est pas repoussé (`pushFait`).
- Les anciennes notifications, sans champ `envoi`, ne partent pas : pas de rafale à la mise en ligne.
- Les écritures de `envoi` et « marquer lues » passent sous le verrou, sans réseau. Aucune écriture n'est perdue.

### Déploiement

- **`docker-compose.yml`** :
  - `logging` json-file, `max-size: 20m`, `max-file: 5` sur les **4 services** (ancre `x-journaux`) ;
  - `stop_grace_period` : 60 s pour la base, 30 s pour les autres services ;
  - `deploy.replicas: 1` sur le studio ;
  - `STUDIO_ALIGNEUR_DELAI_SEC`.
- **Fichiers temporaires de `studio-rendu`** : les dossiers `studio-rendu-*`, `remotion-*` et `react-motion-*` laissés par un processus tué sont effacés **au démarrage**, avant tout rendu (`studio-rendu/src/nettoyage.ts`).
  - Je n'ai pas choisi `tmpfs` : il compterait dans les 3 Go de mémoire du conteneur, alors qu'une entrée peut peser 4 Go.
- **`studio-aligneur`** : le calcul tourne dans un fil séparé, avec un délai maximal (`DELAI_CALCUL_SEC = 900 s`, réglable par `STUDIO_ALIGNEUR_DELAI_SEC`).
  - Au-delà : échec typé `indisponible` (non réessayable), et la **file est libérée** pour la demande suivante.
  - `/sante` répond **503** tant qu'un calcul figé occupe le processus, et Docker le voit.
  - Un calcul figé qui finit enfin n'écrase pas l'échec.
- **`mettre-a-jour.sh`** :
  - avant la construction, les images en service sont taguées `precedente` ;
  - après `up -d`, il **attend `/api/sante` en 200, 3 min au plus**, interrogé dans le conteneur car aucun port n'est publié ;
  - sinon, il affiche « ÉCHEC » clairement, avec la réponse de la sonde, les 40 dernières lignes du journal et la commande de retour arrière, puis sort avec le code 1.
- **`deploiement/revenir.sh`** (nouveau) : retour arrière vers les images `:precedente`, sans reconstruire, puis contrôle de santé. Les images retirées gardent le tag `:annulee`.
- **`deploiement/commun.sh`** : fonctions partagées.
- **Un seul réplica garanti** : `pg_try_advisory_lock` (`CLE_VERROU_BOUCLE`), pris sur une connexion dédiée au démarrage (`demarrerBoucleUnique`, `src/instrumentation.ts`).
  - Une 2e instance ne fait tourner **ni** la boucle de fond, **ni** la boucle d'écriture Claude (payante), **ni** la veille.
  - Elle réessaie toutes les 30 s, et prend le relais si la première s'arrête.
  - `/api/sante` y répond 503 au bout de 3 min (`verrou-ailleurs`).
  - Si le verrou est perdu (connexion coupée), la boucle s'arrête puis réessaie.

---

## 2. Preuves : tests rouges avant, verts après

`tests/audit-d-production.test.ts` contient 17 tests. Lancés contre le code de `d186500` (sources, `studio-rendu` et `deploiement` d'origine, nouveaux tests), ils sont **tous rouges** ; avec la correction, ils sont tous verts :

```
Avant (d186500) :
× ROUGE — boucle active, dernier tour il y a 4 min : la sonde n'est plus « ok » (503) 887ms
× au démarrage (aucun tour fini, lancée il y a 30 s) : en bonne santé ; au-delà de 3 min sans tour : bloquée 823ms
× ROUGE — un tour qui ne finit jamais est abandonné : la boucle repart, `dernierTour` n'avance pas 5833ms
× ROUGE — la synchronisation Buffer tourne HORS du tour (une seule à la fois) : un Buffer muet ne bloque plus le tour 884ms
× ROUGE — `statement_timeout` sur le pool Postgres (une requête muette ne bloque plus le verrou global) 827ms
× ROUGE — une 2e instance (verrou pris ailleurs) ne fait PAS tourner la boucle ; elle prend le relais au verrou libéré 829ms
× verrou perdu (connexion coupée) : la boucle s'arrête et attend de le reprendre 827ms
× ROUGE — rien n'est perdu au redémarrage : la file est relue en base 826ms
× ROUGE — un envoi raté est réessayé aux tours suivants (attente croissante), jamais renvoyé une fois parti 827ms
× après ESSAIS_MAX essais ratés : « echec » (gardée dans la cloche), plus aucun envoi 834ms
× alerte grave (e-mail forcé) : le téléphone déjà servi n'est pas repoussé quand l'e-mail est réessayé 829ms
× carte en simulation : les notifications en attente passent « sans-canal », rien ne part (écrit et éteint) 822ms
× ROUGE — au démarrage, les dossiers `studio-rendu-*` (et ceux de Remotion) laissés par un processus tué sont effacés, rien d'autre 832ms
× ROUGE — la signature est EXACTEMENT celle du studio (mêmes variables R2_*, aucune nouvelle clé) 826ms
× envoi : vérifie l'absence, envoie, revérifie la taille ; déjà présent (même taille) : rien n'est renvoyé ; autre taille : refus, rien n'est écrasé ; jamais de DELETE 832ms
× alerte d'échec : un e-mail ZeptoMail avec les variables EMAIL_SECOURS_* existantes ; sans elles, rien ne part 834ms
× sauvegarder.sh : fichier temporaire + gunzip -t + taille minimale + mv, copie R2, rotation 14 jours sans jamais effacer dans R2 ; crontab versionné 831ms
Tests  17 failed (17)

Après (outils/production) : Tests  17 passed (17)
```

Python (`studio-aligneur`) : `TestDelaiCalcul.test_calcul_fige_abandonne_file_liberee_sante_503`.

- Avant, il est rouge : `TypeError: FileAlignement.__init__() got an unexpected keyword argument 'delai_calcul'`. Aucun délai n'existait, et un calcul figé bloquait la file.
- Après, il est vert.

Tests existants ajustés, sans changer ce qu'ils vérifient :

- `tests/e2e2-console-demarrage.test.ts` : la sonde renvoie en plus `boucle: "inactive"`.
- `tests/g4c-corrections.test.ts` : la simulation de `@/services/boucle` fournit `demarrerBoucleUnique`, le nouveau point d'entrée du démarrage. La boucle d'écriture part toujours au démarrage.

Scripts shell, vérifiés par `bash -n` et `shellcheck -x` (0.11) sur `sauvegarder.sh`, `mettre-a-jour.sh`, `revenir.sh` et `commun.sh` : **aucun avertissement**. Un faux positif SC2094 est commenté. Ils ont aussi été essayés pour de vrai avec un faux `docker` (aucun réseau) :

- **`sauvegarder.sh`** :
  - cas normal : code 0, fichier vérifié et témoin `.r2` ;
  - R2 en panne : code 1, ligne ÉCHEC, alerte, fichier gardé ;
  - R2 revenu : les copies en retard partent, puis la rotation se fait ;
  - `pg_dump` en panne : code 1 ;
  - dump tronqué : code 1 à l'étape « taille minimale » ;
  - variables R2 absentes : code 1 ;
  - ancienne sauvegarde vide : mise de côté en `.invalide`.
- **`revenir.sh`** : santé OK au 2e essai donne le code 0 ; santé jamais OK donne le code 1 avec le message ÉCHEC.

---

## 3. Contrôles

Contrôles lancés sur l'état final de la branche :

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (suite complète) | **177 fichiers passés, 1 sauté ; 2 432 tests passés, 2 sautés, 0 échec** |
| `npx next build --webpack` | réussi (code 0) |
| `python -m unittest discover -s tests -t .` (studio-aligneur) | **21 tests OK** (numpy installé pour `test_ctc`) |
| `bash -n` sur les 4 scripts `deploiement/*.sh` | OK |
| `shellcheck -x deploiement/*.sh` (0.11.0) | OK |
| `docker compose --profile calage config -q` | OK (fichier valide) |

---

## 4. Ce qu'il faut faire SUR LE SERVEUR (commandes exactes)

Toutes les commandes se lancent en root sur axionia-web.

1. **Mettre en ligne cette branche**, une fois fusionnée dans `master` :
   ```bash
   bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh
   ```
   - Le compose change : `base` est recréé une fois, et Postgres redémarre quelques secondes. Les données restent dans le volume `donnees`.
   - Ce lancement-ci tourne encore avec l'**ancien** script, lu avant le `git pull`. Les images `:precedente` et l'attente de santé ne jouent qu'**à partir de la mise à jour suivante**.
   - Pour vérifier la santé à la main tout de suite :
     ```bash
     cd /opt/studio-axion-ia/source/deploiement && docker compose --env-file /opt/studio-axion-ia/.env exec -T studio node -e "fetch('http://127.0.0.1:3000/api/sante').then(async r=>console.log(r.status, await r.text()))"
     ```
     La réponse attendue est `200 {"ok":true,"base":"ok","boucle":"ok"…}`. L'état `demarrage` est normal pendant les 3 premières minutes.
2. **Installer la sauvegarde planifiée**, et retirer l'ancienne ligne cron si elle existe :
   ```bash
   crontab -l | grep -n sauvegarder || true          # ancienne ligne ? la retirer avec : crontab -e
   install -m 0644 /opt/studio-axion-ia/source/deploiement/crontab /etc/cron.d/studio-axion-ia
   bash /opt/studio-axion-ia/source/deploiement/sauvegarder.sh
   tail -n 20 /opt/studio-axion-ia/sauvegardes/sauvegardes.log
   ```
   - Le premier passage copie aussi dans R2 **toutes** les anciennes sauvegardes locales lisibles. Il peut prendre un moment.
   - Vérifier dans le tableau de bord Cloudflare R2 que `studio/sauvegardes/` contient les fichiers.
3. **Vérifier les variables du `.env`**, sans les afficher :
   ```bash
   grep -cE '^(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET)=.+' /opt/studio-axion-ia/.env   # attendu : 4
   grep -cE '^(EMAIL_SECOURS_CLE|EMAIL_SECOURS_EXPEDITEUR|EMAIL_SECOURS_DESTINATAIRE)=.+' /opt/studio-axion-ia/.env   # attendu : 3 (alerte e-mail)
   grep -E '^FOURNISSEUR_NOTIFICATION=' /opt/studio-axion-ia/.env   # attendu : FOURNISSEUR_NOTIFICATION=web-push-email (audit B10)
   ```
4. **Le droit de la clé R2** : elle doit pouvoir écrire sous `studio/sauvegardes/`, ce qui est le même seau que les vidéos.
   - Si possible, ajouter dans Cloudflare une règle de cycle de vie qui **n'expire pas** ce préfixe.
   - Activer aussi la règle « abandon des envois multipart incomplets » (audit D, R2). Je ne peux pas la poser depuis le code.
5. **Essai de restauration**, une fois par mois, dans une base à part : commandes dans `deploiement/README.md`, section « Essai de restauration ».
6. **En cas de mise à jour ratée** :
   ```bash
   bash /opt/studio-axion-ia/source/deploiement/revenir.sh
   ```

---

## 5. Limites et suites

- **Pas de redémarrage automatique sur « unhealthy »** : `restart: unless-stopped` ne réagit pas à l'état de santé.
  - La sonde 503 rend la panne **visible** (`docker ps`, `mettre-a-jour.sh`), mais rien n'alerte encore de l'extérieur.
  - Suite conseillée : une sonde externe sur `https://studio.axion-ia.com/api/sante` (UptimeRobot ou Healthchecks.io), qui alerte sur un code ≠ 200.
- **Une 2e instance sert encore des pages** depuis sa propre copie en mémoire. Le verrou garantit seulement qu'elle ne **fabrique** rien et n'appelle pas Claude. Le compose (`replicas: 1`) et la sonde 503 restent les garde-fous.
- **Un calcul figé de l'aligneur** : un fil Python ne s'arrête pas de force. Le fil figé continue jusqu'au redémarrage du conteneur, mais la file avance et `/sante` le signale.
- **Une boucle d'écriture ou une veille déjà lancées** ne s'arrêtent pas si le verrou est perdu en cours de route. Seule la boucle de fond s'arrête. Ce cas est rare : il suppose une connexion coupée, puis une autre instance qui prend le verrou.
- **Pour `tsc`**, il a fallu installer les dépendances de `studio-rendu` (`cd studio-rendu && npm ci`). Sans elles, `tsc` signalait déjà des erreurs `@remotion/*` sur `d186500` : ce problème est sans lien avec ces corrections.
