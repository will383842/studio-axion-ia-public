# Vérification V5 — serveur (10/10)

Branche `verif/v5-serveur`, partie de master `85655d2`. **Rien n'a été fusionné, déployé ni dépensé, et aucun serveur
n'a été touché.** Tout est prouvé par des tests exécutés ici : scripts bash lancés pour de vrai avec un faux `docker`
(`tests/helpers/faux-docker.sh`), une **vraie base Postgres 16 locale** pour la sauvegarde et la restauration, le vrai
client HTTP du studio face à un faux studio-aligneur, et les vraies files Python de studio-aligneur.

## Faits de production pris en compte (09-10/10)

- Serveur de 15 Go partagé avec le site axion-ia.com ; disque de 150 Go (106 Go utilisés à un moment).
- studio-aligneur a atteint 4,40 Go pour une limite de 4,395 Go pendant la passe « formats » ; relevé à chaud à 6 Go.
- `mettre-a-jour.sh` lance le contrôle réel des outils vidéo avant `up -d`, mais le 09/10 la première exécution du
  nouveau script ne l'a pas lancé : l'ancien script tournait encore, modifié par son propre `git pull`.
- Un redémarrage pendant un montage relance les travaux.

## Bilan

| # | Point | Avant | Après | Preuve |
|---|---|---|---|---|
| 1 | `mettre-a-jour.sh` face à sa propre mise à jour | **KO** | OK | `tests/v5-serveur-scripts.test.ts` |
| 2a | `revenir.sh`, tags `precedente` / `bonne` / `annulee` / `refusee` | OK | OK (inchangés) | idem, 4 + 4 tests |
| 2b | Copie de la base avant migration | OK | OK | idem, Postgres réel |
| 2c | Restauration de cette copie | **KO** (aucune procédure pour la base en service) | OK | `restaurer-base.sh`, 3 tests Postgres |
| 3a | Budgets mémoire sur 15 Go avec le site | **KO** (aligneur 4500m < pic) | OK | 6000m, total 10,4 Go |
| 3b | Pas deux calculs lourds en même temps | **KO** (calage ∥ passe image) | OK | `studio-aligneur/tests/test_v5_serveur.py` |
| 3c | Alerte à 85 % de la limite | **KO** (aucune) | OK | `surveiller.sh`, cron 5 min |
| 4 | Nettoyage sûr du disque | **KO** (seulement `image prune` en fin de mise à jour) | OK | `nettoyer-disque.sh`, cron 04:15 |
| 5a | Redémarrage de studio-aligneur pendant chaque étape | **KO** (montage raté en ≈ 15 s) | OK | `tests/v5-reprise-redemarrages.test.ts` |
| 5b | Recréation de studio-aligneur (mise à jour) pendant une passe | **KO** (tout recalculé, un essai perdu) | OK | volume + même identifiant |
| 5c | Redémarrage du studio pendant chaque étape | OK | OK | `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts` (existant, vert) |
| 5d | Redémarrage de studio-rendu pendant un montage | OK | OK | resoumission au même identifiant (`suivreRendu`), même test e2e |
| 5e | Redémarrage de la base pendant un travail | OK | OK | test Postgres réel (arrêt / relance) |

## 1. `mettre-a-jour.sh` se relance dans la version qu'il vient de tirer

**Cause du 09/10.** `git pull` remplace `mettre-a-jour.sh` pendant qu'il s'exécute. Bash garde l'ancien fichier ouvert et
continue d'exécuter l'**ancien** texte, avec l'ancien `commun.sh` déjà chargé. La nouvelle version n'agit donc qu'au
passage suivant.

**Correction.** Le script note `HEAD` avant le pull. Si le pull l'a changé, il se relance une fois avec
`STUDIO_MAJ_RELANCE=1 exec bash <source>/deploiement/mettre-a-jour.sh "$@"`. La relance ne refait pas de pull, il n'y a
donc jamais de boucle. Si rien n'a changé, il n'y a pas de relance.

**Tests** (dépôt « origin » réel, clone réel, une v2 poussée qui laisse une trace quand elle s'exécute) :

- **ROUGE sur master** : la v2 ne s'exécute pas.
- Avec la correction : la v2 s'exécute **une** fois, avec une construction, trois contrôles des outils et un `up -d`.
- Avec `STUDIO_MAJ_RELANCE=1` : pas de second pull.
- Ordre vérifié : construction → contrôle des outils → copie de la base → `up -d` → santé → `bonne`.

**À savoir** : la toute première mise à jour qui apporte cette correction est encore exécutée par l'ancien script (celui
de master, qui contient déjà le contrôle des outils vidéo). La relance joue à partir de la mise à jour suivante.

