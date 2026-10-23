# Lot APP-MAT · mesures (carte C, 9:16, version TikTok)

Lot 6 du plan `80-PLAN-INTEGRATION.md` : APP-B (tracé au feutre), APP-C (fantôme qui s'allume), APP-D (cartes qui
tombent) ; MAT-B (papier), MAT-C (trait fait main), MAT-D (profondeur douce). APP-A et MAT-A = référence, inchangée.

## Fichiers de ce dossier

| Fichier | Contenu |
|---|---|
| `APP-B.jpg` … `MAT-D.jpg` | Planche `cote-a-cote.py` : maquette (`prototypes/rendre.mts`) \| moteur (`images-fixes.mts --code <CODE>`), 3 premières images du moteur |
| `APP-B-feutre.jpg` | Maquette APP-B-2 \| moteur à 13,0 s, 14,05 s, 14,2 s : le feutre en plein tracé (les instants du banc tombent avant ou après le tracé, qui dure 0,42 s) |
| `MAT-A-B-vignettes-200.jpg` | Vignettes de 200 px : MAT-A \| MAT-B sur une toile (20,2 s), puis MAT-A \| MAT-B sur un moment (30,0 s) |

## Commandes

```
studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/prototypes/rendre.mts docs/formats/image-video/variete/prototypes/d3-camera-schema-transitions/entree.tsx <maq> APP-
studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/prototypes/rendre.mts docs/formats/image-video/variete/prototypes/d1-ouvertures-fins/entree.tsx <maq> MAT-
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/images-fixes.mts --code <CODE> --format 9:16 --sortie <banc>/<CODE>
python3 -I scripts/image-video/variete/cote-a-cote.py <banc>/<CODE> --maquettes <maq> --sortie <planches>/<CODE>
```

