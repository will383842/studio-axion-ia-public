#!/bin/bash
# Veilleur du poste de capture (POSTE-2, plan « poste relié » du 25/11, §1-§5) : SCRIPT ROOT, côté HÔTE.
#
# Il automatise, à l'identique et sans rien retirer, la « PROCÉDURE CÔTÉ HÔTE » du commentaire du service studio-capture
# (deploiement/docker-compose.yml). Le Studio et lui se parlent par la BOÎTE AUX LETTRES (contrat capture-boite.v1,
# plan §3) : un dossier sur une boucle ext4 de 2 Gio, monté dans le conteneur studio. Aucun jeton, aucun réseau, aucun
# socket docker dans le studio : l'authenticité vient des droits du système de fichiers.
#
# RÈGLES DU SCRIPT
#  - il ne lit JAMAIS de JSON (ni demande, ni réponse du poste) : noms en liste fermée, tailles bornées, `find` de contrôle ;
#  - il ne contrôle JAMAIS la source (que le studio, ou un Chromium, peut encore modifier) : il la COPIE (`cp --no-dereference`)
#    vers un dossier root neuf et contrôle LA COPIE ; le studio ne voit jamais `.veilleur/` (root 0700) ;
#  - `docker ps -aq` VIDE par nom ET par label avant toute action sur /sortie et juste avant chaque `run` ;
#  - un /sortie NEUF (boucle ext4 3 Gio) à chaque étape ; durée : `timeout 960 docker wait … || docker kill …` ;
#  - un seul travail à la fois (flock) ; la .service lance `--une-fois` : UNE demande par passage (la minuterie relance 30 s après) ;
#    sans cet argument, une nouvelle demande n'est prise que si la borne de sécurité (BUDGET_S, 300 s écoulées) n'est pas atteinte ;
#  - le compose est appelé avec -p studio-axion-ia, --env-file (le .env réel de la production), -f et --project-directory FIXÉS,
#    les variables COMPOSE_* vidées ; STUDIO_CAPTURE_ENTREE/SORTIE/MAQUETTE sont TOUJOURS posées (valeurs fixes, pour chaque mode) ;
#    un .env qui contient une ligne STUDIO_CAPTURE_* ou COMPOSE_*, ou un docker-compose.override.yml / compose.yaml dans
#    DEPLOIEMENT = refus (code 2). Jamais de construction d'image : `--pull never` seul n'y suffirait pas (compose construit une
#    image absente), c'est `docker image inspect studio-capture:local` (refus si absente) qui l'empêche ;
#  - le script est lancé DEPUIS le clone (la .service) : lui, ses dossiers parents, la boîte, la racine, les dossiers fixes, le compose,
#    seccomp.json, le .env et les dossiers montés (charte) appartiennent à root, sans écriture pour le groupe ni les autres ;
#  - la boîte est un POINT DE MONTAGE, propriété de root, sans écriture pour le groupe ni les autres (root:1001 0750, plan §8) ;
#    même contrôle sur la racine et les dossiers fixes (sauf /sortie et /entree tant qu'une boucle y est montée, propriété de 1001 :
#    leurs droits sont revérifiés après chaque démontage) ;
#  - chaque commande qui change l'état (fallocate, mkfs.ext4, mount, chown, chmod, remount) porte son `|| arret panne INTERROMPU` :
#    on ne compte JAMAIS seulement sur `set -e` (traiter_demande n'est jamais appelée dans un `||`, `&&`, `if` ou `!`) ;
#  - toute commande docker et tout `timeout` portent `-k 10` / une borne (un enfant qui ignore SIGTERM ne retient pas le veilleur).
#
# TYPES TRAITÉS : `film-zip` de bout en bout (decompresser, capturer, verifier).
#   `film-description` et `apercu` : le mode `construire` du poste est REPORTÉ à POSTE-1b (ecrire-maquette importe par
#   l'alias @/, non copiable dans l'image) : réponse immédiate `refus DEMANDE_INVALIDE`, AUCUN conteneur lancé.
#
# CODES DE SORTIE : 0 = fini (ou rien à faire) ; 1 = erreur inattendue ; 2 = configuration refusée (rien n'est fait).
#
# VARIABLES (la production n'en lit que trois, posées par la .service) :
#   VEILLEUR_BOITE   dossier de la boîte (défaut /opt/studio-axion-ia/capture-boite)
#   DEPLOIEMENT      dossier `deploiement` du dépôt cloné (obligatoire ; le compose y est lu : propriété de root, jamais inscriptible par un autre)
#   --une-fois       (seul argument admis) : une seule demande par passage (posé par la .service)
# MODE ESSAI (tests/deploiement/studio-capture-veilleur.test.ts, SANS root ni docker) : réservé à un script lancé à la main depuis un
# dépôt de développement ; REFUSÉ (code 2) quand le script est lancé par systemd (INVOCATION_ID, JOURNAL_STREAM) ou depuis
# /opt/studio-axion-ia (le clone de production), donc impossible à activer en production.
#   VEILLEUR_TEST=1 (exact) autorise : VEILLEUR_RACINE (autre racine des dossiers capture-*), VEILLEUR_PATH_TEST (dossier de
#   FAUX docker/mount/umount/mountpoint/mkfs.ext4/fallocate/chown/timeout/mv, placé EN TÊTE du PATH), VEILLEUR_VERROU (autre
#   fichier de verrou), VEILLEUR_BUDGET (autre borne de temps, en secondes), et l'exécution sans root. Garde-fous : sans VEILLEUR_TEST=1, la présence d'UNE de ces variables fait
#   REFUSER le script (code 2, jamais ignorée en silence) ; le script installé (/usr/local/sbin, /usr/sbin, /usr/bin…) refuse
#   le mode essai ; le mode essai refuse la vraie boîte et la vraie racine /opt/studio-axion-ia
#   (comparées après `realpath -m` : barre finale, //, lien ne contournent rien). La .service ne pose rien de cela.
set -euo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
unset BASH_ENV ENV CDPATH DOCKER_HOST DOCKER_CONTEXT DOCKER_CONFIG COMPOSE_FILE COMPOSE_PROFILES COMPOSE_PROJECT_NAME \
  COMPOSE_ENV_FILES COMPOSE_PATH_SEPARATOR COMPOSE_IGNORE_ORPHANS COMPOSE_REMOVE_ORPHANS COMPOSE_PARALLEL_LIMIT \
  STUDIO_CAPTURE_ENTREE STUDIO_CAPTURE_SORTIE STUDIO_CAPTURE_MAQUETTE 2>/dev/null || true

