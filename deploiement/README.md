# Déploiement du studio (serveur axionia-web)

Tout vit sous `/opt/studio-axion-ia/` :

| Chemin | Contenu |
|---|---|
| `source/` | clone du dépôt, mis à jour par `mettre-a-jour.sh` |
| `.env` | secrets (jamais dans le dépôt ; modèle : `env.exemple`) |
| `sauvegardes/` | sauvegardes locales de la base, journal `sauvegardes.log` |

## Mettre à jour

```bash
bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh
```

**Vidéos en cours (Will, 15/10)** : juste avant le redémarrage, le script attend qu'aucune vidéo ne soit « en cours »
(message chaque minute ; les vidéos en file repartent seules après). Au bout de 120 min (`STUDIO_MAJ_ATTENTE_MAX_MIN`),
il s'arrête sans rien redémarrer. Urgence seulement (coupe les vidéos) : `STUDIO_MAJ_FORCER=1 bash …/mettre-a-jour.sh`.
Les sessions n'ont donc plus à se demander « libre » pour une vidéo en fabrication.

**Protection automatique (Will, 18/10)** :

- **Une seule opération à la fois** : verrou `/opt/studio-axion-ia/mise-a-jour.verrou` (flock), pris AVANT le `git pull`
  par `mettre-a-jour.sh`, et aussi par `revenir.sh` et `restaurer-base.sh`. Gardé pendant la relance, rendu à la sortie
  quelle qu'elle soit (erreur, Ctrl-C, kill -9 compris). Une seconde opération lancée pendant la première s'arrête
  aussitôt : « … tourne déjà (PID … (mettre-a-jour.sh) depuis …) », code 5, rien n'est fait. Un retour arrière d'urgence
  pendant une mise à jour qui attend les vidéos : arrêter d'abord la mise à jour (`kill <PID>` : elle sort proprement,
  rien n'a été redémarré, le verrou est rendu), puis lancer `revenir.sh`. Sans `flock` (paquet util-linux) : refus net,
  code 1 (plus de verrou de secours par dossier). `pgrep mettre-a-jour` ne voit pas un `nohup setsid bash …` : lire le
  verrou (`cat …/mise-a-jour.verrou`) ou `flock -n /opt/studio-axion-ia/mise-a-jour.verrou true && echo libre`.
- **Délais maximaux** (ce qui tourne en tenant le verrou) : chaque lecture de la base 30 s (`timeout`, code 124 = lecture
  ratée ; connexion 10 s), le `git pull` 120 s (connexion ssh 20 s). La construction des images et la copie de la base
  n'ont pas de délai maximal.
- **Base qui tourne mais ne se laisse pas lire** : 3 essais (un par minute), puis ARRÊT sans rien redémarrer (avant : on
  redémarrait sans attendre, donc on pouvait couper une vidéo). Le message donne la dernière erreur de psql. Base pas
  encore démarrée (aucun conteneur, même arrêté : première installation) : on continue. Conteneur base arrêté, ou docker
  qui ne répond pas : ce n'est PAS une première installation, arrêt code 4.
- **Vidéo en attente de crédit** : elle reste « en cours » (elle ne fabrique pas, elle attend une recharge) et la mise à
  jour l'attend aussi ; le message le dit à part (« 2 vidéo(s) en cours, dont 1 en attente de crédit »). Recharger le
  fournisseur ou « Arrêter » la vidéo.
- **Juste avant le redémarrage** : la base est copiée, PUIS la boucle de fond est mise en pause (bail `mise-en-ligne` dans
  la base : plus aucune vidéo ne sort de la file ; il expire seul au bout de 30 min), PUIS on relit les vidéos en cours.
  Une vidéo sortie de la file pendant la copie : la pause est levée et on attend de nouveau (au plus 3 allers-retours,
  puis code 3). La pause est levée juste après `up -d`, et à la sortie du script quelle qu'elle soit. La première mise
  en ligne de cette version tourne sous l'ANCIEN studio, qui ne connaît pas la pause : seule la dernière relecture protège.
