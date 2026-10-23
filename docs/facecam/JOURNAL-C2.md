# Journal du lot C2 — style « Spectaculaire » et corrections du style Sobre (09/10)

Branche `feat/facecam-c2`, partie de `origin/feat/facecam-c`, avec fusions régulières de `origin/feat/facecam-c` et
`origin/feat/facecam`. Rien fusionné dans `master`, aucune PR, aucun déploiement, aucun serveur touché.

Référence : `PLAN-FACECAM-v4.md`, « DÉCISION 09/10 (Will, après la planche) » et « Motion design qualité EXTRÊME et
CENTRALISÉ ».

## Fait

### 1. Corrections du style Sobre validé
- **Placement** (`src/briques/motion/style.ts`) : paramètre facultatif `placement?: "haut" | "plein"` dans
  `MiseEnPageCarte`. Absent : « plein » pour une carte plein écran, « haut » pour la moitié haute de l'écran partagé
  (la moitié haute est TOUJOURS « haut », même si on demande « plein »).
- **Plein écran recentré et agrandi** : en « plein », la zone du contenu va de 11 % à 84 % de la hauteur en 9:16
  (`ZONES_PLEIN`) au lieu de 14 % à 70 % (zones sûres des réseaux) : plus de grand vide en bas.
- **Textes plus grands** en « plein » (`FACTEURS_TAILLE_PLEIN`) : corps des listes à 4,03 % de la hauteur (77 px en
  1920), titres et affiches × 1,12, légendes × 1,06 (3,2 %). Aucun texte sous 3 %.
- **Liste** : le texte de chaque point prend toute la largeur restante du panneau (il se coupait trop tôt, « Où » seul
  sur sa ligne).
- **Exemples Axion** (`src/briques/motion/exemples-axion.ts`) : « Le diagnostic fuite » = où l'entreprise perd du
  temps (« Où perdez-vous du temps ? / Quelles tâches se répètent ? / Que coûte une erreur ? »), 9 h rendues chaque
  semaine, paperasse 12 h → 3 h, « Votre IA en 4 étapes » (diagnostic, formation, automatisation, suivi), le devis
  à la main ou avec l'IA, titre « Le diagnostic fuite — où votre entreprise perd du temps ».