readonly RACINE_PROD=/opt/studio-axion-ia
readonly PROJET_COMPOSE=studio-axion-ia
readonly BOITE_PROD=/opt/studio-axion-ia/capture-boite
readonly SCRIPT_REEL="$(readlink -f -- "$0")"

journal() { printf 'veilleur: %s\n' "$*" >&2; }
refuser_config() { journal "configuration refusée : $*"; exit 2; }

# ----------------------------------------------------------------------------------------------------------------------
# Arguments, mode essai, variables
# ----------------------------------------------------------------------------------------------------------------------
chemin_sain() { # absolu, caractères sûrs, aucun « .. »
  case "$1" in
    /*) ;;
    *) return 1 ;;
  esac
  case "$1" in
    *[!A-Za-z0-9._/-]* | *..*) return 1 ;;
  esac
  return 0
}
UNE_FOIS=0
case "$#" in
  0) ;;
  1) if [ "$1" = "--une-fois" ]; then UNE_FOIS=1; else refuser_config "argument inconnu (seul --une-fois existe)"; fi ;;
  *) refuser_config "un seul argument admis (--une-fois)" ;;
esac

ESSAI=0
if [ "${VEILLEUR_TEST:-}" = "1" ]; then
  ESSAI=1
  case "$SCRIPT_REEL" in
    /usr/local/sbin/* | /usr/local/bin/* | /usr/sbin/* | /usr/bin/* | /sbin/* | /bin/*)
      refuser_config "le mode essai est interdit pour le script installé" ;;
    "$RACINE_PROD"/*)
      refuser_config "le mode essai est interdit pour le script du clone de production" ;;
  esac
  # systemd pose INVOCATION_ID (et JOURNAL_STREAM) à tout service : le mode essai y est impossible.
  if [ -n "${INVOCATION_ID:-}" ] || [ -n "${JOURNAL_STREAM:-}" ]; then
    refuser_config "le mode essai est interdit quand le script est lancé par systemd"
  fi
elif [ -n "${VEILLEUR_TEST:-}" ]; then
  refuser_config "VEILLEUR_TEST ne vaut que « 1 »"
else
  for v in VEILLEUR_RACINE VEILLEUR_PATH_TEST VEILLEUR_VERROU VEILLEUR_BUDGET; do
    if [ -n "${!v+x}" ]; then refuser_config "$v n'existe qu'en mode essai (VEILLEUR_TEST=1)"; fi
  done
fi

if [ "$ESSAI" = 1 ]; then
  RACINE=${VEILLEUR_RACINE:-}
  [ -n "$RACINE" ] || refuser_config "mode essai : VEILLEUR_RACINE obligatoire"
  chemin_sain "$RACINE" || refuser_config "chemin invalide : $RACINE"
  RACINE=$(realpath -m -- "$RACINE")
  [ "$RACINE" != "$RACINE_PROD" ] || refuser_config "mode essai : la vraie racine est interdite"
  if [ -n "${VEILLEUR_PATH_TEST:-}" ]; then PATH="$VEILLEUR_PATH_TEST:$PATH"; export PATH; fi
  VERROU=${VEILLEUR_VERROU:-$RACINE/veilleur.lock}
  PROPRIO_ATTENDU=$(id -u)
else
  RACINE=$RACINE_PROD
  VERROU=/run/studio-capture-veilleur.lock
  PROPRIO_ATTENDU=0
  [ "$(id -u)" = 0 ] || refuser_config "ce script doit tourner en root"
fi

BOITE=${VEILLEUR_BOITE:-$BOITE_PROD}
chemin_sain "$BOITE" || refuser_config "chemin invalide : $BOITE"
BOITE=$(realpath -m -- "$BOITE")
BUDGET_S=300
if [ "$ESSAI" = 1 ] && [ -n "${VEILLEUR_BUDGET:-}" ]; then
  case "$VEILLEUR_BUDGET" in '' | *[!0-9]*) refuser_config "VEILLEUR_BUDGET : un nombre de secondes" ;; esac
  BUDGET_S=$VEILLEUR_BUDGET
fi
if [ "$ESSAI" = 1 ] && [ "$BOITE" = "$BOITE_PROD" ]; then refuser_config "mode essai : la vraie boîte est interdite"; fi
DEPLOIEMENT=${DEPLOIEMENT:-}
[ -n "$DEPLOIEMENT" ] || refuser_config "DEPLOIEMENT obligatoire (dossier deploiement du dépôt)"

for c in "$DEPLOIEMENT" "$RACINE"; do chemin_sain "$c" || refuser_config "chemin invalide : $c"; done

readonly ENV_FICHIER="$RACINE/.env"
readonly SORTIE="$RACINE/capture-sortie"
readonly ENTREE="$RACINE/capture-entree"
readonly MAQUETTES="$RACINE/capture-maquettes"
readonly MAQUETTES_IMG="$RACINE/capture-maquettes-img"
readonly TRAVAIL_HOTE="$RACINE/capture-veilleur"
readonly IMG_SORTIE="$RACINE/capture-sortie.img"
readonly IMG_ENTREE="$TRAVAIL_HOTE/entree.img"
readonly V="$BOITE/.veilleur"

# Bornes (octets), contrat §3
readonly COPIE_S=300 DELAI_ETAPE_S=960 DELAI_VERIFIER_S=120
readonly MAX_ZIP=52428800 MAX_JSON=262144 MAX_FILM=524288000 MAX_FFPROBE=65536
readonly REGEX_NOM='^(film-zip|film-description|apercu)--[a-z0-9-]{8,64}$'
readonly CODES=" OK DEMANDE_INVALIDE ZIP_REFUSE MAQUETTE_INTROUVABLE CONTROLE_SOURCE TROP_GROS CAPTURE_ECHEC DUREE_DEPASSEE FILM_INVALIDE EMPREINTE INTERROMPU POSTE_OCCUPE "

# ----------------------------------------------------------------------------------------------------------------------
# Contrôles de configuration : AVANT toute commande docker (code 2)
# ----------------------------------------------------------------------------------------------------------------------
reel_dossier() { [ -d "$1" ] && [ ! -L "$1" ]; }
proprio_mode() { stat -c '%u:%a' -- "$1"; }

monte() { mountpoint -q "$1"; }

# Propriétaire = celui de la mise en ligne (root), AUCUNE écriture pour le groupe ni les autres.
droits_ok() { # <chemin> : vrai si propriétaire = celui de la mise en ligne ET aucune écriture pour le groupe ni les autres
  [ "$(stat -c %u -- "$1")" = "$PROPRIO_ATTENDU" ] && [ $((8#$(stat -c %a -- "$1") & 8#022)) -eq 0 ]
}
root_sans_ecriture() { # <chemin> <description>
  [ "$(stat -c %u -- "$1")" = "$PROPRIO_ATTENDU" ] || refuser_config "$2 doit appartenir à root : $1"
  [ $((8#$(stat -c %a -- "$1") & 8#022)) -eq 0 ] || refuser_config "$2 ne doit être inscriptible que par root : $1"
}

controler_config() {
  local d f rc
  reel_dossier "$BOITE" || refuser_config "boîte absente ou lien : $BOITE"
  # La boîte est une boucle dédiée (sinon le studio remplirait le disque de l'hôte) ; son dossier : root:1001 0750 (plan §8).
  monte "$BOITE" || refuser_config "la boîte n'est pas un point de montage (boucle dédiée absente) : $BOITE"
  root_sans_ecriture "$BOITE" "la boîte"
  [ -f "$BOITE/PRET" ] && [ ! -L "$BOITE/PRET" ] || refuser_config "boîte non prête (PRET absent ou pas un fichier ordinaire)"
  [ "$(proprio_mode "$BOITE/PRET")" = "$PROPRIO_ATTENDU:444" ] || refuser_config "PRET doit être au propriétaire de la mise en ligne, mode 0444"
  reel_dossier "$V" || refuser_config ".veilleur absent ou lien"
  [ "$(proprio_mode "$V")" = "$PROPRIO_ATTENDU:700" ] || refuser_config ".veilleur doit appartenir à root, mode 0700"
  for d in demandes reponses; do reel_dossier "$BOITE/$d" || refuser_config "$d absent ou lien"; done
  reel_dossier "$RACINE" || refuser_config "racine absente ou lien : $RACINE"
  root_sans_ecriture "$RACINE" "la racine"
  for d in "$SORTIE" "$ENTREE" "$MAQUETTES" "$MAQUETTES_IMG" "$TRAVAIL_HOTE"; do
    reel_dossier "$d" || refuser_config "dossier fixe absent ou lien : $d (voir plan, section 8, étape 2)"
    # SEULS /sortie et /entree sont dispensés tant qu'une boucle y est montée (reprise après arrêt : la racine montée appartient
    # à 1001) ; leurs droits sont refaits après chaque démontage (boucle_neuve). Les trois autres sont toujours contrôlés.
    if [ "$d" = "$SORTIE" ] || [ "$d" = "$ENTREE" ]; then
      if ! monte "$d"; then root_sans_ecriture "$d" "le dossier fixe"; fi
    else
      root_sans_ecriture "$d" "le dossier fixe"
    fi
  done
  reel_dossier "$DEPLOIEMENT" || refuser_config "DEPLOIEMENT n'est pas un dossier"
  # Aucun lien dans le chemin (un lien au milieu changerait ce que « le clone » désigne) : le chemin donné EST le chemin réel.
  [ "$(realpath -e -- "$DEPLOIEMENT")" = "$DEPLOIEMENT" ] || refuser_config "DEPLOIEMENT contient un lien ou n'est pas canonique : $DEPLOIEMENT"
  root_sans_ecriture "$DEPLOIEMENT" "DEPLOIEMENT"
  # Le clone : le dossier qui contient DEPLOIEMENT, le dossier studio-capture (seccomp.json, ce script), ce script, et les dossiers
  # montés dans le conteneur (charte). Production : le script lancé par la .service EST celui du clone.
  root_sans_ecriture "$DEPLOIEMENT/.." "le parent de DEPLOIEMENT (le clone)"
  reel_dossier "$DEPLOIEMENT/studio-capture" || refuser_config "studio-capture absent ou lien dans DEPLOIEMENT"
  root_sans_ecriture "$DEPLOIEMENT/studio-capture" "le dossier studio-capture"
  f="$DEPLOIEMENT/studio-capture/veilleur.sh"
  [ -f "$f" ] && [ ! -L "$f" ] || refuser_config "studio-capture/veilleur.sh absent ou lien dans DEPLOIEMENT"
  root_sans_ecriture "$f" "veilleur.sh"
  if [ "$ESSAI" = 0 ] && [ "$SCRIPT_REEL" != "$(realpath -e -- "$f")" ]; then
    refuser_config "le script doit être lancé depuis le clone : $f"
  fi
  for d in "$DEPLOIEMENT/../outils" "$DEPLOIEMENT/../outils/maquettes-tableaux-de-bord" "$DEPLOIEMENT/../outils/maquettes-tableaux-de-bord/charte"; do
    reel_dossier "$d" || refuser_config "dossier monté absent ou lien : $d"
    root_sans_ecriture "$d" "le dossier monté"
  done
  f="$DEPLOIEMENT/docker-compose.yml"
  [ -f "$f" ] && [ ! -L "$f" ] || refuser_config "docker-compose.yml absent ou lien"
  root_sans_ecriture "$f" "docker-compose.yml"
  # Aucun autre fichier compose que celui qu'on passe avec -f : une fusion silencieuse ajouterait des montages ou des privilèges.
  for f in docker-compose.override.yml docker-compose.override.yaml docker-compose.yaml compose.yaml compose.yml compose.override.yaml compose.override.yml; do
    if [ -e "$DEPLOIEMENT/$f" ] || [ -L "$DEPLOIEMENT/$f" ]; then refuser_config "$f présent dans DEPLOIEMENT (fichier compose en trop)"; fi
  done
  f="$DEPLOIEMENT/studio-capture/seccomp.json"
  [ -f "$f" ] && [ ! -L "$f" ] || refuser_config "studio-capture/seccomp.json absent ou lien"
  root_sans_ecriture "$f" "seccomp.json"
  # Le .env réel de la production (le compose exige POSTGRES_PASSWORD, SESSION_SECRET… : sans lui, `run` échoue toujours).
  [ -f "$ENV_FICHIER" ] && [ ! -L "$ENV_FICHIER" ] || refuser_config ".env absent ou lien : $ENV_FICHIER"
  root_sans_ecriture "$ENV_FICHIER" ".env"
  # compose lit STUDIO_CAPTURE_* et COMPOSE_* dans ce .env : le veilleur pose ses propres valeurs, un reste de la procédure
  # manuelle (ou un COMPOSE_PROFILES) ne doit pas les changer. Une erreur de lecture refuse aussi (échec fermé).
  rc=0
  # Une ligne précédée d'un BOM UTF-8 est refusée comme les autres (le BOM n'est pas une espace pour grep).
  grep -Eq "^($(printf '\357\273\277'))?[[:space:]]*(export[[:space:]]+)?(STUDIO_CAPTURE_|COMPOSE_)" "$ENV_FICHIER" || rc=$?
  [ "$rc" = 1 ] || refuser_config ".env : aucune ligne STUDIO_CAPTURE_* ni COMPOSE_* n'est admise (ou fichier illisible)"
}
controler_config

# Pouls (contrat §3 : écrit à CHAQUE passage, plus de 5 min = poste éteint) : fichier temporaire propre au processus,
# mode posé AVANT `mv -T` (jamais de fichier root 0600 visible, jamais de chmod sur un lien), puis rename atomique.
pouls() {
  local tmp="$V/pouls.$$.tmp"
  date -u +%FT%TZ >"$tmp" && chmod 0444 "$tmp" && mv -T -- "$tmp" "$BOITE/pouls" || { rm -f "$tmp"; return 1; }
}

# Verrou : un seul veilleur à la fois. Un passage concurrent (travail en cours, jusqu'à ~50 min) rafraîchit quand même le pouls.
exec 9>"$VERROU"
if ! flock -n 9; then
  pouls || true
  exit 0
fi

# ----------------------------------------------------------------------------------------------------------------------
# Outils : poste libre, boucles, copies contrôlées
# ----------------------------------------------------------------------------------------------------------------------
# « ARRÊT » d'une demande : écrit l'état (statut, code) et sort du sous-shell de travail. Jamais d'autre action.
FICHIER_ETAT=""
arret() { # arret <ok|refus|panne> <CODE>
  journal "arrêt $1 $2"
  printf '%s\n%s\n' "$1" "$2" >"$FICHIER_ETAT"
  exit 10
}

# Vrai SEULEMENT si les deux listes (nom ET label) sont vides ; une erreur de docker = « occupé » (on échoue fermé).
poste_libre() {
  local a b
  a=$(timeout -k 10 60 docker ps -aq --filter name=studio-capture) || return 1
  b=$(timeout -k 10 60 docker ps -aq --filter label=com.docker.compose.service=studio-capture) || return 1
  [ -z "$a" ] && [ -z "$b" ]
}

demonter() { # démonte si monté, puis vérifie
  if monte "$1"; then umount "$1"; fi
  if monte "$1"; then return 1; fi
  return 0
}

# Boucle ext4 NEUVE (même suite que l'étape 2 du compose) : umount, rm -f, fallocate, mkfs.ext4, mount.
boucle_neuve() { # <image> <point de montage> <taille>
  demonter "$2" || arret panne INTERROMPU
  # Une fois démonté, le dossier de l'hôte est de nouveau visible : ses droits sont refaits (durcissement), avant tout `mount`.
  droits_ok "$2" || arret panne INTERROMPU
  rm -f "$1" || arret panne INTERROMPU
  fallocate -l "$3" "$1" || arret panne INTERROMPU
  mkfs.ext4 -q -m 0 "$1" </dev/null || arret panne INTERROMPU
  mount -o loop,nodev,nosuid,noexec "$1" "$2" || arret panne INTERROMPU
}

# /sortie neuf : JAMAIS sans avoir revérifié qu'aucun conteneur ne vit.
sortie_neuve() {
  poste_libre || arret panne POSTE_OCCUPE
  boucle_neuve "$IMG_SORTIE" "$SORTIE" 3G
  chown 1001:1001 "$SORTIE" || arret panne INTERROMPU
}

# Une chaîne vide ou un arrêt : `find` ne doit RIEN afficher (une panne de find = échec, jamais « vide »).
vide_ou_arret() { # <statut> <CODE> <find…>
  local st=$1 code=$2 sortie
  shift 2
  sortie=$("$@") || arret panne INTERROMPU
  [ -z "$sortie" ] || arret "$st" "$code"
}

controler_arbre() { # <dossier> <statut> <CODE> : que des fichiers et des dossiers, aucun lien physique
  vide_ou_arret "$2" "$3" find "$1" ! -type f ! -type d -print -quit
  vide_ou_arret "$2" "$3" find "$1" -type f -links +1 -print -quit
}

# Un fichier ordinaire, ni lien symbolique ni lien physique, de taille bornée.
fichier_sain() { # <chemin> <max>
  local t
  [ -f "$1" ] && [ ! -L "$1" ] || return 1
  [ "$(stat -c %h -- "$1")" = 1 ] || return 1
  t=$(stat -c %s -- "$1") || return 1
  [ "$t" -le "$2" ]
}

# Lance UN conteneur du poste (forme unique du compose) et attend au plus 960 s (120 s pour `verifier`) ; le tue sinon.
# Lit le code de sortie. Résultat dans RC_ETAPE ; le conteneur est supprimé et le poste revérifié libre avant de rendre la main.
# Le compose est TOUJOURS appelé avec --env-file (le .env de la production), -f et --project-directory fixés, les COMPOSE_* vidées ;
# l'image doit exister déjà. `--pull never` n'empêche PAS la construction (compose construit une image absente) : c'est le
# `docker image inspect` ci-dessous (arrêt si l'image manque) qui garantit qu'aucune construction n'est jamais lancée.
# Le nom `studio-capture:local` est celui du compose (le nettoyage horaire du serveur épargne les images `studio-*`).
# STUDIO_CAPTURE_ENTREE/SORTIE/MAQUETTE sont TOUJOURS posées, avec des valeurs fixes (maquette vide de root pour decompresser et
# verifier) : compose ne retombe jamais sur le .env ni sur le défaut du dépôt.
RC_ETAPE=""
lancer_conteneur() { # <nom> <entree> <maquette|""> <mode> [arguments…]
  local nom=$1 entree=$2 maquette=$3 rc journal_ctr delai=$DELAI_ETAPE_S
  shift 3
  if [ "$1" = verifier ]; then delai=$DELAI_VERIFIER_S; fi
  timeout -k 10 60 docker image inspect studio-capture:local >/dev/null 2>&1 || arret panne CAPTURE_ECHEC
  poste_libre || arret panne POSTE_OCCUPE
  if [ -z "$maquette" ]; then
    # Dossier vide, propriété de root, recréé à chaque lancement (decompresser et verifier n'ont aucune maquette à lire).
    maquette="$TRAVAIL_HOTE/maquette-vide"
    rm -rf --one-file-system -- "$maquette" || arret panne INTERROMPU
    mkdir -m 0555 "$maquette" || arret panne INTERROMPU
  fi
  (
    cd "$DEPLOIEMENT" || exit 1
    export STUDIO_CAPTURE_ENTREE="$entree" STUDIO_CAPTURE_SORTIE="$SORTIE" STUDIO_CAPTURE_MAQUETTE="$maquette"
    timeout -k 10 120 env -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR docker compose -p "$PROJET_COMPOSE" --env-file "$ENV_FICHIER" --project-directory "$DEPLOIEMENT" -f "$DEPLOIEMENT/docker-compose.yml" --profile capture run -d --pull never --name "$nom" studio-capture "$@" >/dev/null && timeout -k 10 "$delai" docker wait "$nom" >/dev/null || timeout -k 10 60 docker kill "$nom" >/dev/null 2>&1 || true
  ) || true
  rc=$(timeout -k 10 60 docker inspect -f '{{.State.ExitCode}}' "$nom" 2>/dev/null) || rc=""
  # Journal du conteneur : borné, fins de ligne et caractères de contrôle remplacés par des espaces, une seule ligne préfixée
  # (le conteneur ne peut pas fabriquer de fausses lignes « veilleur: … »).
  journal_ctr=$(timeout -k 10 60 docker logs "$nom" 2>&1 | tail -c 8192 | tr -s '\000-\037\177' ' ') || journal_ctr=""
  printf 'veilleur: poste| %s\n' "$journal_ctr" >&2
  timeout -k 10 60 docker rm -f "$nom" >/dev/null 2>&1 || true
  poste_libre || arret panne POSTE_OCCUPE
  case "$rc" in
    '' | *[!0-9]*) rc=inconnu ;;
  esac
  RC_ETAPE=$rc
}

# Entrée neuve (boucle ext4 sur capture-entree) : à remplir, puis fermer (propriété de 1001, lecture seule).
entree_neuve() { # <taille>
  boucle_neuve "$IMG_ENTREE" "$ENTREE" "$1"
}
entree_fermer() {
  chown -R 1001:1001 "$ENTREE" || arret panne INTERROMPU
  chmod -R a+rX,go-w "$ENTREE" || arret panne INTERROMPU
  mount -o remount,ro,nodev,nosuid,noexec "$ENTREE" || arret panne INTERROMPU
}

# ----------------------------------------------------------------------------------------------------------------------
# Étapes d'un travail film-zip (chacune dans le sous-shell de travail : `arret` en sort)
# ----------------------------------------------------------------------------------------------------------------------
# Copie sous `timeout`, sans suivre les liens, récursive (une FIFO est recréée en FIFO, puis refusée par controler_arbre au lieu de
# bloquer `cp`). L'appelant contrôle LA COPIE.
copier() { # <source> <destination>
  timeout -k 10 "$COPIE_S" cp -R --no-dereference -- "$1" "$2" || arret panne INTERROMPU
}

copier_demande() { # <dossier de la demande dans .veilleur>
  local t=$1 f liste
  # Aucun nom hors liste fermée (le dossier est à NOUS, root 0700 : le studio ne le voit plus).
  liste="$V/liste-$NOM"
  find "$t" -mindepth 1 -maxdepth 1 -print0 >"$liste" || arret panne INTERROMPU
  while IFS= read -r -d '' f; do
    case "${f##*/}" in
      dossier.zip | scenario.json | calage.json) ;;
      *) arret refus DEMANDE_INVALIDE ;;
    esac
  done <"$liste"
  rm -f "$liste"
  fichier_sain "$t/dossier.zip" "$MAX_ZIP" || arret refus DEMANDE_INVALIDE
  fichier_sain "$t/scenario.json" "$MAX_JSON" || arret refus DEMANDE_INVALIDE
  fichier_sain "$t/calage.json" "$MAX_JSON" || arret refus DEMANDE_INVALIDE
  entree_neuve 256M
  for f in dossier.zip scenario.json calage.json; do copier "$t/$f" "$ENTREE/$f"; done
  # On contrôle LA COPIE (la source reste modifiable par un descripteur que le studio aurait gardé ouvert).
  controler_arbre "$ENTREE" refus DEMANDE_INVALIDE
  fichier_sain "$ENTREE/dossier.zip" "$MAX_ZIP" || arret refus DEMANDE_INVALIDE
  fichier_sain "$ENTREE/scenario.json" "$MAX_JSON" || arret refus DEMANDE_INVALIDE
  fichier_sain "$ENTREE/calage.json" "$MAX_JSON" || arret refus DEMANDE_INVALIDE
  entree_fermer
}

