# Format « tableau animé » (code TB)

**État au 12/10/2026 : statut `actif`** (allumé le 12/10/2026 sur décision du propriétaire). Style par défaut des nouvelles fiches : `reference/1` depuis le 14/10 (voir plus bas) ; les fiches d'avant gardent le leur (`blocs/2`, `charte-video/1`). Visible dans le menu latéral (« Tableau animé », sous « Nouvelle vidéo »), dans la feuille « Créer » mobile et dans la grille de « Nouvelle vidéo », dont la carte mène à `/tableau/nouvelle` (jamais à l'assistant de face caméra).

## But

Une voix explique **une seule chose refaisable dans la minute**, pendant qu'un stylo écrit et dessine au trait sur une page blanche, avec la preuve à l'écran. Aucun visage. Vertical 9:16, 30 à 60 s (orange jusqu'à 90 s).

## Pièces demandées

La fiche (`src/formats/tableau-anime/index.ts`) les déclare dans `pieces` : habillage `charte-video/1`, stylo `crayon/1`, dessins, sons d'écriture et de page, fin par la bibliothèque « Appels », voix maître, rendu par scènes, contrôle de l'image finale. L'écran déclare : attente générique, retouche par opérations, pas de monteur en version 1, coûts masqués.

## Où vit chaque brique déjà fusionnée sur master

| Pièce | Où | Remarque |
|---|---|---|
| Fiche du format | `src/formats/tableau-anime/index.ts` (+ `tableau-anime.test.ts`) | Code `TB` dans `src/formats/registre-codes.ts`, inscrite dans `src/formats/index.ts`. Quatre structures déclarées comme données. Moteur : `simulation` |
| Fiche de scènes | `src/briques/fiche-scenes/` | Schéma, validation qui refuse, migration, empreintes par scène, clé de rangement. Tests : `tests/briques/fiche-scenes/` |
| Habillage | `src/briques/habillage/charte-video.ts` (+ `contraste.ts`) | Charte figée `charte-video/1` |
| Stylo | `src/briques/stylo/` | `crayon/1` et ses gestes. Tests : `tests/briques/stylo/` |
| Dessins | `src/briques/dessins/` | Banque fermée de dix dessins au trait (`registre/`, `traces/`). Tests : `tests/briques/dessins/` |
| Registre des droits | `src/briques/droits/` | Licence de chaque dessin, du stylo, de la police. Tests : `tests/briques/droits/` |
| Voix maître | `src/briques/voix-maitre/` | Nettoyage des blancs, types, sous-machine texte validé → son maître (`machine.ts`). Le calage reste dans `src/briques/calage/`. L'avocat réexporte. Tests : `tests/briques/voix-maitre/` |
| Rendu scène par scène | `src/briques/motion/rendu-cartes.ts` | Options `bloquant` et clé par empreinte ; comportement par défaut inchangé. Tests : `tests/briques/rendu-par-scenes/` |
| Copie vers l'image de rendu | `deploiement/studio-rendu/Dockerfile` | Habillage, stylo et dessins copiés |
| Sous-titres | `src/briques/sous-titres/` | Commun à tous les formats |
| Variété visuelle | `src/briques/variete/` | Refuse une structure des 2 dernières vidéos, des dessins ou une accroche qui se répètent ; propose la structure suivante ; refus levable par un geste motivé ; `resumeVisuelDepuisFiche` tire le résumé d'une fiche de scènes. La variété du **texte** reste aux contrôles existants de `src/domaine/controles-script/diversite.ts`. Tests : `tests/briques/variete/` |

## Formats de sortie par réseau (11/10)

Une fabrication peut sortir plusieurs formats d'image ; la voix et le calage sont faits **une seule fois** pour toutes.
Source de vérité : `src/moteurs/montage-tableau/formats-sortie.ts` (dimensions, réseaux servis, zones sûres avec leur
source ou « valeur prudente »).

| Format | Dimensions | Réseaux | Zone sûre (haut / droite / bas / gauche, %) |
|---|---|---|---|
| `vertical` (défaut) | 1080 × 1920 | TikTok, Reels Instagram et Facebook, YouTube Shorts, stories | 14 / 18 / 30 / 6 |
| `portrait` | 1080 × 1350 | Fil Instagram, fil Facebook | 5 / 5 / 12 / 5 |
| `carre` | 1080 × 1080 | LinkedIn, fil Facebook | 5 / 5 / 12 / 5 |
| `horizontal` | 1920 × 1080 | YouTube | 6 / 4 / 12 / 4 |

- **Mise en page calculée** pour chaque format (`mettreEnPage(fiche, { format })`), jamais recadrée : même ordre
  d'écriture, aucun mot coupé, tailles du style lues sur une image de **référence** 1080 × 1920 (même taille réelle sur
  un téléphone), positions sur l'image. Hors du vertical : la bande des sous-titres garde la même part de la hauteur ;
  en 16:9 les lignes ne dépassent pas 1,25 largeur de référence (page centrée) ; le crayon au repos reste dans la zone
  sûre. Le **vertical est inchangé au caractère près** (test).