- **Codes de sortie** : `0` à jour et en bonne santé ; `1` panne (construction, outils vidéo, santé, git pull…) ; `3`
  vidéos encore en cours au bout de l'attente : relancer plus tard ; `4` base illisible : regarder la base ; `5` une autre
  opération tourne déjà. Pour 3, 4 et 5, rien n'a été redémarré, la version en service continue.
- Règle pour les générateurs (ce que le script compte comme « en cours ») : `docs/formats/AJOUTER-UN-FORMAT.md`.

Ce que fait le script :

1. `git pull --ff-only`. Si le pull a apporté une nouvelle version, le script **se relance une fois** (`exec`) dans
   cette version (vérif V5 : avant, la première exécution d'un script modifié tournait encore avec l'ancien texte).
2. Les images en service sont gardées sous le tag `precedente`.
3. Construction, puis **contrôle réel des outils vidéo** (`verifier-outils-video.sh`, ci-dessous), puis
   `docker compose up -d`.
4. **Attente de `/api/sante` en 200, 3 min au plus.**
   - Si elle ne vient pas : « ÉCHEC » affiché, avec la réponse de la sonde et la fin du journal. Le script sort avec le code 1.
   - Rien n'est remis en arrière automatiquement.

`/api/sante` répond 503 dans trois cas :

- la base ne répond pas ;
- la boucle de fond n'a terminé aucun tour depuis 3 min ;
- une autre instance du studio tient la boucle (deux studios en même temps).

### Pages ouvertes pendant une mise en ligne (10/10)

Next tire le sel des identifiants d'actions serveur de `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Sans clé fixe dans le
`.env`, chaque construction en tire une au hasard : une page ouverte avant la mise en ligne appelle des actions que le
nouveau studio ne connaît plus (« Failed to find Server Action »). À faire une fois :

```bash
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> /opt/studio-axion-ia/.env
```

La clé est lue à la construction (`build.args` de `docker-compose.yml`), jamais écrite dans le dépôt. Vérifié le 10/10 :
deux constructions avec la même clé donnent les mêmes identifiants (259 sur 259), sans clé aucun en commun. Une action
renommée ou déplacée change quand même d'identifiant : le filet du navigateur (`src/lib/mise-a-jour-studio.ts`) garde
alors les textes saisis, recharge la page une fois et renvoie le message au monteur.

### Revenir à la version précédente

```bash
bash /opt/studio-axion-ia/source/deploiement/revenir.sh
```

- Il remet en service les images `:precedente`, sans rien reconstruire, puis attend `/api/sante` en 200 et que chaque
  service (base, studio, studio-rendu, et studio-aligneur si le calage est actif) soit `healthy`.
- Les images retirées du service gardent le tag `:annulee`. Rien n'est effacé.
- La base n'est pas touchée.

À la main, l'équivalent est :

```bash
docker image tag studio-axion-ia:precedente studio-axion-ia:local
docker image tag studio-rendu:precedente studio-rendu:local
# Seulement si le calage est actif (STUDIO_ALIGNEUR_URL renseignée) :
docker image tag studio-aligneur:precedente studio-aligneur:local
cd /opt/studio-axion-ia/source/deploiement
# Sans calage :
docker compose --env-file /opt/studio-axion-ia/.env up -d --no-build
# Avec calage :
docker compose --env-file /opt/studio-axion-ia/.env --profile calage up -d --no-build
docker compose --env-file /opt/studio-axion-ia/.env --profile calage ps   # tous « healthy »
```

### Restaurer la base d'avant une mise à jour (vérif V5)

Si une mise à jour a migré les données et que la version précédente ne sait pas les relire :

```bash
bash /opt/studio-axion-ia/source/deploiement/revenir.sh
ls -1t /opt/studio-axion-ia/sauvegardes/avant-maj-*.sql.gz | head -n 3       # la copie faite juste avant
bash /opt/studio-axion-ia/source/deploiement/restaurer-base.sh /opt/studio-axion-ia/sauvegardes/avant-maj-AAAA-MM-JJ_HHMMSS.sql.gz
```

