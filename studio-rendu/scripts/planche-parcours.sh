#!/usr/bin/env bash
# Planche « avant / après » du lot P3h (ImageMagick) : pour chacun des huit parcours, la capture de la maquette (« avant », dossier donné en
# argument, fichiers pano-a.png à pano-h.png faits par un script Playwright HORS du dépôt) au-dessus du rendu Remotion (« après »,
# `essais-visuels/continu/p3h/<id>-4x5-moyen/bande.jpg`, produit par `essai-continu-parcours.ts`). Les deux sont ramenés à la même largeur.
# Usage (depuis `studio-rendu/`) : bash scripts/planche-parcours.sh <dossier des captures de la maquette>
set -euo pipefail
captures=${1:?dossier des captures de la maquette (pano-a.png … pano-h.png)}
cd "$(dirname "$0")/.."
sortie=essais-visuels/continu/p3h
travail=$(mktemp -d)
trap 'rm -rf "$travail"' EXIT
LARGEUR=1600
lignes=()
for couple in PA:a PB:b PC:c PD:d PE:e PF:f PG:g PH:h; do
  id=${couple%%:*}
  lettre=${couple##*:}
  # Nombre de pages du parcours = largeur de la capture / 1080 ; le rendu contient parfois une page d'appel d'essai en plus : on l'écarte.
  n=$(( $(identify -format '%w' "$captures/pano-$lettre.png") / 1080 ))
  pages=()
  for ((k = 1; k <= n; k++)); do pages+=("$sortie/$id-4x5-moyen/page-$(printf '%02d' "$k").jpg"); done
  montage "${pages[@]}" -tile "${n}x1" -geometry "+0+0" -background '#F8F0E3' "$travail/$id-apres.png"
  convert "$captures/pano-$lettre.png" -resize "${LARGEUR}x" "$travail/$id-avant.png"
  convert "$travail/$id-apres.png" -resize "${LARGEUR}x" "$travail/$id-apres.png"
  convert -background '#F8F0E3' -fill '#0D0A07' -font DejaVu-Sans -pointsize 22 label:"$id : maquette (avant), puis rendu Remotion (après)" \
    "$travail/$id-avant.png" -size "${LARGEUR}x8" xc:'#F8F0E3' "$travail/$id-apres.png" -append "$travail/$id.png"
  lignes+=("$travail/$id.png" -size "${LARGEUR}x24" xc:'#F8F0E3')
done
convert "${lignes[@]}" -append -resize 1500x -quality 80 "$sortie/planche-avant-apres.jpg"
echo "Planche écrite : $sortie/planche-avant-apres.jpg ($(du -k "$sortie/planche-avant-apres.jpg" | cut -f1) Ko)"
