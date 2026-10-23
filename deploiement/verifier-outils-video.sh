#!/usr/bin/env bash
# CONTRÔLE RÉEL DES OUTILS VIDÉO, dans les images FRAÎCHEMENT CONSTRUITES, AVANT toute mise en ligne (09/10).
#
# Panne du 09/10 : l'export face caméra a échoué en production car le FFmpeg de l'image (5.1, Debian 12) refusait
# `overlay=format=yuv444p10` ; les tests vérifiaient le TEXTE des commandes sans jamais les exécuter avec ce FFmpeg-là.
# Ici, les commandes écrites par le code sont EXÉCUTÉES dans les conteneurs, sans réseau, sur des sources lavfi courtes :
#   - studio-rendu    : studio-rendu/src/controle-ffmpeg.ts (grapheExport 8 et 10 bits, export libx264 High 4.1 en
#                       2 passes et CRF, masters avocat et face caméra, chaîne du son loudnorm / ebur128, étalonnage,
#                       étiquettes BT.709 ; 10/10 : retouche face caméra avec zoom et carte plein écran, COULEURS de
#                       l'image filmée mesurées sur une mire au master et à l'export, garde-fou des couleurs éprouvé) ;
#                       puis les bibliothèques du navigateur et du compositeur de Remotion (ldd) ;
#   - studio-aligneur : aligneur/controle_ffmpeg.py (decor.py, media.py, son.py dont afftdn et loudnorm, image.py,
#                       calage.py ; HDR → SDR par zscale ; étiquettes et matrice BT.709 ; 10/10 : cadrage avec un plan
#                       serré à 130 % (zoom demandé), couleurs de la peau mesurées) ;
#   - studio (15/10)  : deploiement/studio/controle-ffmpeg-iv.mjs (format « Image → vidéo » : conversion de l'image en
#                       PNG, entière et 4 tuiles, par `argumentsMorceau` ; images noires et figées par
#                       `argumentsNoirEtFige`, mesurées sur un fichier piégé ; son brut MP3 → WAV mono par
#                       `argumentsSonWav`, sans décalage). Panne du 15/10 : FFmpeg absent du conteneur.
# Une seule commande qui ne s'initialise pas → message clair et code 1. Appelé par mettre-a-jour.sh APRÈS la
# construction et AVANT la sauvegarde / `up -d` : en cas d'échec, rien n'est redémarré.
#
#   bash deploiement/verifier-outils-video.sh                    # studio-axion-ia:local, studio-rendu:local, studio-aligneur:local
#   bash deploiement/verifier-outils-video.sh --sans-aligneur    # calage éteint : studio-rendu seul
#   IMAGE_STUDIO=… IMAGE_RENDU=… IMAGE_ALIGNEUR=… bash deploiement/verifier-outils-video.sh   # autres étiquettes d'images
set -euo pipefail

IMAGE_STUDIO="${IMAGE_STUDIO:-studio-axion-ia:local}"
IMAGE_RENDU="${IMAGE_RENDU:-studio-rendu:local}"
IMAGE_ALIGNEUR="${IMAGE_ALIGNEUR:-studio-aligneur:local}"
# Vérif V5 : le contrôle tourne À CÔTÉ du studio en service et du site (serveur de 15 Go) : mémoire bornée. Un contrôle
# tué faute de mémoire (code 137) apparaît comme un échec ; le relancer avec STUDIO_CONTROLE_MEMOIRE=4g.
MEMOIRE="${STUDIO_CONTROLE_MEMOIRE:-3g}"
AVEC_ALIGNEUR=1
for argument in "$@"; do
  case "$argument" in
    --sans-aligneur) AVEC_ALIGNEUR=0 ;;
    *) echo "Option inconnue : $argument (seule option : --sans-aligneur)" >&2; exit 2 ;;
  esac
done

echecs=()

# Une étape : son nom, puis la commande. Sa sortie est affichée telle quelle (une ligne par contrôle).
etape() {
  local nom="$1"
  shift
  echo ""
  echo "── $nom"
  if ! "$@"; then
    echecs+=("$nom")
  fi
}

