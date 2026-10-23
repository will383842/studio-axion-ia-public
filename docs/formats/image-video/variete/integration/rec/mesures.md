# Lot REC · Déroulé du récit (REC-B, REC-C, REC-D) · mesures

Carte C, version TikTok, 9:16. Images du VRAI moteur (`images-rec.mts` → banc commun `images-fixes.mts`, fiche simulée
de la carte C ÉCRITE selon le récit), maquettes rendues par `prototypes/rendre.mts` sur `d2-recit-chiffres-typo/entree.tsx`,
planches `REC-B.jpg`, `REC-C.jpg`, `REC-D.jpg` par `cote-a-cote.py` (maquette | moteur, 3 premières images du moteur),
mesures par `prototypes/occupation.py` sur CHAQUE image du moteur. Seuils (doc 76) : occupation ≥ 60 %, trou ≤ 15 %,
équilibre ≥ 0,5, appoint ≥ 50 %.

Ce que le lot dessine (calque `variete/recit/calque.tsx`, par-dessus la scène, jamais à la place) :
- **REC-B** : sur le résultat dit d'abord (bloc `moments` du bandeau), le « comment » monte du bas en vraies cartes
  (bulle → carte du chatbot, coche) ; au début de l'explication (première toile), le résultat reste rangé dans une
  pastille encre « 80 % » (Anton 96 px, blanc sur encre) sous le titre, et les mêmes cartes ferment le bas.
- **REC-C** : la bulle « 23h14 » (Anton 96 px) suit le message de nœud en nœud, posée au-dessus du nœud dont parle la
  voix (position passée par la caméra) ; elle s'efface pendant les vues d'ensemble et ne se pose jamais au bas du cadre
  quand le nœud suivi est encore hors champ. Le téléphone du client ferme le bas ; la réponse cochée y arrive au résultat.
- **REC-D** : le vrai repère `RepereChapitre` « k/3 » (×1,1 : 64 px) sur la toile, entre le titre de l'en-tête et le
  cadre de la toile (correctif 72 § 7 point 5) ; à sa place habituelle sous la marque sur les écrans d'objets (e-mail,
  alerte) ; effacé pendant les vues d'ensemble. Dans le bas, les trois étapes en vraies cartes (passées cochées, en
  cours pleine, à venir en retrait).

## Résultats

### REC-B

Instants : REC-B-1 = 3.095 s (b02, ImageVideoMoments) ; REC-B-2 = 4.595 s (b02, ImageVideoMoments) ; REC-B-3 = 6.295 s (b02, ImageVideoMoments) ; REC-B-4 = 15.459 s (b07, ImageVideoScene) ; REC-B-5 = 24.232 s (b07, ImageVideoScene) ; REC-B-6 = 33.205 s (b07, ImageVideoScene)

```
image          occupation  trou max  équilibre  appoint  verdict
REC-B-1               27 %       55 %       2.24     75 %  NON
REC-B-2               38 %       32 %       1.40     86 %  NON
REC-B-3               50 %       17 %       1.96     86 %  NON
REC-B-4               38 %       54 %       1.54     88 %  NON
REC-B-5               60 %       28 %       0.53     88 %  NON
REC-B-6               70 %       13 %       0.98     88 %  OK
```

### REC-C

Instants : REC-C-1 = 11.459 s (b05, ImageVideoScene) ; REC-C-2 = 20.596 s (b05, ImageVideoScene) ; REC-C-3 = 29.932 s (b05, ImageVideoScene) ; REC-C-4 = 39.823 s (b08, ImageVideoScene) ; REC-C-5 = 41.296 s (b08, ImageVideoScene) ; REC-C-6 = 42.968 s (b08, ImageVideoScene)

```
image          occupation  trou max  équilibre  appoint  verdict
REC-C-1               40 %       42 %       1.25     86 %  NON
REC-C-2               82 %        7 %       0.74     90 %  OK
REC-C-3               71 %       13 %       1.03     95 %  OK
REC-C-4               41 %       42 %       1.23     86 %  NON
REC-C-5               75 %       10 %       1.17     95 %  OK
REC-C-6               84 %        6 %       1.13     95 %  OK
```

### REC-D