- Le style (couleurs, polices, blocs : `charte-video/1`) reste à part : un autre style peut relire la table et les zones.
- Fabrication : `sorties` (défaut `["vertical"]`). Chaque sortie a ses scènes (clé `…/scenes/<videoId>/<format>-<empreinte>`),
  sa vidéo et sa vignette (`tb-<format>-…-<ratio>.mp4`), ses contrôles et le contrôle de son fichier (dimensions exactes,
  aucun bord noir) ; le journal (`resume`) liste format, dimensions, chemin, durée, taille. Le vertical garde ses clés.
- Lanceur : `--sorties vertical,portrait,carre,horizontal`. Aperçus : `docs/formats/apercus-formats/`
  (`npx tsx tests/tableau/formats/apercus-formats.mts`).
- Bande noire de 8 px au bord droit (essai du 11/10) : cause et correction dans `tableau-anime-essai.md`, § 7.

## Raccords du 11/10 (branche `tableau/raccords`)

- **Voix** : recette validée, paramètres dans `src/moteurs/montage-tableau/recette-voix.ts` (seul fichier) : HeyGen
  `starfish`, vitesse 1,1, fr-FR ; blancs resserrés sur les horodatages des mots (garde 0,035 s ; 0,10 / 0,13 / 0,20 s ;
  fondus 6 ms ; queue +0,45 s) ; `atempo` 1,08, passe-haut, compresseur, `loudnorm` −14 ; fondu de sortie 0,22 s et
  0,8 s de silence. Calcul pur `planRecetteVoix` (mots recalés, utilisés par le calage) ; son traité par `studio-rendu`
  (`nettoyage-audio`, mode `recette`). Sans horodatage : voix brute, et le rapport le dit.
- **Générateur de scripts** dans `/tableau/nouvelle` (« Écrire le script pour moi ») : coût pire confirmé avant,
  passes par `executerRolePourVideo` (client `services/tableau-scripts/client-studio.ts`) ; « Utiliser ce script »
  remplit le texte et enchaîne sur le découpage ; trace lisible sous `/tableau/traces/<id>`.
- **Réseaux → sorties** : `sortiesDesReseaux` (`formats-sortie.ts`) ; `entrees.tableau.sorties` lu par le moteur ; une
  sortie de fabrication par format ; « Votre vidéo » montre chaque format, ses réseaux et son téléchargement.
- **Fin** : « Écrivez {MOT} en commentaire. Je vous l'envoie. » validée (chaque groupe ; écran : « Écrivez {MOT} en
  commentaire », la phrase entière déborde du cadre de la fin commune) ; appel de diagnostic proposé, non validé ; le
  mot saisi va jusqu'à `finPour`, pour le groupe de réseaux de chaque sortie.
- **Plafonds propres** par vidéo : `tableau.plafondDecoupageUsd` (0,60 $) et `tableau.plafondScriptUsd` (pire cas d'une
  génération, marge comprise), à part du plafond des textes.
- **Traçabilité** écrite par la chaîne (`tracer` → `ajouterEvenement`) : commit (`STUDIO_COMMIT`, `GIT_COMMIT`,
  `SOURCE_COMMIT`… sinon « inconnu »), voix et recette, début des étapes, fichiers, contrôles, lien de la trace du script.

