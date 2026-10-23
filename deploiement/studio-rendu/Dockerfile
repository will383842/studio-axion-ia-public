# studio-rendu — conteneur SANS ÉTAT du Studio vidéo Axion-IA (lot M1b, plan B.9 ter).
# Node + navigateur sans affichage (Chrome Headless Shell de Remotion) + FFmpeg / ffprobe + Remotion.
# Aucune base, aucun volume, aucun secret dans l'image : il lit ses entrées et dépose ses résultats dans R2
# par des adresses signées que le studio lui donne. Réseau `interne` seulement (jamais exposé).
# Construit SUR LE SERVEUR par deploiement/mettre-a-jour.sh (installation de paquets, sans construction lourde).
# Contexte de construction : la racine du dépôt (voir docker-compose.yml).

# FFmpeg / ffprobe 8.1.1 (09/10, après la panne d'export : le FFmpeg 5.1 de Debian 12 refusait `overlay=format=yuv444p10`).
# Binaires STATIQUES (libx264, libx265, SVT-AV1, zimg/zscale, libvmaf…) d'une image FIGÉE PAR SON EMPREINTE sha256 :
# Docker refuse tout contenu différent, la construction est reproductible. Même FFmpeg dans studio-aligneur et dans
# le studio (Dockerfile racine, 15/10 : format « Image → vidéo »).
# Changer de version : nouvelle étiquette ET nouvelle empreinte, puis deploiement/verifier-outils-video.sh
# (voir docs/JOURNAL-FFMPEG-RECENT.md).
FROM mwader/static-ffmpeg:8.1.1@sha256:735f84b905e00d5c618b667f0b053f83b1096f5fc404c607e6134bf2275a0e0a AS ffmpeg

FROM node:22-bookworm-slim

# Lot M4b : la concurrence du navigateur se règle seule sur les cœurs du conteneur (`cpus:` du compose).
ENV NODE_ENV=production PORT=4100

# Bibliothèques du navigateur sans affichage ; polices de secours. FFmpeg ne vient plus de Debian (étape `ffmpeg`
# ci-dessus) ; Remotion garde son propre compositeur (node_modules/@remotion/compositor-*), indépendant de celui-ci.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-color-emoji \
    libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libasound2 \
    libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 1002 --create-home rendu

# FFmpeg et ffprobe pour la file courte, dans /usr/local/bin (avant /usr/bin dans le PATH) ; contrôlés à la construction.
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
RUN ffmpeg -hide_banner -version >/dev/null && ffprobe -hide_banner -version >/dev/null && ffmpeg -hide_banner -version | head -n 1

# Le paquet vit dans /app/studio-rendu et garde la disposition du dépôt : les compositions et les opérations lisent
# quelques fichiers PURS du studio par des chemins relatifs (`../../../src/...`) — le moteur unique des sous-titres
# (lot M2), la scène de la brique commune « composition » (lot M4, commune depuis le 02/10) et la lecture / le
# contrôle des LUT (lot M4). Rien d'autre du studio n'est copié.
WORKDIR /app/studio-rendu
COPY --chown=rendu:rendu studio-rendu/package.json studio-rendu/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && chown -R rendu:rendu /app
# Les fichiers du studio copiés sous /app/src (schéma Zod, règles) importent `zod` : Node ne remonte jamais par
# /app/studio-rendu/node_modules, d'où ce lien (contrôlé à la construction plus bas).
RUN ln -s /app/studio-rendu/node_modules /app/node_modules

COPY --chown=rendu:rendu studio-rendu/tsconfig.json ./
COPY --chown=rendu:rendu studio-rendu/src ./src
COPY --chown=rendu:rendu studio-rendu/compositions ./compositions
COPY --chown=rendu:rendu src/briques/sous-titres /app/src/briques/sous-titres
COPY --chown=rendu:rendu src/briques/composition/scene.ts /app/src/briques/composition/scene.ts
COPY --chown=rendu:rendu src/briques/habillage-facecam/mise-en-page.ts /app/src/briques/habillage-facecam/mise-en-page.ts
COPY --chown=rendu:rendu src/briques/motion /app/src/briques/motion
COPY --chown=rendu:rendu src/briques/ecrans-motion /app/src/briques/ecrans-motion
# Lot I : brique des effets spéciaux (lot F3), lue par les compositions `commune/effets` (sinon : effet introuvable).
COPY --chown=rendu:rendu src/briques/effets-speciaux /app/src/briques/effets-speciaux
# Types des pistes (main, visage) importés par `effets-speciaux` : `import type` seulement, mais copié pour que le typage
# des compositions (`npm run verifier`) se suffise dans l'image. Fichier pur, sans import.
COPY --chown=rendu:rendu src/briques/realisation/piste.ts /app/src/briques/realisation/piste.ts
# ORG-11 : habillage (charte vidéo), stylo et dessins, lus par les compositions du tableau animé.
COPY --chown=rendu:rendu src/briques/habillage /app/src/briques/habillage
COPY --chown=rendu:rendu src/briques/stylo /app/src/briques/stylo
COPY --chown=rendu:rendu src/briques/dessins /app/src/briques/dessins
COPY --chown=rendu:rendu src/briques/tableau-scene /app/src/briques/tableau-scene
# Format « Image → vidéo » (lot L17) : motion de schéma (types, disposition, caméra, cadrage, lisibilité, micro-objets),
# lu par les compositions `image-video/` (le reste de ce qu'elles lisent est déjà copié ci-dessus).
COPY --chown=rendu:rendu src/briques/schema-motion /app/src/briques/schema-motion
COPY --chown=rendu:rendu src/domaine/facecam-animee/plan.ts /app/src/domaine/facecam-animee/plan.ts
# Carrousels V2-A (opération `visuel-page`) : la porte d'entrée de la page (schéma Zod strict) et ce qu'elle charge, par
# imports RELATIFS (l'image n'a pas d'alias `@/`) — brique des visuels avec ses règles JSON, charte lue par les compositions.
COPY --chown=rendu:rendu src/visuels/proprietes-page.ts /app/src/visuels/proprietes-page.ts
COPY --chown=rendu:rendu src/domaine/visuels /app/src/domaine/visuels
COPY --chown=rendu:rendu src/briques/visuels /app/src/briques/visuels
COPY --chown=rendu:rendu src/lib/lut3d.ts src/lib/qc-lut.ts src/lib/erreur-lisible.ts /app/src/lib/

# Contrôle à la construction : la construction ÉCHOUE si l'opération `visuel-page` ou `assemblage-pdf` ne se charge pas (import nu introuvable…).
RUN node_modules/.bin/tsx -e "Promise.all([import('./src/operations/visuel-page.ts'), import('./src/operations/assemblage-pdf.ts')]).then(() => console.log('visuel-page chargeable'))"

# Utilisateur non root ; le navigateur de Remotion est téléchargé une fois, dans l'image.
USER rendu
RUN node --input-type=module -e "import('@remotion/renderer').then((m) => m.ensureBrowser())"

EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4100/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Priorité basse : le site du studio garde la main sur les processeurs.
CMD ["nice", "-n", "10", "node_modules/.bin/tsx", "src/index.ts"]
