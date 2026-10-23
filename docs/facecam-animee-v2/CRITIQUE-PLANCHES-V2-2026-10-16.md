# Critique indépendante des planches v2 « énergie » (16/10/2026)

*Critique indépendant. Aucun code ni aucune planche n'a été modifié. Références : `STANDARD-DA-V2-2026-10-16.md` (§ A, § D, § F) et `REPRENDRE.md` § 2 et § 5 ter.*

Planches regardées : `planche-v2/lot1` à `lot5`. Comparaison : `motion-12-provisoire/planche-motion-provisoire.jpg`, refusée par Will (« toujours le même style, toujours carré, sans énergie »). Pour le mouvement, j'ai lu le code (`studio-rendu/compositions/interface-claire/motion-v2/lotN/`), puisque les planches restent des images fixes.

Unités : **L** = largeur et **H** = hauteur de l'image 1080 × 1920. Les mesures sont relevées sur les vignettes, à ±0,02 près.

---

## 0. Trois réserves avant les notes (elles faussent la lecture des 5 planches)

1. **Chaque planche a un cadrage différent de la prise. Les planches ne sont donc pas comparables entre elles.**
   - **Lot 1** : la prise est descendue d'environ 0,20 H pour **tous** les éléments. Il reste une bande ivoire vide en haut, même pour des éléments latéraux ou bas qui n'en ont pas besoin (le standard § B.2 réserve la descente à E1 > 0,10 H).
   - **Lots 2 à 4** : la prise est en plein cadre, mais Will n'est pas à la même place d'un lot à l'autre (il est décentré à droite dans le lot 3).
   - **Lot 5** : c'est une **image fixe agrandie 1,18 fois** (`PlancheLot5.tsx` l. 25). Le visage y paraît environ 30 % plus large, si bien que les éléments latéraux semblent mordre sur la tête.
   - Ce n'est pas un zoom en production (l'élément ne touche pas la prise). En revanche, **on ne peut pas juger la zone Z sur ces planches**. Il faut **refaire les 5 planches sur la même prise par défaut** (yeux à 0,34 H, visage entre 0,27 et 0,73 L), sans descente sauf pour E1.
