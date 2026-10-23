# Fonctions partagées par mettre-a-jour.sh et revenir.sh (sourcé, jamais lancé seul).
# shellcheck shell=bash

RACINE="${STUDIO_RACINE:-/opt/studio-axion-ia}"
ENV_FICHIER="${STUDIO_ENV_FICHIER:-$RACINE/.env}"
# Images construites sur le serveur : celle en service est gardée sous le tag `precedente` avant chaque construction.
# shellcheck disable=SC2034 # lu par les scripts qui sourcent ce fichier
IMAGES=(studio-axion-ia studio-rendu studio-aligneur)
# Attente maximale de /api/sante en 200 après un démarrage (secondes).
ATTENTE_SANTE_SEC="${STUDIO_ATTENTE_SANTE_SEC:-180}"

compose() {
  docker compose --env-file "$ENV_FICHIER" "$@"
}

# Calage des sous-titres (profil « calage ») : actif seulement si STUDIO_ALIGNEUR_URL est une adresse http(s), avec ou
# sans guillemets (VERIF-E2E-2, gêne 18).
calage_actif() {
  grep -Eq "^STUDIO_ALIGNEUR_URL=[\"']?https?://" "$ENV_FICHIER"
}

# Une variable du .env est-elle renseignée (non vide, guillemets compris) ?
variable_renseignee() {
  grep -Eq "^$1=[\"']?[^\"'[:space:]]" "$ENV_FICHIER"
}

# studio-rendu demande 6 cœurs au plus ; une machine plus petite les refuserait (« range of CPUs is from… ») et rien
# ne démarrerait (VERIF-E2E-2, gêne 17). Sans réglage dans le .env, on prend le nombre de cœurs de la machine, 6 au plus.
if ! grep -Eq '^STUDIO_RENDU_CPUS=' "$ENV_FICHIER" 2>/dev/null && [ -z "${STUDIO_RENDU_CPUS:-}" ]; then
  COEURS="$(nproc 2>/dev/null || echo 6)"
  if [ "$COEURS" -gt 6 ]; then COEURS=6; fi
  export STUDIO_RENDU_CPUS="$COEURS"
fi

# Services qui doivent être en bonne santé : la base, le studio, studio-rendu, et studio-aligneur si le calage est actif.
services_attendus() {
  echo base studio studio-rendu
  if calage_actif; then echo studio-aligneur; fi
}

# Image construite par chaque service (le tag `bonne` n'est posé que sur celles des services vérifiés sains).
image_du_service() {
  case "$1" in
    studio) echo studio-axion-ia ;;
    studio-rendu) echo studio-rendu ;;
    studio-aligneur) echo studio-aligneur ;;
    *) echo "" ;;
  esac
}

# État d'un service d'après le contrôle de santé de son conteneur : healthy, starting, unhealthy ; sinon l'état du
# conteneur (restarting, exited…) ; « absent » SEULEMENT si docker répond et ne connaît aucun conteneur pour ce service
# (`ps -a` : un conteneur arrêté existe, ce n'est pas une première installation) ; « inconnu » si docker ne répond pas.
etat_service() {
  local id
  if ! id="$(compose --profile calage ps -a -q "$1" 2>/dev/null)"; then
    echo inconnu
    return
  fi
  id="$(printf '%s\n' "$id" | head -n 1)"
  if [ -z "$id" ]; then
    echo absent
    return
  fi
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo inconnu
}

# Chaque service attendu est-il « healthy » ? Attend au plus ATTENTE_SANTE_SEC (VERIF-E2E-2, B2 : un studio-rendu qui
# redémarre en boucle ne doit plus passer pour une version en bonne santé).
attendre_services_sains() {
  local fin=$((SECONDS + ATTENTE_SANTE_SEC)) service tous
  while :; do
    tous=1
    for service in $(services_attendus); do
      if [ "$(etat_service "$service")" != healthy ]; then tous=0; fi
    done
    if [ "$tous" = 1 ]; then return 0; fi
    if [ "$SECONDS" -ge "$fin" ]; then return 1; fi
    sleep "${STUDIO_INTERVALLE_SANTE_SEC:-5}"
  done
}

# Affiche l'état de chaque service et la fin du journal de ceux qui ne sont pas sains.
expliquer_echec_services() {
  local service etat
  echo "" >&2
  echo "============================================================" >&2
  echo "ÉCHEC : un service n'est pas en bonne santé après ${ATTENTE_SANTE_SEC} s." >&2
  for service in $(services_attendus); do
    etat="$(etat_service "$service")"
    echo "  $service : $etat" >&2
    if [ "$etat" != healthy ]; then
      compose --profile calage logs --tail 30 "$service" >&2 || true
    fi
  done
  echo "============================================================" >&2
}

