#!/usr/bin/env sh
# MAQUETTES DE VARIÉTÉ (lot L1) : envoie les sources au serveur, rend les images dans un conteneur JETABLE
# (image `studio-rendu:local`, 2 processeurs, 3 Go, sans réseau), rapatrie les JPG puis efface le dossier temporaire.
# Ne touche à aucun conteneur en service. Usage (racine du dépôt) : sh outils/maquettes-variete/serveur.sh [noms…]
set -eu
HOTE="${HOTE:-axion-prod}"
TMP=/tmp/maquettes-l1
ICI="outils/maquettes-variete"
mkdir -p "$ICI/sortie"
ssh "$HOTE" "rm -rf $TMP && mkdir -p $TMP/briques $TMP/compositions $TMP/sortie && chmod 777 $TMP/sortie"
tar -C studio-rendu/compositions -cf - . | ssh "$HOTE" "tar -C $TMP/compositions -xf -"
tar -C src/briques -cf - . | ssh "$HOTE" "tar -C $TMP/briques -xf -"
scp -q "$ICI/rendre.mjs" "$ICI/sortie/sous-titres.json" "$HOTE:$TMP/"
ssh "$HOTE" "docker run --rm --cpus 2 --memory 3g --network none -v $TMP:/travail --entrypoint sh studio-rendu:local -c 'rm -rf compositions /app/src/briques && cp -r /travail/compositions . && cp -r /travail/briques /app/src/briques && cp /travail/rendre.mjs . && node rendre.mjs $*'"
scp -q "$HOTE:$TMP/sortie/*.jpg" "$ICI/sortie/"
ssh "$HOTE" "rm -rf $TMP"
echo "Images rapatriées dans $ICI/sortie/"
