# Journal du lot F2 — Modèles d'animation 7 à 13 (09/10/2026)

Branche `feat/facecam-f2`, partie de `origin/feat/facecam-c2`. `origin/feat/facecam` et `origin/feat/facecam-c2` y ont été refusionnées en cours de route.
Références : `PLAN-FACECAM-v4.md` (correctif du 09/10 « motion centralisé », décision « Spectaculaire ») et `PLAN-IMPLEMENTATION-FACECAM.md`.
**Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché. Aucun appel réel n'a été fait (ni HeyGen, ni Higgsfield, ni Claude).**

## Ce qui est fait
Sept nouveaux modèles dans la brique commune `motion`, utilisables par tous les formats. Chacun existe en style **Sobre** et en style **Spectaculaire**, avec les mêmes jetons, les mêmes courbes et le même noyau que les six premiers modèles :

| N° | Modèle | Composition | Ce qu'on voit | Choix automatique |
|---|---|---|---|---|
| 7 | Graphique | `MotionGraphique` | **Barres** : les barres jaillissent au ressort et comptent. **Courbe** : le trait se dessine de point en point avec la parole. **Camembert** : l'anneau se construit part par part, et le centre suit la part dite. La valeur forte passe en orange. En Spectaculaire : dalles en relief, néon, disque épais en 3D, éclats. | 2 valeurs ou plus dans la phrase. Variante : parts qui font 100 %, ou « répartition » → camembert ; années, mois ou « évolution » → courbe ; sinon barres. |
| 8 | Icône + mot | `MotionIconeMot` | L'icône se trace dans un anneau, puis le mot géant arrive en orange, suivi de son sens. | « un seul mot : … », « le maître-mot, c'est … », « en un mot ». |
| 9 | Problème → solution | `MotionProblemeSolution` | Le problème se barre, puis la carte **bascule en 3D** et la solution apparaît en orange. En Spectaculaire, la carte se fêle, se brise en éclats et la solution jaillit. | « le problème, c'est … la solution, c'est … », « au lieu de …, laissez / il suffit de … » (sans chiffres). |
| 10 | Check-list | `MotionCheckList` | Les cases arrivent vides, puis **chacune se coche quand elle est dite**. Un compteur et une barre de progression suivent. | « vérifiez », « check-list », « cochez », « avez-vous … ? » ; passe avant la liste. |
| 11 | Capture annotée | `MotionCaptureAnnotee` | La capture vient de Mes images ou du B-roll. La caméra zoome vers l'annotation dite, un projecteur éclaire la zone, puis un cercle à main levée, une flèche, un surlignage ou un cadre se dessine. Les étiquettes restent toujours lisibles. | Seulement s'il y a une image pour le passage **et** qu'on la montre (« regardez ici », « ce bouton », « cliquez »). |
| 12 | Titre plein écran | `MotionTitrePleinEcran` | Gros titre éditorial : les lignes sortent de derrière un masque, le mot clé est en orange et le numéro de chapitre apparaît en filigrane. | **JAMAIS.** Uniquement à la demande (`lireDemandeModele`). |
| 13 | Documentaire | `MotionDocumentaire` | Coins de viseur, repère de lieu, lieu tapé lettre à lettre, date, puis chiffre clé qui compte. | Un lieu (« à Lyon », « en Bretagne ») avec une date ou un chiffre. **Jamais de nom de personne ni de bandeau « nom · Axion-IA »** : les schémas Zod le refusent. |

Règles communes aux sept modèles :
- tout se fait sans réglage ;
- Will peut tout changer en le disant au monteur (`lireDemandeModele` : « en camembert », « fais une check-list », « titre plein écran »…) ;
- le style suit `choisirStyleMotion`, qui est inchangé ;
- aucun prix n'est affiché ;
- 25 i/s, Poppins, charte Axion ;
- le texte fait au moins 3 % de la hauteur.

## Planche de validation
`docs/facecam/planche-motion-7-13/index.html` contient 9 entrées, dont les 3 variantes du graphique. Chaque entrée montre le Sobre et le Spectaculaire côte à côte, en 5 s, 1080×1920, MP4 de moins de 3 Mo. La phrase d'aide « Que puis-je demander ? » figure sous chaque modèle.
Elle se régénère avec `cd studio-rendu && npx tsx scripts/planche-motion-7-13.ts`. L'option `--images` produit les images de contrôle.

