#!/usr/bin/env bash
# SURVEILLANCE MÉMOIRE ET DISQUE (vérif V5) — lancée par cron toutes les 5 min (fichier versionné : deploiement/crontab).
#
# Le serveur (15 Go) est PARTAGÉ avec le site axion-ia.com. Le 09/10, studio-aligneur a atteint 4,40 Go pour une limite
# de 4,395 Go pendant la passe « formats » : personne ne l'a vu venir. Ici :
#  - chaque conteneur du studio (studio-axion-ia-*) au-delà de 85 % de SA limite (`docker stats`, MemPerc) → alerte ;
#  - le disque du studio au-delà de 85 % → alerte (nettoyer-disque.sh tourne chaque nuit) ;
#  - journal : /opt/studio-axion-ia/surveillance/surveillance.log (une ligne par dépassement, et au retour sous le seuil) ;
#  - alerte e-mail (ZeptoMail, EMAIL_SECOURS_*), au plus une par heure et par cause tant qu'elle dure.
# Seuils réglables : STUDIO_SEUIL_MEMOIRE_PCT, STUDIO_SEUIL_DISQUE_PCT (85 par défaut), STUDIO_SEUIL_SAUVEGARDE_H (36). Lecture seule : rien n'est arrêté.
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

# L5-08 : alerte externe sans IA (le Studio peut être en panne sans que personne ne regarde).
#  - /api/sante qui ne répond pas 200 (503 : base ou boucle de fond, ou aucune réponse) → alerte ;
#  - dernière sauvegarde réussie (sauvegardes/DERNIER-SUCCES) vieille de plus de STUDIO_SEUIL_SAUVEGARDE_H heures
#    (36 par défaut) → alerte. Aucun fichier encore (première installation) : rien.
# Le texte des alertes passe par nettoyer_message (alerte.sh) : ni clé ni adresse e-mail.
SEUIL_SAUVEGARDE_H="${STUDIO_SEUIL_SAUVEGARDE_H:-36}"
code=0

# Code HTTP de /api/sante vu DEPUIS le conteneur du studio (aucun port n'est publié) ; sortie vide si aucune réponse.
sonder_sante() {
  timeout 30 docker compose --env-file "$ENV_FICHIER" exec -T studio node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>{console.log(r.status);process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))" 2>/dev/null
}
if reponse="$(sonder_sante)"; then
  if [ -f "$DOSSIER/alerte-sante" ]; then
    journal "santé revenue : /api/sante répond 200"
    lever_alerte "$DOSSIER" sante
  fi
else
  reponse="$(printf '%s' "$reponse" | tr -cd '0-9' | cut -c1-3)"
  journal "SANTÉ : /api/sante ne répond pas 200 (${reponse:-aucune réponse})"
  alerter_une_fois "$DOSSIER" sante "Studio Axion-IA : le studio ne répond plus correctement" \
    "/api/sante ne répond pas 200 (${reponse:-aucune réponse}). Les publications et les vidéos en cours peuvent être à l'arrêt. Voir docs/verification/V5-SERVEUR.md."
  code=2
fi

dernier_succes="$RACINE/sauvegardes/DERNIER-SUCCES"
if [ -f "$dernier_succes" ]; then
  age_h=$(( ($(date +%s) - $(stat -c %Y "$dernier_succes" 2>/dev/null || date +%s)) / 3600 ))
  if [ "$age_h" -ge "$SEUIL_SAUVEGARDE_H" ]; then
    journal "SAUVEGARDE : dernière réussite il y a ${age_h} h, seuil ${SEUIL_SAUVEGARDE_H} h"
    alerter_une_fois "$DOSSIER" sauvegarde "Studio Axion-IA : plus de sauvegarde depuis ${age_h} h" \
      "La dernière sauvegarde réussie de la base date de ${age_h} h (seuil ${SEUIL_SAUVEGARDE_H} h). Voir sauvegardes/sauvegardes.log sur le serveur."
    code=2
  elif [ -f "$DOSSIER/alerte-sauvegarde" ]; then
    journal "sauvegarde à jour de nouveau (${age_h} h)"
    lever_alerte "$DOSSIER" sauvegarde
  fi
fi

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
