# Journal du lot F1 : déclinaisons de format du face caméra (09/10/2026)

Référence : `PLAN-FACECAM-v4.md` (élément reporté « Les ratios 4:5, 1:1 et 16:9, avec l'écran partagé 45/55 », et ses décisions de fin de fichier) et `PLAN-IMPLEMENTATION-FACECAM.md` (L1 « ratios », L5 « fenêtres par ratio », L6 « écran partagé 45/55 », L8 « 16:9 »).

- Branche `feat/facecam-f1`, partie de `origin/feat/facecam`, refusionnée en cours de route (lot E : habillage branché).
- Rien n'a été fusionné dans master. Aucune PR, aucun déploiement, aucun serveur touché.
- Aucune dépense réelle : uniquement les doubles de simulation (studio-aligneur, studio-rendu). Aucun appel Claude.

## Ce que Will peut faire

1. **Sur « Votre vidéo »**, une seule ligne de pastilles **« Formats de la vidéo »** :
   - Vertical (9:16, toujours coché) ;
   - Portrait (4:5) ;
   - Carré (1:1) ;
   - Horizontal (16:9).

   Toucher une pastille fabrique cette version de la même vidéo. La toucher à nouveau la retire. Il n'y a aucun prix ni aucune autre option. Sous chaque pastille cochée, une petite ligne indique « Prête » ou « En cours… ».
2. **Le demander au monteur**, dans le fil ou à l'oral pendant le tournage :
   - « Monteur, fais-moi aussi une version carrée » ;
   - « une version pour YouTube » ;
   - « tous les formats » ;
   - « enlève la version horizontale ».

   La demande est comprise par règles fixes, sans appel Claude. Le monteur répond en une phrase et le format part tout de suite.
3. Les formats choisis sont **gardés** : une nouvelle version de la vidéo (fil, coupes, image) les refait d'office.

## Fait

### 1. Brique pure `src/briques/formats-facecam/` (nouvelle)

- **`ratios.ts`**
  - les 4 formats et leurs tailles : 1080×1920, 1080×1350, 1080×1080, 1920×1080, à 25 i/s ;
  - les pastilles ;
  - `formatsDemandes` : le 9:16 toujours en premier. Cette fonction **réutilise `ratiosDeLaMere` de la brique `declinaison`** et y ajoute le 16:9 ;
  - `entrees.facecamFormats` (clé sœur de `entrees.facecam`), avec une lecture tolérante.
- **`zones.ts`** : zone sûre par format.
  - C'est l'union, bord par bord, des zones des réseaux qui publient le format (registre des réseaux, via `zonesProtegeesUnion` de la brique `declinaison`) et du plancher de la charte motion.
  - En 16:9, le plancher est le titre sûr : 5 % sur les côtés et 12 % en bas, à cause de la barre de lecture de YouTube.
- **`cadrage.ts`** : chaque plan du 9:16 reçoit sa fenêtre pour le format, recalculée depuis la **piste du visage** (médiane sur le plan).
  - Les bornes, les tailles (100 / 115 / 130 %) et les ouvertures sont les mêmes que dans le 9:16.
  - **Les yeux sont à 30-38 % de la hauteur** (34 % visés). Si la source ne le permet pas, la fenêtre se resserre juste assez, sans jamais agrandir l'image plus que le 9:16 serré.
  - Le visage est centré en largeur.
  - Le cadre n'entre **jamais dans les 4 % du bord de la source** (bord de la vitre du téléprompteur).
  - La zone morte de 3 % est la même que dans le 9:16.
  - Sans piste, le visage est déduit du cadre 9:16.
- **`ecran-partage.ts`**
  - 4:5 et 1:1 : texte en haut (45 %), Will en bas (55 %), soit 608/742 px et 486/594 px. Les yeux sont à 37,5 % de sa partie. Sur un plan serré, Will descend juste assez pour que sa tête ne passe jamais sous la ligne des sous-titres de la jonction (yeux à 50 % au plus), sans que le menton soit coupé.
  - **16:9 : côte à côte**, carte à gauche sur 864 px (45 %), Will à droite sur 1 056 px (55 %). Le visage est à 40 % de sa colonne, compté depuis le bord extérieur, comme pour « mets-moi à droite » au lot C.
  - La carte du 16:9 est une **carte motion 4:5 plein écran** (1080×1350), réduite à 864×1080 avec le même rapport. Il n'y a donc aucun nouveau format de carte dans la brique `motion`.
  - En 16:9, une carte « plein écran » devient elle aussi un écran partagé côte à côte, pour que Will reste visible.
- **`sous-titres.ts`** : les groupes et les styles sont les mêmes ; seule la place change.
  - 4:5 et 1:1 : sous la bouche, entre 55 et 80 %.
  - 16:9 : entre 62 et 82 %, avec une lettre à l'échelle 0,9 (et non 1,78 comme le donnerait 1920 / 1080).
  - Écran partagé : la ligne est à la jonction, ou dans la colonne de Will en côte à côte.
- **`demande.ts`** : demandes de format comprises sans appel. Une phrase qui ne parle pas d'une version (« une animation carrée ») reste au monteur.
- **`controle.ts` : contrôle machine par format.**
  - Yeux dans la bande.
  - Visage entier (front, cheveux, menton), jamais sous l'interface sur les côtés.
  - Pendant un écran partagé, visage entier dans sa partie, jamais sous la carte.
  - Ligne des sous-titres dans la zone sûre, jamais sur la bouche ni sur le visage à la jonction, dans la colonne en côte à côte.
  - Cartes entières.
  - Chaque écart donne une alerte lisible et regroupée (« 16:9 : … (3 plans) »). Ces alertes ne sont jamais bloquantes.

### 2. Moteur : `src/moteurs/montage-facecam/declinaisons.ts` (nouveau)

- **Une seule passe image 10 bits** : sa bande couvre d'emblée le 9:16 et toutes les fenêtres des formats demandés (`bandeAvecDeclinaisons`). Elle n'est **jamais refaite par format**.
- **Une piste pré-cadrée par format** : étape `cadrage` existante de la route `/image`, avec `sortie` à la taille du format. C'est un simple recadrage de la même passe, avec ses contrôles machine (noirs, images figées, son, synchro).
- **Habillage et composition finale par format** (`habillageFacecamRatio`, `preparerHabillagesFormats`, `avancerHabillagesFormats`) :
  - mêmes mots montés, mêmes raccords, mêmes cartes du monteur (ou mêmes écrans partagés choisis d'après le texte) ;
  - cartes mises en page pour le format ;
  - **une carte identique d'un format à l'autre n'est rendue qu'une fois** (la carte 4:5 plein écran sert au 4:5 et au 16:9) ;
  - composition par `avancerCompositions` existante, en pré-cadré 10 bits.
  - `habillageFacecamRatio(e, "9:16")` rend **exactement** `habillageFacecam(e)`.
- **Résultat** (`completerAvecDeclinaisons`) :
  - une sortie par format (vidéo habillée, sinon la piste pré-cadrée), avec son rapport qualité (contrôles machine du format) ;
  - « 1 élément non fait — le format 4:5 : … » si un format rate. La vidéo 9:16 et les autres formats sortent quand même ;
  - `projetMontage.repriseFormats` (petit : clés, plans, entrée de l'habillage) pour ajouter un format plus tard.
- **Format ajouté après coup** (pastilles, « Ce format », monteur) : le chemin `reexporter` existant reprend `repriseFormats`.
  - Rien n'est refait : ni transcription, ni son, ni visages, ni 9:16.
  - Si la passe faite ne couvre pas le nouveau format, **une seule passe élargie à tous les formats** est faite. Son identifiant de travail est celui de la version (`<version>-passe-formats`) : le studio-aligneur ne la calcule qu'une fois, même si plusieurs formats sont cochés d'un coup.
  - Vient ensuite la piste du format, puis son habillage.
- Format coché pendant une fabrication : il est pris en route (plans faits depuis ceux du 9:16, passe élargie si besoin).
- **Consigne « Monteur, fais-moi aussi une version carrée »** dite au tournage : elle est lue dans les consignes repérées (brique `coupes`) et fabriquée avec la vidéo. Elle n'est **jamais donnée à l'agent monteur** (qui en ferait une carte).

### 3. Écran et services

- `src/services/formats-facecam.ts` (nouveau) :
  - `vueFormatsFacecam` ;
  - `changerFormatsFacecam` : formats gardés dans la version choisie et dans celle en fabrication, `video.ratios` mis à jour, nouveaux formats lancés par `reexporter` (accord donné d'office, format sans prix) ;
  - `appliquerDemandeFormats`.
- `src/app/(studio)/videos/actions-formats-facecam.ts` (nouveau) : `changerFormatsFacecamAction`.
- `src/components/facecam/FormatsFacecam.tsx` (nouveau) : la ligne de pastilles. Elle utilise `SelecteurPastilles` et `FormeRatio`, avec défilement horizontal sur mobile et des cibles d'au moins 44 px.

### 4. Tests

`tests/facecam-formats.test.ts` : 25 tests.

- **Formats et demandes** :
  - ordre des formats ;
  - lecture tolérante ;
  - « version carrée », « pour YouTube », « tous les formats », retrait, et « animation carrée », qui n'est pas une demande de format.
- **Zones sûres** par format.
- **Cadrage par format** (4:5, 1:1, 16:9) :
  - mêmes bornes et mêmes tailles que le 9:16 ;
  - yeux à 30-38 % ;
  - fenêtre au bon rapport ;
  - jamais au bord de la vitre ;
  - zone morte ;
  - 16:9 resserré quand les yeux sont hauts ;
  - sans piste.
- **Écran partagé 45/55** : géométrie, placement à 37,5 % et à 40 % de la colonne.
- **Sous-titres** : bornes, jonction, colonne.
- **Contrôle machine** : visage coupé, ligne dans la zone de l'interface, ligne sur la bouche.
- **Composition commune en 16:9** :
  - plan côte à côte ;
  - géométrie ;
  - graphe FFmpeg (carte réduite à 864×1080, glissement vers la droite) ;
  - sous-titres dans la colonne.
- **9:16 STRICTEMENT inchangé** :
  - `habillageFacecamRatio(e, "9:16")` est identique à `habillageFacecam(e)` ;
  - la chaîne 9:16 seule soumet les mêmes travaux, avec la même bande, sans état de déclinaison ;
  - sorties, note et alertes sont identiques (seul `projetMontage.repriseFormats` s'ajoute) ;
  - la géométrie verticale est la même qu'avant.
- **Chaîne en simulation** :
  - une passe, trois pistes, trois sorties ;
  - consigne dite → version carrée ;
  - formats gardés dans les entrées ;
  - habillage et composition par format, une seule carte rendue pour deux formats.
- **Format ajouté après coup** : passe élargie une fois pour deux formats, rien d'autre de refait ; squelette inchangé.
- **Essai FFmpeg réel** du graphe côte à côte (fichiers synthétiques, hors dépôt) : le graphe passe, la carte entre par la gauche, la personne glisse, la carte 4:5 n'est pas déformée.

Vérifications :

- `tsc --noEmit` est propre à la racine et dans `studio-rendu`.
- `eslint` est propre sur les fichiers touchés.
- **Suite complète** (avant la dernière fusion) : 3 073 réussis, 3 en échec, aucun du lot F1.
  - `e2e-verif1-bc-serie` (2) : dépassements de 5 s, déjà signalés aux lots A et B. Rouge aussi sans les changements de travail du lot.
  - `garde-regle-unique` : `ESSAIS_MAX` recopié dans `declinaisons.ts`. **Corrigé** : la constante de la chaîne est exportée et réutilisée.
- **Après la fusion des lots C2, F4 et E (style des cartes)** : 22 fichiers voisins relancés (facecam, F4, gardes, composition, studio-rendu, avocat, sous-titres) ; 275 tests réussis, 1 en échec.
  - L'échec est dans `facecam-effets-speciaux` (« les 8 exemples d'avant restent en tête ») : l'exemple « Fais cette animation en spectaculaire » du lot C2 s'est inséré en 2ᵉ position.
  - Il est **rouge aussi sans le lot F1**. C'est à régler entre le lot C2 et le lot des effets spéciaux.
- Le style des cartes (Sobre ou Spectaculaire, lot C2) est repris tel quel par les cartes des autres formats.

## Fichiers communs touchés (ajouts minimaux, tous FACULTATIFS : absents, rien ne change, avocat compris)

- `src/briques/composition/scene.ts` :
  - `RatioScene` reçoit `"16:9"` (1920×1080). Seul le facecam pré-cadré le compose, l'avocat le saute toujours ;
  - `ReductionLarge` est sans 16:9 obligatoire ;
  - `EcranPartageScene.cote` / `largeurCarte` / `sourceX` ;
  - `geometrieEcranPartage` gère le côte à côte. La forme verticale est identique, sans nouvelle clé.
- `src/briques/composition/recette.ts` : `centreSousTitres` sans 16:9 obligatoire.
- `src/briques/composition/parametres.ts` :
  - `ecransPartages[].cote` / `largeurCarte` / `sourceX` / `ligne` ;
  - `echelleSousTitres` ;
  - repli du centre des sous-titres si la recette n'a pas de 16:9.
- `src/briques/composition/montage.ts` : `supplements` accepte `echelleSousTitres`.
- `src/briques/sous-titres/scene.ts` : `echelleTexte` et `passagesJonction[].colonne`. Absents, la lettre est à largeur / 1080 et la ligne pleine largeur, comme avant.
- `src/briques/habillage-facecam/ecran-partage.ts` : `poserEcransPartages` transmet le côte à côte s'il est présent.
- `studio-rendu/src/composition/image-ffmpeg.ts` : branche côte à côte du graphe (la branche verticale est inchangée, caractère pour caractère).
- `studio-rendu/compositions/commune/ImageComposee.tsx` : côte à côte dans le repli navigateur.
- `src/moteurs/montage-facecam/chaine.ts` : 6 lignes.
  - `declinaisons?` dans l'état ;
  - plans des formats après la réalisation ;
  - bande de la passe ;
  - pistes des formats ;
  - habillage des formats dans `habiller()` ;
  - condition de fin.
- `src/moteurs/montage-facecam/index.ts` :
  - `capacites.ratios` passe aux 4 formats ;
  - résultat complété ;
  - format ajouté après coup dans `avancer` et `reexporter`.
- `src/moteurs/montage-facecam/monteur/agent.ts` : une consigne de format n'est pas donnée à l'agent.
- `src/services/monteur-facecam.ts` :
  - `VueVotreVideo.formats?` ;
  - interception des demandes de format dans `discuterAvecMonteur` (sans appel Claude).
- `src/components/facecam/VotreVideoFacecam.tsx` : la ligne `<FormatsFacecam>` au-dessus du fil.
- **Non touchés** :
  - `src/formats/facecam` : `ratios: ["9:16"]` est gardé, sinon le générateur créerait les 4 formats par défaut ;
  - la brique `motion` ;
  - la brique `declinaison` (réutilisée, non modifiée) ;
  - le contrat `studio-rendu` ;
  - le studio-aligneur (l'étape `cadrage` sait déjà sortir à n'importe quelle taille) ;
  - aucune nouvelle opération, aucune nouvelle file ;
  - l'avocat.

## Reste à faire

- **Essai réel** sur `IMG_7747.MOV` : les 4 formats côte à côte, montrés à Will.
  - En 16:9, vérifier le bord de la vitre du téléprompteur aux 4 % retenus, et le resserrement quand Will est haut dans l'image.
  - Mesurer le temps de la passe élargie : c'est la même passe sur une bande plus large, environ 2,3 fois les pixels en 16:9.
- **Validation de Will** du côte à côte 16:9 : visage à 40 % depuis le bord extérieur (convention du lot C). Si Will préfère le visage tourné vers la carte, il suffit d'inverser une ligne dans `placementPersonne`.
- **Décor IA (lot E1) et formats** : quand le décor est appliqué, ses morceaux sont faits sur la fenêtre 9:16 ; les autres formats gardent alors le vrai décor (passe image). Pour que tous les formats aient le décor, il faudrait un passage de décor sur la bande élargie (coût Higgsfield ×2 environ) : à décider avec Will.
- « Réessayer » d'un format raté : aujourd'hui, le format raté est signalé (« 1 élément non fait ») ; le décocher puis le recocher le relance.
- Miniature et texte de publication par format : le kit de publication garde ses règles actuelles (`video.ratios` est à jour).

## Points d'attention pour l'intégration

- **Ordre dans la chaîne** : la fin (`fini`) attend aussi les pistes et les compositions des formats demandés. Avec le 9:16 seul, `etat.declinaisons` reste absent et rien n'est soumis ni attendu en plus.
- **`projetMontage.repriseFormats`** s'ajoute à chaque fabrication réelle face caméra, même en 9:16 seul : c'est ce qui permet de cocher un format plus tard sans rien refaire. Sa taille est petite (clés, plans, mots montés).
- **Coût de rendu des cartes** : environ 3,5 min par carte de 5 s (journal du lot C). Une vidéo avec 3 écrans partagés et 3 formats en plus demande jusqu'à 3 × 3 cartes, moins les cartes partagées entre formats. À surveiller sur le serveur : la file longue de `studio-rendu` les prend une à une.
- **`src/formats/facecam`** garde `ratios: ["9:16"]` exprès : le générateur et la création d'une vidéo prennent tous les ratios du format. Les déclinaisons passent par `entrees.facecamFormats` et `video.ratios`, jamais par la définition du format. Le moteur, lui, annonce les 4 formats (`capacites.ratios`).
- Les cartes motion « moitié haute » en 4:5 et 1:1 (45 %) utilisent la mise en page déjà prévue par la brique `motion`. Le lot C2 (style « Spectaculaire ») et les modèles 7 à 13 en héritent sans rien faire de plus.
- **Fusions** : `chaine.ts` et `index.ts` sont aussi modifiés par le lot E. Mes ajouts sont des lignes isolées, commentées « Lot F1 », et faciles à garder des deux côtés.