## Style « blocs/2 » (11/10) : le style de la vidéo modèle « Formation »

Le style d'avant (page ivoire écrite au stylo) a été rejeté ; la vidéo modèle faite à la main (branche
`tableau/maquettes-design-v2`, `maquettes/tableau-design-v2/video/formation/`) fixe le style. Le moteur le produit seul,
depuis la fiche de scènes, dans les quatre formats de sortie.

- **Choix du style** : `fiche.habillage` — `blocs/2` (nouveau, **par défaut des nouvelles fiches** : `STYLE_PAR_DEFAUT_TABLEAU`,
  repris par le découpage quand l'appelant ne donne pas d'habillage) ou `charte-video/1` (style d'avant, inchangé, ses tests
  restent verts).
- **Fiche** : champ FACULTATIF `ecrans` de chaque scène (1 ou 2 écrans) : `moment` (accroche, douleur, retournement, promesse,
  etape, exemple, recapitulatif, appel), `gabarit`, `etiquette`, `etape` (`n`, `total`, `nom`), `motsForts`, `liste`
  (`texte`, `detail`, `ancre`), `motCommentaire`, `ancre` (second écran). Tout champ absent prend sa valeur de repli
  (`descriptionsEcrans`, `mise-en-page.ts`) ; une scène sans écran prend celui de son rôle ; un gabarit qui ne tient pas se
  replie sur un gabarit plus simple. Aucune fiche ne fait échouer le rendu.
- **Gabarits** (`src/briques/tableau-scene/v2/disposition.ts`) : accroche avec cases barrées ou compteur, constat
  (conversation, réponse plate gribouillée, tampons), idée reçue barrée, étape (grand numéro et cartes), liste qui se remplit,
  semaine L-M-M-J-V, exemple avant/après avec « Exemple illustratif », récapitulatif à coches, appel « Écrivez MOT en
  commentaire » (le mot se tape dans une bulle) ou « Appel de diagnostic ».
- **Charte** (`v2/charte.ts`) : fonds encre `#110A05`, ivoire `#E9DCC8`, orange `#B44F29`, en alternance (jamais deux
  fois le même) ; titres Montserrat ExtraBold ajustés à la largeur, rangée par rangée ; mots forts en blocs ; étiquette de
  section en haut à gauche ; `axion-ia.com` en haut à droite (zone sûre), en grand sur l'écran de fin ; barre des étapes.
  L'orange n'est **jamais** une couleur de texte ; contraste ≥ 3:1 pour le texte d'au moins 52 px (référence 1080), 4,5:1
  sinon (tests).
- **Animation** (`v2/animation.ts`) : entrées sur l'heure du calage (le bloc d'un mot fort claque sur le mot dit quand les
  mots de la voix sont donnés), un changement au moins toutes les 1,7 s (relances), crayon qui souligne, coche et barre,
  jamais sur un mot (inclinaison vérifiée, sinon il disparaît), couché au repos dans la zone sûre.
- **Sous-titres** : pastille ivoire, mot dit souligné d'orange, dans la bande en bas de la zone sûre ; dessinés par la scène
  quand `proprietesScenes` reçoit `mots`.
- **Bruitages** : `trait`, `toc`, `validation` dans la banque `src/donnees/bruitages.ts` (`SONS_TABLEAU`, fichiers
  `public/bruitages/tableau-*.wav`), ≥ 18 dB sous la voix, déclarés par le plan des scènes ; liste de la vidéo :
  `bruitagesVideoV2`, recette : `RECETTE_STYLE_BLOCS_2` (`v2/recette.ts`). Aucune musique.
