# 76 · Mesure d'occupation des maquettes v3 (16/10/2026)

**À quoi il sert.** Prouver, image par image, que la moitié basse des écrans 9:16 n'est plus vide (standard 74, § 2 bis). Le chef de projet a regardé les planches v2 et constaté le contraire de ce que disait l'ancienne mesure. Ce document donne la nouvelle mesure, ses seuils et le résultat sur **chaque image montrée** dans les planches v3.

## Pourquoi une nouvelle mesure
L'ancienne mesure, `prototypes/remplissage.py` (v2), comptait une rangée de pixels comme « occupée » dès qu'elle contenait un **bord** sur 1,5 % de la largeur. Un filet fin, le contour pointillé d'une carte fantôme ou une ligne d'horizon suffisaient. Des écrans à moitié vides à l'œil passaient donc à 90 %.

La nouvelle mesure, `prototypes/occupation.py`, mesure la **masse visible**, comme l'œil sur une vignette :
1. **Fond retiré.** En 9:16, on retire le vrai fond vide de la charte, rendu par le moteur dans `prototypes/fonds-vides/` (nuit, ivoire, panneau orange). Si l'image ne ressemble à aucun (fond papier, écran coupé en deux aplats), et en 4:5, un polynôme lisse ajusté sur l'image remplace le fond.
2. **Contenu.** Un pixel est du contenu s'il s'écarte du fond. Sur fond nuit, il doit aussi être clair : la lueur orangée et les fantômes atténués ne comptent pas.
3. **Blocs.** Une fermeture de 16 px transforme une ligne de texte en bloc. Une carte cerclée devient pleine. Un trait fin reste fin.
4. **Rangée occupée.** Une rangée compte si le contenu couvre **au moins 20 % de la largeur** (≥ 200 px). Un petit objet isolé ne suffit pas.

**Hauteur utile.** En 9:16 : y 230 → 1536, sans la bande des sous-titres (1152 → 1286). En 4:5 : y 54 → 1215, sans la bande 1042 → 1176. Sous y = 1536, en 9:16, l'interface des réseaux recouvre l'écran : on n'y met que du fond (§ 3).

## Seuils (tous obligatoires)
| Critère | Seuil | Ce qu'il empêche |
|---|---|---|
| Occupation | ≥ 60 % des rangées utiles | un écran clairsemé |
| Plus grand trou | ≤ 15 % de la hauteur utile | une grande bande vide |
| Équilibre | ≥ 0,5 | le contenu entassé en haut (densité de la moitié basse y 883 → 1536 / densité de la moitié haute) |
| Zone d'appoint (9:16) | ≥ 50 % des rangées y 1300 → 1536 pleines | des fantômes ou des filets sous les sous-titres |

Commande : `python3 -I prototypes/occupation.py <dossier-rendus> [noms…] [--masques <dossier>]`. L'option `--masques` enregistre l'image du masque, pour vérifier à l'œil ce qui a été compté.

**Limite connue.** Un écran coupé en deux aplats (OUV-B, CAM-E, TRA-C) compte l'aplat comme contenu, d'où les 100 %. Ces écrans ont aussi été vérifiés à l'œil.

## Résultat : chaque image montrée dans les planches v3
Colonne « v2 » : la même image v2, passée à la **nouvelle** mesure (occupation · appoint · verdict). Les images v3 ont toutes été rendues puis regardées une à une.