etape_decompresser() {
  sortie_neuve
  lancer_conteneur "studio-capture-$ID-decompresser" "$ENTREE" "" decompresser --zip /entree/dossier.zip --sortie /sortie/maquette
  case "$RC_ETAPE" in
    0) ;;
    124 | 137) arret panne DUREE_DEPASSEE ;;
    4) arret refus ZIP_REFUSE ;;
    *) arret panne CAPTURE_ECHEC ;;
  esac
}

# Contrôle de la source (critères 1, 1 bis, 2), puis copie vers une boucle 1 Gio neuve (critères 3, 4), remontée en lecture seule.
copier_maquette() {
  local m="$SORTIE/maquette" racine="" n sous d dest="$MAQUETTES/$ID" img="$MAQUETTES_IMG/$ID.img" liste
  [ -d "$m" ] && [ ! -L "$m" ] || arret refus MAQUETTE_INTROUVABLE
  controler_arbre "$m" refus CONTROLE_SOURCE
  # Racine de la maquette : le dossier qui contient index.html, à la racine de la sortie, sinon UN SEUL sous-dossier.
  if [ -f "$m/index.html" ]; then
    racine=$m
  else
    liste="$V/sous-$NOM"
    find "$m" -mindepth 1 -maxdepth 1 -print0 >"$liste" || arret panne INTERROMPU
    n=0
    sous=""
    while IFS= read -r -d '' d; do
      n=$((n + 1))
      sous=$d
    done <"$liste"
    rm -f "$liste"
    [ "$n" = 1 ] && [ -d "$sous" ] && [ ! -L "$sous" ] && [ -f "$sous/index.html" ] || arret refus MAQUETTE_INTROUVABLE
    racine=$sous
  fi
  [ -f "$racine/index.html" ] && [ ! -L "$racine/index.html" ] || arret refus MAQUETTE_INTROUVABLE
  [ "$(realpath -e -- "$racine")" = "$racine" ] || arret refus CONTROLE_SOURCE
  # <id> NEUF (ni fichier, ni dossier, ni lien, même cassé).
  { [ ! -e "$dest" ] && [ ! -L "$dest" ] && [ ! -e "$img" ] && [ ! -L "$img" ]; } || arret panne INTERROMPU
  fallocate -l 1G "$img" || arret panne INTERROMPU
  mkfs.ext4 -q -m 0 "$img" </dev/null || arret panne INTERROMPU
  mkdir "$dest" || arret panne INTERROMPU
  mount -o loop,nodev,nosuid,noexec "$img" "$dest" || arret panne INTERROMPU
  timeout -k 10 "$COPIE_S" cp -R --no-dereference -- "$racine" "$dest/maquette" || arret refus TROP_GROS
  chown -R root:root "$dest/maquette" || arret panne INTERROMPU
  chmod -R a+rX,go-w "$dest/maquette" || arret panne INTERROMPU
  controler_arbre "$dest/maquette" refus CONTROLE_SOURCE
  [ "$(realpath -e -- "$dest/maquette")" = "$dest/maquette" ] || arret refus CONTROLE_SOURCE
  mount -o remount,ro,nodev,nosuid,noexec "$dest" || arret panne INTERROMPU
}