2. **Le format de planche demandé en F.3 n'est pas respecté.** Il n'y a ni extrait vidéo de 2 s, ni enchaînement de démonstration de 15 s. L'énergie (élan, dépassement, secousse) ne se juge donc pas sur ces images. Le critère 1 est noté d'après le code et les bandes d'images, ce qui le rend **provisoire**.
3. **Contradiction dans le standard lui-même.** B.5 exige qu'un élément latéral occupe au moins 6 % de l'image. Or les fiches 6 (disque de 0,22 L, soit 1,9 % de l'image), 1 (0,26 L × 0,16 H, soit 2,3 %) et 23 (0,25 × 0,22, soit 3 %) sont **dessinées sous ce seuil dès la fiche**. Les designers ont suivi la fiche. Il en résulte des éléments trop petits, c'est-à-dire **exactement le défaut que Will a relevé** (« pas de motion design sur le côté »). Il faut corriger la fiche, pas seulement l'élément.

---

## 1. Tableau des 24 éléments

Note sur 10 selon la grille F.2. **Élim.** renvoie aux éliminatoires F.1. Le « ? » signale un point **à vérifier sur un rendu vidéo à la prise par défaut**, que la planche ne permet pas de trancher.

| # | Élément | Note | Élim. | Défaut principal vu sur l'image | Verdict | Correction demandée (chiffrée) |
|---|---|---|---|---|---|---|
| 1 | `autocollant-mot` | **5,0** | — | De i0 à « pose », les 6 vignettes sont **presque identiques** : on ne voit ni l'élan de 1,25 à 1, ni la rotation de +20° à +9°. Seuls 2 traits d'impact minuscules apparaissent à i4. L'autocollant fait environ 0,22 × 0,07 H, **soit 1,5 % de l'image** (le minimum latéral est de 6 %). Le coin décollé est invisible. La « sortie » est identique au posé. | CORRIGER | Largeur 0,36 L et hauteur 0,12 H, soit environ 7 % de l'image. Centre (0,88 L ; 0,30 H), avec un débordement à droite de 20 %. Mot de 0,075 L (81 px). Partir de 1,6 (et non 1,25) et de +28°, pour que l'écart reste visible à i2 et i4. Coin décollé : triangle de 0,05 L. Sortie : envol vers la droite en 5 i. |
| 2 | `scotch-postit` | **4,5** | 4 ? (le texte est au plancher de 28 px) | Papier d'environ 0,18 × 0,12 H, **soit 2 % de l'image**. « PENSER À RELANCER » est illisible à 30 %. Les scotchs ne se voient pas. À l'état posé, le papier reste collé à la bande ivoire morte du haut (descente du lot 1) : il « pend du vide » au lieu de vivre sur la prise. Le balancier ne se voit pas sur les vignettes. | CORRIGER | Papier de 0,32 L × 0,20 H (environ 6 %), centre (0,15 L ; 0,36 H), incliné de -8°, avec un débordement à gauche de 15 %. Texte d'au moins 0,05 L (54 px), sur 2 lignes. Scotchs de 0,14 × 0,04 L, sable-clair à 85 % d'opacité, avec un liseré encre de 0,003 L. Balancier : partir de ±24°, pas de ±18°. |
| 3 | `tampon-dechirure` | **7,5** | 1 ? | Le meilleur du lot 1 : RÉGLÉ est franc, la texture d'encre est visible et le claquement se lit (i0 à 1,7, coupé par les bords, puis i2). En revanche : à l'état posé, le tampon ne fait que 0,55 L, et les gouttes (environ 0,01 L) se voient à peine. Les **scotchs aux coins sont invisibles**. Le papier est sable alors que la fiche le veut ivoire. À la sortie, la fente de déchirure ne fait que 0,35 L et laisse le visage **à moitié couvert** : le code annonce 1 image partielle, à vérifier en vidéo. | CORRIGER (léger) | Tampon de 0,75 L à l'état posé. Gouttes de 0,02 à 0,03 L. Scotchs à 85 % d'opacité, avec un liseré. Papier ivoire #E9DCC8 avec des fibres de 3 px. Déchirure à 0,16 L/i (au lieu de 0,12), pour que le visage soit entièrement dégagé à i26. |
| 4 | `fleche-feutre` | **6,0** | 5 ? | La flèche est **presque verticale** (environ 80°) : ce n'est pas la diagonale E6 voulue. Sa pointe s'arrête vers (0,21 L ; 0,50 H), au ras de l'oreille, donc dans la marge de Z. Le trait est réussi (épaisseur variable, tracé visible de i2 à i8). « REGARDEZ » (environ 0,50 L) est posé à plat sur la poitrine, à côté du micro. La sortie est identique au posé. | CORRIGER | Départ (0,08 ; 0,90), point de contrôle (0,02 ; 0,72), pointe (0,22 ; 0,60), soit environ 40°. La pointe s'arrête à Z + 0,03. Trait de 0,016 L. Mot de 0,36 L incliné de -8°, sous le départ du trait. Sortie : le trait se dé-trace à l'envers en 5 i. |
| 5 | `ticket-dechire-haut` | **3,5** | 3 ? (texte peu contrasté) | **Ivoire sur ivoire** : la bande est posée dans la bande morte de la descente et n'a donc **aucune silhouette**. On ne voit qu'un mot et un liseré. Le bord déchiré fait moins de 0,008 L. De fait, c'est un **bandeau rectangulaire pleine largeur**, autrement dit le « toujours carré » refusé. Le balancier de ±2° ne se voit pas. | CORRIGER (refonte complète, note < 6,5) | Papier **orange** (ou encre), mot ivoire de 0,07 L. La bande ne fait plus toute la largeur : 0,62 L, de x 0,04 à 0,66, inclinée de -5°, posée **sur la prise** (y 0,03 à 0,11) sans descente. Bord déchiré de 0,012 à 0,02 L. Un scotch de travers à +20° sur le bout droit. |
| 6 | `pastille-chiffre` | **6,0** | — | La vrille et l'anneau tracé fonctionnent (de i3 à i9). Mais le disque (environ 0,20 L, **soit 1,8 % de l'image**) est **collé à la tempe**, à x 0,24 alors que le visage commence à 0,27. À i1, le « 3 » couché se lit « M ». À l'état posé, il est à 0°, droit. | CORRIGER | Diamètre de 0,30 L. Centre (0,12 L ; 0,40 H), avec un débordement à gauche de 15 %. Angle final de -8°. Anneau encre de 0,012 L. 4 traits d'impact de 0,05 L à i9. Chiffre de 0,15 L. |
| 7 | `bandes-diagonales` | **7,0** | — | **Vrai geste nouveau** : il traverse, il est incliné, il glisse et il s'arrête net (i3, i5). Mais la bande orange est très fine (environ 0,035 H) et **ne porte aucun mot** : SIMPLE et RAPIDE sont tous les deux sur la bande encre, ce qui ne respecte pas la fiche (un mot par bande). La surface orange est faible. | CORRIGER | Deux bandes de 0,08 H chacune, à -18°, d'un bord à l'autre. « SIMPLE » encre sur la bande orange (à gauche), « RAPIDE » ivoire sur la bande encre (à droite). Mots de 0,06 L au minimum. Bande haute à y ≥ 0,70 H, hors de la bande S. |
| 8 | `duel-triangles` | **8,0** | 1 ? | Le meilleur du lot 2 : les triangles francs, le liseré sur la diagonale, les gros mots et le verdict au sable à i28 marchent. Mais le code annonce un visage partiel pendant « **3 à 4 images** » (`DuelTriangles.tsx` l. 8 et 24), alors que la tolérance est de 3 au plus. À i5, « À LA MAIN » est minuscule. Le disque central ne fait que 0,08 L. | GARDER (retouche) | Glissement en **3 i** (au lieu de 4) pour tenir 3 images partielles. Disque de 0,13 L. Mot A à i2 (au lieu de i3). Mots de 0,12 L au minimum. |
| 9 | `demi-lune-bas` | **6,5** | — | Joli texte sur l'arc (« ET VOILÀ » à l'état posé). Mais c'est **en bas, au centre exact**, soit le défaut n° 1 de la planche refusée (A.1). C'est aussi une grosse masse **encre** : l'orange se réduit à un pointillé. La montée de i1 à i9 est molle et sans dépassement visible. | CORRIGER | Disque **orange plein**, avec un anneau encre de 0,02 L. Centre décalé à (0,34 L ; 1,02 H), avec un rayon de 0,60 L, pour quitter l'axe. Arc incliné de -10°. Dépassement : sommet à 0,70 H à i6, puis retour à 0,73 H. |
| 10 | `losange-crans` | **5,0** | 4 ? (icône illisible) | Le losange (côté d'environ 0,12 L, **soit 0,8 % de l'image**) est **illisible à 30 %** : on ne reconnaît aucune icône. La sortie en éclats donne des confettis de 0,01 L. Les crans sont bien rythmés dans le code, mais on ne les voit pas à cette taille. | CORRIGER | Côté de 0,22 L, centre (0,82 L ; 0,11 H). Icône à 0,6 du côté. Traits de cran de 0,05 L. Éclats de 0,025 à 0,04 L. Inclinaison de repos de 45° ± 8°, en alternant. |
| 11 | `mot-saute` | **7,0** | — | **La meilleure trajectoire des 24** : de i2 à i10, il quitte le sous-titre, se dresse avec ses fantômes, longe la tête et atterrit avec des traits. Mais il atterrit **à gauche** (la fiche dit à droite ; le code le justifie par la prise décentrée). À l'état posé, il est petit (environ 0,33 L) et **collé au crâne** (y 0,07 H, environ 0,05 au-dessus des cheveux). Il tombe dans le même « mot en haut » que 14, 15 et 16. | CORRIGER | Atterrissage en (0,78 L ; 0,12 H) sur la prise par défaut. Largeur posée de 0,42 L, hauteur des lettres de 0,09 L. Incliné de -8° (au lieu d'environ -4°). Garder la trajectoire telle quelle. |
| 12 | `mot-vertical-bord` | **8,0** | — | **Le plus fort de tous les plans où l'on voit Will.** C'est une grande surface orange qui occupe tout le côté, avec une vraie silhouette verticale, un passage du creux au plein lisible (i4, i6, i10) et un vrai « motion design sur le côté ». Défauts : la 1re lettre n'est pas coupée par le bord (la fiche le demande), la lettre est lisse, sans grain, et le bas du mot descend jusqu'à environ 0,72 H, donc dans la bande S des sous-titres. | GARDER (retouche) | x de départ à -0,02 L, pour que le « T » soit coupé de 20 %. Hauteur limitée de 0,15 à 0,58 H. Grain de 4 % sur le remplissage orange. |
| 13 | `rafale-trois-mots` | **7,5** | 1 ? | Les 3 coupes (encre, orange, ivoire) ont de l'énergie (i3, i11, i21). Mais **le récapitulatif à i29 ne montre que 2 mots** (DEVIS, petit et délavé, et FACTURES) : RELANCES manque. À la sortie (i37), des **restes de mots** (« EVIS », « NCES ») traînent sur la joue de Will, et le visage est à moitié découvert. La fonction `imagesVisagePartiel` doit le prouver (3 images au plus). | CORRIGER | Récapitulatif complet : 3 mots de 0,30 L, inclinés à -5°, +4° et -3°, en encre, orange puis encre, sans opacité réduite. Les mots partent **avec** l'aplat pendant le balayage, pour qu'aucune lettre ne reste sur le visage découvert. Balayage en 5 i au plus. |
| 14 | `orbite-lettres` | **4,0** | 3 ? (le code tronque les mots de plus de 8 lettres, l. 23) | L'« orbite » se lit comme un **rectangle arrondi fin** (super-ellipse, filet sable presque invisible), donc à nouveau du carré. Les lettres **ne tournent pas autour de la tête** : elles se rangent en un mot horizontal au sommet (i8, i20, posé), comme 11, 15 et 16. Ivoire sur un mur clair : contraste faible. À i64, les lettres sont à l'envers en haut, ce qui fait bug. | ABANDONNER (ou refonte totale) | Si on le garde : lettres **orange pleines** de 0,10 L avec un contour encre de 0,006 L, réparties sur un arc de 140° du côté gauche et haut (sans se regrouper en mot), filet supprimé, rotation de 70° au lieu de 40°. Interdire la troncature : refuser un mot de plus de 8 lettres au lieu de le couper. |
| 15 | `mot-barre-remplace` | **6,0** | — | Il est lisible, et l'idée (barrer puis remplacer) est bonne. Mais il est **petit et plat** : une étiquette sable rectangulaire (un F12 de fait) en haut à gauche, puis FUITE (environ 0,25 L) à droite, presque à l'horizontale. Il s'ajoute au groupe « mot en haut ». | CORRIGER | Étiquette A de 0,42 L, inclinée de +4°. Trait de feutre orange de 0,016 L qui déborde de 0,04 L de chaque côté. Mot B de 0,40 L, incliné de -8°, posé en (0,70 L ; 0,14 H) et **chevauchant de 0,05 L le coin** de A (effet collage). |
| 16 | `eclat-mot` | **5,0** | 4 ? (« NOUVEAU » au plancher de 30 px) | L'étoile fait environ 0,22 L, et « NOUVEAU » est **illisible** à la taille d'un téléphone. Avec ses 14 branches régulières, elle a l'air d'une pastille « PROMO » de **modèle gratuit**. Elle est à 0° à l'état posé. | CORRIGER | Diamètre de 0,34 L, centre (0,18 L ; 0,11 H). Mot de 0,075 L (81 px). Branches alternées longues et courtes (rayon intérieur à 0,60). Incliné de -10° à l'état posé. Contour encre de 0,006 L avec une ombre dure. |
| 17 | `eclat-chiffre` | **8,5** | 3 ? (le chiffre doit être dit) | **Le meilleur des 24.** Le défilement 0, 26, 43, 45 est lisible, l'éclat est gros et irrégulier, l'unité MIN arrive bien, et c'est vraiment « coup de poing ». Petits écarts : l'éclat fait environ 0,95 L alors que la fiche demande 1,3 L, débordant du cadre ; le grain sur l'aplat encre ne se voit pas. | GARDER | Éclat de 1,3 L de diamètre, qui déborde. Grain de 5 % visible sur l'encre. |
| 18 | `onde-de-choc` | **5,5** | — | Les anneaux de 0,008 L sont trop fins, et l'anneau **sable est invisible** sur le mur clair (i6, i10). À i0, l'anneau orange **serre le visage comme un cadre** et traverse la bande S, sur le sous-titre « SI ». Il ressemble à 14 (cadre autour de la tête). | CORRIGER | Épaisseurs de 0,016, 0,012 et 0,008 L. Couleurs orange, encre et orange (sans sable). Rayon de départ à Z + 0,06. Arcs **ouverts vers le bas**, coupés sous 0,58 H, pour ne jamais croiser les sous-titres. |
| 19 | `traits-vitesse` | **5,0** | 5 ? | Il est minuscule : barres d'environ 0,20 L, mot « VITE » d'environ 0,15 L en ivoire sur un mur clair. Les barres arrivent à x ≈ 0,77, **au ras de l'oreille** (marge de Z). À l'état posé, il est à 0°. On ne sent pas la « vitesse » à cette taille. | CORRIGER | Barres de 0,28 à 0,45 L de long et de 0,008 à 0,022 L d'épaisseur, de x 0,80 à 1,0 en débordant, y 0,30 à 0,50 H. Mot de 0,09 L, **orange à contour encre**, incliné de -6° à l'état posé. Arrêt avec secousse (A = 0,008 L). |
| 20 | `gerbe-formes` | **5,5** | — | Il est en **bas, au centre exact**, sur le micro : c'est le défaut A.1. La gerbe est minuscule (formes d'environ 0,03 L) et ne monte que jusqu'à environ 0,78 H, alors que 0,66 H est permis. La pastille « C'EST FAIT » (environ 0,17 L) est à plat sur la poitrine. | CORRIGER | Origine en (0,72 L ; 0,95 H), gerbe dirigée vers le haut à gauche jusqu'à 0,67 H. Formes de 0,04 à 0,07 L. Pastille de 0,26 L en (0,70 ; 0,80), inclinée de +8°. |
| 21 | `blob-mot` | **6,0** | — | Le morph se lit (i2, i4, i8). Mais la forme finale ressemble à un **losange arrondi** : on voit 4 « coins », ce n'est pas un blob. Il est petit (environ 0,38 L × 0,13 H, soit environ 3 % de l'image), et « SEREINEMENT » est au plancher (environ 30 px). | CORRIGER | 8 points de contrôle à ±15 %, **non symétriques**. Taille de 0,46 L × 0,17 H. Mot de 0,055 L (60 px) au minimum. Ondulation de ±4 % sur 1,6 s. |
| 22 | `dalle-claquee` | **7,5** | 1 ? | L'entrée est très forte (i0 à 1,45, soulignement tracé, motif en creux). Mais **la sortie rate le morph** : à i24 et i25, c'est un **rectangle** qui glisse vers le coin, et à i25 il couvre la moitié droite du visage (œil compris). C'est la limite exacte des 3 images (i23 à i25), et ce n'est pas un blob. | CORRIGER | Le blob devient organique dès i23 (rayons à ±20 %). Il passe à 0,45 L de large dès i24 et suit un arc vers le haut à droite qui **dégage Z dès i25**. Il faut au plus 2 images de visage partiel. |
| 23 | `bulle-cri` | **6,0** | 5 ? (sur la planche, la bulle chevauche les cheveux) | La bulle en dents de scie a du caractère, et la secousse ressort des traits (i8). Mais sur la planche, la bulle (x de 0,77 à 0,98) **mord sur les cheveux**, à cause de l'image agrandie 1,18 fois. Il faut le revérifier sur la prise par défaut. Elle fait environ 3 % de l'image, et le texte est au plancher. | CORRIGER | Bulle de 0,30 L × 0,16 H, centre (0,87 L ; 0,20 H), avec un débordement à droite de 10 %. Queue arrêtée à Z + 0,03. Texte de 0,05 L au minimum. Liseré intérieur orange de 0,008 L, pour plus d'orange. |
| 24 | `badge-roulant` | **4,5** | 4 ? 5 ? | Le **texte circulaire est illisible** : environ 26 px sur une couronne de 0,20 L, soit environ 8 px à la taille d'un téléphone. À l'état posé (i24), le badge est sur la tempe et les cheveux. Le roulement ne se voit pas sur une image fixe. L'élément est essentiellement encre. | CORRIGER | Diamètre de 0,32 L, centre posé en (0,92 L ; 0,40 H), avec un débordement à droite d'environ 25 % (moins de 30 %). Couronne orange et texte ivoire de 0,045 L. Au plus 2 groupes de mots dits. Icône de 0,10 L. |

