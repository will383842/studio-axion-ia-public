# Journal du lot C : habillage et motion design (09/10/2026)

Référence : `PLAN-FACECAM-v4.md`, plus précisément la section D (lot C), les corrections B.8 à B.10 et B.21 à B.23, le correctif « Motion design qualité extrême et centralisé » et la précision « animations à la demande ».

- Branche : `feat/facecam-c`, créée depuis `origin/feat/facecam`. Celle-ci y a été refusionnée deux fois : après les lots A, D, E1 et E2, puis après le lot B.
- Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché.

## Fait

### 1. Brique commune `src/briques/motion/` (tous les formats)

Les fichiers de la brique sont purs et n'utilisent pas d'alias `@/`. Ils sont lus tels quels par Remotion.

- **`jetons.ts` : charte motion imposée** (`VERSION_CHARTE_MOTION = motion-1`).
  - Couleurs :
    - sombre chaud `#16120F` ;
    - orange `#C65A2E`, avec ses variantes vive et profonde ;
    - crème `#F6EEE0` et crème atténuée ;
    - filet.
  - Typographie : Poppins de 500 à 900, hiérarchie en 4 tailles exprimées en part de la hauteur de la vidéo, plancher de 3 %.
  - Mise en page : grille et zones sûres. Les zones du 9:16 sont l'union des zones des réseaux.
  - Courbes signature (Bézier « expo maison », anticipation, sortie, glisse) et 3 ressorts.
  - Durées : entrée de 300 à 500 ms, sortie de 200 à 300 ms, décalage de 60 à 90 ms, chute finale obligatoire.
  - Caméra : poussée de 3 %/s au plus.
  - Les jetons sont aussi exportés en variables CSS (`--axion-orange`…) pour les cartes sur mesure.
- **`courbes.ts`** : Bézier (Newton puis dichotomie), ressort amorti exact, progrès, cycle entrée/chute, déplacement pendant l'obturateur (flou de mouvement), dérive et hasard déterministes.
- **`icones.ts`** : 39 tracés Lucide (licence ISC), copiés en données. Le fichier est généré par `scripts/motion/generer-icones.mjs` et les icônes se dessinent trait par trait.
- **`mesure.ts`** : mesure réelle du texte d'après la chasse de Poppins (métriques des sous-titres), coupure en lignes, hauteur des blocs et taille qui tient. C'est ce qui place les éléments sans chevauchement.
- **`types.ts` et `schemas.ts`** : données des 6 modèles (types purs pour Remotion, schémas Zod pour valider ce que renvoie Claude).
- **`catalogue.ts`** : les 6 modèles, avec composition, quand les choisir, durée, caractère automatique et exemple.
  - Le titre n'est jamais choisi automatiquement (B.21).
  - `CarteSurMesure` complète la liste.
- **`choix.ts` : choix automatique d'un modèle d'après une phrase**, par règles fixes, sans appel. Il sert aussi de repli à la version simple.
  - Il reconnaît un avant/après (« de 12 h à 3 h »), des étapes, une liste (« trois questions : … »), une comparaison ou un chiffre.
  - Il remplit les données et propose une icône.
- **`calage.ts`** : chaque élément d'une carte apparaît au mot dit, d'après les horodatages de l'aligneur. Les chiffres écrits retrouvent le mot prononcé.
- **`textes.ts`** : pont entre l'opération `ajouterCarte{modele, textes[]}` du lot D et les données typées. La convention est dans `CONVENTION_TEXTES`.
- **`sur-mesure.ts` : garde-fous et document de l'iframe.**
  - Contrôles :
    - durée de 3 à 8 s ;
    - aucune adresse, aucun réseau, aucun `eval` ;
    - rien qui dépende de l'horloge (animation CSS, minuterie, `Math.random`, `Date`) ;
    - couleurs de la charte seulement, Poppins seulement ;
    - texte d'au moins 3 % en px.
  - L'iframe a une politique de sécurité qui n'autorise aucune adresse. Elle reçoit `AXION.enregistrer(tl)`, `AXION.surImage(f)` pour la 3D et `AXION.hasard(n)`.
  - Le mode `controle` encadre en rouge les textes trop petits ou hors des zones sûres, pour l'image relue par Claude.
