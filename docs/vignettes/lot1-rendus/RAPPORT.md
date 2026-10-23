# Lot 1 des vignettes · rendus réels de contrôle

*Produit par `studio-rendu/scripts/essai-vignettes.ts` (vrai Remotion, aucun réseau extérieur, aucun appel payant).*

| Fichier | Cas | Taille | Poids | Temps de rendu | Titre |
|---|---|---|---|---|---|
| 1-16x9-encre-m1-repli.jpg | 16:9 · encre · m1 · repli sans détourage (image de la vidéo) | 1280×720 | 95 ko | 7.7 s | OÙ FUIT VOTRE TEMPS |
| 2-9x16-ivoire-m2-sujet.jpg | 9:16 · ivoire · m2 · sujet détouré | 1080×1920 | 176 ko | 6.1 s | UN DEVIS EN 2 MINUTES |
| 3-9x16-encre-instagram.jpg | 9:16 · encre · Instagram (sans visage, sans image) | 1080×1920 | 96 ko | 2.1 s | OÙ FUIT VOTRE TEMPS |

- Mémoire maximale du processus Node (hors navigateur) : 852 Mo (`process.resourceUsage().maxRSS` ; `/usr/bin/time -v` absent de la session).
- Planche à 160 px de large : `planche-160.png`.
- Contrôle des mots interdits : chaque titre passe par `interditsVignette` avant le rendu (le script échoue sinon).

## Contrôle visuel (images regardées une à une, 17/10)

- [x] Liseré orange et carré « A » à la même place sur les 3 ; bloc-marque « axion-ia.com » sur les 2 verticales.
- [x] Titre sur 2 lignes, un seul pavé orange (« TEMPS », « 2 MINUTES »), lisible à 160 px de large (`planche-160.png`).
- [x] 16:9 : coin bas droit 140×60 vide ; 9:16 : titre entre y 420 et y 1500, à gauche de x 940.
- [x] Instagram : aucune personne, aucune image de la vidéo.
- [x] Aucun « Villeexemple », « Aucun gain garanti », « Certifexemple certifié », « faites-le vous-même ».
- [x] Aucun logo, aucun nom de client dans les images.
- [x] Poids ≤ 2 Mo chacun.
- Rendu 1 (repli sans détourage) : l'image de la vidéo d'essai à 0,32 s montre un buste et des lunettes, visage hors cadre
  (recadrage centré). Moins beau que les maquettes détourées : repli assumé (rendu 2 = avec sujet détouré).
