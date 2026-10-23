# Journal — contrôles qualité du face caméra (10/10)

Branche `fix/controles-qualite-facecam`, partie de `origin/master` 85655d2. Rien n'a été fusionné ni déployé. Aucun
serveur n'a été touché, aucun appel réel n'a été fait. Toutes les mesures viennent de sources synthétiques, avec le
FFmpeg 6.1.1 du conteneur de travail (la prod utilise 8.1.1).

## Constat

La carte « Qualité · Estimation » de la fiche vidéo face caméra affiche exactement les mêmes alertes sur la v1 et sur la
v3 :

- « Son et image décalés de 5 image(s) » (bloquant) ;
- « Visage trop clair (141) » ;
- « Teinte de peau hors des tons chair (37°) » ;
- note 66.

Pourtant la v3 est visuellement juste, et la VMAF de son export vaut 99,9.

## 1. Pourquoi les alertes ne bougeaient pas d'une version à l'autre

- **Les mesures sont mémorisées.** `retouche.partiesARefaire` ne refait la passe image (`travaux.passe`) que si les
  crans image ou la teinte changent. Il ne refait la piste montée (`travaux.cadrage`) que si les coupes, le son, l'image
  ou les effets changent. Une version qui ne change que l'habillage, ou qui sort après une correction du CODE (couleurs
  BT.709, HDR), reprend donc les résultats tels quels. `livraisonChaine` recalcule ensuite les alertes à partir de ces
  mêmes résultats : alertes et note sont identiques. Rien dans la reprise ne porte la version du traitement.
