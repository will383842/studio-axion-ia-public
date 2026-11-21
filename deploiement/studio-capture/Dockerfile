# studio-capture — poste de capture figé du tutoriel d'outil (T-EXT-51b). LIVRÉ INACTIF : profil `capture` du compose.
# Chromium (Playwright) + FFmpeg / ffprobe statiques : filme la navigation d'une maquette, SANS RÉSEAU, système de
# fichiers en lecture seule sauf /sortie. Obligatoire avant d'ouvrir le tutoriel aux dossiers (.zip) de clients
# (T-EXT-41, T-EXT-29) : un dossier de client ne s'ouvre jamais dans une session de travail.
# Jamais construit ni démarré par `docker compose up`/`build` par défaut ni par mettre-a-jour.sh.
# Contexte de construction : la racine du dépôt (voir docker-compose.yml).

# FFmpeg / ffprobe 8.1.1 statiques : MÊME image figée par son empreinte que studio-rendu, studio-aligneur et le
# Dockerfile racine (changer de version : voir docs/JOURNAL-FFMPEG-RECENT.md et deploiement/verifier-outils-video.sh).
FROM mwader/static-ffmpeg:8.1.1@sha256:735f84b905e00d5c618b667f0b053f83b1096f5fc404c607e6134bf2275a0e0a AS ffmpeg

# Image Playwright v1.63.0 (= @playwright/test de pnpm-lock.yaml), FIGÉE PAR SON EMPREINTE : Docker refuse tout autre
# contenu. Empreinte de l'index multi-architectures relevée le 21/11/2026 sur le registre (en-tête Docker-Content-Digest
# de https://mcr.microsoft.com/v2/playwright/manifests/v1.63.0-noble ; le sha256 du corps de la réponse est identique).
# Changer de version : nouvelle étiquette ET nouvelle empreinte, et même version dans `npm install` plus bas.
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27

# Posé par l'image : le vérificateur y lit le type de poste « conteneur » (poste.json).
# CI=true : la garde de capture (outils/.../capture/garde.ts) n'accepte que CI ou CLAUDE_CODE_REMOTE ; elle ne connaît
# pas CAPTURE_CONTENEUR. Ce conteneur EST un poste autorisé (sans réseau, sans droits) : on pose donc CI. Aucun secret.
ENV CAPTURE_CONTENEUR=true CI=true NODE_ENV=production HOME=/tmp

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
RUN ffmpeg -hide_banner -version >/dev/null && ffprobe -hide_banner -version >/dev/null && ffmpeg -hide_banner -version | head -n 1

WORKDIR /app
# Les deux seuls paquets que les scripts importent (versions EXACTES du pnpm-lock.yaml) ; installés ici, à la
# construction (le réseau n'existe qu'à ce moment-là), sans scripts d'installation et sans télécharger de navigateur :
# le Chromium est celui de l'image (même version que @playwright/test).
RUN npm install --no-audit --no-fund --ignore-scripts --save-exact @playwright/test@1.63.0 tsx@4.23.15

# Strict nécessaire (le dépôt entier n'est PAS copié) :
#  - capture/ et poste/ : le lanceur de capture et le vérificateur du poste ;
#  - scenario-maquette.ts : lu par le lanceur (schéma du scénario) ; il importe les constantes de etapes-tutoriel.ts
#    (l'import de artefacts-retouche.ts est `import type` : effacé à l'exécution, donc non copié) ;
#  - manrope-latin.woff2 : la police, comme studio-rendu (lue et empreintée par le vérificateur).
COPY outils/maquettes-tableaux-de-bord/capture /app/outils/maquettes-tableaux-de-bord/capture
COPY outils/maquettes-tableaux-de-bord/poste /app/outils/maquettes-tableaux-de-bord/poste
COPY src/moteurs/montage-tutoriel-outil/scenario-maquette.ts src/moteurs/montage-tutoriel-outil/etapes-tutoriel.ts /app/src/moteurs/montage-tutoriel-outil/
COPY src/app/polices/manrope-latin.woff2 /app/src/app/polices/manrope-latin.woff2

# Points de montage (le système de fichiers est en lecture seule à l'exécution) : la maquette et sa charte (../charte)
# sous la racine permise par la garde, le scénario dans /entree (lecture seule), le film dans /sortie (seul inscriptible).
RUN mkdir -p /app/outils/maquettes-tableaux-de-bord/maquette /app/outils/maquettes-tableaux-de-bord/charte /entree /sortie \
  && chown pwuser:pwuser /sortie

# UN SEUL uid : celui de `pwuser` (1001 : l'image Playwright part d'ubuntu:noble, qui a déjà `ubuntu` = 1000). Le même
# que `user:` du compose (tests/deploiement/studio-capture.test.ts) ; la construction échoue si l'image change d'uid.
RUN test "$(id -u pwuser)" = "1001" && test "$(id -g pwuser)" = "1001"

# Vérification à la construction : la construction ÉCHOUE si le poste n'est pas bon (verifier-poste sort 0 seulement
# si Playwright 1.63.0, Chromium, FFmpeg >= 6 et ses filtres, la police et l'espace libre sont bons). Ne lance pas le navigateur.
USER 1001:1001
RUN node_modules/.bin/tsx outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts --sortie /tmp/poste-construction

# Durée bornée à 15 min (SIGTERM, puis SIGKILL 30 s après) : le compose n'a pas de limite de durée.
# Arguments : --maquette ... --scenario ... --sortie /sortie (voir le commentaire du service dans docker-compose.yml).
ENTRYPOINT ["timeout", "--kill-after=30", "900", "node_modules/.bin/tsx", "outils/maquettes-tableaux-de-bord/capture/capturer.mts"]