**Moyenne : 6,1 sur 10.**
- **Aucun élément n'est éliminé avec certitude.** En revanche, **9 éléments portent un « ? » d'éliminatoire** à trancher sur un rendu vidéo à la prise par défaut : 2, 3, 4, 8, 13, 19, 22, 23 et 24.
- **Seuil de 8 (montrable à Will)** : 12, 8 et 17.
- **Entre 6,5 et 7,9** : 3, 7, 9, 11, 13 et 22.
- **Sous 6,5, à refaire** : 1, 2, 4, 5, 6, 10, 14, 15, 16, 18, 19, 20, 21, 23 et 24.

---

## 2. Jugement de l'ensemble

### 2.1 Les vrais progrès sur la planche refusée
- **Les formes.** Disque, triangle, étoile, blob, bulle en dents de scie, typographie verticale, tampon : la part non rectangulaire atteint **environ 75 %**, contre presque 0 % pour les cartes. Le reproche « toujours carré » est **en grande partie levé**.
- **Les coups de poing sont nettement meilleurs**, et tous différents : tampon, triangles, rafale, éclat-chiffre, dalle. Les 4 plein écran de la planche refusée étaient des aplats avec un mot centré ; ceux-ci ont chacun leur géométrie.
- **Trois gestes réellement nouveaux sur Will** : le mot vertical au bord (12), les bandes diagonales (7) et le mot qui saute (11).

