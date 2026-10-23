# Lot 3 · CHI — mesures (carte C, banc `images-fixes.mts`)

Images rendues par le vrai moteur (`mettreEnSceneIV` → `parametresDuBloc` → `renderStill`), carte C, version TikTok en
9:16 et LinkedIn en 4:5. Instants du banc : début du bloc + 0,5 s, milieu, fin − 0,3 s du bloc `variete/chiffres`
(bloc b09, 42,541 → 47,323 s ; « 80 % » dit à 0 s du bloc, « 0 demande » à 2,236 s, « 24h/24 » à 3,327 s).
Mesure : `python3 -I docs/formats/image-video/variete/prototypes/occupation.py` (doc 76). Planches maquette | moteur :
`CHI-B.jpg`, `CHI-C.jpg` (carte E, voir « Correctif »), `CHI-D.jpg`, `CHI-E.jpg`, `R45-CHI-B.jpg`, `R45-CHI-D.jpg` ; correctif de l'accent : `ACCENT.jpg`.

## 9:16 (seuils : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint ≥ 50 %)

| Image | Instant | Occupation | Trou max | Équilibre | Appoint | Verdict |
|---|---|---|---|---|---|---|
| CHI-B-4 | 43,04 s | 90 % | 3 % | 0,71 | 88 % | OK |
| CHI-B-5 | 44,93 s | 77 % | 10 % | 0,60 | 85 % | OK |
| CHI-B-6 | 47,02 s | 77 % | 9 % | 1,03 | 85 % | OK |
| CHI-C-2 (carte E) | 35,10 s | 75 % | 7 % | 1,09 | 92 % | OK |
| CHI-C-4 (carte E) | 36,30 s | 83 % | 6 % | 1,09 | 92 % | OK |
| CHI-C-5 (carte E) | 36,48 s | 85 % | 6 % | 1,08 | 92 % | OK |
| CHI-D-4 | 43,04 s | 67 % | 13 % | 0,90 | 64 % | OK |
| CHI-D-5 | 44,93 s | 69 % | 10 % | 0,92 | 86 % | OK |
| CHI-D-6 | 47,02 s | 68 % | 9 % | 1,21 | 86 % | OK |
| CHI-E-4 | 43,04 s | 76 % | 9 % | 0,83 | 92 % | OK |
| CHI-E-5 | 44,93 s | 72 % | 9 % | 1,18 | 92 % | OK |
| CHI-E-6 | 47,02 s | 71 % | 7 % | 1,65 | 92 % | OK |

## 4:5 (seuils : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5)

| Image | Instant | Occupation | Trou max | Équilibre | Verdict |
|---|---|---|---|---|---|
| R45 CHI-B-4 | 43,04 s | 81 % | 8 % | 0,86 | OK |
| R45 CHI-B-5 | 44,93 s | 68 % | 12 % | 0,55 | OK |
| R45 CHI-B-6 | 47,02 s | 70 % | 11 % | 0,64 | OK |
| R45 CHI-D-4 | 43,04 s | 75 % | 12 % | 0,90 | OK |
| R45 CHI-D-5 | 44,93 s | 77 % | 12 % | 0,94 | OK |
| R45 CHI-D-6 | 47,02 s | 73 % | 12 % | 1,03 | OK |

**18 images sur 18 : OK.**

## Correctif (après relecture du chef de projet)
- **CHI-C ne barre plus un chiffre vrai.** Le duel n'existe que pour l'avant / après d'un MÊME indicateur (groupes
  « avant » / « après » de la carte) et barre l'ANCIENNE valeur. Carte C (80 % / 20 %, deux parts complémentaires) :
  CHI-C n'est plus possible (repli CHI-A inscrit). Les images CHI-C viennent donc de la **carte E** (avant-après) :
  son écran partagé « 23 min → 3 s » (bloc b09, 34,595 → 36,777 s ; « 23 minutes » dit à 34,96 s, « 3 secondes » à
  36,05 s). Banc : copie de `images-fixes.mts` avec `--carte E` (le banc commun est figé sur la carte C) ; maquette
  `prototypes/rendre.mts d2…/entree.tsx CHI-C`. L'ancienne valeur paraît en pavé sur son mot, puis remonte, se barre
  ; la nouvelle s'affiche en orange sur une carte blanche cadrée de coins.
- **Le badge d'accent ne masque plus de libellé** (`ACCENT.jpg`). Autour du nœud s'il y a un espace libre (sous
  l'en-tête, sans toucher aucun nœud ni chiffre posé) ; sinon (vue d'ensemble dense de la carte C) en surimpression
  hors du schéma, entre la marque et l'étiquette (72 px, hors de la zone protégée de droite), relié au nœud par un
  filet orange qui passe par la marge, le contour du nœud souligné. Images de la toile (référence, non comptées) :
  40,6 s 48 % ; 41,2 s 53 % ; 42,2 s 65 % d'occupation.

## Charte (doc 74), vérifiée à l'œil et par construction
- Chiffre focal ≥ 230 px : anneau 330 px, duel ≥ 400 px, géant ≥ 470 px (9:16), objets 350 px. Quand le chiffre suivant
  arrive, la variante rapetisse sans jamais faire passer le focal sous 232 px (`FOCAL_MIN_PX`, `pile.tsx`).
- Chiffre-clé ≥ 96 px : rangées de la pile 96 à 112 px, accent de la toile 96 px (72 px en surimpression hors du
  schéma), ancienne valeur du duel gardée à 150 px une fois barrée.
- Texte ≥ 58 px : légendes Inter 60-72 px ; une fois la variante rangée, ses légendes s'effacent (elles passeraient
  sous 58 px).
- Un seul mot orange : le chiffre de la variante ; la pile est en encre (ivoire) ou en ivoire (nuit).
- Rien sous les sous-titres hors de la zone d'appoint (objets sans mot) ; texte au-dessus de y = 1152.

## Images du banc non comptées
Le banc rend aussi le bloc toile b08 (il porte la donnée d'accent) : `CHI-x-1/2/3`. Ce sont la toile de référence
(occupation 12 %, 48 %, 65 % : niveau d'aujourd'hui, hors de ce lot) ; le correctif de l'accent est dans `ACCENT.jpg`.
