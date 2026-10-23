#!/usr/bin/env bash
# NETTOYAGE SÛR DU DISQUE (vérif V5) — lancé par cron chaque nuit à 04:15 (fichier versionné : deploiement/crontab).
#
# Ne retire QUE des fichiers de travail jetables :
#  1. les images Docker SANS NOM (`docker image prune -f` : jamais une image étiquetée, donc jamais :local, :precedente,
#     :bonne, :refusee, :annulee) ;
#  2. le cache de construction de plus de 7 jours (`docker builder prune --filter until=168h`) ;
#  3. dans studio-rendu et studio-aligneur, les dossiers TEMPORAIRES de plus de 24 h, par nom connu (studio-rendu-*,
#     remotion-*, react-motion-*, controle-ffmpeg-*, calage-*) : aucun travail ne dure 24 h, un dossier si vieux est
#     celui d'un processus tué. Les travaux face caméra (/app/travaux) ne sont PAS touchés ici : studio-aligneur oublie
#     lui-même les travaux finis de plus de 24 h et efface les fichiers lourds d'un travail en échec.
# JAMAIS : `docker volume prune`, `docker system prune`, la base (volume `donnees`), le dossier des travaux, ni
# /opt/studio-axion-ia/sauvegardes (les copies avant-maj sont seulement comptées dans le compte rendu).
# Journal : /opt/studio-axion-ia/surveillance/nettoyage.log. Disque encore au-delà de 85 % après nettoyage → alerte.
set -uo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploiement/commun.sh
source "$ICI/commun.sh"
# shellcheck source=deploiement/alerte.sh
source "$ICI/alerte.sh"

DOSSIER="$RACINE/surveillance"
JOURNAL="$DOSSIER/nettoyage.log"
SEUIL_DISQUE="${STUDIO_SEUIL_DISQUE_PCT:-85}"
mkdir -p "$DOSSIER"

journal() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$JOURNAL"
  echo "$*"
}
utilise() { df -P "$RACINE" 2>/dev/null | awk 'NR==2 { gsub("%", "", $5); print $5 }'; }

avant="$(utilise)"
if docker image prune -f >/dev/null; then journal "images sans nom retirées"; else journal "images sans nom : échec (ignoré)"; fi
if docker builder prune -f --filter until=168h >/dev/null; then
  journal "cache de construction de plus de 7 jours retiré"
else
  journal "cache de construction : échec (ignoré)"
fi

# Dossiers temporaires d'un processus tué, par nom connu, plus de 24 h. Rien d'autre dans /tmp n'est touché.
# shellcheck disable=SC2016 # $1 est développé DANS le conteneur (sh -c … nettoyage /tmp)
NETTOYAGE_TMP='find "$1" -mindepth 1 -maxdepth 1 -type d -mmin +1440 \( -name "studio-rendu-*" -o -name "remotion-*" -o -name "react-motion-*" -o -name "controle-ffmpeg-*" -o -name "calage-*" \) -print -exec rm -rf {} +'
for service in studio-rendu studio-aligneur; do
  id="$(compose --profile calage ps -q "$service" 2>/dev/null | head -n 1)"
  [ -n "$id" ] || continue
  effaces="$(docker exec "$id" sh -c "$NETTOYAGE_TMP" nettoyage /tmp 2>/dev/null | wc -l)"
  journal "$service : $effaces dossier(s) temporaire(s) de plus de 24 h effacé(s)"
done

apres="$(utilise)"
copies="$(find "$RACINE/sauvegardes" -maxdepth 1 -name 'avant-maj-*.sql.gz' 2>/dev/null | wc -l)"
journal "disque : ${avant:-?} % → ${apres:-?} % ; copies avant-maj gardées : $copies (jamais effacées ici)"
if [ "${apres:-0}" -ge "$SEUIL_DISQUE" ] 2>/dev/null; then
  alerter_une_fois "$DOSSIER" disque "Studio Axion-IA : disque à ${apres} % après nettoyage" \
    "Le nettoyage sûr n'a pas suffi (${apres} %). À regarder : images :refusee / :annulee (docker image ls), copies avant-maj anciennes dans $RACINE/sauvegardes (déjà dans R2 ?), docker system df."
  exit 2
fi
exit 0
