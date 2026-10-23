#!/usr/bin/env bash
# Sauvegarde quotidienne de la base du studio — lancée par cron à 03:30 (fichier versionné : deploiement/crontab).
#
# Audit D, B8 (avant : un `pg_dump | gzip` sur le MÊME disque que la base, sans contrôle ni alerte ni copie hors site) :
#  1. pg_dump dans un fichier TEMPORAIRE, vérifié (`gunzip -t`, taille minimale, fin de dump présente), puis `mv` :
#     un dump raté ne ressemble plus jamais à une sauvegarde valide ;
#  2. COPIE HORS SITE dans R2, préfixe `studio/sauvegardes/` (mêmes variables R2_* que le studio, aucune nouvelle clé) ;
#     une copie ratée est retentée aux passages suivants ; RIEN n'est jamais effacé ni écrasé dans R2 ;
#  3. rotation LOCALE : une sauvegarde locale de plus de 14 jours n'est effacée QUE si sa copie R2 est confirmée
#     (fichier témoin `.r2`) ; sans copie confirmée, elle est gardée ;
#  4. journal : /opt/studio-axion-ia/sauvegardes/sauvegardes.log ; en cas d'échec : ligne « ÉCHEC », fichier DERNIER-ECHEC,
#     message sur la sortie d'erreur (cron) et e-mail d'alerte (ZeptoMail, variables EMAIL_SECOURS_* déjà présentes).
#
# Restauration (essai à faire une fois par mois, dans une base À PART) : voir deploiement/README.md.
set -Eeuo pipefail
umask 077

RACINE="${STUDIO_RACINE:-/opt/studio-axion-ia}"
DOSSIER="$RACINE/sauvegardes"
JOURNAL="$DOSSIER/sauvegardes.log"
FICHIER_ENV="$RACINE/.env"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENEUR_BASE="${STUDIO_CONTENEUR_BASE:-studio-axion-ia-base-1}"
# Image qui fournit Node 22 pour la copie R2 (celle du studio, déjà construite sur le serveur).
IMAGE_NODE="${STUDIO_IMAGE_NODE:-studio-axion-ia:local}"
# Taille minimale d'une sauvegarde compressée (octets) : la base réelle pèse bien plus ; en dessous, c'est un dump raté.
TAILLE_MIN="${SAUVEGARDE_TAILLE_MIN:-20000}"
JOURS_LOCAUX=14

mkdir -p "$DOSSIER"
TEMPORAIRE=""
ETAPE="démarrage"

journal() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$JOURNAL"
}

# Lit une variable du .env du serveur (dernière occurrence, guillemets simples ou doubles retirés).
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

VARIABLES=(R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_HOST EMAIL_SECOURS_CLE EMAIL_SECOURS_EXPEDITEUR EMAIL_SECOURS_DESTINATAIRE EMAIL_SECOURS_ADRESSE)
for v in "${VARIABLES[@]}"; do
  valeur="$(lire_env "$v")"
  export "$v=$valeur"
done

# Node 22 dans un conteneur jetable de l'image du studio : les secrets passent par l'environnement (-e NOM, sans valeur
# sur la ligne de commande), le script est monté en lecture seule, l'entrée standard porte le fichier.
node_copie() {
  local options=()
  for v in "${VARIABLES[@]}"; do options+=(-e "$v"); done
  docker run --rm -i --memory 1g --entrypoint node "${options[@]}" \
    -v "$ICI/copier-r2.mjs:/copie/copier-r2.mjs:ro" "$IMAGE_NODE" /copie/copier-r2.mjs "$@"
}

alerte() {
  node_copie alerte "$1" "$2" </dev/null >>"$JOURNAL" 2>&1 || journal "alerte e-mail impossible (voir ci-dessus)"
}

