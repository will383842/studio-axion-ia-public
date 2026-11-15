#!/usr/bin/env bash
# Sauvegarde nocturne des MÉDIAS (seau R2 → seau de secours) — lancée par cron à 04:00 (fichier versionné : deploiement/crontab).
#
# L2-12b : exécute « node copier-r2.mjs medias-delta » dans un conteneur jetable de l'image du studio, comme sauvegarder.sh.
# Contrat de copier-r2.mjs : code 0 = copie complète ; 1 = au moins un échec ; 3 = R2 ou R2_BUCKET_SECOURS absent (aucune
# requête faite) ; dernière ligne de sortie {"copies":N,"deja":M,"echecs":E}.
# Cette sauvegarde COPIE seulement : jamais de suppression, jamais d'écrasement, rien n'est touché dans le seau source.
# Alerte (copier-r2.mjs alerte) : sans clé ni adresse e-mail dans le texte.
# Journal : /opt/studio-axion-ia/sauvegardes/sauvegardes-medias.log
set -uo pipefail
umask 077

RACINE="${STUDIO_RACINE:-/opt/studio-axion-ia}"
DOSSIER="$RACINE/sauvegardes"
JOURNAL="$DOSSIER/sauvegardes-medias.log"
FICHIER_ENV="$RACINE/.env"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NODE="${STUDIO_IMAGE_NODE:-studio-axion-ia:local}"

mkdir -p "$DOSSIER"

journal() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$JOURNAL"
}

lire_env() {
  local ligne=""
  [ -r "$FICHIER_ENV" ] && ligne="$(grep -E "^$1=" "$FICHIER_ENV" | tail -n 1 || true)"
  ligne="${ligne#*=}"
  ligne="${ligne%\"}"
  ligne="${ligne#\"}"
  ligne="${ligne%\'}"
  ligne="${ligne#\'}"
  printf '%s' "$ligne"
}

VARIABLES=(R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_BUCKET_SECOURS R2_PUBLIC_HOST EMAIL_SECOURS_CLE EMAIL_SECOURS_EXPEDITEUR EMAIL_SECOURS_DESTINATAIRE EMAIL_SECOURS_ADRESSE)
for v in "${VARIABLES[@]}"; do
  export "$v=$(lire_env "$v")"
done

node_copie() {
  local options=()
  for v in "${VARIABLES[@]}"; do options+=(-e "$v"); done
  docker run --rm -i --memory 1g --entrypoint node "${options[@]}" \
    -v "$ICI/copier-r2.mjs:/copie/copier-r2.mjs:ro" "$IMAGE_NODE" /copie/copier-r2.mjs "$@"
}

alerte() {
  node_copie alerte "$1" "$2" </dev/null >>"$JOURNAL" 2>&1 || journal "alerte e-mail impossible (voir ci-dessus)"
}

if [ -z "$R2_ACCOUNT_ID" ] || [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_BUCKET" ] || [ -z "$R2_BUCKET_SECOURS" ]; then
  journal "ÉCHEC : R2 ou seau de secours absent du .env : AUCUNE copie des médias"
  alerte "Studio Axion-IA : sauvegarde des médias impossible" "Le stockage R2 ou le seau de secours n'est pas renseigné : aucune copie des médias cette nuit, le $(date '+%F à %T')."
  exit 3
fi

SORTIE="$(node_copie medias-delta </dev/null 2>&1)"
CODE=$?
RESUME="$(printf '%s\n' "$SORTIE" | tail -n 1)"

case "$CODE" in
  0)
    journal "OK sauvegarde des médias : $RESUME"
    ;;
  3)
    journal "ÉCHEC : R2 ou seau de secours absent (code 3) : AUCUNE copie des médias"
    alerte "Studio Axion-IA : sauvegarde des médias impossible" "Le stockage R2 ou le seau de secours n'est pas renseigné : aucune copie des médias cette nuit, le $(date '+%F à %T')."
    exit 3
    ;;
  *)
    journal "ÉCHEC de la sauvegarde des médias (code $CODE) : $RESUME"
    alerte "Studio Axion-IA : sauvegarde des médias en ÉCHEC" "La copie des médias vers le seau de secours a échoué (code $CODE), le $(date '+%F à %T'). Rien n'a été supprimé ni écrasé. Journal : $JOURNAL"
    exit "$CODE"
    ;;
esac
