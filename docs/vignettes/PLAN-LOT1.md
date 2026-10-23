# Plan détaillé du LOT 1 des vignettes : le socle v2 dans le studio

*17/10/2026. Conception (Opus). Exécution : Sonnet, à la lettre, une étape = un commit, test rouge d'abord.*
*Décision de Will (17/10, 23 h) : « OK pour les vignettes » : la v2 est validée et le lot 1 a son feu vert.*

À lire avant de commencer : `AGENTS.md`, `docs/REGLES-ROUTINES.md`, `docs/vignettes/PLAN-VIGNETTES.md` (section V2),
`docs/vignettes/v2/gabarit/socle.css` et `socle.js` (la **référence visuelle**, à transposer, pas à copier tels quels).

---

## 0. En une phrase

Le lot 1 ajoute au conteneur de rendu une composition `VignetteAxion` (socle v2 : liseré, carré « A », titre
Montserrat ExtraBold sur 2 lignes avec un mot sur pavé orange, 2 ambiances, 3 mises en page, version Instagram sans
visage), branchée sur l'opération `miniature` existante **derrière un réglage éteint**. Rien ne change pour Will tant
que ce réglage n'est pas allumé (par lui, pas par la routine).

---

## (a) Objectif et périmètre

### Ce que le lot 1 FAIT