# Pose le tag `bonne` (référence du prochain retour arrière) sur l'image de chaque service attendu ET sain.
marquer_bonnes() {
  local service image
  for service in $(services_attendus); do
    image="$(image_du_service "$service")"
    if [ -n "$image" ] && [ "$(etat_service "$service")" = healthy ] && docker image inspect "$image:local" >/dev/null 2>&1; then
      docker image tag "$image:local" "$image:bonne"
    fi
  done
}

# /api/sante répond-il 200 DANS le conteneur du studio (aucun port n'est publié) ? Attend au plus ATTENTE_SANTE_SEC.
attendre_sante() {
  local fin=$((SECONDS + ATTENTE_SANTE_SEC))
  while [ "$SECONDS" -lt "$fin" ]; do
    if compose exec -T studio node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${STUDIO_INTERVALLE_SANTE_SEC:-5}"
  done
  return 1
}

# Affiche l'échec de santé de façon claire, avec la réponse de la sonde et la fin du journal du studio.
expliquer_echec_sante() {
  echo "" >&2
  echo "============================================================" >&2
  echo "ÉCHEC : le studio ne répond pas 200 sur /api/sante après ${ATTENTE_SANTE_SEC} s." >&2
  echo "Réponse de la sonde :" >&2
  compose exec -T studio node -e "fetch('http://127.0.0.1:3000/api/sante').then(async r=>console.log(r.status, await r.text())).catch(e=>console.log('injoignable', e.message))" >&2 || true
  echo "Fin du journal du studio :" >&2
  compose logs --tail 40 studio >&2 || true
  echo "============================================================" >&2
}

# Copie vérifiée de la base avant une mise à jour (gunzip -t, fin de dump). Base pas encore démarrée (première
# installation) : rien à copier. Copie ratée : arrêt, rien n'est redémarré.
sauvegarder_avant_mise_a_jour() {
  local dossier="$RACINE/sauvegardes" nom temporaire
  if [ "$(etat_service base)" = absent ]; then
    echo "Base pas encore démarrée : aucune copie avant mise à jour."
    return 0
  fi
  mkdir -p "$dossier"
  nom="avant-maj-$(date +%F_%H%M%S).sql.gz"
  temporaire="$dossier/.$nom.part"
  if compose exec -T base pg_dump -U studio -d studio | gzip >"$temporaire" \
    && gunzip -t "$temporaire" \
    && gunzip -c "$temporaire" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
    mv "$temporaire" "$dossier/$nom"
    echo "Copie de la base avant mise à jour : $dossier/$nom"
    return 0
  fi
  echo "ÉCHEC : la copie de la base avant mise à jour n'a pas pu être vérifiée ($temporaire gardé). Rien n'a été redémarré." >&2
  exit 1
}

# Codes de sortie de mettre-a-jour.sh quand il S'ARRÊTE PAR PRUDENCE (rien n'a été redémarré, la version en service
# continue). 1 reste « panne » (construction, outils vidéo, santé…). Lus par celui qui lance le script (session 92).
# shellcheck disable=SC2034 # lu par les scripts qui sourcent ce fichier
CODE_ATTENTE_EPUISEE=3   # des vidéos sont encore en cours au bout de STUDIO_MAJ_ATTENTE_MAX_MIN : relancer plus tard
# shellcheck disable=SC2034
CODE_BASE_ILLISIBLE=4    # la base tourne mais les vidéos en cours n'ont pas pu être lues : regarder la base
# shellcheck disable=SC2034
CODE_DEJA_EN_COURS=5     # une autre mise à jour (ou un retour arrière, une restauration) tourne déjà : rien n'a été fait

# Délais maximaux de ce qui tourne en tenant le verrou (relecture 18/10 : sans eux, une base ou un réseau muet bloquait
# la mise à jour, et toutes les suivantes, sans fin).
DELAI_BASE_SEC="${STUDIO_DELAI_BASE_SEC:-30}"   # une requête psql (timeout) ; la connexion seule : 10 s (connect_timeout)
# shellcheck disable=SC2034 # lu par mettre-a-jour.sh
DELAI_PULL_SEC="${STUDIO_DELAI_PULL_SEC:-120}"  # le git pull (timeout) ; la connexion ssh seule : 20 s (ConnectTimeout)

