# Rapport des écarts · v4 ↔ format « Cas concret »

Écrit par `outils/v4-fidelite/banc.mts` (état « V4-3, script validé de la v4 » ; « avant » = fin de V4-2 (master au départ de V4-3)). Ne pas retoucher à la main : relancer le banc.

## Méthode

- **v4** : images de `v4.mp4` (ffmpeg), deux par plan (à 40 % et 85 % de sa durée), 34 images.
- **Format** : les mêmes instants rendus par la composition `CasConcretEcran` (Remotion, rendu local), nourrie par la
  chaîne du format (`calerFiche` → `imagesDuCas` → `ecransCales` → `proprietesPleineImage` : zone pleine image, objets
  au-dessus des sous-titres, fil à 92 %)
  à partir du script validé de la v4 (`scripts-valides/recrutement-apporteurs.ts`, repris par `outils/v4-fidelite/fiche-v4.ts`) calé sur les MÊMES mots (`voix4.json`,
  tempo 1,08). Les écrans du format tombent sur les plans de la v4 à 40 ms près.
- **SSIM** : ffmpeg, niveaux de gris, pleine taille, bande des sous-titres de la v4 (1 580–1 780 px) noircie dans les deux
  images (le format pose ses sous-titres au montage, pas sur l'écran). **SSIM brute** : sans ce masque.
- **Formes** : recouvrement (IoU) des masques de contenu (pixels qui se détachent du fond lissé), en 270 × 480, même masque.
  1 = mêmes formes aux mêmes places.

**Attention : la SSIM n'est pas un bon juge ici.** Les grands fonds unis (nuit ou ivoire) pèsent l'essentiel de l'image :
la SSIM masquée dépassait déjà 0,90 quand le contenu était tassé dans la moitié haute. Le **recouvrement des formes** est
la mesure suivie (cible de V4-3 : moyenne ≥ 0,80, aucun plan sous 0,70).

## Score par scène

| Plan | Scène | Heures v4 | Écran(s) du format | SSIM avant | Formes avant | SSIM après | SSIM brute après | Formes après |
|---|---|---|---|---|---|---|---|---|
| s1 | Accroche « On recrute… en… » | 0,00–1,64 s | e01 (accroche) | 0,944 | 0,74 | 0,944 | 0,822 | 0,74 |
| s2 | Chiffre « 15 minutes. » | 1,64–3,40 s | e02 (chiffre) | 0,947 | 0,78 | 0,947 | 0,836 | 0,78 |
| s4 | Liste « Avant » | 3,40–12,64 s | e03 (liste-avant) | 0,954 | 0,62 | 0,960 | 0,878 | 0,76 |
| s6 | Bascule « tout automatisé » | 12,64–13,84 s | e04 (titre) | 0,947 | 0,82 | 0,947 | 0,833 | 0,82 |
| s7 | Étape 01 · L'annonce | 13,84–15,16 s | e05 (etape) | 0,950 | 0,93 | 0,950 | 0,841 | 0,93 |
| s8 | Étape 02 · L'inscription | 15,16–16,86 s | e06 (etape) | 0,953 | 0,77 | 0,953 | 0,853 | 0,77 |
| s9 | Étape 03 · Les e-mails | 16,86–18,74 s | e07 (etape) | 0,942 | 0,91 | 0,942 | 0,816 | 0,91 |
| s10 | Étape 04 · Le rendez-vous | 18,74–20,42 s | e08 (etape) | 0,946 | 0,69 | 0,946 | 0,826 | 0,69 |
| s11 | Objet · Elle oublie ? (rappel) | 20,42–22,59 s | e09 (objet) | 0,961 | 0,81 | 0,961 | 0,875 | 0,81 |
| s12 | Étape 05 · La visio (chrono) | 22,59–24,87 s | e10 (etape) | 0,958 | 0,78 | 0,958 | 0,868 | 0,78 |
| s13 | Titre « Notre seul travail » | 24,87–25,97 s | e11 (titre) | 0,957 | 0,84 | 0,957 | 0,862 | 0,84 |
| s14 | Étape 06 · Le contrat | 25,97–29,44 s | e12 (etape) | 0,962 | 0,70 | 0,962 | 0,879 | 0,70 |
| s16 | Objet · Dossier classé | 29,44–30,50 s | e13 (objet) | 0,944 | 0,72 | 0,944 | 0,825 | 0,72 |
| s17 | Résultat · barres | 30,50–32,78 s | e14 (resultat) | 0,960 | 0,80 | 0,960 | 0,874 | 0,80 |
| s18 | Question « Et dans votre entreprise ? » | 32,78–35,82 s | e15 (question) | 0,942 | 0,87 | 0,942 | 0,820 | 0,87 |
| s19 | Appel « Écrivez PLAN » | 35,82–37,67 s | f01 (appel-mot) | 0,955 | 0,74 | 0,955 | 0,857 | 0,74 |
| s20 | Promesse « le plan » | 37,67–41,31 s | f02 (promesse) | 0,931 | 0,67 | 0,931 | 0,791 | 0,67 |

**Moyennes** : SSIM 0,951 (avant : 0,950) · formes 0,78 (avant : 0,77).

## Composants (instant posé de chaque plan)

v4 : lu dans le DOM de `v4.html` rendu au même instant. Format : lu dans la mise en page de la brique (`disposer`).

| Plan | Affiche v4 (haut · taille) | Affiche format | Étiquette v4 (haut) | Étiquette format | Objets v4 (haut–bas, part de la hauteur) | Objets format |
|---|---|---|---|---|---|---|
| s1 | 630 px · 230 px | 564 px · 230 px | 560 | 498 | — | — |
| s2 | 330 px · 720 px | 330 px · 717 px | — | — | — | 330–990 (34 %) |
| s4 | 300 px · 170 px | 286 px · 190 px | 250 | 250 | 558–1445 (46 %) | 564–1284 (38 %) |
| s6 | 640 px · 190 px | 640 px · 230 px | — | — | — | — |
| s7 | 300 px · 190 px | 257 px · 190 px | 250 | 220 | 641–1576 (49 %) | 640–1560 (48 %) |
| s8 | 300 px · 190 px | 257 px · 190 px | 250 | 220 | 639–1580 (49 %) | 640–1560 (48 %) |
| s9 | 300 px · 190 px | 257 px · 190 px | 250 | 220 | 694–1172 (25 %) | 640–1560 (48 %) |
| s10 | 300 px · 166 px | 257 px · 166 px | 250 | 220 | 639–1582 (49 %) | 640–1560 (48 %) |
| s11 | 290 px · 190 px | 290 px · 190 px | — | — | 633–1576 (49 %) | 683–1443 (40 %) |
| s12 | 840 px · 340 px | 257 px · 190 px | 250 | 220 | 690–1430 (39 %) | 640–1560 (48 %) |
| s13 | 920 px · 318 px | 640 px · 230 px | — | — | — | — |
| s14 | 300 px · 190 px | 257 px · 190 px | 250 | 220 | 656–1478 (43 %) | 640–1560 (48 %) |
| s16 | 330 px · 162 px | 290 px · 158 px | — | — | 759–1408 (34 %) | 683–1443 (40 %) |
| s17 | 300 px · 122 px | 654 px · 143 px | 250 | 250 | — | 654–1165 (27 %) |
| s18 | 770 px · 198 px | 817 px · 198 px | — | — | — | — |
| s19 | 390 px · 250 px | 366 px · 230 px | 330 | — | 756–1025 (14 %) | 716–976 (14 %) |
| s20 | 770 px · 318 px | 748 px · 230 px | — | — | — | — |

Zones du format (pleine image) : texte 143–1744 px, utile jusqu'à 1590 px,
sous-titres 1590–1744 px (83 % à 91 %), largeur 40–1040 px.
v4 : étiquette à 250 px, titre à 300 px, objets jusqu'à ~1 576 px (82 %), sous-titres à 1 600 px (83 %), fil à 1 764 px (92 %), largeur 40–1 040 px.

## Ce qui a changé (V4-3 : un script validé, rejoué mot pour mot)

1. **Le script de la v4 est le script validé du cas** (texte de `voix4.json` mot pour mot, ordre de `v4.html`) : la
   fabrication ne réécrit plus le texte ; le banc mesure exactement ce que la fabrication rejoue.
2. **Liste « avant » sur un seul écran** (plan s4) : les six tâches, rangs de 112 px comme la v4 (V4-2 : deux écrans de
   quatre tâches au plus).
3. **L'annonce recadrée et zoomée** (plan s7, `tel7`) : image de 505 px dans l'écran de 442 px, zoom 1,02 → 1,12,
   montée de −10 à −70 px (le mouvement n'est pas jugé par le banc : deux images fixes par plan).

Rappel de V4-2 : échelle 1,0 (zone pleine image), centre horizontal exact, objets au-dessus des sous-titres, fil à 92 %,
chaque objet à sa taille et à sa place de la v4.

## Écarts qui restent

1. **Promesse** (s20) : « LE PLAN. » à 330 px et la signature « Axion-IA » dans la v4 ; le format écrit le cadeau
   à la taille d'affiche (230 px) et pas de signature. La fin du format n'est d'ailleurs pas celle de la v4 (fin par réseau,
   tirée de la banque) : ce plan ne mesure que l'écran de fin écrit à la main pour le banc.
2. **Le rendez-vous** (s10) : la v4 fait défiler la page puis glisse un second écran (`rdv-2.jpg`) ; le format ne
   montre qu'un vrai écran par étape (non fait).
3. **Le contrat** (s14) : la v4 change sa ligne au mot « signe » (« Il part tout seul. » → « Elle signe sur son
   téléphone. ») ; le format garde la première.
4. **Accroche** (s1) : la v4 empile trois tailles (230, 150, 230 px) plus bas (630 px) ; le format centre trois lignes.
5. **Marque « axion-ia.com »** en haut de chaque écran du format, absente de la v4 (non changée : à confirmer par Will).
6. **Étiquette d'étape** à ≈ 220 px (v4 250).
7. **Total de la liste** : la v4 écrit « pour chaque personne » sous « +1 H » ; le script n'a que « +1 H » (le schéma de
   la fiche ne porte pas cette ligne).

## Ce qui n'est pas mesuré

- Le mouvement (les images sont fixes, deux par plan) : le banc ne juge ni les entrées, ni le biais, ni le rythme visible ;
  le rythme est seulement comparé par les heures des plans (40 ms près).
- Les sous-titres et le son.
- Les objets du format sans équivalent dans la v4 (autres cas) : même grammaire supposée, non comparée.