- **Elles ne portent pas sur la bonne image.** `luminanceVisageApres` et `teintePeauDeg` viennent de la passe image
  (`mesures_passe`). Elles sont mesurées sur l'image R'G'B' flottante, **avant la LUT du format** (appliquée dans
  l'encodeur) et **avant la conversion YUV / l'encodage 10 bits**, sur 12 images. Les corrections de couleurs v1 → v3
  portent justement sur ce qui vient après (matrice BT.709 de `filtre_lut`, export de studio-rendu) : ces mesures ne
  pouvaient pas les voir.
- **La VMAF ne dit rien des couleurs.** Elle compare l'export au master de la composition (`argumentsVmaf`). 99,9
  veut dire que l'encodage est fidèle au master, pas que la peau est juste.

## 2. Synchro son-image

### L'ancienne mesure (`image.decalage_synchro`) était un faux positif

Elle corrélait l'ouverture de la bouche (piste du visage, remise sur le temps du montage) avec l'énergie de la voix du
montage, sur une fenêtre de ± 5 images. Elle avait quatre défauts :

1. **Biais physiologique.** La bouche s'ouvre avant que le son sorte, de 100 à 200 ms environ. Le maximum de corrélation
   tombe donc à + 3 à + 5 images sur une vidéo parfaitement synchrone.
2. **Fenêtre saturée.** Avec ± 5, toute avance de 200 ms ou plus rend 5, la valeur du bord de la fenêtre. Au-delà, la
   mesure peut rendre n'importe quoi.
3. **Produit scalaire non normalisé.** Les décalages n'ont pas le même nombre d'images en commun, donc leurs scores ne
   sont pas comparables.
4. **Le fichier image n'est pas lu.** La mesure suppose que l'image k est à k/25 s. Elle ne voit donc ni le départ des
   flux ni un éventuel décalage de l'image.

Démonstration avec l'ancienne fonction, copiée telle quelle depuis origin/master. On l'applique à une piste montée
synchrone : la nouvelle chaîne, avec flash et bip à 0,67 image l'un de l'autre. La « bouche » vaut l'enveloppe de la
voix avancée de N ms.

| Avance naturelle de la bouche | 0 ms | 40 | 80 | 120 | 160 | 200 | 280 |
|---|---|---|---|---|---|---|---|
| Ancienne mesure (images) | +0 | +1 | +2 | +3 | +4 | **+5** | −5 |

Le « 5 » de la prod est la signature de ce biais : la valeur est collée au bord de la fenêtre. Le signe positif veut
dire « son après la bouche », c'est-à-dire la parole normale.

### Un vrai décalage était possible : le départ du flux son dans le MOV

Le son de la prise était lu par FFmpeg à partir de son **premier échantillon**, sans tenir compte de son horodatage
(`son.lire_son`, `media.extraire_son`). L'image, elle, est lue sur le temps du conteneur. Quand un MOV a un flux son qui
démarre après l'image (edit list, `start_time` du son > 0), toute la voix (transcription, coupes et son monté) arrivait
donc trop tôt. Mesures sur la piste montée (instant du bip moins instant du flash, en images ; négatif = son en avance) :

| Source synthétique | Ancienne chaîne | Nouvelle chaîne |
|---|---|---|
| Son AAC qui démarre 0,178 s après l'image, lecture directe (`fps=25` contre `lire_son`) | **−3,56** | 0 (bip 1,9957 s pour un flash à 1,96 s) |
| MOV « iPhone » : cadence variable autour de 30 i/s (base 600), son PCM qui démarre 0,200 s après l'image, coupe de 0,5 s avant le flash, `/son` sans débruitage puis `/image` cadrage | **−4,33** (flash 3,480 s, bip 3,3067 s) | **+0,67** (flash 3,480 s, bip 3,5067 s) |
| Même chose avec le débruitage de secours `afftdn` | **−3,71** (bip 3,3317 s) | **+0,67** (bip 3,5067 s) |

Les + 0,67 image restants ne sont pas un décalage. Ils viennent de la quantification des plans à 25 i/s : le flash
vrai est à 3,5067 s, l'image montée à 3,480 s, et `round(62,5) = 62` (arrondi au pair de Python) pour la borne du plan.
C'est ≤ 1 image par construction.

### Deuxième vrai décalage : `afftdn` retarde le son de 25 ms

Le secours de débruitage (`afftdn`, utilisé quand DeepFilterNet est en panne) rend un fichier de même longueur, mais
retardé d'exactement **25,0 ms** (1200 échantillons à 48 kHz, 1102 à 44,1 kHz, 400 à 16 kHz). Ce retard est
maintenant mesuré une fois par conteneur sur un bip (`son.retard_afftdn`, pour suivre la version de FFmpeg) et
compensé (`apad` puis `atrim`). Après correction : 0 ms d'écart, même longueur (test `RetardAfftdn`). DeepFilterNet
est appelé avec `pad=True`, qui compense son retard d'analyse. Son retard n'a pas pu être mesuré ici (pas de torch dans
le conteneur de travail) : le nouveau contrôle de synchro le verra en prod.

### Ce qui a été vérifié et n'introduit pas de décalage

- **Cadence variable de l'iPhone → 25 i/s.** Le filtre `fps` place les images selon leur horodatage. Flash attendu à
  1,968 s, lu à 1,96 s (source à cadence variable).
- **Lecture par tranches avec `-ss`.** Elle donne le même instant que la lecture complète : 1,96 s et 2,32 s, avec ou
  sans `-ss 1`.
- **Image qui démarre après le son** (MKV, `start_time` image 0,300 s). Le CLI FFmpeg complète déjà le début en cadence
  fixe. `fps=25:start_time=0` le rend maintenant explicite (même origine que le son), sans changer le résultat.
- **Coupes.** Le son monté découpe les passages gardés au même instant que les plans (à ≤ ½ image près, sans dérive
  cumulée). Les fondus de 15 ms ne déplacent rien.

### Corrections

- `media.FILTRE_SON_ALIGNE = "aresample=async=1:first_pts=0"` sur toute lecture du son de la prise
  (`extraire_son` → transcription, `son.lire_son` → son monté et contrôles). Un départ tardif est comblé par du silence,
  et les trous du flux le sont aussi.
- `media.filtre_preparation` : `fps=25:start_time=0`.
- `son.debruiter_afftdn` : son retard est compensé.
- **Nouvelle mesure** `image.decalage_synchro(chemin, plans, prise)`. Elle corrèle l'enveloppe du son monté (log-énergie,
  10 ms, centrée sur 0,5 s) avec celle du son de la **prise** au même instant (`priseDebutSec`), plan par plan, sur
  ± 1 s, avec un affinage parabolique. Elle y ajoute le retard du départ de l'image dans le conteneur (`ffprobe`). Elle
  ne fait aucune hypothèse sur la parole. Elle rend `None` si la corrélation est inférieure à 0,3 ou si le maximum tombe
  au bord de la fenêtre : jamais de fausse alerte. Elle rend aussi `synchro: {images, ms, sonMs, fluxMs, correlation}`.
  La chaîne passe désormais l'adresse de la prise au cadrage (`parametres.prise`, piste 9:16 et formats).