# Verrou des mises à jour (Will, 18/10 : deux mises à jour lancées en même temps ont laissé un conteneur orphelin, studio
# coupé ≈ 5 min). Un FICHIER, pas un `pgrep` (qui ne voit pas `nohup setsid bash …/mettre-a-jour.sh`). Pris aussi par
# revenir.sh et restaurer-base.sh : une seule de ces opérations à la fois.
VERROU_MAJ="$RACINE/mise-a-jour.verrou"

refuser_mise_a_jour_en_cours() {
  echo "REFUSÉ ($(basename "$0")) : une mise à jour, un retour arrière ou une restauration tourne déjà (${1:-détenteur inconnu}). Rien n'a été fait." >&2
  echo "Elle s'arrête d'elle-même dans la plupart des cas : attente des vidéos en cours ${STUDIO_MAJ_ATTENTE_MAX_MIN:-120} min au plus," >&2
  echo "chaque lecture de la base ${DELAI_BASE_SEC} s au plus, git pull ${DELAI_PULL_SEC} s au plus." >&2
  echo "La construction des images et la copie de la base n'ont PAS de délai maximal : si elle semble bloquée," >&2
  echo "regarder le processus (ps -fp <PID>) avant de relancer." >&2
  echo "Verrou : $VERROU_MAJ" >&2
  exit "$CODE_DEJA_EN_COURS"
}

# Sortie du script, quelle qu'elle soit : la pause de la boucle est levée, le verrou rendu (explicitement : un processus
# enfant qui aurait hérité du descripteur ne le garde pas).
fin_du_script() {
  lever_pause_fabrications
  flock -u 9 2>/dev/null || true
}

# Prend le verrou ou SORT (code CODE_DEJA_EN_COURS) sans rien faire. flock seulement : rendu par le noyau à la mort du
# processus (même kill -9), aucun PID à interpréter. Sans flock (paquet util-linux, toujours présent sur le serveur) :
# refus net, jamais une mise à jour sans verrou (relecture 18/10 : le secours par dossier avait une course à la reprise
# et se fiait à un PID qui peut être réattribué). La relance (exec, même PID) garde le verrou par le descripteur 9 hérité.
prendre_verrou_mise_a_jour() {
  # Signal (Ctrl-C, kill, fermeture de session) : sortie normale, donc trap EXIT joué, donc verrou rendu.
  trap 'exit 130' INT
  trap 'exit 143' TERM HUP
  if ! command -v flock >/dev/null 2>&1; then
    echo "REFUSÉ : flock introuvable (paquet util-linux) : aucune opération de mise en ligne sans verrou. Rien n'a été fait." >&2
    exit 1
  fi
  # Descripteur 9 déjà ouvert sur le verrou : hérité de la relance (exec), c'est la même prise, rien à rouvrir.
  if [ "$(readlink "/proc/$$/fd/9" 2>/dev/null)" != "$(realpath -m "$VERROU_MAJ")" ]; then
    exec 9>>"$VERROU_MAJ"
  fi
  flock -n 9 || refuser_mise_a_jour_en_cours "$(head -n 1 "$VERROU_MAJ" 2>/dev/null)"
  trap fin_du_script EXIT
  printf 'PID %s (%s) depuis %s\n' "$$" "$(basename "$0")" "$(date '+%F %T')" >"$VERROU_MAJ"
}

# Une requête SQL dans la base, bornée : `timeout` (code 124 au-delà de DELAI_BASE_SEC) et connect_timeout (le
# PGCONNECT_TIMEOUT de libpq, passé dans la chaîne de connexion). Sortie brute de psql (-At), erreurs sur stderr.
requete_base() {
  timeout "$DELAI_BASE_SEC" docker compose --env-file "$ENV_FICHIER" exec -T base \
    psql -X -v ON_ERROR_STOP=1 -At -d "dbname=studio user=studio connect_timeout=10" -c "$1"
}