### 2. Style « Spectaculaire » des 6 modèles
Nouveaux fichiers `studio-rendu/compositions/commune/motion/spectaculaire/` :
- `noyau.tsx` : scène commune (contexte propre, ne dépend pas du contexte Sobre) :
  - **profondeur 3D** en perspective CSS (`preserve-3d`) : décor lointain (filigrane géant à −700 px), poussières à
    −380 px, contenu au premier plan ; **caméra** qui tourne doucement (rotateX / rotateY) et pousse : la parallaxe
    vient de la vraie 3D ;
  - fond en couches : lueurs qui dérivent, **rayons de lumière** qui tournent, **poussières lumineuses** et bokeh ;
  - **entrée « zoom à travers »** (échelle 2,6 → 1, flou puis net, traînées de vitesse, 0,5 s) ;
  - **sortie « masque qui se déchire »** (ligne brisée lumineuse, les deux moitiés s'écartent et tombent, 0,5 s) ;
  - **mots géants** (`MotsGeants`) : s'écrasent depuis la caméra, s'étirent depuis la droite ou tombent et rebondissent ;
    mots clés `*…*` en orange avec **halo** et **balayage de lumière** (`MotCle`) ;
  - **éclats** (`Eclats`) : triangles orange et crème, onde de choc, éclair bref ;
  - **flou de mouvement marqué** (`FlouFort`, directionnel, ≈ 0,9 × déplacement, plafond 60 px) ;
  - tout dépend de l'image (`hasard` graine, `derive`) : déterministe.
- Six modèles : `ListeSpectaculaire` (cartes 3D sur charnière), `ChiffreSpectaculaire` (portail d'anneaux au sol,
  le chiffre s'écrase et explose en éclats), `AvantApresSpectaculaire` (vraies colonnes en volume 3D, l'« après »
  s'écrase et le temps perdu part en éclats), `LigneDeTempsSpectaculaire` (plan incliné, travelling, rail de lumière),
  `DeuxColonnesSpectaculaire` (disques qui se retournent depuis le fond et se percutent), `TitreSpectaculaire`
  (lettres qui tombent et rebondissent, reflet d'objectif, mot clé allumé).
- Branchement : `style?: "sobre" | "spectaculaire"` dans `MiseEnPageCarte` ; chaque composition `Motion…` renvoie la
  version spectaculaire quand `style === "spectaculaire"` (une ligne). **Style absent ou « sobre » : rendu Sobre.**
  Mêmes identifiants de compositions : rien à changer dans `Inscriptions.tsx` ni dans l'opération `composition`.
- Three.js / `@remotion/three` ne sont **pas** installés dans `studio-rendu` (Three n'existe qu'en fichier local pour
  l'iframe de la carte sur mesure) : la 3D est faite en **perspective CSS** (choix permis par la consigne), sans
  nouvelle dépendance.

### 3. Choix du style
- `choisirStyleMotion({ intensite, demande, habitude })` (pur, testé) : demande explicite > habitude enregistrée >
  intensité (Sobre et Équilibré → sobre, Très dynamique → spectaculaire) > « sobre ».
- `lireDemandeStyle(phrase)` : « en spectaculaire », « plus spectaculaire », « plus sobre », « moins spectaculaire »
  (= sobre), « moins sobre » (= spectaculaire) ; le dernier mot dit l'emporte.
- `FICHES_STYLE_MOTION` : libellé, description et **consigne** de chaque style (à mettre dans la consigne d'une carte
  sur mesure).
- Catalogue du monteur (lot D, déjà dans `origin/feat/facecam`) : constante `STYLE_CARTE_MONTEUR`, règle « Style : … »
  en tête de l'entrée `ajouterCarte`, exemple « Fais cette animation en spectaculaire », proposé juste après la carte
  dans « Que puis-je demander ? » (`exemplesDemandes`).

### 4. Planches
- Script `studio-rendu/scripts/planche-motion-styles.ts` (nouveau ; le script du lot C n'est pas touché) :
  `npx tsx scripts/planche-motion-styles.ts [--style sobre|spectaculaire] [--images] [modèles…]`. Vidéos 5 s
  1080 × 1920, 25 i/s, H.264 ; réencodage ffmpeg en deux passes au-delà de 3 Mo.
- `docs/facecam/planche-motion/` : planche Sobre corrigée (même page qu'avant, exemples Axion, lien vers l'autre).
- `docs/facecam/planche-motion-spectaculaire/` : les 6 modèles en Spectaculaire, chacun **côte à côte avec le Sobre**.
- Poids : Sobre 2,6 à 2,9 Mo, Spectaculaire 1,6 à 2,2 Mo (toutes < 3 Mo). Rendu ≈ 3 min par vidéo sur 4 cœurs, dans
  les deux styles.
- Vérification à l'œil sur des images extraites (ffmpeg / images fixes) : lisibilité, débordements, coupures, tailles.
  Corrigés en cours de route : poussée de caméra trop forte (le titre touchait le bord), icône du chiffre sur le
  sur-titre, unité et libellé qui arrivaient pendant les éclats (un seul effet fort à la fois), points de la
  comparaison et sous-titre du titre qui traversaient d'autres textes en tombant, lettres du titre tombant de trop haut.
- Effet transitoire assumé : pendant la cascade des lettres du titre (≈ 0,3 s) et les entrées étirées, le texte est
  volontairement flou de mouvement ; tout est net dès que l'élément est posé.

### Tests
- `tests/facecam-motion-style.test.ts` : priorités de `choisirStyleMotion`, lecture des phrases, concordance « style
  absent = Sobre » (les paramètres d'une carte sans style ne portent ni `style` ni `placement` et ne diffèrent d'une
  carte « sobre » explicite que par ce champ), placements par défaut, plancher de 3 % et listes ≥ 4 %, exemples Axion
  valides (schémas Zod), catalogue du monteur.
- `tsc` de `studio-rendu` propre ; vitest ciblé vert (motion-style, monteur, pré-cadré). Le `tsc` de la racine signale
  seulement `RouteContext` / `LayoutProps` (types générés par `next typegen`, absents de ce conteneur, sans lien).

## Fichiers du lot C touchés (ajouts minimaux)
- `src/briques/motion/types.ts` : deux champs facultatifs `style?` et `placement?` dans `MiseEnPageCarte`.
- `src/briques/motion/index.ts` : export de `style.ts`.
- `studio-rendu/compositions/commune/motion/noyau.tsx` : `zonesCarte` lit le placement (`ZONES_PLEIN` en « plein ») ;
  `taille` et `mesurer` appliquent `facteurTaille`. **C'est la correction voulue du plein écran : une carte plein
  écran SANS placement est désormais recentrée et agrandie** ; la moitié haute ne change pas.
- `MotionListe.tsx` : une ligne de renvoi au Spectaculaire + `flex: 1` sur le texte du point (correction).
- `MotionChiffre.tsx`, `MotionAvantApres.tsx`, `MotionLigneDeTemps.tsx`, `MotionDeuxColonnes.tsx`, `MotionTitre.tsx` :
  un import et une ligne `if (p.style === "spectaculaire") return <…Spectaculaire {...p} />;`.
- Lot D : `src/moteurs/montage-facecam/monteur/catalogue.ts` (règle, exemple, `STYLE_CARTE_MONTEUR`, `exemplesDemandes`).
- Planche Sobre `docs/facecam/planche-motion/` re-rendue (vidéos et page).

## Reste
- **Poser le style dans la demande de rendu** : `preparerCarte` / `parametresCarteModele` (lot C, `demande.ts`)
  recopient la mise en page : il suffit de passer `{ ...mp, style: choisirStyleMotion(...) }`. Le branchement côté
  monteur (intensité de la vidéo, phrase de Will, « Mes habitudes ») reste à faire là où le lot C/D appelle
  `preparerCarte` ; l'opération `ajouterCarte` n'a PAS de champ `style` (schéma strict du lot D non modifié) : le style
  se lit dans la phrase de Will (`lireDemandeStyle`) ou dans la description de l'opération.
- **Carte sur mesure** : ajouter `FICHES_STYLE_MOTION[style].consigne` à la consigne donnée à Claude.
- « Réglable par vidéo, par carte, ou pour les prochaines » : la portée (vidéo / carte / habitude) reste à brancher
  dans l'interface (lot D).
- Bruitages synchronisés facultatifs du Spectaculaire (impact, éclats, déchirure) : non faits.
- Les exemples du `catalogue.ts` du lot C (fuite d'eau) n'ont pas été modifiés pour éviter un conflit : à remplacer
  par `EXEMPLES_AXION` quand le lot C le voudra (aperçu par défaut des compositions).
- Le Spectaculaire est réglé et vérifié en plein écran 9:16 ; en moitié haute et en 4:5 / 1:1 il suit les zones, mais
  n'a pas été relu image par image.

## Points d'attention pour l'intégration
- Les fusions de `origin/feat/facecam-c` (habillage, écran partagé, pose des cartes plein écran `pose.ts`, refactor
  `lireBalises` du noyau) et de `origin/feat/facecam` (lots D, E) sont faites sans conflit ; tests ciblés verts après
  fusion (motion-style, monteur, pré-cadré, fondations, chaîne, intégration).
- Le rendu de la planche affiche parfois « ProtocolError: Target closed » (Remotion) sans effet sur les vidéos.
- Temps de rendu : le Spectaculaire coûte nettement plus cher (filtres de flou, 3D, ~2 à 3× le Sobre) ; à mesurer sur
  le conteneur avant de l'activer d'office en « Très dynamique ».
- La déchirure de sortie occupe les 0,5 dernières secondes : une carte de 3 s garde 2 s de contenu net ; le contenu
  du Spectaculaire attend la fin de l'entrée (0,5 s) avant d'arriver (les `aSec` plus tôt sont repoussés).
- Le flou de mouvement fort s'arrête dès que l'élément est posé : texte toujours net à l'arrêt.
- `ecartAvantApres` et `titreMarque` sont importés depuis les modèles Sobre (imports circulaires sans effet : utilisés
  au rendu seulement).
