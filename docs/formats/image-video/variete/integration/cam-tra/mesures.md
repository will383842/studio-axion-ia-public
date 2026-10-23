# Mesures · lot CAM-TRA (caméra) · carte C

Seuils (doc 74 § 2 bis, doc 76) : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint ≥ 50 % (9:16). Images aux instants choisis par `instants.mts` (le banc commun ne prend que début, milieu et fin de bloc).

## CAM-B

Planche : `CAM-B.jpg` · instants : CAM-B-1 = 11.6 s, CAM-B-2 = 13.15 s

```
image          occupation  trou max  équilibre  appoint  verdict
CAM-B-1               58 %       16 %       1.71     86 %  NON
CAM-B-2               44 %       18 %       0.55      8 %  NON
```

## CAM-C

Planche : `CAM-C.jpg` · instants : CAM-C-1 = 17.9 s, CAM-C-2 = 22.5 s

```
image          occupation  trou max  équilibre  appoint  verdict
CAM-C-1               70 %       16 %       0.94     81 %  NON
CAM-C-2               66 %       15 %       1.54     81 %  OK
```

## CAM-E

Planche : `CAM-E.jpg` · instants : CAM-E-1 = 19.6 s, CAM-E-2 = 29.2 s

```
image          occupation  trou max  équilibre  appoint  verdict
CAM-E-1               92 %        5 %       1.03     98 %  OK
CAM-E-2               92 %        5 %       1.03     98 %  OK
```

## R45-CAM-C

Planche : `R45-CAM-C.jpg` · instants : R45-CAM-C-1 = 17.9 s

```
image          occupation  trou max  équilibre  appoint  verdict
R45-CAM-C-1           70 %       16 %       0.94     81 %  NON
```

## Référence CAM-A aux mêmes instants (pour comparer)

```
image          occupation  trou max  équilibre  appoint  verdict
CAM-A-a (13.15 s)     46 %       29 %       0.63      0 %  NON
CAM-A-b (17.9 s)      57 %       22 %       0.86      0 %  NON
CAM-A-c (22.5 s)      48 %       24 %       1.04      0 %  NON
```

**Lecture.** La toile de référence ne passe pas les seuils (zone d'appoint vide, masque sous les sous-titres) ; CAM-B et
CAM-C font mieux qu'elle à chaque instant mesuré mais restent juste sous les seuils (trou 16 %, occupation 58 %) ;
CAM-E passe. CAM-B-2 est la toile de référence après la plongée (même défaut que CAM-A). R45-CAM-C : la toile reste
rendue en 1080 × 1920 en 4:5 tant que le lot F45 n'a pas posé le cadre bas (écart connu du socle) ; l'image est donc
celle du 9:16.

# Transitions (TRA-B, TRA-C, TRA-D) · carte C · jointure b05 (toile) → b06 (e-mail)

Images : `<CODE>-1` = milieu de la sortie (29,305 s), `jointureA` = dernière image du bloc A, `jointureB` = première image du bloc B, `<CODE>-2` = milieu de l'entrée (29,705 s). Planches : `<CODE>.jpg` (maquette | moteur) et `<CODE>-jointure.jpg` (les quatre images dans l'ordre).

**Vérifié à l'œil** (images à aplat, que `occupation.py` ne compte pas comme contenu) : les deux images de part et d'autre de chaque jointure sont identiques (plein orange, vert ou blanc sous la marque, qui reste visible) ; la jointure ne se voit donc pas une fois les MP4 mis bout à bout. Les seuils d'occupation ne s'appliquent pas à ces images de 0,4 s.

## TRA-B

```
image          occupation  trou max  équilibre  appoint  verdict
TRA-B-1               68 %       32 %       0.25      0 %  NON
TRA-B-2               14 %       81 %       0.00      0 %  NON
TRA-B-jointureA        18 %       82 %       0.00      0 %  NON
TRA-B-jointureB        18 %       82 %       0.04      0 %  NON
```

## TRA-C

```
image          occupation  trou max  équilibre  appoint  verdict
TRA-C-1               68 %       32 %       0.13      0 %  NON
TRA-C-2               20 %       74 %       0.66     34 %  NON
TRA-C-jointureA         0 %      100 %       0.00      0 %  NON
TRA-C-jointureB         0 %      100 %       0.00      0 %  NON
```

## TRA-D

```
image          occupation  trou max  équilibre  appoint  verdict
TRA-D-1               77 %       20 %       0.60      2 %  NON
TRA-D-2               13 %       81 %       0.00      0 %  NON
TRA-D-jointureA         0 %      100 %       0.00      0 %  NON
TRA-D-jointureB         0 %      100 %       0.00      0 %  NON
```

Jointures retenues sur la carte C (version TikTok) : TRA-B et TRA-D → b05 → b06 ; TRA-C → b05 → b06 et b07 → b08 (b08 → b09 écartée : la toile finit sur une vue d'ensemble).