# Un /sortie neuf, la copie contrôlée en lecture seule comme maquette, capture ; résultat copié par root.
etape_capturer() {
  local dossiers n=0 d="" liste="$V/res-$NOM" f res="$V/resultat-$ID"
  sortie_neuve
  lancer_conteneur "studio-capture-$ID-capturer" "$ENTREE" "$MAQUETTES/$ID/maquette" capturer \
    --maquette outils/maquettes-tableaux-de-bord/maquette --scenario /entree/scenario.json --calage /entree/calage.json --sortie /sortie
  case "$RC_ETAPE" in
    0) ;;
    124 | 137) arret panne DUREE_DEPASSEE ;;
    *) arret panne CAPTURE_ECHEC ;;
  esac
  # Exactement UN dossier /sortie/<nom> (hors lost+found).
  find "$SORTIE" -mindepth 1 -maxdepth 1 ! -name lost+found -print0 >"$liste" || arret panne INTERROMPU
  while IFS= read -r -d '' dossiers; do
    n=$((n + 1))
    d=$dossiers
  done <"$liste"
  rm -f "$liste"
  [ "$n" = 1 ] && [ -d "$d" ] && [ ! -L "$d" ] || arret panne CAPTURE_ECHEC
  controler_arbre "$d" refus CONTROLE_SOURCE
  [ "$(realpath -e -- "$d")" = "$d" ] || arret refus CONTROLE_SOURCE
  [ -f "$d/navigation.mp4" ] && [ ! -L "$d/navigation.mp4" ] && [ -f "$d/navigation.json" ] && [ ! -L "$d/navigation.json" ] || arret panne CAPTURE_ECHEC
  fichier_sain "$d/navigation.mp4" "$MAX_FILM" || arret refus TROP_GROS
  fichier_sain "$d/navigation.json" "$MAX_JSON" || arret refus TROP_GROS
  # Garde explicite : $res est exactement le dossier de résultat de CETTE demande, sous .veilleur (jamais vide, jamais ailleurs).
  [ -n "${ID:-}" ] && [ "$res" = "$V/resultat-$ID" ] && [ -n "$V" ] || arret panne CAPTURE_ECHEC
  rm -rf --one-file-system -- "$res"
  mkdir -- "$res"
  for f in navigation.mp4 navigation.json; do copier "$d/$f" "$res/$f"; done
  controler_arbre "$res" refus CONTROLE_SOURCE
  fichier_sain "$res/navigation.mp4" "$MAX_FILM" || arret refus TROP_GROS
  fichier_sain "$res/navigation.json" "$MAX_JSON" || arret refus TROP_GROS
}