# Vidéos en cours de fabrication (travaux « en_cours », exemples exclus), lues dans la base. Réussite : « N C » sur la
# sortie (N en cours, dont C en attente de crédit : elles ne fabriquent pas, elles attendent une recharge, mais elles
# comptent : travaux.ts les garde « en_cours »). Échec (lecture ratée, délai dépassé, réponse qui n'est pas un nombre) :
# code 1 et, sur la sortie, la dernière ligne d'erreur (jamais confondu avec « 0 »).
fabrications_en_cours() {
  local sortie code=0 erreur premiere
  erreur="$(mktemp)"
  sortie="$(requete_base "select count(*), count(*) filter (where data->'reprise'->>'motif' = 'credit') from documents where collection = 'travaux' and data->>'statut' = 'en_cours' and coalesce(data->>'estDemo', 'false') <> 'true'" 2>"$erreur")" || code=$?
  if [ "$code" -ne 0 ]; then
    if [ "$code" -eq 124 ]; then
      echo "pas de réponse de la base en ${DELAI_BASE_SEC} s"
    else
      echo "psql code $code : $(grep -v '^[[:space:]]*$' "$erreur" | tail -n 1 | cut -c1-300)"
    fi
    rm -f "$erreur"
    return 1
  fi
  rm -f "$erreur"
  premiere="$(printf '%s\n' "$sortie" | head -n 1)"
  if [[ "$(printf '%s' "$sortie" | tr -d '[:space:]')" =~ ^([0-9]+)(\|([0-9]+))?$ ]]; then
    echo "${BASH_REMATCH[1]} ${BASH_REMATCH[3]:-0}"
    return 0
  fi
  echo "réponse inattendue : $(printf '%s' "$premiere" | cut -c1-300)"
  return 1
}

# « 2 vidéo(s) en cours » ou « 2 vidéo(s) en cours, dont 1 en attente de crédit (…) ».
dire_fabrications() {
  if [ "$2" -gt 0 ]; then
    echo "$1 vidéo(s) en cours, dont $2 en attente de crédit (elle(s) ne fabrique(nt) pas, elle(s) attend(ent) une recharge)"
  else
    echo "$1 vidéo(s) en cours"
  fi
}

# Pause de la boucle de fond pendant la mise en ligne (relecture 18/10, 7a) : un BAIL « mise-en-ligne » dans la base
# (même format que prendreBail, src/donnees/postgres) ; tant qu'il est tenu, la boucle ne sort aucun travail de la file
# (src/services/travaux.ts, CLE_PAUSE_MISE_EN_LIGNE). Il expire seul (STUDIO_MAJ_PAUSE_MIN, 30 min) : un script tué
# ne bloque jamais les fabrications plus longtemps. Levé (ligne effacée) juste après `up -d` et à la sortie du script
# (fin_du_script), quelle qu'elle soit.
CLE_PAUSE_FABRICATIONS="mise-en-ligne"
PAUSE_POSEE=""

poser_pause_fabrications() {
  if requete_base "INSERT INTO documents (collection, id, data, modifie_le) VALUES ('baux', '$CLE_PAUSE_FABRICATIONS', jsonb_build_object('titulaire', 'mettre-a-jour.sh', 'expireLe', now() + interval '${STUDIO_MAJ_PAUSE_MIN:-30} minutes'), now()) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now()" >/dev/null; then
    PAUSE_POSEE=1
    echo "Boucle de fond en pause : plus aucune vidéo ne sort de la file pendant la mise en ligne (${STUDIO_MAJ_PAUSE_MIN:-30} min au plus)."
  else
    echo "ATTENTION : pause de la boucle de fond impossible ; la dernière relecture juste avant le redémarrage reste la garde." >&2
  fi
}

lever_pause_fabrications() {
  [ -n "$PAUSE_POSEE" ] || return 0
  if requete_base "DELETE FROM documents WHERE collection = 'baux' AND id = '$CLE_PAUSE_FABRICATIONS'" >/dev/null; then
    PAUSE_POSEE=""
    echo "Pause de la boucle de fond levée."
  else
    echo "ATTENTION : pause de la boucle de fond non levée : elle expire seule (${STUDIO_MAJ_PAUSE_MIN:-30} min au plus après sa pose)." >&2
  fi
}

