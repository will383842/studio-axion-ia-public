# Standard artistique « v3 » : Face caméra animée (16/10/2026)

*Directeur artistique. Ce document **remplace** `STANDARD-DA-V2-2026-10-16.md` (les deux exemplaires : celui de ce dossier et celui de `studio-interface-claire/docs/facecam-animee-v2/`). Il reprend de la v2 ce qui reste juste : la géométrie de la zone du visage, les emplacements, les règles de diversité vérifiables par code et le format des planches. Il **abandonne** sa matière (papier, tampon, scotch, autocollant, feutre, aplats plats). Aucun code n'a été modifié.*

## 0. Comment lire ce document

Chaque affirmation porte une étiquette :

- **[MESURÉ]** : je l'ai vu sur les images extraites de la référence le 16/10 (bandes de 0,1 s autour des transitions, images à la taille réelle, 14 planches à 4 images/s). Les mesures sont à ±0,02 près.
- **[SOURCÉ]** : vient d'une recherche web (§ B.3). **Presque toutes les sources sont des blogs d'éditeurs ou d'agences.** Seules la documentation Remotion et le communiqué d'Apple sont des sources primaires.
- **[SUPPOSÉ]** : extrapolation vers fin 2026 et 2027. Aucune source ne décrit 2027.
- **[WILL]** : décision ou retour de Will. Ces points ne se discutent pas.
- **[EXISTANT]** : déjà dans le code du studio.
- **[CHOIX DA]** : mon choix artistique, à juger par Will **sur extrait vidéo**.

Unités : **L** = largeur de l'image, **H** = hauteur (1080 × 1920, donc 0,01 L = 10,8 px et 0,01 H = 19,2 px). La surface d'un élément s'exprime en part de l'image : largeur (en L) × hauteur (en H). Le temps est compté en **images à 30 i/s**, et **i0** est l'image où Will prononce le mot déclencheur.

### Contraintes fixes [WILL]

- **Charte** : ivoire #E9DCC8, encre #110A05, orange #B44F29, sable #BFA88B, plus leurs nuances déjà figées dans `NUANCES` (`variantes/premium-2.tsx` : ivoireCreux, sableClair, sableProfond, filet, orangeVoile, orangeChaud, orangeProfond, encreDouce). **Aucune nouvelle teinte** : les transparences passent par `alpha()`.
- **Polices** : Montserrat ExtraBold et Inter.
- **Aucune musique**, mais les bruitages sont obligatoires.
- **Aucun zoom ni mouvement de la prise** (`ZOOMS_AUTORISES = false`). La descente de la prise sous une carte du haut reste permise, car Will a dit « garde la descente ».
- **Visage entier ou entièrement couvert.** Pendant une transition, le visage peut être partiellement couvert **3 images au plus**, et seulement si l'élément est en mouvement.
- **Visage visible au début** : rien sur le visage avant **5,0 s**.
- Aucun chiffre ni mot que Will n'a pas dit, et jamais « Villeexemple ».
- Chaque `.tsx` importe React, et la signature d'`Icone` ne change pas.

---

## A. Diagnostic franc : pourquoi la v2 fait « vieillot »