## 2. Retour arrière, tags, sauvegarde et restauration

**`revenir.sh` et les tags : OK, inchangés.** Testé :

- les images `:precedente` sont remises en service sans reconstruction (`up -d --no-build`, avec le profil `calage`
  seulement s'il est actif) ;
- les images retirées gardent le tag `:annulee` ;
- `:bonne` est posé sur les seuls services sains ;
- refus clair sans `:precedente` ;
- version précédente malade : code 1 et aucun `:bonne` posé ;
- **deux mises à jour ratées de suite** : `:precedente` reste la dernière version saine (jamais l'image ratée) ;
- contrôle des outils en échec : rien n'est sauvegardé ni redémarré, `:local` est rendu, la construction est gardée
  sous `:refusee` ;
- santé en échec : code 1, la commande `revenir.sh` est affichée, `:bonne` ne bouge pas.

**Copie avant migration : OK.** Sur une vraie base Postgres 16 avec le schéma réel `documents` (301 documents, accents
et guillemets compris), `mettre-a-jour.sh` produit `sauvegardes/avant-maj-….sql.gz` **avant** `up -d`. La copie est
complète et vérifiée.

**Restauration : KO → OK.** `revenir.sh` ne touche pas à la base et la doc ne décrivait qu'un essai dans une base à part.
Nouveau script `deploiement/restaurer-base.sh <copie>` :

1. il vérifie la copie **avant** tout ;
2. il arrête le studio seul ;
3. il **renomme** la base en service `studio_avant_restauration_AAAAMMJJ_HHMMSS` (rien n'est effacé) ;
4. il charge la copie dans une base neuve avec `ON_ERROR_STOP` ;
5. il vérifie qu'il y a des documents ;
6. il redémarre le studio.

En cas d'échec, l'ancienne base reprend son nom. Testé sur Postgres réel :

- une « migration » (documents changés, ajoutés, retirés) est annulée à l'identique (même empreinte md5 de toutes les
  lignes) ;
- la base migrée est gardée intacte ;
- une copie tronquée est refusée avant que le studio soit arrêté ;
- un chargement qui casse en route rend la base d'avant.

L'essai mensuel de `deploiement/README.md` est aussi rejoué : mêmes documents.

### Procédure (Will)

```bash
bash /opt/studio-axion-ia/source/deploiement/revenir.sh                     # 1. images précédentes
ls -1t /opt/studio-axion-ia/sauvegardes/avant-maj-*.sql.gz | head -n 3      # 2. la copie faite juste avant
bash /opt/studio-axion-ia/source/deploiement/restaurer-base.sh /opt/studio-axion-ia/sauvegardes/avant-maj-AAAA-MM-JJ_HHMMSS.sql.gz
# plus tard, une fois sûr : docker exec studio-axion-ia-base-1 dropdb -U studio studio_avant_restauration_…
```

## 3. Mémoire

**Budgets** (`docker-compose.yml`, test « budgets ») :

| Service | Limite | Remarque |
|---|---|---|
| base | 512 Mo | |
| studio | 1 Go | |
| studio-rendu | 3 Go | |
| studio-aligneur | 4500m → **6000m** | pic connu 4,40 Go = 73 %, sous l'alerte de 85 % |
| **Total** | **10,4 Go** | **≥ 4,6 Go** pour le site, Coolify/Traefik et le système |

Le test refuse un total au-delà de 11 Go, et toute limite d'aligneur sous 6000m. Si la PR qui passe le compose à
6000m est fusionnée avant celle-ci, le conflit est sur cette seule ligne : garder 6000m.

**`oom_score_adj: 500` sur studio-rendu et studio-aligneur.** Ces deux conteneurs sont sans état et leurs travaux sont
repris au même identifiant. Si la **machine** manque de mémoire, le noyau les tue avant la base, le studio et le site.

**Contrôle des outils vidéo borné** : `docker run --memory 3g`, réglable par `STUDIO_CONTROLE_MEMOIRE`. Avant, il
n'avait aucune limite et tournait à côté de tout le reste. **Non borné ici** : la construction des images
(`compose build`, Next.js et pip). Elle se fait pendant la mise à jour, et il vaut mieux la lancer hors des heures de
montage.

**Un seul calcul lourd à la fois — KO → OK.** Les travaux face caméra (fil « facecam ») étaient déjà un par un, donc
jamais deux passes image ensemble (test vert avant comme après). Mais le **calage** a son propre fil et tournait **en
même temps** qu'une passe image, dans le même conteneur. Correction : `__main__.py` crée un verrou commun, que
`FileAlignement` et `TravauxFacecam` prennent tous les deux. Ce verrou :

- est pris avant le décompte du délai de 15 min du calage : attendre la fin d'une passe image n'est pas « figé » (test) ;
- est rendu à la fin du calcul, ou à son abandon : l'audit D garde une file jamais bloquée (le test existant reste vert).

**Alerte à 85 % — KO → OK.** `deploiement/surveiller.sh` est lancé par cron toutes les 5 min :

- il lit `docker stats` ; un conteneur `studio-axion-ia-*` à 85 % ou plus de **sa** limite donne une ligne dans
  `surveillance/surveillance.log` et un e-mail (ZeptoMail, `EMAIL_SECOURS_*`, par `copier-r2.mjs alerte` comme les
  sauvegardes) ;
- il envoie au plus un e-mail par heure et par cause, et la levée est notée ;
- il surveille aussi le disque (85 %) ;
- il est en lecture seule : rien n'est arrêté ;
- le site est ignoré.

Tests : un seul e-mail sur deux passages, pas d'alerte sous le seuil ni pour le site, aucun secret sur la ligne de
commande.

## 4. Disque

`deploiement/nettoyer-disque.sh` (cron 04:15, après la sauvegarde de 03:30) retire **seulement** :

- les images sans nom (`docker image prune -f`, jamais une image étiquetée) ;
- le cache de construction de plus de 7 jours ;
- dans studio-rendu et studio-aligneur, les dossiers temporaires de **plus de 24 h** dont le nom est connu
  (`studio-rendu-*`, `remotion-*`, `react-motion-*`, `controle-ffmpeg-*`, `calage-*`).

Il ne touche **jamais** à ceci (testé) :

- `volume prune`, `system prune`, ni `-a` ;
- un dossier récent ;
- un nom inconnu ;
- les travaux face caméra ;
- `sauvegardes/`, copies avant-maj comprises : elles sont seulement comptées dans le compte rendu.

Si le disque reste au-delà de 85 % après le nettoyage, un e-mail part et dit quoi regarder : images `:refusee` /
`:annulee`, vieilles copies avant-maj.

Dans studio-aligneur (KO → OK, testé) :

- un travail **en échec** efface tout de suite ses fichiers lourds. Avant, ses tranches restaient alors que le studio
  resoumet sous un **autre** identifiant ;
- les travaux finis de plus de 24 h sont oubliés avant **chaque** travail, et plus seulement au démarrage du conteneur ;
- un travail en file ou en cours n'est jamais effacé.

## 5. Reprise après redémarrage, sans perte ni double dépense

**studio-aligneur pendant chaque étape (transcrire, visages, son, image, et la passe « formats » 16:9) : KO → OK.**

Le vrai client HTTP du studio parle à un faux conteneur qui « redémarre » quand un travail de l'étape visée est en
cours : 12 tours sans réponse, soit 1 min.

**Défaut trouvé (ROUGE sur master, 11 tests).** Chaque tour sans réponse comptait comme un échec réessayable, et la
soumission suivante, refusée elle aussi, consommait le second essai. Après trois tours (≈ 15 s), le montage échouait
avec « Le son n'a pas abouti ». Après une **recréation** (mise à jour), le 404 consommait aussi un essai.

**Correction** (`src/moteurs/montage-facecam/reprise.ts`, une seule règle pour la chaîne et les déclinaisons ; le
client marque `injoignable` et `travailInconnu`) :

- **injoignable** : le travail reste suivi sous le **même identifiant**, et aucun essai n'est consommé pendant 30 min au
  plus. Au-delà, l'échec ordinaire reprend la main (test : jamais d'attente sans fin) ;
- **404** : le travail est resoumis sous le **même** identifiant, au plus 3 fois, sans consommer d'essai.

Tests :

- chaque travail n'est calculé **qu'une fois** par vie du conteneur ;
- après une recréation, seuls les travaux perdus sont recalculés, chacun une fois ;
- aucun saut, essais à 0.

**Volume `travaux-aligneur`** (`/app/travaux`, `STUDIO_ALIGNEUR_TRAVAUX`). L'état JSON et les tranches de 30 s
survivent à la recréation du conteneur : la passe reprend à la tranche où elle s'était arrêtée. Test Python : tué
pendant la 2ᵉ tranche, la 1ʳᵉ n'est pas recalculée, et un travail fini n'est jamais refait. Le Dockerfile crée
`/app/travaux` (propriétaire `aligneur`) pour que le volume neuf hérite des droits.

**Studio, studio-rendu, base : OK.** Ces cas étaient déjà couverts ou sont vérifiés ici :

- **studio** : `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts` (existant, vert) couvre un redémarrage à chaque
  tour, pendant le rendu HeyGen, pendant l'envoi et pendant une lecture de voix payée : rien n'est payé deux fois ;
- **studio-rendu** : un 404 donne une resoumission au même identifiant (`suivreRendu`), et l'absence de réponse fait
  rater le tour, qui est repris au suivant ;
- **base** (Postgres réel arrêté puis relancé) :
  - une écriture pendant la coupure échoue sans rien changer en mémoire, car elle est faite en base d'abord ;
  - après le retour, le même processus réécrit ;
  - un studio redémarré relit tout.

**Non couvert ici** : le calage (`/alignements`) vit en mémoire de studio-aligneur. Après une recréation, il est perdu,
et le studio garde l'horodatage de la transcription (jamais bloquant, mais moins précis). Il n'est pas réessayé.

## Fichiers

- Nouveaux :
  - `deploiement/restaurer-base.sh`, `surveiller.sh`, `nettoyer-disque.sh`, `alerte.sh` ;
  - `src/moteurs/montage-facecam/reprise.ts` ;
  - `tests/v5-serveur-scripts.test.ts`, `tests/v5-reprise-redemarrages.test.ts`, `tests/helpers/faux-docker.sh` ;
  - `studio-aligneur/tests/test_v5_serveur.py`.
- Modifiés :
  - `deploiement/mettre-a-jour.sh` (relance), `verifier-outils-video.sh` (`--memory`), `docker-compose.yml` (6000m,
    `oom_score_adj`, volume), `studio-aligneur/Dockerfile` (`/app/travaux`), `crontab` (2 lignes), `README.md` ;
  - `studio-aligneur/aligneur/{facecam,serveur,__main__}.py` ;
  - `src/fournisseurs/facecam/{client,simulation}.ts`, `src/moteurs/montage-facecam/{chaine,declinaisons}.ts`.

## Résultats

Environnement : conteneur Linux, Node 22, Python 3.11, Postgres 16.15 local, aucun Docker réel (faux `docker`).

**Nouveaux tests**

- `tests/v5-reprise-redemarrages.test.ts` : **12 / 12**. Sur master : **11 rouges**, seul le témoin sans redémarrage passe.
- `tests/v5-serveur-scripts.test.ts` : **24 / 24**, dont 5 sur Postgres réel. Sur master : 7 rouges (relance, mémoire du
  contrôle, budgets, `oom_score_adj`, volume, crontab).
- `studio-aligneur/tests/test_v5_serveur.py` : **8 / 8**. Sur master : 2 échecs et 3 erreurs (verrou commun, purge,
  nettoyage des échecs).

**Suites complètes**

- `npx vitest run` : **3474 réussis, 2 en échec, 3 sautés** (283 fichiers, 648 s). Les 2 échecs existent sur master
  et ne viennent pas de cette branche :
  - `garde-ecran` dépasse son délai de 5 s : 5,04 à 5,10 s ici, rouge aussi sur master une fois sur deux, vert avec un
    délai plus long ;
  - `e2e-verif1-bc-serie` est instable : 1 échec, vert seul.
- studio-aligneur `python -m unittest discover -s tests -t .` : **54 OK**.
- `npx tsc --noEmit` : **0 erreur** (après `next typegen`, avec les dépendances de studio-rendu installées).
- `npx eslint .` : **0 erreur, 0 avertissement**.
- `shellcheck -x deploiement/*.sh` : propre. Reste un seul avis « info » SC2016, déjà présent sur master
  (`verifier-outils-video.sh`).

**Non exécuté ici** (aucun Docker réel dans cette session) :

- la vraie construction des images ;
- le premier montage du volume `travaux-aligneur` (droits hérités de `/app/travaux`) ;
- `oom_score_adj` ;
- `docker stats` réel.

Ces points sont à regarder au premier passage sur le serveur (liste ci-dessous).

## À faire sur le serveur (Will), après fusion

1. `bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh`. La 1ʳᵉ fois, c'est l'ancien script qui tourne. Le
   volume `travaux-aligneur` est créé : un travail face caméra en cours à ce moment est resoumis par le studio, sans
   consommer d'essai.
2. `sudo install -m 0644 /opt/studio-axion-ia/source/deploiement/crontab /etc/cron.d/studio-axion-ia` (2 lignes de plus).
3. `bash /opt/studio-axion-ia/source/deploiement/surveiller.sh; echo $?` : 0 = tout sous 85 %.
4. `bash /opt/studio-axion-ia/source/deploiement/nettoyer-disque.sh` puis `tail /opt/studio-axion-ia/surveillance/nettoyage.log`.
5. Une fois dans le mois : `restaurer-base.sh` peut être essayé sans risque sur une copie (la base en service est
   renommée, jamais effacée), ou bien l'essai dans une base à part du README.