### 2.2 Ce qui va encore paraître « plat » à Will
1. **C'est trop petit, surtout sur les côtés.** Sur les 19 éléments où l'on voit Will, **11 occupent moins de 3 % de l'image** : 1, 2, 6, 10, 14, 15, 16, 19, 23, 24 et 20 sans sa pastille. **Seuls 12, 7 et 9 sont « grands »**. Le grief exact de Will (« pas de motion design sur le côté ») **reste vrai** : les éléments latéraux 1, 2, 6, 19, 23 et 24 sont tous de petites vignettes de 0,20 L. À la taille d'un téléphone, ce sont des timbres-poste.
2. **Un nouveau tas, en haut cette fois.** 8 éléments sur 19 finissent dans la bande y < 0,30 H, près du crâne : 5, 10, 11, 14, 15, 16, 23 et 24. La planche refusée avait « tout en bas » ; celle-ci a « beaucoup en haut ». Le **bas-centre** n'a pas disparu : 9 et 20 sont exactement à l'endroit critiqué en A.1, et le mot de 4 aussi.
3. **Il y a peu d'orange plein sur les plans où l'on voit Will.** Seuls 12, 21 et (en partie) 7 dépassent 3 % de surface orange pleine. 9, 18, 24 et 14 sont encre, ivoire ou en filet.
4. **Il y a encore beaucoup d'éléments droits.** À l'état posé, 6, 9, 14, 16, 18, 19 et 20 sont à 0°. On compte environ 55 % d'éléments inclinés de 3° ou plus, pour 60 % demandés en D5.
5. **La texture « fait main » est invisible à la taille d'un téléphone** : grain, fibres et encre ne ressortent nettement que sur le tampon (3). Les éléments 16, 20, 24 et 10 ont un rendu de **pastille de modèle gratuit**.

