# Journal — FFmpeg récent dans studio-rendu et studio-aligneur (09/10)

Branche `feat/ffmpeg-recent`. Rien n'a été fusionné, déployé ni dépensé, et aucun serveur n'a été touché.

## Pourquoi

Le 09/10 en production, l'export face caméra a échoué. `deploiement/studio-rendu/Dockerfile` (`node:22-bookworm-slim`)
installait le FFmpeg de Debian 12, c'est-à-dire la version **5.1** (2022), et cette version ne connaît pas
`overlay=format=yuv444p10` :

```
[overlay @ …] Error setting option format to value yuv444p10.
[AVFilterGraph @ …] Error initializing filter 'overlay' with args 'format=yuv444p10:eof_action=pass'
Error initializing complex filters.
```

Les tests vérifiaient le **texte** des commandes sans jamais les exécuter avec la version de prod. La PR #3
(`fix/export-10bits-ffmpeg51`, fusionnée) a contourné la panne en passant à 4:2:2. Celle-ci règle la cause.

## Versions

| | Avant | Après |
|---|---|---|
| studio-rendu | FFmpeg / ffprobe **5.1.x** (paquet Debian 12, `apt-get install ffmpeg`) | **8.1.1** statique |
| studio-aligneur | FFmpeg / ffprobe **5.1.x** (paquet Debian 12) | **8.1.1** statique |
| Emplacement | `/usr/bin/ffmpeg`, `/usr/bin/ffprobe` | `/usr/local/bin/ffmpeg`, `/usr/local/bin/ffprobe` (dans le PATH, avant `/usr/bin`) |
| Remotion (compositeur) | son propre FFmpeg, dans `node_modules/@remotion/compositor-*` | **inchangé** (indépendant du FFmpeg système) |

La version 8.1.1 est construite par gcc 13.2.1 (Alpine). Elle contient libx264, libx265, libsvtav1, libzimg (zscale),
libvmaf, libdav1d, libaom et lcms2. Sur le poste d'essai, ses filtres `zscale`, `libvmaf`, `overlay` (avec
`format=yuv444p10`), `lut3d`, `loudnorm`, `afftdn`, `tonemap`, `deesser` et `zoompan` sont présents.

## Choix : binaires statiques figés par empreinte

```dockerfile
FROM mwader/static-ffmpeg:8.1.1@sha256:735f84b905e00d5c618b667f0b053f83b1096f5fc404c607e6134bf2275a0e0a AS ffmpeg
…
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
```

Pourquoi ce choix plutôt que les deux pistes proposées :

- **BtbN/FFmpeg-Builds (tarball + sha256)** : impossible à télécharger depuis cet environnement (GitHub limite cette
  session au dépôt du studio, réponse 403). Je n'aurais donc pas pu vérifier l'empreinte, et je n'ai pas voulu figer une
  empreinte que je n'avais pas calculée moi-même.
- **Debian 13 (trixie)** : FFmpeg 7.1. Il aurait fallu changer de base pour les deux images (Python et Node), avec un
  risque pour les roues PyTorch, MediaPipe et OpenCV et pour les bibliothèques du navigateur de Remotion. Et la version
  n'est pas la plus récente.
- **Image `mwader/static-ffmpeg` épinglée par empreinte** (retenue) : binaires entièrement statiques (static-pie,
  aucune dépendance au système), donc la même chose dans les deux images, quelle que soit leur base. L'empreinte
  `sha256` de la liste de manifestes est vérifiée par Docker à chaque construction, ce qui joue le même rôle qu'un
  tarball + sha256. La construction est reproductible : même empreinte, mêmes octets. Le serveur télécharge déjà ses
  bases depuis Docker Hub. Cette image est un projet libre très utilisé ; elle n'est pas listée sur ffmpeg.org.
- **8.1.1 plutôt que 9.0.2** : 9.0.2 existe (20/09/2026) et passe aussi tous les contrôles ci-dessous. J'ai suivi la
  consigne « 7.1 ou 8.x » et pris la dernière version de la branche 8, plus éprouvée. Pour passer en 9.x : changer
  l'étiquette et l'empreinte dans les deux Dockerfiles, puis lancer `deploiement/verifier-outils-video.sh`.

**Taille** : la couche `COPY /ffmpeg /ffprobe` pèse **280 Mo** (deux binaires de 140 Mo). Le paquet Debian et ses
dépendances ne sont plus installés. Je n'ai pas pu mesurer ce qu'ils occupaient (dépôt Debian bloqué ici) ; c'est en
général de l'ordre de 200 à 300 Mo pour `ffmpeg` avec ses dépendances graphiques.

