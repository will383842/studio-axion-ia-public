# Lot 1 · OUV-FIN · mesures (16/10/2026)

Banc commun : `scripts/image-video/variete/images-fixes.mts` (carte C, fiche simulée `essai-c`, voix `pisteSimulee`,
version TikTok en 9:16, LinkedIn en 4:5), puis `cote-a-cote.py --maquettes` (maquettes v3 rendues par
`prototypes/rendre.mts` avec `d1-ouvertures-fins/entree.tsx`). Mesure : `prototypes/occupation.py`.

Commandes (depuis la racine) :
```
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/images-fixes.mts --code OUV-A --format 9:16 --sortie /tmp/ouv/moteur/OUV-A
  (idem OUV-B, OUV-C, OUV-D, OUV-E ; --recette OUV-C,FIN-C ; --recette OUV-A,FIN-D ; --recette OUV-A,FIN-D --format 4:5)
studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/prototypes/rendre.mts docs/formats/image-video/variete/prototypes/d1-ouvertures-fins/entree.tsx /tmp/ouv/maquette
python3 -I scripts/image-video/variete/cote-a-cote.py /tmp/ouv/moteur/<CODE> --maquettes /tmp/ouv/maquette --sortie /tmp/ouv/cac/<CODE>
```

Planches « maquette | moteur » : `OUV-A.jpg` … `OUV-E.jpg`, `FIN-C.jpg`, `FIN-D.jpg`, `R45-OUV-A.jpg`, `R45-FIN-D.jpg`
(en 4:5, les maquettes R45-OUV-A-1 et R45-FIN-D-1). Images du moteur : début du bloc + 0,5 s, 1,5 s, milieu,
fin − 0,3 s (l'ouverture de la carte C dure 2,595 s : la 1re image est avant la bascule, les autres après).

| Format | Image | Occupation | Trou max | Équilibre | Appoint | Verdict |
|---|---|---|---|---|---|---|
| 9:16 | OUV-A-1 | 67 % | 11 % | 0.78 | 76 % | **OK** |
| 9:16 | OUV-A-2 | 72 % | 11 % | 1.20 | 90 % | **OK** |
| 9:16 | OUV-A-3 | 72 % | 11 % | 1.20 | 90 % | **OK** |
| 9:16 | OUV-A-4 | 72 % | 11 % | 1.20 | 90 % | **OK** |
| 9:16 | OUV-B-1 | 100 % | 0 % | 1.05 | 100 % | **OK** |
| 9:16 | OUV-B-2 | 100 % | 0 % | 1.11 | 100 % | **OK** |
| 9:16 | OUV-B-3 | 100 % | 0 % | 1.11 | 100 % | **OK** |
| 9:16 | OUV-B-4 | 100 % | 0 % | 1.11 | 100 % | **OK** |
| 9:16 | OUV-C-1 | 81 % | 5 % | 0.86 | 92 % | **OK** |
| 9:16 | OUV-C-2 | 86 % | 6 % | 0.96 | 75 % | **OK** |
| 9:16 | OUV-C-3 | 86 % | 6 % | 0.96 | 75 % | **OK** |
| 9:16 | OUV-C-4 | 86 % | 6 % | 0.96 | 75 % | **OK** |
| 9:16 | OUV-D-1 | 49 % | 27 % | 0.60 | 88 % | **NON** |
| 9:16 | OUV-D-2 | 67 % | 13 % | 1.08 | 88 % | **OK** |
| 9:16 | OUV-D-3 | 68 % | 12 % | 0.99 | 88 % | **OK** |
| 9:16 | OUV-D-4 | 69 % | 9 % | 1.09 | 88 % | **OK** |
| 9:16 | OUV-E-1 | 88 % | 5 % | 1.08 | 88 % | **OK** |
| 9:16 | OUV-E-2 | 77 % | 6 % | 2.56 | 80 % | **OK** |
| 9:16 | OUV-E-3 | 75 % | 6 % | 2.64 | 78 % | **OK** |
| 9:16 | OUV-E-4 | 75 % | 6 % | 2.64 | 78 % | **OK** |
| 9:16 | FIN-C-1 | 80 % | 11 % | 0.91 | 92 % | **OK** |
| 9:16 | FIN-C-2 | 80 % | 11 % | 0.91 | 92 % | **OK** |
| 9:16 | FIN-C-3 | 80 % | 11 % | 0.91 | 92 % | **OK** |
| 9:16 | FIN-D-1 | 69 % | 9 % | 1.90 | 80 % | **OK** |
| 9:16 | FIN-D-2 | 66 % | 7 % | 1.78 | 80 % | **OK** |
| 9:16 | FIN-D-3 | 67 % | 7 % | 1.47 | 80 % | **OK** |
| 4:5 | OUV-A-1 | 66 % | 7 % | 0.99 | — | **OK** |
| 4:5 | OUV-A-2 | 65 % | 12 % | 1.72 | — | **OK** |
| 4:5 | OUV-A-3 | 65 % | 12 % | 1.72 | — | **OK** |
| 4:5 | OUV-A-4 | 65 % | 12 % | 1.72 | — | **OK** |
| 4:5 | FIN-D-1 | 85 % | 9 % | 0.85 | — | **OK** |
| 4:5 | FIN-D-2 | 88 % | 7 % | 0.98 | — | **OK** |
| 4:5 | FIN-D-3 | 86 % | 7 % | 0.91 | — | **OK** |

Seuils : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint ≥ 50 % (9:16).

## Écarts connus
- **OUV-D-1 (NON, 49 %)** : à 0,5 s, un seul mot est dit (« 23h14 ») ; la phrase se recompose à chaque mot (comme
  la maquette OUV-D-1, « QUI » seul), mais un mot de 5 signes ne remplit que 440 px de haut. Les 3 autres images
  passent. Parades possibles (à décider) : ouvrir OUV-D seulement quand le 1er écran a ≥ 3 mots, ou montrer la
  1re ligne entière d'un coup.
- **OUV-B** : l'écran est coupé en deux (aplats), d'où 100 % ; vérifié à l'œil comme en v3. Une bande nuit tient la
  place des sous-titres sur la couture, pour qu'ils restent lisibles sur la moitié ivoire.
- Écrans à mi-mouvement (OUV-A-2, OUV-C-2, OUV-E-2 à 1,3 s) : l'image d'après bascule est en cours d'entrée.
- Charte : chiffres de la carte tels qu'écrits (« 4 sec », « 23h14 », pas « 4 s ») ; « Situation type » sans
  « · support client » (non écrit sur la carte). Un seul mot orange par écran. Textes ≥ 58 px (étiquette 28 px),
  chiffres focaux ≥ 230 px en OUV-A, chiffre-clé de FIN-D 150 px (≥ 96).
