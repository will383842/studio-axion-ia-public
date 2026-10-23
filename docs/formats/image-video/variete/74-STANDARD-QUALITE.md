# 74 · Image → vidéo : le standard de qualité des maquettes de variété (15/10/2026)

**À quoi il sert.** Juger chaque maquette de variété (document 72) sur des **images fixes**, en 1080 × 1920 (9:16) ou 1080 × 1350 (4:5). Chaque règle se coche **oui / non** en regardant l'image, avec une règle graduée ou une pipette de couleur. Les trois motion designers dessinent avec ce standard ; le critique note avec la grille de la partie 8.

**Repère de mesure.** Toutes les tailles sont en pixels de l'image finale. Le studio dessine le 4:5 avec les **mêmes tailles en pixels** que le 9:16 (même largeur de 1080 px, règle `referenceFormat` du moteur) : un seuil vaut donc pour les deux formats.

**Sources.** Les seuils viennent du code (`src/briques/habillage/charte-duo.ts`, `src/briques/schema-motion/types.ts` et `mise-en-page.ts`, registre des réseaux `src/reseaux/index.ts`) et des documents 70 et 72. Le document 70 ne donne pas de chiffres de zones protégées : ils viennent du registre des réseaux, qui reprend le guide Meta des Reels.

> **Attention, écart trouvé.** Le README de la galerie et `planche.jpg` placent encore les sous-titres à 0,71 → 0,79 de la hauteur. Le code actuel (L11) les a remontés à **0,60 → 0,67**, parce que le bas de l'ancienne bande tombait sous l'interface d'Instagram et de Facebook (30 % du bas cachés). **Ce standard suit le code.**

---

## 1. Lisibilité sur téléphone

