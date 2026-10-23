# Standard artistique « v2 énergie » : Face caméra animée (16/10/2026)

*Directeur artistique. Ce document remplace la partie « mouvement » de `CARTES-20-PREMIUM-2026-10-15.md` (§ 2.5) et complète `DIVERSITE-MOTION-2026-10-15.md` (ses règles R1 à R8 restent valables ; on ajoute ici les axes EMPLACEMENT, FORME et MOUVEMENT). Aucun code n'a été modifié.*

## 0. Comment lire ce document

Chaque affirmation porte une étiquette :

- **[SOURCÉ]** : vient de la recherche du jour (`TENDANCES-MOTION-2026-10-16.md` § A). Les sources sont des blogs d'éditeurs d'outils et ne parlent pas de 2027 (limite signalée dans ce document).
- **[WILL]** : décision ou retour de Will (`REPRENDRE.md` § 2 et § 5 ter). Ces points ne se discutent pas.
- **[EXISTANT]** : déjà dans le code ou dans les documents du 15/10.
- **[CHOIX DA]** : mon choix artistique. Il est à juger sur planche par Will, et aucune source ne le prouve.

Unités : **L** = fraction de la largeur de l'image, **H** = fraction de la hauteur (image 1080 × 1920, donc 0,01 L = 10,8 px). Le temps est en **images à 30 i/s**. **i0** désigne l'image où Will prononce le mot qui déclenche l'élément.

Contraintes fixes [WILL] :
- charte : ivoire #E9DCC8, encre #110A05, orange #B44F29, sable #BFA88B et les nuances dérivées de `NUANCES` ; polices Montserrat ExtraBold et Inter ;
- aucune musique, bruitages obligatoires ;
- **aucun zoom ni mouvement sur la prise** ;
- un objet cache le visage **entier ou rien** ;
- **rien ne couvre le visage avant 5 s** ;
- aucun chiffre que Will n'a pas dit, jamais « Villeexemple » ;
- la signature d'`Icone` ne change pas, et chaque `.tsx` importe React.

---

## A. Diagnostic franc des planches provisoires

### A.1 Planche « motion 12 » (`motion-12-provisoire/planche-motion-provisoire.jpg`)

| Constat | Mesure sur la planche |
|---|---|
| **Tout est en bas, au centre.** | 8 vignettes montrent Will. Dans 6 d'entre elles, l'élément est dans la moitié basse, entre la poitrine et les mains : carte de France, chiffre 120 %, notifications, ruban, jauge, trait sous le sous-titre. **Aucun** élément dans la colonne gauche, **un seul** en haut (horloge), **aucun** en diagonale. |
| **Tout est droit.** | Seul le ruban est incliné, d'environ 4°. Tous les autres sont à 0°, posés sur l'axe vertical du cadre ou presque. Une composition symétrique et droite paraît **calme**, alors que Will demande de l'énergie. |
| **Les éléments de côté sont minuscules.** | L'horloge fait environ 3 % de l'image, les bulles environ 2 %. À la taille d'un téléphone, Will ne les voit pas : d'où « pas de motion design sur le côté ». |
| **L'orange est rare sur les plans où l'on voit Will.** | Hors plein écran, l'orange occupe moins de 3 % de l'image (des traits et des contours). L'énergie de la charte n'est utilisée que sur les 4 plein écran. |
| **Les 4 plein écran marchent le mieux**, mais ils se ressemblent. | FUITE, APPEL et AVANT/APRÈS sont tous des aplats rectangulaires avec un mot centré et un motif de mots répétés au fond. Ce sont les mêmes gestes, seule la couleur change. |
| Petits défauts | La carte de France a un encart « Corse » carré qui fait bug. Le chiffre 120 % est posé sur la poitrine, au centre exact. |

### A.2 Planche « 20 cartes » (`cartes-20-provisoire/planche-cartes-provisoire.jpg`)

| Constat | Mesure |
|---|---|
| **« Toujours carré »** | 20 cartes sur 20 sont des rectangles de 0,81 L à contour encre et ombre dure. |
| **Toujours au même endroit** | 19 sur 20 sont posées dans la même bande haute, entre 0,03 et 0,25 H, avec la prise descendue dessous. Le visage est toujours dans les 60 % du bas. |
| **Toujours droites, toujours de la même couleur** | 20 sur 20 sont à 0°. 17 sur 20 ont le même bandeau orange avec « n/4 ». Le fond est ivoire partout. |
| Une seule exception | Le badge « ASSISTANTE » est le seul à casser la silhouette, grâce à son cordon, et c'est d'ailleurs le plus vivant de la planche. |
| Le contenu est réussi | Les cartes sont plus soignées que celles du 14/10. Le problème n'est pas leur qualité, c'est que **ce sont 20 variations d'un seul objet**. |

### A.3 Le mouvement (lu dans le code, puisque les planches sont des images fixes)

- Dans `mouvement.ts`, le commentaire d'en-tête dit **« Une seule famille : entrée rapide avec léger rebond »** [EXISTANT]. Tout entre avec `Easing.back(1.4)`, de la même amplitude et à la même vitesse. L'œil reconnaît le geste au bout de 3 apparitions.
- Le code ne contient ni secousse de l'élément à l'impact, ni rotation, ni trajectoire courbe, ni éclatement, ni sortie différenciée.
- **Les planches elles-mêmes desservent le mouvement** : une image fixe ne montre ni l'élan ni le rebond. [CHOIX DA] Dorénavant, chaque élément est montré en **bande de 5 images** (i0, i2, i4, i8, posé) **et** en extrait vidéo de 2 s (voir § F.3).

### A.4 La cause profonde

Le réalisateur choisit **un contenu** (quelle information montrer), jamais **un geste** (où, quelle silhouette, quel mouvement). Toutes les familles ont été dessinées en « interface propre » : une boîte, droite, centrée. **La v2 fait de l'emplacement, de la forme et du mouvement trois choix obligatoires, contrôlés par des règles.**

---

## B. La grammaire : 7 emplacements × 12 formes × 11 mouvements

### B.1 Géométrie de référence (lue dans `cadrage.ts`) [EXISTANT]

