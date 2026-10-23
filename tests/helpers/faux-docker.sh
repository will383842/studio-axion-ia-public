#!/usr/bin/env bash
# FAUX `docker` des tests de la vérif V5 (scripts du serveur) : aucun vrai conteneur, aucun réseau.
# État dans $FAUX_DOCKER :
#   appels.log            chaque appel (« docker … »), dans l'ordre
#   images/<nom:tag>      une image = un fichier (son contenu est l'identifiant de construction)
#   en-service/<service>  image démarrée par le dernier `compose up`
#   absent-<service>      le service n'a pas de conteneur (première installation)
#   arrete-<service>      le conteneur existe mais est arrêté : visible par `ps -a` seulement
#   ps-ko                 `compose ps` échoue (démon docker injoignable…)
#   sante-<service>       état de santé du conteneur (défaut : healthy)
#   sante-ko              /api/sante ne répond pas 200
#   fabrications          vidéos en cours lues par psql, une ligne par lecture (« ko » : lecture en échec ;
#                         « bloque » : psql ne répond jamais ; « N|C » : N en cours dont C en attente de crédit)
#   pause.log             pause de la boucle de fond posée / levée par le script (bail « mise-en-ligne »)
#   tag-ko                `docker image tag … <nom>:local` échoue
#   outils-ko             le contrôle réel des outils vidéo échoue (docker run)
#   build-ko              la construction échoue
#   stats                 sortie de `docker stats` (Nom;MemPerc;MemUsage)
#   alertes.log           e-mails d'alerte envoyés (copier-r2.mjs alerte)
#   conteneurs/<id>/…     système de fichiers d'un conteneur (`/tmp`, `/app/travaux` y sont redirigés)
# `compose exec base …` et `exec <id-base> …` lancent la commande en LOCAL (Postgres local du test : PGHOST, PGPORT).
set -u
F="${FAUX_DOCKER:?FAUX_DOCKER manquant}"
mkdir -p "$F/images" "$F/en-service" "$F/conteneurs"
echo "docker $*" >>"$F/appels.log"

fichier_image() { echo "$F/images/${1//\//_}"; }
image_du_service() {
  case "$1" in
    studio) echo studio-axion-ia ;;
    studio-rendu) echo studio-rendu ;;
    studio-aligneur) echo studio-aligneur ;;
    base) echo postgres ;;
  esac
}

# Commande lancée « dans » un conteneur : base → Postgres local ; autres → chemins redirigés sous conteneurs/<id>/.
dans_conteneur() {
  local id="$1" args=() a
  shift
  if [ "$id" = id-base ] || [ "$id" = studio-axion-ia-base-1 ]; then
    if [ -n "${PGHOST:-}" ]; then
      exec "$@"
    fi
    case "$1" in
      pg_dump) printf -- '-- faux dump\nCREATE TABLE documents ();\n-- PostgreSQL database dump complete\n' ;;
      # Vidéos en cours : une ligne de $F/fabrications par lecture (la dernière reste) ; sans fichier : « 0 ».
      # Une ligne « ko » : la lecture échoue (base qui redémarre, mot de passe refusé…), code 2, rien sur la sortie.
      psql)
        # Pause de la boucle de fond (bail « mise-en-ligne ») : notée, ne consomme aucune ligne de $F/fabrications.
        if [[ "$*" == *"'baux'"* ]]; then
          case "$*" in
            *INSERT*) echo pose >>"$F/pause.log" ;;
            *DELETE*) echo leve >>"$F/pause.log" ;;
          esac
          exit 0
        fi
        if [ -f "$F/fabrications" ]; then
          ligne="$(head -n 1 "$F/fabrications")"
          [ "$(wc -l <"$F/fabrications")" -gt 1 ] && sed -i 1d "$F/fabrications"
          # Base qui ne répond jamais : le processus lui-même dort (un `timeout` le tue, rien d'orphelin ne garde la sortie).
          [ "$ligne" = bloque ] && exec sleep 300
          if [ "$ligne" = ko ]; then
            echo 'psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed' >&2
            exit 2
          fi
          echo "$ligne"
        else
          echo 0
        fi
        ;;
    esac
    exit 0
  fi
  for a in "$@"; do
    case "$a" in
      /tmp* | /app/*) args+=("$F/conteneurs/$id$a") ;;
      *) args+=("$a") ;;
    esac
  done
  exec "${args[@]}"
}

case "${1:-}" in
  image)
    case "${2:-}" in
      inspect) [ -f "$(fichier_image "$3")" ] ;;
      tag)
        [ -f "$(fichier_image "$3")" ] || { echo "Error: No such image: $3" >&2; exit 1; }
        if [ -f "$F/tag-ko" ] && [[ "$4" == *:local ]]; then echo "Error: tag $4 refusé (essai)" >&2; exit 1; fi
        cp "$(fichier_image "$3")" "$(fichier_image "$4")"
        ;;
      prune) exit 0 ;;
      ls) ls "$F/images" ;;
      *) exit 0 ;;
    esac
    exit $?
    ;;
  builder | volume | system | network) exit 0 ;;
  compose)
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        --env-file | --profile | -f | -p) shift 2 ;;
        *) break ;;
      esac
    done
    commande="${1:-}"
    shift || true
    case "$commande" in
      build)
        [ -f "$F/build-ko" ] && exit 1
        n=$(($(cat "$F/compteur" 2>/dev/null || echo 0) + 1))
        echo "$n" >"$F/compteur"
        for s in "$@"; do echo "construite-$n" >"$(fichier_image "$(image_du_service "$s"):local")"; done
        ;;
      up)
        for s in studio studio-rendu studio-aligneur; do
          img="$(fichier_image "$(image_du_service "$s"):local")"
          [ -f "$img" ] && cp "$img" "$F/en-service/$s"
        done
        ;;
      stop | start | restart | logs) exit 0 ;;
      ps)
        [ -f "$F/ps-ko" ] && { echo "Cannot connect to the Docker daemon" >&2; exit 1; }
        s="${*: -1}"
        tous=0
        for a in "$@"; do [ "$a" = -a ] && tous=1; done
        if [ -f "$F/absent-$s" ]; then :
        elif [ -f "$F/arrete-$s" ]; then [ "$tous" = 1 ] && echo "id-$s"
        else echo "id-$s"
        fi
        ;;
      exec)
        [ "${1:-}" = -T ] && shift
        s="$1"
        shift
        if [ "$s" = studio ]; then
          [ -f "$F/sante-ko" ] && exit 1
          exit 0
        fi
        dans_conteneur "id-$s" "$@"
        ;;
    esac
    exit 0
    ;;
  inspect)
    id="${*: -1}"
    cat "$F/sante-${id#id-}" 2>/dev/null || echo healthy
    ;;
  exec)
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        -i | -t | -it | -T) shift ;;
        -u | -w | -e) shift 2 ;;
        *) break ;;
      esac
    done
    id="$1"
    shift
    dans_conteneur "$id" "$@"
    ;;
  run)
    if [[ "$*" == *copier-r2.mjs* ]]; then
      echo "$*" >>"$F/alertes.log"
      exit 0
    fi
    [ -f "$F/outils-ko" ] && exit 1
    exit 0
    ;;
  stats) cat "$F/stats" 2>/dev/null ;;
  *) exit 0 ;;
esac
