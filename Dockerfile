# Studio vidéo Axion-IA — image construite par GitHub Actions, tirée par le serveur.
# Aucun secret n'entre dans l'image : mot de passe (empreinte), clé de session et base sont fournis
# au démarrage par des variables d'environnement.
# FFmpeg 8.1.1 du format « Image → vidéo » (panne du 15/10 : `ffmpeg` absent de ce conteneur, la lecture de l'image et la
# mesure des images noires ou figées échouaient). MÊME image statique, MÊME empreinte sha256 que studio-rendu et
# studio-aligneur (jamais le FFmpeg 5.1 de Debian : panne du 09/10). `ffmpeg` ET `ffprobe` sont copiés (l'étape « vidéos »
# d'illustration, images/preparation.ts, sonde les vidéos de banque avec ffprobe). Changer de version : les trois Dockerfile ensemble, puis deploiement/verifier-outils-video.sh.
FROM mwader/static-ffmpeg:8.1.1@sha256:735f84b905e00d5c618b667f0b053f83b1096f5fc404c607e6134bf2275a0e0a AS ffmpeg

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Clé FIXE des actions serveur (facultative, venue du .env du serveur par docker-compose.yml) : Next en tire le sel des
# identifiants d'actions. Sans elle, chaque construction en tire une au hasard, tous les identifiants changent, et une
# page ouverte avant la mise en ligne échoue (« Failed to find Server Action », constat du 10/10). Elle ne vit que dans
# cette étape ; Next la recopie dans .next/server/server-reference-manifest.json (comme la clé aléatoire d'avant).
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=
RUN pnpm build
# Répétition générale hors ligne des contrôles « Image → vidéo » (scripts/image-video/repetition-controles.mts) : un seul
# fichier, sans pnpm ni tsx dans l'image d'exécution. Lancé sur le serveur : node /app/outils/repetition-controles.mjs trav-… | --tous
# (lecture seule : transaction READ ONLY, aucun appel payant). Les modules natifs (@node-rs/*) ne sont pas embarqués.
RUN pnpm exec esbuild scripts/image-video/repetition-controles.mts --bundle --platform=node --format=esm --target=node22 \
      --external:pg-native --external:@node-rs/* \
      --banner:js="import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);" \
      --outfile=/app/outils/repetition-controles.mjs

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# FFmpeg et ffprobe statiques (étape `ffmpeg`), dans /usr/local/bin (avant /usr/bin dans le PATH) ; contrôlé à la construction. Placé AVANT
# STUDIO_COMMIT et les couches de l'application, qui changent à chaque construction : la couche (140 Mo) reste en cache.
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
RUN ffmpeg -hide_banner -version >/dev/null && ffprobe -hide_banner -version >/dev/null && ffmpeg -hide_banner -version | head -n 1
# Version en ligne (commit court, passé par deploiement/mettre-a-jour.sh) : lue par /api/sante et la traçabilité.
ARG STUDIO_COMMIT=
ENV STUDIO_COMMIT=$STUDIO_COMMIT
RUN useradd --uid 1001 --create-home studio
COPY --from=build --chown=studio:studio /app/.next/standalone ./
COPY --from=build --chown=studio:studio /app/.next/static ./.next/static
COPY --from=build --chown=studio:studio /app/public ./public
COPY --from=build --chown=studio:studio /app/outils ./outils
# Contrôle des commandes FFmpeg du format « Image → vidéo », exécuté par deploiement/verifier-outils-video.sh avant toute
# mise en ligne. Il garde la disposition du dépôt (chemins relatifs) : le contrôle et les deux fichiers PURS qu'il lit.
COPY deploiement/studio/controle-ffmpeg-iv.mjs /app/controle-iv/deploiement/studio/
COPY src/moteurs/montage-image-video/commandes-ffmpeg.ts /app/controle-iv/src/moteurs/montage-image-video/
COPY src/moteurs/montage-image-video/lecture/preparation.ts /app/controle-iv/src/moteurs/montage-image-video/lecture/
USER studio
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
