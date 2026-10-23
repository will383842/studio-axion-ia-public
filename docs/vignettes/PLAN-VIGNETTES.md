# Plan des vignettes : un socle Axion et une variante par générateur

*17/10/2026. Maquettes seulement : aucun code de production n'est modifié.*

> **V2 (17/10, après votre retour) : lisez d'abord la section « V2 » ci-dessous.** Les sections 1 à 9 décrivent la v1 ; ce qui change est dit dans la V2.

---

## V2 — vraie image de la vidéo, peps, diversité

Votre retour : *« les maquettes manquent de peps ; il faut vraiment la perfection ; il faut de la diversité ; les maquettes sont propres à chaque type de vidéo ? pour les jaquettes facecam, ne faudrait-il pas que ce soit directement une image de la vidéo ? quelles sont les meilleures pratiques ? »*

Réponses courtes :
- **Oui, une vraie image de la vidéo.** C'est désormais le cœur de l'architecture (ci-dessous).
- **Oui, propres à chaque type de vidéo** : chaque générateur a son objet signature et ses 3 mises en page.
- **Peps** : orange vif #E07040 dominant, lumière de contour, profondeur, 3 éléments au plus.
- **Diversité** : 3 mises en page × 2 ambiances par générateur, qui tournent d'une vidéo à l'autre.

Maquettes : `docs/vignettes/v2/` (planches dans `v2/planches/`). Relectures : `docs/vignettes/v2/CRITIQUES.md`.

### Le cœur de l'architecture : le studio choisit l'image dans la vidéo, la détoure et la pose sur le gabarit

**Ce que ça change pour vous :** vous n'avez plus de photo à fournir. La vignette montre ce qu'on voit dans la vidéo.

1. **Choisir** (`v2/outils/choisir-image.py`, local, gratuit). Le studio note 6 images par seconde, hors début et fin (fondus) :
   - un visage doit être détecté ;
   - les **yeux ouverts** (clignement < 0,35) ;
   - la **bouche fermée** (ouverture < 0,18), sauf si l'expression est marquée (sourire, sourcils) ;
   - ensuite : note = netteté × force de l'expression × taille du visage. La meilleure gagne.
   - Sans visage (tableau animé, cas concret, image → vidéo, motion) : netteté × contraste × couleurs × **image immobile** (pas une image prise en pleine transition).
   - Le studio lit la piste **avant les sous-titres** (sinon le texte incrusté gâche l'image). Pour les maquettes, on a pris un passage sans sous-titre.
2. **Détourer** : rembg (modèle local, sans appel payant). Repli : fondu bas + lumière de contour quand le corps se confond avec le fond.
3. **Cadrer** (`v2/outils/cadrer.py`) : le studio mesure où est le visage. Le gabarit le pose à une **taille donnée** : sur au moins une mise en page, le visage occupe ≈ 30 % de l'image (jusqu'à 40 % en très gros plan).
4. **Poser sur le gabarit** : ambiance, mise en page, titre, objet signature.

Voir `v2/planches/architecture.jpg` : candidates notées → la meilleure → détourée → vignette.