- Résultats sur la source « iPhone » de bout en bout : contrôle = **0 image** (−2 ms, corrélation 0,971 ; 0,970 avec
  `afftdn`). Avec un son retardé de 120 ms injecté : **+3**. Avec une image qui démarre 120 ms après le son : **−3**.
  Sans prise : `None`.

## 3. Luminance et teinte du visage

### Ce qui n'allait pas

- **Mauvaise image.** Voir § 1 : la mesure était faite avant la LUT et avant l'encodage, puis figée par la reprise.
- **Formule de la luminance.** C'était la luma **BT.601** (0,299 / 0,587 / 0,114) appliquée à de l'R'G'B' **BT.709**.
  Sur la peau ColorChecker (194, 150, 130), cela donne 160,9 au lieu de 157,9 (BT.709). C'était aussi une moyenne sur
  tout le masque de peau.
- **Seuils de luminance.** 100-140 correspond à 39-55 % du signal : c'est trop sombre. Une peau claire bien exposée se
  place vers 60-70 % (153-178), une peau foncée vers 40-50 %. La charte donne 158 (« light skin ») et 88 (« dark
  skin »). Une partie de l'écart vient aussi de la passe elle-même : elle vise 118, puis ajoute la lumière virtuelle et la
  « bonne mine », qui éclaircissent le visage. « Trop clair (141) » était donc une fausse alerte.
- **Teinte.** On prenait la moyenne Lab (a*, b*) sur le masque, qui touche le bord des lèvres et les narines (plus
  rouges). Le centre était 55° ± 15°, trop jaune : la charte ColorChecker donne 51,0° (« light skin ») et 49,2° (« dark
  skin »), et les joues rosées descendent vers 35-40°. L'ordre RVB était juste (rgb48le lu en `COLOR_RGB2Lab`). sRGB
  et BT.709 ont les mêmes primaires, donc la conversion Lab D65 d'OpenCV convient.

### Corrections

- **Mesure sur la piste montée** : `image.mesurer_visage_montage`, appelée par les contrôles du cadrage.
  - Le fichier encodé est relu comme le relit un lecteur : YUV 10 bits → R'G'B' 16 bits, avec la matrice **BT.709**,
    la plage **tv** et des arrondis exacts, tous **explicites**. Le décodage par défaut lit la même peau (188, 146, 131)
    au lieu de (192, 148, 129).
  - Il est relu à 12 instants, en ajoutant `fps` : sans lui, FFmpeg 6.1 ne rend aucune image pour un `-ss` qui ne tombe
    pas sur une image.
  - Zones mesurées : **deux joues et le front**, dans la boîte de l'ovale de la piste du visage, remise dans le cadre du
    plan. On évite ainsi les yeux, les sourcils, les narines et les lèvres.
  - Valeurs rendues : **luma BT.709** (médiane, 0-255 pleine plage) et **teinte h_ab** (médianes de a* et b*).
