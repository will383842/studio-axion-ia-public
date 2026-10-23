# 71 · Image → vidéo : ce que le moteur sait faire aujourd'hui, et ce qui est figé (15/10/2026)

**Lu sur origin/master du 15/10/2026, sans rien modifier, sans rendu ni appel payant.** Les numéros de ligne ont été vérifiés un par un. Les points marqués « constat » sont lus dans le code ; ils restent à confirmer par un rendu.

## En bref, pour Will

- **Rien n'est tiré au hasard.** Avec la même image et le même script, le moteur refait exactement la même vidéo. C'est voulu (on peut refaire et comparer), mais cela veut dire qu'aujourd'hui **la seule variété vient de l'image et du texte écrit par l'IA**.
- **Ce qui change d'une vidéo à l'autre** : le contenu de l'image (étapes, branches, chiffres), le texte du script, le choix du fond écran par écran, la famille d'accroche, et la fin selon le réseau.
- **Ce qui ne change jamais** : la charte (2 fonds, 2 polices, 1 orange), la façon dont la caméra bouge, la façon dont les éléments apparaissent, la forme des flèches, les transitions (coupe franche), l'ordre des parties, le traitement des chiffres, le jeu de sous-titres, les bruitages (même ordre de départ), la fin.

Légende : **VARIÉ** = choisi parmi plusieurs options · **FIGÉ** = toujours pareil · **IMAGE** = déduit de l'infographie ou du script.

