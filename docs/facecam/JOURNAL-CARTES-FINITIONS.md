# Journal — finitions des cartes (constat visuel sur IMG_7747 v3, prod 10/10)

Vidéo réelle : montage v3 de IMG_7747, 82,8 s, 6 cartes, écran partagé 9:16 (carte en haut, visage en bas).
Données de travail : `tests/fixtures/img7747-v2-montage-reel.json` (mots réels) et le texte validé reconstitué de
`tests/facecam-reprise-cartes.test.ts`, passés par la planification complète de la chaîne (coupes, reprise retirée,
recalage des mots, texte validé horodaté, cartes, habillage). Aucun appel réel, aucun serveur touché, rien de fusionné
ni de déployé.

Contrôle visuel : rendu local (Remotion 4.0.532 + Chromium du conteneur, `studio-rendu/scripts/controle-cartes.ts`)
des cartes planifiées sur le fixture, à 0,1 / 0,6 / 2,5–2,8 / 5,6–5,8 s :
`docs/facecam/controle-cartes-finitions/avant.jpg` (code de master) et `apres.jpg` (cette branche).

## 1. Panneau vide

### Cause
La carte s'ouvrait au premier mot de la phrase, ses contenus arrivaient au mot dit : le panneau restait presque vide
jusque-là. Mesuré sur le fixture (master) : icône + mot « Une fuite » à 1,74 s de l'ouverture (prod : 1,64 s), liste
« Chez Axion-IA » 1er point à 0,76 s (prod : 0,8 s), chiffre « 45 min » à 2,94 s (seul un petit sur-titre et un anneau
vide avant). Le rendu de contrôle « avant » le montre (colonnes 0,1 s et 0,6 s).

### Correction (`src/briques/habillage-facecam/cartes-auto.ts`)
- `premierContenuSec(carte)` : instant du premier contenu PRINCIPAL (1er point, mot, compteur, 1re étape ; un titre ou
  un sur-titre seul ne compte pas, puisque c'est précisément ce que la prod montrait « vide »).
- `ouvrirAuPremierContenu` : la carte s'ouvre au plus `avancePanneauSec` = 0,4 s avant ce contenu (entrée du panneau :
  9 images = 0,36 s) ; les apparitions restent au mot dit ; 3 s au moins, dans la vidéo.
- Si la place manque (carte suivante prioritaire), la carte peut s'ouvrir plus tôt, vers son début d'origine,
  SEULEMENT si un titre / sur-titre est visible dès l'ouverture (sinon elle n'est pas posée, comme avant).