# Bibliothèques des exécutables du navigateur (Chrome Headless Shell) et du compositeur de Remotion : aucune « not found »
# (le paquet ffmpeg de Debian, retiré, en apportait beaucoup). Chaque binaire cherche aussi à côté de lui (comme Remotion).
LDD_REMOTION='
manque=0; vus=0
for f in $(find node_modules/.remotion node_modules/@remotion/compositor-linux-x64-gnu -type f 2>/dev/null); do
  head -c 4 "$f" 2>/dev/null | grep -q "ELF" || continue
  vus=$((vus + 1))
  absentes=$(LD_LIBRARY_PATH="$(dirname "$f")" ldd "$f" 2>/dev/null | grep "not found" || true)
  if [ -n "$absentes" ]; then manque=1; echo "ÉCHEC $f"; echo "$absentes" | sed "s/^/      /"; fi
done
if [ "$vus" -eq 0 ]; then echo "ÉCHEC aucun exécutable de Remotion trouvé (navigateur non téléchargé ?)"; exit 1; fi
[ "$manque" -eq 0 ] && echo "OK    $vus exécutables du navigateur et du compositeur : toutes leurs bibliothèques sont là"
exit "$manque"'

image_presente() {
  if ! docker image inspect "$1" >/dev/null 2>&1; then
    echo "ÉCHEC image $1 introuvable (construction ratée ?)"
    return 1
  fi
}

echo "Contrôle réel des outils vidéo dans les images construites (sans réseau)…"
if image_presente "$IMAGE_STUDIO"; then
  # Les commandes du format « Image → vidéo » que le studio exécute lui-même (lecture de l'image, mesure Q24).
  etape "studio : commandes FFmpeg du format Image → vidéo ($IMAGE_STUDIO)" \
    docker run --rm --network none --memory "$MEMOIRE" --workdir /app/controle-iv "$IMAGE_STUDIO" \
      node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      deploiement/studio/controle-ffmpeg-iv.mjs
  # ffprobe : sonde des vidéos de banque (étape « vidéos » de la face caméra animée), absent = montage bloqué à tort.
  etape "studio : ffprobe ($IMAGE_STUDIO)"     docker run --rm --network none "$IMAGE_STUDIO" ffprobe -hide_banner -version
else
  echecs+=("studio : image absente")
fi
if image_presente "$IMAGE_RENDU"; then
  etape "studio-rendu : commandes FFmpeg du code ($IMAGE_RENDU)" \
    docker run --rm --network none --memory "$MEMOIRE" "$IMAGE_RENDU" node_modules/.bin/tsx src/controle-ffmpeg.ts
  etape "studio-rendu : bibliothèques de Remotion ($IMAGE_RENDU)" \
    docker run --rm --network none --memory "$MEMOIRE" "$IMAGE_RENDU" sh -c "$LDD_REMOTION"
else
  echecs+=("studio-rendu : image absente")
fi

if [ "$AVEC_ALIGNEUR" -eq 1 ]; then
  if image_presente "$IMAGE_ALIGNEUR"; then
    etape "studio-aligneur : commandes FFmpeg du code ($IMAGE_ALIGNEUR)" \
      docker run --rm --network none --memory "$MEMOIRE" "$IMAGE_ALIGNEUR" python -m aligneur.controle_ffmpeg
  else
    echecs+=("studio-aligneur : image absente")
  fi
fi

echo ""
if [ "${#echecs[@]}" -gt 0 ]; then
  echo "ÉCHEC DU CONTRÔLE DES OUTILS VIDÉO :" >&2
  for e in "${echecs[@]}"; do echo "  - $e" >&2; done
  echo "Ces images ne doivent PAS être mises en ligne (détail de chaque commande ci-dessus)." >&2
  exit 1
fi
echo "Outils vidéo contrôlés : toutes les commandes s'exécutent dans les images construites."