Instants : REC-D-1 = 11.095 s (b05, ImageVideoScene) ; REC-D-2 = 20.414 s (b05, ImageVideoScene) ; REC-D-3 = 29.932 s (b05, ImageVideoScene) ; REC-D-4 = 30.732 s (b06, ImageVideoMoments) ; REC-D-5 = 33.505 s (b06, ImageVideoMoments) ; REC-D-6 = 36.477 s (b06, ImageVideoMoments) ; REC-D-7 = 37.277 s (b07, ImageVideoMoments) ; REC-D-8 = 38.05 s (b07, ImageVideoMoments) ; REC-D-9 = 39.023 s (b07, ImageVideoMoments) ; REC-D-10 = 39.823 s (b08, ImageVideoScene) ; REC-D-11 = 41.296 s (b08, ImageVideoScene) ; REC-D-12 = 42.968 s (b08, ImageVideoScene)

```
image          occupation  trou max  équilibre  appoint  verdict
REC-D-1               34 %       56 %       1.96     83 %  NON
REC-D-2               57 %       27 %       0.75     83 %  NON
REC-D-3               76 %       14 %       1.05     83 %  OK
REC-D-4               86 %        6 %       1.16     83 %  OK
REC-D-5               83 %       12 %       1.24     83 %  OK
REC-D-6               86 %        6 %       1.16     83 %  OK
REC-D-7               95 %        3 %       1.01     83 %  OK
REC-D-8               86 %        9 %       1.22     83 %  OK
REC-D-9               86 %        9 %       1.22     83 %  OK
REC-D-10              36 %       56 %       1.71     83 %  NON
REC-D-11              72 %       11 %       1.29     83 %  OK
REC-D-12              82 %        6 %       1.21     83 %  OK
```

## Lecture

- **15 images sur 24 passent les quatre seuils.** L'appoint passe partout (75 à 95 %) : c'est l'apport du lot (le
  bas, vide en référence, porte maintenant les cartes ou le téléphone).
- **Les 9 qui échouent tombent toutes sur des instants où la scène de RÉFÉRENCE est presque vide** et que ce lot ne
  dessine pas : début d'un bloc toile (+0,5 s : un seul nœud entre ; REC-B-4, REC-C-1, REC-C-4, REC-D-1, REC-D-10),
  milieu de toile caméra serrée (REC-B-5, REC-D-2, REC-C-5 à 67 % mais trou 18 %), et le bandeau de chiffres CHI-A
  (REC-B-1 à 3 : bandeau en haut, moitié basse vide, compteur à « 79 % » en cours). Le milieu de l'écran est le
  domaine des lots CHI (bandeau), APP-MAT (apparition sur la toile) et CAM-TRA (cadrage), pas du récit.
- **Écarts avec les maquettes** : la maquette REC-B-1 pose un « 80 % » de 500 px au centre ; le moteur garde le
  bandeau de référence (CHI-A), le lot n'y ajoute que l'appoint. REC-D : repère ×1,1 (la maquette, sans en-tête,
  l'agrandissait ×2,2 ; le moteur a un en-tête dont le titre descend jusqu'à y ≈ 430). REC-C : la bulle suit la vraie
  toile au lieu de la composition posée à la main de REC-C-2 (« 4 s » géant).
- **Charte vérifiée à l'œil** : le lot n'ajoute aucun mot orange (pastille blanc sur encre, bulle encre sur blanc,
  cartes sans texte) ; chiffres ≥ 96 px (« 80 % », « 23h14 ») ; repère 64 px ; vert seulement pour les coches ;
  rien de nouveau dans les zones protégées (bulle bornée à x 65 → 886, y ≥ 540 ; pastille à droite ≤ 886).
- **Défaut vu sur les images, hors lot** : un petit repère « 1/3 » sous la marque sur TOUS les blocs `moments`
  (REC-B-1 à 3, REC-D-4 à 9). Il vient des propriétés par défaut de la composition `ImageVideoMoments`
  (`galerieObjets()`, qui porte `repere: 1/3 → 3/3`) : Remotion fusionne `defaultProps` avec les propriétés reçues,
  et le service n'envoie pas `repere` quand la ligne n'en a pas. Présent sur master (pas de lien avec la variété) ;
  correctif proposé (hors de ce lot) : des propriétés par défaut sans `repere` pour `ImageVideoMoments` dans `Compositions.tsx`, ou `repere: null` envoyé par le service (`undefined` disparaît au passage en JSON).
- 4:5 non rendu (consigne 8.2 : 9:16) ; en 4:5 le calque ne pose pas d'appoint (pas de zone d'appoint dans ce cadre).