- La copie est vérifiée **avant** de toucher à quoi que ce soit (`gunzip -t`, fin de dump).
- Le studio est arrêté pendant la restauration (la base reste allumée), puis redémarré.
- La base en service n'est **jamais effacée** : elle est renommée `studio_avant_restauration_AAAAMMJJ_HHMMSS`.
  L'effacer plus tard, une fois sûr : `docker exec studio-axion-ia-base-1 dropdb -U studio <nom>`.
- Un chargement qui échoue en route : la base d'avant reprend son nom, le studio redémarre, code 1.

### Ce que vérifie la mise à jour

- Avant de rien redémarrer : la clé `STUDIO_RENDU_CLE` est renseignée ; les commandes FFmpeg du code s'exécutent dans
  les images qu'on vient de construire (`verifier-outils-video.sh` : export 8 et 10 bits, libx264 High 4.1, loudnorm,
  afftdn, filtres de `decor.py` / `media.py`, étiquettes BT.709, bibliothèques de Remotion). Une seule commande en
  échec : rien n'est redémarré, les tags `:local` reviennent à la version en service, les images refusées gardent le
  tag `:refusee`, code 1. À la main : `bash /opt/studio-axion-ia/source/deploiement/verifier-outils-video.sh`
  (`--sans-aligneur` si le calage est éteint). Puis une copie de la base est faite et vérifiée
  dans `sauvegardes/avant-maj-AAAA-MM-JJ_HHMMSS.sql.gz` (jamais effacée).
- Après le redémarrage : `/api/sante` en 200, puis chaque service `healthy`. Sinon : échec, et aucune image n'est
  retenue comme référence du prochain retour arrière (tag `:bonne`).
- Machine de moins de 6 cœurs : `STUDIO_RENDU_CPUS` prend le nombre de cœurs (réglable dans le `.env`).

## Sauvegardes de la base (audit D, B8)

`sauvegarder.sh` tourne chaque nuit à 03:30. Il est lancé par le fichier versionné `crontab`.

1. Il fait un `pg_dump` dans un fichier **temporaire**.
2. Il vérifie ce fichier :
   - `gunzip -t` ;
   - une taille minimale (20 000 octets) ;
   - la ligne de fin du dump.
3. Il le range sous `sauvegardes/studio-AAAA-MM-JJ_HHMMSS.sql.gz`.
4. Il en fait une **copie hors site dans R2**, sous le préfixe `studio/sauvegardes/` du seau `R2_BUCKET`.
   - Il réutilise les variables `R2_*` du `.env` : aucune nouvelle clé.
   - La copie passe par `copier-r2.mjs`, lancé dans un conteneur jetable de l'image du studio.
   - Une copie confirmée laisse un témoin `….sql.gz.r2`.
   - Une copie ratée est retentée au passage suivant.
5. **Rotation locale** : une sauvegarde locale de plus de 14 jours est effacée **seulement si** sa copie R2 est confirmée.
   - **Rien n'est jamais effacé ni écrasé dans R2.**
   - Une ancienne sauvegarde illisible est renommée `….invalide`, jamais effacée.
6. **En cas d'échec** :
   - une ligne `ÉCHEC` dans `sauvegardes/sauvegardes.log` ;
   - le fichier `sauvegardes/DERNIER-ECHEC` ;
   - un message sur la sortie d'erreur (`sauvegardes/cron.log`) ;
   - un **e-mail d'alerte** par ZeptoMail, avec les variables `EMAIL_SECOURS_*` déjà présentes.
   - Un succès écrit `sauvegardes/DERNIER-SUCCES`.

### Installer la tâche planifiée (une fois)

```bash
sudo install -m 0644 /opt/studio-axion-ia/source/deploiement/crontab /etc/cron.d/studio-axion-ia
sudo bash /opt/studio-axion-ia/source/deploiement/sauvegarder.sh     # premier essai à la main
tail -n 20 /opt/studio-axion-ia/sauvegardes/sauvegardes.log
```

