# Lot 5 · TYP-SOU · mesures (16/10/2026)

Carte C (fixture), fiche simulée, voix `pisteSimulee`, banc `scripts/image-video/variete/images-fixes.mts` (une recette
par code, axes non cités à la référence). Mesure : `prototypes/occupation.py` (doc 76). Maquettes : `prototypes/rendre.mts`
(d2 pour TYP-*, d1 pour SOU-*). Planches « maquette | moteur » : `planche-<CODE>-<format>.jpg` (`cote-a-cote.py`).

**Important** : le banc passe par `mettreEnSceneIV`, qui ne donne pas encore les mots de la voix à l'axe (voir la PR).
Les heures des mots y sont donc ESTIMÉES depuis l'heure de chaque ligne (`calage: "estime"`). Le critère « mot écrit
≤ 0,15 s après son mot dit » est vérifié en test avec les mots de la voix (`typo.test.ts`). Une fois `etape.mots` passé
par le socle, il vaut aussi pour la ligne de temps.

Instants : début + 0,5 s, milieu, fin − 0,3 s de chaque écran de texte (b01 « 23:14 / Un client vous écrit »,
b02 « Vous dormez / Lui, il attend », b03 « Et demain matin… / Il a vu ailleurs », b04 « Sauf si quelqu'un lui répond /
Tout de suite »). TYP-D : seul b01 a un mot-objet (« 23:14 » → horloge) ; les autres écrans sont en TYP-C.

## 9:16

| Image | Occupation | Trou max | Équilibre | Appoint | Verdict |
|---|---|---|---|---|---|
| TYP-B-1 … TYP-B-9 (4 écrans) | 89 à 91 % | 4 à 5 % | 0,83 à 0,85 | 88 à 92 % | **9/9 OK** |
| TYP-C-3, 6, 9, 12 (fin d'écran) | 65 · 72 · 83 · 68 % | 13 · 12 · 3 · 10 % | 2,16 · 2,31 · 1,40 · 1,40 | 88 à 92 % | **OK** |
| TYP-C-1, 2, 4, 5, 7, 8, 10, 11 (entrée, milieu) | 29 à 54 % | 14 à 36 % | 1,00 à 5,40 | 88 à 92 % | NON |
| TYP-D-3 (fin d'écran) | 81 % | 6 % | 1,43 | 88 % | **OK** |
| TYP-D-1 (0,5 s : contour qui se trace) | 26 % | 55 % | 4,68 | 88 % | NON |
| TYP-D-2 (milieu : « UN » seul sous l'horloge) | 55 % | 40 % | 1,21 | 88 % | NON |
| SOU-C-1 (scène toile de référence + Impact) | 46 % | 24 % | 0,94 | 0 % | NON (scène hors lot) |

Référence TYP-A aux mêmes instants (b01, `CasConcretEcran`) : 18 %, 27 %, 27 % ; appoint 0 %.

## 4:5 (TYP-B y est remplacé par TYP-C ; SOU-C par SOU-B)

| Image | Occupation | Trou max | Équilibre | Verdict |
|---|---|---|---|---|
| TYP-C-3, 6, 9 (fin d'écran) | 78 · 100 · 94 % | 12 · 0 · 5 % | 1,96 · 0,94 · 0,76 | **OK** |
| TYP-C-12 (fin d'écran) | 57 % | 12 % | 0,77 | NON (de peu) |
| TYP-C (entrée, milieu) | 13 à 40 % | 22 à 46 % | 0,24 à 0,84 | NON |
| TYP-D-3 | 80 % | 12 % | 1,31 | **OK** |
| TYP-D-1, 2 | 9 · 43 % | 62 · 31 % | 0,00 · 0,13 | NON |

## Lecture

- **TYP-B** passe partout : le mot dit en dernier, seul, sur un panneau qui claque (orange pour le mot orange).
- **TYP-C et TYP-D** passent quand l'écran est posé. Ils échouent pendant l'arrivée des mots (1 à 3 mots dits), par
  construction : le texte avance au rythme de la voix. La référence TYP-A fait pire aux mêmes instants (18 à 27 %).
  Le bloc des lignes déjà dites reste centré et glisse vers le haut à chaque nouvelle ligne : le trou max en entrée passe
  de 63-68 % à 30-36 %.
- **Charte** : texte ≥ 58 px, mot orange ≥ 96 px, mot géant ≥ 150 px (test `typo.test.ts`, 6 cartes, 9:16 et 4:5) ;
  un seul mot orange par écran (test) ; marque visible ; zone d'appoint : carte pleine sans mot (icône de la carte).
- **SOU-C** : l'Impact « EN QUATRE SECONDES » (capitales, mot orange), là où SOU-B reste en style de base. 7 accents
  contre 5 sur la carte C. Q22 vert sur les 6 cartes × 5 réseaux. Écart avec la maquette : la brique pose un Impact orange,
  pas un pavé d'encre (la maquette SOU-C-1 a été dessinée à la main ; l'intensité « Très dynamique » de la brique est
  reprise telle quelle, comme le demande le plan).