### 2.3 Les éléments trop semblables (test de silhouette, à l'œil)
- **Les formes à pointes** : 16 (étoile), 23 (bulle en dents de scie) et 17 (éclat). La silhouette de 16 et de 23 est très proche (petite forme dentelée en haut d'un coin). Il faut garder 17, éloigner 23 (plus grand, débordant, avec une queue marquée) et refaire 16.
- **Les disques** : 6 (pastille), 24 (badge), la pastille de 20 et 9 (dôme). Ce sont 4 cercles, dont 3 petits. Il faut différencier par la taille : 6 à 0,30 L, 24 à 0,32 L et débordant, la pastille de 20 seulement en accent.
- **Les mots en haut** : 11, 14, 15 et 16 ont le même résultat final (un mot horizontal au-dessus du crâne).
- **Le cadre autour de la tête** : 14 (super-ellipse) et 18 (anneaux) se ressemblent.
- **Le mot « FUITE »** sert dans 11, 15 et 22, et il était déjà le mot de la planche refusée. Il faut **varier les mots d'exemple** sur la planche, sinon Will lira « toujours la même chose ».

### 2.4 Ce qui manque
- **Les extraits vidéo de 2 s et l'enchaînement de 15 s** (F.3). Sans eux, Will jugera à nouveau des images fixes, et donc il trouvera ça « sans énergie ». **C'est le manque le plus grave.**
- **Un élément latéral GRAND à droite.** À gauche, il y a 12 ; à droite, il n'y a rien d'équivalent (19, 23 et 24 sont petits). Il faut au moins un miroir de 12, ou un 19 trois fois plus grand.
- **Un élément en vraie diagonale haute** : E6 « coin bas-droit vers côté droit » n'est pas représenté (24 roule, mais petit).
- **Les sorties ne sont pas visibles sur les planches** (lot 1 : « sortie » = posé). La règle « deux sorties consécutives ne se ressemblent jamais » n'est pas démontrée.

### 2.5 Verdict d'ensemble
**C'est un vrai progrès, mais ce n'est pas encore « exceptionnel et moderne ».** Les plein écran et 3 éléments sur Will (12, 7, 11) ont le niveau. Le reste est **le même défaut avec une autre forme** : de petits objets posés près du crâne, droits, avec peu d'orange. Présentée telle quelle, la planche a de fortes chances de valoir à nouveau à Will le reproche « sur le côté, il ne se passe rien ». **Le levier n° 1 n'est pas le dessin, c'est l'ÉCHELLE** : aucun élément sur Will sous 6 % de l'image, et au moins un élément sur trois au-dessus de 12 %.

---

## 3. Corrections priorisées, par lot

### Transverses (avant tout le reste)
1. **Corriger le standard § D** : les fiches 1, 6, 10, 16, 19, 23 et 24 passent à **au moins 6 % de l'image** (cotes ci-dessus), pour qu'elles s'accordent avec B.5.
2. **Une seule prise par défaut pour les 5 planches**, sans descente sauf pour E1, et sans image agrandie dans le lot 5. Ensuite, contrôler Z par code sur chaque image (et non à l'œil).
3. **Planche F.3 complète** : extrait de 2 s par élément et **enchaînement de 15 s**. Sans cela, ne rien montrer à Will.
4. **Mots d'exemple variés** : pas de « FUITE » sur trois éléments.
5. Vérifier en vidéo les **9 « ? » d'éliminatoire** (visage partiel au plus 3 i : 3, 8, 13, 22 ; zone Z : 4, 19, 23, 24 ; lisibilité : 2, 10, 16, 24).

### Lot 1 « Papier & collage »
1. **5 ticket** : refonte (papier orange, 0,62 L, -5°, sur la prise).
2. **2 scotch** : tripler la surface, rendre les scotchs visibles.
3. **1 autocollant** : 0,36 L, élan depuis 1,6 et +28°.
4. **4 flèche** : diagonale à 40°, pointe à Z + 0,03, sortie dé-tracée.
5. **3 tampon** : 0,75 L, gouttes, scotchs, papier ivoire.

### Lot 2 « Géométrie franche »
1. **10 losange** : côté de 0,22 L.
2. **6 pastille** : 0,30 L, débordante, -8°.
3. **9 demi-lune** : orange, décentrée à 0,34 L, inclinée.
4. **7 bandes** : 0,08 H chacune, un mot par bande.
5. **8 duel** : glissement en 3 i.

### Lot 3 « Typo personnage »
1. **14 orbite** : abandonner, ou refonte totale (lettres orange sur un arc, sans filet, sans troncature).
2. **15 barré-remplacé** : plus grand, collage incliné.
3. **13 rafale** : récapitulatif à 3 mots, aucune lettre restée sur le visage à la sortie.
4. **11 mot-saute** : atterrir à droite, 0,42 L, -8°.
5. **12 vertical** : 1re lettre coupée, s'arrêter à 0,58 H, grain.

### Lot 4 « Impact / énergie »
1. **19 traits de vitesse** : multiplier la taille par 2,5, mot orange, hors de la marge de Z.
2. **16 éclat-mot** : 0,34 L, mot de 81 px, incliné.
3. **20 gerbe** : quitter le bas-centre (origine à 0,72 L), plus grande.
4. **18 onde** : épaisseur doublée, sans sable, arcs ouverts vers le bas.
5. **17 éclat-chiffre** : éclat de 1,3 L (simple retouche).

### Lot 5 « Organique & objets »
1. **24 badge** : 0,32 L, texte de 0,045 L, couronne orange, hors de la tempe.
2. **22 dalle** : vrai blob à la sortie, visage dégagé à i25.
3. **23 bulle** : 0,30 L, à revérifier sur la prise par défaut.
4. **21 blob** : 8 points asymétriques, 0,46 L.

---

## 4. Résumé (15 lignes)

1. Moyenne de 6,1 sur 10. Seuls 3 éléments atteignent le seuil de 8 : `mot-vertical-bord` (12), `duel-triangles` (8) et `eclat-chiffre` (17).
2. Aucun éliminatoire n'est certain, mais 9 restent à vérifier en vidéo : visage partiel (3, 8, 13, 22), zone Z (4, 19, 23, 24) et lisibilité (2, 10, 16, 24).
3. On ne peut pas comparer les 5 planches : la prise est cadrée différemment dans chaque lot (descente dans le lot 1, image agrandie 1,18 fois dans le lot 5).
4. Les planches ne montrent ni extraits vidéo ni enchaînement de 15 s (F.3) : on juge l'énergie sur des images fixes, comme lors du refus.
5. « Toujours carré » est en grande partie corrigé : environ 75 % de formes non rectangulaires.
6. Les 5 coups de poing sont le point fort : chacun a sa propre géométrie.
7. Le défaut principal reste l'échelle : 11 des 19 éléments où l'on voit Will occupent moins de 3 % de l'image.
8. Le grief « pas de motion design sur le côté » tient toujours : à droite, les éléments sont des timbres-poste (19, 23, 24, 1).
9. Le standard est en cause : les fiches 1, 6 et 23 sont dessinées sous le seuil de 6 % de sa propre règle B.5.
10. Un nouveau tas s'est formé en haut (8 éléments au-dessus de 0,30 H), et le bas-centre persiste (9, 20).
11. Il y a peu d'orange plein sur les plans où l'on voit Will, et encore environ 45 % d'éléments droits à l'état posé.
12. Plusieurs éléments se ressemblent : les formes à pointes (16 et 23), les disques (6, 24, 20, 9), les mots en haut (11, 14, 15, 16), et le mot « FUITE » apparaît 3 fois.
13. À abandonner : `orbite-lettres` (14). À refondre : `ticket-dechire-haut` (5). Tous les autres, sauf 12, 8 et 17, sont à corriger avec les cotes du tableau.
14. Dans l'ordre : corriger les fiches à 6 % minimum, refaire les planches sur une seule prise, produire les extraits vidéo, puis appliquer les corrections lot par lot.
15. En l'état, ce n'est pas « exceptionnel ». Avec l'échelle corrigée et les vidéos, la série peut l'être.
