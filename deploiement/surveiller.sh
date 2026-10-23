#!/usr/bin/env bash
# SURVEILLANCE MÉMOIRE ET DISQUE (vérif V5) — lancée par cron toutes les 5 min (fichier versionné : deploiement/crontab).
#
# Le serveur (15 Go) est PARTAGÉ avec le site axion-ia.com. Le 09/10, studio-aligneur a atteint 4,40 Go pour une limite
# de 4,395 Go pendant la passe « formats » : personne ne l'a vu venir. Ici :
#  - chaque conteneur du studio (studio-axion-ia-*) au-delà de 85 % de SA limite (`docker stats`, MemPerc) → alerte ;
#  - le disque du studio au-delà de 85 % → alerte (nettoyer-disque.sh tourne chaque nuit) ;
#  - journal : /opt/studio-axion-ia/surveillance/surveillance.log (une ligne par dépassement, et au retour sous le seuil) ;
#  - alerte e-mail (ZeptoMail, EMAIL_SECOURS_*), au plus une par heure et par cause tant qu'elle dure.
# Seuils réglables : STUDIO_SEUIL_MEMOIRE_PCT, STUDIO_SEUIL_DISQUE_PCT (85 par défaut). Lecture seule : rien n'est arrêté.
set -uo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploiement/commun.sh
source "$ICI/commun.sh"
# shellcheck source=deploiement/alerte.sh
source "$ICI/alerte.sh"

DOSSIER="$RACINE/surveillance"
JOURNAL="$DOSSIER/surveillance.log"
SEUIL_MEMOIRE="${STUDIO_SEUIL_MEMOIRE_PCT:-85}"
SEUIL_DISQUE="${STUDIO_SEUIL_DISQUE_PCT:-85}"
mkdir -p "$DOSSIER"

journal() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$JOURNAL"
  echo "$*"
}

# Pourcentage entier (« 87.42% » → 87).
entier() {
  local p="${1%\%}"
  p="${p%%.*}"
  [[ "$p" =~ ^[0-9]+$ ]] && echo "$p" || echo 0
}

code=0
if ! stats="$(docker stats --no-stream --format '{{.Name}};{{.MemPerc}};{{.MemUsage}}' 2>&1)"; then
  journal "ÉCHEC : docker stats impossible ($stats)"
  alerter_une_fois "$DOSSIER" docker-stats "Studio Axion-IA : surveillance impossible" "docker stats a échoué sur le serveur : $stats"
  exit 1
fi
while IFS=';' read -r nom pct usage; do
  case "$nom" in studio-axion-ia-*) ;; *) continue ;; esac
  if [ "$(entier "$pct")" -ge "$SEUIL_MEMOIRE" ]; then
    journal "MÉMOIRE $nom : $pct de sa limite ($usage), seuil $SEUIL_MEMOIRE %"
    alerter_une_fois "$DOSSIER" "memoire-$nom" "Studio Axion-IA : $nom à $pct de sa mémoire" \
      "Le conteneur $nom utilise $usage ($pct de sa limite, seuil $SEUIL_MEMOIRE %). Au-delà de 100 %, il est tué (OOM) et son travail repris. Voir docs/verification/V5-SERVEUR.md (budgets)."
    code=2
  elif [ -f "$DOSSIER/alerte-memoire-$nom" ]; then
    journal "mémoire $nom revenue sous le seuil : $pct ($usage)"
    lever_alerte "$DOSSIER" "memoire-$nom"
  fi
done <<<"$stats"

disque="$(df -P "$RACINE" 2>/dev/null | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
if [ "$(entier "${disque:-0}")" -ge "$SEUIL_DISQUE" ]; then
  journal "DISQUE ${disque} % utilisés ($RACINE), seuil $SEUIL_DISQUE %"
  alerter_une_fois "$DOSSIER" disque "Studio Axion-IA : disque à ${disque} %" \
    "Le disque du serveur est rempli à ${disque} %. Nettoyage sûr : bash $ICI/nettoyer-disque.sh (jamais les données ni les sauvegardes)."
  code=2
elif [ -f "$DOSSIER/alerte-disque" ]; then
  journal "disque revenu sous le seuil : ${disque} %"
  lever_alerte "$DOSSIER" disque
fi
exit "$code"
