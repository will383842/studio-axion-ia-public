# Journal du lot F3 « Effets spéciaux à la demande » — 09/10/2026 (session cloud, branche `feat/facecam-f3`)

Référence : `PLAN-FACECAM-v4.md` (L11b reporté après la livraison, « 3D autorisée », style « Spectaculaire »), `PLAN-IMPLEMENTATION-FACECAM.md` (L11 / L11b, tableau « Zoom sur ma main et mets [le logo] sur ma main »), `JOURNAL-D.md` (agent monteur, détourage à la demande) et `JOURNAL-C.md` (motion, CarteSurMesure). Branche créée depuis `origin/feat/facecam`, qui y a été refusionnée trois fois (lot E, puis F1, C2 et F4 ; l'intégration avait déjà fusionné une version antérieure de F3). Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché, aucune dépense (aucun appel Claude, HeyGen ni Higgsfield : tout est pur ou rendu en local).

## Fait

### 1. Trois opérations AJOUTÉES au vocabulaire du monteur (`src/moteurs/montage-facecam/monteur/effets.ts`)
- `objetMain { debutMot, finMot, objet, description }` : objet 3D posé sur la paume. `objet` ∈ `logo-axion` (par défaut), `telephone`, `cube`, `sphere`, `piece`, `etoile`, `coeur`.
- `vitreBrisee { auMot, dureeSec|null, revele: plan-suivant|carte, texteCarte|null, bruitage }`.
- `transitionEcran { auMot, style: ecran-plie|zoom-traversant, dureeSec|null }`.
- Ajoutées en FIN de `SCHEMAS_OPERATION` (sortie structurée inchangée pour les 15 opérations d'avant, même ordre).
- **Jamais automatiques** : une opération d'origine `auto` est écartée (« Effet spécial écarté : il ne s'applique que si vous le demandez. »). Elles viennent de « Monteur, … », de la case des demandes ou du fil « Discuter avec mon monteur ».
- Garde-fous (`appliquerEffetSpecial`) : transition de 0,6 à 1,5 s (ramenée, avec une phrase) ; **un seul effet fort à la fois** (zoom flou, cache-moi, texte derrière, arrêt sur image, autre effet spécial : la transition est décalée juste après si c'est à moins de 1,5 s, sinon écartée) ; 3 transitions au plus par vidéo, 4 s d'écart (le montage reste au-dessus de 90 % de coupes franches, grammaire du lot B) ; l'objet dans la main n'est jamais posé sous une carte plein écran ou une mise en page ; la main est cherchée sur 4 à 8 s après le mot (elle s'ouvre souvent après).
- Relecture tolérante : un effet aux champs oubliés est réparé (`reparerEffetSpecial`) au lieu d'être perdu ou transformé en carte sur mesure.
- Version simple (sans Claude) : `operationEffetParRegles`, testée AVANT les autres règles (« zoom à travers l'écran » n'est pas un zoom ; « brise l'écran et révèle « … » » donne la carte ; « sans bruitage » coupe le son).
- Catalogue « Que puis-je demander ? » : 3 entrées (« Objet 3D dans ma main », « Vitre qui se brise », « Écran qui se plie, zoom à travers l'écran »), règles « À LA DEMANDE SEULEMENT » lues par Claude ; leurs exemples s'ajoutent après les 8 exemples d'avant (inchangés).

### 2. Brique commune pure `src/briques/effets-speciaux/` (sans alias `@/`, lue par Remotion)
- `main.ts` — suivi et ancrage : pistes séparées par main (2 mains mêlées dans `mains[]` de la route `/visages`), segment où la main est ouverte (un raté isolé de MediaPipe ne ferme pas la main ; 2 fermées de suite ou un trou > 0,55 s la ferment), seuil 0,8 s (0,5 s au « Réessayer »), spline Catmull-Rom puis lissage aller-retour (**aucun retard**, testé), taille d'après `taille` si la route la donne, sinon 0,62 × largeur du visage ; apparition en ressort (éclat 0,6 s), disparition 0,3 s à la fermeture ou à la sortie ; **garde-fou visage en cascade** : si l'objet toucherait la boîte du visage + 8 %, il se pose SUR la paume, puis devant le bas de la main, puis se réduit ; l'écart de côté n'est que le dernier recours (`imagesObjetSurVisage` = contrôle, vide sur toutes les images testées).
- `lumiere.ts` — direction, teinte, ambiance et intensité de la vraie lumière, lues sur la zone du visage d'une image (`estimerLumiere`) ; repli d'après `luminanceVisage`.
- `transitions.ts` — géométrie déterministe : éclats (rayons irréguliers + anneaux, sommets partagés, découpe au cadre, couverture exacte de l'image testée), fissures (radiales franches, anneaux discrets), éclats détachés du centre vers les bords, souffle + gravité + rotation 3D projetée en perspective, **éclats poussés de côté devant le visage révélé** (couverture < 15 % aux ¾, < 5 % à la fin, testé) ; pli en vraie perspective : les deux bords se replient vers l'ARRIÈRE de part et d'autre du visage (qui reste face caméra), la feuille recule avec un liseré crème et son ombre portée, puis s'envole (quadrillage 16 × 22) ; zoom traversant (plongée × 12 puis iris à bord doux cerclé d'orange, plan suivant qui se pose de 1,45 à 1). Point d'impact / de pliure / de plongée toujours HORS du visage (`pointHorsVisage`).
- `demande.ts` — demandes pour l'opération `composition` EXISTANTE, sans mode (`EffetObjetMain`, `EffetTransition`) ; transition calée sur un raccord à moins de 0,6 s (vrai « plan suivant ») ; image figée = dernière image avant le mot ; `poserEffets` = même règle que les cartes plein écran.
- `son-verre.ts` — bruitage de verre synthétisé (impact, craquement, pluie, tintements), déterministe, sans fichier externe, + `wavMono16`.

### 3. Compositions Remotion `studio-rendu/compositions/commune/effets/` (inscrites par UNE ligne dans `Racine.tsx`)
- `EffetObjetMain` : la piste montée (`OffthreadVideo`), l'éclat (flash, onde, étincelles étirées par le mouvement), le reflet orange sur la paume, puis l'objet en **Three.js r159 local** (le même fichier que les cartes sur mesure), WebGL logiciel (`swangle`) : environnement de reflets construit d'après la lumière mesurée, lumière principale dans la direction mesurée, contre-jour orange, **ombre portée sur la paume** (capteur d'ombre invisible), ACES. Objets générés (`objets.ts`) : tuile du logo Axion extrudée et biseautée avec le « A » et le point en crème, téléphone (écran dessiné localement), cube, sphère à anneau, pièce, étoile, cœur.
- `EffetTransition` : plan révélé dessous, image figée découpée dessus dans un canevas 2D ; **flou de mouvement exact** (6 à 16 sous-instants sur l'obturateur à 180°, moyenne additive dans un canevas **float16** — en 8 bits, chaque ajout à 1/K perd un niveau et la teinte dérive ; repli automatique à 4 sous-instants si float16 manque).
- `PlateauEffets` : plateau de démonstration (personne dessinée, aucun visage réel ; main pilotée par une piste simulée).
- Tout dépend du numéro d'image : rendu déterministe, image par image.

### 4. Intégration prête côté moteur (`src/moteurs/montage-facecam/effets-speciaux.ts`)
- `preparerEffetsFacecam({ passages, piste, coupes, cadre, raccordsSec, pisteMonteeCle, prefixe })` → `rendus` (une demande par effet, avec ses entrées `piste` et éventuellement `carte`), `decisions`, `passages` mis à jour, `bruitages` (`verre`, au mot).
- **Repli sans main** : aucun rendu, passage marqué `sansDetourage: true` + `echecsEffet` → « Votre vidéo » affiche déjà « Effet non réussi — Réessayer » (drapeau du lot D, aucun écran modifié) ; `reessayerEffet` (lot D) remet le drapeau, le passage est réanalysé avec le seuil assoupli.
- Vitre qui révèle une carte : `carteARendre` (modèle `titre` de la brique motion) à rendre AVANT l'effet.
- `cartesPleinEcranEffets(rendus)` : les MP4 au format du supplément `cartesPleinEcran` du lot C (coupe franche autour, le son de la piste continue dessous).

### 5. Planche de démonstration — `docs/facecam/planche-effets/index.html`
- 6 vidéos de 5 s (0,5 à 2,5 Mo) (1080 × 1920, 25 i/s, MP4 < 3 Mo) : logo 3D dans la main, téléphone 3D (main qui monte près du menton : l'objet s'écarte), vitre → plan suivant (avec bruitage), vitre → carte « Le temps perdu », écran qui se plie, zoom à travers l'écran.
- Même chaîne que la production : plateau rendu en MP4 → servi en local (`servirDossier`) → compositions d'effets ; piste de main échantillonnée comme MediaPipe (une image sur 6, bruit) ; lumière mesurée sur le plateau.
- Régénérer : `cd studio-rendu && npx tsx scripts/planche-effets.ts` (`--images vitre` : images fixes de contrôle dans `.planche-effets/`, ignoré par git).

## Fichiers communs touchés (ajouts minimaux et facultatifs)
- `src/moteurs/montage-facecam/monteur/operations.ts` : `...SCHEMAS_EFFETS_SPECIAUX` en fin de liste ; relecture tolérante d'un effet avant le repli « carte sur mesure ».
- `src/moteurs/montage-facecam/monteur/appliquer.ts` : un bloc `if (estEffetSpecial(op))` (délégué à `effets.ts`) ; rien d'autre ne change.
- `src/moteurs/montage-facecam/monteur/role.ts` : effets reconnus en tête de `operationsParRegles` ; `resumeOperation` délègue les effets.
- `src/moteurs/montage-facecam/monteur/catalogue.ts` : `...CATALOGUE_EFFETS` en fin de catalogue ; `exemplesDemandes` garde ses 8 exemples (dont l'exemple de style du lot C2) puis ajoute les 3 effets.
- `studio-rendu/compositions/Racine.tsx` : `<CompositionsEffets />` (une ligne + import).
- `studio-rendu/.gitignore` : `.planche-effets/`.
- AUCUN changement de : contrat `studio-rendu`, opérations, `studio-aligneur`, domaine, services, écrans, avocat, `package.json`.

## Tests
- `tests/facecam-effets-speciaux.test.ts` (19 tests, dont le WAV du bruitage) : **schéma des opérations** (fin de liste, strict, relecture tolérante) ; jamais automatique ; garde-fous (durées, écart, nombre, un effet fort à la fois, pas sous une carte) ; version simple ; catalogue ; **ancrage main sur piste simulée** (2 mains séparées, raté isolé, suivi < 1,5 % sans retard, apparition/éclat/disparition, déterministe, visage jamais caché) ; **repli sans main** (aucune main, main trop brève, « Réessayer » avec seuil assoupli) ; carte révélée et bruitage ; géométrie des transitions (couverture, déterminisme, visage dégagé, rien après la durée).
- Non-régression : voir la fin de ce journal.

## Reste
- **Branchement dans la chaîne : FAIT par le lot I** (`src/moteurs/montage-facecam/effets-chaine.ts`, `JOURNAL-I.md`, fusionné ici) : rendus, carte révélée d'abord, effets ratés retirés avec « Réessayer », bruitage de verre, lumière, images de contrôle. Ses tests passent avec les derniers réglages de F3 (garde-fou en cascade, pli vers l'arrière, float16).
- `studio-aligneur/aligneur/visages.py` : ajouter, si souhaité, `taille` (distance poignet → base du majeur, en part de la largeur) à chaque échantillon de main ; sans elle, la taille vient du visage (correcte sur la planche).
- Essai sur une VRAIE prise de Will (main filmée, piste MediaPipe réelle) : la planche utilise un plateau dessiné et une piste simulée ; seuils à confirmer (0,8 s de main ouverte, 2 fermées de suite).
- Validation de Will sur la planche (comme les cartes du lot C) avant d'annoncer les effets.

## Points d'attention pour l'intégration
- **Look en double** (à vérifier dans le branchement du lot I) : `lookBroll` pose la LUT du Look sur TOUS les plans d'illustration ; les MP4 d'effets contiennent la piste montée, qui a DÉJÀ le Look. Exclure leurs plages (par exemple un drapeau `sansLook` sur le plan posé, filtré dans `plagesLookBroll`) avant de les poser. Les cartes motion reçoivent aussi le Look aujourd'hui : à vérifier avec le lot C.
- **Qualité** : l'opération `composition` sans mode rend en H.264 avec les réglages par défaut (8 bits) ; la piste montée est en 10 bits. L'effet ne dure que 0,6 à 8 s, mais un CRF bas (≈ 10, comme `rendreImageRemotion`) serait préférable si le contrat le permet.
- **Temps de rendu** (WebGL et canevas logiciels) : ≈ 1 à 3 s par image pour la vitre (7 sous-instants), moins pour l'objet ; un effet de 1,2 s = 30 images. Un seul effet fort à la fois et 3 transitions au plus bornent le coût.
- L'image figée passe par `OffthreadVideo.onVideoFrame` (canevas 2D : aucune contrainte CORS) ; l'objet 3D n'utilise aucune texture externe (WebGL sans CORS).
- Les passages d'effets sont de type commun `autre` ; leur opération est dans `operation` (comme les autres passages du monteur) : ne pas la filtrer en relisant `passages`.
- `echecsEffet` est un champ en plus sur le passage (comme `sansDetourage`) : à garder en recopiant.