**À savoir :** aucune vidéo du dépôt ne vous montre. Les maquettes utilisent les visages des vidéos de test du dépôt (une femme de test, un personnage illustré, le mannequin de l'avocat). Avec vos vidéos, la chaîne fera la même chose avec votre visage.

### Le socle v2 (ne bouge jamais)

1. **Liseré** orange sur tout le bord gauche.
2. **Carré « A »** orange en haut à gauche, même place partout ; en 9:16, « axion-ia.com » est collé à sa droite (bloc-marque). L’étiquette de texte de la v1 disparaît : en petit, c’était une tache.
3. **Titre** Montserrat ExtraBold, capitales, **3-4 mots**, 2 lignes.
4. **Un mot sur pavé orange**, légèrement incliné.
5. **Contour automatique du titre** (ombre encre en sombre, contour ivoire en clair) : lisible sur n’importe quelle image.

### Les deux ambiances
- **Sombre « encre »** : fond #110A05, grand halo orange vif derrière le sujet, lumière de contour orange autour du visage. Pavé orange vif #E07040, texte encre (contraste 6:1).
- **Claire « ivoire »** : fond ivoire lumineux, sujet avec une ombre orange décalée (effet autocollant). Pavé orange brûlé #B44F29, texte ivoire.

### Diversité dans la cohérence
- Chaque générateur a **3 mises en page vraiment différentes** (gros plan, visage d'un côté et titre de l'autre, objet géant + visage moyen), × 2 ambiances.
- D'une vidéo à l'autre, la mise en page **tourne**, et l'ambiance suit un motif : **jamais deux vignettes voisines identiques** (contrôlé par le script, voir `v2/planches/grille-profil.jpg`).
- On vous reconnaît d'un coup d'œil grâce au liseré, au carré « A » et au pavé orange.

### L'objet signature de chaque générateur

| Générateur | Image de la vidéo | Objet signature |
|---|---|---|
| Face caméra | visage (gros plan) | cadran de temps orange |
| Avocat | mannequin de la vidéo, contre-jour | balance de justice orange |
| Face caméra animée | visage | cartes « autocollants » qui jaillissent |
| Selfie | visage incliné | grand disque / bulle de dialogue |
| Créateur B | visage | coupe rapide (bandes, flou de vitesse, éclair) |
| Podcast | deux visages face à face | micro de studio |
| Écran partagé | visage + le vrai écran de la vidéo | coupure nette visage / écran |
| Avis client | visage + téléphone | téléphone, étoiles dessinées, guillemet géant |
| Tableau animé | le vrai dessin du paperboard | cercle et flèche au feutre |
| Cas concret | les vraies notifications de la vidéo | pile en 3D, coches |
| Image → vidéo | la vraie photo de la vidéo | le sceau qui « sort du cadre », pellicule |
| Motion | le vrai « 9 h » de la vidéo | anneaux, éclats |

### Test A/B : 3 vignettes par vidéo
Le studio propose **3 vignettes** à « Tester et comparer » de YouTube, en ne changeant **qu'une chose à la fois**, mais de façon bien visible :
- soit la **composition** (mise 1 / 2 / 3, même titre, même ambiance) ;
- soit le **texte** (3 titres, même image).
Voir `v2/planches/trios-ab.jpg` (face caméra et tableau animé : composition ; avocat : texte).

### Instagram
Toujours une **variante sans visage** pour chaque générateur à visage : l'objet signature en héros, personne à l'image (`v2/planches/instagram-sans-visage.jpg`).

### Règles du texte (inchangées, rappel)
Jamais « Villeexemple », « Aucun gain garanti », « Certifexemple certifié », « faites-le vous-même ». Aucun logo ni nom de client. Pas de promesse chiffrée sans source. Le gabarit refuse seul un titre interdit.

### Ce que j'attends de vous (v2)
1. **Regarder** `v2/planches/grille-profil.jpg` et `v2/planches/avant-apres.jpg`, puis dire si le peps et la diversité vous vont.
2. **Valider la règle « image de la vidéo, détourée »** (`v2/planches/architecture.jpg`).
3. **Choisir les ambiances** : sombre et claire en alternance (proposé), ou une seule.
4. **Envoyer 2 ou 3 vraies vidéos de vous** (face caméra), pour refaire les maquettes avec votre visage.
5. Donner le **feu vert du lot 1** (socle v2 dans le studio).

---

## Meilleures pratiques (recherche du 17/10/2026, sources 2025-2026)

**Ce que ça change pour vous :** rien à retenir. Ces règles sont dans le gabarit. Le détail et les liens sont dans `v2/RECHERCHE.md`.

| Règle | Ce qu'on en retient | Source |
|---|---|---|
| Un seul sujet, une émotion claire | Visage expressif, jamais neutre ni flou. Les visages « choqués » exagérés s'essoufflent dans le conseil et la tech | vidiq.com (guide 2026) ; miraflow.ai (2026) |
| Peu de mots | 3 à 5 mots qui complètent le titre de la vidéo, sans le répéter | vidiq.com (2026) ; miracamp.com (2025) |
| Peu de couleurs, fort contraste | 2 à 3 couleurs, fond simplifié pour détacher le sujet | miracamp.com (2025) |
| Sujet détouré + aplat de couleur | Le style le plus répandu en 2026 ; garder un rendu propre, pas trop « lisse IA » | miraflow.ai (2026) |
| Tester en petit | Vérifier à ~150-160 px de large (téléphone) | hellothematic.com |
| Coin bas droit | Réservé à la durée | movavi.com (2025) |
| Grille Instagram 3:4 | La couverture 9:16 est rognée à 1080×1440 : tout l'important au centre | hopperhq.com (2026) ; growthscribe.com (2026) |
| Shorts | Zone sûre ~840×960 au centre ; l'image de couverture est souvent une image de la vidéo | revid.ai ; kapwing.com ; vidiq.com |
| Test A/B YouTube | 3 vignettes au plus. Le gagnant est jugé à la **part du temps de visionnage**, pas au taux de clic. Jusqu'à 14 jours | support.google.com/youtube/answer/13861714 |
| Test A/B : quoi changer | Une variable à la fois, mais des écarts bien visibles. Les petites différences ne concluent rien | touhfa.art ; toptal.com |
| Cohérence de série | Palette fixe, même police, gabarit réutilisable ; varier 2 à 3 mises en page | rizzle.com ; vidiq.com (2026) |

**Ce qui reste incertain :** aucune source sérieuse ne chiffre la taille idéale du visage (nos 30-40 % sont un choix de travail). Aucune ne compare « image de la vidéo » et « montage ». Les gains de taux de clic cités (+20-30 %, etc.) viennent de blogs, sans source vérifiable.

---

## V1 (archive)

## 0. En une phrase

Toutes vos vignettes partagent **cinq repères fixes**. On les reconnaît sans lire votre nom. Chaque générateur ajoute **un seul élément visuel à lui**, toujours au même endroit, pour qu'on sache aussi le type de vidéo.

---

## 1. Ce que disent les meilleures pratiques (recherche du 17/10/2026)

**Ce que ça change pour vous :** les règles ci-dessous sont déjà appliquées aux maquettes. Vous n'avez rien à retenir.

| Règle | Chiffre retenu | Source |
|---|---|---|
| YouTube : taille | 1280×720, 16:9, 2 Mo maximum, JPG ou PNG | thumbnailtest.com/guides/youtube-thumbnail-size ; havecamerawilltravel.com/youtube-thumbnail-size |
| YouTube : lisibilité | Concevoir pour le téléphone, tester en très petit. On vérifie à **160 px** de large | vidiq.com/blog/post/youtube-thumbnail-tips |
| YouTube : contenu | 3 éléments au plus (personne, fond, texte), **3 à 5 mots**, visage avec une émotion, fort contraste | vidiq.com (ci-dessus) ; subscribr.ai/youtube-strategy/youtube-thumbnail-best-practices |
| YouTube : durée de la vidéo | Rien d'important en bas à droite (on réserve 140×60 px) | Usage courant, aucune source officielle chiffrée |
| YouTube : tests | « Test & Compare » : jusqu'à 3 vignettes par vidéo. Le gagnant est jugé au temps de visionnage | 1of10.com/blog/how-to-ab-test-youtube-thumbnails ; tubefilter.com (27/06/2023) |
| Reels / TikTok / Shorts | 1080×1920 | hopperhq.com/blog/instagram-reel-size |
| Grille Instagram | Passée en **3:4** (janvier 2025) : il reste la bande y 240 → 1680 de la couverture | hopperhq.com (ci-dessus) |
| Interface TikTok | Haut ~240 px, bas ~480 px, droite ~140 px (boutons) | revid.ai/tiktok-safe-zone ; poster.ly/tools/tiktok-safe-zone-checker |
| Rognage carré (1:1) | Il reste la bande y 420 → 1500. **Tout l'important tient dans ce carré** | Calcul |
| LinkedIn | 4:5 (1080×1350) en priorité, la vignette suit le même cadre | brandwatch.com/blog/linkedin-video-specs |
| Affiche de page web | L'image `poster` compte pour la vitesse d'affichage (LCP). Elle doit être préchargée et légère | web.dev/articles/lazy-loading-video ; web.dev/patterns/web-vitals-patterns/video/video |
| Série reconnaissable | Gabarit fixe : police, palette, mise en page, un accent de couleur signature (ex. le rouge de MKBHD) | rizzle.com (how-to-create-consistent-youtube-thumbnails) ; tubecore.xpanddigital.io |
| Contraste | WCAG AA : 4,5:1 (texte normal), 3:1 (grand texte) | w3.org, Understanding WCAG 2.0 : Contrast (Minimum) |

Points encore incertains (à confirmer dans les applications, sans frais) : taille exacte de la durée YouTube, zones sûres exactes Reels, vignette LinkedIn hors publicité.

---

## 2. L'existant (audit)

**Ce que ça change pour vous :** le studio fabrique déjà des miniatures. On garde ce qui marche et on change le style.

- `src/domaine/miniatures.ts` : tire du titre un **titre de couverture de 5 mots au plus** et un **mot clé** (un nombre d'abord, sinon le mot le plus long). Choisit 3 instants de la vidéo. Il ne faut **pas le changer**.
- `studio-rendu` (opération `miniature`) : prend la plus nette de 5 images, pose le titre avec Remotion (`compositions/commune/Miniature.tsx`) et livre un JPEG de 2 Mo au plus. Il utilise Montserrat **Black**, les couleurs du studio (#16120F, #E07040) et une pastille crème sur le mot clé. **Défauts :** une seule allure pour tous les générateurs, pas de repère de marque, pas de photo d'appui fournie, pas de contrôle des mots interdits.
- `OngletMiniature.tsx` : 3 propositions et un champ « Titre de couverture ». Vous ne pouvez choisir ni le mot orange ni la variante.
- `monteur/couverture.ts` : sert au monteur pour comprendre « enlève le numéro du titre ». Ce fichier ne fabrique pas d'image.
- La fiche format (`src/formats/types.ts`) **n'a aucun champ vignette**. Le guide `AJOUTER-UN-FORMAT.md` interdit à un format de choisir ses couleurs ou ses polices. C'est cohérent avec ce plan : le socle est commun, le format ne déclare que sa variante.
- **Aucune vraie photo de vous** dans le dépôt. Sur les maquettes, une **silhouette en contre-jour** tient la place de votre visage. En production, c'est l'image de la vidéo, détourée.

### Quelle charte comme base ?

**Choix : la charte des visuels réseaux (Buffer).** Encre #110A05, orange brûlé #B44F29, ivoire #E9DCC8, sable #BFA88B, Montserrat ExtraBold + Inter.

Pourquoi :
1. Une vignette est un visuel de réseau. Elle doit ressembler à vos publications Buffer pour qu'on vous reconnaisse **d'un post à une vidéo**.
2. Cette charte est déjà verrouillée dans le code (`src/briques/habillage/charte-video.ts`) et dans l'habillage des vidéos. Vignette et vidéo parlent donc la même langue.
3. La charte du studio (#16120F, Archivo Black) sert à l'interface. Celle du site (terracotta #B23F16, Fraunces) est faite pour lire, pas pour être vue à 160 px.

**Un seul écart, justifié par la lisibilité en petit :** dans la charte, le mot est *écrit* en orange #B44F29 sur l'encre (contraste 3,8:1). Sur les vignettes, il devient un **pavé orange avec le texte ivoire dessus** (contraste 3,8:1 aussi). Les deux passent le niveau AA pour le grand texte (3:1 au moins), et le titre est toujours un grand texte. Le pavé a un avantage : à 160 px de large, des lettres orange fines se fondent dans le fond sombre, alors qu'un **bloc de couleur** reste visible. Le pavé reste le seul élément orange vif de la vignette. Le reste du titre (ivoire sur encre) atteint 14,5:1, et la signature sable 8,6:1.

---

## 3. Le socle commun (identique sur toutes les vignettes)

**Ce que ça change pour vous :** une personne qui fait défiler son fil vous reconnaît avant de lire. Ces 5 repères ne bougent jamais.

1. **Le liseré orange** : une bande orange sur toute la hauteur du bord gauche (18 px en 16:9, 22 px en 9:16). C'est votre signature visuelle : même en tout petit, elle fait un trait orange.
2. **Le coin** : en haut à gauche, un carré orange avec un « A » ivoire, collé à l'**étiquette du générateur** (pictogramme orange + nom en capitales). Même place partout.
3. **Le titre** : en bas à gauche, Montserrat ExtraBold, en capitales, ivoire, **2 lignes, 3 à 5 mots**.
4. **Le mot orange** : **un seul** mot du titre sur un pavé orange brûlé. C'est le mot qui pique (un chiffre, l'objet du problème).
5. **L'ambiance** : fond encre, lumière chaude venant du coin haut gauche, dégradé sombre sous le titre, grain léger, photo désaturée et réchauffée (ton « magazine économique »).

À cela s'ajoute la **signature** « axion-ia.com » en sable sous le titre, seulement sur les formats verticaux. En 16:9, le coin suffit et la durée occupe le bas.

**Grille :**
- 16:9 (1280×720) : marge de 58 px. Le coin est à (58, 48). Le titre fait au plus 640 px de large, en bas à gauche. Le visuel du générateur occupe la moitié droite. Rien d'important dans les 140×60 px du bas à droite.
- 9:16 (1080×1920) : le coin est à y 456 et le bas du titre à y 1450. **Tout ce qui compte est entre y 420 et y 1500** : ça survit au rognage carré, au rognage 3:4 d'Instagram et aux boutons de TikTok. La marge droite est de 140 px. Au-dessus et en dessous de cette bande : du décor uniquement.

**Traitement photo :** saturation −22 %, une pointe de sépia, luminosité −18 %, contraste +6 %. Une photo n'apparaît jamais en couleurs brutes.

---

## 4. Une variante par générateur

**Ce que ça change pour vous :** en un coup d'œil, on sait aussi *quel type* de vidéo c'est. La variante ne touche **que** le calque visuel et l'étiquette, jamais le socle.

| Générateur | Étiquette (picto) | Élément distinctif | Visage ? | Titre d'exemple |
|---|---|---|---|---|
| Avocat (AV) | Le droit expliqué (balance) | Bibliothèque sombre, grande incrustation « 2ᵉ caméra », balance au trait | oui | LICENCIÉ PAR **SMS** ? |
| Face caméra (FC) | Face caméra (caméra) | Très gros plan dans un viseur, fond uni chaud | oui | OÙ FUIT VOTRE **TEMPS** |
| Face caméra animée (FA) | Face caméra animée (cartes) | Cartes « autocollants » inclinées autour du visage | oui | **3 TÂCHES** POUR L'IA |
| Tableau animé (TB) | Tableau animé (craie) | Panneau crème incliné, dessin au feutre | non | L'ERREUR **COÛTE** CHER |
| Cas concret (CC) | Cas concret (rouages) | 3 étapes en perspective reliées par un fil lumineux | non | LE BLOG QUI **S'ÉCRIT** SEUL |
| Image → vidéo (IV) | Image → vidéo (image) | Infographie qui se décolle en couches 3D | non | UNE IMAGE PREND **VIE** |
| Podcast (PO) | Entretien (micro) | Deux personnes face à face, micro au centre | oui | L'IA CONTRE LES **AVOCATS** |
| Créateur B (WC) | Format court (éclair) | Portrait découpé en bandes décalées (coupe rapide) | oui | ARRÊTEZ DE **TOUT** RELIRE |
| Écran partagé (EP) | Écran partagé (écran) | Image coupée en deux : vous et l'appli | oui | UN DEVIS EN **2 MINUTES** |
| Motion design (MO) | Motion design (courbe) | Chiffre géant et graphiques façon magazine | non | 3 CHIFFRES SUR L'**IA** |
| Avis client (UG) | Avis client (téléphone) | Téléphone incliné, étoiles, guillemet géant | oui | MES DEVIS **FILENT** SEULS |
| Selfie (SE) | Selfie (bulle) | Visage dans un grand cercle, bulle de dialogue, bureau clair | oui | JE VOUS **RACONTE** ÇA |

**Règle de l'orange** : le pavé du titre est le **seul orange vif**. L'élément distinctif utilise l'ivoire, le sable, ou un orange atténué. Aucun texte en plus du titre, de l'étiquette et de la signature : pas de « REC » ni de « ON AIR ».

(Les corrections issues de chaque relecture sont dans `docs/vignettes/CRITIQUES.md`.)

**Instagram, sans votre photo.** Les 8 générateurs à visage ont une **variante sans visage** (`maquettes/instagram/`). Elle garde l'élément distinctif (le viseur, les micros, le téléphone, le cercle…) mais ne montre personne.

---

## 5. Les déclinaisons par destination

**Ce que ça change pour vous :** une seule vignette sert partout. On ne la refait pas pour chaque réseau.

| Destination | Taille | Règle |
|---|---|---|
| YouTube (vidéo longue) | 1280×720 JPEG, 2 Mo au plus | Mise en page 16:9 |
| Reels, TikTok, Shorts | 1080×1920 | Mise en page 9:16. L'important tient entre y 420 et y 1500 |
| Grille de profil Instagram (3:4) et TikTok | Rognage de la 9:16 | Automatique, rien à refaire (voir `planches/grille-profil.jpg`) |
| LinkedIn | 1080×1350 (4:5) | Rognage de la 9:16 au centre (y 285 → 1635) : coin, visuel et titre y tiennent |
| Carré (1:1) | 1080×1080 | Rognage y 420 → 1500 |
| Affiche de page web | 1280×720 en AVIF (repli WebP), visé < 80 Ko | Version 16:9 **sans titre** (le texte de la page fait le titre), préchargée |

---

## 6. Les règles du texte

**Ce que ça change pour vous :** le studio refuse seul une vignette fautive, avant que vous la voyiez.

- **3 à 5 mots**, 2 lignes, **une seule taille** pour toute la série. Si le titre ne tient pas, le studio le réduit de 15 % au plus, puis il le raccourcit. Il ne le rapetisse jamais davantage. Le studio tire déjà ce titre court de celui de la vidéo (`couvertureDepuisTitre`).
- **Un seul mot orange** : un chiffre s'il y en a un (avec son unité : « 2 MINUTES » compte pour un), sinon le mot qui porte le problème. Vous pouvez le changer d'un clic.
- **Pas de promesse chiffrée sans source** (« 2 h gagnées », « 90 % des PME ») : sur une vignette, elle se lit comme une garantie.
- **Interdits, toujours :** « Villeexemple », « Aucun gain garanti », « Certifexemple certifié » (et « certifié/certifiée »), le nom ou le logo d'un client, les codes internes (« 0005-FC… »), les numéros de version.
- Pas de phrase entière, pas de point final, un « ? » permis.
- Aucun autre texte sur l'image que : l'étiquette, le titre et la signature.

---

## 7. Comment un NOUVEAU générateur hérite du socle

**Ce que ça change pour vous :** un générateur ajouté demain a sa vignette le même jour, sans nouveau travail de conception.

La fiche du format (`src/formats/<id>/index.ts`) déclarera un petit bloc `vignette` :

```ts
vignette: {
  etiquette: "Cas concret",      // le nom court affiché dans le coin
  picto: "rouages",              // choisi dans la liste commune
  variante: "flux-3-etapes",     // le calque visuel, pris dans un catalogue commun
  visage: false,                 // true = image de vous tirée de la vidéo
  sansVisage: "flux-3-etapes",   // la version Instagram (obligatoire si visage)
}
```

Le format ne choisit **ni couleur, ni police, ni marge**. Cela respecte la règle n° 2 de `AJOUTER-UN-FORMAT.md`. S'il ne déclare rien, il reçoit la variante neutre de sa famille (face caméra, motion, conversation…). Un test de contrat vérifiera que chaque format a un bloc `vignette` valide.

---

## 8. Architecture technique proposée (pour plus tard)

**Ce que ça change pour vous :** rien à faire de votre côté. C'est la feuille de route du studio.

1. **Gabarits** : une composition Remotion `VignetteAxion` dans `studio-rendu/compositions/commune/vignette/`. Elle contient un socle et un dossier `variantes/` avec un fichier par variante (calque visuel seul). Elle remplace `Miniature.tsx` en 16:9 et 9:16, puis on fait des rognages pour 4:5, 1:1 et l'affiche.
2. **Image de fond** : on garde `instantsMiniature` et la sélection de la plus nette. On ajoute : rejet des yeux fermés et de la bouche en mouvement (images voisines), puis détourage du visage pour les variantes à visage. Une entrée « photo d'appui » permettra aussi de fournir une image.
3. **Titre de couverture** : `couvertureDepuisTitre` et `motCleCouverture`, tels quels. L'onglet Miniature permettra en plus de toucher un mot pour le mettre en orange.
4. **Contrôle qualité automatique**, avant de vous montrer une vignette :
   - contraste du titre mesuré sur l'image réelle : ≥ 4,5:1 pour l'ivoire, ≥ 3:1 pour le pavé orange ;
   - lisibilité : réduction à 160 px puis lecture automatique du texte. Si le titre n'est plus lu, la vignette est refusée ;
   - zones sûres : aucun pixel de titre hors de la bande y 420 → 1500 (9:16), marge droite ≥ 140 px, ≥ 48 px entre le titre et le visuel, rien dans le coin de la durée (16:9) ;
   - texte interdit : une **liste unique** (aujourd'hui il en existe 4 copies), appliquée au titre de couverture ;
   - poids ≤ 2 Mo (YouTube), affiche ≤ 80 Ko.

### Lots, dans l'ordre

1. **Lot 1, le socle** : composition `VignetteAxion`, polices, 16:9 et 9:16, avec les variantes neutres par famille.
2. **Lot 2, les contrôles** : liste unique des mots interdits + contrôle sur la couverture, contraste, zones sûres, test à 160 px.
3. **Lot 3, les 12 variantes** et leurs versions Instagram sans visage.
4. **Lot 4, la fiche format** : bloc `vignette` dans `types.ts`, test de contrat, mise à jour de `AJOUTER-UN-FORMAT.md`.
5. **Lot 5, l'onglet Miniature** : choix du mot orange, aperçu de la grille de profil, export 4:5, 1:1 et affiche.
6. **Lot 6, le détourage** du visage et le choix de la meilleure image (yeux ouverts).

---

## 9. Ce que j'attends de vous

1. **Valider le socle** (liseré, coin « A », pavé orange). Ou dire ce qui vous gêne.
2. **Choisir 2 ou 3 vraies photos de vous** (visage net, lumière chaude, fond simple) pour remplacer la silhouette sur les maquettes et servir d'images de secours.
3. **Valider les étiquettes** des générateurs (ex. « Le droit expliqué » pour l'avocat, « Format court » pour Créateur B dont le style reste à définir).
4. **Dire si l'écart « pavé orange » vous va** à la place du mot écrit en orange (raison : lisibilité en petit).
5. **Donner le feu vert pour le lot 1.**