**Vitesse** (même poste, 4 cœurs, libx264 `faster` High 4.1, 6 s en 1080 × 1920, 2 essais chacun) : FFmpeg 6.1 Ubuntu
3,02 s et 2,74 s ; FFmpeg 8.1.1 statique 2,61 s et 2,59 s. La version statique n'est pas plus lente.

**Bibliothèques retirées avec le paquet ffmpeg** :

- **studio-aligneur** : OpenCV et MediaPipe ont besoin de libGL, EGL, GLES et GLib, qui étaient déjà installés à part.
  Seul le module graphique Qt d'OpenCV (jamais chargé par un serveur) demandait aussi libSM et libXext ; je les ai
  ajoutés quand même (`libsm6 libxext6`, très petits). La construction lance aussi `python -c "import cv2, mediapipe, numpy"` :
  si une bibliothèque manque, elle s'arrête avant toute mise en ligne.
- **studio-rendu** : le compositeur de Remotion trouve toutes ses bibliothèques sans le paquet ffmpeg (vérifié par
  `ldd` dans `node:22-bookworm-slim` nu). Les bibliothèques du navigateur sont celles de la liste de Remotion pour
  Debian, toutes encore installées. Le contrôle avant mise en ligne passe aussi `ldd` sur ces exécutables.

## 4:4:4 ou 4:2:2 pour le graphe d'export 10 bits

**Décision : retour en 4:4:4** (`overlay=format=yuv444p10`). C'est mesurablement mieux, et FFmpeg 8.1.1 est maintenant
garanti par l'image et contrôlé avant chaque mise en ligne.

Mesure avec FFmpeg 8.1.1 : un master 10 bits 4:2:0 (testsrc2 1080 × 1920 en BT.709) et un calque texte transparent aux
bords doux. Le graphe d'export complet est lancé en 4:4:4, puis en 4:2:2, jusqu'à la sortie `yuv420p`. Chacun est
comparé à une **référence** où le mélange est fait en RVB flottant 4:4:4 (`gbrpf32`), avec la même descente en 4:2:0.

| Calque | Graphe | PSNR Y | PSNR U | PSNR V | SSIM U | SSIM V |
|---|---|---|---|---|---|---|
| Texte jaune, bords de 2,5 px (zone du texte) | **4:4:4** | 53,88 | **52,44** | **50,43** | | |
| | 4:2:2 | 53,88 | 40,91 | 40,17 | | |
| Motif coloré à alpha très variable (image entière) | **4:4:4** | 55,32 | **51,24** | **49,24** | **0,9994** | **0,9995** |
| | 4:2:2 | 55,32 | 37,71 | 35,67 | 0,9909 | 0,9895 |

La luminance est identique. La chrominance gagne environ **10 à 13 dB** aux bords du texte. C'est attendu : en 4:2:2,
le texte est sous-échantillonné AVANT le mélange, alors qu'en 4:4:4 il est mélangé puis sous-échantillonné une seule
fois. Coût : environ **+10 %** sur le seul graphe (4 s de vidéo, 2 fils : 2,88 et 2,90 s contre 2,65 et 2,62 s),
négligeable devant l'encodage x264. Le test `tests/ffmpeg51-overlay.test.ts` (PR #3) devient
`tests/ffmpeg-overlay.test.ts` : il vérifie maintenant les formats d'overlay de FFmpeg 8.1.

## Deux défauts trouvés par l'exécution réelle (corrigés)

1. **Étiquettes de couleur perdues depuis FFmpeg 7.1.** Quand un filtre est présent, les options de sortie
   `-color_primaries` et `-color_trc` ne passent plus à libx264. Mesuré en 7.1, 8.1.1 et 9.0.2 : les fichiers sortent
   en `primaries=unknown`, `transfer=unknown` ; en 5.1, ils sortaient en `bt709`. Fichiers concernés : la passe image et
   le cadrage de `image.py`, le décor reposé de `decor.py` (avec et sans effet) et l'étalonnage vidéo de studio-rendu.
   Correctif : les étiquettes sont posées DANS le graphe (`setparams=…bt709:range=tv`, constante
   `ETIQUETTES_BT709` dans `media.py`). Ça marche dans toutes les versions, 5.1 comprise. L'export final et les masters
   de studio-rendu le faisaient déjà.
