#!/usr/bin/env bash
# Mémoire native : remet la base synthétique (sauvegarde pg_dump faite après semer-base-synthetique.mjs), puis mesure.
#   SAUVEGARDE=/chemin/synthetique.dump scripts/memoire-native/scenario.sh <nom> [options de mesurer.mjs…]
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
nom="$1"; shift
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" "${SAUVEGARDE:?SAUVEGARDE manquante}"
cd "$ici/../.."
timeout 900 node scripts/memoire-native/mesurer.mjs --nom "$nom" "$@"