- **`demande.ts`** : mise en page (plein écran, ou moitié haute de 960 px en 9:16 et 45 % en 4:5 et 1:1) et paramètres de l'opération `composition` **existante, sans mode**. `preparerCarte` remplace une carte sur mesure refusée par le modèle fixe de repli.
- **`pose.ts`** : une carte plein écran devient un plan d'illustration vidéo.

### 2. Compositions `studio-rendu/compositions/commune/motion/`

- Elles sont inscrites dans `Racine.tsx` par une seule ligne, `<CompositionsMotion />`.
- **`noyau.tsx` : système de design commun**, appliqué à tous les modèles.
  - Fond vivant : deux lumières qui dérivent, trame en perspective, particules sur 3 profondeurs, vignette, et grain de tramage précalculé une fois.
  - Caméra : poussée lente avec parallaxe.
  - **Flou de mouvement directionnel**, calculé d'après le déplacement pendant l'obturateur à 180°.
  - Typographie cinétique : les mots ou les lettres se construisent en 3D avec un décalage de 60 ms. Un mot écrit `*mot*` passe en orange.
  - Icônes qui se dessinent, chiffres qui comptent, panneaux en relief, traits, filigrane en profondeur.
  - Rien ne reste figé plus de 1,5 s, chute dans la dernière seconde, 25 i/s.
- **Les 6 modèles** (`MotionListe`, `MotionChiffre`, `MotionAvantApres`, `MotionLigneDeTemps`, `MotionDeuxColonnes`, `MotionTitre`).
  - Ils fonctionnent en plein écran comme en moitié haute.
  - La ligne de temps avance avec la parole, la comparaison montre deux cercles et leur zone commune, le titre peut aussi servir de générique.
- **`CarteSurMesure`** : HTML, CSS et GSAP écrits par Claude, affichés dans une iframe `sandbox="allow-scripts"` sans même origine.
  - GSAP 3.13 (avec SplitText, DrawSVG, MorphSVG, MotionPath et CustomEase), Three.js r159 et Poppins sont **locaux**, dans `sur-mesure/vendeur/` et le fichier généré `bibliotheques.genere.ts`.
  - La timeline est calée image par image par `tl.seek(image/25)` : chaque image est attendue par `delayRender` jusqu'à l'accusé de l'iframe.
  - La carte se pose sur le fond vivant commun.
  - **Essai réel fait** (`studio-rendu/scripts/essai-sur-mesure.ts`) : garde-fous, SplitText, DrawSVG, polices et mode contrôle fonctionnent tous.

### 3. Planche de validation pour Will

- Elle se trouve dans `docs/facecam/planche-motion/` : `index.html` et les 6 MP4 (5 s, 1080×1920, 25 i/s, de 1,0 à 1,3 Mo chacun).
- Elle a été poussée tôt et une notification a été envoyée à Will.
- Pour la régénérer : `cd studio-rendu && npx tsx scripts/planche-motion.ts`. L'option `--images <modèle>` produit des images fixes de contrôle.

### 4. Paramètres FACULTATIFS de la composition commune

Absents, l'avocat ne change pas : c'est vérifié par un test.

- **`sourcePreCadree`** (`scene.ts`, `parametres.ts`, `image-ffmpeg.ts`, `ImageComposee.tsx`). La piste est déjà à la taille du ratio : ni bandes, ni second recadrage. Le punch-in reste une fenêtre agrandie, dans tous les ratios.
- **`source10bits`** :
  - `assemblage` produit un intermédiaire x264 10 bits à CRF 8 ;
  - `composition` produit un master 10 bits à CRF 8 ;
  - à l'export, le texte est posé en YUV 4:4:4 10 bits, puis **une seule** descente en 4:2:0 8 bits avec tramage par diffusion d'erreur (`sws_dither=ed`) et x264 `aq-mode=3` (B.8).
- **Écran partagé par passages** (`PlanScene.ecranPartage`).
  - La carte est en haut, la personne en bas.
  - L'entrée dure 9 images avec une courbe unique : la carte descend pendant que l'image de la personne glisse. La sortie est une coupe franche.
  - Elle fonctionne dans le graphe FFmpeg et dans le repli navigateur, et a été essayée en FFmpeg réel.
  - `poserEcransPartages` coupe les plans aux bornes de chaque passage. La carte d'un passage reste continue.
- **Sous-titres** :
  - `positionSousTitresPct`, entre 55 et 72 % ;
  - `DonneesCalque.passagesJonction` : pendant un écran partagé, la ligne se place à la jonction, jamais sur la bouche ;
  - groupes de 1 à 4 mots coupés par le sens, calés sur une coupe à moins de 0,2 s.