| # | Cause | Ce qu'on voit (planches v2 et code) | Pourquoi ça date |
|---|---|---|---|
| 1 | **On a pris le mauvais monde** | Tampon « RÉGLÉ », scotch, papier déchiré, autocollant au coin décollé, flèche au feutre, étoile « promo ». | C'est le « scrapbook » des comptes Instagram de 2019 à 2023. La tendance « fait main » est réelle [SOURCÉ], mais **la référence ne l'utilise pas du tout** : c'est un monde d'**interfaces logicielles** propres. La v2 a suivi les tendances au lieu de suivre la référence. |
| 2 | **Zéro vidéo** | 0 élément sur 24 contient une vidéo. Les planches ne montrent que Will et des aplats. | La référence a **9 fenêtres vidéo en 80 s** (surf, open space, clavier, logiciel de design, téléphone et ordinateur, femme à l'ordinateur, homme au casque, liasses, open space en noir et blanc), soit environ **une toutes les 9 s** [MESURÉ]. C'est la vidéo dans la vidéo qui donne la sensation de « production » et de modernité. |
| 3 | **Aucune lumière** | Aplats d'une seule couleur, sans dégradé ni reflet, avec une ombre dure ou pas d'ombre. | Le « flat design » plat (2013-2016) et le néo-brutalisme (2021-2024) sont les deux langages qu'un regard de 2026 classe comme « déjà vus ». Le récent, c'est la **matière** : verre, profondeur, reflet qui bouge [SOURCÉ : Apple, Liquid Glass]. |
| 4 | **Tout est en 2D, dans un seul plan** | Les rotations se font dans le plan de l'écran, sans perspective, sans flou de mouvement ni flou de mise au point. | Un objet qui arrive sans perspective et sans flou paraît « collé ». La profondeur (plans superposés, parallaxe, flou) est citée par toutes les sources de 2026 [SOURCÉ, blogs]. |
| 5 | **Trop de mondes à la fois** | 5 lots = 5 matières (papier, géométrie, typo, impact, organique). | La référence n'a **qu'un seul monde**, décliné partout. C'est ce qui fait « marque ». La v2 ressemblait à un catalogue d'effets. |
| 6 | **Trop petit** | 11 éléments sur 19 occupent moins de 3 % de l'image (critique du 16/10). | Ce sont des timbres-poste sur un téléphone. |
| 7 | **Jugé sur images fixes** | Will a encore vu des planches fixes. | Une image fixe tue l'énergie. **En v3, rien n'est montré ni noté sans extrait vidéo** (§ J). |

**En une phrase** : la v2 a cherché l'énergie dans la **matière artisanale**. La v3 la cherche dans la **vidéo, la profondeur et le mouvement physique**, dans **un seul monde** : celui de la référence (interface et fenêtres vidéo), modernisé.

---

## B. Le langage visuel de la référence et sa modernisation

### B.1 Ce que la référence fait réellement [MESURÉ]

Sources : extractions ffmpeg du 16/10 (`scratchpad/ref/` : bandes de 0,1 s à 4,85 s, 6,1 s, 12,1 s, 25,8 s, 79,0 s et 8,9 s ; images pleine taille à 1,5 s, 5,6 s, 14,5 s et 79,8 s), planches 00, 01, 02, 04, 07, 09, 10, 11 et 12, `transitions/broll_entree.jpg` et la comparaison du 14/10.

**Fenêtres vidéo**
- **Taille** : rectangle arrondi d'environ **0,80 L × 0,54 H** (575 × 690 px sur 720 × 1280, soit un rapport d'environ 0,83, proche du 4:5). La fenêtre **couvre entièrement le visage** : le haut est vers 0,13 H, le bas vers 0,67 H. Les sous-titres passent juste dessous.
- **Bord et ombre** : coins d'environ 0,02 L, contour encre fin d'environ 0,004 L, et **ombre dure décalée vers le bas-droit** d'environ 0,008 L, sans flou.
- **Entrée** (bande de 4,85 à 5,55 s) : en environ **0,2 s**, elle arrive de la droite. À la 2ᵉ image, on n'en voit qu'une tranche dont le bord haut est **en biais**, ce qui donne une impression de **perspective ou de pivot**. Elle se pose ensuite inclinée d'environ 1 à 2°, puis se redresse.
- **Sortie** (bande de 6,1 s) : **glissement sec vers la gauche en 3 images**, sans fondu ni rotation.
- **Dedans** : toujours une **vraie vidéo en mouvement**, littérale par rapport au mot dit, et jamais zoomée. Une fois sur neuf, elle est **désaturée** (le « passé »).
- **Sur la fenêtre** : une **étiquette** (texte encre sur plaque cyan, inclinée d'environ -3°) arrive d'un pop environ 0,3 s après la fenêtre. Elle chevauche le bord de la fenêtre : la superposition crée déjà de la profondeur. Des **pictos en cascade** peuvent s'ajouter (6 calendriers cochés, 2 par 0,25 s).

**Cartes d'interface**
- Elles font **0,80 L** de large et tombent du haut en environ 0,2 s. La prise descend pour laisser une bande crème en haut.
- **En-tête** : bandeau cyan avec titre en capitales et pastille « #n » encre. **Corps** : crème. **Bord** : contour encre épais avec ombre dure. Coins d'environ 0,02 L.
- **Le contenu se construit au mot près** : message tapé avec curseur, lignes de réponse, puces cochées qui s'ajoutent, liste qui s'allonge, calendrier, barres qui montent, commentaire tapé puis publié.
- **Sortie** : la carte remonte, la bande crème reste une image, puis la prise remonte.

**Étiquettes et pastilles** : plaques blanches ou cyan, contour et ombre dure, inclinées de ±3°, au-dessus de la tête. Entrée en pop. Le compteur défile (« +NNN NNN € » → « +2 000 000 € » en 2,5 s). Les pastilles de logos arrivent en cascade, puis tout est **barré d'un trait** quand Will dit « avant ».

**Sous-titres** : capitales très grasses, blanches avec contour sombre. Le mot fort est sur une plaque cyan avec contour. 1 à 3 mots à la fois, avec une position qui change (bas, ou sous la carte).

**Transitions** : coupes et glissements. La carte de fin **monte du bas** (panneau crème qui pousse la prise vers le bas en environ 0,2 s), puis le logo et les tuiles apparaissent en cascade.

**Une chose que nous n'avons pas le droit de copier** : la référence **recadre et zoome la prise** à l'entrée des cartes (le visage grossit entre 12,1 et 12,4 s). Une part de son énergie vient de là, et c'est interdit chez nous [WILL]. **On compense par le mouvement des éléments**, jamais par la prise.

### B.2 Ce qui est moderne dans la référence (à garder) et ce qui la date (à moderniser)

| On garde, c'est ce qui fait « niveau référence » | On modernise, c'est ce qui la date déjà |
|---|---|
| **Un seul monde cohérent** : interface et fenêtres vidéo. | L'**ombre dure décalée sans flou** et le **contour épais partout**, typiques du néo-brutalisme de 2022 à 2024. |
| **Des fenêtres vidéo grandes** (0,80 L) qui couvrent **franchement** le visage, puis s'en vont. | La **forme unique** : toujours le même rectangle 4:5, toujours depuis la droite. |
| **Un contenu qui se construit sur la voix**, à ±0,2 s. | Les **lignes grises « fausses données »** dans les cartes, qui font maquette. |
| **Clair, lumineux, net, aéré.** Beaucoup de crème, très peu de couleurs. | Un **aplat cyan plat** sans lumière. |
| **Densité** : un événement toutes les 1 à 2 s. | Des **sous-titres blancs à gros contour noir**, le réglage par défaut des outils de 2022 et 2023. |
| **Superposition** : l'étiquette chevauche la fenêtre. | **Tout est dans un seul plan**, sans perspective, sans flou de mouvement ni reflet. |
| **Littéralité** : on voit exactement ce que Will dit. | Une **carte de fin sèche**, sans mise en scène. |

### B.3 Recherche complémentaire : le moderne de fin 2026 (SOURCÉ / SUPPOSÉ)

| Idée | Statut | Ce que disent les sources | Ce qu'on en fait |
|---|---|---|---|
| **Verre translucide et profondeur** (« liquid glass ») | **SOURCÉ, source primaire** | Le communiqué d'Apple (juin 2025, Liquid Glass d'iOS 26) présente un matériau **translucide, dont la couleur vient du contenu derrière lui**, avec des **reflets spéculaires qui réagissent au mouvement** et des couches empilées. Des blogs UI de 2026 parlent de « glassmorphism 2.0 » à flou de profondeur. | C'est le matériau des cartes et des étiquettes v3, version ivoire (§ D). Le reflet traverse l'objet quand il se pose. |
| **Lisibilité du verre** | SOURCÉ (critique de designer, pxlnv) | Plus c'est transparent, moins le texte est contrasté. | Verre **opaque à 78-88 %**, jamais du verre « fantôme ». Texte encre sur ivoire. |
| **Cartes 3D en perspective, 3D en accent seulement** | SOURCÉ (blogs) | La 3D appliquée aux cartes et aux icônes, pas des scènes 3D complètes. Avertissement : « la 3D gratuite fait daté ». | Perspective **à l'entrée seulement**, puis une inclinaison résiduelle de 2 à 4°. Aucun objet 3D modélisé. |
| **Parallaxe et plans de profondeur** | SOURCÉ (blog demotion) | Plans à des vitesses différentes (fond à 50-70 %, premier plan à 130-150 %), plans lointains flous. | 3 plans (§ D.4) : la prise ne bouge **jamais** ; seuls les éléments ont de la parallaxe entre eux. |
| **Traînées et flou de mouvement** | SOURCÉ (blog demotion ; doc Remotion) | Le flou de mouvement sur les mouvements rapides. `@remotion/motion-blur` propose `<Trail>` et `<CameraMotionBlur>` (duplication de l'image, coûteux). | Flou **directionnel SVG** bon marché, seulement sur les images rapides (§ D.5). |
| **Typographie cinétique** | SOURCÉ (déjà dans `TENDANCES-MOTION-2026-10-16.md`) | Le mot en pièce centrale, mot à mot, le mot clé en couleur. | On garde le moteur, on change la matière des sous-titres (§ E). |
| **Texte derrière la personne** (effet de profondeur) | SOURCÉ, mais par des vendeurs (CapCut, VideoPopy, Cutback) | Un mot posé entre le fond et la personne, grâce au détourage. | Un élément (n° 17). Le studio sait déjà détourer dans le générateur « monteur » (`monteur-facecam.ts`, champ `detourage`) [EXISTANT, à vérifier pour ce générateur]. |
| **Inserts de preuve** (capture d'écran animée) | SOURCÉ (guide Jupitrr 2026) | Une coupe doit « prouver une affirmation ». Mieux vaut le vrai logo, la vraie capture ou le vrai article qu'une ambiance générique. | Carte-preuve avec capture qui défile et curseur (n° 11). La capture qui défile existe déjà dans `Fenetre.tsx` [EXISTANT]. |
| **B-roll « qui a un rôle »** | SOURCÉ (Jupitrr) | Chaque B-roll prouve, explique, donne du contexte ou relance l'attention. Sinon, on reste sur la personne. | C'est déjà la règle de littéralité du studio (`litteralite.ts`) [EXISTANT]. |
| **Mosaïque d'images qui défilent** (« library aesthetic ») | SOURCÉ, une seule source de vendeur | Le motion design qui feuillette des images ou des extraits liés entre eux. | Un coup de poing (n° 24). |
| **Mini-fenêtres de formes variées** (cercle, pilule, arche, blob) | **SUPPOSÉ** | Aucune source solide. C'est la demande de Will (« formes non carrées »). | Système de masques (§ C). |
| **Ressorts physiques** | SOURCÉ, doc Remotion | `spring({ damping (10 par défaut), stiffness (100), mass (1) })`. Plus de `damping` réduit le rebond, moins de `mass` accélère. | Ressorts nommés (§ C.4). |
| **Grain et texture légère** | SOURCÉ (blogs) | Grain et poussière pour redonner de la profondeur aux compositions trop propres. | Grain de 2 à 3 %, **uniquement sur les grands aplats** des coups de poing. Jamais de papier. |
| **Ce qui fera « 2027 »** | **SUPPOSÉ** | Rien de sourcé. | Mon pari : du **verre opaque chaud** (pas le verre bleuté d'Apple), une **lumière qui bouge** et des **vidéos dans des formes**, plutôt que des effets. À vérifier par la seule mesure qui compte : l'avis de Will sur extrait. |

**Limite honnête** : personne ne mesure « le moderne de 2027 ». Le seul juge objectif dont nous disposons est **la comparaison côte à côte avec la référence**, que Will aime. La v3 se fixe donc **un plancher** (égaler la référence) et **un plafond** (la dépasser par la matière et la profondeur, sans changer de monde).

---

## C. Le système de FENÊTRES VIDÉO

### C.1 Géométrie de la prise (inchangée depuis la v2) [EXISTANT, `cadrage.ts`]

- Yeux à 0,34 H. Boîte du visage, cheveux et menton compris : **x 0,27 → 0,73 L, y 0,14 → 0,56 H**.
- **Zone interdite Z** = cette boîte + 0,02, soit **x 0,25 → 0,75 L, y 0,12 → 0,58 H**. Elle est recalculée pour chaque prise depuis `plan.prise`.
- **Visage « entier »** : aucun pixel de l'élément dans Z, à aucune image, y compris pendant la trajectoire.
- **Visage « couvert »** : Z entièrement sous l'élément à l'état posé. Le passage d'un état à l'autre se fait en **3 images au plus**.
- **Sous-titres** : bande par défaut vers 0,64 H. Quand un élément occupe le bas (y > 0,58 H), les sous-titres **basculent en haut, à 0,075 H** (au-dessus des cheveux) [CHOIX DA ; la mise en page sait déjà déplacer les sous-titres, `SOUS_TITRES` dans `cadrage.ts`].
- **Format 4:5** (LinkedIn et Facebook) : rien d'essentiel au-dessus de 0,04 H ni au-dessous de 0,92 H, tant que le recadrage du studio n'est pas vérifié.

### C.2 Les 10 masques (formes de fenêtre)

Toutes les fenêtres partagent **la même matière** (§ C.3). C'est la **forme** qui varie. Chaque masque se fait en CSS `clip-path` (cercle, `inset() round`, polygone) ou avec un `<clipPath>` SVG (arche, blob, mot). Pas besoin de bibliothèque.

| Code | Masque | Dessin | Emplacement possible | Visage |
|---|---|---|---|---|
| **K1** | **Carte arrondie inclinée** (le rectangle de la référence, modernisé) | Rapport 4:5, coins de 0,045 L (plus ronds que la référence), posée à -2,5° ou +2,5° | Sur le visage : x 0,05 → 0,86, y 0,12 → 0,69 (`FENETRE_SUR_VISAGE`) [EXISTANT] | couvert |
| **K2** | **Écran de téléphone** | Rapport 9:19,5, coins de 0,07 L, cadre encre de 0,012 L avec un reflet, îlot noir en haut | Sur le visage : x 0,20 → 0,80, y 0,07 → 0,70 | couvert |
| **K3** | **Double fenêtre** | K1 sur le visage, plus une 2ᵉ fenêtre de 0,44 L × 0,30 H qui la chevauche en bas à droite, inclinée en sens inverse | Visage, puis bas-droit | couvert |
| **K4** | **Plein cadre** | K1 qui s'ouvre jusqu'aux bords, les coins passant de 0,045 L à 0 | Plein écran | couvert |
| **K5** | **Pilule verticale** | Hauteur de 0,40 H, largeur de 0,28 L, extrémités en demi-cercles | Côté gauche ou droit, déborde du cadre de 10 % au plus | entier |
| **K6** | **Cercle** | Diamètre de 0,40 L, avec un **anneau orange** de 0,008 L décalé de 0,012 L (le cercle « flotte » dans l'anneau) | Sous l'épaule, à gauche ou à droite, sous 0,58 H | entier |
| **K7** | **Bande diagonale** | Bande de 0,15 H d'épaisseur, de -10 à -16°, d'un bord à l'autre | Sous le menton (le bord haut ne remonte jamais au-dessus de 0,60 H) | entier |
| **K8** | **Arche** | Rectangle dont le haut est un demi-cercle complet, 0,50 L × 0,34 H, qui sort par le bas du cadre | Bas-gauche ou bas-droit | entier |
| **K9** | **Blob** | 8 points de contrôle **asymétriques**, rayons à ±15 %, qui respirent de ±3 % sur une période de 1,6 s | Bas, d'un côté | entier |
| **K10** | **Mot-fenêtre** | Les lettres d'un mot dit (Montserrat ExtraBold, ≥ 0,9 L de large) servent de masque à la vidéo | Plein écran | couvert |

### C.3 La matière commune des fenêtres [CHOIX DA]

- **Bord** : la fenêtre n'a **plus de contour encre épais**. Elle a :
  - un **liseré intérieur** ivoire à 55 % de 0,003 L (`inset 0 0 0 …`),
  - un **reflet en haut** (la fonction `reflet()` de `premium-2` [EXISTANT], portée à 0,0025 L et 35 %).
- **Ombre douce en 3 couches**, avec une lumière qui vient du haut, pour toutes les fenêtres et toutes les cartes de la v3 :
  `0 0,004L 0,010L alpha(encre,0,20)` · `0 0,018L 0,045L alpha(encre,0,24)` · `0 0,045L 0,11L alpha(encre,0,16)`.
  Plus un objet est « proche » (§ D.4), plus les 2ᵉ et 3ᵉ couches sont décalées et grandes (×1,3).
- **Vidéo dedans** : remplit la forme en « cover », **sans zoom** [WILL, 15/10]. Le fichier est la mini-vidéo préparée en 1080 × 1350, de 4 s au plus, en boucle (`MiniVideo` dans `Fenetre.tsx`) [EXISTANT]. Pour K2 (téléphone), une vidéo verticale est recadrée en 9:19,5. Pour K7 (bande), la vidéo est recadrée en paysage.
- **Légère vignette intérieure** : dégradé radial encre à 18 % dans les coins, pour décoller la vidéo du bord.
- **Reflet qui passe** [SOURCÉ : reflets qui réagissent au mouvement] : à l'arrivée au repos, une bande diagonale ivoire à 18 %, de 0,25 L de large et inclinée à 20°, traverse la fenêtre en **10 images** (`Easing.inOut(cubic)`). Une seule fois par fenêtre.
- **Étiquette sur la fenêtre** : c'est la puce (« chip ») v3 (§ E.2), qui **chevauche le bord** de la fenêtre de 0,03 L. Elle a sa propre ombre, d'un cran plus « proche ».
- **Passé** (« il y a quelques années… ») : passage en noir et blanc en 0,25 s (`noirEtBlancA`) [EXISTANT].

### C.4 Les ressorts Remotion nommés

`spring({ frame, fps: 30, config: { damping, stiffness, mass } })`. Le dépassement et le temps de pose sont **calculés en théorie** (oscillateur amorti : amortissement relatif ζ = damping ÷ (2√(stiffness × mass))). **À mesurer avec `measureSpring`** et à régler à l'œil sur extrait.

| Nom | damping | stiffness | mass | ζ | Dépassement | Posé en | Sert à |
|---|---|---|---|---|---|---|---|
| `VERRE` (nouveau) | 16 | 180 | 0,9 | 0,63 | ≈ 8 % | ≈ 14 i | Entrée des fenêtres et des cartes : vive, posée, « chère » |
| `PIVOT` (nouveau) | 11 | 120 | 1 | 0,50 | ≈ 16 % | ≈ 22 i | Rotations 3D (rotateX/rotateY) qui reviennent à plat |
| `FOUET` (nouveau) | 30 | 520 | 0,6 | 0,85 | ≈ 1 % | ≈ 6 i | Sorties rapides, avec un flou de mouvement |
| `JAILLIR` | 12 | 200 | 0,7 | 0,51 | ≈ 16 % | ≈ 14 i | Puces, petits objets (repris de la v2) |
| `CLAQUER` | 18 | 420 | 0,5 | 0,62 | ≈ 8 % | ≈ 7 i | Impacts (repris de la v2) |
| `POSER` | 20 | 170 | 1 | 0,77 | ≈ 2 % | ≈ 12 i | Ouvertures de masque, objets lourds (repris de la v2) |
| `GLISSER` | 26 | 260 | 0,8 | 0,90 | ≈ 0 % | ≈ 8 i | Translations sans rebond (repris de la v2) |

`mouvement.ts` garde intacts `progression`, `rebond` et `sortie` [EXISTANT]. Les ressorts **s'ajoutent**, ils ne remplacent rien.

### C.5 Entrées et sorties des fenêtres (6 manières)

Toutes les entrées se font dans un conteneur en `perspective: 1400px` (0,0013 L⁻¹ à 1080).

| Code | Entrée | Recette (30 i/s) | Sortie associée |
|---|---|---|---|
| **N1** | **Pivot latéral** (la référence, en 3D) | De i0 à i14 : translateX de ±1,0 L à 0 avec `VERRE`, rotateY de ∓38° à 0 avec `PIVOT`, rotateZ de ∓7° à ∓2,5°. Flou directionnel de 0,02 L de i0 à i3. **Mise au point** : `blur(0,008 L)` → 0 entre i0 et i4. | **Fouet** vers le côté opposé en 5 i (`FOUET`), rotateY de 25°, flou directionnel de 0,025 L. |
| **N2** | **Bascule depuis le bas** | translateY de 0,9 H à 0 avec `VERRE`, rotateX de 28° à 6° (l'objet est « couché » puis se redresse) avec `PIVOT`, rotateZ de 5° à 3°. | Rechute vers le bas en 6 i : rotateX vers 35°, `Easing.in(cubic)`. |
| **N3** | **Ouverture de masque** | Le masque passe d'un point (ou d'une pilule de 0,10 L) à sa taille finale avec `POSER`. La vidéo reste fixe dessous (seul le masque grandit : **ce n'est pas un zoom**). | Fermeture du masque en 5 i vers un point situé hors de Z. |
| **N4** | **Glissement diagonal** | Translation à 20-30° depuis un coin avec `GLISSER`, deux copies fantômes à 25 % puis 12 % de i0 à i3, arrêt net avec une secousse de 0,006 L (élément seul). | Sortie en ligne droite vers le coin opposé. |
| **N5** | **Dépliage** | scaleY de 0 à 1 depuis le bord d'attache avec `POSER`, l'ombre grandit avec l'élément. | Repliage vers le bord d'attache. |
| **N6** | **Poussée** (« push ») | La fenêtre entrante **pousse** la précédente hors du cadre : même vitesse, collées, avec `GLISSER`. | Elle est poussée à son tour, ou repart en N1. |

**Règle de visage** : une fenêtre « couvert » doit couvrir Z au plus tard à **i3**, et découvrir Z en **3 images au plus** à la sortie. On choisit donc des trajectoires **qui traversent Z vite** (N1, N2, N6). N3 n'est permis en « couvert » que si l'ouverture part d'un point situé **au centre de Z** et couvre Z en 3 i (cas n° 4).

### C.6 Ce que les fenêtres contiennent

1. **B-roll Pexels ou Pixabay** d'une scène **littérale** de la phrase. Le circuit existe déjà : requêtes littérales, élargissement, scènes de secours, contrôle par Claude de la littéralité, mesure du mouvement (3 à 35 % de pixels qui changent) [EXISTANT, `src/moteurs/montage-facecam-animee/images/`].
2. **Capture d'écran animée** (preuve) : la page défile vers le haut [EXISTANT, `capture`]. On y ajoute un **curseur** qui clique, avec un anneau orange de 0,04 L qui s'étend en 8 i, et un **surlignage** orange à 30 % qui balaie la ligne citée [CHOIX DA].
3. **Vidéos de Will** (« Mes images ») quand elles existent [EXISTANT, `ORDRE_SOURCES`].
4. **Jamais** de photo fixe dans une fenêtre, d'image générée ni de banque payante [EXISTANT, WILL].

**Durée d'une fenêtre** : de 1,2 à 3,0 s, comme la référence (1 à 3 s). Une même source vidéo n'apparaît jamais deux fois dans une même vidéo.

### C.7 Réutilisation du code

| Fichier | Ce qu'on garde | Ce qui change |
|---|---|---|
| `Fenetre.tsx` | `MiniVideo` en entier (boucle, `delayRender`, filet de 5 s), la capture qui défile, le noir et blanc, la logique de taille de l'étiquette | `styleBoite` (contour et ombre dure) est remplacé par la matière § C.3. Ajouter `masque: K1…K10`, `entree: N1…N6` et le reflet qui passe. L'étiquette devient une puce v3. |
| `cadrage.ts` | `FENETRE_SUR_VISAGE`, `rectFenetreVisage`, la zone du visage, `animationFenetre` comme modèle | Une `animationFenetreV3` à ressorts, qui rend aussi `rotateX`, `rotateY` et le flou. Les **tests « tout ou rien »** de visage doivent porter sur le **contour réel du masque** projeté en perspective, et pas sur son rectangle englobant. |
| `images/` | Tout le circuit | Ajouter un **format demandé** par masque (paysage pour K7, 9:19,5 pour K2, carré pour K6). Le recadrage se fait à la préparation, pas au rendu. |

---

## D. Le système de CARTES D'INTERFACE modernes

### D.1 La carte v3, pièce par pièce [CHOIX DA]

| Pièce | Référence | v3 |
|---|---|---|
| **Corps** | Crème plat, contour encre épais, ombre dure | **Verre ivoire** : fond `alpha(ivoire, 0,84)` + `backdropFilter: blur(0,022 L) saturate(1,2)` (déjà utilisé dans `PileNotifications.tsx` [EXISTANT]). Ombre douce en 3 couches (§ C.3). Liseré intérieur ivoire de 0,0025 L et reflet en haut. |
| **Coins** | ≈ 0,02 L | **0,04 L**, avec des coins intérieurs (puces, champs) à 0,018 L |
| **En-tête** | Bandeau cyan plat | Bandeau **`degradeOrange`** (orangeChaud → orangeProfond) [EXISTANT] avec un reflet de 1 px en haut. Titre ivoire en Montserrat ExtraBold, interlettrage de 0,04 em. Pastille « n/N » en **verre encre** (`alpha(encre, 0,72)` et flou). |
| **Contenu** | Lignes grises factices | **Plus aucune ligne factice.** Que du vrai texte dit par Will, en Inter, et des icônes `Icone`. Les éléments vides sont des « squelettes » sable qui **se remplissent** (balayage de lumière ivoire de 8 i). |
| **Puces dans la carte** | Rectangles à contour et ombre dure | Pilules orange en dégradé avec un reflet, ou pilules de verre ivoire avec une coche encre. Entrée `JAILLIR` à 60 % d'amplitude, cascade de 2 i. |
| **Lumière de l'élément actif** | — | La ligne citée reçoit un **halo orange** doux (`0 0 0,03L alpha(orange,0,35)`) et passe en ivoire plein pendant 12 i, puis revient. Cela remplace le « flash orange plein » actuel, plus brutal. |
| **Grain** | — | Aucun. Le grain ne va que sur les aplats plein écran. |

### D.2 Entrées et sorties des cartes

- **Chute 3D** (pour la carte du haut, avec la descente de la prise) : translateY de -0,35 H à 0 avec `VERRE`, rotateX de -22° à 0 (le bas de la carte arrive en premier) avec `PIVOT`, mise au point de 0,006 L à 0 en 4 i. La prise descend en même temps, comme aujourd'hui (`DESCENTE`) [EXISTANT, WILL].
- **Pivot** : rotateY de 90° à 0 (la carte « s'ouvre comme une porte ») avec `PIVOT`, ancrée sur le bord extérieur.
- **Retournement** : rotateY de 0 à 180° sur un mot dit, avec `PIVOT`. Le recto montre le problème, le verso la solution (`backfaceVisibility: hidden`).
- **Sortie** : remontée en `FOUET` (5 i) avec un rotateX de 15°, ou retournement qui s'efface.
- **Micro-vie au repos** : flottement de ±0,25 % de translateY sur une période de 2,4 s, plus un rotateX de ±0,6°. Jamais plus de 0,7 s parfaitement immobile.

### D.3 Ce qu'on réutilise

- `Carte.tsx` : **toute la logique** est gardée (`contenuAvance`, `sansBandeVide`, `sansEtiquettesSuperposees`, la réduction du contenu, la descente). On ne change que **l'enveloppe** (`styleBoite` → matière v3) et `animationCarte` (→ ressorts et 3D).
- `cartes/` (Calcul, Calendrier, ChatTape, Commentaire, Frise, Graphique, GrilleVignettes, ListeCochee, PileLogos, Statuts) : les **contenus** restent. Ils passent déjà en partie par `premium-2` (`NUANCES`, `degradeOrange`, `reflet`, `microOmbre`) [EXISTANT]. Il faut retirer les ombres dures restantes.

### D.4 Profondeur : 3 plans [CHOIX DA]

| Plan | Quoi | Ombre | Parallaxe |
|---|---|---|---|
| **P0** | La prise de Will | aucune | **aucune, jamais** [WILL] |
| **P1** | Fenêtres et cartes | ombre en 3 couches × 1 | référence |
| **P2** | Puces, étiquettes, pictos posés **sur** P1 | ombre × 1,3, décalée de 0,006 L de plus | **×1,35** du mouvement de P1 pendant les entrées et sorties : la puce « arrive après » la fenêtre et la dépasse légèrement |

Quand une fenêtre **couvre** le visage, le reste visible de la prise peut recevoir un **voile encre à 22 %** (et non un flou) pour décoller la fenêtre. Ce voile s'applique en 4 i et se retire en 3 i [CHOIX DA, **à valider par Will** : ce n'est ni un zoom ni un mouvement, mais c'est un effet sur la prise].

### D.5 Flou de mouvement et mise au point (bon marché)

- **Flou directionnel** : filtre SVG `feGaussianBlur stdDeviation="X 0"` appliqué à l'élément, dans un conteneur tourné selon la direction du mouvement. `X` est proportionnel à la vitesse : 0,02 L à l'image la plus rapide, 0 à l'arrêt. **Uniquement pendant les images rapides** (4 à 6 images par entrée).
- **Mise au point** (« blur-in ») : `filter: blur()` de 0,006 à 0,01 L → 0 en 4 i, sur l'élément entrant.
- `@remotion/motion-blur` **n'est pas installé** (paquets présents : bundler, renderer, media…). Si l'on veut `<Trail>` ou `<CameraMotionBlur>`, il faut l'ajouter **en version exacte 4.0.532**. Je ne le recommande pas : la duplication multiplie le temps de rendu.

### D.6 Coût de rendu (à mesurer avant de figer)

- `backdrop-filter` est l'effet **le plus coûteux** du compositeur de Chromium [SOURCÉ, note technique Chromium ; la doc Remotion indique que le GPU est souvent désactivé en mode sans tête].
- **Règle** : **2 couches de verre au plus** à l'écran en même temps. Si une planche de 15 s rend 1,5 fois plus lentement qu'aujourd'hui, le verre passe en « **faux verre** » : `alpha(ivoire, 0,92)` sans flou, avec le même reflet et la même ombre. À l'œil sur téléphone, la différence est faible sur un mur clair.
- Les rendus de planche se font **un à la fois, sous le verrou `verrou-lourd.txt`** [EXISTANT, ordre permanent], idéalement dans le cloud.

---

## E. Sous-titres et puces de mot clé

### E.1 Ce qu'on garde [EXISTANT, `SousTitres.tsx`]

Le moteur entier : mot à mot, 1 à 3 mots, mots de liaison qui ne sont jamais seuls (`apparitions`), largeurs Montserrat mesurées (`AVANCES`), bornes de hauteur et de largeur tenues même pendant les entrées (`echellesBornees`), place qui grandit avec le mot (la ligne se recentre sans à-coup), pop du groupe, tressaillement à chaque mot et coupe sèche.

### E.2 Ce qui change : la matière [CHOIX DA]

| Pièce | Aujourd'hui | v3 |
|---|---|---|
| **Mots ordinaires** | Ivoire, **contour encre de 0,16 em** et ombre dure | Ivoire, **contour encre fin de 0,05 em**, plus une **ombre douce** `0 0,04em 0,14em alpha(encre,0,55)`. On lit le mot, pas son contour. |
| **Mot en cours** | Le texte devient orange | Le texte reste ivoire, et une **pilule de surlignage orange** (dégradé et reflet) **grandit derrière le mot** depuis la gauche en 4 i (`GLISSER`), puis s'efface quand le mot suivant arrive. C'est le geste « karaoké » moderne. |
| **Mot fort** (« chip ») | Plaque orange, contour encre, ombre dure, inclinée de -2 à -2,8° | **Chip** en `degradeOrange`, coins de 0,22 em, reflet en haut, ombre douce en 2 couches, **sans contour**. Entrée : échelle de 0,4 à 1 avec `JAILLIR` et mise au point en 3 i. Inclinaison alternée de -2° et +2°. |
| **Mot fort sur fond orange** (coup de poing) | — | Chip en **verre encre** (`alpha(encre,0,78)`) avec texte ivoire. |
| **Casse** | Capitales | **Capitales gardées** : elles font partie de la reconnaissance de marque. Une source vante les minuscules grasses [SOURCÉ, 1 source], mais ce n'est pas assez pour changer. *À proposer à Will en option sur un seul extrait.* |
| **Position** | Bas, ou sous l'objet | Même logique, plus la **bascule en haut** (0,075 H) quand le bas est occupé (§ C.1). |

### E.3 La puce qui quitte le sous-titre

Le mot fort peut **se détacher** du sous-titre et devenir un élément : c'est `mot-saute` (n° 16). C'est le lien visuel entre la parole et le motion design, le plus « 2026 » de la v2, et on le garde.

---

## F. Transitions et coups de poing modernes

### F.1 Transitions [CHOIX DA]

| Code | Transition | Recette | Remplace |
|---|---|---|---|
| **T1** | **Fouet flou** | Sortie `FOUET` de 5 i avec flou directionnel. L'élément suivant entre dans le même sens 1 i plus tard. | La sortie en fondu |
| **T2** | **Masque qui s'ouvre** | N3 sur une forme de la charte (pilule, cercle, mot). | Le volet plat |
| **T3** | **Poussée** | N6 : la fenêtre suivante pousse la précédente. | L'enchaînement sec |
| **T4** | **Métamorphose** (« morph ») | Une **puce** devient une **fenêtre** : son rectangle s'agrandit et ses coins passent de 0,22 em à 0,045 L, avec `VERRE`, puis la vidéo apparaît en N3. Le contenu de la puce devient l'étiquette de la fenêtre. | « Une chose disparaît, une autre apparaît » |
| **T5** | **Reflet de passage** | Une bande de lumière ivoire balaie l'écran en 8 i pendant la coupe. | Le flash plein écran |
| **T6** | **Montée du panneau de fin** | Comme la référence (panneau ivoire depuis le bas, la prise descend), mais en **verre** avec `VERRE`, puis le logo et les puces en cascade de 2 i. | La fin sèche |

### F.2 Les coups de poing

Ce sont tous des E7 (plein écran, visage couvert). Règles reprises de la v2 : le mot affiché est **dit** (1 à 2 mots), un chiffre n'apparaît que s'il est dit, le bruitage est calé à ±1 image, **pas avant 10 s**, et au moins 1 s de Will seul après chaque coup de poing.

**Ce qui les rend modernes** :
- **Lumière** : aplat en dégradé radial (orangeChaud au centre, orangeProfond aux bords, ou encreDouce → encre), avec un grain de 2 à 3 %.
- **Typographie en relief léger** : le mot géant reçoit **3 ombres empilées** d'orangeProfond (ou d'encre), décalées de 0,004 L vers le bas. C'est une extrusion douce, pas une 3D modélisée.
- **Mise au point** : le mot arrive flou et sur-agrandi (échelle de 1,45 à 1, flou de 0,02 L → 0 en 5 i).
- **Vidéo** quand c'est possible : triangles du duel, mot-fenêtre, mosaïque.
- **Sortie par masque**, pour rendre le visage proprement en 3 i au plus.

---

## G. Les 24 éléments à faire (5 lots pour 5 designers)

**Lecture** : « Entier » veut dire que le visage reste entier, « couvert » qu'il est entièrement couvert. La **surface** est la part de l'image occupée à l'état posé (minimum de 6 % pour tout élément posé sur la prise visible, correction de la critique du 16/10). Les sons existent dans `sons/` (click, drop, ding, eclats, feutre, maximize, minimize, select, tick, vibreur, whoosh-in, whoosh-out, confirmation). Les sons marqués **(à sourcer)** sont à chercher en CC0 (Kenney ou équivalent), **jamais dans une banque payante** [WILL].

**Bilan vidéo : 12 éléments sur 24 contiennent une vraie vidéo** (n° 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 23 et 24), et 2 autres une capture animée (n° 11, et n° 2 en option). Le minimum demandé était de 8.

### Lot A, « Fenêtres sur le visage » (designer 1) : le niveau de la référence, en mieux

| # | Id | Emplacement et taille | Forme et matière | Contenu | Mouvement (entrée → pose → sortie) | Ressort | Durée | Visage | Son |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `fenetre-pivot` | x 0,05-0,86, y 0,12-0,69 (≈ 46 %) | K1, matière C.3, posée à -2,5° | **B-roll** + puce-étiquette qui chevauche le bas-gauche (+6 i) | N1 depuis la droite (rotateY de -38° à 0) → flottement et reflet qui passe à i14 → T1 fouet à gauche | `VERRE`, `PIVOT`, `FOUET` | 1,2-3 s | couvert (Z couvert à i3) | `whoosh-in` / `whoosh-out` |
| 2 | `fenetre-telephone` | x 0,20-0,80, y 0,07-0,70 (≈ 38 %) | K2 : cadre encre avec reflet, coins de 0,07 L | **B-roll vertical**, ou **capture d'appli** qui défile avec un doigt (pastille ivoire à 40 %) qui touche | N2 depuis le bas (rotateX de 28° à 6°, rotateZ de +5° à +3°) → micro-bascule de ±0,6° → rechute vers le bas | `VERRE`, `PIVOT` | 1,5-3 s | couvert | `maximize_004` + `tick_001` au toucher |
| 3 | `fenetre-double` | A : K1 sur le visage, à -3° ; B : 0,44 L × 0,30 H en x 0,50-0,94, y 0,50-0,80, à +5° | K1 + K1, B en plan P2 | **2 B-roll** : deux exemples ou avant/après dits | A en N1 ; B en N4 depuis le coin bas-droit, **8 i plus tard**, avec une secousse de 0,006 L à l'arrêt → B part en premier, A en T1 | `VERRE`, `GLISSER` | 2-3 s | couvert | `whoosh-in` + `drop_001` |
| 4 | `fenetre-plein-cadre` | Du rectangle K1 au plein écran | K4 : les coins passent de 0,045 L à 0 | **B-roll** + grande puce en verre encre en bas | Entre en N1 rapide (Z couvert à i3) → **s'ouvre** jusqu'aux bords en 8 i (`POSER`), voile de vignette → se referme en cercle de 0,3 L vers le coin haut-droit, puis sort (Z découvert en 3 i) | `VERRE`, `POSER`, `FOUET` | 1,5-2,5 s | couvert (E7, pas avant 10 s) | `maximize_006` / `minimize_004` |

### Lot B, « Fenêtres de forme, visage entier » (designer 2) : la vidéo sur le côté

| # | Id | Emplacement et taille | Forme et matière | Contenu | Mouvement | Ressort | Durée | Visage | Son |
|---|---|---|---|---|---|---|---|---|---|
| 5 | `pilule-cote` | Gauche : x -0,03-0,25, y 0,16-0,56 (≈ 11 %), déborde de 11 %. Miroir à droite permis. | K5, à -4° (ou +4° à droite), puce sous la pilule | **B-roll** vertical | N5 dépliage depuis le haut (scaleY) + rotateZ de -12° à -4° → flottement → repliage vers le haut, ou fouet hors cadre | `POSER`, `JAILLIR` | 1,5-3 s | entier | `whoosh-in` (à l'envers à la sortie) |
| 6 | `cercle-epaule` | Droite : centre (0,84 L ; 0,72 H), diamètre de 0,40 L, soit y 0,61-0,83 (≈ 7 %). Miroir à gauche permis. | K6 avec un anneau orange décalé qui tourne de 0,4°/i | **B-roll** carré | N3 depuis le centre (point → cercle) + l'anneau se trace en 9 i (`strokeDashoffset`) → rotation de l'anneau → aspiration vers le bord droit | `POSER`, `JAILLIR` | 1,2-2,5 s | entier | `select_002` + `tick_002` |
| 7 | `bande-video` | Sous le menton : centre à 0,78 H, épaisseur de 0,15 H, à -12°, d'un bord à l'autre (≈ 15 %). Le bord haut reste sous 0,62 H. | K7, liserés ivoire en haut et en bas | **B-roll** paysage qui **défile** latéralement (la source, pas la prise) + 1 mot dit en chip au bout | N4 : la bande entre par la gauche en glissement diagonal, avec fantômes et flou → la vidéo défile → sortie par la droite | `GLISSER`, `FOUET` | 1,2-2 s | entier | `whoosh-in` |
| 8 | `arche-bas` | Bas-gauche : x 0,04-0,54, y 0,62-0,96 (≈ 17 %), sort par le bas | K8 en verre, à +3° | **B-roll** | N2 depuis le bas (rotateX de 20° à 0) → reflet qui passe → rechute | `VERRE`, `PIVOT` | 1,5-3 s | entier | `drop_002` |
| 9 | `blob-video` | Bas-droit : x 0,50-0,98, y 0,64-0,91 (≈ 10 %) | K9, respire de ±3 % sur 1,6 s, anneau orange-voile à 0,01 L | **B-roll** | Morph d'un cercle de 0,06 L en blob (`JAILLIR`) → respiration → se rétracte en cercle et file vers le bord droit | `JAILLIR`, `FOUET` | 1,5-2,5 s | entier | `drop_001` + « bloup » (à sourcer) |

### Lot C, « Cartes en verre » (designer 3) : l'interface qui se construit sur la voix

| # | Id | Emplacement et taille | Forme et matière | Contenu | Mouvement | Ressort | Durée | Visage | Son |
|---|---|---|---|---|---|---|---|---|---|
| 10 | `carte-verre` | Haut, avec la descente de la prise : x 0,08-0,92, y 0,05-0,35 (≈ 25 %) | Carte v3 (§ D.1) | Un contenu de `cartes/` (liste cochée, frise, calendrier, graphique, chat tapé) **sur les mots** | Chute 3D (rotateX de -22° à 0) → halo de la ligne active → remontée en fouet | `VERRE`, `PIVOT`, `FOUET` | 3-8 s | entier (prise descendue) | `drop_003` à l'entrée, `tick` par ligne |
| 11 | `carte-preuve` | Sur le visage : x 0,05-0,86, y 0,12-0,69 (≈ 46 %) | Fenêtre de navigateur en verre (3 pastilles orange et sable, barre d'adresse en verre) | **Capture d'écran animée** : défilement, curseur qui clique, anneau, surlignage de la ligne citée | N1 depuis la gauche (miroir de 1) → défilement et clic sur le mot → T3 poussée par l'élément suivant, ou fouet | `VERRE`, `PIVOT` | 2-4 s | couvert | `click_002` au clic, `whoosh-out` |
| 12 | `notifications-verre` | Bas : x 0,08-0,92, y 0,66-0,92 (≈ 20 %), 3 bulles au plus | Bulles en verre (coins de 0,035 L), icône `Icone` dans une pastille orange | Messages **dits** (« Relance envoyée », « Devis signé »…) | Chaque bulle **monte du bas** en `VERRE` (cascade de 6 i). Les précédentes **reculent en profondeur** (échelle de 0,94 et opacité de 0,7), comme une pile iOS. Sortie : glissement vers le haut et à droite, en cascade | `VERRE` | 2-3 s | entier | `vibreur` + `ding` |
| 13 | `widget-chiffre` | Droite : x 0,75-1,03, y 0,18-0,50 (≈ 9 %), déborde de 10 % | Widget en verre vertical, anneau-jauge orange | **Un nombre dit** : le compteur défile jusqu'au chiffre dit, l'anneau se remplit en même temps (12 i), unité dite dessous | N4 depuis le bord droit + rotateY de 30° à 8° (le widget « regarde » Will) → chiffre posé avec `CLAQUER` → glissement hors cadre | `VERRE`, `CLAQUER` | 1,5-2,5 s | entier | `tick_001` en défilement + `ding` |
| 14 | `carte-retournee` | Gauche : x -0,04-0,26, y 0,18-0,54 (≈ 11 %), déborde de 13 %. Miroir à droite permis. | Carte v3 verticale | **Recto** : le problème dit (icône sable). **Verso** : la solution dite (en-tête orange) | Pivot depuis le bord (rotateY de 90° à 8°) → **retournement de 180°** sur le mot de bascule → fouet hors cadre | `PIVOT`, `FOUET` | 2-3,5 s | entier | `select_001` au retournement |

### Lot D, « La typo vivante » (designer 4)

| # | Id | Emplacement et taille | Forme et matière | Contenu | Mouvement | Ressort | Durée | Visage | Son |
|---|---|---|---|---|---|---|---|---|---|
| 15 | `mot-vertical-bord` **(conservé, rhabillé)** | Gauche : mot de 0,18 L tourné à -90°, de y 0,15 à 0,58, 1ʳᵉ lettre coupée à 20 % par le bord (≈ 10 %). Miroir à droite **à faire** (la critique demande un grand élément à droite). | Lettres en creux (contour encre de 0,004 L) qui se remplissent en `degradeOrange` avec un reflet, grain de 2 % | Le **thème** dit | Balayage du bas vers le haut (7 i), remplissage 3 i plus tard, défilement de 0,2 % L/i → sortie par **fouet vertical** avec flou | `GLISSER`, `FOUET` | 1,5-3 s | entier | `whoosh-in` |
| 16 | `mot-saute` **(conservé, rhabillé)** | Part du sous-titre et atterrit en (0,78 L ; 0,10 H), 0,42 L de large (≈ 6 %), à -8° | Le chip v3 qui grandit (§ E.2), avec ses fantômes et le flou directionnel pendant l'arc | **Le mot fort** de la phrase | La trajectoire en arc parabolique de la v2 est gardée telle quelle (10 i, par la droite de Z) → atterrissage avec `CLAQUER`, reflet qui passe → sortie par aspiration vers le coin | `JAILLIR`, `CLAQUER` | 1-2 s | entier | `select_001` + `drop_003` |
| 17 | `mot-derriere` | Derrière Will : mot de 0,9 à 1,1 L de large, en y 0,08-0,30 (≈ 20 %), **masqué par le détourage** de Will (la tête passe devant) | Montserrat ExtraBold orange en dégradé, ombre douce **portée sur le mur** (décalée vers le bas et la gauche) | Un mot dit, de 8 lettres au plus | Montée lettre par lettre depuis le bas du mot (1 i par lettre, `JAILLIR`) → défilement de 0,15 % L/i → les lettres retombent en cascade | `JAILLIR` | 1,5-2,5 s | **entier** (le mot est derrière) | `whoosh-in` grave |
| 18 | `rafale-trois-mots` **(conservé, rhabillé)** | E7 | 3 aplats en dégradé radial (encre, orange, ivoire), grain de 2 %, mots en relief léger (§ F.2) | 3 mots **dits** à moins de 0,9 s d'écart | Chorégraphie P2 de la v2, avec les **corrections** de la critique : récapitulatif à 3 mots ; sortie en balayage de 5 i au plus, **les mots partant avec l'aplat** | `JAILLIR`, `CLAQUER` | 1,2-2 s | couvert | `click_001`, `click_002`, `drop_002` |
| 19 | `citation-verre` | Droite : x 0,70-1,02, y 0,16-0,36 (≈ 6,4 %), queue arrêtée à Z + 0,03 | Bulle de messagerie en verre ivoire, queue en goutte, petit indicateur « en train d'écrire » (3 points) | Will **cite** quelqu'un (« j'ai pas le temps ») | Les 3 points pulsent pendant 6 i → la bulle grandit depuis la queue avec `JAILLIR` → le texte se tape (2 lettres par image) → fouet vers la droite | `JAILLIR`, `FOUET` | 1,5-2,5 s | entier | `vibreur` court + `tick` |

### Lot E, « Coups de poing » (designer 5) : tous en E7, jamais avant 10 s

| # | Id | Forme et matière | Contenu | Chorégraphie | Ressort | Durée | Visage | Son |
|---|---|---|---|---|---|---|---|---|
| 20 | `duel-video` **(duel-triangles conservé, rhabillé)** | 2 triangles le long de la diagonale bas-gauche → haut-droit. Chacun est une **fenêtre vidéo teintée** (vidéo en duotone : encre à 60 % pour l'un, orange à 55 % pour l'autre). Liseré ivoire lumineux sur la diagonale. | **2 B-roll** (un par côté de l'opposition dite) + mot A et mot B dits | Triangles en glissement depuis leurs coins en **3 i** (correction de la critique), rencontre avec un flash du liseré (1 i), secousse de 0,010 L. Mots en `JAILLIR` à i2 et au mot B. Disque de verre ivoire de 0,13 L avec un éclair au centre. Verdict s'il est dit : le perdant passe en noir et blanc et recule de 0,05 L. Sortie vers les coins en 3 i. | `GLISSER`, `CLAQUER`, `JAILLIR` | 1,5-2,5 s | couvert | `whoosh-in` + `drop_004` |
| 21 | `dalle-claquee` **(conservée, rhabillée)** | Aplat orange en dégradé radial + grain de 2 %. Mot encre en relief léger, en creux qui défile derrière. | 1 à 2 mots dits | P1 de la v2 : mise au point (échelle de 1,45 à 1, flou → 0 en 5 i), 4 traits d'impact ivoire, soulignement tracé. **Nouvelle sortie** : la dalle se referme en **masque circulaire** vers le coin haut-droit (Z découvert en 2 i), au lieu du blob raté. | `CLAQUER`, `POSER` | ≈ 0,9 s | couvert | `drop_004` + « boum » (à sourcer) |
| 22 | `eclat-chiffre` **(conservé, rhabillé)** | Aplat encre en dégradé radial (encreDouce au centre). Éclat orange en dégradé de 1,3 L qui déborde du cadre, avec un halo doux de 0,04 L. Grain de 3 % visible. | **Un chiffre dit** et son unité dite | P5 de la v2 inchangé (défilement jusqu'au chiffre dit, `CLAQUER`, 10 éclats). Les éclats reçoivent un flou directionnel. Sortie par aspiration avec rotation de +90°, en 3 i. | `JAILLIR`, `CLAQUER` | 1-1,4 s | couvert | `eclats.wav` |
| 23 | `mot-fenetre` | Aplat ivoire. Mot dit (8 lettres au plus, ≥ 0,9 L) **dont les lettres sont des fenêtres** sur un B-roll (K10), ombre douce sous les lettres | **B-roll** + 1 mot dit | i0 : les lettres montent en cascade (1 i par lettre, `JAILLIR`), la vidéo joue dedans → i14 : les lettres **s'élargissent** jusqu'à fusionner en plein cadre (masque N3, 8 i) → la vidéo plein cadre se rétracte en K1 et sort en fouet (Z découvert en 3 i) | `JAILLIR`, `POSER`, `FOUET` | 1,5-2,2 s | couvert | `whoosh-in` + `maximize_004` |
| 24 | `mosaique-videos` | Plan incliné en perspective (rotateX de 18°, rotateZ de -8°) portant une grille de 3 × 3 tuiles (K1 à coins de 0,03 L) sur fond encre | **4 à 6 B-roll** de la même scène dite (énumération, « des dizaines de… »), répétés dans la grille | La grille **défile** vers le haut à vitesse constante (0,6 % H/i). Les tuiles arrivent en cascade (2 i). Sur le mot fort, **une tuile sort du plan** (rotateX de 18° à 0, échelle de 1,6) et vient au premier plan avec sa puce. Sortie : le plan bascule vers le haut et part (T1). | `VERRE`, `PIVOT`, `FOUET` | 1,8-2,5 s | couvert | `whoosh-in` + `select_002` |

### G.1 Contrôle de couverture

| Emplacement | Éléments | Total |
|---|---|---|
| Sur le visage, couvert (hors E7) | 1, 2, 3, 11 | 4 |
| Haut (avec descente, ou au-dessus de la tête) | 10, 16, 17 | 3 |
| Gauche | 5, 14, 15 | 3 (+ miroirs à droite) |
| Droite | 13, 19 (+ miroirs de 5, 14, 15) | 2 + 3 |
| Bas | 8, 9, 12 | 3 |
| Diagonale | 7 (bande), 3B (coin), 20 | 3 |
| Autour de la tête / derrière | 16 (arc), 17 (derrière) | 2 |
| Plein écran (E7) | 4, 18, 20, 21, 22, 23, 24 | 7 |

- **Formes non rectangulaires** : 5, 6, 7, 8, 9, 15, 16, 17, 19, 20, 22 et 23, soit **12 sur 24**. Les rectangles sont tous **arrondis, inclinés ou en perspective**, et aucun n'est « droit et plat ».
- **Vidéo réelle** : 12 sur 24. **Capture animée** : 2. **Surface ≥ 6 %** pour tout élément posé sur la prise visible.

---

## H. Ce qu'on garde de la v2, ce qu'on rhabille, ce qu'on abandonne

| Élément v2 | Note de la critique | Décision v3 | Ce qui change |
|---|---|---|---|
| `eclat-chiffre` | 8,5 | **Gardé** (n° 22) | Dégradé radial, halo, grain visible, flou sur les éclats. Chorégraphie et minutage inchangés. |
| `duel-triangles` | 8,0 | **Gardé, enrichi de vidéo** (n° 20) | Triangles = fenêtres vidéo en duotone. Glissement en 3 i, disque de 0,13 L, mots de 0,12 L au minimum. |
| `mot-vertical-bord` | 8,0 | **Gardé** (n° 15) | Dégradé, reflet, 1ʳᵉ lettre coupée, arrêt à 0,58 H, miroir à droite. |
| `dalle-claquee` | 7,5 | **Gardé** (n° 21) | Dégradé radial, relief léger, **sortie par masque circulaire** (plus de blob rectangulaire). |
| `rafale-trois-mots` | 7,5 | **Gardé** (n° 18) | Corrections de la critique, dégradés. |
| `mot-saute` | 7,0 | **Gardé** (n° 16) | Atterrit à droite, chip v3, flou pendant l'arc. |
| `bandes-diagonales` | 7,0 | **Remplacé** par `bande-video` (n° 7) | Le geste est gardé, la bande porte une vidéo. |
| `blob-mot` | 6,0 | **Remplacé** par `blob-video` (n° 9) | |
| `pastille-chiffre` | 6,0 | **Remplacé** par `widget-chiffre` (n° 13) | |
| `bulle-cri` | 6,0 | **Remplacé** par `citation-verre` (n° 19) | |
| `mot-barre-remplace` | 6,0 | **En réserve** | Possible plus tard en chip de verre barré. |
| `tampon-dechirure`, `scotch-postit`, `ticket-dechire-haut`, `autocollant-mot`, `fleche-feutre` | 3,5 à 7,5 | **Abandonnés** | Monde « papier » : c'est le cœur du « vieillot ». |
| `eclat-mot`, `losange-crans`, `badge-roulant`, `gerbe-formes`, `demi-lune-bas`, `traits-vitesse`, `onde-de-choc`, `orbite-lettres` | 4,0 à 6,5 | **Abandonnés** | Pastilles de « modèle gratuit », trop petites, ou en double. |

Le code des éléments gardés est dans `motion-v2/lot2` (DuelTriangles), `lot3` (MotVerticalBord, MotSaute, RafaleTroisMots), `lot4` (EclatChiffre) et `lot5` (DalleClaquee). **On rhabille ces fichiers, on ne les réécrit pas.**

---

## I. Règles de diversité du réalisateur

Ce sont les règles D1 à D13 de la v2 (`STANDARD-DA-V2` § E), **adaptées**. Chaque apparition porte : famille (id), emplacement, **masque ou forme**, **entrée** (N1 à N6 ou mouvement propre), **sortie**, **plan de profondeur** et **source vidéo**. Toutes ces règles sont vérifiables par code.

**V1. Jamais deux fois de suite** : la même famille, le même emplacement, le même masque, la même entrée, la même sortie, le même signe d'inclinaison.

**V2. Fenêtre de 5 apparitions** : au moins 4 emplacements, 4 formes et 4 entrées différents, dont au moins 1 élément latéral.

**V3. Fenêtre glissante de 60 s** :
- tous les emplacements apparaissent au moins une fois (sur le visage, haut, gauche, droite, bas, diagonale) ;
- au moins 3 masques de fenêtre différents ;
- le bas représente au plus 30 % des apparitions.

**V4. Vidéo** (nouveau) :
- **une fenêtre vidéo toutes les 8 à 12 s** (la référence en a une toutes les 9 s), jamais plus de 15 s sans vidéo ;
- au moins **1 fenêtre « visage entier »** (lot B) pour 2 fenêtres « couvert » ;
- une même source vidéo jamais deux fois dans la vidéo ;
- chaque fenêtre dure de 1,2 à 3,0 s.

**V5. Un seul monde** (nouveau) :
- aucun papier, tampon, scotch, autocollant ni feutre ;
- toutes les surfaces sont en **verre ivoire**, en **dégradé orange**, en **verre encre** ou en **vidéo** ;
- 1 seule direction de lumière (du haut), donc **toutes les ombres tombent vers le bas**.

**V6. Profondeur** (nouveau) : chaque élément a **au moins 2 indices de profondeur** parmi : ombre douce en couches, perspective à l'entrée, mise au point, flou de mouvement, parallaxe P2, chevauchement d'un autre objet.

**V7. Rectangles** : au plus 30 % de rectangles **posés à plat et à 0°**. Les cartes et fenêtres K1 inclinées ou en perspective ne comptent pas dans ce quota.

**V8. Asymétrie et taille** (reprises de D5 et D6) :
- 60 % des éléments sont inclinés de 2 à 8° à l'état posé ;
- 30 % au plus sont centrés sur l'axe ;
- on alterne gauche et droite ;
- aucun élément sur la prise visible ne fait moins de 6 % de l'image, et 1 sur 3 dépasse 12 % ;
- au moins un « grand » toutes les 10 s.

**V9. Ouverture** :
- de 0 à 0,8 s : seulement les sous-titres ;
- **de 0,8 à 2,0 s : un premier élément « entier »**, choisi parmi `pilule-cote` (vidéo dès les 2 premières secondes), `mot-saute`, `widget-chiffre` (si un nombre est dit) et `citation-verre` ;
- **rien sur le visage avant 5,0 s** [WILL] ;
- aucune carte avant 8 s ;
- aucun E7 avant 10 s.

**V10. Coups de poing** (repris de D10) :
- le 1er entre 10 et 16 s, puis de 18 à 30 s d'écart ;
- 3 ou 4 par 90 s, sans répéter de type dans une vidéo ;
- le dernier tombe au moins 8 s avant la fin ;
- au moins 1 s de Will seul après chacun, et jamais deux E7 de suite.

**V11. Cadence** : un événement toutes les 1 à 2,5 s, jamais plus de 3 s sans rien. Les sous-titres comptent, mais ne suffisent pas plus de 2 événements de suite.

**V12. Sons** : jamais le même fichier deux fois de suite, et un son représente au plus 30 % des bruitages. **Aucune musique.**

**V13. D'une vidéo à l'autre** : le 1er élément et le 1er coup de poing diffèrent de ceux des 3 vidéos précédentes. Chaque lot est présent au moins une fois par vidéo de plus de 45 s.

**V14. Charge de rendu** (nouveau) : 2 couches de verre au plus à l'écran, et **3 vidéos au plus** jouées en même temps. Seul le n° 24 a une dérogation, à 6.

**Échec bloquant** (le plan n'est pas rendu) : V1, V3, V4, V5, V9, V10 et toute violation de visage.

---

## J. Grille de critique (sur 10)

### J.1 Règle absolue : on juge un EXTRAIT VIDÉO, jamais une image fixe

Pour chaque élément, le designer livre :
1. un **extrait de 2 s** avec le son, sur la **prise par défaut** (yeux à 0,34 H, sans descente sauf pour le haut, sans image agrandie) ;
2. le **même extrait au ralenti à 25 %** ;
3. une **bande de 6 images** (i0, i2, i4, i8, posé, sortie), **pour mémoire seulement**.

Pour chaque lot : un **enchaînement de 15 s** qui respecte V1 à V11, et un **côte à côte de 15 s** avec un passage de la référence de même nature (fenêtre contre fenêtre, carte contre carte), affiché **à la taille d'un téléphone**.

**Une note donnée sans avoir regardé l'extrait est nulle.** Le critique cite l'image précise (« i4 : … ») et le moment de l'extrait (« 0,6 s : … »).

### J.2 Éliminatoires (un seul suffit pour refaire l'élément, sans note)

1. **Il ne fait pas moderne fin 2026.** Le critique répond par oui ou par non, en le justifiant par ce qu'il voit dans l'extrait. Il répond **non** si l'élément utilise une matière abandonnée (§ H), une ombre dure décalée, un aplat sans lumière hors des coups de poing, ou un mouvement plat sans aucun indice de profondeur (V6), ou s'il ressemble à un modèle gratuit.
2. **Il n'est pas au niveau de la référence.** Sur le côte à côte à taille de téléphone, il paraît moins net, moins propre, moins lumineux ou moins « produit » que l'équivalent de la référence.
3. Visage à moitié caché à l'état posé, ou plus de 3 images de visage partiel en transition. Un élément « entier » qui entre dans Z, même pendant sa trajectoire.
4. **Le moindre mouvement ou zoom de la prise.**
5. Un chiffre ou un mot affiché que Will n'a pas dit, « Villeexemple », ou une couleur hors charte et hors `NUANCES`.
6. Un texte coupé par erreur, ou plus petit que 26 px à 1 080 de large.
7. Une fenêtre qui montre une photo fixe, ou une vidéo sans rapport littéral avec le mot dit.
8. Un `.tsx` sans `import React`, ou la signature d'`Icone` modifiée.

### J.3 Notation

| # | Critère | Points | Comment juger |
|---|---|---|---|
| 1 | **Énergie et physique** : élan, dépassement visible, arrêt net, sortie vive | 2 | Extrait à vitesse réelle, puis à 25 % : le ressort doit se voir. |
| 2 | **Matière et lumière** : verre, dégradé, reflet qui passe, ombres douces cohérentes (une seule lumière) | 1,5 | Extrait plein écran, image par image sur l'arrivée au repos. |
| 3 | **Profondeur** : au moins 2 indices (V6), perspective lisible à l'entrée | 1 | Ralenti à 25 %. |
| 4 | **Vidéo** (si l'élément en porte une) : littérale, qui bouge vraiment (3 à 35 %), bien cadrée dans la forme, sans zoom. Sinon, contenu qui se construit sur les mots à ±0,2 s. | 1,5 | Extrait avec le son. |
| 5 | **Lisible en 0,5 s** à la taille d'un téléphone | 1 | Extrait réduit à 30 %. |
| 6 | **Singularité** : silhouette et geste différents des 23 autres | 1 | Test de silhouette de la v2 (rapport intersection / union ≤ 60 %). |
| 7 | **Fidèle à sa fiche** : emplacement, taille ≥ 6 %, masque, ressort | 0,5 | Cotes du § G. |
| 8 | **Marque** : reconnaissable comme Axion-IA (orange, ivoire, encre, Montserrat) sans le logo | 0,5 | Question posée au critique à l'aveugle. |
| 9 | **Micro-vie et sortie** : jamais plus de 0,7 s immobile, sortie autre qu'un fondu | 0,5 | Différence de pixels d'une image à l'autre. |
| 10 | **Bruitage** calé à ±1 image et adapté au geste | 0,5 | Écoute. |
| | **Total** | **10** | |

**Seuils** :
- **8,5 ou plus** : montré à Will (seuil relevé : on vise « exceptionnel ») ;
- de 7 à 8,4 : corrections chiffrées, puis nouvelle critique **sur un nouvel extrait** ;
- moins de 7 : refait.

### J.4 Ce que Will reçoit

Pas de planche fixe. Il reçoit **un lien du studio** (« plus de Drive », ordre de Will) avec :
- les **5 enchaînements de 15 s** ;
- les **5 côte à côte** avec la référence ;
- un **montage de 45 s** qui enchaîne les 24 éléments sur sa prise.

---

## K. Ce qui reste incertain

1. **Le « moderne 2027 » n'est sourcé par personne.** Le verre et la profondeur sont sourcés pour 2025-2026 (Apple, blogs). Le reste est un pari, jugé par la seule comparaison côte à côte et par Will.
2. **Coût du verre** (`backdrop-filter`) en rendu sans tête : à mesurer sur un enchaînement de 15 s. Il y a un repli « faux verre » (§ D.6).
3. **Détourage pour `mot-derriere`** (n° 17) : il existe dans le générateur « monteur », mais n'est pas vérifié pour celui-ci (coût, qualité des cheveux, calcul dans le cloud). Si ce n'est pas faisable, le mot passe **au-dessus** de la tête, sans chevauchement.
4. **Voile encre sur la prise** autour d'une fenêtre qui couvre le visage (§ D.4) : **à valider par Will**, puisque c'est un effet sur sa prise.
5. **Approvisionnement vidéo** : 12 éléments en vidéo, dont la mosaïque (4 à 6 extraits), pèsent sur le circuit Pexels/Pixabay. Il faut demander des **formats par masque** (paysage, carré, 9:19,5) et compter le temps de préparation.
6. **Ressorts** : les dépassements et temps de pose sont théoriques et doivent être mesurés avec `measureSpring`. Les perspectives sont choisies à l'œil.
7. **Tests de visage en 3D** : il faut projeter le contour réel du masque (avec rotateX, rotateY et perspective) pour tester Z. Le test actuel sur rectangle ne suffit plus.
8. **Casse des sous-titres** : capitales gardées. L'option minuscules grasses n'est à montrer que sur un extrait, si Will le veut.

---

## L. Sources de la recherche du 16/10

- Apple, communiqué Liquid Glass (juin 2025, repris par Nasdaq) : https://www.nasdaq.com/press-release/apple-introduces-delightful-and-elegant-new-software-design-2025-06-09
- Critique de lisibilité du verre : https://pxlnv.com/blog/on-liquid-glass/
- Design Milk, Liquid Glass en couches : https://design-milk.com/apple-returns-to-a-layered-software-design-with-liquid-glass-interface/
- Styles de motion 2026 (parallaxe, 3D UI, traînées, avertissement sur la 3D gratuite) : https://trydemotion.com/blog/trending-motion-graphic-styles
- Tendances motion 2026 (texture, fait main) : https://blog.videobolt.net/post/top-motion-graphics-trends-2026
- Verre en 2026 et lisibilité : https://www.orizon.co/blog/glassmorphism-in-2026-how-to-use-frosted-glass-without-killing-ux
- UI 2026 (« glassmorphism 2.0 », spatial) : https://superfiles.in/ui-ux-design-trends-2026-spatial-glassmorphism.php
- B-roll qui « a un rôle », preuves plutôt que des ambiances : https://jupitrr.com/how-to/add-b-roll-to-talking-head-videos
- Texte derrière la personne (vendeur) : https://www.capcut.com/resource/how-to-put-text-behind-a-person-in-capcut
- Remotion `spring()` : https://www.remotion.dev/docs/spring
- Remotion, flou de mouvement : https://www.remotion.dev/docs/motion-blur
- Remotion, GPU en mode sans tête : https://www.remotion.dev/docs/gpu
- Chromium, coût des filtres d'arrière-plan : https://grida.co/docs/wg/research/chromium/effect-optimizations
- Synthèse précédente (15 et 16/10) : `TENDANCES-MOTION-2026-10-16.md`

---

## M. Résumé (15 lignes)

1. La v2 faisait vieillot parce qu'elle avait pris le **monde du papier** (tampon, scotch, autocollant), alors que la référence est un **monde d'interface et de vidéo**.
2. La v2 n'avait **aucune vidéo**. La référence a 9 fenêtres vidéo en 80 s, une toutes les 9 s [MESURÉ].
3. La v2 n'avait **ni lumière ni profondeur** (aplats plats, tout en 2D) et des éléments trop petits.
4. La référence se distingue par de **grandes fenêtres vidéo** qui couvrent franchement le visage, des **cartes qui se construisent sur la voix**, un rendu clair et dense, et un seul monde.
5. Ce qui la date : l'**ombre dure** et le **contour épais** néo-brutalistes, le cyan plat, les fausses lignes grises et des sous-titres à gros contour.
6. La v3 garde son monde et le modernise : **verre ivoire opaque, dégradés orange avec reflet, ombres douces en 3 couches, perspective à l'entrée, mise au point et flou de mouvement**.
7. Le moderne de 2026 est sourcé pour le verre et la profondeur (Apple, Liquid Glass) et pour les ressorts (doc Remotion). Le reste est SUPPOSÉ, et le juge reste le côte à côte avec la référence.
8. Le système de fenêtres compte **10 masques** (carte inclinée, téléphone, double, plein cadre, pilule, cercle, bande, arche, blob, mot-fenêtre) et **6 entrées** à ressorts nommés (`VERRE`, `PIVOT`, `FOUET`…).
9. Les **24 éléments** sont répartis en 5 lots : fenêtres sur le visage, fenêtres de forme à visage entier, cartes en verre, typo vivante, coups de poing.
10. **12 éléments sur 24 contiennent une vraie vidéo** et 2 une capture animée. Tout élément posé sur la prise visible occupe au moins 6 % de l'image.
11. **6 éléments v2 sont gardés et rhabillés** : eclat-chiffre, duel-triangles (désormais en vidéo), mot-vertical-bord, dalle-claquee, rafale-trois-mots, mot-saute. Le papier est abandonné.
12. Les sous-titres gardent leur moteur et changent de matière : contour fin, ombre douce, pilule de surlignage qui grandit, chip orange en dégradé.
13. Les règles de diversité (V1 à V14) ajoutent une **fenêtre vidéo toutes les 8 à 12 s**, un **seul monde**, **2 indices de profondeur** par élément et un plafond de charge de rendu.
14. Dans la grille /10, **« moderne fin 2026 » et « au niveau de la référence » sont éliminatoires**. Tout se juge sur **extrait vidéo et côte à côte**, jamais sur image fixe. Le seuil pour montrer à Will est de 8,5.
15. À valider : le coût de rendu du verre, le détourage du n° 17, le voile sur la prise et la mesure réelle des ressorts.