1. **Composition Remotion `VignetteAxion`** (image fixe), dans `studio-rendu/compositions/commune/vignette/`.
   - 2 tailles seulement : **16:9 (1280×720)** et **9:16 (1080×1920)**.
   - **Socle invariable** (identique pour les 12 générateurs) :
     1. liseré orange sur tout le bord gauche (16 px en 16:9, 22 px en 9:16) ;
     2. carré « A » orange vif #E07040, A ivoire : (44, 36, 62×62) en 16:9 ; (84, 456, 86×86) en 9:16 ;
     3. en 9:16 seulement, « axion-ia.com » collé à droite du carré (bloc-marque, x 190, y 484) ;
     4. titre **Montserrat ExtraBold (800)**, capitales, **2 lignes au plus**, 3 à 5 mots ;
     5. **un seul** mot (ou groupe nombre + unité) sur **pavé orange** incliné de −1,5° ;
     6. contour automatique du titre (ombre encre en ambiance encre, contour ivoire 16 px en ambiance ivoire) ;
     7. voile sous le titre, grain léger.
   - **2 ambiances** : `encre` (fond #110A05, halo orange, pavé #E07040, texte du pavé encre) et `ivoire`
     (fond #F1E2CC dégradé, pavé #B44F29, texte du pavé ivoire #F4EBDD). Valeurs exactes : `v2/gabarit/socle.css`.
   - **3 mises en page génériques** (les mêmes pour tous les générateurs dans ce lot) :
     - `m1` « gros plan » : sujet à droite, visage ≈ 30 % de la hauteur, titre en bas à gauche ;
     - `m2` « titre géant » : titre en haut, sujet coupé au bord droit ;
     - `m3` « visage moyen » : sujet au centre droit plus petit, titre en haut à gauche, place libre pour l'objet
       signature du lot 3 (vide au lot 1).
     Valeurs de départ : celles de `v2/gabarit/g-facecam.js` (le générateur de référence), sans le cadran.
   - **Variante Instagram sans visage** (9:16 seulement) : fond d'ambiance + halo + socle + titre centré en grand.
     **Aucune image de la vidéo, aucun sujet, aucune photo.** (L'objet signature en héros viendra au lot 3.)
   - **Repli sans détourage** : si aucune image détourée n'est fournie, l'image pleine de la vidéo est posée en fond,
     recadrée, avec un fondu vers l'ambiance du côté du titre et le halo (c'est le repli prévu par la V2, § « Détourer »).
     Le lot 1 fonctionne donc **sans** rembg ni MediaPipe.
2. **Opération `miniature` étendue** (`studio-rendu/src/operations/miniature.ts`) : nouveau paramètre
   `gabarit: "r4" | "axion-v2"` (défaut `"r4"` = comportement actuel, octet pour octet) et, en `axion-v2` :
   `ambiance`, `mise`, `instagram`, `generateur`, et une entrée facultative `sujet` (PNG/WebP détouré, adresse permise).
3. **Côté studio** : un module PUR `src/domaine/vignettes.ts` (rotation ambiance/mise, contrôle des mots interdits du
   titre de couverture) et le branchement dans le fournisseur `studio-rendu` **derrière le réglage
   `miniature.gabarit`** (défaut `"r4"`). La routine **n'allume pas** ce réglage.
4. **Vérification de bout en bout** : un script local rend 3 vignettes réelles (voir g) et un test vérifie les textes.

### Ce que le lot 1 NE FAIT PAS (lots suivants)

| Lot | Contenu | Pourquoi pas maintenant |
|---|---|---|
| 2 | Liste unique des interdits, contraste mesuré sur l'image, zones sûres contrôlées au pixel, lecture à 160 px | Le lot 1 pose seulement une garde de texte (voir étape 2) |
| 3 | Les 12 objets signatures, mises propres à chaque générateur, Instagram avec objet héros, flou des textes d'écran (écran partagé, cas concret) | Gros travail graphique, une fois le socle en place |
| 4 | Bloc `vignette` dans `src/formats/types.ts`, test de contrat, `AJOUTER-UN-FORMAT.md` | Le lot 1 lit seulement `formatId` |
| 5 | Onglet Miniature : choisir le mot orange, l'ambiance, voir la grille, exports 4:5, 1:1, affiche ; **sortie Instagram rangée à part dans la fiche** | Interface |
| 6 | Choix de la meilleure image (yeux ouverts, bouche fermée) et **détourage** sur le serveur | Dépendances lourdes, voir (d) |

Hors périmètre aussi : 4:5, 1:1 et affiche (rognages, lot 5), trios A/B **de texte** (lot 5 ; le lot 1 fait le trio de
**composition** : m1/m2/m3, même titre, même ambiance), photos de Will en production (voir e).

---

## (b) Fichiers à créer ou modifier

Avant de toucher un fichier partagé, vérifier les PR ouvertes (règle des routines). Relevé du 17/10 : **#334**
(`videos/suppression-definitive`) modifie `src/services/miniatures.ts` → diff minimal dans ce fichier, le signaler dans la PR.

### À créer

| Fichier | Rôle |
|---|---|
| `studio-rendu/compositions/commune/vignette/socle.ts` | **PUR**, sans React. Jetons (couleurs reprises de `COULEURS_VIDEO` de `src/briques/habillage/charte-video.ts` + `COULEURS_MINIATURE.orangeVif`, aucune couleur nouvelle sauf le dégradé ivoire #F1E2CC / #F6E9D6 / #E4CDAE et #1d110a, nommés et commentés), dimensions, repères fixes (liseré, carré, signature), zones sûres (9:16 : y 420 → 1500, x ≤ 940 ; 16:9 : coin durée 140×60 libre), types `AmbianceVignette`, `MiseVignette`, `ProprietesVignette`, fonction `proprietesVignette(entrée)` qui valide et normalise (refus si `instagram` et `sujet`/`image` présents). |
| `studio-rendu/compositions/commune/vignette/mises.ts` | **PUR**. Les 3 mises × 2 ratios + la mise Instagram : position du sujet (`cx`, `cy`, `hv` = hauteur du visage visée), du titre (`x`, `y`, `ancre`, `largeur`, `taille`), du halo (`hx`, `hy`). `placerSujet(boiteVisage, mise, ratio)` = transposition de `V2.sujet` de `socle.js` (boîte visage facultative ; sans boîte : visage supposé au tiers haut, centré). |
| `studio-rendu/compositions/commune/vignette/titre.ts` | **PUR**. Coupe du titre en ≤ 2 lignes en réutilisant `unitesCouverture`, `estMotCle`, `mettreEnPageTitre` (`lignesMax: 2`) de `../miniature-mise-en-page.ts` ; groupe le mot clé (« 2 MINUTES » = un pavé) ; réduction de 15 % au plus, sinon signale `trop: true` (jamais plus petit). |
| `studio-rendu/compositions/commune/vignette/VignetteAxion.tsx` | Dessin seulement (aucune règle). Police via `chargerPoliceMontserrat()` / `FAMILLE_MONTSERRAT` de `../polices.ts` (déjà dans le dépôt : `commune/polices/Montserrat-ExtraBold.ttf`), attente de la police avant mesure, comme `Miniature.tsx`. |
| `studio-rendu/compositions/commune/vignette/index.ts` | Exports. |
| `src/domaine/vignettes.ts` | **PUR**, côté studio. `GABARITS_MINIATURE = ["r4", "axion-v2"]` ; `ambianceEtMises(rangVideo)` (alternance encre/ivoire d'une vidéo à l'autre ; trio = m1, m2, m3) ; `famille(formatId)` → `visage: boolean` pour les 12 générateurs (avocat, facecam, facecam-animee, selfie, createur-b, podcast, ecran-partage, ugc = visage ; tableau-anime, cas-concret, image-video, motion = sans) ; `interditsVignette(texte)` = `interditsDans(texte, "ecrire")` + `interditsTousEcrivains(texte)` + 3 motifs propres aux vignettes : « faites-le vous-même » (tirets et apostrophes tolérés), « Certifexemple » seul, « certifié(e)(s) » seul. |
| `tests/vignettes-lot1-socle.test.ts` | Tests purs du socle, des mises et du titre (étapes 1 à 3). |
| `tests/vignettes-lot1-operation.test.ts` | Tests de l'opération (étape 5), rendu Remotion **injecté** (aucun navigateur). |
| `tests/vignettes-lot1-studio.test.ts` | Tests du module studio et du branchement (étapes 2 et 6). |
| `studio-rendu/scripts/essai-vignettes.ts` | Rendu RÉEL local de 3 vignettes (étape 7), sortie dans `docs/vignettes/lot1/`. |
| `docs/vignettes/lot1/` | Les 3 JPEG rendus + `RAPPORT.md` (mesures, poids, textes). |

### À modifier

| Fichier | Changement |
|---|---|
| `studio-rendu/compositions/Racine.tsx` | Déclarer `<Composition id="VignetteAxion" … />` (1 image, `calculateMetadata` sur le ratio), juste après `Miniature`. |
| `studio-rendu/compositions/commune/index.ts` | Exporter `VignetteAxion`. |
| `studio-rendu/src/operations/miniature.ts` | Paramètre `gabarit` ; en `axion-v2` : entrée `sujet` facultative (même `entreePermise`), propriétés via `proprietesVignette`, composition `VignetteAxion`. Le chemin `r4` ne bouge pas. `RendreMiniature` devient générique sur l'id de composition (ou une 2e fonction `rendreVignette`). |
| `src/fournisseurs/types.ts` | `SourceMiniature` : champs **facultatifs** `gabarit?`, `formatId?`, `rangVideo?`. `PropositionMiniature` : `ambiance?`, `mise?`. |
| `src/fournisseurs/rendu/miniature.ts` | Passe `gabarit`, `ambiance`, `mise`, `generateur` aux demandes quand `source.gabarit === "axion-v2"`. Refuse le titre si `interditsVignette` trouve quelque chose (aucune demande envoyée, proposition absente, message journalisé sans le titre). |
| `src/services/miniatures.ts` | `preparerSource` lit `lireParametre("miniature.gabarit", "r4")` et remplit `gabarit`, `formatId`, `rangVideo`. **3 à 6 lignes**, rien d'autre (PR #334). |
| `deploiement/studio-rendu/Dockerfile` | **Normalement rien** : `src/briques/habillage` est déjà copié, la police aussi (dossier `compositions`). Le test existant `tests/final-b-image-rendu-fichiers.test.ts` le prouve ; s'il rougit, ajouter la ligne `COPY` qu'il réclame, rien d'autre. |

**Interdit dans ce lot** : toucher `Miniature.tsx`, `miniature-mise-en-page.ts` (sauf export d'une fonction déjà
existante si besoin), `src/domaine/miniatures.ts`, `OngletMiniature.tsx`, la liste `LISTE_INTERDITS`
(`qualite-script/regles/interdits.ts` : elle change les verdicts des écrivains), `studio-aligneur/`, `docker-compose.yml`.

---

## (c) Ordre de travail : 8 étapes, 1 commit chacune, test rouge d'abord

Branche : `vignettes/lot1-socle` depuis `origin/master` à jour. Pousser après chaque étape. PR vers master à la fin
(ne pas fusionner). Tests ciblés pendant le travail ; la suite complète une seule fois à l'étape 8.

### Étape 1 — Socle PUR (`socle.ts`)
- **Test rouge** (`tests/vignettes-lot1-socle.test.ts`, bloc « socle ») :
  - dimensions 16:9 = 1280×720, 9:16 = 1080×1920 ; tout autre ratio refusé ;
  - le carré « A » et le liseré ont la même position dans les 2 ambiances et toutes les mises ;
  - les couleurs du socle viennent de `COULEURS_VIDEO` (égalité vérifiée) ; pavé encre = #E07040, pavé ivoire = #B44F29 ;
  - contraste pavé/texte ≥ 3:1 dans les 2 ambiances (calcul WCAG dans le test) ;
  - `proprietesVignette({ instagram: true, sujet: "…" })` et `({ instagram: true, image: "…" })` **lèvent une erreur** ;
  - `instagram` avec ratio 16:9 refusé.
- Code : `socle.ts`. Commit : « Vignettes lot 1 · socle pur (repères, ambiances, garde Instagram) ».

### Étape 2 — Garde du texte (`src/domaine/vignettes.ts`, partie texte)
- **Test rouge** (`tests/vignettes-lot1-studio.test.ts`) : `interditsVignette` trouve « Villeexemple », « VILLEEXEMPLE »,
  « Aucun gain garanti », « Certifexemple certifié », « certifié Certifexemple », « Certifexemple », « faites-le vous-même »,
  « FAITES LE VOUS MEME », « faites‑le vous‑même » (tiret insécable) ; ne trouve rien dans « OÙ FUIT VOTRE TEMPS »,
  « LICENCIÉ PAR SMS ? », « UN DEVIS EN 2 MINUTES ».
- Code : `interditsVignette` (réutilise `interditsDans` et `interditsTousEcrivains`, **aucune copie de liste**).
- Commit : « Vignettes lot 1 · garde des mots interdits sur le titre de couverture ».

### Étape 3 — Titre et mises PUR (`titre.ts`, `mises.ts`)
- **Test rouge** (bloc « titre » et « mises ») avec une mesure approchée injectée (comme `tests/r4-miniatures.test.ts`) :
  - « OÙ FUIT VOTRE TEMPS » + motCle « temps » → 2 lignes, le pavé = « TEMPS » ;
  - « UN DEVIS EN 2 MINUTES » + « 2 minutes » → « 2 MINUTES » dans **un seul** pavé ;
  - jamais plus de 2 lignes ; taille finale ≥ 85 % de la taille de la mise, sinon `trop: true` ;
  - pour chaque mise × ratio : le titre tient dans la zone sûre (9:16 : y 420 → 1500, x + largeur ≤ 940) ; en 16:9,
    aucun élément ne touche le coin 140×60 en bas à droite ; le titre ne recouvre pas le carré « A » ;
  - `placerSujet` : avec la boîte visage de `docs/vignettes/v2/images/cadrages.js` (facecam), m1 donne un visage de
    hauteur 560 px (16:9) centré en (960, 330) à 1 px près (mêmes chiffres que `g-facecam.js`). `cadrages.js` est un
    script de navigateur : le test lit le fichier et fait `JSON.parse` du texte après `window.CADRAGES =` (sans le `;` final) ;
  - les 3 mises d'un même ratio diffèrent (position du titre ou du sujet) : jamais deux identiques.
- Commit : « Vignettes lot 1 · titre sur 2 lignes et 3 mises en page ».

### Étape 4 — Composition `VignetteAxion` (dessin) + déclaration
- **Test rouge** : un test vérifie que `Racine.tsx` déclare `VignetteAxion` et que `calculateMetadata` rend
  1280×720 pour 16:9 et 1080×1920 pour 9:16 (lecture du fichier ou import des fonctions pures, comme les tests
  existants des compositions ; pas de navigateur). Le test `final-b-image-rendu-fichiers` doit rester vert.
- Code : `VignetteAxion.tsx`, `index.ts`, `Racine.tsx`, export dans `commune/index.ts`. Ordre des calques (z) :
  fond d'ambiance → image pleine (repli) ou sujet détouré → voile → titre → bloc-marque, liseré, carré → grain.
  `npm run verifier` dans `studio-rendu/` (typage) doit passer.
- Commit : « Vignettes lot 1 · composition VignetteAxion ».

### Étape 5 — Opération `miniature` en `axion-v2`
- **Test rouge** (`tests/vignettes-lot1-operation.test.ts`, rendu injecté, FFmpeg simulé comme dans les tests R4) :
  - sans `gabarit` ou `gabarit: "r4"` : la composition demandée est `Miniature`, propriétés **identiques** à avant
    (instantané des propriétés pris AVANT de modifier le code) ;
  - `gabarit: "axion-v2"` : composition `VignetteAxion`, ambiance et mise transmises, titre tronqué à 80 caractères ;
  - `instagram: true` : **aucune** image extraite de la vidéo (FFmpeg jamais appelé pour `extraire`), aucun `sujet`
    transmis, ratio forcé 9:16 ;
  - entrée `sujet` d'un hôte non permis → refus (`entreePermise`) ;
  - JPEG ≤ 2 Mo (réutilise `encoderJpeg`).
- Commit : « Vignettes lot 1 · opération miniature : gabarit axion-v2 (éteint par défaut) ».

### Étape 6 — Branchement studio derrière le réglage éteint
- **Test rouge** (`tests/vignettes-lot1-studio.test.ts`, service de rendu simulé comme `r4-miniatures-reel.test.ts`) :
  - réglage absent → demandes **sans** `gabarit` (aucun changement) ;
  - réglage `miniature.gabarit = "axion-v2"` posé **dans le test seulement** → 3 demandes m1, m2, m3, même ambiance,
    `generateur` = `formatId` de la vidéo ; deux vidéos de rang voisin → ambiances différentes ;
  - titre contenant « Villeexemple » → **aucune** demande envoyée, aucune proposition, et le message journalisé ne
    contient pas le titre.
- Code : `ambianceEtMises`, `famille`, branchement dans `fournisseurs/rendu/miniature.ts` et `services/miniatures.ts`.
- Commit : « Vignettes lot 1 · branchement studio derrière le réglage miniature.gabarit (éteint) ».

### Étape 7 — Rendu réel de bout en bout (script + images)
- `studio-rendu/scripts/essai-vignettes.ts` (modèle : `scripts/essai-local.ts`, `STUDIO_RENDU_ESSAI=1`, serveur local,
  aucun réseau extérieur) rend :
  1. **16:9, encre, m1, repli sans détourage** : vidéo du dépôt `docs/facecam/planche-effets/main-logo.mp4`
     (instant 0,32 s, déjà utilisé par la v2), titre « OÙ FUIT VOTRE TEMPS », motCle « temps » ;
  2. **9:16, ivoire, m2, avec sujet détouré** : même vidéo + `docs/vignettes/v2/images/facecam-detoure.webp`
     en entrée `sujet`, titre « UN DEVIS EN 2 MINUTES », motCle « 2 minutes » ;
  3. **9:16, encre, Instagram** : même titre que 1, aucune image.
- Sortie : `docs/vignettes/lot1/*.jpg` + `RAPPORT.md` (poids, dimensions, temps de rendu, mémoire maximale du processus
  relevée par `/usr/bin/time -v` si disponible).
- Si le navigateur de Remotion ne se télécharge pas dans la session cloud : passer
  `browserExecutable: "/opt/pw-browsers/chromium…"` (chemin réel à relever par `ls /opt/pw-browsers`) **dans le
  script seulement**, jamais dans le code de production.
- **Test** : `tests/vignettes-lot1-rendus.test.ts` (léger, sans navigateur) vérifie que les 3 fichiers existent, ont
  les bonnes dimensions (lecture de l'en-tête JPEG) et pèsent ≤ 2 Mo. Rouge avant le rendu, vert après.
- Commit : « Vignettes lot 1 · 3 rendus réels de contrôle ».

### Étape 8 — Contrôles finaux et PR
- `pnpm next typegen && pnpm tsc --noEmit` ; `eslint` sur les fichiers touchés ; `npm run verifier` dans `studio-rendu/` ;
  suite Vitest **complète une fois**.
- Regarder soi-même les 3 JPEG (outil de lecture d'image) et cocher la liste (g).
- PR vers master : « Vignettes lot 1 : socle v2 (éteint par défaut) », résultats exacts des commandes, liens vers les
  3 rendus, mention de #334. **Ne pas fusionner, ne pas allumer le réglage.**

---

## (d) Sélection d'image et détourage : où ça tourne

**Constat (Dockerfile et dépendances relus le 17/10) :**
- `studio-rendu` (Node 22, Remotion, FFmpeg 8.1.1, **3 Go**) : **ni Python, ni rembg, ni MediaPipe, ni OpenCV**.
  Il choisit déjà « la plus nette des 5 images » avec FFmpeg (`blurdetect`) et écarte les fondus.
- `studio-aligneur` (Python 3.11, **6000m**, pic connu 73 %) : a déjà **MediaPipe 1.1.0** (Face Landmarker, modèle
  téléchargé à la construction), **OpenCV**, et une route `/segmenter` **réservée mais non construite** (501).
  **Pas de rembg** (ni onnxruntime).
- Budget du serveur (15 Go, partagé avec le site) : 10,4 Go au plus pour le studio, OOM déjà vécus (studio 3 Go
  « en attendant le correctif malloc »).

**Choix pour le lot 1 : rien de nouveau sur le serveur.**
- Sélection : l'existant (`instantsMiniature` côté studio + la plus nette des 5 dans `studio-rendu`).
- Détourage : **aucun**. Repli « image pleine + fondu + halo » dans la composition. L'entrée `sujet` existe déjà pour
  le jour où une image détourée sera fournie (lot 6), et sert à l'essai de l'étape 7 avec une image détourée du dépôt.
- Aucune ligne ajoutée aux Dockerfile, aucune dépendance npm ou pip, aucune hausse de `mem_limit`.

**Proposition pour le lot 6 (à confirmer par Will, voir f) :**
1. **Choisir l'image** (yeux ouverts, bouche fermée) : dans `studio-aligneur`, en réutilisant la piste `/visages`
   déjà calculée pour les vidéos face caméra (points du visage par image : clignement et ouverture de bouche se
   calculent sur ces points, **sans relire la vidéo**). Le studio passe ensuite 1 à 3 instants à `studio-rendu`.
   Coût mémoire : quasi nul (lecture d'un json.gz).
2. **Détourer** : construire la route `/segmenter` de `studio-aligneur` avec le **segmenteur de personne de
   MediaPipe** (`selfie_multiclass_256x256`, ≈ 16 Mo, processeur seul), déjà couvert par la dépendance `mediapipe`
   installée : **aucun paquet nouveau**, modèle téléchargé à la construction comme les autres, une image à la fois,
   sous le verrou « un calcul lourd à la fois » existant. Contour adouci par OpenCV (déjà là).
3. **rembg** seulement si la qualité de MediaPipe ne suffit pas (cheveux, objets tenus) : il ajoute onnxruntime
   (+ ≈ 200 Mo d'image) et un modèle `isnet-general-use` (≈ 170 Mo) qui monte à ≈ 1 Go de mémoire par image.
   Dans ce cas : en **option éteinte**, installée dans une étape `pip` séparée qui ne casse pas la construction si
   elle échoue (comme le repli DeepFilterNet → afftdn de la route `/son`), et mesure de mémoire obligatoire avant
   d'allumer.
4. Jamais dans `studio-rendu` (3 Go déjà pris par Chrome + Remotion pendant les montages).

---

## (e) Les photos de Will

- Dépôt : `docs/vignettes/photos-will/` (11 photos). Règle écrite dans leur `LISEZMOI.md` : **vignettes 16:9 et 9:16
  seulement, jamais Instagram**, ne pas copier ailleurs.
- **Lot 1 : aucune photo de Will en production.** Elles ne sont ni envoyées au stockage, ni copiées dans une image
  Docker (le Dockerfile de `studio-rendu` ne copie pas `docs/` : vérifié), ni utilisées par l'essai de l'étape 7
  (qui prend les images de test du dépôt).
- La règle « jamais Instagram » est **déjà tenue par construction** au lot 1 : la variante Instagram refuse toute
  image et tout sujet (étape 1 et 5, tests). Toute photo future passera par l'entrée `sujet` ou `image` : elle sera
  donc refusée en Instagram sans code de plus.
- Rappel utile : Buffer n'envoie **aucune** miniature (`src/fournisseurs/publication/buffer.ts` : l'API refuse
  `thumbnailUrl` sur une vidéo). Le risque « photo sur Instagram » viendrait d'un téléchargement manuel : le lot 5
  rangera la sortie Instagram à part dans la fiche.
- Tri à faire avant tout usage (relevé visuel du 17/10) :
  - **à écarter** : `williams-jullin-3-personnes.png` et `chatgpt-image-11-janv-2026-08-46-152.png` (deux autres
    personnes et un **logo Apple** visible sur l'ordinateur : interdit « aucun logo ») ;
  - `williams-jullin-autre-marque-500kb.jpg` : image propre, mais le nom du fichier cite une autre marque → renommer s'il
    sert ;
  - fonds simples, faciles à détourer : `williams-d-econtract-e.png`, `chatgpt-image-11-janv-2026-08-28-50-2.png`
    (fond blanc), `williams-jullin-autre-marque-500kb.jpg`, `williams-jullin-bureau.png`.
- Où elles entreraient (lot 6, après décision) : en **image de secours** quand aucune image de la vidéo ne passe le
  contrôle (aucun visage, yeux fermés partout), pour les générateurs à visage seulement, détourées une fois pour
  toutes, rangées dans « Mes images » du studio avec une étiquette `jamais-instagram`.

---

## (f) Risques, et ce qui demande une décision de Will

### Risques

| Risque | Parade dans le lot 1 |
|---|---|
| Casser les miniatures actuelles | Gabarit `r4` par défaut, test d'égalité des propriétés (étape 5), réglage éteint |
| OOM ou construction Docker cassée | Aucune dépendance ni Dockerfile modifié ; test `final-b-image-rendu-fichiers` |
| Délai de la file courte (45 s) dépassé | Même coût que `Miniature` (une image fixe Remotion) ; temps mesuré à l'étape 7, noté dans le rapport |
| Repli sans détourage moins beau que les maquettes | Assumé : les maquettes v2 utilisaient des images détourées. Le rapport montre les deux (rendu 1 sans, rendu 2 avec) |
| Texte incrusté dans l'image de la vidéo (sous-titres, écrans) | L'existant lit déjà la vidéo **sans texte** si elle existe ; le flou des écrans est au lot 3 |
| Conflit avec la PR #334 | Diff de 3 à 6 lignes dans `services/miniatures.ts` ; à signaler dans la PR |
| Mots interdits | Garde `interditsVignette` avant tout envoi ; « faites-le vous-même » ajouté **pour les vignettes seulement** (la liste des écrivains n'est pas touchée) |

### Décisions de Will (aucune ne bloque le lot 1)

1. **Allumer** le réglage `miniature.gabarit = "axion-v2"` après avoir vu les 3 rendus de l'étape 7 (ou attendre le
   lot 3, quand chaque générateur aura son objet signature). Proposition : attendre le lot 3.
2. **Détourage (lot 6)** : MediaPipe (déjà installé, léger) d'abord, rembg seulement si la qualité ne suffit pas.
   Proposition : MediaPipe d'abord.
3. **Rôle des photos** : image de secours seulement (proposé), ou aussi pour les générateurs sans visage
   (tableau, motion…), ce qui s'écarte de la règle « image de la vidéo ». Et confirmer l'écart des 2 photos avec
   d'autres personnes et le logo Apple.

---

## (g) Vérifier de bout en bout

1. **Commandes** (résultats exacts recopiés dans la PR) :
   `pnpm vitest run tests/vignettes-lot1-*.test.ts tests/r4-miniatures.test.ts tests/r4-miniatures-reel.test.ts tests/final-b-image-rendu-fichiers.test.ts`,
   puis la suite complète une fois ; `tsc --noEmit` ; `eslint` (fichiers touchés) ; `npm run verifier` (studio-rendu).
2. **Rendu réel** : `cd studio-rendu && npm ci && STUDIO_RENDU_ESSAI=1 npx tsx scripts/essai-vignettes.ts` → 3 JPEG
   dans `docs/vignettes/lot1/`. Aucun appel payant, aucun réseau extérieur (hors téléchargement du navigateur de
   Remotion, sinon Chromium local).
3. **Liste à cocher en regardant les images** (dans `RAPPORT.md`) :
   - liseré, carré « A » à la même place sur les 3 ; bloc-marque « axion-ia.com » sur les 2 verticales ;
   - titre sur 2 lignes au plus, un seul pavé orange, lisible réduit à 160 px de large (planche réduite jointe) ;
   - 16:9 : coin bas droit 140×60 vide ; 9:16 : titre entre y 420 et y 1500, à gauche de x 940 ;
   - Instagram : **aucune personne, aucune image de la vidéo** ;
   - **mots interdits** : aucun « Villeexemple », « Aucun gain garanti », « Certifexemple certifié », « faites-le vous-même »
     (le script passe chaque titre rendu par `interditsVignette` et échoue sinon) ;
   - **aucun logo, aucun nom de client** dans les images (vérification à l'œil, notée dans le rapport) ;
   - poids ≤ 2 Mo chacun.
4. **Non-régression** : une miniature `r4` rendue par le même script reste identique en propriétés à celle d'avant.
