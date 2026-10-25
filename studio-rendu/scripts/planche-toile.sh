#!/usr/bin/env bash
# Planche du lot P2 (ImageMagick), à partir des rendus réels de `essai-toile.ts` (le lancer d'abord) : pour chaque toile, la bande d'aperçu
# (sortie de l'opération), puis les pages JPEG déposées, côte à côte. Les coutures sont marquées d'un trait de contrôle ajouté SUR LA PLANCHE
# seulement (jamais dans les pages).
# Usage (depuis `studio-rendu/`) : bash scripts/planche-toile.sh
set -euo pipefail
cd "$(dirname "$0")/../essais-visuels/continu/p2"
LARGEUR=2160
travail=$(mktemp -d)
trap 'rm -rf "$travail"' EXIT
lignes=()
for dossier in toile-*/; do
  nom=${dossier%/}
  pages=("$nom"/page-*.jpg)
  n=${#pages[@]}
  w=$((LARGEUR / n))
  # Pages côte à côte (sans espace) à la même échelle, puis un trait par couture.
  montage "${pages[@]}" -tile "${n}x1" -geometry "${w}x+0+0" -background '#F8F0E3' "$travail/$nom-pages.png"
  h=$(identify -format '%h' "$travail/$nom-pages.png")
  traits=()
  for ((k = 1; k < n; k++)); do traits+=(-draw "line $((k * w)),0 $((k * w)),$h"); done
  convert "$travail/$nom-pages.png" -stroke '#1E6BFF' -strokewidth 3 "${traits[@]}" "$travail/$nom-pages.png"
  convert "$nom/bande.jpg" -resize "${LARGEUR}x" "$travail/$nom-bande.png"
  convert -background '#F8F0E3' -fill '#0D0A07' -font DejaVu-Sans -pointsize 26 label:"$nom : bande (sortie) puis $n pages déposées, coutures en bleu" \
    "$travail/$nom-bande.png" -size "${LARGEUR}x12" xc:'#F8F0E3' "$travail/$nom-pages.png" -append "$travail/$nom.png"
  lignes+=("$travail/$nom.png" -size "${LARGEUR}x40" xc:'#F8F0E3')
done
convert "${lignes[@]}" -append -resize 1800x -quality 82 planche-p2.jpg
echo "Planche écrite : essais-visuels/continu/p2/planche-p2.jpg ($(du -k planche-p2.jpg | cut -f1) Ko)"