# Will, 15/10 : une mise à jour ne coupe plus les vidéos en cours. Avant le redémarrage, on attend que plus aucune vidéo
# ne soit « en cours » (les vidéos en file repartent seules après le redémarrage), en le redisant chaque minute. À « 0 »,
# mettre-a-jour.sh copie la base, met la boucle de fond en pause et relit encore une fois juste avant `up -d`
# (pause_et_derniere_relecture).
# Arrêts PAR PRUDENCE, sans rien redémarrer (Will, 18/10) :
#  - au-delà de STUDIO_MAJ_ATTENTE_MAX_MIN minutes (120 par défaut, comptées depuis la PREMIÈRE attente) :
#    code CODE_ATTENTE_EPUISEE ;
#  - base PRÉSENTE mais illisible STUDIO_MAJ_LECTURES_RATEES_MAX fois de suite (3 par défaut, un essai par pas) :
#    code CODE_BASE_ILLISIBLE (avant : redémarrage sans attendre, donc vidéos coupées).
# Base ABSENTE (aucun conteneur, même arrêté : première installation) : rien à attendre. STUDIO_MAJ_FORCER=1 redémarre
# sans attendre (urgence seulement : coupe les vidéos en cours).
ATTENTE_DEBUT=""
attendre_fabrications_finies() {
  if [ "${STUDIO_MAJ_FORCER:-}" = 1 ]; then
    echo "STUDIO_MAJ_FORCER=1 : redémarrage sans attendre les vidéos en cours."
    return 0
  fi
  if [ "$(etat_service base)" = absent ]; then
    echo "Base pas encore démarrée (première installation) : aucune vidéo en cours à attendre."
    return 0
  fi
  local max_sec=$(( ${STUDIO_MAJ_ATTENTE_MAX_MIN:-120} * 60 )) pas="${STUDIO_MAJ_ATTENTE_PAS_SEC:-60}"
  local ratees_max="${STUDIO_MAJ_LECTURES_RATEES_MAX:-3}" ratees=0 lu n credit derniere_erreur=""
  ATTENTE_DEBUT="${ATTENTE_DEBUT:-$(date +%s)}"
  while :; do
    if lu="$(fabrications_en_cours)"; then
      ratees=0
      read -r n credit <<<"$lu"
      if [ "$n" -eq 0 ]; then
        echo "Aucune vidéo en cours : redémarrage (après la copie de la base et une dernière relecture)."
        return 0
      fi
    else
      ratees=$((ratees + 1))
      derniere_erreur="$lu"
      if [ "$ratees" -ge "$ratees_max" ]; then
        echo "MISE À JOUR ARRÊTÉE : impossible de lire les vidéos en cours dans la base ($ratees essais). Rien n'a été redémarré." >&2
        echo "Dernière erreur : $derniere_erreur" >&2
        echo "Vérifier la base (docker compose ps base ; docker compose logs --tail 50 base), puis relancer." >&2
        echo "Urgence seulement (coupe les vidéos en cours) : STUDIO_MAJ_FORCER=1 bash $RACINE/source/deploiement/mettre-a-jour.sh" >&2
        return "$CODE_BASE_ILLISIBLE"
      fi
      echo "Base présente mais lecture des vidéos en cours impossible (essai $ratees/$ratees_max : $derniere_erreur) : nouvel essai dans ${pas} s…"
      sleep "$pas"
      continue
    fi
    if [ $(( $(date +%s) - ATTENTE_DEBUT )) -ge "$max_sec" ]; then
      echo "MISE À JOUR ARRÊTÉE : $n vidéo(s) encore en cours après ${STUDIO_MAJ_ATTENTE_MAX_MIN:-120} min. Rien n'a été redémarré." >&2
      if [ "$credit" -gt 0 ]; then
        echo "  dont $credit en attente de crédit : elle(s) ne fabrique(nt) pas, elle(s) attend(ent) une recharge. Recharger le" >&2
        echo "  fournisseur (la vidéo repart seule), ou « Arrêter » la vidéo dans le studio, puis relancer." >&2
      fi
      echo "Relancer plus tard, ou forcer (coupe les vidéos) : STUDIO_MAJ_FORCER=1 bash $RACINE/source/deploiement/mettre-a-jour.sh" >&2
      return "$CODE_ATTENTE_EPUISEE"
    fi
    echo "$(dire_fabrications "$n" "$credit") : la mise à jour attend qu'elles finissent (nouvel essai dans ${pas} s)…"
    sleep "$pas"
  done
}

# Juste avant `up -d` (relecture 18/10, 7a), APRÈS la copie de la base (qui peut durer des minutes ; la pause n'est
# jamais dans la copie, donc jamais remise par une restauration) : la boucle est mise en pause (plus aucune vidéo ne sort
# de la file d'ici le redémarrage), PUIS on relit. 0 : on redémarre. Une vidéo sortie de la file pendant la copie (ou
# lecture ratée) : la pause est levée et mettre-a-jour.sh retourne attendre (code 1 ici).
pause_et_derniere_relecture() {
  if [ "${STUDIO_MAJ_FORCER:-}" = 1 ] || [ "$(etat_service base)" = absent ]; then
    return 0
  fi
  poser_pause_fabrications
  local lu n credit
  if lu="$(fabrications_en_cours)"; then
    read -r n credit <<<"$lu"
    if [ "$n" -eq 0 ]; then
      echo "Dernière relecture juste avant le redémarrage : aucune vidéo en cours."
      return 0
    fi
    echo "Dernière relecture : $n vidéo(s) ont démarré pendant la copie de la base : la mise à jour attend de nouveau."
  else
    echo "Dernière relecture impossible ($lu) : la mise à jour attend de nouveau."
  fi
  lever_pause_fabrications
  return 1
}
