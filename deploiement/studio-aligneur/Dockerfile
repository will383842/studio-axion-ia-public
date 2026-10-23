# studio-aligneur — calage des sous-titres au mot près (lot « calage », D3, plan B.5).
# Python 3.11 + FFmpeg 8.1 + PyTorch (processeur seul) + le modèle wav2vec2 français que WhisperX choisit
# (VOXPOPULI_ASR_BASE_10K_FR), TÉLÉCHARGÉ À LA CONSTRUCTION : aucun téléchargement au premier appel.
# Sans état : aucune base, aucun volume, aucun secret dans l'image. Le son est lu par une adresse signée que le studio
# lui donne, dans un dossier temporaire effacé après chaque demande. Réseau `interne` seulement (jamais exposé).
# Une demande à la fois ; mémoire mesurée ≈ 1,7 Go au plus pour 75 s de son (morceaux de 25 s).
# Plan facecam v4 (lot B) : routes face caméra /transcrire (faster-whisper small int8), /visages (MediaPipe), /son
# (DeepFilterNet, secours afftdn), /image (OpenCV) ; modèles téléchargés eux aussi à la construction ; un travail lourd
# à la fois, sur disque, par tranches de 30 s (bibliothèques EGL/GLES : exigées au chargement par MediaPipe).
# Construit SUR LE SERVEUR par deploiement/mettre-a-jour.sh. Contexte de construction : la racine du dépôt.

# FFmpeg / ffprobe 8.1.1 statiques, image FIGÉE PAR SON EMPREINTE (la même que studio-rendu ; voir
# docs/JOURNAL-FFMPEG-RECENT.md). Le FFmpeg 5.1 de Debian 12 n'est plus installé.
FROM mwader/static-ffmpeg:8.1.1@sha256:735f84b905e00d5c618b667f0b053f83b1096f5fc404c607e6134bf2275a0e0a AS ffmpeg

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=4200 STUDIO_ALIGNEUR_FILS=2 \
    TORCH_HOME=/app/modeles OMP_NUM_THREADS=2 XDG_CACHE_HOME=/app/modeles/cache

# Bibliothèques demandées par OpenCV et MediaPipe (libGL, EGL, GLES, GLib ; libSM et libXext venaient avant avec le
# paquet ffmpeg de Debian et servent au module graphique d'OpenCV : gardées pour ne rien changer).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libegl1 libgles2 libgl1 libglib2.0-0 libsm6 libxext6 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 1003 --create-home aligneur

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
RUN ffmpeg -hide_banner -version >/dev/null && ffprobe -hide_banner -version >/dev/null && ffmpeg -hide_banner -version | head -n 1

WORKDIR /app
COPY studio-aligneur/requirements.txt ./requirements.txt
COPY studio-aligneur/requirements-sans-dependances.txt ./requirements-sans-dependances.txt
RUN pip install --no-cache-dir -r requirements.txt \
  && pip install --no-cache-dir --no-deps -r requirements-sans-dependances.txt

COPY studio-aligneur/aligneur ./aligneur
COPY studio-aligneur/tests ./tests

# Contrôles purs (texte, file, protocole), import d'OpenCV et MediaPipe (une bibliothèque système manquante arrête la
# construction, avant toute mise en ligne), puis modèle téléchargé une fois, dans l'image.
RUN python -m unittest discover -s tests -t . \
  && python -c "import cv2, mediapipe, numpy" \
  && python -m aligneur --precharger \
  && rm -rf tests \
  && mkdir -p /app/travaux \
  && chown -R aligneur:aligneur /app

USER aligneur
EXPOSE 4200
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:4200/sante', timeout=4).status == 200 else 1)"
# Priorité basse : le site du studio garde la main sur les processeurs.
CMD ["nice", "-n", "10", "python", "-m", "aligneur"]
