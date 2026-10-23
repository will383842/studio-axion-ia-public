#!/usr/bin/env bash
# Sur le serveur : récupère la dernière version du dépôt (clé de déploiement en lecture seule), se relance dans cette
# version si elle a changé (vérif V5),
# reconstruit les images du studio, de studio-rendu (lot M1b) et de studio-aligneur (lot « calage »), puis les redémarre.
# La base et ses données ne sont pas touchées. Un redémarrage de studio-rendu est sans risque :
# le studio soumet à nouveau les rendus en cours (même identifiant, 404 → nouvelle soumission). De même pour
# studio-aligneur (calage repris ; au pire, l'horodatage de la voix est gardé : aucune vidéo bloquée).
#
# Audit D (retour arrière, contrôle après mise en ligne) :
#  - AVANT la construction, les images en service sont gardées sous le tag `precedente` (jamais effacées par le
#    `docker image prune -f` final, qui ne retire que les images sans nom) ;
#  - APRÈS `up -d`, on attend que /api/sante réponde 200 PUIS que chaque service (base, studio, studio-rendu, et
#    studio-aligneur si le calage est actif) soit « healthy » (3 min au plus chacun). Sinon : ÉCHEC affiché clairement,
#    code 1, AUCUN tag `bonne`, et la commande de retour arrière :   bash /opt/studio-axion-ia/source/deploiement/revenir.sh
#  - APRÈS la construction et AVANT tout le reste, verifier-outils-video.sh EXÉCUTE les commandes FFmpeg du code dans les
#    nouvelles images (panne du 09/10 : FFmpeg 5.1 de l'image) ; échec → rien n'est redémarré, code 1 ;
#  - AVANT le redémarrage (et donc avant la migration des données faite au démarrage du studio), une copie de la base est
#    faite et vérifiée : sauvegardes/avant-maj-AAAA-MM-JJ_HHMMSS.sql.gz (jamais effacée par ce script).
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploiement/commun.sh
source "$ICI/commun.sh"

# Une seule mise à jour à la fois (Will, 18/10), AVANT tout le reste (git pull compris). Déjà prise : code 5, rien n'est
# fait. Gardé pendant la relance ci-dessous, rendu à la sortie quelle qu'elle soit (commun.sh).
prendre_verrou_mise_a_jour

cd "${STUDIO_SOURCE:-$RACINE/source}"
# Vérif V5 (09/10 : la première exécution du nouveau script n'a pas lancé le contrôle des outils vidéo) : `git pull`
# remplace ce fichier PENDANT qu'il s'exécute, et bash continue de lire l'ANCIENNE version (et l'ancien commun.sh, déjà
# chargé). Si le pull a changé quelque chose, on se relance UNE fois (exec) dans la version tirée ; la relance ne
# refait pas de pull (STUDIO_MAJ_RELANCE=1) : jamais de boucle.
if [ -z "${STUDIO_MAJ_RELANCE:-}" ]; then
  AVANT_PULL="$(git rev-parse HEAD)"
  # Borné (relecture 18/10) : il tourne en tenant le verrou ; un réseau ou un ssh muet ne bloque plus tout.
  code_pull=0
  GIT_SSH_COMMAND="ssh -i /root/.ssh/studio_deploiement -o IdentitiesOnly=yes -o ConnectTimeout=20" \
    timeout "$DELAI_PULL_SEC" git pull --ff-only || code_pull=$?
  if [ "$code_pull" -ne 0 ]; then
    if [ "$code_pull" -eq 124 ]; then
      echo "ÉCHEC : git pull sans réponse (délai de ${DELAI_PULL_SEC} s dépassé). Rien n'a été fait." >&2
    else
      echo "ÉCHEC : git pull (code $code_pull, détail ci-dessus ; pas de délai dépassé). Rien n'a été fait." >&2
    fi
    exit 1
  fi
  if [ "$(git rev-parse HEAD)" != "$AVANT_PULL" ]; then
    echo "Nouvelle version tirée ($(git rev-parse --short HEAD)) : relance de mettre-a-jour.sh dans cette version."
    STUDIO_MAJ_RELANCE=1 exec bash "$PWD/deploiement/mettre-a-jour.sh" "$@"
  fi
fi
# Version en ligne (lue par /api/sante) : le commit tiré, passé à la construction de l'image du studio.
STUDIO_COMMIT="$(git rev-parse --short HEAD)"
export STUDIO_COMMIT
cd deploiement

# studio-rendu (et studio-aligneur) refusent de démarrer sans la clé partagée : on s'arrête avant de rien toucher.
if ! variable_renseignee STUDIO_RENDU_CLE; then
  echo "STUDIO_RENDU_CLE manquante dans $ENV_FICHIER : studio-rendu ne démarrerait pas. Rien n'a été changé." >&2
  exit 1
fi

# Images en service gardées pour un retour arrière (avant que la construction ne remplace le tag `local`).
# Relecture paquet 4 (sécurité P6) : la dernière version EN BONNE SANTÉ porte le tag `bonne` (posé à la fin de ce
# script). C'est elle qui devient `precedente` : relancer ce script après une mise à jour ratée ne remplace plus le
# retour arrière par l'image ratée. Sans `bonne` (première fois), l'image en service est gardée comme avant.
for image in "${IMAGES[@]}"; do
  if docker image inspect "$image:bonne" >/dev/null 2>&1; then
    docker image tag "$image:bonne" "$image:precedente"
    echo "Dernière version en bonne santé gardée pour un retour arrière : $image:precedente"
  elif docker image inspect "$image:local" >/dev/null 2>&1; then
    docker image tag "$image:local" "$image:precedente"
    echo "Image en service gardée pour un retour arrière : $image:precedente"
  fi