echec() {
  local code=$?
  trap - ERR
  journal "ÉCHEC de la sauvegarde (étape : $ETAPE, code $code)"
  echo "ÉCHEC de la sauvegarde du studio (étape : $ETAPE). Journal : $JOURNAL" >&2
  date '+%F %T' >"$DOSSIER/DERNIER-ECHEC"
  [ -n "$TEMPORAIRE" ] && rm -f "$TEMPORAIRE"
  alerte "Studio Axion-IA : sauvegarde en ÉCHEC" "Étape : $ETAPE (code $code), le $(date '+%F à %T')."
  exit "$code"
}
trap echec ERR

# 1. Dump dans un fichier temporaire, vérifié avant d'être gardé.
ETAPE="pg_dump"
TEMPORAIRE="$(mktemp "$DOSSIER/.studio-XXXXXX.sql.gz.part")"
docker exec "$CONTENEUR_BASE" pg_dump -U studio -d studio | gzip >"$TEMPORAIRE"

ETAPE="vérification (gunzip -t)"
gunzip -t "$TEMPORAIRE"
ETAPE="vérification (taille minimale)"
TAILLE="$(stat -c %s "$TEMPORAIRE")"
if [ "$TAILLE" -lt "$TAILLE_MIN" ]; then
  journal "sauvegarde trop petite : $TAILLE octets (minimum $TAILLE_MIN)"
  false
fi
ETAPE="vérification (fin du dump)"
FIN="$(gunzip -c "$TEMPORAIRE" | tail -n 5)"
grep -q "PostgreSQL database dump complete" <<<"$FIN"

ETAPE="rangement"
NOM="studio-$(date +%F_%H%M%S).sql.gz"
mv "$TEMPORAIRE" "$DOSSIER/$NOM"
TEMPORAIRE=""
journal "sauvegarde locale vérifiée : $NOM ($TAILLE octets)"

# 2. Copie hors site (R2) : la sauvegarde du jour, et toute ancienne dont la copie avait échoué.
ETAPE="copie hors site (R2)"
if [ -z "$R2_ACCOUNT_ID" ] || [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_BUCKET" ]; then
  journal "variables R2_* absentes de $FICHIER_ENV : AUCUNE copie hors site"
  false
fi
RATES=0
for f in "$DOSSIER"/studio-*.sql.gz; do
  [ -e "$f" ] || continue
  [ -e "$f.r2" ] && continue
  # Ancienne sauvegarde illisible (dump raté de l'ancien script) : mise de côté, jamais effacée, jamais copiée.
  if [ ! -s "$f" ] || ! gunzip -t "$f" 2>/dev/null; then
    mv -- "$f" "$f.invalide"
    journal "illisible, mise de côté (non copiée) : $(basename "$f").invalide"
    continue
  fi
  # shellcheck disable=SC2094 # faux positif : on lit la sauvegarde $f, on écrit dans le journal (fichiers différents)
  if node_copie envoyer "$(basename "$f")" <"$f" >>"$JOURNAL" 2>&1; then
    date '+%F %T' >"$f.r2"
  else
    RATES=$((RATES + 1))
    journal "copie R2 ratée : $(basename "$f") (retentée au prochain passage)"
  fi
done
if [ "$RATES" -gt 0 ]; then
  false
fi

# 3. Rotation locale : plus de 14 jours ET copie R2 confirmée. Rien n'est jamais effacé dans R2.
ETAPE="rotation locale"
while IFS= read -r -d '' f; do
  if [ -e "$f.r2" ]; then
    rm -f -- "$f" "$f.r2"
    journal "rotation locale : $(basename "$f") (la copie R2 reste)"
  else
    journal "gardée : $(basename "$f") a plus de $JOURS_LOCAUX jours mais aucune copie R2 confirmée"
  fi
done < <(find "$DOSSIER" -maxdepth 1 -type f -name 'studio-*.sql.gz' -mtime +$((JOURS_LOCAUX - 1)) -print0)
# Fichiers temporaires d'un passage interrompu (jamais une sauvegarde valide).
find "$DOSSIER" -maxdepth 1 -type f -name '.studio-*.sql.gz.part' -mmin +1440 -delete

date '+%F %T' >"$DOSSIER/DERNIER-SUCCES"
journal "OK : $NOM vérifiée, copiée hors site (R2 studio/sauvegardes/)"