| Élément | Taille minimale (9:16 et 4:5) | Police |
|---|---|---|
| Tout texte porteur de sens (libellé, sous-titre, phrase) | **58 px** de hauteur de corps (0,03 × 1920) | Inter Bold ou Anton |
| Titre d'en-tête | 131 px conseillé (0,068 × 1920) ; **96 px au minimum** | Anton |
| Chiffre-clé (23h14, 80 %, 4 s, 2h, 24h/24, 0) | **96 px** partout où il apparaît | Anton |
| Chiffre qui est le point focal de l'écran | **230 px** (0,12 × 1920) | Anton |
| Seules exceptions sous 58 px | marque « axion-ia.com » 36 px ; **une** étiquette en capitales espacées de 28 px (≤ 4 mots, jamais une information qu'on ne retrouve pas ailleurs) | Inter Bold |

**Nombre de mots à l'écran**, sans compter la marque :
- **8 mots au plus** dans l'image, hors sous-titre (titre + libellés + étiquette). Un nombre et son unité comptent pour un mot (« 80 % », « 4 s »).
- **Sous-titre** : une ligne, **6 mots au plus**.
- **Seule exception** : l'écran « vue d'ensemble » peut avoir **6 libellés au plus, de 3 mots chacun au plus**.

**Contraste.** Il s'agit du rapport WCAG 2.x, que nous avons calculé sur les couleurs exactes de la charte. Une taille de 58 px est déjà un « grand texte » au sens du WCAG, mais la charte est plus exigeante :
- **texte courant (58 à 95 px) : rapport de 7 au moins** ;
- **texte d'affiche (96 px et plus) : rapport de 3 au moins** ;
- **le mot orange** est le seul accent permis à taille courante, à condition d'atteindre 4.

| Texte sur fond | Rapport | Verdict |
|---|---|---|
| ivoire `#F4EFE7` sur nuit `#110A05` | 17,2 | **Autorisé**, toutes tailles |
| blanc sur nuit | 19,6 | **Autorisé**, toutes tailles |
| gris clair `#C9B8A6` sur nuit | 10,2 | **Autorisé**, toutes tailles (texte secondaire) |
| encre `#15100C` sur ivoire | 16,5 | **Autorisé**, toutes tailles |
| encre sur orange vif `#F0703C` | 6,4 | **Autorisé** (panneau orange : texte en encre) |
| orange vif sur nuit | 6,6 | Affiche, ou le mot orange seul |
| vert `#22A55B` sur nuit | 6,2 | Affiche seulement (96 px et plus) |
| encre sur vert | 5,9 | Affiche seulement |
| gris `#8A7C6E` sur nuit | 4,9 | Affiche seulement |
| blanc sur orange `#C2532A` | 4,6 | Affiche seulement |
| orange sur ivoire | 4,0 | Affiche, ou le mot orange seul |
| gris sur ivoire | 3,5 | Affiche seulement, jamais d'information unique |
| blanc sur vert | 3,2 | Affiche seulement : **interdit sur une petite pastille** |
| blanc sur orange vif | 3,0 | **Interdit** (il manque 0,04 pour atteindre 3) |
| vert sur ivoire | 2,8 | **Interdit pour du texte** |
| orange vif sur ivoire | 2,6 | **Interdit** (sur ivoire, l'orange est `#C2532A`) |
| orange `#C2532A` sur nuit | 4,3 | **Interdit** (sur nuit, l'orange est `#F0703C`) |
| gris clair sur ivoire | 1,7 | **Interdit** |

**Ce qui coince dans le niveau actuel :**
- « 45 SEC » est en vert sur ivoire (rapport 2,8).
- Les pastilles « RÉSOLU SANS HUMAIN » mettent du petit texte blanc sur vert (rapport 3,2, sous 58 px).
- Dans la maquette du chatbot, les textes des cartes (alerte Telegram, carte du chatbot) font environ 20 px.

---

## 2. Ni vide, ni bourré

La **zone utile** (v1) d'un écran avec en-tête va de **y = 509 px** à **y = 1114 px** ; en v2, la hauteur à remplir est celle du § 2 bis, avec des marges latérales de 60 px. Ce sont les fractions 0,265 et 0,58 de la hauteur, soit 0,245 + 0,02 et 0,60 − 0,02. Sur un écran sans titre, la zone utile commence à y = 288 px.

| Règle | Comment cocher |
|---|---|
| Le bloc de contenu couvre **70 % ou plus de la hauteur** de la zone utile, et **60 % ou plus de sa largeur** | Mesurer la boîte qui englobe tout le contenu |
| **Pas de grand trou** | Couper la zone utile en 3 × 3 cases : **2 cases vides au plus**, et jamais 2 cases vides voisines dans la même rangée |
| **De l'air** | Au moins 25 % de la zone utile reste du fond (rien de collé bord à bord, sauf un aplat déclaré comme fond) |
| **Un seul point focal** | Plisser les yeux (ou flouter l'image réduite) : un seul élément ressort. Il est **au moins 1,5 fois plus grand** que le deuxième, ou c'est le seul à porter l'orange |
| **Le bas de l'écran** (sous y = 1286 px) | **Remplacé en v2 par le § 2 bis** : de 1300 à 1536, des objets d'appoint (rien d'indispensable seul) ; sous 1536, fond et matière seulement |

### 2 bis. Remplissage de la hauteur utile (ajouté en v2, contrôlé sur CHAQUE image)

La relecture de la v1 a montré le défaut : contenu entassé dans les 40 % du haut, sous-titre, puis un grand fond vide. La moitié basse d'un écran 9:16 ne doit plus être vide.

- **Hauteur utile, 9:16** : de **y = 230** (0,12) à **y = 1536** (0,80), **moins la bande des sous-titres** 1152 → 1286. **4:5** : de y = 54 à y = 1215, moins la bande 1042 → 1176.
- **Règle 1 : ≥ 60 %** des rangées de pixels de la hauteur utile portent du contenu (bord d'un objet, d'une lettre, d'un trait ; un fond uni, une lueur ou le grain ne comptent pas).
- **Règle 2 : pas de trou continu de plus de 15 %** de la hauteur utile (environ 175 px en 9:16).
- **Centre de gravité vers le milieu** : le contenu se répartit au-dessus ET au-dessous de la bande des sous-titres.
- **Sous la bande des sous-titres (y = 1300 → 1536)** : c'est la **zone d'appoint**. On y place des **objets** qui prolongent l'écran (suite du schéma, deuxième branche, socle d'un objet, fil, cartes en appui). Elle est cachée par la légende de Reels et du fil Facebook (576 px du bas) : **rien d'indispensable n'y est seul**, aucun mot ni chiffre qu'on ne lit pas aussi au-dessus. Sous y = 1536 (20 % du bas) : fond et matière seulement.
- **Le sous-titre est montré à sa vraie place** (bande 0,60 → 0,67), jamais collé sous le contenu, et **il ne répète pas le titre** : l'écran ne dit pas deux fois la même chose (titre « DEUX CHEMINS. » → voix « Le chatbot trie la demande. »).
- **Interligne** : aucun accent (É, Ô, À…) ne touche la ligne du dessus ni un trait (soulignement, filet). Écart d'au moins 8 px entre le haut d'un accent et l'élément au-dessus.
- **Mesure (v3, 16/10/2026)** : `prototypes/occupation.py <dossier-rendus>` mesure la masse visible et non plus les bords. Une rangée compte si le contenu couvre ≥ 20 % de la largeur. Les seuils : occupation ≥ 60 %, trou ≤ 15 %, équilibre bas/haut ≥ 0,5, zone d'appoint pleine à ≥ 50 %. L'ancienne `remplissage.py` laissait passer des écrans à moitié vides. Voir `76-mesure-occupation.md`.

---

## 3. Zones protégées des réseaux (ce que l'interface recouvre)

### 9:16, image de 1080 × 1920

| Réseau | Haut | Droite | Bas | Gauche |
|---|---|---|---|---|
| TikTok | 192 px | 194 px | 499 px | 43 px |
| Instagram Reels / Facebook Reels | 269 px | 173 px | 576 px | 65 px |
| YouTube Shorts | 192 px | 173 px | 384 px | 43 px |
| LinkedIn (vertical) | 154 px | 43 px | 269 px | 43 px |
| **Union : la règle à appliquer** | **269 px** | **194 px** | **576 px** | **65 px** |

On en tire les **cadres de travail en 9:16** :
- **texte et chiffres** entre **x = 65 et x = 886**, et entre **y = 269 et y = 1286** ;
- **sous-titres** dans la bande **y = 1152 → 1286** (fractions 0,60 → 0,67) ;
- **zone utile** des objets : y = 509 → 1114.

### 4:5, image de 1080 × 1350 (fil LinkedIn et fil Facebook/Instagram)

| Réseau | Haut | Droite | Bas | Gauche |
|---|---|---|---|---|
| LinkedIn | 54 px | 43 px | 135 px | 43 px |
| Instagram / Facebook (fil, règle Meta) | 54 px | 43 px | 108 px | 43 px |
| **Union : la règle à appliquer** | **54 px** | **43 px** | **135 px** | **43 px** |

Le registre ne donne pas de chiffre propre au fil Facebook en 4:5. On applique la valeur Meta d'Instagram, qui est couverte par l'union. Avec la marge de 5 % du studio, **le texte reste entre x = 60 et x = 1020, et entre y = 54 et y = 1188**. Les sous-titres s'arrêtent à **y = 1188** (2 % de marge au-dessus des 135 px).

### Ce qui ne doit jamais être dans une zone protégée

Aucun mot, aucun chiffre, aucun sous-titre, aucune coche ni flèche qui porte le sens. Seuls y sont permis :
- le fond, la matière (grain, lueur), un fil ou un aplat décoratif ;
- en haut, **la marque « axion-ia.com »**. En 9:16, elle est centrée vers y = 110 px. Elle reste lisible même si Reels pose son titre par-dessus, car l'interface de Reels est à gauche. En 4:5, la marque se place sous y = 54 px.

---

## 4. Anti « gabarit IA »

**Interdit : une seule occurrence suffit pour refuser la maquette.**
1. Dégradés violets, bleu-violet ou « aurore », et toute couleur hors charte.
2. Néons, halos fluo, lueurs colorées hors de la lueur orangée de la charte (`#7A3418`).
3. Glassmorphisme générique : verre dépoli, flou d'arrière-plan sous des cartes translucides.
4. Emojis décoratifs, icônes 3D brillantes, personnages ou robots en 3D « plastique », images IA réalistes.
5. Ombres lourdes : ombre portée nette, opaque à plus de 25 %, ou décalée de plus de 12 px.
6. Plus de 2 polices (Anton et Inter Bold seulement), texte en italique, contour sur le texte.
7. Le même gabarit sur chaque écran : titre centré, carte centrée, sous-titre centré, toujours au même endroit.
8. Des éléments qui ne disent rien : particules, étincelles, formes qui flottent, lignes de « tech » abstraites, motif de circuit imprimé.
9. Des chiffres ou des libellés inventés, ou « arrondis » par rapport à l'image C.
10. Des coins arrondis ou des styles différents pour des objets de la même famille sur un même écran.

**Ce qui fait « haut de gamme » (à rechercher) :**
- **Les vrais objets du schéma** : la carte « Chatbot IA », l'horloge à 23h14, la bulle du message, l'alerte Telegram, le ticket qui se ferme. Pas des pictogrammes génériques.
- **De la matière dans la charte** : grain de papier léger, trait un peu vivant, ombres douces (opacité de 12 % au plus, flou large).
- **Une hiérarchie nette** : 3 niveaux de taille au plus par écran, avec un écart d'au moins 1,5 fois entre deux niveaux.
- **Une composition propre à la variante** : le point focal n'est pas toujours centré. L'asymétrie est assumée, et alignée sur une grille.
- **Des alignements exacts** : bords et lignes de base alignés à 4 px près, et des espacements réguliers.

---

## 5. Mouvement (jugé sur l'image fixe)

| Règle | Comment cocher |
|---|---|
| **Une seule transition principale par vidéo**, en plus de la coupe franche (document 72, axe 7) | La fiche de la maquette n'en nomme qu'une |
| L'image fixe **laisse deviner le mouvement** | Un objet est à mi-course : cache à moitié ouvert, trait à moitié dessiné, jauge partielle, point sur le fil, ou trace de trajectoire |
| **Pas de flou illisible** | Aucun texte porteur de sens n'est flou ni dédoublé. Le flou de mouvement est permis sur les **objets seulement**, avec une traînée de 24 px au plus |
| **Un seul mouvement fort à la fois** | 1 élément en mouvement marqué par image ; les autres sont posés ou à peine mobiles |
| Le texte n'est jamais coupé | Un mot à mi-entrée est permis si on lit déjà le mot entier, ou s'il est entièrement caché. Jamais à moitié lisible |

---

## 6. Charte

| Règle | Comment cocher |
|---|---|
| **Couleurs** : seulement nuit, nuit haut, lueur, ivoire, ivoire haut, encre, orange (sur ivoire), orange vif (sur nuit), gris, gris clair, vert (validation), blanc | Pipette : aucune autre teinte, hors anticrénelage et transparences de ces teintes |
| **Polices** : Anton pour les titres et les chiffres, Inter Bold pour le reste | À l'œil |
| **Un seul mot orange par écran** (le chiffre orange compte comme le mot) | Compter, sous-titre compris (le mot orange du sous-titre est le même mot que celui du titre, ou il est le seul) |
| **Marque visible** : « axion-ia.com », avec « ia » en orange, en haut | À l'œil, sur chaque image |
| **Chiffres exacts de l'image C** : 23h14 · 80 % / 20 % · 4 s · 2h · 24h/24 · 0 demande perdue | Aucun autre chiffre, aucune variante (« 4 secondes » est permis en toutes lettres, « 3 s » ne l'est pas) |
| **Phrase-choc mot pour mot** : « Votre client a toujours une réponse. Même à 3h du matin. » | Lecture : pas de reformulation |
| **« Situation type »** annoncée au moins une fois dans la maquette | Sur l'écran d'ouverture ou juste après |
| Le vert sert **seulement** à valider (coche, « résolu ») | À l'œil |

---

## 7. Distinction entre deux variantes d'un même axe

**Test de la vignette (obligatoire).**
1. On réduit l'image clé de chaque variante à **200 px de large** (200 × 356 en 9:16).
2. On les pose côte à côte, sans le code ni le titre, devant quelqu'un qui ne connaît pas le projet.
3. On lui lit la description d'une ligne de chaque variante (document 72).
4. En **5 secondes**, il doit les associer correctement. **Une seule erreur, et les deux variantes sont « trop proches ».**

**Contrôle sur la vignette (2 réponses « oui » au moins sur 4) :**
- le point focal est à un endroit différent (haut, centre, bas, gauche, droite, plein écran) ;
- le fond dominant est différent (nuit ou ivoire, ou matière nettement autre) ;
- la forme dominante est différente (cercle, colonne, grille, ligne, chiffre géant) ;
- l'échelle du point focal varie du simple au double au moins.

---

## 8. Grille de notation (critique)

Chaque critère est noté **0** (non), **1** (presque) ou **2** (oui). Le total est sur 20. **E = éliminatoire** : un 0 sur un critère éliminatoire fait refuser la variante, quel que soit le total.

| # | Critère (parties du standard) | E |
|---|---|---|
| 1 | Tailles : 58 px au moins, chiffres-clés de 96 px au moins, focal de 230 px au moins (§ 1) | **E** |
| 2 | Contraste : seulement des paires autorisées (§ 1) | **E** |
| 3 | Zones protégées respectées en 9:16 et en 4:5 (§ 3) | **E** |
| 4 | Charte : couleurs, 2 polices, un mot orange, marque (§ 6) | **E** |
| 5 | Chiffres et phrase-choc exacts (§ 6) | **E** |
| 6 | Peu de texte : 8 mots au plus, sous-titre de 6 mots au plus (§ 1) | |
| 7 | Rempli sans être bourré, un seul point focal, **remplissage ≥ 60 % et trou ≤ 15 %** (§ 2 et 2 bis) | **E** (depuis la v2) |
| 8 | Aucun signe de « gabarit IA », vrais objets, matière (§ 4) | **E** |
| 9 | Mouvement lisible sur l'image fixe, une seule transition principale (§ 5) | |
| 10 | Distinction réussie au test de la vignette (§ 7) | **E** |

**Seuils :**
- **18 à 20** : excellente, à montrer à Will.
- **16 ou 17** : à reprendre une fois.
- **15 ou moins** : refusée.

**Règle d'or : mieux vaut 4 variantes excellentes que 5 moyennes.** Une variante qui n'atteint pas 18 n'est pas montrée à Will, même si l'axe se retrouve avec moins de variantes.