done

# Rend les étiquettes `:local` à la version en service (la construction écartée garde l'étiquette « $1 »). Un `tag` raté
# ne fait pas sortir le script (set -e) : il est signalé avec le geste à faire, le code de sortie prévu reste.
rendre_images_en_service() {
  local image
  for image in "${IMAGES[@]}"; do
    if docker image inspect "$image:precedente" >/dev/null 2>&1; then
      docker image tag "$image:local" "$image:$1" 2>/dev/null || true
      if ! docker image tag "$image:precedente" "$image:local"; then
        echo "ATTENTION : l'image $image:local n'a pas pu être rendue à la version en service. À faire à la main :" >&2
        echo "    docker image tag $image:precedente $image:local" >&2
      fi
    fi
  done
}

# Calage des sous-titres (profil « calage ») : construit et démarré seulement si STUDIO_ALIGNEUR_URL est une adresse
# (http:// ou https://). Lot R6 : il exige la clé partagée STUDIO_RENDU_CLE (le conteneur refuse de démarrer sans elle) ;
# adresse retirée → le conteneur est ARRÊTÉ (jamais supprimé : rien n'est effacé).
if calage_actif; then
  compose --profile calage build studio studio-rendu studio-aligneur
else
  compose build studio studio-rendu
fi

# Contrôle RÉEL des outils vidéo (09/10, après la panne d'export du FFmpeg 5.1) : les commandes FFmpeg du code sont
# exécutées dans les images qu'on vient de construire. Échec → rien n'est sauvegardé ni redémarré : la version en
# service continue, les étiquettes `:local` lui sont rendues (la construction refusée reste sous `:refusee`).
controle=()
calage_actif || controle=(--sans-aligneur)
if ! bash "$ICI/verifier-outils-video.sh" "${controle[@]}"; then
  rendre_images_en_service refusee
  echo "" >&2
  echo "MISE À JOUR ARRÊTÉE : les outils vidéo des nouvelles images ont échoué au contrôle (détail ci-dessus)." >&2
  echo "Rien n'a été redémarré ni modifié : la version en service continue. Images refusées : <nom>:refusee." >&2
  exit 1
fi

# Will, 15/10 : on ne coupe plus les vidéos en cours. Attente trop longue → rien n'est redémarré, la version en service
# garde ses étiquettes `:local` (la nouvelle construction reste sous `:attente`, à relancer plus tard). Même arrêt si la
# base tourne mais ne se laisse pas lire (Will, 18/10). Code de sortie distinct (commun.sh : CODE_ATTENTE_EPUISEE…).
# Relecture 18/10 (7a) : à « 0 », la base est copiée, la boucle de fond mise en pause, puis on RELIT juste avant `up -d` ;
# une vidéo démarrée pendant la copie → on retourne attendre (l'attente maximale court depuis le début).
# Au plus 3 allers-retours, puis code 3 (jamais une boucle sans fin).
tours=0
while :; do
  tours=$((tours + 1))
  arret=0
  attendre_fabrications_finies || arret=$?
  if [ "$arret" -eq 0 ] && [ "$tours" -gt 3 ]; then
    echo "MISE À JOUR ARRÊTÉE : des vidéos redémarrent à chaque copie de la base ($tours essais). Rien n'a été redémarré." >&2
    arret=$CODE_ATTENTE_EPUISEE
  fi
  if [ "$arret" -ne 0 ]; then
    rendre_images_en_service attente
    exit "$arret"
  fi
  # Copie de la base juste avant le redémarrage : le nouveau studio migre les données en démarrant (VERIF-E2E-2, gêne 4).
  sauvegarder_avant_mise_a_jour
  pause_et_derniere_relecture && break
done

if calage_actif; then
  compose --profile calage up -d
else
  compose up -d
  compose --profile calage stop studio-aligneur >/dev/null 2>&1 || true
fi
# La nouvelle version reprend la file aussitôt (sinon la pause expirerait seule).
lever_pause_fabrications

echo "Attente de /api/sante (200) : ${ATTENTE_SANTE_SEC} s au plus…"
if ! attendre_sante; then
  expliquer_echec_sante
  echo "" >&2
  echo "La version précédente est gardée (images :precedente). Pour y revenir :" >&2
  echo "    bash /opt/studio-axion-ia/source/deploiement/revenir.sh" >&2
  exit 1
fi
echo "Attente des services ($(services_attendus | tr '\n' ' ' | sed 's/ $//')) : ${ATTENTE_SANTE_SEC} s au plus…"
if ! attendre_services_sains; then
  expliquer_echec_services
  echo "" >&2
  echo "La version précédente est gardée (images :precedente). Pour y revenir :" >&2
  echo "    bash /opt/studio-axion-ia/source/deploiement/revenir.sh" >&2
  exit 1
fi
# Cette version est en bonne santé : elle devient la référence du prochain retour arrière (service par service).
marquer_bonnes
docker image prune -f >/dev/null
echo "Studio à jour et en bonne santé : $(git -C "${STUDIO_SOURCE:-$RACINE/source}" rev-parse --short HEAD)"