- **`lookBroll`** : la LUT du Look Will est appliquée aux plans d'illustration.
- **`cartesPleinEcran`** : des cartes motion plein écran, posées dans n'importe quel format, **avocat compris**. C'est son branchement facultatif sur la brique.

### 5. Brique `src/briques/habillage-facecam/` et moteur

- **Cadrage par calque** (B.23) :
  - moitié basse : yeux à 37,5 % de la demi-hauteur ;
  - côté : visage à 40 % de la largeur du cadre ;
  - vignette : 31 % de la largeur, prise sur la source 4K ;
  - bornes de la vidéo : image 0 au premier mot ; fin 7 images après le dernier mot, avec un fondu audio de 50 ms.
- **Écrans partagés planifiés** d'après le texte : 3 par vidéo au plus, de 3 à 8 s, 25 % de la durée au plus, 6 s d'écart, jamais dans l'accroche.
- **Sous-titres face caméra** : styles décidés, position et jonction.
- **B-roll** : refus des images avec filigrane, texte en anglais ou regard caméra ; durée de 1,2 à 2,5 s ; Mes images d'abord.
- **Encodage final** : `exportFacecam()`, avec un débit de 16 à 20 Mb/s et `source10bits`.
- **`src/moteurs/montage-facecam/habillage.ts`** (nouveau fichier, pur) :
  - `RECETTE_COMPOSITION_FACECAM` ;
  - `habillageFacecam()` : à partir de la piste montée du lot B, des mots montés, du visage et des cartes du monteur, il produit les cartes à rendre (une demande `composition` sans mode chacune, repli compris), l'`EntreeComposition` (pré-cadrée, 10 bits, écrans partagés, cartes plein écran, ligne des sous-titres, Look) et les segments de sous-titres.

### 6. Tests (liste gardée du plan)

- Nouveau fichier `tests/facecam-pre-cadre.test.ts` (7 tests) :
  - non-régression de l'avocat : aucune nouvelle clé, même graphe FFmpeg, même export ;
  - **mode pré-cadré 9:16**, qui donne la même géométrie et le même graphe ;
  - pré-cadré en 4:5 ;
  - chaîne 10 bits ;
  - écran partagé et jonction ;
  - carte plein écran sur la composition de l'avocat.
- Concordance des contrats `studio-rendu` (`m4-studio-rendu`, `montage-avocat.contrat`, `studio-rendu`) et tests de l'avocat (composition, découpage, nettoyage, report) : verts.
- `tsc` est propre à la racine, en dehors des types que génère `next typegen`, et dans `studio-rendu`. ESLint est propre sur les fichiers du lot.

## Fichiers communs touchés (ajouts minimaux, tous facultatifs)

- `studio-rendu/compositions/Racine.tsx` : un import et `<CompositionsMotion />`.
- `src/briques/composition/scene.ts` :
  - `sourcePreCadree`, `source10bits` et `ecranPartage` sur `PlanScene` ;
  - `cadreSource`, `entreeEcranPartage`, `geometrieEcranPartage` ;
  - 5ᵉ paramètre facultatif de `transformation` ;
  - `ParametresExport.source10bits`.
- `src/briques/composition/parametres.ts` : nouveaux champs facultatifs d'`EntreeComposition` (`sourcePreCadree`, `source10bits`, `ecransPartages`, `positionSousTitresPct`, `lookBroll`, `cartesPleinEcran`). Chacun n'est posé que s'il est présent.
- `src/briques/sous-titres/scene.ts` : `passagesJonction`, facultatif.
- `studio-rendu/src/composition/image-ffmpeg.ts` : cadre de la source, pré-cadré, master 10 bits, graphe de l'écran partagé, `FichiersImage.cartes`.
- `studio-rendu/src/composition/ffmpeg.ts` : `grapheExport(source10bits)` et `aq-mode=3`, seulement en 10 bits.
- `studio-rendu/src/operations/composition.ts` : fichiers des cartes d'écran partagé (`cartesEcranPartage`).
- `studio-rendu/src/operations/assemblage.ts` : `source10bits`, facultatif.
- `studio-rendu/compositions/commune/ImageComposee.tsx` : pré-cadré et écran partagé dans le repli navigateur.
- `deploiement/studio-rendu/Dockerfile` : `COPY src/briques/motion`, exigé par le garde-fou `final-b`. **Fichier de déploiement : rien n'a été déployé.**

