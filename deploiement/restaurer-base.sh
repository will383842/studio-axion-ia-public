#!/usr/bin/env bash
# RESTAURATION DE LA BASE depuis une sauvegarde vérifiée (vérif V5) — surtout la copie faite AVANT une mise à jour :
#   bash /opt/studio-axion-ia/source/deploiement/restaurer-base.sh /opt/studio-axion-ia/sauvegardes/avant-maj-AAAA-MM-JJ_HHMMSS.sql.gz
#
# Cas d'usage : une mise à jour a migré les données et la version précédente ne sait pas les relire. Ordre :
#   1. bash …/revenir.sh                 (images précédentes)
#   2. bash …/restaurer-base.sh <copie avant-maj>
# Ce que fait le script (RIEN n'est jamais effacé) :
#   - vérifie la copie (gunzip -t, fin de dump) AVANT de toucher à quoi que ce soit ;
#   - arrête le studio seul (plus aucune écriture ; la base reste allumée) ;
#   - RENOMME la base en service en `studio_avant_restauration_AAAAMMJJ_HHMMSS` (gardée, à effacer plus tard par Will) ;
#   - crée une base `studio` neuve, y charge la copie (arrêt à la première erreur), vérifie qu'elle contient des documents ;
#   - en cas d'échec : la base neuve ratée est mise de côté et l'ancienne reprend son nom ; le studio redémarre ;
#   - redémarre le studio.
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploiement/commun.sh
source "$ICI/commun.sh"
# Même verrou que mettre-a-jour.sh (relecture 18/10) : jamais en même temps qu'une mise à jour, un retour arrière ou
# une restauration. Déjà pris : code 5, rien n'est fait (arrêter d'abord l'autre opération : ps -fp <PID>).
prendre_verrou_mise_a_jour
cd "$ICI"

FICHIER="${1:-}"
if [ -z "$FICHIER" ] || [ ! -f "$FICHIER" ]; then
  echo "Usage : restaurer-base.sh <sauvegarde .sql.gz> (fichier introuvable : « $FICHIER »)." >&2
  exit 2
fi
if ! gunzip -t "$FICHIER" 2>/dev/null || ! gunzip -c "$FICHIER" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "ÉCHEC : $FICHIER n'est pas une sauvegarde complète (gunzip -t ou fin de dump). Rien n'a été touché." >&2
  exit 1
fi
if [ "$(etat_service base)" = absent ]; then
  echo "ÉCHEC : la base n'est pas démarrée (docker compose ps). Rien n'a été touché." >&2
  exit 1
fi

sql() {
  compose exec -T base psql -v ON_ERROR_STOP=1 -q -U studio -d postgres -c "$1"
}

GARDEE="studio_avant_restauration_$(date +%Y%m%d_%H%M%S)"
echo "Arrêt du studio (la base reste allumée)…"
compose stop studio
sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'studio' AND pid <> pg_backend_pid();" >/dev/null
sql "ALTER DATABASE studio RENAME TO $GARDEE;"
echo "Base en service gardée sous le nom $GARDEE."

if sql "CREATE DATABASE studio OWNER studio;" \
  && gunzip -c "$FICHIER" | compose exec -T base psql -v ON_ERROR_STOP=1 -q -U studio -d studio >/dev/null \
  && [ "$(compose exec -T base psql -tA -U studio -d studio -c 'SELECT count(*) FROM documents')" -gt 0 ]; then
  compose start studio
  echo "Base restaurée depuis $(basename "$FICHIER"). L'ancienne est gardée : $GARDEE (DROP DATABASE à la main, plus tard)."
  exit 0
fi

echo "" >&2
echo "ÉCHEC du chargement de $(basename "$FICHIER") : retour à la base d'avant." >&2
RATEE="studio_restauration_ratee_$(date +%Y%m%d_%H%M%S)"
sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'studio' AND pid <> pg_backend_pid();" >/dev/null || true
sql "ALTER DATABASE studio RENAME TO $RATEE;" 2>/dev/null || true
sql "ALTER DATABASE $GARDEE RENAME TO studio;"
compose start studio
echo "La base d'avant est de nouveau en service. Tentative ratée gardée sous $RATEE (si elle existe)." >&2
exit 1
