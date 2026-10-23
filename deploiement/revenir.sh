#!/usr/bin/env bash
# RETOUR ARRIÈRE (audit D) : remet en service les images gardées sous le tag `precedente` par mettre-a-jour.sh, sans
# rien reconstruire, puis attend /api/sante en 200 et chaque service « healthy » (3 min au plus).
#   bash /opt/studio-axion-ia/source/deploiement/revenir.sh
# La base n'est pas touchée (les migrations de données ne suppriment rien : l'ancienne version sait les relire).
# Les images retirées du service gardent le tag `annulee` (rien n'est effacé). Le code source (git) reste sur la
# nouvelle version : corriger, puis relancer mettre-a-jour.sh.
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploiement/commun.sh
source "$ICI/commun.sh"
# Même verrou que mettre-a-jour.sh (relecture 18/10) : jamais en même temps qu'une mise à jour, un retour arrière ou
# une restauration. Déjà pris : code 5, rien n'est fait (arrêter d'abord l'autre opération : ps -fp <PID>).
prendre_verrou_mise_a_jour
cd "$ICI"

if ! docker image inspect studio-axion-ia:precedente >/dev/null 2>&1; then
  echo "Aucune image studio-axion-ia:precedente : rien à remettre (aucune mise à jour faite avec ce script ?)." >&2
  exit 1
fi
for image in "${IMAGES[@]}"; do
  if docker image inspect "$image:precedente" >/dev/null 2>&1; then
    docker image tag "$image:local" "$image:annulee" 2>/dev/null || true
    docker image tag "$image:precedente" "$image:local"
    echo "Remis en service : $image (version précédente)"
  fi
done
if calage_actif; then
  compose --profile calage up -d --no-build
else
  compose up -d --no-build
fi
echo "Attente de /api/sante (200) : ${ATTENTE_SANTE_SEC} s au plus…"
if ! attendre_sante; then
  expliquer_echec_sante
  echo "La version précédente ne répond pas non plus : vérifier la base (docker compose ps, journaux ci-dessus)." >&2
  exit 1
fi
if ! attendre_services_sains; then
  expliquer_echec_services
  echo "La version précédente n'est pas saine non plus : voir les journaux ci-dessus." >&2
  exit 1
fi
# Relecture paquet 4 (sécurité P6) : la version remise en service devient la référence du prochain retour arrière
# (seulement pour les services vérifiés sains).
marquer_bonnes
echo "Retour arrière fait : la version précédente est en service et en bonne santé."