# ffprobe dans un AUTRE conteneur jetable, sur la COPIE root du film (jamais dans le studio).
etape_verifier() {
  local res="$V/resultat-$ID"
  sortie_neuve
  entree_neuve 1G
  # /entree de verifier ne contient QUE la copie navigation.mp4.
  copier "$res/navigation.mp4" "$ENTREE/navigation.mp4"
  controler_arbre "$ENTREE" refus CONTROLE_SOURCE
  fichier_sain "$ENTREE/navigation.mp4" "$MAX_FILM" || arret refus TROP_GROS
  entree_fermer
  lancer_conteneur "studio-capture-$ID-verifier" "$ENTREE" "" verifier
  # ffprobe.json n'est cru QUE si le conteneur a fini avec le code 0.
  case "$RC_ETAPE" in
    0) ;;
    124 | 137) arret panne DUREE_DEPASSEE ;;
    *) arret refus FILM_INVALIDE ;;
  esac
  controler_arbre "$SORTIE" refus CONTROLE_SOURCE
  fichier_sain "$SORTIE/ffprobe.json" "$MAX_FFPROBE" || arret refus FILM_INVALIDE
  # Lecture BORNÉE en octets (un de plus que le maximum : un fichier trop gros ressort trop gros et est refusé).
  timeout -k 10 60 head -c $((MAX_FFPROBE + 1)) -- "$SORTIE/ffprobe.json" >"$res/ffprobe.json" || arret panne INTERROMPU
  fichier_sain "$res/ffprobe.json" "$MAX_FFPROBE" || arret refus FILM_INVALIDE
}