2. **Matrice BT.601 dans la passe image (défaut ancien, présent aussi en 5.1).** L'encodeur 10 bits de `image.py`
   recevait du RVB 16 bits et convertissait en YUV avec la matrice par défaut de swscale (**BT.601**), tout en
   étiquetant le fichier **BT.709**. Pour un rouge pur, on mesure Y = 324 sur 1023 au lieu de ≈ 250. Les couleurs
   saturées étaient donc décalées dans tous les fichiers de la passe image. Correctif dans `filtre_lut` :
   `scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le`. **Effet visible** : les couleurs de la passe image
   seront désormais justes ; les rouges et les verts saturés changent légèrement par rapport aux vidéos déjà faites.

Sur le code de master, le contrôle réel signale bien les deux défauts : 4 échecs avec 8.1.1 et 1 échec (la matrice)
avec 5.1.2. Avec les correctifs, tout passe.

## Contrôle réel avant mise en ligne

- `studio-rendu/src/controle-ffmpeg.ts` : 19 contrôles, avec les **mêmes fonctions** que la production :
  `argumentsImageFfmpeg` (master avocat 8 bits avec décor, liseré, zoom fixe, zoom lent, LUT, grain, vignette et
  fondu ; master face caméra 10 bits pré-cadré avec écran partagé et mises en page côté et vignette),
  `argumentsMaster` + `grapheCouleurs`, `argumentsEtalonnageVideo` + `filtreEtalonnage`, `argumentsExport`
  (`grapheExport` 8 et 10 bits, libx264 High 4.1, 2 passes et CRF, liste concat et séquence PNG, AAC) et `preparerSon`
  (loudnorm mesuré, chaîne de la voix, limiteur, ebur128). Les exports sont relus par ffprobe : yuv420p, High,
  niveau 4.1, BT.709 tv, AAC 48 kHz stéréo, `+faststart`.
- `studio-aligneur/aligneur/controle_ffmpeg.py` : 14 contrôles, avec les fonctions de `media.py` (sonder,
  `filtre_preparation` SDR et HLG → SDR par zscale et tonemap, `lire_images`, `extraire_son`), `decor.py` (extraire,
  reposer avec et sans effet, `stats_rgb`, énergie de la voix), `son.py` (`debruiter_afftdn`, `chaine_pro` : loudnorm
  en 2 passes, ebur128, FLAC 32 bits), `image.py` (encodeur 10 bits + LUT, matrice BT.709, `controles_machine`) et
  `calage.py`. Aucun dépôt R2 : `deposer_fichier` est remplacé le temps du contrôle.
- `deploiement/verifier-outils-video.sh` lance les deux contrôles dans les images fraîchement construites
  (`docker run --rm --network none studio-rendu:local …` et `studio-aligneur:local …`), puis passe `ldd` sur les
  exécutables de Remotion. Si une seule commande échoue : les 5 dernières lignes de FFmpeg, une liste des échecs et le
  code 1.
- `deploiement/mettre-a-jour.sh` le lance **après la construction et avant la sauvegarde et `up -d`**. En cas d'échec,
  rien n'est sauvegardé ni redémarré ; les tags `:local` reviennent aux images en service (`:precedente`) et les images
  refusées gardent le tag `:refusee`, avec un message clair et le code 1. Avec le calage éteint, le contrôle est lancé
  avec `--sans-aligneur`.
- `tests/ffmpeg-reel.test.ts` (Vitest) exécute le contrôle de studio-rendu avec le FFmpeg du poste. Sans FFmpeg, le
  test est sauté et un message le dit.

## Mémoire de studio-aligneur

`deploiement/docker-compose.yml` : `mem_limit` passe de `3500m` à **`4500m`**. En production, le pic mesuré est de
3,23 Go sur 3,42 Go pendant la passe image d'une vidéo de 2 min ; le serveur a 15 Go. La doc qui citait 3500m est mise à
jour : compose, `docs/facecam/JOURNAL-E.md`, `JOURNAL-Z.md`, `JOURNAL-V.md` et une note dans `JOURNAL-B.md`.

## Résultats exacts

Environnement : conteneur Linux à 4 cœurs, Docker 29.8.2. Branche rebasée sur `origin/master` e69459d (PR #3 et #4
fusionnées).

**Images.** Les images complètes n'ont **pas** pu être construites ici, parce que le réseau de la session bloque
`deb.debian.org` (403), `download.pytorch.org`, `huggingface.co` et `remotion.media` (téléchargement du navigateur).
J'ai donc construit des **images d'essai** générées automatiquement depuis les deux vrais Dockerfiles. Elles gardent
l'étape FFmpeg exacte (`FROM mwader/static-ffmpeg:8.1.1@sha256:735f…0e0a`, `COPY`, contrôle de version), les mêmes
bases, les mêmes `COPY` du code, le même utilisateur et le même dossier de travail. Il leur manque `apt-get`, PyTorch,
les modèles et le navigateur. **La vraie construction et le vrai contrôle se feront sur le serveur** : c'est
précisément le rôle de `mettre-a-jour.sh`.