- Yeux à 0,34 H (`PRISE_PAR_DEFAUT`). Boîte du visage, des cheveux au menton : **y 0,14 → 0,56 H**, **x 0,27 → 0,73 L** (largeur de visage 0,38 L × 1,2).
- **Zone interdite Z** = boîte du visage + marge de 0,02. Un élément « visage entier » n'y entre **jamais**, même en passant pendant sa trajectoire.
- Sous-titres : centrés vers 0,64 H. La **bande S** (0,60 → 0,68 H) reste libre, sauf pour l'élément `mot-saute`, qui en part.
- Ces chiffres valent pour la prise par défaut. Pour chaque prise, ils sont recalculés depuis `plan.prise` (yeux, centreX, largeurVisage), et les emplacements ci-dessous se déduisent de Z, pas de valeurs figées.
- ⚠️ **Format 4:5 (fil LinkedIn et Facebook)** : la zone sûre commune aux formats 9:16 et 4:5 dépend du recadrage du studio, qui n'est pas encore vérifié. En attendant [CHOIX DA] : rien d'essentiel au-dessus de 0,04 H ni au-dessous de 0,92 H. **À contrôler** au branchement (lot I).

### B.2 Les 7 emplacements

| Code | Emplacement | Zone (prise par défaut) | Règle de dessin [CHOIX DA] |
|---|---|---|---|
| **E1** | **Haut** | y 0,02 → 0,12 H sur toute la largeur, plus les deux coins jusqu'à 0,20 H en dehors de x 0,25 → 0,75 | Un élément haut de plus de 0,10 H **utilise la descente existante** de la prise (comme une étiquette, [WILL] « garde la descente »). Sinon, il tient dans la bande. |
| **E2** | **Gauche** | x 0,02 → 0,25 L, y 0,16 → 0,58 H | Peut **déborder du cadre** à gauche (jusqu'à 30 % de l'élément coupé par le bord) : c'est ce qui donne l'impression que « ça vient de dehors ». |
| **E3** | **Droite** | x 0,75 → 0,98 L, y 0,16 → 0,58 H | Même règle, en miroir. |
| **E4** | **Bas** | y 0,69 → 0,92 H sur toute la largeur | Ne remonte jamais dans la bande S. Il peut monter « depuis le bas du cadre ». |
| **E5** | **Halo** (autour de la tête) | Couronne autour de Z : de Z + 0,02 jusqu'à Z + 0,14 | Les éléments **tournent autour** de la tête ou **en partent**. Rien n'entre dans Z. |
| **E6** | **Diagonale** | Bande ou trajectoire inclinée de 12 à 35° : bas-gauche → milieu-droite **sous le menton** (y > 0,66 H), ou coin bas-droit → côté droit | C'est la trajectoire (l'entrée en diagonale) ou la forme (une bande inclinée) qui fait l'emplacement. Elle ne croise jamais Z. |
| **E7** | **Plein écran** | Tout le cadre | Il couvre **tout** le visage. Il n'apparaît **jamais avant 10 s** ([EXISTANT] R1e). Seuls les coups de poing et les panneaux couvrants l'utilisent. |