# Le travail d'UNE demande, dans un sous-shell (set -e actif) : 0 fini (état « ok OK »), 10 arrêt (état écrit), autre = panne.
NOM="" TYPE="" ID=""
travailler() {
  set -e
  local t="$V/travail-$NOM"
  FICHIER_ETAT="$V/etat-$NOM"
  [ -d "$t" ] && [ ! -L "$t" ] || arret refus DEMANDE_INVALIDE
  case "$TYPE" in
    film-zip) ;;
    # film-description et apercu : « construire » reporté à POSTE-1b. Aucun conteneur, aucune copie.
    film-description | apercu) arret refus DEMANDE_INVALIDE ;;
    *) arret refus DEMANDE_INVALIDE ;;
  esac
  copier_demande "$t"
  etape_decompresser
  copier_maquette
  etape_capturer
  etape_verifier
  printf 'ok\nOK\n' >"$FICHIER_ETAT"
}

# ----------------------------------------------------------------------------------------------------------------------
# Nettoyage, réponse, reprise
# ----------------------------------------------------------------------------------------------------------------------
# Libère les boucles de travail. /sortie n'est touché QUE si le poste est libre.
liberer_boucles() {
  local m n
  for m in "$MAQUETTES"/*; do
    [ -e "$m" ] || [ -L "$m" ] || continue
    if [ -d "$m" ] && [ ! -L "$m" ] && demonter "$m"; then rmdir "$m" 2>/dev/null || true; else journal "maquette non libérée : $m"; fi
  done
  # Une image n'est effacée que si sa maquette est démontée (son dossier a disparu) ; sinon on la garde.
  for m in "$MAQUETTES_IMG"/*.img; do
    [ -f "$m" ] || continue
    n=${m##*/}
    n=${n%.img}
    if [ -e "$MAQUETTES/$n" ] || [ -L "$MAQUETTES/$n" ]; then journal "image conservée (maquette non libérée) : $n"; else rm -f "$m"; fi
  done
  if demonter "$ENTREE"; then rm -f "$IMG_ENTREE"; else journal "entrée non démontée"; fi
  if poste_libre; then
    if demonter "$SORTIE"; then rm -f "$IMG_SORTIE"; else journal "sortie non démontée"; fi
  else
    journal "poste occupé : /sortie laissé tel quel"
  fi
}

