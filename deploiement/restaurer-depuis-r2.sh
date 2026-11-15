#!/usr/bin/env bash
# REPRISE APRÈS PANNE : prépare (et, SEULEMENT sur ordre explicite, lance) la restauration de la base depuis une
# sauvegarde conservée dans R2 (préfixe studio/sauvegardes/). Ne se lance jamais seul : aucun cron, aucun appel
# depuis un autre script.
#
#   bash restaurer-depuis-r2.sh --fichier <copie.sql.gz>          SIMULATION (défaut) : vérifie la copie, ne touche à rien
#   bash restaurer-depuis-r2.sh --cle studio/sauvegardes/<nom>     idem, en téléchargeant d'abord la copie (aws cli requis)
#   bash restaurer-depuis-r2.sh … --executer                       restauration réelle, après confirmation écrite au clavier
#
# Garanties :
#   - mode simulation par défaut : sans --executer, rien n'est modifié (ni base, ni R2, ni disque hors dossier de téléchargement) ;
#   - la restauration réelle est confiée à restaurer-base.sh, qui NE SUPPRIME RIEN : la base en service est renommée
#     (studio_avant_restauration_…), jamais écrasée ni effacée ;
#   - avec --executer, il faut taper la phrase exacte « RESTAURER » (aucune confirmation par variable ou option) ;
#   - jamais de DELETE vers R2 ; aucun secret dans ce fichier : les clés R2 viennent de l'environnement ou du .env du serveur.
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="${STUDIO_RACINE:-/opt/studio-axion-ia}"
ENV_FICHIER="${STUDIO_ENV_FICHIER:-$RACINE/.env}"
DOSSIER_TELECHARGEMENT="${STUDIO_DOSSIER_REPRISE:-$RACINE/sauvegardes/reprise}"

FICHIER="" CLE="" EXECUTER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --fichier) FICHIER="${2:-}"; shift 2 ;;
    --cle) CLE="${2:-}"; shift 2 ;;
    --executer) EXECUTER=1; shift ;;
    *) echo "Option inconnue : $1 (voir l'en-tête du script)." >&2; exit 2 ;;
  esac
done
if { [ -z "$FICHIER" ] && [ -z "$CLE" ]; } || { [ -n "$FICHIER" ] && [ -n "$CLE" ]; }; then
  echo "Usage : restaurer-depuis-r2.sh (--fichier <copie.sql.gz> | --cle studio/sauvegardes/<nom>) [--executer]" >&2
  exit 2
fi

lire_env() { # valeur d'une variable : environnement d'abord, puis .env (jamais affichée)
  local v="${!1:-}"
  if [ -z "$v" ] && [ -f "$ENV_FICHIER" ]; then
    v="$(grep -E "^$1=" "$ENV_FICHIER" | tail -n 1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//")"
  fi
  printf '%s' "$v"
}

if [ -n "$CLE" ]; then
  case "$CLE" in
    studio/sauvegardes/*.sql.gz) ;;
    *) echo "REFUSÉ : la clé doit être de la forme studio/sauvegardes/<nom>.sql.gz." >&2; exit 2 ;;
  esac
  case "$CLE" in *..*|*[[:space:]]*) echo "REFUSÉ : clé invalide." >&2; exit 2 ;; esac
  BUCKET="$(lire_env R2_BUCKET)"; COMPTE="$(lire_env R2_ACCOUNT_ID)"
  AK="$(lire_env R2_ACCESS_KEY_ID)"; SK="$(lire_env R2_SECRET_ACCESS_KEY)"
  if [ -z "$BUCKET" ] || [ -z "$COMPTE" ] || [ -z "$AK" ] || [ -z "$SK" ]; then
    echo "ÉCHEC : variables R2_* absentes (environnement ou $ENV_FICHIER). Télécharger la copie à la main (tableau de bord R2) puis utiliser --fichier." >&2
    exit 1
  fi
  FICHIER="$DOSSIER_TELECHARGEMENT/$(basename "$CLE")"
  if [ "$EXECUTER" = 0 ]; then
    echo "SIMULATION : téléchargerait s3://$BUCKET/$CLE vers $FICHIER (aucune action, aucun fichier créé)."
  else
    command -v aws >/dev/null 2>&1 || { echo "ÉCHEC : aws cli introuvable ; télécharger à la main puis utiliser --fichier." >&2; exit 1; }
    if [ -e "$FICHIER" ]; then echo "REFUSÉ : $FICHIER existe déjà (rien n'est écrasé)." >&2; exit 1; fi
    mkdir -p "$DOSSIER_TELECHARGEMENT"
    AWS_ACCESS_KEY_ID="$AK" AWS_SECRET_ACCESS_KEY="$SK" AWS_DEFAULT_REGION=auto \
      aws s3 cp "s3://$BUCKET/$CLE" "$FICHIER" --endpoint-url "https://$COMPTE.r2.cloudflarestorage.com" --only-show-errors
  fi
fi

if [ ! -f "$FICHIER" ]; then
  if [ -n "$CLE" ] && [ "$EXECUTER" = 0 ]; then
    echo "SIMULATION terminée : rien n'a été téléchargé, rien n'a été touché. Relancer avec --executer pour restaurer."
    exit 0
  fi
  echo "ÉCHEC : fichier introuvable : « $FICHIER »." >&2
  exit 1
fi
if ! gunzip -t "$FICHIER" 2>/dev/null || ! gunzip -c "$FICHIER" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "ÉCHEC : $FICHIER n'est pas une sauvegarde complète (gunzip -t ou fin de dump). Rien n'a été touché." >&2
  exit 1
fi
echo "Copie vérifiée : $(basename "$FICHIER") ($(stat -c %s "$FICHIER") octets)."

if [ "$EXECUTER" = 0 ]; then
  echo "SIMULATION : lancerait « restaurer-base.sh $FICHIER » (la base en service serait RENOMMÉE, jamais effacée)."
  echo "Rien n'a été modifié. Pour restaurer pour de bon : relancer la même commande avec --executer."
  exit 0
fi

if [ ! -t 0 ]; then
  echo "REFUSÉ : la confirmation doit être tapée au clavier (terminal interactif). Rien n'a été touché." >&2
  exit 2
fi
echo "ATTENTION : le studio va être arrêté, la base actuelle renommée (conservée), puis remplacée par cette copie."
printf 'Taper RESTAURER pour continuer (autre chose : abandon) : '
read -r REPONSE
if [ "$REPONSE" != "RESTAURER" ]; then
  echo "Abandon : rien n'a été touché."
  exit 3
fi
exec bash "$ICI/restaurer-base.sh" "$FICHIER"