- **Fin** : la dernière scène finit 2,5 s après la voix + 0,4 s de fondu d'image (calage) ; `RECETTE_STYLE_BLOCS_2.finTenue`.
- **Branché dans la chaîne (12/10)** : `pieces.habillage` du format vaut `blocs/2` (statut alors `masque`, depuis `actif`) ; création
  et découpage produisent des fiches `blocs/2` par défaut. `fabriquer.ts`, pour une fiche `blocs/2` et pour CHAQUE sortie :
  mots de la voix passés aux scènes (sous-titres dessinés par la scène, ceux de la composition coupés), scènes et export
  à 30 i/s, bruitages `bruitagesVideoV2` mixés sous la voix par la passe audio existante de `studio-rendu` (gain de la
  recette, jamais à moins de 18 dB sous la voix, aucun son dans la dernière seconde), AUCUNE scène de fin ajoutée :
  l'écran d'appel de la dernière scène prend le MOT saisi (`entrees.tableau.mot` → `finEtAppelDuTableau` → option
  `appel` de `mettreEnPage`) ou l'écran « Appel de diagnostic » selon la fin retenue ; tenue 2,5 s après le dernier mot
  puis fondu de 0,4 s (le silence de 0,8 s ajouté par la recette de voix est couvert, pas ajouté). Contrôle d'avant la
  voix aux seuils du style (`controles.ts` : 3:1 pour le texte gras ≥ 52 px de référence, 4,5:1 sinon ; plus petit
  texte = étiquette, 28 px ; bande = pastille des sous-titres). La traçabilité note le style (événement « code »).
  `public/bruitages/manifeste.json` liste les trois sons du tableau. Tests : `tests/tableau/style-v2-moteur/`.
- **Aperçus** : `docs/formats/apercus-style-v2/` (`npx tsx tests/tableau/style-v2/apercus.mts`), fiche témoin
  `tests/tableau/style-v2/temoin-formation.ts`, tests `tests/tableau/style-v2/`.
- **Écran rempli, texte écrit une fois** (relecture de la première vidéo fabriquée, 12/10) : chaque écran laisse au
  plus un tiers de sa zone utile vide hors marges (`src/briques/tableau-scene/v2/remplissage.ts` ; une grande carte
  ne remplit pas par elle-même, les traits gris ne comptent que pour leur trait) et n'écrit jamais deux fois la même
  ligne (titre et corps) : deux lignes bloquantes de la relecture. Une place libre reçoit les pictogrammes de la fiche
  en grand (sinon ceux du moment). Planche avant / après du témoin « relances de devis » :
  `docs/formats/apercus-dessin-3/` (`npx tsx tests/tableau/dessin-3/apercus.mts`), tests `tests/tableau/dessin-3/`.

## Style « reference/1 » (14/10) : le reel de référence « tableau blanc »

Will a validé la maquette (branche `tableau/maquette-style-reference`, `maquettes/tableau-style-reference/`) : le style
« blocs/2 » faisait « brouillon, tout mélangé ». Le moteur produit maintenant ce style, depuis la même fiche de scènes,
dans les quatre sorties, calé sur la voix. **Style par défaut des nouvelles fiches** (`STYLE_PAR_DEFAUT_TABLEAU`,
`pieces.habillage` du format) ; une fiche créée avant garde son style.

- **Page** : un seul fond `#F7F2E8`, aucune boîte, étiquette, tampon ni filigrane. Les `page` de la fiche sont les pages
  du reel : coupe nette vers une page blanche ; une page se remplit de haut en bas, bloc après bloc, rien n'est effacé.
- **Blocs** (`src/moteurs/montage-tableau/mise-en-page-reference.ts`) : un bloc par ligne écrite de la fiche (chiffre,
  mention ; une preuve : un bloc « Avant », un bloc « Après »), centré, Montserrat ExtraBold 52 px de référence
  (titres 58 ; 44 au plus petit, page très chargée ; 60 au plus grand, page peu chargée), 1 à 3 rangées équilibrées,
  colonne jusqu'à ~85 % de la largeur. Couleurs : encre ; terracotta pour `alerte` et « Avant » ; sauge pour
  `resultat`, `avantage`, « Après » et la scène de fin. Un même texte n'est écrit qu'une fois par page.