### Résultat exact sur le fixture
| Carte | Avant : ouverture → 1er contenu | Après |
|---|---|---|
| icône + mot « Une fuite » | 3,04 s → +1,74 s | 4,03 s → **+0,75 s** (sur-titre « Pas un problème de travail » dès l'ouverture ; place limitée par la liste à 7,35 s) |
| liste « Chez Axion-IA » | 15,73 s → +0,76 s | 16,09 s → **+0,40 s** |
| chiffre « Le diagnostic fuite — 45 min » | 46,20 s → +2,94 s | 47,99 s → **+1,15 s** (sur-titre dès l'ouverture ; place limitée par la liste numérotée à 51,32 s) |
| les 5 autres | ≤ 0,2 s | inchangées |

## 2. Débordement de la liste

### Cause
`MotionListe` posait titre + points dans un bloc centré à taille fixe (texte 69 px, pastille 121 px). En moitié haute,
la zone sûre fait 826 × 624 px : « Chez Axion-IA » + 4 points mesurait plus et débordait en haut et en bas
(« Automatise » coupé) ; idem le 3e point des « 3 questions » et « Les chiffres qui arrivent trop tard » (rendu
« avant »).

### Correction
- `src/briques/motion/disposition-liste.ts` (nouveau, pur) : `disposerListe` calcule les boîtes avec la chasse réelle
  de Poppins (`mesure.ts`, interligne et écart de rangées du rendu, agrandissement de 2,5 % du point dit compris) et
  prend la première mise en page qui tient : taille d'origine (une liste qui tenait ne bouge pas), puis espacements,
  pastilles et texte resserrés pas à pas (jamais sous le plancher de 3 % de la hauteur = 58 px), puis 2 colonnes
  (seulement si chaque mot tient dans sa colonne).
- `MotionListe.tsx` dessine exactement ces boîtes (positions absolues, `taillePx` / `largeurMax` imposés).
- Si rien ne tient en moitié haute (ex. 5–6 points longs avec titre), `dispositionQuiTient` pose la carte en plein
  écran (9:16 dans `habillage.ts`, 4:5 et 1:1 dans `declinaisons.ts`) : jamais un point coupé.
- Le style « Spectaculaire » (`ListeSpectaculaire`) n'est pas touché (non utilisé par défaut).

### Résultat exact
Les 4 listes réelles tiennent en moitié haute : « Chez Axion-IA » texte 58 px, dernier point en bas à 612 px sur 624 ;
« devis / relances / chiffres » 65 px (610) ; « 3 questions » 58 px (599) ; « Formation… » 65 px (596). Test sur 2 à
6 points (longs, courts, mêlés, avec ou sans titre) : 30 cas, aucun point hors du cadre ni chevauchant un autre.

## 3. Sous-titres

### Cause
Pendant un écran partagé, la ligne était posée à la jonction (`centreJonctionPct` = 50 %) : elle recouvrait le bas de
la carte. Et le titre d'appel à l'action « Réservez votre appel diagnostic gratuit » était doublé par les sous-titres.

### Correction
- `ligneSousTitresEcranPartage` (habillage-facecam/sous-titres.ts) : en 9:16, la ligne passe dans la moitié basse,
  sous la bouche de la personne telle qu'elle est posée (yeux à 37,5 % de la demi-hauteur), sur le menton / haut du
  torse, jamais sur la bouche ni sur la carte, bornée entre 50 % + air et le bas de l'image − 6 %. Passée à la
  composition par `ecransPartages[].ligne` (champ existant). Les formats 4:5 et 1:1 gardent leur règle (jonction avec
  la tête poussée sous la ligne, contrôlée par `controlerFormat`) : non touchés ici.
- `textesAffichesDesCartes` + `masquerTextesAffiches` (composition/incrustations.ts) + champ facultatif
  `EntreeComposition.textesAffiches` : pendant un titre (moitié haute ou plein écran) ou toute carte plein écran, un
  groupe dont TOUS les mots sont dans le texte affiché n'est pas dessiné. Masquage à l'image seulement : les données
  des sous-titres et l'export SRT restent entiers. Transmis par la chaîne (`supplements.textesAffiches`) et les
  déclinaisons.

### Résultat exact sur le fixture (visage yeux 33 %, bouche 45 %)
Ligne des 8 écrans partagés à **89,7 %** (avant : 50 %). Appel à l'action 79,46 → 82,62 s : les groupes qui répètent
« Réservez votre appel diagnostic gratuit » sont masqués ; aucun autre groupe ne l'est.

## 4. Liste « Un / Deux / Trois » absente en prod

### Cause
L'ancienne détection exigeait que chaque numéro OUVRE UNE PHRASE (au sens de `phrasesDe`) et soit suivi d'une
VIRGULE (« Un, »). Le texte validé réel et les mots alignés de la v3 ne sont pas dans le dépôt, donc la cause exacte en
prod ne peut pas être prouvée ; mais la même planification complète sur le fixture montre que la liste disparaît dès
que l'une de ces conditions casse (ancien code, résultats exacts) :

| Texte validé / mots | Ancien code | Nouveau |
|---|---|---|
| « Un, … ? Deux, … ? Trois, … ? » (reconstitution) | 8 cartes, liste ✔ | 8, ✔ |
| « Un : … » | **7, liste absente** | 8, ✔ |
| « Un. … » | **7, absente** | 8, ✔ |
| « 1. 2. 3. » | 8, ✔ | 8, ✔ |
| « Premièrement, … » | 8, ✔ | 8, ✔ |
| « Un où part… » (sans ponctuation) | **7, absente** | 8, ✔ |
| une seule phrase « …, et trois, … » | **7, absente** | 8, ✔ |
| blanc de 1,5 s (aligneur) après « Un, » / « Deux, » / « Trois, » | **7, absente** (×3) | 8, ✔ (×3) |

Un blanc de plus de 1,2 s coupe la phrase (`phrasesDe`) : « Trois, » se retrouve seul, son point est vide et toute la
liste était rejetée. Les autres hypothèses ont été écartées : pas de plafond de densité (aucun nombre maximal de
cartes), pas de conflit avec la carte 45 min (la liste numérotée, score 10, était posée en premier ; c'est la carte
45 min qui cédait), recalage de la reprise sans effet sur ce passage (reproduit avec recalage).
Non reproduit : la prod n'avait pas non plus la liste « Formation · Accompagnement · Audit · Automatisation »
(6 cartes au lieu de 8) ; aucune variante essayée (deux-points, phrase unique, blancs après « équipes, », « Certifexemple, »,
« bonnes. ») ne la fait tomber. À vérifier sur `mots-montes.json.gz` de la v3 et dans les alertes « 1 élément non fait »
(carte dont le rendu a échoué, retirée par la chaîne) — sans toucher au serveur.

### Correction
- `listesNumerotees` lit les numéros MOT PAR MOT (`marqueurA`), sans dépendre des phrases : « Un, », « Un : »,
  « Un. », « 2. », « 3) », « Premièrement, », « …, et trois, », et « Deux » sans ponctuation en tête de phrase ; la
  suite 1, 2, 3… est exigée (≤ 18 mots et 10 s entre deux numéros, un nouveau « 1 » la relance) ; chaque point va
  jusqu'au numéro suivant, le dernier jusqu'à la fin de sa phrase (12 mots au plus).
- Garantie : une liste numérotée passe toujours (`imposer`) — les cartes moins sûres qui la gênent sont raccourcies
  (3 s au moins) ou retirées, jamais elle.
- Pas de fausse liste : « Un premier diagnostic… », « une entreprise, deux entreprises… » restent sans liste (testé).

## Vérifications (résultats exacts)
- `tests/facecam-cartes-finitions.test.ts` (nouveau) : **55 tests verts** (panneau, débordement 2–6 points, sous-titres,
  liste numérotée : 6 variantes de texte, 3 blancs d'aligneur, transcription seule, créneau disputé, fausses listes).
- `tests/facecam-reprise-cartes.test.ts` : 16 verts ; (a) et (d) mis à jour pour la nouvelle règle d'ouverture
  (le panneau s'ouvre au 1er point / au compteur, sur-titre visible ; les apparitions restent au mot dit).
- Ciblés (habillage, cartes, motion, sous-titres, composition, coupes, monteur, `facecam-*`, `v-coherence-facecam`) :
  **32 fichiers, 408 tests verts**.
- Suite complète Vitest : **281 fichiers verts (1 ignoré), 3473 tests verts (3 ignorés)**.
- `next typegen` + `tsc --noEmit` : 0 erreur ; `studio-rendu` `tsc --noEmit` : 0 erreur ; `eslint .` : 0 erreur,
  0 avertissement.
- Contrôle studio-rendu : 36 images rendues (9 cartes × 4 instants) avec le nouveau code, planche `apres.jpg`.