| # | Élément | Ce qui décide | Verdict |
|---|---|---|---|
| 1 | Ouverture | texte : script ; famille d'accroche : 5 au choix de l'IA ; gabarit : règle fixe (3 gabarits) | texte IMAGE · famille VARIÉ (libre, sans suivi) · animation FIGÉ |
| 2 | Mise en page de la toile | graphe de l'image ; 3 dispositions essayées toujours dans le même ordre | structure IMAGE · gabarit FIGÉ |
| 3 | Caméra | suit les nœuds dans l'ordre où la voix les nomme ; un seul type de mouvement | trajet IMAGE · style FIGÉ |
| 4 | Ordre de construction | chaque élément surgit sur le mot qui le nomme | ordre IMAGE · mécanique FIGÉ |
| 5 | Flèches et fils | une seule flèche courbe | présence IMAGE · forme FIGÉ |
| 6 | Blocs | composant choisi selon le type d'image (8 recettes) ; 12 micro-dessins choisis par mots-clés | choix IMAGE · dessin FIGÉ |
| 7 | Chiffres et bénéfices | bandeau « Résultat » sombre, compteurs, « claque » | quoi IMAGE · traitement FIGÉ |
| 8 | Transitions | coupe franche partout | FIGÉ |
| 9 | Fonds | 2 fonds ; l'IA choisit écran par écran, certains forcés | palette FIGÉ · alternance IMAGE |
| 10 | Bruitages | 5 familles × 4 variantes, à tour de rôle, toujours en partant de la 1ʳᵉ | placement IMAGE · variantes VARIÉ (rotation, même départ) |
| 11 | Sous-titres (#250) | mélange de styles par règles, intensité imposée « équilibré » | placement IMAGE · jeu de styles FIGÉ |
| 12 | Fin | phrase-choc, question, diagnostic, lien du réseau | question IMAGE · suite FIGÉ par réseau |
| 13 | Voix | clone de Will, réglages uniques | FIGÉ (voulu) |
| 14 | Durée et rythme | durée selon la complexité ; seuils de rythme fixes | durée IMAGE · seuils FIGÉ |
| 15 | Réseaux | même corps pour tous ; seule la fin change | FIGÉ par réseau |

## Où sont les fichiers cités en abrégé

| Nom court | Chemin complet |
|---|---|
| `mise-en-scene.ts`, `fabrication.ts`, `regles.ts`, `regles-scene.ts`, `recettes.ts`, `ecriture.ts`, `ecrans-v4.ts`, `controles-scene.ts`, `bruitages.ts` (sans dossier), `sous-titres.ts`, `sous-titres-varies.ts`, `fins.ts`, `voix.ts`, `assemblage.ts`, `reseaux.ts` | `src/moteurs/montage-image-video/` |
| `plan.ts`, `plan-objets.ts`, `Compositions.tsx`, `Noeud.tsx`, `FlecheCourbe.tsx`, `Entete.tsx`, `Ensemble.tsx`, `PhraseChoc.tsx` | `studio-rendu/compositions/image-video/` |
| `Accroche.ts`, `Titre.ts`, `commun.ts` | `studio-rendu/compositions/cas-concret/plans/` |
| `Fond.tsx` | `studio-rendu/compositions/cas-concret/socle/Fond.tsx` |
| `Racine.tsx` | `studio-rendu/compositions/Racine.tsx` |
| `camera.ts`, `cadrage.ts`, `disposition.ts`, `temps.ts`, `types.ts`, `courbes.ts`, `micro-objets.ts` | `src/briques/schema-motion/` |
| `ecrans-motion/proprietes.ts` | `src/briques/ecrans-motion/proprietes.ts` |
| `charte-duo.ts` | `src/briques/habillage/charte-duo.ts` |
| `melange.ts` | `src/briques/sous-titres/melange.ts` |
| `complexite.ts`, `plafonds.ts`, `fiche.ts` | `src/domaine/image-video/` |
| `image-video-rendu.ts` | `src/services/image-video-rendu.ts` |

---

## Vue générale : aucune part de hasard

- **Aucun hasard nulle part.** La mise en scène l'écrit dans son en-tête : « Rien n'est tiré au hasard : mêmes entrées = même ligne de temps » (`src/moteurs/montage-image-video/mise-en-scene.ts:18`). La fabrication le redit (`fabrication.ts:8-9`).
- `grep Math.random|graine|seed` ne trouve rien dans `src/moteurs/montage-image-video`, `src/briques/schema-motion`, `studio-rendu/compositions/image-video` ni `src/services/image-video*`.
- **Seules sources de différence entre deux vidéos :**
  - le **contenu de l'image**, c'est-à-dire la carte : nœuds, liens, groupes, chiffres, type ;
  - le **script écrit par Claude Opus** : textes, choix de scène et choix de fond par écran, famille d'accroche ;
  - les **heures des mots** de la voix ;
  - le **réseau**, qui ne change que la fin.
- **Rendu.** Chaque bloc de la ligne de temps est rendu à part puis monté bout à bout (`src/services/image-video-rendu.ts:1-12`). Le moteur passe par 4 compositions (`image-video-rendu.ts:47`) :
  - `CasConcretEcran` pour les écrans v4 du cas concret ;
  - `ImageVideoScene` pour la toile ;
  - `ImageVideoObjets` ;
  - `ImageVideoMoments`.
- **Déclaration des compositions IV.** Elles sont dans `studio-rendu/compositions/image-video/Compositions.tsx:40-53` et inscrites dans `Racine.tsx:138`.

Légende des verdicts :
- **VARIÉ** : choisi parmi plusieurs options.
- **FIGÉ** : toujours pareil.
- **IMAGE** : déduit du contenu de l'infographie et du script.

---

## 1. Ouverture (premières secondes, accroche)

**Ce que fait le code**

- **Ossature imposée.** Le premier écran est toujours la partie « accroche ».
  - Le contrôle Q07 exige les 6 parties dans l'ordre et vérifie que le premier écran dit l'accroche A (`regles.ts:388-401`).
  - L'accroche fait 8 mots au plus et doit être finie avant 3 s (`regles.ts:70-71`).
- **Deux accroches écrites, une seule utilisée.**
  - Claude écrit deux accroches de familles différentes, parmi 5 familles : chiffre, question, ratio, situation, liste (`src/domaine/image-video/fiche.ts:53` ; consigne `ecriture.ts:58`).
  - Seule l'accroche A sert : `fabrication.ts:725` lit `accroches[0]`. L'accroche B n'est utilisée nulle part dans la vidéo.
- **Rendu de l'accroche.** La scène « accroche », « chiffre » ou « titre » donne un écran v4 « émotion » (`mise-en-scene.ts:427, 435`). Le type est choisi par une règle unique (`contenuEmotion`, `mise-en-scene.ts:1204-1213`) :
  - scène `chiffre` avec un nombre orange : écran « chiffre » avec compteur ;
  - sinon : écran « accroche » (3 lignes au plus) ou « titre » (2 lignes au plus) (`ecrans-v4.ts:11`).
- **Animation fixe de l'écran accroche** :
  - étiquette, puis lignes Anton écrites mot par mot ;
  - la 1ʳᵉ ligne est déjà commencée de 0,5 s à l'image 0, à un pas de 0,12 s par mot ;
  - lignes suivantes toutes les 0,7 s par défaut (`studio-rendu/compositions/cas-concret/plans/Accroche.ts:12-16, 27`).
- **Entrée d'écran** : opacité 1 si l'écran commence à 0, sinon fondu de 35 % à 100 % et échelle de 1,04 à 1, sur 0,2 s (`cas-concret/plans/commun.ts:81-87`).
- **Constat de code.** Les instants des lignes envoyés par l'IV s'appellent `ligne-0`, `ligne-1`… (`mise-en-scene.ts:1572`). Les composants v4 attendent `titre-1`, `titre-2`… (`src/briques/ecrans-motion/proprietes.ts:78` ; `cas-concret/plans/Accroche.ts:27` ; `Titre.ts:44`). Aucune correspondance n'a été trouvée.
  - Conséquence probable : les lignes des écrans v4 de l'IV apparaissent à heures fixes et non sur leur mot dit (accroche −0,5 / 0,7 / 1,4 s ; titre 0,02 / 0,5 s, `Titre.ts:35`).
  - Seule la cible `question` correspond.

**Verdict**
- Texte : IMAGE (écrit par Claude).
- Famille de l'accroche : VARIÉ (5 familles, choix libre de Claude, aucune graine ni rotation).
- Mise en forme et animation : FIGÉ (3 gabarits possibles : accroche, chiffre, titre ; choix par règle selon la scène et la présence d'un nombre orange).

---

## 2. Mise en page de la toile (comment l'image est redessinée)

**Ce que fait le code**

- **L'image source n'est jamais montrée.** Le schéma est redessiné à partir de la carte (`schemaDeLaCarte`, `mise-en-scene.ts:405-421`). Les photos de personnes sont exclues (`:407`). `Ensemble.tsx:22` accepte bien une `imageSource`, mais `Compositions.tsx:87` ne la passe jamais.
- **Disposition** (`src/briques/schema-motion/disposition.ts:1-10, 168`) :
  - couches verticales selon la profondeur dans le graphe ;
  - colonnes par branche ;
  - branche majoritaire **toujours à gauche et toujours orange** (`:183-190`) ;
  - tronc commun centré au-dessus ;
  - sinon des bandes `avant | tronc | après` (`:193-200`).
- **Cartes des nœuds** : carte blanche arrondie (rayon 34 px), libellé en Anton, détail en Inter Bold, pastille d'icône à cheval sur le bord gauche, coche verte en haut à droite (`studio-rendu/compositions/image-video/Noeud.tsx:2-5, 35-45, 79-98`).
  - Nœud actif : contour de 6 px et halo.
  - Nœud déjà vu : grisé à 35 % (`plan.ts:35`).
- **Trois variantes de disposition**, `normale`, `serree` et `branche-centree` (`disposition.ts:147, 157-161`). Ce n'est **pas** une source de variété : elles sont essayées dans l'ordre, et la première qui ne coupe aucun texte est gardée (`cadrage.ts:33-42`).
- **Mesures fixes** : `MESURES_TOILE` (`disposition.ts:29-43`) :
  - largeur de boîte 240 à 680 px, marge 40 ;
  - écart X 80, écart Y 140, écart de séparation 320.
- **Zones de l'écran** (`src/briques/schema-motion/types.ts`) :
  - écran 1080 × 1920 (`:13`) ;
  - bas de l'en-tête à 0,245 (`:23`) ;
  - bande des sous-titres de 0,60 à 0,67 (`:38`) ;
  - zone utile de 0,265 à 0,58 (`:41`) ;
  - contenu sans en-tête de 0,09 à 0,58 (`:47`).

**Verdict**
- Topologie, couleurs des nœuds et textes : IMAGE.
- Gabarit graphique, règles de placement, orange à gauche : FIGÉ.
- Variante de disposition : repli par règle (3 options, toujours dans le même ordre), pas une variation.

---

## 3. Chemins de caméra (zoom, pan, ordre de visite)

**Ce que fait le code**

- **Ordre de visite** : l'ordre dans lequel la voix **nomme** les nœuds. Chaque nœud nommé ou mentionné devient un point de passage (`mise-en-scene.ts:1617`, `blocToile`). La caméra se pose sur le nœud parlé, centré dans la bande de contenu (`src/briques/schema-motion/camera.ts:1-16, 319-341`).
  - Un nœud déjà posé et renommé est un simple rappel de caméra (`mise-en-scene.ts:693-698`).
  - On revient au nœud de décision après une branche (`:696`).
- **Un seul type de mouvement** :
  - panoramique et zoom interpolés sur la courbe douce `3u² − 2u³` (`camera.ts:37-40`) ;
  - arrivée 0,25 s avant le mot (fenêtre de 0,2 à 0,3 s) ;
  - vitesse au plus 1,2 écran par seconde ;
  - zoom borné entre 0,8 et 1,6 (`camera.ts:19-29`) ;
  - zoom préféré **forcé à 1** pour l'IV (`mise-en-scene.ts:1677` ; `studio-rendu/.../image-video/plan.ts:50`).
- **Pas d'effet caméra** : ni rotation, ni dézoom d'ensemble (`camera.ts:7`), ni bougé, ni zoom d'emphase.
- **Retard de la caméra.** Si la caméra arrive en retard, le bloc attend d'être cadré, jusqu'à 0,6 s (`mise-en-scene.ts:1649-1666`).
- **Rythme.** Un mouvement marqué (plus d'un demi-écran) reçoit un « souffle ». Il ne compte jamais comme changement de rythme (`mise-en-scene.ts:1997-2008`).

**Verdict**
- Trajectoire : IMAGE (ordre de citation et positions sur la toile).
- Style de caméra, courbe, vitesse, zoom : FIGÉ (une seule grammaire).

---

## 4. Ordre de construction (apparition des éléments)

**Ce que fait le code**

- **Règle centrale** : chaque élément (nœud, chiffre, ligne, objet, coche) surgit **sur le mot qui le nomme, 0,15 s avant** (`mise-en-scene.ts:7-9, 281` ; `AVANCE_NOEUD_IV = 0.15`, `types.ts:50`).
- **Éléments que rien ne nomme** :
  - un nœud est placé au milieu du plus grand trou de l'écran (`mise-en-scene.ts:714-720`) ;
  - un texte est placé sur le mot orange (`:584`).
- **Séparation d'un embranchement** : sur le mot « deux / trois / quatre / chemins / voies », sinon sur le mot orange, +0,15 s (`mise-en-scene.ts:676-688`).
- **Coches** : sur un mot de type « fait / fermé / clôturé / résolu / trouvé / réglé », sinon 0,6 s après le nœud (`:722-729`).
- **Textes « A · B »** : révélés morceau par morceau, au moins 0,6 s d'écart (`:590-608`).
- **Comblement du rythme.** Un trou de plus de 2,4 s est comblé :
  - d'abord avec les mots dits pas encore écrits (`combler`, `:1067-1135`) ;
  - sinon par une **relance** : bascule de fond sur un écran v4, ou vue d'ensemble de 1,2 s sur la toile (`relancerRythme`, `:1418-1477`).
- **Animation d'apparition, la même partout** :
  - nœud qui surgit en 0,45 s avec rebond (`src/briques/schema-motion/temps.ts:10-23`) ;
  - coche en 0,35 s ;
  - écriture mot par mot (pas de 0,09 s, durée 0,34 s, montée de 60 px, flou 12 px) (`cas-concret/plans/commun.ts:107`).

**Verdict**
- Ordre : IMAGE (ordre de la voix).
- Mécanique et animations : FIGÉ.

---

## 5. Flèches et fils (connecteurs)

**Ce que fait le code**

- **Une seule flèche**, `FlecheCourbe` (`studio-rendu/compositions/image-video/FlecheCourbe.tsx:12-50`) :
  - courbe de Bézier en S, du bas d'une boîte vers le haut de l'autre ;
  - retour vers le haut par le flanc droit (`plan.ts:315`) ;
  - trait de 9 px, pointe qui se pose à 82 % du tracé ;
  - style plein ou pointillé, repris de la carte.
- **Tracé** : en 0,5 s, juste avant que le nœud d'arrivée surgisse (`plan.ts:262-300` ; `temps.ts:15-17`).
- **Embranchement** :
  - le fil va jusqu'au coude (110 px au plus), puis rejoint le nœud quand il est dit ;
  - une pastille de part (« 80 % ») compte de 0 à la valeur en 1,2 s, 0,3 s après la séparation (`plan.ts:418-450` ; `temps.ts:19-21` ; `mise-en-scene.ts:1676-1688`).
- **Couleurs** : orange vif, encre, vert ou gris clair selon la couleur du lien (`temps.ts:26-28`).
- **Flèches hors de la branche active** : grisées à 35 % (`plan.ts:285-287`).

**Verdict**
- Présence et couleur des flèches : IMAGE.
- Forme, épaisseur, vitesse : FIGÉ (1 seul style de connecteur).

---

## 6. Blocs (cartes, encadrés)

**Ce que fait le code**

- **Nœuds de toile** : la même carte blanche pour tous (voir § 2).
- **En-tête des toiles, objets et moments**, fixe à l'écran (`Entete.tsx:16-50`) :
  - marque en haut ;
  - étiquette en capitales espacées (0,32 em), couleur d'accent ;
  - titre Anton mot par mot, mot `*balisé*` en orange.
  - L'étiquette vaut « Situation type » ou « Exemple » si c'est écrit, sinon le titre du groupe, sinon le titre de l'image (`mise-en-scene.ts:649-653`).
- **Bénéfices** : **une grande carte à la fois** (`mise-en-scene.ts:863-896` ; `plan-objets.ts:820-866`) :
  - pastille d'icône, titre Anton, phrase Inter ;
  - micro-objet sous la carte (200 à 420 px) ;
  - entrée en 0,5 s, sortie de la précédente en 0,35 s.
- **Micro-objets** : banque fermée de **12 dessins** (`src/briques/schema-motion/micro-objets.ts:15-28, 47-60`).
  - Dans la vidéo, le nom est choisi **par mots-clés** (`proposerMicroObjet`, `micro-objets.ts:88-100`), appelé par `microObjetsDe` (`mise-en-scene.ts:1936-1948`). La fiche n'a pas de champ pour un micro-objet.
  - Deux cartes n'ont jamais le même dessin.
  - Sans mot-clé reconnu, la carte n'a pas de micro-objet.
- **Récapitulatif** : les N cartes en rangées, entrée en cascade (0,12 s d'écart). Il est inséré s'il manque, 1,5 s, avec l'en-tête « Vue d'ensemble / Les *N* d'un coup. » (`mise-en-scene.ts:1023-1029, 1531` ; `plan-objets.ts:870-908`).
- **Objets et moments**, choisis par la scène que Claude met dans la fiche, chacun avec une animation fixe :
  - objets : entonnoir, nuée, écran partagé avant/après, additionneur (`mise-en-scene.ts:1759-1842`) ;
  - moments : recherche (frappe à 22 signes par seconde, `types.ts:29`), alerte (secousse), e-mail, dossiers, sources (`mise-en-scene.ts:915-983, 1895-1926`).
  - Les scènes permises dépendent du type d'image (`recettes.ts:26-77`).
- **Vue « Ensemble »** : schéma réduit à des pastilles, libellés courts (3 mots au plus), 1 à 3 chiffres-clés.
  - Durée 1,2 s (1 à 1,5 s) (`regles-scene.ts:20-22`).
  - Posée à chaque ouverture de chapitre, après les branches (si au moins 2), et en relance du rythme (`mise-en-scene.ts:991-1021`).

**Verdict**
- Choix du composant : IMAGE (scène de la fiche ; scènes permises selon le type d'image ; 8 recettes, `recettes.ts:26-69`).
- Micro-objet : déduit des mots du bénéfice (12 options, règle déterministe).
- Dessin des cartes et encadrés : FIGÉ.

---

## 7. Chiffres et bénéfices (compteurs, mises en avant)

**Ce que fait le code**

- **Un chiffre dit apparaît sur son mot** (Q13 ; fenêtre de −0,3 à +0,6 s, `regles-scene.ts:25-27`).
- **Un chiffre porté par un nœud déjà posé** produit un `accent` (« claque sur son mot », `mise-en-scene.ts:730-735`). Mais `accents` (comme `dejaVus`) n'est lu par **aucune** composition : `grep dejaVus|accents` dans `studio-rendu/compositions/image-video` ne trouve rien. Le commentaire `mise-en-scene.ts:146-151` dit « à brancher ».
- **Bandeau de chiffres** (2 à 4 chiffres), toujours sur fond sombre (`mise-en-scene.ts:1351` ; contrôle `controles-scene.ts:264`) :
  - étiquette fixe « Résultat » (`mise-en-scene.ts:1887`) ;
  - chiffres en Anton jusqu'à 0,1 × hauteur, le premier en orange ;
  - « claque » : échelle de 1,6 à 1 avec rebond, éclair de 0,18 s (`plan-objets.ts:728-731`) ;
  - comptage de 0 à la valeur en 0,7 s ; un chiffre composé comme « 24h/24 » ne compte pas (`plan-objets.ts:734-745, 944-972`).
- **Écran v4 « chiffre »** : compteur, sauf pour une heure (`mise-en-scene.ts:1209`).
- **Additionneur** : un minuteur par terme, total compté en 1,4 s avec une rafale de 3 « tics » (`mise-en-scene.ts:1990-1995` ; `plan-objets.ts:455`).
- **Mot fort** : un seul mot orange par plan (contrôle ORANGE, `controles-scene.ts:268`).

**Verdict**
- Quels chiffres et quels bénéfices : IMAGE.
- Façon de les mettre en avant : FIGÉ (1 traitement par sorte : claque, compte, cascade).

---

## 8. Transitions entre écrans

**Ce que fait le code**

- **Entre deux blocs** (scènes rendues séparément) : **coupe franche**, toujours (`transition: "coupe"`, `src/briques/chaine-scenes/plans.ts:12-24`, appelé par `image-video-rendu.ts:227`).
- **Écran v4 qui suit un autre écran** : micro-entrée de 0,2 s (opacité de 35 % à 100 %, échelle de 1,04 à 1) (`commun.ts:81-87`).
- **Dans une toile** :
  - en-tête qui s'efface en 0,15 s (`plan.ts:468-472`) ;
  - vue « Ensemble » en fondu de 0,25 s par-dessus la toile (`plan.ts:454-466` ; `Compositions.tsx:72-89`).
- **Bénéfices** : carte suivante en 0,5 s, précédente qui sort en 0,35 s (`plan-objets.ts:854-861`).
- **Bascule de fond** sombre ↔ ivoire en coupe, quand le rythme le demande (`mise-en-scene.ts:1463-1467`).
- **Non utilisé** : aucun effet de `commune/effets/EffetTransition.tsx` n'est importé par l'IV.

**Verdict** : FIGÉ (1 seule transition entre blocs ; micro-entrées identiques). Les **moments** des coupes dépendent de la voix (IMAGE).

---

## 9. Fonds

**Ce que fait le code**

- **Deux fonds seulement** (`studio-rendu/compositions/cas-concret/socle/Fond.tsx:6-12` ; `src/briques/habillage/charte-duo.ts:13-26`) :
  - « sombre » : dégradé radial nuit `#110A05` avec une lueur orangée en bas ;
  - « ivoire » : `#F4EFE7`, clair au centre.
- **Particules orange** sur l'écran v4 « titre » en fond sombre (6 par écran, positions calculées, pas tirées) (`cas-concret/plans/Titre.ts:15-27, 55`).
- **Choix du fond** : écran par écran, dans la fiche, par Claude (champ `fond`, `ecriture.ts:76`). La seule consigne est la forme JSON. Le défaut par partie (`recettes.ts:80-87`) ne sert qu'à la simulation (`ecriture.simulation.ts:57`).
- **Fonds forcés** :
  - bandeau et phrase-choc toujours sombres (`mise-en-scene.ts:1351`) ;
  - segment de fin toujours sombre (`:1315, 1332`) ;
  - vues « Ensemble » et récapitulatif insérés toujours ivoire (`:1362, 1380, 1531`).
- **Bascules automatiques** pour le rythme (`:1463`).
- **Contrôle** : au moins deux fonds dans la vidéo (`controles-scene.ts:261-265`).

**Verdict**
- Palette : FIGÉ (2 fonds).
- Alternance : IMAGE (choix de Claude, plus règles de rythme).

---

## 10. Bruitages et musique

**Ce que fait le code**

- **Jamais de musique** (`assemblage.ts:17, 348, 359, 371` ; `bruitages.ts:4`). Aucun réglage n'existe pour en mettre (`src/formats/image-video/index.ts:32-37` : `bruitages` vaut seulement `"discrets"`).
- **Un son par changement visible.** 12 « sortes » rattachées aux **5 déclencheurs** existants (`bruitages.ts:21-41`) :
  - nœud → pop → impact ;
  - chiffre → tic → chiffre ;
  - objet → papier → document ;
  - fond ou scène → souffle → illustration-forte ;
  - autres rattachements dans `bruitages.ts:64-77`.
- **Banque** : 5 déclencheurs × 4 variantes, soit 20 sons (`src/donnees/bruitages.ts:38-43`). Tous sont « à vérifier » (`:75`).
- **Choix de la variante** : **rotation déterministe**, la n-ième occurrence d'un déclencheur prend la variante `n mod nombre`, en commençant toujours par la 1ʳᵉ (`bruitages.ts:172-179`). Toutes les vidéos ont donc la même suite de variantes pour la même suite d'événements.
- **Règles fixes** :
  - priorité quand deux sons se touchent (`:102-104`) ;
  - au moins 0,1 s entre deux sons ;
  - souffle avancé de 0,03 s ;
  - son de clôture (impact) 1,5 s avant la fin (`:161`) ;
  - rien dans la dernière seconde ;
  - gain −21 dB, milieu de la fourchette de 18 à 24 dB sous la voix (`:92` ; `src/briques/intensite/types.ts:123-137`) ;
  - mixage à −14 LUFS (`assemblage.ts:44`).

**Verdict**
- Placement : IMAGE (suit les événements).
- Palette sonore : FIGÉ (5 familles).
- Variantes : VARIÉ par **rotation**, 4 options par déclencheur, sans graine, même départ à chaque vidéo.

---

## 11. Sous-titres (styles, variété #250)

**Ce que fait le code**

- **Base** (`sous-titres.ts:77-91`) :
  - mot à mot, groupes de 2 à 4 mots ;
  - mot fort de l'écran en orange ;
  - encre `#15100C` sur ivoire, ivoire sur sombre, sans ombre ;
  - hauteur 0,036.
  - Bande **unique** de 60 à 67 % de la hauteur pour tous les réseaux (`types.ts:38`).
- **Variété #250** : `sousTitresVariesIV` (`sous-titres-varies.ts:95-135`) appelle le mélange commun `melanger` (`src/briques/sous-titres/melange.ts:68`), à l'intensité **fixée à « équilibré »** (`sous-titres-varies.ts:25`). Ce n'est pas un réglage.
- **Styles possibles** : base Minimal (Inter Bold, contour de 7 px, `src/moteurs/montage-cas-concret/fabriquer.ts:239-246`), plus 2 accents et le soulignement :
  - **Impact** : au plus 1 toutes les 6 s, jamais deux de suite ; d'abord le groupe le plus fort qui commence avant 2 s, puis les chiffres et les mots forts ; incliné à **+4° puis −4° en alternance** (`melange.ts:27, 79-105`) ;
  - **Bandeau** : 1 à 3 par vidéo, un toutes les 15 s, au moins 5 s d'écart (`melange.ts:109-131`) ;
  - **Soulignement** : au plus un groupe sur 5.
- **Adaptations propres à l'IV** :
  - accents ramenés au centre de la bande (`sous-titres-varies.ts:122`) ;
  - aucun accent pendant la question de commentaire (`:117`) ;
  - pas de bandeau sur un écran ivoire (`:126`) ;
  - un accent qui sort de la bande est redressé, puis réduit, puis remis en base.
- **Déterminisme** : choix par **règles** sur l'importance des mots (chiffres = 3, mots forts = 2…) et sur les coupes de plan. Aucun hasard : deux scripts différents donnent des placements différents, mais selon le même schéma (Impact quasi systématique dans les 2 premières secondes).

**Verdict**
- Placement des accents : IMAGE (règles sur le texte).
- Jeu de styles : FIGÉ (base + 2 accents + soulignement, intensité unique).
- Position et couleurs : FIGÉ.

---

## 12. Fin (écran final, logo, appel à l'action)

**Ce que fait le code**

- **Phrase-choc**, toujours en dernier dans le corps, mot pour mot (`ecriture.ts:63` ; Q07). Son animation est fixe (`plan-objets.ts:1252-1275` ; `PhraseChoc.tsx`) :
  - mots qui entrent un par un sur leur heure ;
  - lueur sur le dernier mot ;
  - éclair orange de 0,14 s ;
  - puis la marque « axion-ia.com » dessous, 0,6 s après le dernier mot.
- **Segment de fin, hors LinkedIn** (`mise-en-scene.ts:1296-1338`), un écran v4 sombre par phrase :
  - question de commentaire propre à l'image, à l'écran « Votre réponse en commentaire » ;
  - puis 2 phrases de la banque (`fins.ts:40-46`) : « Faites votre diagnostic gratuit en quelques minutes. » et une phrase de lien selon le réseau (voir § 15).
- **Pas d'écran logo dédié** :
  - la marque est sur chaque plan (Q25, `controles-scene.ts:259`) ;
  - le dernier plan est prolongé jusqu'à la fin (`mise-en-scene.ts:1399-1401`) ;
  - la vidéo dure la voix + 1,6 s (`regles-scene.ts:29`) ;
  - la fin propre de la recette de composition est retirée (`image-video-rendu.ts:61-65`).
- **Fins au mot** (cadeau) : codées (`fins.ts:49-52`), mais inactives tant que `cadeauReel` est faux (`:179`).
- **Réglage « fin seule »** : il supprime la question (`fins.ts:224` ; `formats/image-video/index.ts:34`).

**Verdict**
- Texte de la question : IMAGE (Claude) ; repli sur la banque si elle manque.
- CTA et phrases de lien : FIGÉ par réseau (1 seule suite par réseau, pas de rotation).
- Animation de fin et marque : FIGÉ.

---

## 13. Voix

**Ce que fait le code**

- **Voix unique** : clone HeyGen de Will (`voix.ts:4-5, 39`), « Aucun appelant ne peut choisir une autre voix ».
  - Réglages : moteur starfish, vitesse 1,1, stabilité 45, émotion 30 (`voix.ts:42`).
- **Traitement** : tempo ×1,08 (`assemblage.ts:42`), resserrage des blancs par la recette v4, −14 LUFS, crête −1 dBTP (`:44-45`).

**Verdict** : FIGÉ (le texte seul change).

---

## 14. Durée et rythme

**Durée** (IMAGE, selon la classe de complexité de la carte)

- Débit visé : 3,4 mots par seconde (`src/domaine/image-video/complexite.ts:14`), mesuré le 18/10/2026 sur deux vraies voix ; les mots de chaque classe en sont déduits (durée × débit).
- Corps selon la classe (`:17-22`) :
  - simple : 30 à 40 s ;
  - moyenne : 40 à 50 s ;
  - branches : 48 à 56 s ;
  - très complexe : 60 à 78 s, en chapitres « k/N ».
- Cible dans la fourchette selon le nombre d'unités et de chiffres (`:226`) ; tolérance ±10 % (`regles.ts:74`).

**Rythme** (FIGÉ, mêmes seuils pour toutes les vidéos ; `regles-scene.ts:7-36`)

- Un changement visible toutes les 2,4 s au plus, 1,5 à 2,2 s en moyenne.
- Plans de 5 s au plus, jamais deux de suite de plus de 4 s.
- Phrases de 12 mots au plus (`regles.ts:68`).
- 25 images par seconde.

**Repère « k/N »** (chapitres, bénéfices, « Étape k/N » pour une chaîne, `mise-en-scene.ts:2018-2036`)

- Il n'est passé qu'aux blocs « moments » (`image-video-rendu.ts:109-114`) : la toile (`Compositions.tsx:63-93`) et les objets ne le dessinent pas.
- D'après le code, le repère « Étape k/N » d'une chaîne, posé sur des nœuds de toile, ne s'affiche donc pas.

**Verdict**
- Durée : IMAGE.
- Rythme : FIGÉ (seuils), avec des moments qui suivent la voix.

---

## 15. Différences par réseau

**Ce que fait le code**

- **Image** : même format vertical 1080 × 1920 pour les 5 réseaux, LinkedIn compris (décision B4).
- **Sous-titres** : même bande pour tous (`sous-titres.ts:69-72`).
- **Corps** : même corps, mêmes scènes (rendues une fois, clés par empreinte : `image-video-rendu.ts:119-125`).
- **Ce qui change :**
  - **Fin** (`fins.ts:40-60, 187-238`) :
    - Facebook : question, diagnostic gratuit, « Le lien est en commentaire. » ;
    - Instagram : question, diagnostic gratuit, « Le lien est dans mon profil. » ;
    - TikTok et YouTube Shorts : question, diagnostic gratuit, « Le lien est dans mon profil. » ; la ligne de banque diffère entre les deux (`fin-tt-lien-profil` et `fin-ty-lien-profil`), donc le texte à l'écran aussi ;
    - LinkedIn : **muet**, rien après la phrase-choc (`fins.ts:203-213`).
  - **Plafond de durée** : 60 s pour TikTok, Shorts et LinkedIn ; 90 s pour Instagram et Facebook (limite stricte de 90 s pour Facebook) (`src/domaine/image-video/plafonds.ts:22-28`).
    - Jusqu'à +15 % : livrée avec une mention (`plafonds.ts:31`).
    - Au-delà : version courte, sans les chapitres non essentiels (`recettes.ts:170-180`).
    - Sinon : réseau non livré (`reseaux.ts:103-121`).
  - **Liens suivis** (utm) et code de version « 0042-IV-YS » (`fins.ts:130-149`).

**Verdict** : FIGÉ par réseau. Seuls la fin, le plafond et les liens diffèrent.

---

## Constantes clés figées (récapitulatif)

**Charte**
- Couleurs (`src/briques/habillage/charte-duo.ts:13-26`) : nuit `#110A05`, ivoire `#F4EFE7`, encre `#15100C`, orange `#C2532A`, orange vif `#F0703C`, vert `#22A55B`, blanc.
- Polices (`:51-54`) : Anton pour l'affiche, Inter Bold pour le texte.
- Taille plancher 0,03 × hauteur (`:57`).
- Taille de libellé 0,04 (`schema-motion/lisibilite.ts:16`) ; titre d'en-tête 0,068 (`plan-objets.ts:694`).
- Marque « axion-ia.com », « ia » en orange (`Entete.tsx:52-62`).

**Courbes**
- `doux` (cubique), `va`, `rebond` avec dépassement de 1,7 (`schema-motion/courbes.ts:13-24`).
- Caméra en smoothstep (`camera.ts:37`).

**Temps**
- Avance de 0,15 s sur le mot (`types.ts:50`).
- Apparition 0,45 s ; flèche 0,5 s ; coche 0,35 s ; fondu 0,25 s (`temps.ts:10-23`).
- Mot par mot : pas de 0,09 s, durée 0,34 s (`commun.ts:107`).
- Entrée d'écran v4 : 0,2 s (`commun.ts:81`).
- Vue « Ensemble » 1,2 s ; récapitulatif 1,5 s ; queue 1,6 s (`regles-scene.ts`).

**Caméra**
- Zoom 0,8 à 1,6, zoom préféré 1, vitesse 1,2 écran par seconde, avance 0,25 s (`camera.ts:19-29` ; `mise-en-scene.ts:1677`).

**Son et voix**
- −14 LUFS, bruitages à −21 dB, aucune musique.
- Voix unique, tempo ×1,08, vitesse 1,1.

**Images par seconde** : 25.

---

## Constats de code utiles (non inventés, à confirmer par un rendu)

1. **Les lignes des écrans v4 ne sont pas calées sur la voix.** Elles sont nommées `ligne-k` (`mise-en-scene.ts:1572`) alors que les composants lisent `titre-N` (`ecrans-motion/proprietes.ts:78`). Elles retombent sur les heures par défaut des gabarits.
2. **`accents` et `dejaVus`, produits par la mise en scène, ne sont lus par aucune composition.** Les chiffres qui devaient « claquer » sur un nœud déjà posé et les nœuds déjà vus en début de séquence ne sont donc pas dessinés (`mise-en-scene.ts:146-151`).
3. **L'accroche B n'est jamais utilisée** (`fabrication.ts:725`).
4. **Le repère « k/N » n'est dessiné que dans les blocs « moments »** (`image-video-rendu.ts:109-114`).
5. **Le micro-objet est choisi par mots-clés et non par Claude**, faute de champ dans la fiche (`mise-en-scene.ts:1936-1948`).

---

## Ce qui fait que deux vidéos IV se ressemblent le plus (top 8, classé)

1. **Une ossature et un déroulé uniques.** Toujours accroche → douleur → début de réponse → explication → résultat (bandeau « Résultat », fond sombre) → phrase-choc (même animation : mot par mot, lueur, éclair, marque) → question → « diagnostic gratuit » → lien. Seul le parcours de l'explication change avec le type d'image (`recettes.ts:4-6, 26-69` ; `regles.ts:388-395`).
2. **Une charte totalement fixe.** 2 fonds (nuit dégradé / ivoire), Anton + Inter Bold, un seul orange, mêmes cartes blanches arrondies, même en-tête (étiquette espacée + titre Anton), marque en haut de chaque plan. Aucune déclinaison de style n'existe dans l'IV (le « jeu tiré » des écrans v4 n'est pas utilisé).
3. **Une seule grammaire de caméra.** Elle suit le nœud nommé, avec une courbe douce, un zoom quasi constant à 1, et ni effet, ni rotation, ni dézoom. Elle arrive 0,25 s avant le mot. La disposition suit toujours la même logique : colonnes verticales, branche majoritaire à gauche en orange.
4. **Une même mécanique d'apparition.** Tout surgit 0,15 s avant son mot avec le même rebond (0,45 s) ; flèches tracées en 0,5 s ; textes mot par mot au même pas. Les écrans v4 ont même des heures de lignes fixes (constat 1).
5. **Les mêmes transitions.** Coupe franche entre toutes les scènes, avec la même micro-entrée de 0,2 s pour les écrans v4. La vue « Ensemble » en pastilles revient aux mêmes endroits (chapitre, après les branches) et en relance du rythme.
6. **Les mêmes seuils de rythme.** Un changement toutes les 2,4 s au plus (1,5 à 2,2 s en moyenne), plans de 5 s au plus, relances par bascule de fond ou vue d'ensemble : la pulsation est identique d'une vidéo à l'autre.
7. **Le même habillage sonore et vocal.** Une seule voix (clone de Will, mêmes réglages, ×1,08), jamais de musique. Les mêmes 5 familles de bruitages, attachées aux mêmes événements, avec une rotation de variantes qui repart toujours de la variante 1. Même son de clôture à −1,5 s.
8. **Les mêmes sous-titres et les mêmes fins par réseau.** Même bande (60-67 %), même base Minimal ; intensité « équilibré » imposée, donc un Impact à ±4° presque toujours dans les 2 premières secondes et 1 à 3 bandeaux. Fins de banque identiques par réseau (texte à l'écran de la question toujours « Votre réponse en commentaire »).