- **Seuils** (`chaine.LUMINANCE_VISAGE`, `chaine.TEINTE_PEAU`) : luminance de 90 à 190, teinte de 50° ± 20°.
- **Alertes** : `alertesControles` ne lit plus la luminance ni la teinte de la passe image. Il lit celles de
  `controles.visage` de la piste montée. Le bruit (rapport à la prise) et le ΔE au Look Will restent jugés sur la passe :
  ce sont des comparaisons relatives, sans rapport avec la LUT.
- Résultat sur une piste montée synthétique (peau ColorChecker (194, 150, 130), encodée comme la chaîne) : luminance
  **157,5** pour 157,9 attendu, teinte **51,0°** pour 51,03° attendu, sur 12 images.

## 4. Versions des contrôles

- Le cadrage rend `controles.version = 2` (`image.VERSION_CONTROLES`).
- `alertesControles` ignore la synchro et le visage d'une version antérieure. Les anciennes alertes fausses (5 images,
  141, 37°) disparaissent donc dès le prochain calcul, et la note remonte en conséquence.
- `retouche.etatPourRetouche` refait la piste montée d'une reprise dont les contrôles datent d'avant la version 2.
  Ils sont ainsi remesurés une fois. La passe image et le son sont gardés.
- Le double de simulation du studio-aligneur rend des contrôles de version 2 pour l'étape « cadrage ».

## Tests

- **Python (studio-aligneur)** : `python3 -m unittest discover -s tests` → **56 tests, OK**.
  - Nouveaux : `tests/test_synchro.py` (5 tests), qui fait passer la source synthétique « iPhone » par les vraies
    étapes `/son` et `/image` cadrage. Il vérifie que le flash et le bip sont à ± 1 image dans la piste montée, que le
    contrôle rend 0 et qu'il retrouve + 3 et − 3 injectés.
  - Nouveaux : `tests/test_controles_visage.py` (5 tests : luma et teinte lues comme un lecteur, sans visage → rien,
    contrôles rendus, `afftdn` sans retard).
  - `test_hdr.py` est mis à jour pour `fps=25:start_time=0`.
- **Vitest** : `tests/facecam-controles-qualite.test.ts` (7 tests), plus les 9 fichiers face caméra existants : 10
  fichiers, **93 tests, OK**. Suite complète : voir le § ci-dessous.
- **tsc** : aucune erreur dans les fichiers touchés. Les 13 erreurs restantes sont identiques sur origin/master :
  dépendances Remotion de studio-rendu absentes et `LayoutProps` générés par Next.
- **eslint** sur les fichiers TypeScript touchés : 0 problème.

## Limites

- Les valeurs de la prod (v1, v3) n'ont pas été remesurées : aucun accès. Les nouvelles mesures apparaîtront à la
  prochaine fabrication ou retouche, qui refera la piste montée une fois.
- La mesure du visage porte sur la piste montée, c'est-à-dire l'image envoyée à la composition finale. La fidélité de
  la composition elle-même (correction v1 → v3 de studio-rendu) reste contrôlée à part (VMAF contre le master).
- Coût : le contrôle de synchro relit le son de la prise par son adresse. Dans un MOV, son et image sont entrelacés,
  donc FFmpeg télécharge la prise entière une fois de plus pendant le cadrage, comme le fait déjà la passe image. Si
  ce temps pèse, `/son` pourra déposer l'enveloppe de la prise (quelques Ko) pour que le cadrage la relise.
- Le retard de DeepFilterNet n'a pas été mesuré ici. Le contrôle de synchro le verra.
- La cible de la passe image (`TEINTE_PEAU_DEG = 55`, `CIBLE_VISAGE_Y = 118`, luma BT.601 interne) n'a pas été
  modifiée. Ce sont des choix de rendu, pas des contrôles, et les changer modifierait l'image livrée.