En 4:5 : aucune image. `recettePourVersion` garde APP-* et MAT-* en 4:5, mais le socle rend encore les toiles en
1080 × 1920 quel que soit le format (seuls les écrans `ImageVideoVariete` passent au cadre bas, PR #292). Le rendu 4:5
de la toile relève du lot F45.

## Temps de rendu par image fixe (plafond : +30 %)

Mêmes instants que le banc (18 pour la matière : toiles et moments ; 6 pour l'apparition : toiles), une image de
chauffe écartée, même paquet, navigateur `headless_shell` + `swangle`. Référence mesurée deux fois (27,08 s et
26,98 s pour 18 images).

| Code | ms / image | Écart moyen | Pire image |
|---|---|---|---|
| MAT-A (réf.) | 1 499 | — | — |
| MAT-B | 1 893 | **+26 %** (+23 % au second passage) | +40 % |
| MAT-C | 1 590 | **+6 %** | +21 % |
| MAT-D | 1 691 | **+13 %** | +45 % |
| APP-A (réf.) | 1 936 | — | — |
| APP-B | 1 878 | **−3 %** | +14 % |
| APP-C | 2 102 | **+9 %** | +25 % |
| APP-D | 2 275 | **+18 %** | +42 % |

Le grain de la maquette (`feTurbulence` sur tout le cadre) coûtait **+150 %**, et +100 % en tuiles SVG : il est
remplacé par deux tuiles PNG calculées en JS (`matiere/bruit.ts`, déterministes), que le navigateur se contente de
répéter. Un tremblé de toute la scène pour MAT-C hors toile a été essayé puis retiré : +55 % de temps, et des
pointillés aux bords du cadre.

## Occupation (doc 74 § 2 bis : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint ≥ 50 %)

**Aucune image ne passe les seuils, référence comprise.** La toile est masquée sous la bande des sous-titres
(`masqueToile`, `plan.ts`, et `Compositions.tsx`, hors lot) : la zone d'appoint est toujours vide (0 %). La caméra suit
UNE carte à la fois sous l'en-tête : le trou dépasse toujours 15 %. Le lot ne dégrade rien. APP-C et APP-D relèvent
l'image d'entrée de la toile (10 % → 40 %), grâce au schéma éteint ou à la place de la carte suivante. MAT-B gagne
quelques points parce que le grain du papier compte comme « contenu » : c'est un biais de la mesure, pas un gain réel.

### Référence aux mêmes instants

APP-A (instants de APP-B) :
```
image          occupation  trou max  équilibre  appoint  verdict
APP-A-2               10 %       87 %       0.00      0 %  NON
APP-A-3               43 %       47 %       0.00      0 %  NON
APP-A-4               52 %       32 %       0.28      0 %  NON
APP-A-5               12 %       83 %       0.00      0 %  NON
APP-A-6               48 %       29 %       0.57      0 %  NON
APP-A-7               65 %       23 %       0.70      0 %  NON
```
MAT-A (instants de MAT-B ; numéro = rang + 1, image de chauffe écartée) :
```
image          occupation  trou max  équilibre  appoint  verdict
MAT-A-2               10 %       87 %       0.00      0 %  NON
MAT-A-3               43 %       47 %       0.00      0 %  NON
MAT-A-4               52 %       32 %       0.28      0 %  NON
MAT-A-5               67 %       21 %       0.70      0 %  NON
MAT-A-6               64 %       21 %       0.74      0 %  NON
MAT-A-7               67 %       21 %       0.69      0 %  NON
MAT-A-8               76 %       21 %       0.56      0 %  NON
MAT-A-9               67 %       21 %       0.68      0 %  NON
MAT-A-10              67 %       21 %       0.68      0 %  NON
MAT-A-11              12 %       83 %       0.00      0 %  NON
MAT-A-12              48 %       29 %       0.57      0 %  NON
MAT-A-13              65 %       23 %       0.70      0 %  NON
MAT-A-14              12 %       71 %       0.00      0 %  NON
MAT-A-15              20 %       52 %       0.00      0 %  NON
MAT-A-16              33 %       29 %       0.56      0 %  NON
MAT-A-17              11 %       64 %       0.00      0 %  NON
MAT-A-18              32 %       37 %       0.23      0 %  NON
MAT-A-19              42 %       26 %       0.86      0 %  NON
```

### APP-B
```
image          occupation  trou max  équilibre  appoint  verdict
APP-B-1               12 %       32 %       0.09      0 %  NON
APP-B-2               44 %       23 %       0.07      0 %  NON
APP-B-3               52 %       32 %       0.28      0 %  NON
APP-B-4               13 %       33 %       0.08      0 %  NON
APP-B-5               48 %       29 %       0.57      0 %  NON
APP-B-6               65 %       23 %       0.70      0 %  NON
```

### APP-C
```
image          occupation  trou max  équilibre  appoint  verdict
APP-C-1               40 %       33 %       0.48      0 %  NON
APP-C-2               56 %       24 %       0.41      0 %  NON
APP-C-3               52 %       32 %       0.29      0 %  NON
APP-C-4               43 %       33 %       0.42      0 %  NON
APP-C-5               49 %       29 %       0.54      0 %  NON
APP-C-6               65 %       23 %       0.70      0 %  NON
```

### APP-D
```
image          occupation  trou max  équilibre  appoint  verdict
APP-D-1               41 %       32 %       0.47      0 %  NON
APP-D-2               57 %       24 %       0.41      0 %  NON
APP-D-3               52 %       32 %       0.29      0 %  NON
APP-D-4               42 %       33 %       0.43      0 %  NON
APP-D-5               48 %       28 %       0.59      0 %  NON
APP-D-6               65 %       23 %       0.70      0 %  NON
```

### MAT-B
```
image          occupation  trou max  équilibre  appoint  verdict
MAT-B-1               10 %       87 %       0.06      0 %  NON
MAT-B-2               45 %       47 %       0.07      0 %  NON
MAT-B-3               53 %       32 %       0.31      0 %  NON
MAT-B-4               82 %       18 %       0.66      8 %  NON
MAT-B-5               71 %       16 %       0.70      3 %  NON
MAT-B-6               78 %       22 %       0.61      0 %  NON
MAT-B-7               93 %        5 %       0.77     73 %  OK
MAT-B-8               88 %        6 %       0.77     42 %  NON
MAT-B-9               88 %        6 %       0.77     42 %  NON
MAT-B-10              14 %       83 %       0.05      0 %  NON
MAT-B-11              50 %       29 %       0.57      0 %  NON
MAT-B-12              79 %       16 %       0.62      7 %  NON
MAT-B-13              12 %       71 %       0.00      0 %  NON
MAT-B-14              20 %       52 %       0.00      0 %  NON
MAT-B-15              33 %       29 %       0.56      0 %  NON
MAT-B-16              11 %       64 %       0.00      0 %  NON
MAT-B-17              32 %       37 %       0.23      0 %  NON
MAT-B-18              42 %       26 %       0.86      0 %  NON
```

### MAT-C
```
image          occupation  trou max  équilibre  appoint  verdict
MAT-C-1               10 %       87 %       0.00      0 %  NON
MAT-C-2               43 %       47 %       0.00      0 %  NON
MAT-C-3               50 %       22 %       0.30      0 %  NON
MAT-C-4               67 %       21 %       0.70      0 %  NON
MAT-C-5               64 %       21 %       0.74      0 %  NON
MAT-C-6               67 %       21 %       0.69      0 %  NON
MAT-C-7               76 %       21 %       0.56      0 %  NON
MAT-C-8               67 %       21 %       0.68      0 %  NON
MAT-C-9               67 %       21 %       0.68      0 %  NON
MAT-C-10              12 %       83 %       0.00      0 %  NON
MAT-C-11              45 %       31 %       0.52      0 %  NON
MAT-C-12              65 %       23 %       0.70      0 %  NON
MAT-C-13              12 %       71 %       0.00      0 %  NON
MAT-C-14              20 %       52 %       0.00      0 %  NON
MAT-C-15              33 %       29 %       0.56      0 %  NON
MAT-C-16              11 %       64 %       0.00      0 %  NON
MAT-C-17              32 %       37 %       0.23      0 %  NON
MAT-C-18              42 %       26 %       0.86      0 %  NON
```

### MAT-D
```
image          occupation  trou max  équilibre  appoint  verdict
MAT-D-1               10 %       87 %       0.00      0 %  NON
MAT-D-2               43 %       47 %       0.00      0 %  NON
MAT-D-3               52 %       32 %       0.34      0 %  NON
MAT-D-4               67 %       21 %       0.70      0 %  NON
MAT-D-5               64 %       21 %       0.74      0 %  NON
MAT-D-6               67 %       21 %       0.70      0 %  NON
MAT-D-7               76 %       21 %       0.56      0 %  NON
MAT-D-8               67 %       21 %       0.68      0 %  NON
MAT-D-9               67 %       21 %       0.68      0 %  NON
MAT-D-10              12 %       83 %       0.00      0 %  NON
MAT-D-11              50 %       26 %       0.70      0 %  NON
MAT-D-12              65 %       23 %       0.70      0 %  NON
MAT-D-13              12 %       71 %       0.00      0 %  NON
MAT-D-14              20 %       52 %       0.00      0 %  NON
MAT-D-15              33 %       29 %       0.56      0 %  NON
MAT-D-16              11 %       64 %       0.00      0 %  NON
MAT-D-17              32 %       37 %       0.23      0 %  NON
MAT-D-18              42 %       26 %       0.86      0 %  NON
```

## Contrôle à l'œil (chaque image regardée, maquette à côté)

- **APP-B** : contour tracé au feutre depuis le milieu du bas, puis le blanc qui se pose de gauche à droite, puis le
  texte ; le feutre (encre, capuchon orange) suit la pointe du trait, comme dans la maquette APP-B-2. Avant chaque
  carte, sa place attend en pointillé. Écart : la carte suivante n'est pas posée dans la zone d'appoint (toile
  masquée sous la bande des sous-titres).
- **APP-C** : tout le schéma est là dès le début, en cartes éteintes (beige `#E2D7C9` de la maquette) sans texte ;
  fils pâles ; chaque carte s'allume à son mot ; une carte déjà vue dans une séquence précédente reste « vue ». Écart :
  la caméra zoome sur une carte, donc on voit 2 à 4 cartes éteintes autour d'elle, et non tout le schéma comme dans la
  maquette.
- **APP-D** : la fiche tombe d'en haut (340 px, inclinée de 7°), touche la table, rebondit à peine et se pose de
  travers (±1,2°) ; son ombre est déjà au sol ; la place de la fiche suivante, pleine et éteinte, attend.
- **MAT-B** : grain et nuages d'encre, bord assombri, cartes en ivoire clair à l'ombre plus profonde. Se distingue de
  MAT-A en vignette de 200 px (`MAT-A-B-vignettes-200.jpg`). Le grain passe aussi sur les cartes, qui restent nettes
  dans la maquette : c'est un calque unique, posé au-dessus de la scène.
- **MAT-C** : contours faits main qui dépassent aux coins (encre, ou couleur de la carte si active), ombres en
  hachures, fils tremblés. Sur les objets et moments, rien ne change : leurs composants ne sont pas dans les fichiers
  du lot.
- **MAT-D** : tranche sous chaque carte (orange foncé `#C2532A` sous une carte orange, nuit sinon) ; plateaux en
  relief par colonne du schéma, qui paraissent avec leur première carte ; lumière douce sur toutes les scènes.
- **Charte** : couleurs de `COULEURS_DUO` seulement, plus le beige éteint de la maquette validée. Polices, tailles
  des textes et nombre de mots orange : inchangés (le lot ne touche pas aux textes). Marque visible sur toutes les
  images.