- **Remplissage** (réglage du 14/10 après regard des planches : « trop vide, texte trop petit ») : la page commence EN
  HAUT (premier bloc vers y = 140 en vertical : haut de la zone sûre du style à 6 %) et se remplit vers le bas, blocs
  serrés à écart régulier ; une page peu chargée grandit (taille, puis écart) jusqu'à remplir 80 % de sa hauteur utile.
  Horizontal : une page large centrée, ou deux colonnes de blocs quand la page est chargée.
- **Dessins** (`src/briques/tableau-scene/reference/cliparts.ts`) : la banque recoloriée (aplats terracotta, sable,
  encre, ivoire, miel ; contour encre fin), ~120 px, un par idée, à 30 px de son bloc (jamais collé), le groupe
  « texte + dessin » centré, en alternance gauche / droite.
- **Crayon** (`src/briques/tableau-scene/reference/animation.ts`, rendu `studio-rendu/compositions/tableau/reference/`) :
  il écrit chaque bloc à l'heure de son mot d'ancre (bord dévoilé de gauche à droite, la pointe sur la ligne de base),
  glisse 0,3 s entre deux blocs, trace les dessins (contour 0,5 s, couleur 0,3 s), fait les marques et les gestes de la
  fiche d'un trait simple ; 70 % de la maquette ; il ne cache jamais la ligne en cours, ne sort jamais de l'image et
  s'incline autrement quand il couvrirait un texte déjà écrit ; planifié page par page (aucun saut entre scènes) ;
  posé sous la page finie à la fin. L'accroche est écrite dès la première image.
- **Fin** : la dernière scène écrit l'appel de la fiche ; TikTok et Shorts : la phrase de leur fin validée puis
  « axion-ia.com », en sauge. La page finie tient 2,5 s puis 0,4 s de fondu (comme « blocs/2 »). **Aucun sous-titre** :
  le texte écrit les remplace (bas de la zone sûre du vertical à 20 %).
- **Contrôles** (`controles-reference.ts`) : rien ne dépasse de la zone sûre, aucun chevauchement, un dessin par idée,
  couleurs du style, texte écrit une fois, blocs de 1 à 3 lignes, page non vide, page remplie (3 blocs ou plus : au
  moins les 2/3 de la hauteur) ; taille ≥ 44 px de référence et
  contraste 4,5:1 par la brique commune. Règles gardées : texte dit mot pour mot, douleur dite et écrite dans les 3 s
  avec un geste fort, un événement visuel (bloc écrit, dessin, geste) au moins toutes les 4 s, fin propre de TikTok et
  Shorts.
- **Preuves** : `docs/formats/apercus-reference-1/` — `apres/` (une image par page, quatre fiches réelles, quatre
  formats : `npx tsx tests/tableau/reference-1/apercus.mts docs/formats/apercus-reference-1/apres --formats
  vertical,portrait,carre,horizontal`), `avant/` (les mêmes fiches en « blocs/2 »), `animation-6s.mp4`
  (`npx tsx tests/tableau/reference-1/video.mts`). Tests : `tests/tableau/reference-1/`.

## Trois styles « on écrit sur un vrai tableau » (16/10)

