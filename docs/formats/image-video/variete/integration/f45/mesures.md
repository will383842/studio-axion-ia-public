# Lot F45 · mesures (carte C, 16/10/2026)

Images rendues par `rendre-f45.mts` (vrai moteur, vrai paquet `studio-rendu`, `renderStill`, sous-titres variés du
montage superposés) aux instants du critère du lot final (0,5 s, 1,5 s, 3 s puis toutes les 3 s), version LinkedIn en
4:5 (1080 × 1350) et version TikTok en 9:16 (référence). **Sans recette** : les axes de variété sont encore des bouchons,
ce sont donc les images de référence « aujourd'hui », remises en page.

**Rendues AVEC le correctif hors lot** (`correctif-hors-lot.patch` : `mise-en-scene.ts`, `sous-titres-varies.ts`,
`Compositions.tsx`), appliqué en local puis retiré : sans lui, les moments et objets restent dessinés à leur place du
9:16 (contenu jusqu'à y 1114, sur la bande 4:5 y 1042 → 1176) et Q22 refuse la version 4:5.

Planches : `planche-C-9x16-4x5-1.jpg` (0,5 → 18 s), `planche-C-9x16-4x5-2.jpg` (21 → 51 s). Chaque image 4:5 a été
regardée en taille réelle.

## Occupation (`prototypes/occupation.py`, seuils du doc 76 : ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5)

| Image 4:5 | Bloc | Occupation | Trou max | Équilibre | Appoint | Verdict |
|---|---|---|---|---|---|---|
| 4x5-00.5 | ecran | 11 % | 49 % | 0.00 | — | NON |
| 4x5-01.5 | ecran | 21 % | 40 % | 1.61 | — | NON |
| 4x5-03.0 | ecran | 14 % | 50 % | 0.00 | — | NON |
| 4x5-06.0 | ecran | 25 % | 35 % | 1.61 | — | NON |
| 4x5-09.0 | ecran | 21 % | 35 % | 0.62 | — | NON |
| 4x5-12.0 | toile | 11 % | 74 % | 0.00 | — | NON |
| 4x5-15.0 | toile | 52 % | 21 % | 0.94 | — | NON |
| 4x5-18.0 | toile | 64 % | 15 % | 1.98 | — | OK |
| 4x5-21.0 | toile | 82 % | 15 % | 1.32 | — | OK |
| 4x5-24.0 | toile | 54 % | 15 % | 1.05 | — | NON |
| 4x5-27.0 | toile | 78 % | 15 % | 1.68 | — | OK |
| 4x5-30.0 | moments | 79 % | 8 % | 1.71 | — | OK |
| 4x5-33.0 | moments | 75 % | 14 % | 1.82 | — | OK |
| 4x5-36.0 | moments | 89 % | 4 % | 1.39 | — | OK |
| 4x5-39.0 | toile | 14 % | 69 % | 0.00 | — | NON |
| 4x5-42.0 | toile | 99 % | 1 % | 1.10 | — | OK |
| 4x5-45.0 | moments | 23 % | 34 % | 0.60 | — | NON |
| 4x5-48.0 | moments | 12 % | 48 % | 0.00 | — | NON |
| 4x5-51.0 | moments | 67 % | 29 % | 2.09 | — | NON |

**Bilan 4:5 : 8 images sur 19 passent les trois seuils ; en 9:16, sur la même vidéo, 0 sur 22** (détail ci-dessous). Les
échecs 4:5 sont les écrans v4 empruntés (ouverture, 0,5 → 9 s) et les écrans presque vides de la référence (12 s, 39 s,
45 s, 48 s : un titre seul, une frappe) : c'est le « niveau d'aujourd'hui » du doc 76, que les variantes des lots 1 à 6
doivent dépasser. Au même instant, les toiles et les moments sont nettement plus occupés en 4:5 qu'en 9:16 (par ex.
21 s : 82 % contre 64 % ; 36 s : 89 % contre 67 %, trou 4 % contre 21 %) ; les écrans v4 empruntés un peu moins (11 à
25 % contre 15 à 27 %), car la brique des écrans réduit leurs lettres à l'échelle du cadre.

## Ce qui a été vérifié à l'œil (4:5)
- Marque à y 54 → 80, à la taille du cadre (comme les écrans v4 en 4:5) ; repère « 1/3 » à y 94, sous la marque.
- En-tête remonté (étiquette y 199, titre jusqu'à 410) : même place sur toile et sur moments, pas de saut d'une scène à
  l'autre.
- Toile : nœud parlé et pastilles « 80 % / 20 % » entiers dans la zone utile (18 s), rien sous les sous-titres.
- Moments (e-mail, cartes, phrase-choc) : y 449 → 1054 au plus, la ligne de sous-titres (≈ y 1080 → 1140) ne touche
  aucun contenu ; rien sous y 1188.
- Écrans v4 empruntés : rendus en 1080 × 1350 par la brique des écrans (lettres à l'échelle du cadre, 0,70 × le 9:16 ;
  « 23:14 » ≈ 140 px, titres ≈ 100 px), zone y 120 → 1015.

## Défauts restants vus sur les images
- Écrans v4 empruntés : leur marque est à y ≈ 137 (brique des écrans), celle des scènes IV à y 54 : la marque saute
  entre un écran v4 et une scène IV (même écart qu'en 9:16 : y ≈ 164 contre 86).
- Phrase-choc (51 s) : 25 px seulement entre la dernière ligne et les sous-titres.
- Marque et repère : 14 px d'écart (32 px en 9:16).

## 9:16 (référence, inchangé par le lot)
```
image          occupation  trou max  équilibre  appoint  verdict
9x16-00.5             18 %       43 %       0.08      0 %  NON
9x16-01.5             27 %       34 %       1.69      0 %  NON
9x16-03.0             15 %       49 %       0.00      0 %  NON
9x16-06.0             22 %       35 %       4.63      0 %  NON
9x16-09.0             20 %       36 %       1.38      0 %  NON
9x16-12.0             10 %       87 %       0.00      0 %  NON
9x16-15.0             48 %       32 %       0.40      0 %  NON
9x16-18.0             57 %       22 %       0.86      0 %  NON
9x16-21.0             64 %       26 %       0.44      0 %  NON
9x16-24.0             49 %       30 %       0.48      0 %  NON
9x16-27.0             63 %       26 %       0.48      0 %  NON
9x16-30.0             67 %       21 %       0.70      0 %  NON
9x16-33.0             64 %       21 %       0.74      0 %  NON
9x16-36.0             67 %       21 %       0.70      0 %  NON
9x16-39.0             12 %       83 %       0.00      0 %  NON
9x16-42.0             65 %       23 %       0.70      0 %  NON
9x16-45.0             20 %       52 %       0.00      0 %  NON
9x16-48.0             11 %       64 %       0.00      0 %  NON
9x16-51.0             42 %       26 %       0.61      0 %  NON
9x16-54.0              7 %       43 %       0.24      0 %  NON
9x16-57.0              9 %       56 %       0.00      0 %  NON
9x16-60.0              5 %       60 %       0.00      0 %  NON
```