**Contrôle fait** sur les images extraites des MP4 et sur des images fixes de 0,6 s à 4,7 s :
- textes lisibles ;
- rien n'est coupé ;
- les plus petits textes font 61 px, soit 3,2 % de 1920.

Défauts trouvés en cours de route et corrigés :
- étiquettes de la courbe qui se chevauchaient : elles passent en quinconce ;
- astérisque visible dans « l'*IA* » ;
- étiquettes de la capture affichées trop peu de temps ;
- flou de zoom trop fort en Spectaculaire ;
- lieu coupé au milieu d'un mot (« RHÔ / NE ») ;
- sous-titre qui tombait à travers le mot.

**Moitié haute de l'écran partagé** : contrôlée en images fixes (1080×960) dans les deux styles. Les défauts trouvés ont été corrigés :
- titres resserrés ;
- icône + mot côte à côte ;
- check-list et documentaire compacts ;
- légende du camembert jamais tronquée.
Les données d'exemple portent sur Axion-IA : temps perdu par un dirigeant, devis, IA. La capture d'exemple est un tableau de bord d'automatisations fictif, sans marque (`studio-rendu/compositions/commune/motion/exemples/`).

## Fichiers
**Nouveaux** (brique) : dans `src/briques/motion/` :
- `types-etendus.ts`, `schemas-etendus.ts`, `catalogue-etendu.ts` (champ `aide`), `exemples-axion-etendus.ts` ;
- `choix-etendu.ts` (`choisirModeleTous`, `choisirModeleEtendu`, `lireDemandeModele`, `varianteGraphique`) ;
- `textes-etendus.ts`, `calage-etendu.ts`, `demande-etendue.ts` (`parametresCarteTous`), `documentaire.ts` (garde-fou des noms) ;
- `disposition-etendue.ts` (`tientEnMoitieHaute`) ;
- `catalogue-actif-etendu.ts` (`CATALOGUE_ACTIF_ETENDU` et `catalogueActifEtendu({ capture })`, au contrat `CatalogueMotionActif` de l'API unique `cartesPourFormat` de la mission H).

**Nouveaux** (monteur) : `src/moteurs/montage-facecam/monteur/catalogue-motion-etendu.ts`, avec :
- `MODELES_CARTE_ETENDUS` et `schemaAjouterCarteEtendue` ;
- la règle lue par Claude et les exemples de « Que puis-je demander ? ».

**Nouveaux** (rendu) : dans `studio-rendu/compositions/commune/motion/` :
- `Motion{Graphique,IconeMot,ProblemeSolution,CheckList,CaptureAnnotee,TitrePleinEcran,Documentaire}.tsx` ;
- `spectaculaire/*Spectaculaire.tsx` (7 fichiers) ;
- `outils-etendus.tsx`, `InscriptionsEtendues.tsx`, `fichiers-images.d.ts`, `exemples/capture-tableau-de-bord.png`.

**Autres nouveaux fichiers** : `studio-rendu/scripts/planche-motion-7-13.ts` et `tests/facecam-motion-7-13.test.ts`.

## Fichiers communs touchés (ajouts minimaux et facultatifs)
- `src/briques/motion/index.ts` : exports ajoutés à la fin. Au moment de la fusion avec `feat/facecam`, le conflit avec l'export `pose` a été résolu en gardant les deux.
- `src/moteurs/montage-facecam/monteur/catalogue.ts` : option **facultative** `{ modelesEtendus?: boolean }` sur `catalogueTexte()` et sur `exemplesDemandes(max, options)`. Sans l'option, le texte et les exemples sont **strictement identiques** (c'est testé).
  - Lors de la fusion avec `feat/facecam`, le conflit avec les effets spéciaux du lot F3 a été résolu en gardant les deux : les effets restent toujours ajoutés en fin de liste.
- `studio-rendu/compositions/commune/motion/Inscriptions.tsx` : une ligne, `<CompositionsMotionEtendues />`, qui ne fait qu'inscrire de nouvelles compositions.
- `studio-rendu/compositions/commune/motion/index.ts` : un export.

Rien d'autre n'a changé :
- `IdModeleMotion`, `CATALOGUE_MOTION`, `choisirModele`, `carteDepuisTextes`, `calerCarte`, `MODELES_CARTE` et `schemaAjouterCarte` restent tels quels ;
- l'avocat n'est pas touché.