Maquettes validées : PR #280 (`maquettes/tableau-v2/`). Moteur : la mise en page `src/moteurs/montage-tableau/mise-en-page-tableau.ts`
(écriture manuscrite mesurée sur les polices, dessins illustrés en polylignes, 85 à 95 % de la hauteur utile), l'animation
commune `animation-3.ts` (l'outil trace aussi les traits des dessins), le rendu `studio-rendu/compositions/tableau/trois-styles/`
(support fabriqué une fois, encre et matière, outil, chapitres, effacement 0,42 s).

| Style | Série (par défaut) | Support | Outil | Polices |
|---|---|---|---|---|
| `tableau-blanc` | Automatisations | tableau blanc, cadre alu, auget | feutre « AXION » | Permanent Marker (titres), Kalam |
| `ardoise` | Formation | ardoise mate, cadre bois, filet de craie | bâton de craie | Kalam, Caveat Brush (chiffres) |
| `paperboard` | Audit, Coaching, toute autre | feuille sur chevalet, pince, auget | marqueur « ATELIER » | Caveat Brush |

- Choix : `STYLE_PAR_SERIE` (`src/briques/tableau-scene/trois-styles/styles.ts`, une seule table, modifiable) ; le champ
  facultatif `styleTableau` de la fiche prend le dessus. Posé au découpage et à la fabrication (`avecStyleTableau`) ; une
  fiche sans style garde la page ivoire d'avant.
- Chiffres : sur la page de l'exemple qui porte « Exemple illustratif », les chiffres dits s'écrivent (« 10 min ») ;
  ailleurs, un chiffre non sourcé reste retiré, et une phrase tronquée par ce retrait est refusée (`fidelite-texte.ts`).
- Contrôles (`controles-tableau.ts`, tests `tests/tableau/trois-styles/`) : contraste ≥ 4,5:1 (texte, à chaque image) et
  ≥ 3:1 (traits), aucune couleur verte ou bleue, bande des sous-titres libre (outil compris), texte entier, pas d'écran
  vide entre deux pages, contenu sur 85 à 95 % de la hauteur utile, aucun doublon titre / phrase.
- Rythme (critique indépendante #291, 16/10) : seuls le repère de partie et le numéro d'étape arrivent avec la page (et
  l'accroche, entière à la première image) ; le titre s'écrit d'un trait (0,4 à 0,6 s) dès la fin de l'effacement, chaque
  autre bloc pendant que la voix le dit, chaque ligne sous la pointe ; une liste trace sa case vide, son petit dessin, son
  texte, puis la coche. L'outil (`pose-outil.ts`, pur, lu par le rendu et par la fabrication) ne reste jamais plus de
  0,6 s dans l'image sans tracer : au-delà il sort par la droite et revient ; sa couleur ne change que dehors. La page
  suivante arrive 0,35 s après sa coupe (`RETARD_PAGE_TABLEAU_MS`) et chaque page reste finie, l'outil sorti, 0,65 s avant
  (`OUTIL_TABLEAU`). Refus de la fabrication (`controlerAnimationTableau`, contrôle « outil ») sinon.
- Exemple : un chiffre dit avec son unité et écrit nulle part (« …et l'envoie : trois minutes. ») s'écrit à la fin du
  texte de sa scène (« 3 min » en très grand, le texte en petit) ; sous un chiffre, jamais une phrase suspendue
  (« Chaque mail lui prenait 10 minutes » → « 10 min / par mail »).
- Accroche en 3 lignes (4 au pire), coupée par groupes (« le même temps » ensemble) ; bouton d'appel plein terracotta
  `#B44F29`, texte `#FBF7EF` (4,8:1), marge intérieure ≥ 40 px ; sur l'ardoise, la pastille des sous-titres est bordée
  (`PASTILLE_AXION_ARDOISE`).
- Aperçus du moteur : `docs/formats/apercus-trois-styles/` (`npx tsx tests/tableau/trois-styles/apercus.mts`), dont la
  vidéo complète du témoin v667 dans chaque style (`--film`).

## Ce qui reste (absent de master aujourd'hui)

- Le moteur `montage-tableau` : il n'existe pas dans `src/moteurs/` ni dans `IDS_MOTEURS` ; la fiche pointe encore vers `simulation`.
- Les compositions propres : aucun dossier `tableau` dans `studio-rendu/compositions/`.
- Les types d'éléments de scène du tableau et ses règles de validation propres (`ExtensionFormat` de `src/briques/fiche-scenes/schema.ts`) : non écrits.
- La bibliothèque « Appels » et le contrôle de l'image finale (`pieces.fin`, `pieces.controleImage` sont déclarés, mais aucune brique correspondante dans `src/briques/`).
- Les sons d'écriture et de page (déclarés dans `pieces.sons`).
- Le branchement du garde-fou de variété à la fabrication : la brique existe mais personne ne l'appelle encore.
- Les tests de contrat du format (`tests/tableau-anime/`), les vidéos témoins, l'écran de la vidéo, le chat de modification (version 2).
- Les pièces de contrôle communes qui manquent encore à tous les formats (voir `AJOUTER-UN-FORMAT.md`, § 2).

Guide pour ajouter un format : `docs/formats/AJOUTER-UN-FORMAT.md`.