**Tolérance de transition** [EXISTANT, `MotGeant.tsx` : « le visage n'est à moitié visible que 2 images »] : un élément E7 qui **entre ou sort** peut laisser le visage partiellement couvert pendant **au plus 3 images d'affilée**, à condition d'être en mouvement. À l'état posé, le visage est toujours entier ou entièrement couvert. *À confirmer par Will : je la juge invisible à l'œil, mais c'est sa règle.*

### B.3 Les 12 formes

Les formes 1 à 11 sont **non rectangulaires**. Seule la forme 12 est le « rectangle à contour » (cartes, fenêtres), et elle est soumise à un quota (§ E).

| Code | Forme | Dessin précis [CHOIX DA, sauf mention] |
|---|---|---|
| **F1** | Cercle / pastille | Disque plein orange ou encre, de 0,12 à 0,24 L de diamètre. Contour encre de 0,006 L, ombre dure décalée de (0,008 ; 0,008) L. Contenu : un mot ou un chiffre dit, ou une icône `Icone` à 0,075 L. |
| **F2** | Ruban en biais | Bande pleine de 0,07 à 0,10 H d'épaisseur, inclinée de 8 à 18°. Les extrémités sont coupées en **queue d'aronde** (encoche en V de 0,03 L) ou sortent du cadre. Reflet ivoire de 2 px sur le bord haut. |
| **F3** | Autocollant découpé | La silhouette suit le texte ou l'icône avec une **marge de découpe ivoire de 0,014 L** (le « bord blanc » des autocollants, en ivoire pour rester dans la charte) et une ombre dure encre de 0,006 L. Incliné de ±6 à ±12°. Un coin peut se décoller (triangle sable-clair de 0,03 L). [SOURCÉ : tendance « autocollants, collage »] |
| **F4** | Flèche dessinée | Trait de feutre orange de 0,012 à 0,016 L d'épaisseur, en courbe de Bézier avec une seule inflexion, pointe ouverte (deux traits de 0,05 L). L'épaisseur varie de ±15 % le long du trait, avec un léger tremblement de 0,6 px (aléa fixé par `random(seed)`). [SOURCÉ : « flèches dessinées à la main »] |
| **F5** | Éclat / étoile | Étoile de 12 à 16 branches, dont le rayon intérieur vaut 0,72 fois le rayon extérieur, avec des branches **alternées longues et courtes**. Orange plein, contour encre de 0,005 L. Peut contenir un mot. |
| **F6** | Blob organique | Contour fermé à 8 points de contrôle, chaque rayon à ±12 % d'un cercle. Il « respire » ensuite (§ M-micro). Orange, sable-clair ou encre-douce. |
| **F7** | Aplat plein écran | Tout le cadre, orange, encre ou ivoire, **avec un grain de 4 à 6 %** (`feTurbulence` fixe). Il n'est jamais nu : il porte toujours un mot ou un objet. |
| **F8** | Bande diagonale | Deux à trois bandes parallèles de couleurs différentes, inclinées de 12 à 35°, qui traversent **toute la largeur** et sortent par les deux bords. |
| **F9** | Tampon | Cercle ou rectangle arrondi à **double contour** orange (0,010 L et 0,004 L, écartés de 0,008 L), mot en capitales. **Texture d'encre** : masque de bruit qui retire 15 à 20 % de l'encre en taches. Incliné de -8 à -14°. |
| **F10** | Scotch / papier déchiré | Papier ivoire ou sable-clair à **bord déchiré** (polyligne en dents irrégulières de 0,006 à 0,018 L, avec un liseré de fibres ivoire de 3 px). Bandes de scotch : rectangles ivoire à 70 % d'opacité, de 0,12 × 0,035 L, posés de travers à ±25°, aux bords courts dentelés. [SOURCÉ : « découpes papier, scotch »] |
| **F11** | Typographie seule | Pas de contenant : le mot **est** la forme. Montserrat ExtraBold de 0,12 à 0,30 L, avec contour encre de 0,004 L et ombre dure, ou bien en creux (contour seul). [SOURCÉ : « typographie animée = motif de 2026 »] |
| **F12** | Rectangle à contour | Les 20 cartes, les fenêtres et les étiquettes actuelles [EXISTANT]. **Quota : au plus 35 % des apparitions** (§ E). |

### B.4 Les 11 mouvements et leurs courbes

**Ressorts Remotion nommés** [CHOIX DA] : `spring({ frame, fps: 30, config: { damping, stiffness, mass } })`. Le dépassement et le temps de pose donnés ici sont **calculés en théorie** (oscillateur amorti). Ils sont **à confirmer avec `measureSpring`** avant de figer.

| Nom du ressort | damping | stiffness | mass | Dépassement | Posé en | Sert à |
|---|---|---|---|---|---|---|
| `JAILLIR` | 12 | 200 | 0,7 | ≈ 16 % | ≈ 14 i | Apparitions vives |
| `CLAQUER` | 18 | 420 | 0,5 | ≈ 8 % | ≈ 7 i | Impact sec (en partant d'une échelle > 1) |
| `POSER` | 20 | 170 | 1 | ≈ 2 % | ≈ 12 i | Dépliages, éléments lourds |
| `GLISSER` | 26 | 260 | 0,8 | ≈ 0 % | ≈ 8 i | Translations rapides sans rebond |
| `TOUPIE` | 9 | 140 | 0,8 | ≈ 23 % | ≈ 21 i | Rotations élastiques |
| `BALANCER` | 5 | 90 | 1 | ≈ 42 % | ≈ 48 i | Pendules (papier suspendu, badge) |

Les trois courbes existantes (`rebond`, `progression`, `sortie`) restent **intactes**. Les ressorts ci-dessus s'**ajoutent** à `mouvement.ts`.

| Code | Mouvement | Recette exacte (30 i/s) |
|---|---|---|
| **M1** | **Jaillissement élastique** | i-1 : un **pré-éclat** apparaît (point orange de 0,03 L à l'emplacement, 1 image) [SOURCÉ : « micro-récompense », une seule source ; dosage = CHOIX DA]. Entre i0 et i14, l'échelle passe de 0 à 1 avec `JAILLIR` et la rotation de ±15° à l'angle final avec le même ressort. L'opacité passe de 0 à 1 en 2 i. |
| **M2** | **Balayage** | Révélation par masque (`clipPath: inset`) de i0 à i7, courbe `Easing.bezier(0.83, 0, 0.17, 1)`. **Double balayage** : une bande de couleur de 0,04 L précède le bord du masque avec 2 i d'avance, puis s'efface. Le sens est imposé par l'emplacement (de l'extérieur du cadre vers l'intérieur). |
| **M3** | **Rotation** | Entrée en vrille : rotation de -90° (ou +90°) vers l'angle final avec `TOUPIE`, et échelle de 0,6 à 1 avec `JAILLIR`. **Variante par crans** : quarts de tour de 90° toutes les 6 i, chaque cran avec `CLAQUER` et un « clic » sonore. |
| **M4** | **Claquement avec secousse de l'élément** | Échelle de 1,40 à 1 avec `CLAQUER` entre i0 et i7. À i3, **4 traits d'impact** (encre, 0,05 L) jaillissent aux coins en 2 i, puis disparaissent à i7. **Secousse de i3 à i11** : dx(k) = A · e^(−k/3) · sin(2πk/3), avec A = 0,012 L, **appliquée à l'élément seul et jamais à la prise** [WILL]. Au plus une secousse par tranche de 4 s. |
| **M5** | **Cascade décalée** | N sous-éléments, **2 i de décalage** entre chacun (1 i au-delà de 6 éléments). *Écart assumé avec le « 40-60 ms » du 15/10, impossible à tenir à 30 i/s.* Chaque sous-élément utilise M1 ou M8 à 60 % d'amplitude. Le dernier reçoit une secousse (M4, A = 0,006 L). |
| **M6** | **Tracé de trait** | `strokeDashoffset` de la longueur totale à 0, de i0 à i9, courbe `Easing.bezier(0.33, 0, 0.2, 1)`. La pointe ou la fin apparaît à i9 avec `JAILLIR` sur 6 i. Le tremblement de 0,6 px reste actif tant que le trait est visible. |
| **M7** | **Éclatement** | 8 à 12 éclats (petits F5, triangles et pastilles aux couleurs de la charte). L'angle est réparti régulièrement, avec un aléa fixé par `random(seed)`. Vitesse initiale de 0,025 à 0,045 L/i, frein de 0,86 par image, gravité de 0,002 H/i². Chaque éclat tourne de 15 à 40°/i. Opacité à 1 jusqu'à i8, puis 0 à i14. Aucun éclat n'entre dans Z. |
| **M8** | **Glissement diagonal** | Translation en diagonale (de 12 à 35°) avec `GLISSER`. Pendant les 3 premières images : **étirement de 6 %** dans le sens du mouvement [EXISTANT, standard du 15/10] et **2 copies fantômes** à 30 % puis 15 % d'opacité, aux positions i-1 et i-2. Arrêt net avec une secousse légère (A = 0,006 L). |
| **M9** | **Balancier** | L'élément est pendu à un point fixe hors du cadre ou à une attache. L'angle passe de ±18° à l'angle de repos avec `BALANCER`. Pendant la pose, une micro-oscillation de ±1° sur une période de 1,6 s. |
| **M10** | **Déchirure / dépliage** | *Dépliage* : échelle verticale de 0 à 1 depuis le bord d'attache avec `POSER`, l'ombre grandit avec l'élément. *Déchirure (sortie)* : 2 moitiés le long d'une ligne en dents de scie, translation de ±0,12 L/i en accélération (`Easing.in(cubic)`) et rotation de ±6°. Le visage est dégagé **dès la 2ᵉ image**. |
| **M11** | **Morph / roulement** | *Morph* : interpolation de chemin d'un cercle vers un blob (F6) avec `JAILLIR`, ou d'un aplat vers un blob en sortie. *Roulement* : translation `GLISSER`, et rotation = distance parcourue ÷ rayon (en radians). L'objet roule réellement. |

**Micro-vie pendant la pose** [EXISTANT, N3 du 15/10, conservée] : jamais plus de 0,7 s d'immobilité. Selon la forme, une seule des micro-vies suivantes :
- rotation continue de 0,5 à 1°/i (F5, F1 à texte circulaire) ;
- respiration de ±2 % (F1) ;
- ondulation des points de contrôle de ±3 % sur une période de 1,6 s (F6) ;
- oscillation de ±1° (F3, F9, F10) ;
- défilement de 0,2 % L par image (F8, F11).

**Sorties** (de 3 à 6 i, **jamais un simple fondu**) [CHOIX DA] :
- **aspiration** : échelle vers 0, rotation de +60°, `Easing.in(cubic)` ;
- **envol** : anticipation de 2 i à -3 %, puis départ hors du cadre ;
- **balayage inverse** ;
- **déchirure** ;
- **éclatement** (M7 à la place de l'objet).

**Deux éléments consécutifs ne sortent jamais de la même façon.**

### B.5 Ce qui va ensemble [CHOIX DA]

- F7 (aplat) n'est autorisé qu'en E7.
- F8 (bande diagonale) n'est autorisée qu'en E6 ou E4.
- F12 (rectangle) n'est autorisé qu'en E1 (avec descente de la prise) ou en couvrant tout le visage, comme aujourd'hui [EXISTANT].
- Les formes F1, F3, F5, F6, F9, F11 vont **partout sauf dans Z**.
- Tout élément d'un emplacement latéral (E2, E3) mesure **au moins 6 % de l'image** (fini les horloges de 3 %), et 1 sur 2 déborde du cadre.

---

## C. Les 5 moments « coup de poing » (chorégraphie image par image)

[WILL] Le coup de poing type est un aplat orange plein écran avec un mot géant, puis le retour sur Will. [SOURCÉ] La recherche confirme les aplats francs, les transitions sèches et la typographie en pièce centrale. Les 5 variantes ci-dessous et leurs chorégraphies sont des [CHOIX DA].

Règles communes :
- le mot affiché est **un mot dit par Will** (1 ou 2 mots, 12 lettres au plus) ;
- un chiffre n'apparaît que s'il est dit ;
- grain de 4 à 6 % sur l'aplat ;
- bruitage calé sur i0 à ±1 image.

### P1 « Dalle claquée » (aplat orange, mot géant)

| Image | Ce qui se passe |
|---|---|
| i-1 | Pré-éclat : point orange de 0,04 L au centre. |
| i0 | **Coupe franche** : aplat orange plein écran. Son : `drop_004` + « boum » (à sourcer). |
| i0 → i5 | Mot encre de 0,82 L de large, incliné de -4°, échelle de 1,45 à 1 avec `CLAQUER`. |
| i4 → i8 | 4 traits d'impact ivoire aux coins du mot, puis plus rien. |
| i4 → i12 | Secousse de la dalle et du mot ensemble (A = 0,010 L). |
| i5 → i14 | Un soulignement encre se trace sous le mot (M6). Derrière, le même mot en creux, couleur orange-profond, défile de 0,3 % L par image. |
| i19 → i22 | Anticipation : le mot gonfle à 1,04. |
| i22 → i26 | Sortie : le mot est aspiré vers le coin haut-droit (échelle 0,2, rotation de +20°). **La dalle se rétracte en blob** (M11) de 0,3 L et file vers le même coin. Visage partiellement couvert de i23 à i25 (tolérance de 3 i). |
| i27 → +30 i | Will seul (sous-titres seulement) : **respiration d'au moins 1 s**. |

Durée : environ 0,9 s. Pour : la phrase choc, un basculement (« fuite », « stop »).

### P2 « Rafale de trois mots »

Pour une énumération de 3 mots dits à moins de 0,9 s d'écart les uns des autres (« devis, relances, factures »). Moins de 6 i entre deux mots : on n'en garde que 2 et on bascule sur P1.

| Image | Ce qui se passe |
|---|---|
| i0 (mot 1) | Coupe franche : aplat encre. Le mot ivoire entre par la gauche, lettre par lettre (1 i par lettre), avec une inclinaison de -10° à 0. Son : `click_001`. |
| i0 (mot 2) | Coupe franche : aplat orange. Le mot encre tombe du haut avec `JAILLIR`, incliné de +5°. Son : `click_002`. |
| i0 (mot 3) | Coupe franche : aplat ivoire, grain de 6 %. Mot orange claqué (M4), avec secousse. Son : `drop_002`. |
| mot 3 + 10 → + 18 | Récapitulatif : les 3 mots, réduits à 0,3 L, s'empilent en cascade (M5), inclinés à -5°, +4° et -3°, sur l'aplat ivoire. |
| + 19 → + 24 | Sortie en **balayage diagonal** ivoire (M2 inversé, à 30°) qui découvre Will. |

Durée : de 1,2 à 2 s.

### P3 « Duel en triangles »

Pour une opposition dite (« eux / vous », « à la main / automatisé »).

| Image | Ce qui se passe |
|---|---|
| i0 → i5 | Un triangle encre glisse depuis le coin haut-gauche (M8) : il couvre la moitié au-dessus de la diagonale qui va du bas-gauche au haut-droit. |
| i2 → i7 | Un triangle orange glisse depuis le coin bas-droit. |
| i6 | **Rencontre** : un liseré ivoire de 0,012 L flashe sur la diagonale (1 i). Les deux triangles se secouent (A = 0,010 L, de i6 à i12). Son : `drop_004` + `whoosh-in`. |
| i3 | Mot A (ivoire, horizontal) au centre de gravité du triangle encre, avec `JAILLIR`. |
| i0 (mot B) | Mot B (encre) dans le triangle orange, avec `JAILLIR`. |
| i8 | Disque ivoire de 0,12 L au centre de la diagonale, icône éclair, entrée en vrille (M3). **Pas de « VS » écrit** : Will ne le dit pas. |
| Verdict (s'il est dit) | Le triangle perdant passe au sable et recule de 0,05 L. Le gagnant pulse à 1,04. |
| Sortie, 5 i | Chaque triangle repart vers son coin (`Easing.in(cubic)`) : tolérance de 3 i. |

Durée : de 1,5 à 2,5 s. Il remplace l'`ecran-partage` actuel quand on cherche de l'énergie.

### P4 « Tampon et déchirure » (fait main)

| Image | Ce qui se passe |
|---|---|
| i-4 | Coupe franche : papier ivoire plein écran, grain de 6 % et fibres. Son : « papier » (à sourcer). |
| i-4 → i-1 | Deux bandes de scotch claquent aux coins hauts (cascade de 2 i). |
| i0 → i3 | **Tampon** (F9) avec le mot dit, incliné de -12°, échelle de 1,7 à 1 avec `CLAQUER`. Son : « tampon » (à sourcer). |
| i3 → i8 | 6 gouttes d'encre orange (M7 court, sans gravité) qui « collent » au papier. Le papier se secoue (A = 0,008 L, de i3 à i10). |
| i12 → i24 | L'encre « sèche » : l'opacité du tampon passe de 1 à 0,92. |
| i25 → i29 | **Déchirure** (M10) le long d'une ligne verticale en dents de scie : les deux moitiés s'écartent à 0,12 L/i, et le visage est dégagé dès i26. Son : « déchirure » (à sourcer). |

Durée : de 1 à 1,2 s. Pour un verdict, une validation (« réglé », « fini »).

### P5 « Éclat-chiffre »

Uniquement pour **un chiffre dit**. Sans chiffre, le même geste sert avec un mot.

| Image | Ce qui se passe |
|---|---|
| i0 | Coupe franche : aplat encre. Un éclat orange de 16 branches **plus grand que le cadre** (1,3 L de diamètre, qui déborde) passe de l'échelle 0,3 à 1 avec `JAILLIR`, avec une rotation de -30° à 0. Ensuite il tourne de 1°/i. |
| i0 → i12 | Le chiffre ivoire (0,32 H de haut, chiffres tabulaires) **défile jusqu'au chiffre dit** [WILL] (fin en ralentissant). |
| i12 | Arrivée : échelle de 1,15 à 1 avec `CLAQUER`, secousse, et **10 éclats** sable et ivoire (M7). Son : `eclats.wav`. |
| i14 → i19 | L'unité dite (« h », « min ») glisse depuis la droite (M8). |
| i20 → i30 | Pose. |
| i31 → i35 | Sortie par **aspiration** (échelle vers 0, rotation de +90°, `Easing.in(cubic)`). Tolérance de 3 i. |

Durée : de 1 à 1,4 s.

---

## D. Les 24 éléments à faire dessiner (5 lots)

Chaque lot a **une matière et une famille de gestes** à lui, **un seul coup de poing**, et couvre au moins 4 emplacements. Les lots ne peuvent donc pas se ressembler. Abréviations : E = emplacement, F = forme, M = mouvement (§ B). « Entier » : le visage reste entier ; « couvert » : il est entièrement couvert.

Sons : les fichiers `click`, `drop`, `ding`, `eclats`, `feutre`, `maximize`, `minimize`, `select`, `tick`, `vibreur`, `whoosh-in/out` et `confirmation` existent dans `sons/`. Ceux marqués **(à sourcer)** sont à chercher en CC0 (Kenney ou équivalent gratuit) [WILL : aucune banque payante].

### Lot 1 « Papier & collage » (designer 1) : gestes = collage, balancier, tracé, déchirure

| # | Id | E | F | M | Visage | Quand l'utiliser | Bruitage |
|---|---|---|---|---|---|---|---|
| 1 | `autocollant-mot` | E3 droite (x 0,76-1,02, y 0,22-0,38 ; déborde à droite) | F3, fond orange, mot encre, incliné de +9° | M4 (de 1,25 à 1 et de +20° à +9°), puis un coin qui se décolle de 8 % à 3 % (6 i) | entier | Un mot-clé nom dit (« devis », « relances ») | `drop_002` + « autocollant » (à sourcer) |
| 2 | `scotch-postit` | E2 gauche (x 0,03-0,25, y 0,20-0,44) | F10 : papier sable-clair à bords déchirés, incliné de -6°, 2 scotchs en croix | M9 (tombe du haut du cadre en balancier), puis les 2 scotchs claquent avec un décalage de 2 i | entier | Une tâche, un rappel, « il faut penser à… » | « scotch » (à sourcer) + `drop_001` |
| 3 | `tampon-dechirure` | E7 | F7 + F9 + F10 | P4 (§ C) | couvert | Verdict ou validation | papier, tampon, déchirure (à sourcer) |
| 4 | `fleche-feutre` | E6 diagonale : du coin bas-gauche (0,06 ; 0,88) vers l'épaule (0,24 ; 0,52), sans entrer dans Z | F4 + un mot en F11 de 0,08 L au départ | M6 (9 i), pointe en M1 | entier | « regardez », « ça », « moi » (désigner) | `feutre.wav` |
| 5 | `ticket-dechire-haut` | E1 haut (y 0,02-0,12) | F10 : bande de papier ivoire à bord bas déchiré, mot encre, incliné de -3° | M10 (dépliage depuis le haut), puis M9 à ±2° | entier | Un titre de séquence ou une question (« le problème ») | « déchirure courte » (à sourcer) |

### Lot 2 « Géométrie franche » (designer 2) : gestes = rotation par crans, glissement diagonal, arc

| # | Id | E | F | M | Visage | Quand | Bruitage |
|---|---|---|---|---|---|---|---|
| 6 | `pastille-chiffre` | E2 gauche (centre 0,14 L ; 0,30 H, diamètre 0,22 L) | F1 orange, chiffre ivoire | M3 (vrille de -90° à 0), puis un anneau encre se trace autour (M6, 8 i) | entier | **Un nombre dit**, et seulement celui-là | `select_002` + `tick_001` |
| 7 | `bandes-diagonales` | E6 : de y 0,90 H à gauche à y 0,72 H à droite, -18° | F8 : bande orange au-dessus, bande encre au-dessous, un mot dit sur chacune | M8 : la bande orange vient du bas-gauche, la bande encre du haut-droit 3 i plus tard ; arrêt net avec secousse | entier | Deux mots qui vont ensemble (« simple · rapide ») | `whoosh-in` |
| 8 | `duel-triangles` | E7 | F7 en deux triangles | P3 (§ C) | couvert | Opposition dite | `whoosh-in` + `drop_004` |
| 9 | `demi-lune-bas` | E4 : disque encre de 1,1 L de diamètre, centre à (0,5 ; 1,02 H), sommet à 0,72 H | F1 géant tronqué ; le mot ivoire **suit l'arc** | M1 vertical (monte du bas), puis les lettres en cascade de 1 i le long de l'arc | entier | Un résultat ou une conclusion (« et voilà ») | `maximize_004` |
| 10 | `losange-crans` | E1 haut, coin droit (centre 0,84 L ; 0,10 H, 0,16 L) | Losange orange (carré à 45°) avec `Icone` ivoire | M3 par crans : 1 quart de tour par étape dite, avec changement d'icône à chaque cran | entier | Étapes (« d'abord… ensuite… enfin ») | `click_001` à chaque cran |

### Lot 3 « La typo est le personnage » (designer 3) : gestes = trajectoires de lettres, masques

| # | Id | E | F | M | Visage | Quand | Bruitage |
|---|---|---|---|---|---|---|---|
| 11 | `mot-saute` | Part de la bande S, atterrit en **E5 halo** haut-droit (0,80 L ; 0,16 H) | F11 orange, contour encre | Le mot quitte le sous-titre (échelle de 1 à 1,8 en 4 i), décrit **un arc parabolique de 10 i par la droite de Z** (il ne la traverse jamais), puis M4 à l'atterrissage | entier | **Le mot fort de la phrase** ; c'est l'élément idéal à 0,8-2 s | `select_001` (départ) + `drop_003` (arrivée) |
| 12 | `mot-vertical-bord` | E2 gauche : mot de 0,18 L de haut tourné à -90°, de y 0,15 à 0,80, la 1re lettre coupée par le bord | F11 encre en creux, puis rempli d'orange | M2 du bas vers le haut (7 i), le remplissage suit 3 i plus tard, puis défilement de 0,2 % par image | entier | Le **thème** d'un passage (« TEMPS », « ÉQUIPE ») | `whoosh-in` |
| 13 | `rafale-trois-mots` | E7 | F7 × 3 + F11 | P2 (§ C) | couvert | Énumération de 3 mots dits | `click_001`, `click_002`, `drop_002` |
| 14 | `orbite-lettres` | E5 halo : ellipse de rayons 0,34 L et 0,27 H autour du centre du visage, entièrement hors de Z | F11 : les lettres d'un mot de 8 lettres au plus, en ivoire avec contour encre | Les lettres apparaissent une par image le long de l'arc (M5), l'anneau tourne de 40° en 30 i (en ralentissant), puis **les lettres s'envolent vers l'extérieur** (M7 sur les lettres) | entier | Ce qui « tourne dans la tête » (souci, question) | `tick_002` en cascade |
| 15 | `mot-barre-remplace` | E1 haut | F11 : mot A encre sur une petite bande sable-clair, puis mot B orange incliné à -5° | M6 (le feutre barre le mot A en 6 i), puis le mot B en M1, 3 i plus tard | entier | Une correction : « pas X, mais Y » | `feutre.wav` + `select_001` |

### Lot 4 « Impact / énergie » (designer 4) : gestes = éclatement, ondes, vitesse, gravité

| # | Id | E | F | M | Visage | Quand | Bruitage |
|---|---|---|---|---|---|---|---|
| 16 | `eclat-mot` | E1 haut, coin gauche (centre 0,17 L ; 0,11 H, 0,30 L) | F5 orange, 14 branches, mot ivoire | M1 avec une rotation de -45° à 0 ; micro-vie : rotation de 0,2°/i | entier | Une annonce ou une nouveauté dite | `maximize_006` + « pop » (à sourcer) |
| 17 | `eclat-chiffre` | E7 | F7 + F5 géant | P5 (§ C) | couvert | Un chiffre dit, important | `eclats.wav` |
| 18 | `onde-de-choc` | E5 halo | 3 cercles concentriques **sans remplissage** (contours orange, sable et encre de 0,008 L) centrés sur le visage, **rayon de départ au-delà de Z** | Ils s'agrandissent jusqu'à 0,7 L en cascade de 3 i, en s'effaçant (12 i) | entier | Une affirmation forte, **sans rien à écrire** : c'est la respiration graphique | `drop_004` grave |
| 19 | `traits-vitesse` | E3 droite (y 0,24-0,54) | 7 barres de vitesse (épaisseurs de 0,004 à 0,014 L, encre et orange) + un mot en F11 | Les barres jaillissent du bord droit en cascade de 1 i, puis le mot arrive en M8 et freine avec une inclinaison de -12° à 0 | entier | Vitesse : « tout de suite », « en un clic » | `whoosh-in` |
| 20 | `gerbe-formes` | E4 bas, la gerbe ne dépasse pas 0,66 H | 14 petites formes de la charte (F1, F5, triangles) + une pastille F1 avec le mot dit | M7 vers le haut **avec gravité** (retombée), la pastille arrive en M1 au sommet de la gerbe | entier | Réussite : « c'est fait », « c'est parti » | `confirmation_002` |

### Lot 5 « Organique & objets » (designer 5) : gestes = morph, ondulation, roulement, claquement

| # | Id | E | F | M | Visage | Quand | Bruitage |
|---|---|---|---|---|---|---|---|
| 21 | `blob-mot` | E4 bas-gauche (x 0,02-0,42, y 0,70-0,86) | F6 orange, mot encre | M11 (le cercle devient blob avec `JAILLIR`), puis ondulation | entier | Un bénéfice doux (« sereinement », « enfin ») | `drop_001` + « bloup » (à sourcer) |
| 22 | `dalle-claquee` | E7 | F7 + F11 | P1 (§ C), sortie en morph vers un blob | couvert | La phrase choc | `drop_004` + « boum » (à sourcer) |
| 23 | `bulle-cri` | E3 droite (x 0,75-1,0, y 0,14-0,36), la queue vise la bouche **mais s'arrête à Z + 0,02** | Bulle de bande dessinée **à bord en dents de scie**, ivoire, contour encre de 0,006 L, inclinée de +6° | M4 avec secousse forte (A = 0,016 L) | entier | Will **cite** quelqu'un (« j'ai pas le temps ! ») | `click_003` + `minimize_004` |
| 24 | `badge-roulant` | E6 : roule en diagonale du hors-cadre bas-droit (1,15 L ; 0,70 H) jusqu'à (0,87 L ; 0,26 H) | F1 de 0,24 L de diamètre, **texte circulaire** de mots dits sur le pourtour (« · À DISTANCE · PARTOUT EN FRANCE · »), pastille encre avec `Icone` au centre | M11 roulement (rotation liée à la distance), arrêt avec `TOUPIE`, puis rotation de 0,5°/i | entier | Une portée, une modalité dite (« à distance », « partout en France ») | `select_002` |

### D.1 Contrôle de couverture

| Emplacement | Éléments | Total |
|---|---|---|
| E1 haut | 5, 10, 15, 16 | 4 |
| E2 gauche | 2, 6, 12 | 3 |
| E3 droite | 1, 19, 23 | 3 |
| E4 bas | 9, 20, 21 | 3 |
| E5 halo | 11, 14, 18 | 3 |
| E6 diagonale | 4, 7, 24 | 3 |
| E7 plein écran | 3, 8, 13, 17, 22 | 5 |

- **Formes non rectangulaires** : 19 éléments sur 24, soit **79 %** (le minimum demandé est 60 %). Les 5 autres sont : les 3 aplats plein écran (3, 13, 22) et 2 papiers à bord déchiré (2, 5).
- **Inclinés** (|angle| ≥ 3°) : 16 sur 24.
- **Visage couvert** : seulement les 5 coups de poing, tous en E7.

---

## E. Règles de diversité du réalisateur

Elles s'ajoutent à R1 à R8 de `DIVERSITE-MOTION-2026-10-15.md`. Chaque apparition du plan porte désormais 4 étiquettes : **famille** (l'id), **emplacement** (E1 à E7), **forme** (F1 à F12) et **mouvement d'entrée** (M1 à M11), plus l'**angle** et la **sortie**. Toutes ces règles sont vérifiables par code [CHOIX DA].

### Règles

**D1. Jamais deux fois de suite :**
- le même emplacement, la même forme, le même mouvement d'entrée, la même famille ;
- le même signe d'inclinaison (on alterne + et −) ;
- la même sortie.

**D2. Fenêtre de 5 apparitions consécutives :**
- au moins 4 emplacements différents, 4 formes différentes et 4 mouvements différents ;
- au moins 1 élément latéral (E2 ou E3).

**D3. Fenêtre glissante de 60 s :**
- **les 6 emplacements E1 à E6 apparaissent tous au moins une fois** ;
- E2 et E3 apparaissent ensemble au moins 3 fois ;
- E4 représente au plus 30 % des apparitions (c'était le défaut de la planche motion).

**D4. Rectangles (F12 : cartes, fenêtres, étiquettes) :**
- au plus 35 % des apparitions ;
- jamais 2 de suite ;
- au plus 1 carte par fenêtre de 12 s.
- Les formes F1 à F6, F9 et F11 représentent au moins 50 % des apparitions.

**D5. Asymétrie :**
- au moins 60 % des éléments sont inclinés de 3 à 14° ;
- au plus 30 % sont centrés sur l'axe vertical (centre entre 0,4 et 0,6 L) ;
- après un élément à gauche, le prochain élément latéral va à droite, et inversement.

**D6. Contraste de taille :**
- 3 classes : **petit** (moins de 6 % de l'image), **moyen** (6 à 15 %), **grand** (plus de 15 %, ou E7) ;
- jamais 3 éléments de suite dans la même classe ;
- au moins 1 « grand » toutes les 10 s.

**D7. Orange :**
- sur les plans où l'on voit Will, au moins 1 élément sur 3 a **une surface orange pleine** d'au moins 3 % de l'image ;
- au moins 1 élément orange par fenêtre de 8 s.

**D8. Secousse :**
- au plus 1 par tranche de 4 s ;
- uniquement sur l'élément (contrôlé : la prise n'a ni transformation ni zoom, [EXISTANT] `ZOOMS_AUTORISES = false`).

**D9. Ouverture (complète R1) :**
- de 0 à 0,8 s : seulement les sous-titres ;
- **de 0,8 à 2,0 s : un premier élément « entier », vif, en E5, E1, E2 ou E3**, choisi parmi `mot-saute`, `eclat-mot`, `autocollant-mot`, `pastille-chiffre`, `bulle-cri` et `onde-de-choc`. C'est la micro-accroche [SOURCÉ : accroche dans les 3 premières secondes ; choix des éléments = CHOIX DA] ;
- rien qui couvre le visage avant 5,0 s [WILL] ;
- aucune carte avant 8,0 s ;
- aucun E7 avant 10,0 s.

**D10. Coups de poing (P1 à P5) :**
- le **1er tombe entre 10,0 et 16,0 s** ;
- ensuite, de 18 à 30 s d'écart entre deux coups de poing ;
- nombre : arrondi de (durée ÷ 25 s), au minimum 2 si la vidéo dure plus de 45 s, au maximum 4 par 90 s ;
- **les 5 types ne se répètent pas dans une même vidéo** ;
- ils comptent dans le plafond E7 avec `volet` et `ecran-partage` : au plus 2 E7 par 60 s ;
- le dernier tombe au moins 8 s avant la carte de fin ;
- après chaque coup de poing, au moins 1,0 s de Will seul, puis un élément « petit » ou « moyen » (jamais un grand ni un rectangle) ;
- jamais deux E7 consécutifs.

**D11. Cadence :**
- conservée de R5d : un événement toutes les 1 à 2,5 s, jamais plus de 3 s sans rien ;
- [SOURCÉ : un changement visuel toutes les 2 à 4 s ; les sous-titres un peu moins nerveux].

**D12. Sons :**
- jamais le même fichier deux fois de suite ;
- R6a conservée : un même son représente au plus 30 % des bruitages.

**D13. D'une vidéo à l'autre (complète R7) :**
- l'emplacement et la forme du 1er élément diffèrent de ceux des 3 vidéos précédentes ;
- le type du 1er coup de poing diffère de celui de la vidéo précédente ;
- chacun des 5 lots est présent au moins une fois par vidéo de plus de 45 s.

### Quotas par vidéo de 90 s (repère)

| Catégorie | Quota |
|---|---|
| Apparitions au total | 40 à 55 |
| Coups de poing | 3 ou 4 |
| Rectangles F12 | au plus 35 % |
| Chaque emplacement E1 à E6 | au moins 3 |
| Chaque élément des 24 | au plus 3 (au plus 2 pour 1, 11, 23) |

**Échec bloquant** (le plan n'est pas rendu) : D1, D3 (6 emplacements), D4, D9 et D10.

### Requalification des familles existantes [CHOIX DA, à faire par les designers des lots les plus proches]

| Famille existante | Ce qui change en v2 |
|---|---|
| `horloge`, `bulles` | Passent en E2 ou E3, mesurent au moins 8 % de l'image, inclinées, et débordent du cadre (lot 4). |
| `jauge` | Devient une demi-lune (cf. élément 9) ou passe en E3. Elle quitte le bas-centre (lot 2). |
| `carte-france` | Passe en E3, inclinée de +6°, avec un bord F3 « autocollant ». Supprimer l'encart Corse carré (lot 1). |
| `chiffre-eclate` | Fusionné avec `pastille-chiffre` et P5. Il quitte la poitrine. |
| `mot-geant` | Devient P1. Le motif de mots répétés au fond est réservé à P1 seul. |
| `ruban` | Reste en E4, mais ne peut plus suivre une bande diagonale (D1 : forme). |
| `telephone`, `pile-notifications` | Inchangés, sauf l'inclinaison obligatoire de ±4° et l'alternance gauche/droite. |
| 20 cartes, fenêtres | Inchangées, sous le quota D4. |

---

## F. Grille de critique (sur 10)

### F.1 Éliminatoires

Un seul suffit pour refaire l'élément, sans note :

1. visage **à moitié** caché à l'état posé, ou plus de 3 images en transition ;
2. **le moindre mouvement ou zoom** de la prise ;
3. un chiffre ou un mot affiché que Will ne dit pas, « Villeexemple », ou une couleur hors charte et hors `NUANCES` ;
4. un texte coupé par erreur (le débordement voulu du bord du cadre, en E2 ou E3, est permis), ou un texte de moins de 26 px à 1 080 de large ;
5. un élément « entier » qui entre dans la zone Z, même pendant sa trajectoire ;
6. un `.tsx` sans `import React`, ou la signature d'`Icone` modifiée.

### F.2 Notation

| # | Critère | Points | Comment juger |
|---|---|---|---|
| 1 | **Énergie du mouvement** : élan, dépassement visible, impact (secousse ou traits) quand la fiche le prévoit, sortie vive | 2 | Regarder l'extrait à vitesse réelle, **puis à 25 %** : le dépassement doit se voir. Pas d'élan : 0. |
| 2 | **Singularité** : ne ressemble à aucun autre des 24 | 1,5 | **Test de silhouette** : l'élément posé, rendu en noir sur blanc, ne recouvre pas plus de 60 % de la silhouette d'un autre élément (rapport intersection / union). |
| 3 | **Lisible en 0,5 s** à la taille d'un téléphone | 1 | Planche réduite à 30 %, mot ou objet reconnu d'un coup d'œil. |
| 4 | **Fidèle à sa fiche** : emplacement, forme, mouvement, angle | 1 | Comparer aux coordonnées du § D. |
| 5 | **Fait main et moderne** : texture (grain, fibres, encre), imperfection maîtrisée, pas de « modèle gratuit » | 1 | [SOURCÉ : tendance « fait main » contre le lisse de l'IA] |
| 6 | **Charte et typographie** : 4 couleurs, Montserrat et Inter, 3 niveaux typographiques au plus | 1 | Recherche des couleurs dans le code. |
| 7 | **Finition** : bords nets, ombres cohérentes (une seule direction de lumière, ombre vers le bas-droit), aucun crénelage, rien qui « saute » d'une image à l'autre | 1 | Image par image sur les 8 premières images. |
| 8 | **Micro-vie et sortie** : jamais plus de 0,7 s immobile, sortie autre qu'un fondu | 1 | Différence de pixels d'une image à l'autre. |
| 9 | **Bruitage** : calé à ±1 image, adapté au geste | 0,5 | Écoute. |
| | **Total** | **10** | |

**Seuils** :
- **8 ou plus** : montré à Will ;
- de 6,5 à 7,9 : corrections ciblées par le designer, puis nouvelle critique ;
- moins de 6,5 : refait.

Le critique cite pour chaque point **l'image précise** (« i4 : … ») et non une impression.

### F.3 Format des planches pour Will [CHOIX DA]

Will a jugé des images fixes, qui tuent l'énergie. Chaque planche de lot contient :

- **une bande de 5 images par élément** (i0, i2, i4, i8, posé), sur sa vraie prise ;
- **un extrait vidéo de 2 s par élément** (avec le bruitage) ;
- **un enchaînement de démonstration de 15 s** qui respecte D1 à D10 : c'est ce qui prouve que la diversité « se sent ».

Les rendus se font un à la fois, sous le verrou `verrou-lourd.txt`. Les dossiers `remotion-*` temporaires sont supprimés ensuite.

---

## G. Ce qui reste incertain

1. **Aucune source solide** sur les autocollants, les formes ou les « coups de poing » : la recherche ne couvre que la tendance collage et fait main. Les 24 éléments sont des **paris artistiques**, à trancher sur planche par Will.
2. Les dépassements et les temps de pose des ressorts sont **théoriques**. Il faut les mesurer avec `measureSpring` et ajuster à l'œil.
3. Il faut valider avec Will **la tolérance de 3 images** de visage partiel pendant les transitions plein écran (déjà pratiquée par `MotGeant`).
4. La **zone sûre 4:5** n'est pas vérifiée (E1 et E4 risquent d'être rognés) : à contrôler au lot I.
5. Il faut **sourcer** 6 sons CC0 : boum, papier, tampon, déchirure, autocollant ou scotch, pop ou bloup.