## Tests
- `tests/facecam-motion-7-13.test.ts` : 33 tests.
  - Catalogue : les 13 modèles ; le titre jamais automatique.
  - Schémas : bornes, et garde-fou des noms et bandeaux.
  - Choix automatique : les 7 modèles, priorité aux règles validées, aucun titre plein écran automatique.
  - Demandes explicites ; textes → données ; calage ; demande de rendu.
  - Catalogue du monteur : inchangé sans l'option, complet avec elle, sans prix.
  - Place en moitié haute.
  - `cartesPourFormat` : sans le catalogue étendu, rien ne change ; avec lui, les modèles 7 à 13 sont pris en compte.
- Non-régression :
  - les 18 fichiers `facecam-*`, `h-*` et `z-integration-facecam` : 218 tests verts ;
  - les 72 fichiers qui touchent l'avocat ou la brique motion : 778 tests verts, 2 ignorés d'avance.
- Vérifications de types :
  - `tsc` racine : propre, hors les 4 erreurs connues `RouteContext` / `LayoutProps`, qui demandent `next typegen` ;
  - `tsc` de `studio-rendu` : propre.

## Ce qui reste (pour l'intégration)
0. **Le plus simple, après validation de la planche par Will** : faire pointer `CATALOGUE_ACTIF` (`pourFormat.ts`) sur `catalogueActifEtendu({ capture })`, ou passer `catalogue` à `cartesPourFormat`. Tous les formats qui passent par l'API unique (face caméra, avocat avec `avocat.motionCommune`, formats futurs) ont alors les 13 modèles, sans autre changement.
1. **Brancher le monteur** :
   - remplacer `schemaAjouterCarte` par `schemaAjouterCarteEtendue` dans `schemaReponseMonteur` / `lireReponseMonteur` ;
   - appeler `catalogueTexte({ modelesEtendus: true })` dans `role.ts` ;
   - appeler `exemplesDemandes(8, { modelesEtendus: true })` dans `services/monteur-facecam.ts`.
2. **Rendre les passages** : pour un `modele` des sept nouveaux, passer par `carteDepuisTextesEtendus(modele, textes, { capture })`, puis `calerCarteTous` et `parametresCarteTous`. La même opération `composition` sert, sans mode.
3. **Choix automatique** : remplacer `choisirModele` par `choisirModeleTous(phrase, { capture })` là où le moteur choisit seul (écran partagé du lot C, version simple). Passer l'image du passage (Mes images, B-roll) dans `capture`, avec **largeur et hauteur** ; sans elles, le cadre suppose du 16:10.
4. **Capture annotée** : en mode simple, la position des annotations vient des mots (« en haut », « à droite »). Claude, qui voit l'image, doit donner les positions en fractions de l'image.
5. Écran « Mes animations » / aperçu : rien à changer, les fiches des sept modèles sont dans `CATALOGUE_MOTION_TOUS`.

## Points d'attention
- **Validation par Will** : les sept modèles ne doivent pas être activés dans le monteur avant que Will ait validé la planche (règle du correctif du 09/10).
- `IdModeleMotion` n'a **pas** été élargi, pour ne casser aucun `Record<IdModeleMotion, …>` des autres lots. L'union des 13 modèles s'appelle `IdModeleMotionTous`.
- Les compositions Spectaculaire du problème → solution et de la capture font plus de 3D : le rendu prend environ 25 à 33 s pour 10 images fixes en local.
- En moitié haute (écran partagé), les mises en page s'adaptent :
  - camembert avec la légende à droite ;
  - barres avec l'étiquette à gauche ;
  - icône + mot côte à côte ;
  - faces du problème → solution réduites pas à pas ;
  - check-list et documentaire compacts, le contexte du documentaire étant omis.

  La planche ne montre que le plein écran.
- **Une check-list de 4 longs points ne tient pas** dans une demi-image sans passer sous 3 % de la hauteur. `tientEnMoitieHaute` le détecte. Le catalogue étendu ne rend alors pas la carte en moitié haute : le moteur doit la poser en plein écran.
- La planche affiche `16:10` par défaut pour une capture sans dimensions : il faut transmettre `largeur` et `hauteur` de l'image.
- Rendu : environ 3 à 4 min par vidéo de 5 s en local. Un incident « Target closed » du navigateur a eu lieu une fois pendant la planche, et Remotion a repris tout seul.