# Construit .veilleur/reponse-N (état + fichiers du résultat), la donne à l'uid 1001 et la RENOMME dans reponses/.
poser_reponse() { # <statut> <CODE> <avec fichiers 0|1> ; échoue (return 1) sans rien effacer d'autre que sa préparation
  local st=$1 code=$2 avec=$3 r="$V/reponse-$NOM" f res="$V/resultat-$ID"
  # Appelée aussi dans un `if` (set -e inactif) : chaque commande porte son `|| return 1`.
  rm -rf --one-file-system -- "$r" || return 1
  mkdir "$r" || return 1
  printf '%s\n%s\n' "$st" "$code" >"$r/etat.txt" || return 1
  if [ "$avec" = 1 ]; then
    for f in navigation.mp4 navigation.json ffprobe.json; do
      if ! { [ -f "$res/$f" ] && [ ! -L "$res/$f" ]; }; then
        rm -rf --one-file-system -- "$r" || return 1
        mkdir "$r" || return 1
        printf 'panne\nCAPTURE_ECHEC\n' >"$r/etat.txt" || return 1
        break
      fi
      # DÉPLACÉ (même système de fichiers, .veilleur) : le film n'est pas recopié une seconde fois sur la boîte.
      mv -T -- "$res/$f" "$r/$f" || return 1
    done
  fi
  # Le studio efface la réponse après lecture : dossier 0700, fichiers 0600, propriété de l'uid 1001 (un dossier 0500 ne se viderait pas).
  chown -R 1001:1001 "$r" || return 1
  chmod 0700 "$r" || return 1
  find "$r" -type f -exec chmod 0600 {} + || return 1
  if [ ! -e "$BOITE/reponses/$NOM" ] && [ ! -L "$BOITE/reponses/$NOM" ]; then
    mv -T -- "$r" "$BOITE/reponses/$NOM" || return 1
  else
    journal "réponse $NOM déjà présente : abandon"
    rm -rf --one-file-system -- "$r" || return 1
  fi
}

# Efface tout ce qui reste d'un travail (jamais touché pendant qu'un conteneur vit : liberer_boucles le gère).
effacer_travail() {
  rm -rf --one-file-system -- "$V/travail-$NOM" "$V/resultat-$ID" "$V/reponse-$NOM" "$V/etat-$NOM" "$V/liste-$NOM" "$V/sous-$NOM" "$V/res-$NOM"
  liberer_boucles
}

decoder_nom() { # <nom> → NOM, TYPE, ID (ou échec)
  [[ $1 =~ $REGEX_NOM ]] || return 1
  NOM=$1
  TYPE=${1%%--*}
  ID=${1#*--}
}

# Une demande prise : travail, réponse, nettoyage. NE RENDS JAMAIS un code non nul : l'appelant la lance SANS `||`, `&&`, `if` ni `!`
# (dans un tel contexte, bash IGNORE `set -e` pour tout ce qu'elle exécute, sous-shell de travail compris). L'arrêt de la boucle
# est signalé par la variable globale ARRET_BOUCLE.
ARRET_BOUCLE=0
traiter_demande() { # <nom valide>
  local rc=0 st code avec=0
  decoder_nom "$1" || return 0
  journal "demande prise : $NOM"
  if [ -L "$V/travail-$NOM" ]; then rm -f "$V/travail-$NOM"; fi
  set +e
  ( travailler )
  rc=$?
  set -e
  st=panne
  code=INTERROMPU
  if [ "$rc" = 0 ] || [ "$rc" = 10 ]; then
    # Les deux lignes de l'état sont relues TELLES QUELLES et validées contre la liste fermée.
    if [ -f "$V/etat-$NOM" ] && [ ! -L "$V/etat-$NOM" ]; then
      { IFS= read -r st && IFS= read -r code; } <"$V/etat-$NOM" || { st=panne; code=INTERROMPU; }
    fi
  fi
  case "$st" in ok | refus | panne) ;; *) st=panne; code=INTERROMPU ;; esac
  case "$CODES" in *" $code "*) ;; *) st=panne; code=INTERROMPU ;; esac
  if [ "$st" = ok ] && [ "$code" != OK ]; then st=panne; code=INTERROMPU; fi
  if [ "$st" = ok ]; then avec=1; fi
  if poser_reponse "$st" "$code" "$avec"; then
    effacer_travail
    journal "demande finie : $NOM $st $code"
  else
    journal "réponse non posée pour $NOM : le travail reste (la reprise réessaiera)"
    ARRET_BOUCLE=1
  fi
}