- Retirer l'ancienne ligne de `crontab -e` (root) si elle existe : `sauvegarder.sh` ne doit tourner qu'une fois par nuit.
- Après chaque mise à jour du dépôt, réinstaller `crontab` s'il a changé (même commande `install`).

### Essai de restauration (une fois par mois, dans une base À PART)

```bash
F=$(ls -1t /opt/studio-axion-ia/sauvegardes/studio-*.sql.gz | head -n 1)
docker exec studio-axion-ia-base-1 createdb -U studio studio_essai_restauration
gunzip -c "$F" | docker exec -i studio-axion-ia-base-1 psql -q -U studio -d studio_essai_restauration
docker exec studio-axion-ia-base-1 psql -U studio -d studio_essai_restauration -c "SELECT collection, count(*) FROM documents GROUP BY 1 ORDER BY 1"
```

- La base `studio` en service n'est jamais touchée par cet essai.
- La base d'essai peut être gardée, ou effacée par Will (`dropdb`) : c'est une copie.

### Restaurer depuis R2 (serveur perdu)

- Télécharger `studio/sauvegardes/<fichier>` depuis le tableau de bord Cloudflare R2.
- Puis : `gunzip -c <fichier> | docker exec -i studio-axion-ia-base-1 psql -U studio -d studio`, sur une base **vide**.

## Mémoire, disque et surveillance (vérif V5)

Le serveur a 15 Go, **partagés avec le site axion-ia.com**. Limites du studio (`docker-compose.yml`) :

| Service | Limite | Remarque |
|---|---|---|
| base | 512 Mo | |
| studio | 1 Go | |
| studio-rendu | 3 Go | un montage à la fois ; tué en premier si la machine manque de mémoire (`oom_score_adj`) |
| studio-aligneur | 6000 Mo | un seul calcul lourd à la fois (calage OU travail face caméra) ; pic mesuré 4,40 Go = 73 % ; tué en premier aussi |
| **Total studio** | **≈ 10,4 Go** | ≥ 4,6 Go restent au site, à Coolify/Traefik et au système |

Le contrôle des outils vidéo d'une mise à jour tourne avec `--memory 3g` (`STUDIO_CONTROLE_MEMOIRE` pour changer).

**Surveillance** (`surveiller.sh`, toutes les 5 min) : un conteneur du studio au-delà de **85 %** de sa limite, ou le
disque au-delà de 85 % → ligne dans `surveillance/surveillance.log` et e-mail d'alerte (au plus un par heure et par
cause). Lecture seule : rien n'est arrêté.

**Nettoyage sûr** (`nettoyer-disque.sh`, chaque nuit à 04:15) : images Docker sans nom, cache de construction de plus de
7 jours, dossiers temporaires de plus de 24 h de studio-rendu et studio-aligneur (par nom connu). **Jamais** les
volumes, la base, les travaux en cours ni `sauvegardes/`. À la main : `bash /opt/studio-axion-ia/source/deploiement/nettoyer-disque.sh`.

Les travaux face caméra de studio-aligneur vivent dans le volume `travaux-aligneur` : une recréation du conteneur (mise
à jour) les reprend où ils en étaient (tranches de 30 s gardées). Les travaux finis sont oubliés au bout de 24 h.

Après une mise à jour du dépôt qui change `crontab` : la réinstaller (commande `install` ci-dessus).

## Journaux Docker

- Chaque service garde au plus 5 fichiers de 20 Mo (`logging` dans `docker-compose.yml`).
- Cette limite s'applique aux conteneurs **recréés**.
- La première mise à jour qui porte ce réglage recrée aussi `base`, car sa configuration a changé : Postgres redémarre quelques secondes. Les données restent dans le volume `donnees`.

## Un seul studio à la fois

- Ne jamais lancer `--scale studio=2`.
- Le code le garantit aussi : la boucle de fond, la boucle d'écriture et la veille ne tournent que dans l'instance qui tient le verrou Postgres `pg_try_advisory_lock`.
