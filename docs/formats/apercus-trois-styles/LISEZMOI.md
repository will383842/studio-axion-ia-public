# Trois styles du tableau — aperçus du MOTEUR (16/10/2026, refaits après la critique #291)

Images rendues par le moteur (Remotion, Chromium sans affichage : `TableauScene` → `PageTableau`, mise en page
`mise-en-page-tableau.ts`, animation `animation-3.ts`), sous-titres « Pastille Axion » compris. Rien n'est redessiné à
la main : ce ne sont pas les maquettes (PR #280), c'est ce que la fabrication produit.

Refaire : `npx tsx tests/tableau/trois-styles/apercus.mts --film --tiktok` (≈ 12 min par style pour le film) (après `npm ci` dans `studio-rendu` ;
Python 3 avec Pillow et NumPy). Aucun appel payant : minutage réaliste, aucune voix.

| Fichier | Contenu |
|---|---|
| `planche-maquettes-vertical.jpg`, `planche-maquettes-portrait.jpg` | la fiche des maquettes (même texte que `maquettes/tableau-v2/`), 5 écrans × 3 styles, en 9:16 et en 4:5 |
| `planche-v667-vertical.jpg`, `planche-v667-portrait.jpg` | le témoin de la vidéo d'essai v-667edcd8e3a8 (après correction des 4 défauts), 5 écrans × 3 styles |
| `<fiche>-<style>-<format>-<n>-<écran>.jpg` | chaque écran en pleine taille (accroche, étape, exemple, à retenir, appel), la page finie juste avant la suivante (outil sorti) |
| `film-v667-<style>.mp4` | la vidéo COMPLÈTE du témoin v667 (9 pages : accroche, douleur, étapes, exemple, à retenir, appel), 1080 × 1920, 25 i/s, sous-titres compris (sans voix) |
| `film-v667-<style>-p<n>-<partie>.jpg` | une planche par page du film : 12 images régulières sur la durée de la page (`fps=12/<durée>,scale=270:-1,tile=6x2`) ; les 9 planches couvrent tout le film |
| `fin-tiktok-v667-<style>.jpg` | la fin TikTok et Shorts du témoin : une seule demande (« Enregistrez pour la retrouver »), aucun bouton « Réservez » |
| `mesures.json` | temps de rendu par image (Remotion `renderMedia`, une page du navigateur) |
| `controle-couleurs.json` | pixels verts, bleus ou violets : sur les écrans (PNG sans perte, 0 attendu) et sur le film (2 images/s extraites du MP4 compressé : les rares pixels comptés viennent du sous-échantillonnage des couleurs du H.264 au bord des lettres orange) |

Style par série (modifiable : `STYLE_PAR_SERIE`, ou `styleTableau` dans la fiche) : Formation → ardoise,
Automatisations → tableau blanc, Audit, Coaching et toute autre série → paperboard.
