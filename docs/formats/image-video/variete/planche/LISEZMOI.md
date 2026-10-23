# Planches de maquettes · variété Image → vidéo, v3 (à valider par Will)

**Ce que c'est.** Des images fixes de vidéos qui **n'existent pas encore**. Elles montrent, sur l'image du chatbot (vrais chiffres : 23h14, 80 % / 20 %, 4 s, 2h, 24h/24), les différentes façons de faire une même vidéo. Rien n'est branché dans le studio : on attend ton avis avant d'écrire le moindre code.

## Ce qui a changé en v3
Le chef de projet a regardé la v2 image par image : en 9:16, la moitié basse restait vide, et l'ancienne mesure ne le voyait pas. Tout a été repris :
- **La moitié basse est pleine.** Le contenu est plus grand et descend jusqu'aux sous-titres. Sous les sous-titres, il y a de vrais objets pleins (cartes, téléphone, bulles, jauge), et plus de fantômes en pointillés. Une **nouvelle mesure**, plus sévère, contrôle chaque image : elles passent toutes. Le tableau est dans `../76-mesure-occupation.md`.
- **OUV-B** a maintenant 2 images : plus de case vide dans la planche ouverture.
- **TRA-B** : le rectangle blanc derrière « RÉSOLU. » a disparu. **TRA-D** : plus rien ne dépasse de la carte.
- **FIN-D** : le « 80 % » est lisible, en ivoire plein. La jauge a 8 cases pleines et 2 vides, en 9:16 comme en 4:5.
- **TYP-A** : le « À » de « MÊME À » est net.
- **Les colonnes « aujourd'hui »** sont sorties des planches d'axe et regroupées dans `planche-0-aujourdhui.jpg`, pour comparer.
- Les planches v2 sont gardées dans `v2-archive/`.

## Ce qui avait changé en v2
Le chef de projet a relu la v1 avant toi : bonne variété, mais pas au niveau « parfait ». Tout a été repris :
- **Les écrans verticaux sont remplis sur toute la hauteur.** Avant, tout était en haut et le bas restait vide. Maintenant le contenu descend jusqu'aux sous-titres. Sous les sous-titres, des objets prolongent l'écran : suite du schéma, téléphone, bulles. Une mesure vérifie chaque image.
- **Les sous-titres sont à leur vraie place** (un peu sous le milieu de l'écran) et ne répètent plus le titre.
- **Corrigés aussi** : la fin « le chiffre reste » (le 80 % n'est plus derrière la phrase), la cloche de TYP-D, la carte coupée de CAM-B, les bords de TRA-D et APP-C, les accents qui touchaient la ligne du dessus.
- **Le bas de l'écran reste libre** sur environ 20 % de la hauteur : c'est là que TikTok, Instagram et Facebook posent leurs boutons et leur texte.

## Comment lire
- **`planche-0-aujourdhui.jpg`** : ce que le studio fait déjà, une image par axe, pour comparer. Ce n'est pas à juger.
- **Une planche par axe** (`planche-1-ouverture.jpg` … `planche-10-sous-titres.jpg`). Chaque colonne est une façon de faire, avec son **code** en orange (ex. OUV-C) et son nom dessous. Quand il y a 2 images, celle du haut vient avant celle du bas.
- **`planche-4x5-linkedin-facebook.jpg`** : en haut le format vertical (TikTok, Reels, Shorts), en bas le même écran en 4:5 pour LinkedIn et le fil Facebook. Le détail par réseau est dans `../73-ADAPTATION-PAR-RESEAU.md`.
- **`planche-tirage-3-videos.jpg`** : 3 vidéos possibles, aux mêmes moments (ouverture, récit, schéma, chiffre, transition, fin). Chaque rangée est une vidéo. Le but est de montrer qu'elles ne se ressemblent pas.
- Le pourquoi de chaque choix est dans `75-CRITIQUE-MAQUETTES.md`. La règle de qualité suivie est dans `../74-STANDARD-QUALITE.md`.

## Ce qui a été retiré avant de te les montrer
4 variantes n'étaient pas au niveau : **CAM-D** (plan fixe, trop chargé et trop proche d'APP-C), **TRA-E** (la poussée ne se voyait pas), **FIN-B** (trop proche de FIN-D), **SOU-A** (impossible à distinguer d'aujourd'hui).

En v2, quelques images ne sont plus montrées, mais leur variante reste : **TYP-C-1** (le bas était rempli pour rien), **FIN-D-1** (trop proche d'OUV-A-1), **FIN-C-2** (c'est la même image que OUV-C-1, la boucle se voit dans FIN-C-3).

Les images « aujourd'hui » n'ont pas été retouchées : elles montrent le niveau actuel du studio. Seule TYP-A est prise un peu plus tard (image 356 au lieu de 330), pour que le mot soit net.

## Ta réponse : garder, refaire ou retirer ?
Réponds simplement, par exemple « OUV-B : refaire, trop sombre ».

| Axe | Codes à juger |
|---|---|
| 1 · Ouverture | OUV-A · OUV-B · OUV-C · OUV-D · OUV-E |
| 2 · Récit | REC-B · REC-C · REC-D |
| 3 · Chiffres | CHI-B · CHI-C · CHI-D · CHI-E |
| 4 · Caméra | CAM-B · CAM-C · CAM-E |
| 5 · Écrans de texte | TYP-B · TYP-C · TYP-D |
| 6 · Apparition | APP-B · APP-C · APP-D |
| 7 · Transitions | TRA-B · TRA-C · TRA-D |
| 8 · Fin | FIN-C · FIN-D |
| 9 · Matière | MAT-B · MAT-C · MAT-D |
| 10 · Sous-titres | SOU-C |
| 4:5 | Garder le 4:5 pour LinkedIn et le fil Facebook : oui / non |

Trois questions en plus :
1. L'ouverture peut-elle changer d'un réseau à l'autre pour une même image ? (oui / non)
2. Facebook : deux versions (Reel vertical et fil en 4:5), ou une seule ?
3. Faut-il une version plus courte, d'environ 30 s, pour TikTok, Reels et Facebook ?

---
*Pour refaire les planches* : les prototypes sont dans `../prototypes/` (rendu : `rendre.mts`, assemblage : `planches.py` avec `verdict-critique.json`, qui refait aussi la planche du tirage ; mesure d'occupation : `occupation.py`, avec les fonds vides de `fonds-vides/` ; l'ancienne `remplissage.py` est gardée pour l'historique).