**Aucune nouvelle opération, aucune nouvelle file et aucun changement de contrat** dans `studio-rendu`.

## Reste à faire

- **Brancher `habillageFacecam()` dans la chaîne**, dans le fichier du lot B ou à l'intégration. Il reste deux appels à ajouter dans `montage-facecam/index.ts` ou `chaine.ts`, après l'étape « cadrage » :
  - soumettre chaque `cartes[i]` en demande `composition` sans mode, avec `parametres = {composition, proprietes}` et un dépôt sur `cle` ;
  - puis `parametresComposition(commande, {...entree}, RECETTE_COMPOSITION_FACECAM)` et la demande `mode: "complet"` existante (`briques/composition/montage.ts`).
  - Je ne l'ai pas fait pour ne pas toucher à la chaîne du lot B.
- **Lot D** :
  - mettre à jour `CONVENTION_TEXTES` dans la consigne du monteur ;
  - pour chaque `PassageMonteur` `ajouterCarte`, passer par `carteDepuisTextes(modele, textes)`, ou par le code (`html.timeline` → `js`), en `CartePosee` ;
  - faire correspondre `disposition "ecran-partage"` à `"moitie-haute"` ;
  - aperçu animé de « Mes animations » : `documentSurMesure()` sert à tout le monde, avec les bibliothèques de `bibliotheques.genere.ts`.
- **Validation de Will** : regarder la planche et activer les modèles validés. Les retours de Will sont à reporter dans les modèles (`studio-rendu/compositions/commune/motion/Motion*.tsx`).
- Vignette et côté (`miseEnPage{cote|vignette}`) : les fenêtres sont calculées (`fenetreCote`, `vignette`), mais il n'existe pas encore de calque « cadre réduit » dans le graphe. C'est un ajout du même type que `ecranPartage`.
- Écran partagé en 4:5 et 1:1 (45/55) : la géométrie est prête (`miseEnPage`, `hauteurHaut`), mais seul le 9:16 a été essayé (la v1 n'a que ce ratio).

## Points d'attention pour l'intégration

- **Temps de rendu des cartes**, mesuré en cloud sur 4 cœurs avec swangle : environ 3,5 min pour une carte de 5 s (1080×1920), soit environ 1,7 s par image. Le grain précalculé fait gagner environ 20 %.
  - Sur le serveur, il faut prévoir les cartes **en parallèle** de la passe image, ou réduire la concurrence.
  - Une vidéo de 90 s avec 3 écrans partagés et 1 carte plein écran représente environ 10 à 15 min de rendu de cartes.
- **Bibliothèques locales**, à mettre à jour avec `node scripts/motion/generer-bibliotheques.mjs` :
  - `bibliotheques.genere.ts` fait environ 1 Mo, et le paquet Remotion grossit d'autant ;
  - GSAP 3.13 est sous la « Standard No Charge License », gratuite, plugins compris ;
  - Three.js r159 est sous licence MIT.
- **Doublon évité avec le lot D** : le stockage de « Mes animations » (index `motion.animations-gardees` et code sur R2) est celui du lot D. Le mien a été retiré.
- La carte sur mesure reçoit `js` pour le code de la timeline. Le lot D l'appelle `timeline`.
- Le plafond par vidéo des textes Claude (0,30 $) est partagé avec le monteur (voir le journal du lot D).
- **Suite Vitest complète** : les seuls échecs viennent d'autres lots et sont présents sur la base.
  - `garde-ecran` : `SelecteurDrive`, `decor-ia`.
  - `garde-regle-unique` : google-drive, higgsfield.
  - `c1-argent-b6` : `envoi-facecam`.
  - `e2e1-secu-variables` : GOOGLE_DRIVE, HIGGSFIELD.
  - `g7a-programmer` : rouge aussi sur `origin/feat/facecam`.
  - Dernier passage complet (après la fusion du lot B) : 3034 tests passent et 6 échouent.
    - Ce sont les 5 échecs ci-dessus.
    - S'y ajoute `e2e-verif1-bc-serie`, qui dépasse le délai de 5 s (génération de scripts, sans lien avec ce lot). Il était vert au passage précédent : c'est une lenteur, pas une régression.
- libx264 affiche « Error parsing option 'range = tv' » à l'export. C'est antérieur à ce lot et sans effet sur le fichier.