**`bash deploiement/verifier-outils-video.sh`** sur ces images (FFmpeg 8.1.1), code **0**, 29 s :

- studio-rendu : **19 contrôles FFmpeg réussis** (dont `export 10 bits, 2 passes (grapheExport 10 bits)` en 4:4:4) et
  `OK 10 exécutables du navigateur et du compositeur : toutes leurs bibliothèques sont là` (compositeur seulement : il
  n'y a pas de navigateur dans l'image d'essai) ;
- studio-aligneur : **14 contrôles FFmpeg réussis**.

**Contre-épreuve.** Même image studio-rendu, mais avec FFmpeg **5.1.2** : code **1**. `export 10 bits, 2 passes` et
`export 10 bits, CRF` échouent avec le message exact de la panne de prod
(`Error setting option format to value yuv444p10` …), puis la liste des échecs et « Ces images ne doivent PAS être
mises en ligne ».

**Contrôles hors Docker** (mêmes modules, binaires statiques, poste d'essai) :

| FFmpeg | studio-rendu (19) | studio-aligneur (14) |
|---|---|---|
| 5.1.2 | 2 échecs (export 10 bits 4:4:4, attendu) | 14 OK |
| 6.1.1 (Ubuntu) | 18 OK (avant l'ajout de l'étalonnage) | — |
| **8.1.1** | **19 OK** | **14 OK** |
| 9.0.2 | 18 OK (avant l'ajout de l'étalonnage) | — |
| 8.1.1, code de master SANS les correctifs | — | 4 échecs (étiquettes BT.709 perdues ×3, puis matrice) |
| 5.1.2, code de master SANS les correctifs | — | 1 échec (matrice BT.601 : Y du rouge = 324) |

**Tests.**

- `npx vitest run` (FFmpeg 8.1.1 en tête du PATH) : **3357 réussis, 14 en échec, 3 sautés** (278 fichiers ;
  522 s). Les 14 échecs sont tous dans 5 fichiers sans lien avec FFmpeg : `e2e-verif1-a1-eteints` (2),
  `e2e-verif1-bc-serie` (2), `e2e-verif1-d-interrupteurs` (3), `r0-connexions` (3) et `r6-je-lis-reel` (4). Ces mêmes
  fichiers échouent sur `origin/master` seul : 13 échecs, dont `bc-serie` qui varie de 1 à 3 échecs d'un passage à
  l'autre, sur master comme sur la branche. Ce sont des défauts existants, non traités ici.
- Tests touchés : `ffmpeg-reel` (exécution réelle, 16 s), `ffmpeg-overlay` (ex `ffmpeg51-overlay`),
  `facecam-pre-cadre` et `r5-operations` : **23 / 23 réussis**. Sans FFmpeg (`FFMPEG=/nexiste/pas`), `ffmpeg-reel` est
  **sauté**, avec un message.
- studio-aligneur `python -m unittest discover -s tests -t .` : **36 tests OK** (FFmpeg 8.1.1 et 6.1).
- `npx tsc --noEmit` (racine, après `next typegen`) : **0 erreur**. `studio-rendu` `tsc -p tsconfig.json --noEmit` :
  **0 erreur**. `npx eslint .` : **0 erreur**.
- `bash -n` sur `mettre-a-jour.sh` et `verifier-outils-video.sh` : OK. Le branchement dans `mettre-a-jour.sh` (retour
  des tags `:local`, `:refusee`) n'a **pas** été exécuté ici : il faudrait un serveur avec ses images et son `.env`.

## À faire sur le serveur (Will)

1. Fusionner la PR, puis `bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh`. Le premier passage télécharge
   `mwader/static-ffmpeg` (≈ 434 Mo compressé côté registre, 280 Mo copiés dans chaque image).
2. Lire la sortie du contrôle : 19 + 1 + 14 lignes `OK`. Le contrôle `ldd` couvre ici aussi le navigateur
   téléchargé.
3. Après la première vidéo face caméra : `docker stats` sur `studio-aligneur` pendant la passe image (pic attendu
   < 6 Go depuis le 10/10, voir docs/facecam/JOURNAL-FICHE-CARTES-FORMATS.md). Vérifier aussi que les couleurs de la passe image sont plus justes (rouges et verts saturés).
