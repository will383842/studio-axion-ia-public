# Maquettes des vignettes

- `gabarit/` : le socle (`socle.css`, `socle.js`) et les variantes par générateur (`variantes-*.js`). `page.html?g=<id>&r=169|916[&insta=1][&reperes=1]` affiche une vignette.
- `16x9/` (1280×720), `9x16/` (1080×1920), `instagram/` (9:16 sans visage) : les rendus.
- `planches/` : série 16:9, série à 160 px, couvertures 9:16, grille de profil (3:4 et 1:1), Instagram sans visage.
- Refaire les rendus : `NODE_PATH=<dossier contenant playwright> node rendre.cjs && node planches.cjs` (Chromium déjà installé, aucun appel payant).

Les visages sont des **doublures** en contre-jour : aucune vraie photo de Will n'est dans le dépôt.