| Image | v2 (nouvelle mesure) | Occupation v3 | Trou max | Équilibre | Appoint | Verdict v3 |
|---|---|---|---|---|---|---|
| OUV-A-1 | 71 % · 88 % · OK | **71 %** | 10 % | 0,77 | 88 % | **OK** |
| OUV-A-2 | 56 % · 12 % · NON | **72 %** | 11 % | 1,18 | 90 % | **OK** |
| OUV-B-1 | 67 % · 0 % · NON | **100 %** | 0 % | 0,94 | 98 % | **OK** |
| OUV-B-2 | 100 % · 100 % · OK | **100 %** | 0 % | 1,06 | 100 % | **OK** |
| OUV-C-1 | 79 % · 81 % · OK | **81 %** | 5 % | 0,84 | 92 % | **OK** |
| OUV-C-2 | 33 % · 0 % · NON | **86 %** | 6 % | 0,94 | 75 % | **OK** |
| OUV-D-1 | 60 % · 3 % · NON | **77 %** | 10 % | 1,11 | 90 % | **OK** |
| OUV-D-2 | 62 % · 83 % · OK | **63 %** | 11 % | 1,37 | 88 % | **OK** |
| OUV-E-1 | 88 % · 85 % · OK | **88 %** | 5 % | 1,08 | 88 % | **OK** |
| OUV-E-2 | 78 % · 44 % · NON | **85 %** | 6 % | 1,44 | 78 % | **OK** |
| REC-B-1 | 51 % · 0 % · NON | **75 %** | 7 % | 1,60 | 86 % | **OK** |
| REC-B-2 | 80 % · 51 % · OK | **88 %** | 5 % | 1,28 | 92 % | **OK** |
| REC-C-1 | 57 % · 20 % · NON | **71 %** | 13 % | 1,08 | 92 % | **OK** |
| REC-C-2 | 71 % · 29 % · NON | **84 %** | 7 % | 1,49 | 95 % | **OK** |
| REC-D-1 | 35 % · 0 % · NON | **67 %** | 11 % | 1,39 | 90 % | **OK** |
| REC-D-2 | 38 % · 0 % · NON | **69 %** | 11 % | 1,72 | 95 % | **OK** |
| CHI-B-1 | 78 % · 69 % · NON | **85 %** | 4 % | 0,67 | 88 % | **OK** |
| CHI-B-2 | 71 % · 39 % · NON | **80 %** | 6 % | 0,59 | 85 % | **OK** |
| CHI-C-1 | 69 % · 73 % · OK | **78 %** | 9 % | 1,22 | 92 % | **OK** |
| CHI-C-2 | 68 % · 56 % · OK | **73 %** | 9 % | 1,13 | 81 % | **OK** |
| CHI-D-1 | 68 % · 2 % · NON | **85 %** | 6 % | 0,82 | 86 % | **OK** |
| CHI-E-2 | 53 % · 3 % · NON | **77 %** | 7 % | 0,99 | 92 % | **OK** |
| CAM-B-1 | 17 % · 0 % · NON | **74 %** | 10 % | 1,72 | 92 % | **OK** |
| CAM-B-2 | 24 % · 0 % · NON | **76 %** | 9 % | 1,57 | 81 % | **OK** |
| CAM-C-1 | 69 % · 56 % · OK | **78 %** | 12 % | 1,50 | 93 % | **OK** |
| CAM-C-2 | 88 % · 64 % · OK | **88 %** | 5 % | 1,02 | 64 % | **OK** |
| CAM-E-1 | 92 % · 98 % · OK | **92 %** | 5 % | 1,03 | 98 % | **OK** |
| CAM-E-2 | 92 % · 98 % · OK | **92 %** | 5 % | 1,03 | 98 % | **OK** |
| APP-B-2 | 31 % · 3 % · NON | **83 %** | 6 % | 1,02 | 83 % | **OK** |
| APP-C-2 | 76 % · 46 % · NON | **86 %** | 6 % | 0,86 | 71 % | **OK** |
| APP-D-1 | 77 % · 58 % · OK | **83 %** | 4 % | 1,07 | 85 % | **OK** |
| TRA-B-1 | 74 % · 34 % · NON | **85 %** | 11 % | 1,18 | 85 % | **OK** |
| TRA-B-2 | 84 % · 34 % · NON | **94 %** | 3 % | 0,86 | 85 % | **OK** |
| TRA-C-1 | 83 % · 61 % · NON | **89 %** | 4 % | 0,85 | 81 % | **OK** |
| TRA-D-1 | 85 % · 61 % · OK | **90 %** | 5 % | 0,93 | 85 % | **OK** |
| TYP-B-2 | 51 % · 5 % · NON | **70 %** | 13 % | 1,38 | 93 % | **OK** |
| TYP-C-2 | 74 % · 56 % · OK | **78 %** | 8 % | 1,67 | 78 % | **OK** |
| TYP-D-1 | 21 % · 0 % · NON | **73 %** | 14 % | 1,49 | 97 % | **OK** |
| TYP-D-2 | 55 % · 0 % · NON | **73 %** | 10 % | 2,13 | 90 % | **OK** |
| FIN-C-1 | 78 % · 81 % · OK | **80 %** | 11 % | 0,91 | 92 % | **OK** |
| FIN-C-3 | — | planche large (non mesurée), vérifiée à l’œil | | | | |
| FIN-D-2 | 65 % · 64 % · OK | **68 %** | 6 % | 2,21 | 80 % | **OK** |
| MAT-B-1 | 72 % · 88 % · OK | **74 %** | 11 % | 1,09 | 97 % | **OK** |
| MAT-C-1 | 78 % · 95 % · OK | **81 %** | 10 % | 1,28 | 100 % | **OK** |
| MAT-D-1 | 82 % · 100 % · OK | **82 %** | 11 % | 1,42 | 100 % | **OK** |
| SOU-C-1 | 72 % · 86 % · OK | **74 %** | 11 % | 1,10 | 95 % | **OK** |
| R45-OUV-A-1 | 67 % · — · OK | **67 %** | 7 % | 0,97 | — | **OK** |
| R45-CAM-C-1 | 57 % · — · NON | **69 %** | 8 % | 1,36 | — | **OK** |
| R45-CHI-B-1 | 78 % · — · OK | **78 %** | 8 % | 0,88 | — | **OK** |
| R45-CHI-D-1 | 78 % · — · OK | **78 %** | 10 % | 0,93 | — | **OK** |
| R45-FIN-D-1 | 86 % · — · OK | **88 %** | 5 % | 1,07 | — | **OK** |

**Bilan.** Les 50 images mesurées passent toutes les seuils (OK), et la planche large FIN-C-3 a été vérifiée à l'œil. Avec la nouvelle mesure, 25 de ces images échouaient en v2.

## Ce qui n'est pas mesuré
- **Les références « aujourd'hui »** (REC-A, CHI-A, CAM-A, APP-A, TYP-A, FIN-A, MAT-A, SOU-B) sont des images du moteur actuel, non retouchées. Leur bas est vide : c'est le niveau d'aujourd'hui, celui que la variété doit dépasser. Elles ne sont plus dans les planches d'axe. Elles sont regroupées sur `planche/planche-0-aujourdhui.jpg`, pour comparer.
- TYP-A-1 est maintenant rendue à l'image 356 au lieu de 330, avec « MÊME À » net.
- **Les variantes retirées** (CAM-D, TRA-E, FIN-B, SOU-A) et les images non montrées ne sont pas mesurées.
