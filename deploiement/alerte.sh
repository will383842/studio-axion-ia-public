# Alerte e-mail partagée par surveiller.sh et nettoyer-disque.sh (vérif V5) — sourcé, jamais lancé seul.
# Même chemin que sauvegarder.sh : copier-r2.mjs « alerte » (ZeptoMail, variables EMAIL_SECOURS_* du .env), lancé dans
# un conteneur jetable de l'image du studio ; les secrets passent par l'environnement (-e NOM, jamais de valeur sur la
# ligne de commande). Une alerte déjà envoyée n'est répétée qu'au bout d'une heure tant que la cause dure.
# shellcheck shell=bash

ALERTE_VARIABLES=(EMAIL_SECOURS_CLE EMAIL_SECOURS_EXPEDITEUR EMAIL_SECOURS_DESTINATAIRE EMAIL_SECOURS_ADRESSE)
ALERTE_RAPPEL_SEC="${STUDIO_ALERTE_RAPPEL_SEC:-3600}"

# Lit une variable du .env (dernière occurrence, guillemets retirés).
lire_env() {
  local ligne=""
  [ -r "$ENV_FICHIER" ] && ligne="$(grep -E "^$1=" "$ENV_FICHIER" | tail -n 1 || true)"
  ligne="${ligne#*=}"
  ligne="${ligne%\"}"
  ligne="${ligne#\"}"
  ligne="${ligne%\'}"
  ligne="${ligne#\'}"
  printf '%s' "$ligne"
}

envoyer_alerte() {
  local titre="$1" message="$2" options=() v
  for v in "${ALERTE_VARIABLES[@]}"; do
    export "$v=$(lire_env "$v")"
    options+=(-e "$v")
  done
  docker run --rm -i --memory 256m --entrypoint node "${options[@]}" \
    -v "$ICI/copier-r2.mjs:/copie/copier-r2.mjs:ro" "${STUDIO_IMAGE_NODE:-studio-axion-ia:local}" /copie/copier-r2.mjs alerte "$titre" "$message" </dev/null
}

# Alerte `cle` (nom de fichier) : envoyée si nouvelle ou rappel dû. Le fichier témoin vit dans $1 (dossier).
alerter_une_fois() {
  local dossier="$1" cle="$2" titre="$3" message="$4" temoin
  temoin="$dossier/alerte-$cle"
  if [ -f "$temoin" ] && [ $(($(date +%s) - $(cat "$temoin" 2>/dev/null || echo 0))) -lt "$ALERTE_RAPPEL_SEC" ]; then
    return 0
  fi
  date +%s >"$temoin"
  envoyer_alerte "$titre" "$message" || echo "alerte e-mail impossible : $titre" >&2
}

# La cause a disparu : le prochain dépassement sera de nouveau signalé tout de suite.
lever_alerte() {
  rm -f "$1/alerte-$2"
}
