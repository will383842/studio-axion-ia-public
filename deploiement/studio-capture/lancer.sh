#!/bin/sh
# Point d'entrée de studio-capture (T-EXT-51c). Deux modes SEULEMENT, liste fermée :
#   capturer      (défaut, aussi quand le premier argument est une option --xxx) : film de la maquette, 15 min au plus
#   decompresser  : décompresse un .zip client (monté en lecture seule dans /entree) vers /sortie, 5 min au plus
# Les arguments sont transmis tels quels ("$@"), jamais évalués. Codes de sortie propres à ce script :
#   64 = /sortie n'est pas un point de montage ; 65 = /sortie dépasse 4 Gio (non bornée) ; 66 = mode inconnu.
set -eu

MAX_OCTETS=4294967296 # 4 Gio

# /sortie doit être un système de fichiers DÉDIÉ et BORNÉ (le disque du serveur est partagé avec Postgres et les médias).
if ! grep -q ' /sortie ' /proc/self/mountinfo; then
  echo "studio-capture : /sortie n'est pas un point de montage dédié : refus de démarrer (voir docker-compose.yml)." >&2
  exit 64
fi
taille=$(df -B1 --output=size /sortie | tail -n 1 | tr -d ' ')
case "$taille" in
  '' | *[!0-9]*)
    echo "studio-capture : taille de /sortie illisible : refus de démarrer." >&2
    exit 65
    ;;
esac
if [ "$taille" -gt "$MAX_OCTETS" ]; then
  echo "studio-capture : /sortie fait $taille octets (plus de 4 Gio) : elle n'est pas bornée, refus de démarrer. Utiliser un système de fichiers en boucle dédié de 3 Gio (voir docker-compose.yml)." >&2
  exit 65
fi

mode=capturer
if [ "$#" -gt 0 ]; then
  case "$1" in
    capturer | decompresser)
      mode=$1
      shift
      ;;
    --*) ;;
    *)
      echo "studio-capture : mode inconnu « $1 » (capturer ou decompresser)." >&2
      exit 66
      ;;
  esac
fi

case "$mode" in
  capturer)
    exec timeout --kill-after=30 900 node_modules/.bin/tsx outils/maquettes-tableaux-de-bord/capture/capturer.mts "$@"
    ;;
  decompresser)
    exec timeout --kill-after=30 300 node_modules/.bin/tsx outils/maquettes-tableaux-de-bord/capture/decompresser.mts "$@"
    ;;
esac
