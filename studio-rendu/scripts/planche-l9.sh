#!/usr/bin/env bash
# Planches du lot L9 (ImageMagick `montage`), à partir des rendus réels de `essai-l9.ts` (lancer d'abord `essai-l9.ts` puis `essai-l9.ts avant`).
#  - planche-avant-apres.jpg : une ligne par gabarit — AVANT (même contenu dans l'ancien gabarit), puis APRÈS en contenu moyen, minimal, maximal ;
#  - planche-variantes.jpg   : toutes les mises en page (nombre d'éléments) en contenu moyen, maximal et frontière.
# Usage (depuis `studio-rendu/`) : bash scripts/planche-l9.sh
set -euo pipefail
cd "$(dirname "$0")/../essais-visuels/l9"
lignes=()
for t in t22 t23 t24 t26 t27 t28; do
  max=$(ls apres/${t}-maximal-v*.jpg | sort | tail -n 1)
  lignes+=("avant/${t}-avant.jpg" "apres/${t}-moyen.jpg" "apres/${t}-minimal.jpg" "$max")
done
montage -label '%t' -pointsize 22 "${lignes[@]}" -tile 4x -geometry 432x540+10+10 -background '#F8F0E3' -quality 86 planche-avant-apres.jpg
montage -label '%t' -pointsize 22 apres/*-moyen-*.jpg apres/*-maximal-v*.jpg apres/*-frontiere-*.jpg -tile 6x -geometry 324x405+8+8 -background '#F8F0E3' -quality 84 planche-variantes.jpg
echo "Planches écrites : essais-visuels/l9/planche-avant-apres.jpg, essais-visuels/l9/planche-variantes.jpg"