# Conteneurs de capture restants : tués puis supprimés (reprise seulement). Échoue s'il en reste.
purger_poste() {
  local ids
  ids=$(timeout -k 10 60 docker ps -aq --filter name=studio-capture) || return 1
  [ -z "$ids" ] || { echo "$ids" | xargs timeout -k 10 60 docker kill >/dev/null 2>&1 || true; echo "$ids" | xargs timeout -k 10 60 docker rm -f >/dev/null 2>&1 || true; }
  ids=$(timeout -k 10 60 docker ps -aq --filter label=com.docker.compose.service=studio-capture) || return 1
  [ -z "$ids" ] || { echo "$ids" | xargs timeout -k 10 60 docker kill >/dev/null 2>&1 || true; echo "$ids" | xargs timeout -k 10 60 docker rm -f >/dev/null 2>&1 || true; }
  poste_libre
}

# Reprise : le veilleur a été tué (ou l'hôte redémarré) au milieu d'un travail.
reprendre() {
  local p n restes=0 echec=0
  for p in "$V"/travail-* "$V"/reponse-*; do
    if [ -e "$p" ] || [ -L "$p" ]; then restes=1; fi
  done
  [ "$restes" = 1 ] || return 0
  journal "reprise : un travail était en cours"
  purger_poste || { journal "reprise : un conteneur de capture vit encore : ARRÊT, rien n'est touché"; return 1; }
  for p in "$V"/travail-*; do
    [ -e "$p" ] || [ -L "$p" ] || continue
    n=${p##*/travail-}
    if decoder_nom "$n"; then
      # Le travail n'est effacé QUE si la réponse est posée (aucun `|| true` ici : il désactiverait set -e).
      if poser_reponse panne INTERROMPU 0; then
        effacer_travail
      else
        journal "reprise : réponse non posée pour $n, le travail est conservé"
        echec=1
      fi
    else
      rm -rf --one-file-system -- "$p"
    fi
  done
  rm -rf --one-file-system -- "$V"/reponse-* "$V"/resultat-* "$V"/etat-* "$V"/liste-* "$V"/sous-* "$V"/res-* "$V"/pouls.*.tmp
  liberer_boucles
  [ "$echec" = 0 ] || return 1
}

# La plus ancienne demande, nom valide seulement ; les autres sont ignorées, et supprimées au bout de 10 minutes.
choisir_demande() { # → CHOIX (vide si rien)
  local liste="$V/choix.tmp" rec t n maintenant meilleur=""
  CHOIX=""
  find "$BOITE/demandes" -mindepth 1 -maxdepth 1 -printf '%T@\t%f\0' >"$liste" || return 1
  maintenant=$(date +%s)
  while IFS= read -r -d '' rec; do
    t=${rec%%$'\t'*}
    n=${rec#*$'\t'}
    t=${t%.*}
    if [[ $n =~ $REGEX_NOM ]]; then
      if [ -z "$meilleur" ] || [ "$t" -lt "$meilleur" ]; then
        meilleur=$t
        CHOIX=$n
      fi
    elif [ $((maintenant - t)) -gt 600 ]; then
      journal "entrée invalide ancienne supprimée"
      rm -rf --one-file-system -- "$BOITE/demandes/$n"
    fi
  done <"$liste"
  rm -f "$liste"
  return 0
}

prendre_demande() { # <nom> : RENOMME (ne suit pas les liens) dans .veilleur, root 0700
  mv -T -- "$BOITE/demandes/$1" "$V/travail-$1"
}

# ----------------------------------------------------------------------------------------------------------------------
# Principal
# ----------------------------------------------------------------------------------------------------------------------
CHOIX=""
principal() {
  local passes=0 rc
  # La reprise tourne dans un sous-shell où set -e est REVENU en vigueur (jamais dans un contexte `||` ou `if`, qui le coupe) :
  # si la réponse « interrompu » ne peut pas être posée, le travail n'est pas effacé (reprendre le vérifie elle-même).
  set +e
  ( set -e; reprendre )
  rc=$?
  set -e
  if [ "$rc" != 0 ]; then journal "reprise non terminée (code $rc) : ce qui reste n'a pas été effacé"; fi
  pouls || journal "pouls non écrit"
  while [ "$passes" -lt 8 ]; do
    passes=$((passes + 1))
    # Borne de sécurité : une nouvelle demande n'est prise que si le temps écoulé laisse un travail entier (3 × 960 s) avant
    # TimeoutStartSec ; la .service lance `--une-fois` (une seule demande par passage), cette borne couvre les lancements à la main.
    if [ "$SECONDS" -ge "$BUDGET_S" ]; then journal "borne de temps atteinte : la suite au prochain passage"; break; fi
    # Un conteneur de capture vivant (essai manuel, reste) : on ne prend RIEN, on ne touche à rien ; la demande attend.
    if ! poste_libre; then journal "poste occupé : rien n'est pris"; break; fi
    choisir_demande
    [ -n "$CHOIX" ] || break
    # Demande retirée par le studio entre le `find` et le `mv -T` : situation normale, on passe (l'unité ne doit pas échouer).
    if ! prendre_demande "$CHOIX"; then journal "demande disparue : $CHOIX"; continue; fi
    # Appel SANS `||`, `&&`, `if` ni `!` : `set -e` reste en vigueur dans tout le travail (voir traiter_demande).
    traiter_demande "$CHOIX"
    [ "$ARRET_BOUCLE" = 0 ] || break
    pouls || journal "pouls non écrit"
    if [ "$UNE_FOIS" = 1 ]; then break; fi
  done
}
# `exit` juste après : bash lit le script au fil de l'eau ; une réécriture en place pendant un travail ne doit jamais faire
# exécuter un mélange de l'ancien et du nouveau texte.
principal; exit $?
