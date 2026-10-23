# Plan d'implémentation de bout en bout — format « Face caméra » — v3 (08/10/2026, soir)

> ⚠️ 09/10 : la v4 PLAN-FACECAM-v4.md PRIME sur ce document (corrections de l'équipe de vérification).

> **Historique** : la v1 a été approuvée par Will ; la v2 a corrigé les 26 points de la 1ʳᵉ critique de complétude ; la **v3** corrige les 25 points de la 2ᵉ critique et intègre toutes les décisions de Will du 08/10.
> Vérifié sur `origin/master` 46a6997 du studio. La copie locale était en retard : **toujours `git fetch` et travailler sur origin/master**.
> **Ce document PRIME** sur `PLAN-MOTEUR-FACECAM.md` et sur `fiche de style (non publiée)` en cas de contradiction, notamment sur le fond flou ou décroché, qui est refusé.
> **Ordre de démarrage** : L0 (maquettes) et L0b (mesures) d'abord. Aucun code de production avant les réponses de Will aux décisions ouvertes (fin du fichier).

## Context
Will veut que son studio (`studio.axion-ia.com`, dépôt `studio-axion-ia`) monte **automatiquement, au niveau d'un monteur pro**, les vidéos qu'il filme lui-même.
- **Tournage** : iPhone 16 Pro Max à l'horizontale, 4K 25 i/s, HEVC, HDR coupé, **une seule caméra**, lumière ratée, téléprompteur à vitre.
- C'est le format le plus fabriqué. **Aucun outil vidéo IA payant.**

## Décisions de Will déjà prises (08/10)
| Sujet | Décision |
|---|---|
| Coût | tout gratuit : pas d'IA vidéo payante |
| Caméra | une seule, iPhone 16 Pro Max ; pas de ProRes ; HEVC 4K 25 i/s |
| Lumière | Will « n'y arrive pas » au tournage → c'est le studio qui la fait |
| Fond | **PAS de sujet décroché du fond** : pas de flou de fond, pas de profondeur, pas de liseré (essai jugé « bizarre, pas pro ») |
| Grain | anti-grain obligatoire : l'image ne doit jamais être plus granuleuse que l'original |
| Visage | « bonne mine » (teint, cernes, peau), dents blanchies (redresser : non) |
| Coupes | début et fin à jeter, phrases reprises, silences ; rien n'est effacé, tout se rétablit |
| Sous-titres | dynamiques comme l'avocat |
| Écran partagé | **texte en haut, Will en bas**, 2 à 3 fois par vidéo |
| Motion design | grande qualité, bibliothèque de modèles, chacun validé en vidéo |
| B-roll | oui, gratuit |
| Marque | **jamais** de bandeau « nom · Axion-IA » |

## Architecture
1. **Point de départ = chemin « je lis » existant** : générateur → page iPad (téléprompteur) → séance → prises → `monterJeLis` (`src/services/fabrication-reseaux.ts`) → `decisionJeLis`.
   - Pour que ce chemin trouve le nouveau moteur, il faut ajouter `"face-camera": "montage-facecam"` dans `MOTEUR_PRISES_FILMEES` (`src/moteurs/index.ts:77`) et l'interrupteur `moteur.face-camera.jeLis` (l. 84).
   - Il faut aussi la recette du générateur du format (`parametresGenerateur`, `parametres-generateur.ts`).
   - Le texte validé est donc connu dans le cas normal.
   - Un chemin « **vidéo libre** » (sans texte) existe en mode dégradé (L3).
2. **Moteur `montage-facecam`**, à inscrire à 3 endroits :
   - `IDS_MOTEURS` (`src/moteurs/ids.ts`) ;
   - `MOTEURS` (`src/moteurs/index.ts`) ;
   - le test de contrat `testerMoteurVideo`.

   Il implémente `MoteurVideo` et réutilise :
   - `estPrisesFilmees` et le plan des prises ;
   - `nettoyage.ts`, `decoupage.ts`, `report.ts`, `alignement.ts` ;
   - `fabrication-illustrations.ts`, `src/briques/composition/*` ;
   - les opérations `studio-rendu` existantes `etalonnage`, `mixage`, `extrait`, `assemblage` et `composition`.
3. **Composition, mode « source pré-cadrée »** (`scene.ts`, `parametres.ts`) : la piste fournie a déjà la taille du ratio (1080×1920, 1080×1350, 1080×1080), sans bandes ni second recadrage. Tests en 4:5 et 1:1.
4. **Écran partagé par passages** (travail neuf : aujourd'hui, `ecran-partage-haut-bas` ne s'applique qu'à une vidéo entière, format `ecran-partage`). On ajoute un **calque de passage** dans la composition, pour une durée de 3 à 8 s :
   - moitié haute = rendu d'un modèle de motion design ;
   - moitié basse = piste de Will recadrée pour une demi-hauteur ;
   - sous-titres à la jonction, ou coupés si la carte dit la même chose ;
   - en 4:5 et 1:1 : **aussi texte en haut, Will en bas** (proportions 45/55).
5. **Calculs image une seule fois, retouches bon marché.** Le suivi du visage (FaceLandmarker, 478 points) et le masque de la peau sont calculés une fois sur la partie utile, puis stockés. L'image devient une passe FFmpeg qui utilise ces masques :
   - bouger un curseur = repasse rapide ;
   - rétablir une coupe = assemblage seul ;
   - corriger un sous-titre ou un texte de motion design = **recalque gratuit**, à brancher (`src/services/recalque.ts` exige `recalquer`).
6. **Conteneur `studio-vision`** (Python : faster-whisper, MediaPipe FaceLandmarker et segmentation, OpenCV headless, DeepFilterNet si compatible ; travaux sur disque, repris après un redémarrage). Il faut aussi :
   - client TypeScript et **double de simulation** (modèle : `src/fournisseurs/aligneur`) ;
   - clé partagée et variables d'environnement ;
   - entrée dans `deploiement/docker-compose.yml`, `commun.sh` (`IMAGES`), `mettre-a-jour.sh`, `revenir.sh` et les contrôles de santé ;
   - modèles téléchargés **pendant la construction de l'image**.
7. **File de calcul.** La file longue de `studio-rendu` ne fait qu'un travail à la fois, avec un délai unique de 20 min (`files.ts`). On ajoute une **file `video` dédiée** ou un **traitement par tranches de 30 s**, choisi d'après les mesures de L0b : l'avocat ne doit jamais être bloqué. Nouvelles opérations à ajouter aux **3 endroits** (union `studio-rendu/src/contrat.ts`, tableau `OPERATIONS`, union `src/fournisseurs/types.ts` ~l. 535) :
   - `preparer-rush` ;
   - `image-masques` ;
   - `assemblage-facecam` ;
   - `motion-design` (rendu Remotion d'un modèle).
8. **Données.** Le studio n'a pas de Prisma : il stocke ses données dans des collections (`Depots`).
   - Nouveau champ `Video.entrees.facecam` : `{ rushId, prises[] (option « 2 prises »), transcriptionId, coupes: { auto[], retablies[] }, image: { lumiere, couleurs, mine, dents }, cadrage: { [ratio]: … }, passages: { brolls[], ecransPartages[], motions[] } }`.
   - **Nouveaux types de Bibliothèque** `motion` (modèles de motion design) et `plan` (effets du catalogue) dans `TypeElement` (`src/domaine/types.ts:215`), avec migration idempotente et écrans de la Bibliothèque.

## Déjà construit et centralisé dans le studio : réutilisé TEL QUEL (inventaire `origin/master`, 08/10 soir)
| Existant | Où | Utilisation dans le face caméra |
|---|---|---|
| Générateur de sujets et scripts, séries, idées, matières, source axion-ia.com | `services/generateur*.ts`, `serie-ecriture.ts`, `series.ts`, `idees.ts`, `matieres.ts`, `source-axion.ts` | écrire le texte lu au téléprompteur |
| Téléprompteur iPad, séances, prises | `services/tournage.ts`, page `lire/[varianteId]` | tournage |
| Envoi multipart R2, fichiers | `services/envois.ts`, `fichiers.ts`, `lib/envoi-multipart.ts` | réception du rush |
| Aligneur au mot | `studio-aligneur`, `moteurs/montage-avocat/alignement.ts` | calage sur le texte |
| Nettoyage des blancs, découpage, report des horodatages | `moteurs/montage-avocat/nettoyage.ts`, `decoupage.ts`, `report.ts` | coupes, rythme, sous-titres |
| Sous-titres (moteur, styles, main de Will, fichiers SRT pour YouTube) | `briques/sous-titres`, `services/sous-titres.ts`, `telechargements-sous-titres.ts`, `compositions/sous-titres` | sous-titres dynamiques |
| Intensité, orchestrateur, bruitages | `briques/intensite`, `services/intensite.ts`, `bruitages.ts` | dosage des effets |
| Illustrations (Mes images → banques), captures du site | `services/illustrations.ts`, `mes-images.ts`, opération `capture-site` | B-roll |
| Étalonnage (LUT), mixage, son (−14 LUFS), extrait, assemblage, composition | opérations `etalonnage`, `mixage`, `nettoyage-audio`, `mesure-son`, `extrait`, `assemblage`, `composition` ; `services/etalonnage.ts` | look, son, assemblage, export |
| Miniatures de couverture | opération `miniature`, `services/miniatures.ts` | vignette par réseau |
| Textes de publication, hashtags, Buffer | `services/publications.ts`, `hashtags.ts`, `buffer.ts` | publication |
| Recalque (texte refait gratuitement), modifications | `services/recalque.ts`, `modifications.ts` | retouches |
| Coûts, crédits, plafond Claude | `services/couts.ts`, `cout-video.ts`, `credits.ts`, `generation-claude.ts`, `depense-claude-video.ts` | suivi des dépenses (≈ 0 €) |
| Travaux, boucle de fond, notifications, partages, téléchargements | `services/travaux.ts`, `boucle*.ts`, `notifications.ts`, `partages.ts`, `telechargements.ts` | fabrication en arrière-plan, « vidéo prête » |
| Mesures des vidéos publiées | `services/mesures*.ts` | suivi des résultats |
| Veille des outils | `src/veille`, `services/veille.ts` | suivi de MediaPipe, Whisper, DeepFilterNet |
| Migrations idempotentes | `services/migrations` | nouveaux champs et types |

**Réellement neuf** : format et moteur `montage-facecam`, conteneur `studio-vision` (transcription libre, points du visage, masques), opérations `preparer-rush`, `image-masques`, `assemblage-facecam` et `motion-design`, mode « source pré-cadrée », calque d'écran partagé par passages, brique `coupes` (reprises), brique `realisation`, écrans « Coupes » et « Image », 12 modèles de motion design, import Drive (relier l'ébauche), file vidéo dédiée.

## Estimation de durée (08/10, à revoir après L0b)
| Lot | Durée de travail estimée |
|---|---|
| L0b mesures et licences | ½ jour |
| L1 format, envoi, Drive, préparation | 1,5 jour |
| L2 son | ½ jour |
| L3 transcription, coupes, écran Coupes | 2 jours |
| L4 réalisation et rythme | 1,5 jour |
| L5 image (anti-grain, lumière, bonne mine, dents, écran Image) — réglages fins compris | 3 jours |
| `studio-vision` + file dédiée + déploiement | 1 jour |
| MD motion design (12 modèles, 3 d'abord) | 3 jours |
| L6 assemblage, écran partagé, habillage | 2 jours |
| L7 contrôles, parcours, Playwright | 1,5 jour |
| Essais réels sur 3 vidéos et ajustements | 2 jours |
| **Total** | **≈ 18 jours de travail** |

- **Calendrier réaliste : 3 à 4 semaines**, parce qu'il faut tenir compte de plusieurs contraintes :
  - les validations de Will (maquettes, 12 modèles en vidéo, essais) ;
  - les mises en ligne aux heures fixes ;
  - la règle « un seul calcul lourd à la fois » sur le PC ;
  - le partage du dépôt avec les autres sessions.
- **Première version utilisable en ≈ 1,5 à 2 semaines** : L0b → L1 → L2 → L3 → L4 → L5 → L6 et L7 avec les 3 premiers modèles de motion design, sans import Drive. Les 9 autres modèles et l'import Drive suivent ensuite.

## Lots (une PR par lot)

**L0. Maquettes** (faites : `facecam\maquettes\Maquette-facecam.html`, images réelles) — **à valider par Will**
- Écrans « Coupes » et « Image » (curseurs **Lumière, Couleurs, Bonne mine, Dents** ; formats).
- Écran partagé (texte en haut).
- Choix de style restants.
- À aligner avec le parcours réel : afficher « étape x / 8 », et ajouter la vue « 2 prises ».

**L0b. Mesures et vérifications** (serveur, sans code de production) → `facecam\MESURES-CHARGE.md`
- Temps de calcul par minute de vidéo, sur 3 cœurs :
  - Whisper `small` et `medium` int8 ;
  - FaceLandmarker et masque de la peau ;
  - débruitage du visage (`fastNlMeansDenoisingColoredMulti` limité au rectangle du visage, ou `nlmeans`) ;
  - passe image ;
  - assemblage par ratio ;
  - rendu d'un modèle de motion design.
- Mémoire de pointe ; serveur de 15 Go partagé avec le site. Objectif : **moins de 15 min de calcul pour 2 min de vidéo**.
- **Licences** :
  - MediaPipe (Apache) ;
  - faster-whisper (MIT) ;
  - DeepFilterNet (MIT/Apache, compatibilité avec torchaudio) ;
  - icônes Lucide (**ISC**) et Phosphor (MIT) ;
  - MatAnyone exclu (non commercial).
  - RVM n'est plus nécessaire (pas d'effet décroché).
- **Apple Log sur iPhone 16 Pro** : vérifier s'il exige ProRes. Si oui, la branche Log est abandonnée : on détecte seulement et on affiche un message clair.

**L1. Format, réception, préparation**
- Format **`face-camera`** :
  - code `FC` dans `registre-codes.ts` ;
  - tableau `FORMATS` ;
  - famille `face-camera` (même identifiant que la famille : on garde `id: "face-camera"`, et un test vérifie qu'il n'y a pas de confusion dans le registre) ;
  - `sources: ["rush"]`, ratios 9:16, 4:5 et 1:1, `moteur: "montage-facecam"`.
  - **Étapes : `sujet` → `script` → `distribution` (dépôt du rush, `Distribution.tsx`) → `coupes` → `image` → `reglages` → `apercu` → `fabrication`** (8 étapes ; le sujet et le script peuvent être sautés en vidéo libre).
- **Statut `masque` → `bientot` → `actif` (fin de L7)**, activé par le réglage `moteur.face-camera`.
- **Formats `selfie` et `createur-b`** (même famille, statut « bientôt », `src/formats/autres.ts`) : selon D3, le face caméra remplace le Selfie, qui passe en `masque` sans être supprimé. Créateur B est laissé tel quel, son style reste à définir.
- **Déclinaison** selon D1 : par défaut, **une seule ouverture pour tous les réseaux** (`declinaison: "aucune"`). Les versions ne diffèrent que par le ratio et le texte de publication.
- **Envoi** : multipart R2 existant (`envoyerFichier`, 4 Go au plus, reprise possible).
- **Import Google Drive** : on part de l'ébauche existante `preparerImportDrive` (`src/services/mes-images.ts:320`, « préparé, simulé, pas relié »).
  - Accès en lecture seule au compte Drive de Will (D8 : OAuth du compte `compte@exemple.fr`).
  - Téléchargement côté serveur.
  - **Repli** : si Drive refuse, l'envoi direct reste disponible et un message explique quoi faire.
- `preparer-rush` :
  - ffprobe (`lireProbe`) qui **accepte** l'horizontal et le HDR ;
  - rotation (F0 : 180°) ;
  - HLG → SDR BT.709 ;
  - 25 i/s ;
  - fichier de travail et audio 16 kHz.

**L2. Son**
- DeepFilterNet3 (ou `afftdn` en secours), puis la chaîne existante et `mixage` : −14 LUFS, −1,5 dBTP, ton de pièce sous les coupes, réduction de la réverbération.
- Musique facultative selon D7, à −25/−30 dB, abaissée automatiquement sous la voix.

**L3. Transcription et coupes**
- **Calage** :
  1. faster-whisper libre sur toute la prise ;
  2. repérage approché de chaque phrase du texte validé, en relevant toutes ses occurrences ;
  3. calage fin par l'aligneur, morceau par morceau, sur l'occurrence retenue.
- Brique `src/briques/coupes/` :
  - début et fin à jeter ;
  - **reprises** = la dernière occurrence complète de chaque phrase ;
  - faux départs, « euh », silences de plus de 0,25 s ;
  - frontières de mots + 2 à 4 images de marge.
  - Cas ambigus : Claude (D2), sinon la règle par défaut.
- **Vidéo libre (sans texte)** :
  - repérage des redémarrages : début de phrase répété, « pardon », « je recommence », phrase abandonnée (règles + Claude, D2) ;
  - sous-titres tirés de la transcription et corrigés par un **glossaire maison** (Axion-IA, Certifexemple, OPCO, noms propres ; nouveau fichier de données), puis par la main de Will ;
  - le contrôle « aucune phrase manquante » est remplacé par « aucune phrase coupée en son milieu et aucun passage doublé ».
- Étape **« Coupes »** :
  - clé `coupes` dans `CLES_ETAPES` et `META_ETAPES` ;
  - `Coupes.tsx` inscrit dans `registre.tsx` ;
  - rétablir une coupe = assemblage seul ;
  - **l'original n'est jamais modifié**.
- **Option « 2 prises »** (avec texte validé seulement) : 2 fichiers déposés dans la même distribution (`prises[]`), chacun calé phrase par phrase, puis alternance d'angle aux frontières de phrases.

**L4. Réalisation et rythme**
- `studio-vision POST /visages` : 478 points, une image sur deux ou trois, lissage aller-retour.
- Brique `src/briques/realisation/` :
  - cadre fixe par plan, zone morte, recentrage aux coupes ;
  - yeux entre 30 et 38 % de la hauteur ;
  - 3 tailles : 100 %, ~115 %, 125-130 % au plus (≤ 115 % si le grain mesuré est fort) ;
  - punch-in de ×1,10 à ×1,20 ;
  - redressement de l'horizon ;
  - zooms adoucis, avec un léger flou de bougé sur les zooms rapides ;
  - fenêtres par ratio, en évitant le bord de la vitre du téléprompteur.
- **Rythme = un changement visuel** (coupe, zoom, B-roll, carte) **toutes les X secondes**, d'après la fiche de style mesurée. **Intensité par défaut du format : Équilibré.**
  - Sobre : 4 à 6 s ;
  - Équilibré : 2,5 à 4 s ;
  - Très dynamique : 1,5 à 2,5 s ;
  - jamais plus de 8 s.
  - (Les chiffres « 6-10 / 4-6 / 2-4 s » du catalogue C7 portent sur les **changements d'angle du double de l'avocat**, pas sur ce rythme.)
- Les coupes de nettoyage sont **imposées** : elles ne passent pas par l'arbitrage de l'orchestrateur d'intensité (`orchestrateur.ts`). Les punch-ins, B-roll, cartes et bruitages, eux, sont comptés.

**L5. Image (décisions de Will)**
- **Anti-grain** :
  - débruitage **avant** d'éclaircir (`atadenoise` + `hqdn3d` temporels ; débruitage multi-images renforcé sur le rectangle du visage) ;
  - gain de lumière plafonné ;
  - **aucune netteté sur la peau** (seulement les yeux, les lunettes et les cheveux) ;
  - fond « propre » par médiane des images où la personne n'est pas (caméra fixe ; exposition et balance des blancs verrouillées au tournage, conseil ajouté à la fiche) ;
  - export à débit élevé.
- **Lumière virtuelle** douce sur le visage (prototype `F0-essai-IMG_7747\lumiere-prototype.py`), **fond légèrement assombri seulement** (environ −10 à −15 %, **jamais flouté**).
  - Cible : visage Y 110-125 ; **pas de cible « fond Y 35-60 »** (look studio sombre abandonné avec le fond décroché).
  - Couleurs mesurées **sur la peau et le mur**, jamais sur l'image entière. Ensuite la LUT du format via `etalonnage`.
- **Bonne mine** (prototype `bonne-mine-prototype.py`, image `6-bonne-mine-*.jpg`), à partir des points du visage :
  - teint plus lumineux, plus chaud et plus coloré, dans le seul masque de la peau ;
  - **cernes** éclaircies et moins violettes ;
  - **peau lissée légèrement**, avec au moins 70 % du grain naturel gardé ;
  - yeux à peine plus clairs ;
  - **dents blanchies**.
  - Bords très adoucis, effet réduit du côté déjà éclairé : le prototype laisse une tache orangée sur la joue droite, à corriger.
  - Contrôle : écart de teinte visage / cou plafonné.
- Étape **« Image »** (`Image.tsx`) :
  - avant / après en glissant ;
  - curseurs **Lumière, Couleurs, Bonne mine (≈ 50 par défaut), Dents** ;
  - cadrage par format.
- Prototypes à versionner dans le dépôt au début du lot : `lumiere-prototype.py` et `bonne-mine-prototype.py`. Les `profondeur-prototype*.py` sont archivés : l'effet est refusé.

**MD-0. Évaluer HyperFrames de HeyGen** (question de Will, 08/10).
- Ce que c'est : framework open source (Apache 2.0, ≈ 59 000 étoiles GitHub, mis à jour le 08/10/2026) qui transforme du HTML, du CSS et des animations GSAP / WebGL en MP4 ; catalogue de blocs prêts (graphiques, titres…) ; pensé pour les agents IA (extension Claude Code).
- **Il n'améliore PAS l'image filmée** : c'est un moteur d'animation et de mise en page, comme Remotion que le studio utilise déjà.
- **Son intérêt est le motion design** : blocs prêts et effets WebGL, qui peuvent accélérer et embellir les 12 modèles du lot MD.
- Décision technique, au début du lot MD :
  - comparer 2 modèles (liste, chiffre) rendus avec Remotion et avec HyperFrames : qualité, temps de rendu sur le serveur, intégration à `studio-rendu` ;
  - on garde Remotion pour tout le reste (sous-titres, composition déjà en place) ;
  - HyperFrames n'est adopté que pour les cartes animées, et seulement s'il est meilleur.
- Source : github.com/heygen-com/hyperframes ; hyperframes.heygen.com.

**MD-0 bis. « Vidéos faites avec Opus 5.5 »** (question de Will, 09/10).
- Ce qu'on voit sur les réseaux : des **motion designs** (titres, schémas, graphiques, animations 3D, explications animées, avec voix et musique). **Claude écrit le code** (HTML / GSAP / SVG / Three.js) et un moteur de rendu (HyperFrames ou Remotion, puis FFmpeg) le transforme en MP4. Il n'y a **ni vraie personne filmée ni retouche d'image**.
- C'est **exactement la méthode du studio** (Remotion pour les sous-titres et les cartes), et c'est Opus 5.5 qui construit le studio.
- **Ce que ça change pour le plan** : les cartes animées peuvent aller au-delà de 12 modèles fixes. On ajoute un mode **« carte sur mesure »** :
  - Claude (Opus 5.5) **écrit une animation propre à la phrase** (schéma, mini-scène 3D, graphique) dans la charte Axion, avec HyperFrames ou Remotion selon MD-0 ;
  - avec des **garde-fous** : durée 3-8 s, zones sûres, texte d'au moins 3 % de la hauteur, contrôle automatique sur des images rendues, sinon repli sur le modèle fixe ;
  - coût Claude estimé de quelques dizaines de centimes à environ 1 $ par carte (à mesurer), sous le plafond Claude ;
  - **option D13** : désactivée tant que Will ne l'a pas validée sur 3 exemples.
- Même méthode possible plus tard pour le **format « Motion design » sans visage** (feuille de route du studio).
- Sources : skillry.dev/ai-videos/opus-5-5 ; help.apiyi.com/en/claude-opus-5-5-code-to-video-guide-en.html ; opus5video.com/examples ; hyperframes.heygen.com.

**MD. Bibliothèque de motion design** (lot à part, commun à tous les formats ; peut avancer en parallèle de L1-L5)
- Type de Bibliothèque `motion`, opération `motion-design` (Remotion, **25 i/s comme le reste du studio**, `Racine.tsx`).
- **12 modèles** :
  1. liste au mot près ;
  2. chiffre qui compte ;
  3. avant / après en barres ;
  4. ligne de temps ;
  5. deux colonnes ;
  6. phrase clé ;
  7. graphique ;
  8. icône + mot ;
  9. problème → solution ;
  10. check-list ;
  11. capture annotée ;
  12. titre plein écran.
- Qualité :
  - ressorts, apparitions décalées, léger mouvement de fond ;
  - charte Axion (sombre chaud, orange, crème, Poppins) ;
  - icônes Lucide (ISC) ou Phosphor (MIT) ;
  - texte d'au moins 3 % de la hauteur.
- Remplissage par Claude depuis la phrase (D2), calé sur les horodatages des mots ; correction par Will avec le recalque gratuit.
- **Validation par Will : chaque modèle en vidéo de 5 s.** **Les 3 premiers validés (liste, chiffre, avant / après) suffisent à démarrer L6**, les 9 autres arrivent ensuite.

**L6. Assemblage et habillage**
- `assemblage-facecam` → une piste par ratio, en mode pré-cadré.
- **Sous-titres dynamiques comme l'avocat** :
  - mêmes styles décidés : Karaoké en base, Minimal, Impact et Bandeau en accents ;
  - **mot-clé orange en 3 tailles** (catalogue des sous-titres l. 53, déjà décidé) ;
  - crème `#F6EEE0` ;
  - position face caméra à 55-72 % ;
  - horodatages recalculés après les coupes ;
  - union des zones sûres.
- **Titre d'accroche** selon D5, **jamais de nom ni de marque**.
- **B-roll gratuits** : Mes images d'abord, puis Pexels et Pixabay (**clés à créer par Will**, D9), puis captures axion-ia.com (`capture-site`). Choisis par mots-clés, entrée et sortie en J-cut / L-cut ; images IA coupées.
- **Écran partagé** (archi. 4), déclenché par le texte (énumérations, chiffres, étapes), **2 à 3 fois par vidéo**.
- **Effets gratuits du catalogue** (type `plan`) :
  - A1 punch-in ;
  - A3 jump cut ;
  - A5 arrêt sur image avec chiffre ;
  - A23 chiffres animés.
  - A14 « texte derrière la personne » : **non retenu** (il demande un détourage, alors que le fond n'est plus traité).
- **Budget visuel** (Will doit rester présent) :
  - B-roll + motion design plein écran : **5 à 15 %** de la durée ;
  - écrans partagés : **25 % au plus** ;
  - **total des moments où Will n'est pas en plein cadre : 35 % au plus**.
- Intensité et bruitages comptés (L4).
- **Accroche** : élément animé avant 1,5 s, première coupe avant 2 s.
- **Fin** : coupe sèche qui boucle.
- Versions par réseau (D1), Buffer existant, vignette de couverture par réseau.

**L7. Contrôle et parcours**
- Contrôles :
  - visage jamais coupé ;
  - luminance du visage dans la cible ;
  - **bruit du visage jamais supérieur à l'original** ;
  - pas de masque visible (teinte visage / cou) ;
  - sous-titres calés et dans les zones sûres ;
  - aucune phrase manquante ni doublée (avec texte) ou aucune phrase coupée (sans texte) ;
  - budget visuel respecté ;
  - −14 LUFS ;
  - **aucun bandeau nom ni marque, jamais**.
  - L'analyse d'images par Claude se fait sous le plafond Claude (D2).
- Parcours complet : sujet → script → séance iPad (ou vidéo libre) → Distribution (envoi ou Drive) → Coupes → Image → Réglages → Aperçu → Fabrication → Validation (recalque) → Buffer. Ensuite, passage du format en `actif`.

**L8 (plus tard).** 16:9 pour LinkedIn bureau et YouTube : la composition le saute aujourd'hui (`montage-avocat/index.ts` ~l. 992 et ~l. 1456, `RatioScene`).

## Veille des outils (point du 08/10/2026)
- Descript (changelog officiel) : « euh » supprimés en français depuis août 2026 ; 18 styles de sous-titres et 10 animations en septembre 2026.
- CapCut : sous-titres traduits ; IA en crédits payants.
- Submagic, Opus Clip, Captions : aucune nouveauté officielle en octobre.
- Détourage : RVM, MatAnyone et MatAnyone 2, BiRefNet (plus nécessaires).
- Rééclairage open source : LightCtrl (ICLR 2026) et PortraitRelighting (CVPR 2024), trop lourds sans carte graphique.
- **Suivi permanent** : MediaPipe, faster-whisper et DeepFilterNet inscrits dans la **page Veille existante** (`src/veille/outils-depart.ts`), plus une vérification des pages de version au début de chaque lot.

## 💶 TOUT CE QUI EST PAYANT — liste unique, à ne pas oublier (demande de Will du 08/10)
Par défaut, l'outil fonctionne **à 0 €** d'outil vidéo. Tout ce qui suit est **soit déjà existant et minime, soit une option désactivée** qui demande l'accord de Will, un devis affiché avant et un plafond mensuel.

| # | Élément payant | Statut | Coût indicatif | Décision |
|---|---|---|---|---|
| P1 | **Claude** : reprises ambiguës, contrôle par images, remplissage du motion design, importance des mots | prévu, sous le plafond existant de 100 $/mois | quelques centimes par vidéo | D2 |
| P2 | **Stockage R2** des vidéos d'origine (jamais effacées) | inévitable | ≈ 0,5 $/mois pour 100 vidéos | — |
| P3 | **B-roll générés sur mesure** — HeyGen Video 1.0 (ou Kling, Seedance, Veo via Higgsfield) | option, lot L9 | ≈ 0,15-0,30 $ par plan de 5 s, ≈ 1 $ par vidéo | D10 |
| P4 | **Netteté IA des plans très serrés** (Topaz, ByteDance via Higgsfield) | option, lot L9 | quelques $/min, sur les seuls passages serrés | D10 |
| P5 | **Rééclairage IA de l'accroche** (Kling ou Seedance en mode retouche) | option, lot L9, essai obligatoire | ≈ 1 $ pour 3 s | D10 |
| P6 | **Anti-scintillement IA** (deflicker) | option, lot L9 | faible | D10 |
| P7 | **Personnage créé à partir d'une photo** qui parle avec la vraie voix de Will (HeyGen photo, Higgsfield, Kling) | **noté pour plus tard**, hors plan | quelques $/min | à décider plus tard |
| P8 | **Matériel de tournage** (le levier n° 1 de la qualité d'image) : panneau LED avec diffuseur, posé à 45° | achat facultatif, conseillé | ≈ 50-100 € une fois | D11 |
| P10 | **Transformation Higgsfield** de la vidéo (décor changé ou avatar avec la gestuelle de Will) | option, lot L10, après essai | ≈ 55-130 € par vidéo de 90 s (essai ≈ 55 crédits) | D12 |
| P9 | Clés **Pexels** et **Pixabay** (banques d'images) | **gratuites** (à créer) | 0 € | D9 |

## Qualité d'image : le problème n° 1 de Will (08/10) — ce que le plan fait pour le régler
1. **Ordre de traitement** fixé :
   1. conversion propre ;
   2. **débruitage temporel AVANT tout éclaircissement** ;
   3. débruitage renforcé sur le visage ;
   4. lumière virtuelle ;
   5. bonne mine ;
   6. couleurs mesurées sur la peau et le mur ;
   7. LUT ;
   8. netteté seulement sur les yeux, les lunettes et les cheveux ;
   9. export à haut débit.
2. **Objectifs mesurés** sur chaque vidéo, dans les contrôles de L7 :
   - bruit du visage ≤ original (cible : −30 %) ;
   - luminance du visage 110-125 ;
   - écart de teinte visage / cou plafonné ;
   - aucun contour visible.
3. **Banc d'essai** : avant / après sur 3 vidéos de Will, et comparaison à des images de référence (un créateur de référence, un créateur de référence) avec les mêmes mesures. On ajuste jusqu'à l'accord de Will, avant de passer le format en « actif ».
4. **Limite honnête** : l'écart avec un créateur de référence vient surtout du matériel (caméras à grand capteur, équipe, lumière ; voir la fiche de style § 0 bis). Le traitement réduit fortement cet écart, mais ne l'efface pas. Le seul levier qui l'efface presque, c'est la lumière au tournage (P8, ≈ 50-100 €).
5. Options payantes de rattrapage : P4 (netteté) et P5 (rééclairage de l'accroche), seulement si les mesures du point 3 ne suffisent pas.

## 🧪 Variante « Higgsfield de bout en bout » (idée de Will du 08/10 — le plan gratuit reste la base)
**Idée** :
1. Will se filme pour de vrai (gestes, voix).
2. **Higgsfield transforme la vidéo** : il garde Will et change le décor par une simple phrase, OU il remplace Will par un avatar qui reprend ses gestes.
3. Le studio fait ensuite tout le montage : coupes, plans, zooms, LUT, sous-titres, motion design.

**État de l'art au 08/10/2026** (catalogue du connecteur Higgsfield + recherche web, sources dans le rapport du jour) :
- **Genjutsu** (sorti le 01/09) :
  - « Motion Transfer » reprend les mouvements et le rythme, puis reconstruit le personnage, le lieu et l'ambiance d'après des photos ;
  - « Object Swap » change seulement le lieu ou la tenue ;
  - **4-30 s par passage**, 1080p au plus, environ **144 crédits pour 15 s en 1080p** (≈ 7 €).
- **Ad Multiplier** (4-30 s, garde le son, le timing et les coupes, change le décor ou la personne), **Seedance 2.5** en mode retouche, **Kling 3.0 Omni Edit** (jusqu'à 4K), **FLUX 3 Video Edit** (15 s, **1 crédit/s**).
- **Relight** : 15 s, 135 crédits, interface web seulement, **pas d'API**.
- ⚠️ **Seedance 2.x refuserait les vidéos avec un vrai visage humain** (« contains faces or IP », d'après des retours d'utilisateurs). Cela toucherait aussi Ad Multiplier et Cinema Studio 4.0, à vérifier par un essai.
- **Aucune garantie publiée sur la synchronisation des lèvres** après transformation. Les défauts signalés : décor qui bouge, lumière qui ne raccorde pas, mains et cheveux faux, lèvres qui décrochent.
- Aucun exemple public de vidéo parlée de 1 à 2 min transformée de bout en bout.

**Analyse** :
- Une vidéo de 90 s = **3 à 8 passages** de 10 à 30 s.
- **Atout propre à notre studio** : le montage coupe de toute façon toutes les 2 à 4 s. On peut donc **caler les frontières entre passages sur nos coupes** (pauses de parole, changement de plan) : les raccords deviennent invisibles. C'est ce qui rend l'idée de Will réaliste, à condition que les lèvres tiennent.
- **Coût** : environ **55 à 130 € par vidéo de 90 s** (avatar, reprises comprises), et environ 80 à 200 € pour un décor changé de manière générative. C'est cher pour la vidéo la plus fabriquée.
- **Rappel des décisions de Will** :
  - un décor posé derrière un Will détouré donnerait l'effet « découpé » refusé le 08/10 ;
  - seul un décor **régénéré en entier** (Genjutsu, Kling) peut avoir une lumière cohérente ;
  - l'**avatar** rejoint l'option P7 (personnage).

**Architecture si on le fait** : un lot **L10 « Transformation »** inséré entre L3 (coupes) et L4 (réalisation).
- Découpage de la vidéo utile en passages de 10 à 15 s aux pauses de parole.
- Même photo de référence et même instruction pour tous les passages.
- Essai en 480p, puis passage final en 1080p.
- Contrôle automatique à chaque raccord : visage, lèvres (écart audio / bouche), mains, lumière. Si un passage échoue, on garde le passage d'origine.
- Retour dans le pipeline gratuit : la voix reste l'audio d'origine de Will.
- Devis et plafond mensuel, comme les autres options payantes (P10).

**Avant toute décision : essai à environ 55 crédits** (le compte en a 110) sur un extrait de 15 s de `IMG_7747.MOV` :
1. FLUX 3 Video Edit, décor changé (≈ 15 crédits) ;
2. Genjutsu 480p, avatar ou décor (≈ 40 crédits).

On vérifie dans cet ordre : le visage réel est-il accepté ? les lèvres sont-elles calées ? la qualité tient-elle ? → **décision D12 de Will**.

**✅ RÉSULTATS DE L'ESSAI (08/10, 17 h 30)** — 30,25 crédits dépensés ; images et vidéos dans `F0-essai-IMG_7747\higgsfield\`.
Essai sur 15 s de `IMG_7747.MOV` (18 → 33 s), avec **FLUX 3 Video Edit**, consigne « décor de bureau chaleureux, ne rien changer à l'homme » :
- **Visage réel accepté**, aucun refus.
- **Synchronisation parfaite** : même durée (15,04 s), même timeline, **formes de bouche identiques** aux 4 instants contrôlés (`flux-bouches.jpg`).
- **Décor très crédible** (bibliothèque, lampe, fenêtre), avec une lumière cohérente : **pas d'effet découpé**.
- Visage fidèle, légèrement adouci (**moins de grain que l'original**).
- **Définition de sortie : 1248×704** en entrée horizontale, **704×1248** en entrée **verticale (retenue, Will veut du vertical)**. Agrandie à 1080×1920, l'image reste un peu moins piquante que l'original mais acceptable (`flux-vertical-nettete.jpg`). Netteté IA possible en option (P4).
- Image à 24 i/s, son d'origine remis par-dessus (`flux-vertical-avec-voix.mp4`).
- **Coût : 1 crédit/s**, donc environ **90 crédits par vidéo de 90 s ≈ 4 à 5 €** (au lieu des 55-130 € estimés pour Genjutsu).

**Point encore inconnu : la constance du décor d'un passage de 15 s à l'autre.** FLUX n'accepte pas d'image de référence, le décor peut donc varier.
- **Prochain essai** : 2 passages qui se suivent (30 crédits).
- **Repli prévu** : **Kling 3.0 Omni Edit** avec l'**image du décor en référence** (`455e1621…`, décor généré pour 0,25 crédit), qui garantit le même décor partout. Devis vérifié : **30 crédits par passage** (≈ 2 crédits/s).

**Essai v2 (08/10, 17 h 50, 15 crédits)** — remarque de Will sur v1 : « on voit que l'arrière-plan est faux ».
- Diagnostic de v1 :
  - fond **stable** (pas de scintillement : variation moyenne 0,25) ;
  - mais **lumière incohérente** (bureau sombre et chaud, Will éclairé froid et à plat) ;
  - **fond aussi net que le sujet** ;
  - **pas de profondeur** (bibliothèque collée derrière la tête) → effet « papier peint ».
- **Règles de consigne retenues** (`flux-v1-v2.jpg`, `flux-vertical-v2-avec-voix.mp4`) :
  - décor **cohérent avec la vraie lumière** du tournage (jour, lumineux) ;
  - **pièce profonde** (4-6 m derrière le sujet) ;
  - **fond légèrement flou** « comme un vrai téléphone » ;
  - la même lumière tombe sur le sujet et sur la pièce, avec la même balance des blancs ;
  - « photoréaliste, pas de CGI, pas de toile de fond » ;
  - visage, lèvres et mains « identiques image par image ».
- → v2 nettement plus naturelle. Solde ≈ 65 crédits.

**Lot L10 révisé** :
- passages de 15 s calés sur les pauses de parole ;
- source verticale ;
- décor décrit par une instruction écrite ou par une image de référence ;
- contrôle des bouches et des raccords ;
- son d'origine.
- Coût cible : **≈ 4 à 10 € par vidéo**.

## Options IA à bas coût (désactivées par défaut — décision D10 de Will)
Point du 08/10 : documentation HeyGen, catalogue Higgsfield lu par son connecteur, recherche web. Classées par gain sur le face caméra :

| # | Option | Outil (déjà accessible) | Coût indicatif | Gain | Risque |
|---|---|---|---|---|---|
| 1 | **B-roll générés sur mesure** (au lieu des banques génériques) | **HeyGen Video 1.0** (`heygen-video-1`, `POST /v3/models/videos`, texte/image/références → vidéo 5-15 s, 9:16 en 1080p, son inclus ; lancé en octobre 2026, même clé API que l'avocat) ; sinon Kling 3, Seedance 2.5, Veo 3.1, Wan 3.0 via Higgsfield | promo annoncée par HeyGen : 0,01 $/s en 768p jusqu'à fin octobre (0,02 $ ensuite) ; 1080p = ×3 → **≈ 0,15 à 0,30 $ par plan de 5 s** | **fort** : des images qui collent exactement au propos (dirigeant débordé, tableau de bord…) | faible : jamais sur le visage de Will ; contrôle visuel |
| 2 | **Netteté des plans serrés** (au-delà de 115 %) | `bytedance_video_upscale`, `topaz_video`, `video_upscale` (Higgsfield) | quelques $/min, **sur les seuls passages serrés** | moyen | faible (pas de régénération du visage, à vérifier) |
| 3 | **Rééclairage de l'accroche** (3 premières secondes) | `kling_video_edit`, `flux_3_video_edit`, `seedance_2_5` (mode édition) | ≈ 1 $ pour 3 s | moyen | **moyen** : lèvres et visage à vérifier ; essai obligatoire |
| 4 | Anti-scintillement, cadence | `video_deflicker`, `fps_boost` | faible | faible (lumières de plafond qui scintillent) | faible |
| — | Non retenus pour le face caméra | `sync_so` (synchro des lèvres : inutile, la voix est la vraie) ; `clipify` (le studio fait mieux) ; détourage, profondeur (`video_background_remover`, `depth_anything_video`, `sam_3_video` : effet refusé par Will) ; angles générés sur visage parlant (déconseillés) | | | |

- Branchement :
  - option 1 = nouveau fournisseur `heygen-video` dans la cascade d'illustrations (Mes images → banques → **HeyGen Video** → fal.ai) ;
  - options 2 à 4 = passes facultatives par passage.
  - Toutes passent par la **garde de prix, les crédits et le budget existants** (`services/couts.ts`, `credits.ts`) avec un **plafond mensuel fixé par Will** ;
  - **devis affiché avant chaque lancement**.
- Lot **L9 (après L7)**, une option à la fois, chacune après un essai et l'accord de Will.
- Prix à **revérifier dans le tableau de bord HeyGen** : la documentation ne donne pas le tarif.

## Coûts
- Aucun outil vidéo IA payant.
- **Claude**, sous le plafond existant de 100 $/mois (`generation-claude.ts`) : reprises ambiguës, contrôle par images, **remplissage des modèles de motion design**, **note d'importance des mots des sous-titres**. Quelques centimes par vidéo, à mesurer en L0b.
- **R2** : rushs HEVC 4K 25 i/s ≈ **0,15-0,2 Go/min**, conservés (jamais effacés) → environ 30-40 Go pour 100 vidéos de 2 min ≈ **0,5 $/mois**.
- Le disque temporaire du serveur est vidé après chaque travail.

## Règles de chantier
- Avant chaque PR : `git fetch`, `ListAgents` + un message à la session studio. Ne jamais redémarrer ses conteneurs sans elle. Mises en ligne aux heures fixes.
- PC : une commande lourde à la fois (`verrou-lourd.txt`) ; vidéo et mesures **sur le serveur**, à faible priorité.
- Rien n'est effacé.

## Vérification
- **Vitest**, une famille de tests par lot :
  - coupes, avec le cas F0 (début 0-15,1 s, reprise 101,8-111,2 s, fin 118,3-130,7 s) ;
  - calage par phrase sur une prise avec reprises ;
  - vidéo libre : redémarrages et glossaire ;
  - rythme par niveau, coupes imposées non arbitrées ;
  - mode pré-cadré en 4:5 et 1:1 ;
  - écran partagé : texte en haut, au plus 3 par vidéo, sous-titres à la jonction ;
  - budget visuel ;
  - remplissage des modèles de motion design ;
  - sous-titres recalés après une coupe rétablie ;
  - original jamais modifié ;
  - aucun bandeau nom ni marque ;
  - contrat du moteur ;
  - concordance des contrats `studio-rendu` ;
  - migrations `Video.entrees.facecam` et `TypeElement` ;
  - registre (`face-camera` format et famille, `MOTEUR_PRISES_FILMEES`) ;
  - import Drive (simulé), avec refus et repli.
- **Python** (`studio-vision/tests`) :
  - points du visage ;
  - masques de la bouche, des cernes et de la peau ;
  - **bruit du visage avant et après (jamais plus)** ;
  - écart de teinte visage / cou ;
  - fond propre.
- **Cas limites** : HDR, rotation, plus de 4 Go (refus clair), coupure d'envoi puis reprise, Log (message).
- **Essai réel** sur `IMG_7747.MOV` puis sur 2 nouvelles vidéos de Will : versions 9:16 et 4:5 mesurées (durée, LUFS, luminance, bruit, rythme, temps de calcul), comparées à la fiche de style, montrées à Will à côté d'une référence.
- **Playwright**, avec le double de simulation : parcours complet en mobile et sur ordinateur.

## Décisions encore ouvertes (Will)
- **D1** : une seule ouverture pour tous les réseaux (conseillé) ou une par réseau ?
- **D2** : Claude pour les reprises ambiguës, le contrôle, le motion design et l'importance des mots (quelques centimes par vidéo, sous le plafond) ?
- **D3** : le face caméra remplace le Selfie ?
- **D4** : caméra arrière derrière la vitre (conseillé) ou caméra avant ?
- **D5** : titre d'accroche pendant les 3-6 premières secondes, toute la vidéo, ou aucun ?
- **D7** : musique aucune (par défaut) ou très discrète ?
- **D8** : accès lecture seule au Drive `compte@exemple.fr` pour l'import ?
- **D9** : créer les clés gratuites **Pexels** et **Pixabay** (déjà dans la liste des comptes à ouvrir) ?
- **D10** : options IA à bas coût (surtout les B-roll générés par HeyGen Video, environ 0,15 à 0,30 $ le plan) avec un plafond mensuel (par exemple 10 €), ou rester à 0 € ?
- **D11** : acheter un petit panneau LED avec diffuseur (≈ 50-100 €) ? C'est le plus gros gain de qualité d'image possible.
- **D5 (éclairage)** : chez un créateur de référence, le titre reste affiché **pendant toute la vidéo**, avec le mot en majuscules juste au-dessus. C'est la proposition par défaut si Will valide.
- *(D6 retirée : le look « studio sombre » tombe avec le fond décroché, et le mot-clé est déjà décidé : orange, 3 tailles.)*

## Ajouts issus de l'analyse du guide « Laisse Claude monter tes vidéos » (un créateur de référence, 09/10, équipe de 10 agents)
Détail complet, lot par lot : (analyse non publiée), section « Pour le plan ». Elle fait partie du plan. Verdict : le guide est complémentaire, il n'est pas supérieur (pilotage manuel, aucun traitement d'image, produit d'appel pour « Montag'IA »).

**ADOPTÉ** :
1. **Relecture automatique des images finales par Claude** (L7) : 20 à 40 images, liste fermée de défauts (visage caché, texte débordant, carte illisible…), correction automatique en 2 tours au plus.
2. **Bouton « Vérifier mon cadre »** (L1) : essai de 5 s analysé en moins de 30 s (son, lumière, cadre, rotation, HDR), pour 0 €.
3. **Bouton « Une remarque à cet instant »** (L6-L7) : `interpreterDemande` reçoit de nouvelles opérations sur les zooms, les cartes et les coupes ; prix affiché, accord demandé.
4. **Feuille de montage lisible dans l'Aperçu** (L6) : elle ne bloque rien, « fabriquer sans attendre » est activé par défaut.
5. **Fiche de tournage face caméra dans le studio** (L1), avec **3 s de pièce vide au début** pour le fond propre et le ton de pièce, **jamais pour détourer**.
6. **Zooms calés sur le début d'un mot important** (L4) et contrôle « rien ne recouvre le visage ».
7. **Coupes affinées** (L3) :
   - une pause « chute » gardée avant la phrase choc (2 au plus par vidéo) ;
   - durée avant et après affichée ;
   - glossaire injecté dans la transcription ;
   - indice de reprise en vidéo libre.
   - **Le seuil des silences est à trancher** : 0,18 / 0,25 / 0,4 s selon les documents.
8. **Finitions du motion design** (MD) :
   - une chute obligatoire dans la dernière seconde ;
   - un fichier de charte motion versionné ;
   - un bouton « Garder ce modèle » ;
   - modèle 13 « documentaire » (sans nom) ;
   - graphique alimenté par un tableau collé.

**REFUSÉ** :
- piloter Claude Code à la main sur le PC, et acheter Montag'IA ;
- les effets de détourage ;
- le bandeau nom ;
- la carte titre plein écran de 2 s ;
- un whoosh et un zoom à chaque phrase ;
- les effets annoncés à voix haute ;
- les styles « par leur nom » (bande-annonce, VHS…) ;
- les sous-titres en 3 langues, pour l'instant ;
- le tournage vertical.

## ⭐ « Mes demandes » : Will ajoute ce qu'il veut dans sa vidéo (demande de Will, 09/10, « comme elle le fait »)
Will reste libre d'ajouter ses propres éléments, en plus de ce que le studio décide seul. **Trois moments**, tous en langage courant, aucun code :
1. **Dans le texte, avant de filmer** (réutilise les **annotations de script existantes** `AnnotationSegment` : `titreEcran`, `emphase`, `illustration`, `zoom`, `pause`, `incrustation` ; `src/domaine/types.ts:498`).
   - Will touche une phrase du texte et choisit « Montrer une image / mon logo », « Chiffre en grand », « Zoom ici », « Carte animée », « Pause ».
   - Ajout de l'annotation **`motion`** : un modèle de carte animée, ou une carte sur mesure décrite en une phrase.
   - L'effet tombe **sur le mot exact**, grâce au calage du texte.
2. **En une phrase, au moment de lancer** : une case « Vos demandes pour cette vidéo », par exemple :
   - « quand je dis Certifexemple, montre le logo Certifexemple » ;
   - « à la fin, affiche le lien de prise de rendez-vous ».

   Claude la transforme en éléments du montage, les retrouve dans la transcription et les affiche dans la **feuille de montage**, où chacun reste modifiable.
3. **Après, en regardant** : le bouton « **Une remarque à cet instant** » (repris du guide), pour ajouter, déplacer, retirer ou décaler un élément.

**Ce que Will peut demander** :
- images et logos de « Mes images » ;
- B-roll précis ;
- carte animée (modèle ou sur mesure) ;
- chiffre ;
- titre ;
- zoom ;
- écran partagé ;
- musique ou bruitage ;
- pause ;
- changement de plan.

**Garde-fous** :
- chaque demande passe par le **régulateur d'intensité** et par la **relecture des images par Claude** (visage jamais caché, texte lisible, zones sûres) ;
- si une demande va contre une règle du format (bandeau nom, détourage…), le studio **prévient et demande confirmation**, sans refuser en silence : **c'est Will qui décide** ;
- coût affiché avant, souvent 0 € (Claude : quelques centimes).
- Case « **Appliquer aux prochaines vidéos** » : la demande devient une règle du format (par exemple : « logo Certifexemple chaque fois que je dis Certifexemple »).

**Lots** :
- annotations et case de demandes en **L6** (avec la feuille de montage) ;
- interprétation par Claude dans `interpreterDemande` (`modifications.ts`), étendue aux éléments du face caméra ;
- tests Vitest : demande → élément au bon mot, demande contraire à une règle → confirmation, budget d'intensité respecté.

## ⭐⭐ L11 « Agent monteur » : Will parle à son monteur (demande de Will, 09/10 — prime sur les refus précédents pour ces effets À LA DEMANDE)
**Principe** : la méthode du guide de un créateur de référence, **mais automatique et sur le serveur**. Will donne des consignes en langage courant :
- **à voix haute pendant qu'il filme**, avec un mot d'appel du type « Monteur, … » ou une phrase impérative repérée dans la transcription ;
- **par écrit** (case « Vos demandes », remarque à l'instant).

Claude Opus (l'« agent monteur ») les comprend, construit l'effet **calé sur le mot exact**, vérifie ses propres images, puis **coupe la consigne** du montage final. Option « garder la consigne audible », comme un créateur de référence, pour que le spectateur entende la demande puis voie l'effet.

**Pas de prix affichés** (décision de Will : « c'est un outil pour moi ») :
- aucune confirmation de coût ni aucun devis par action ;
- seulement un **total du mois** dans Réglages, et un **plafond mensuel de sécurité** que Will fixe une fois (désactivable). Il évite seulement une dépense qui s'emballe ;
- remplace les mentions « devis avant » et « prix affiché » du plan pour les usages de Will.

**Vocabulaire de consignes**, extensible (exemples de Will) :
| Consigne de Will | Ce que fait le studio | Technique |
|---|---|---|
| « Nettoie le son » | voix isolée, débruitée, au bon volume | L2 (déjà prévu) |
| « Ajoute des couleurs » / « plus chaud » | étalonnage plus saturé ou plus chaud, LUT | L5 |
| « Je liste… » | carte liste dont chaque point apparaît au mot | modèle 1 |
| « Je compare deux choses → mets-les côte à côte, montre ce qu'elles ont en commun » | carte comparaison 2 colonnes et zone commune (Venn) | modèle 5 + carte sur mesure |
| « J'explique un processus → feuille de route qui avance pendant que je parle » | ligne de temps animée, l'étape active suit la parole | modèle 4 |
| « Montre comment un reel devient viral » | explication animée sur mesure (téléphone, étapes qui se cochent) | carte sur mesure MD-0 bis |
| « Mets-moi à droite / à gauche » | Will **rétréci dans un cadre** sur un côté, l'explication de l'autre | calque de mise en page (pas de détourage) |
| « Une petite version de moi » | Will en vignette (image dans l'image) | A7 |
| « Zoom sur ma main et mets [le logo] sur ma main », « lance-le dans l'écran » | suivi de la main (MediaPipe Hands), objet 3D posé sur la paume puis projeté vers la caméra (vitre qui se brise) | **effet spectaculaire** : Three.js / HyperFrames |
| « Découpe la scène en calques : le mur, moi, mon texte » | texte placé **entre le mur et Will** | **détourage** (A14) |
| « Cache mon calque » / « fais-moi revenir » | Will disparaît, la pièce vide continue de parler, puis il revient | détourage + **plaque vide** |

**Effets à détourage, À LA DEMANDE seulement** (Will avait refusé l'effet décroché par défaut ; il le veut désormais quand il le demande) :
- jamais appliqués automatiquement ;
- meilleur détourage disponible (RVM ou équivalent sous licence commerciale ; comparatif L0b), avec la **plaque vide** filmée ;
- la relecture des images contrôle les bords ;
- si les bords sont mauvais (mains rapides, cheveux), le studio **prévient Will** et propose une variante sans détourage. Limite reconnue aussi par le guide.

**Architecture** :
- agent Claude sur le serveur, avec les outils du studio : transcription horodatée, images extraites, opérations de montage, modèles de motion design, rendu HyperFrames ou Remotion, capture d'images de contrôle ;
- boucle « plan → construction → photo de contrôle → correction » (2 tours au plus) ;
- toute consigne inconnue → carte ou effet **sur mesure** écrit par Claude, avec les garde-fous MD-0 bis ;
- tout est versionné (`parentVersionId`) : rien n'est perdu.

**Ordre** :
- après L7 (la base doit être solide) : **L11a** consignes de réglage, cartes et mise en page ;
- puis **L11b** effets spectaculaires (main 3D, calques, disparition), un à un, chacun validé par Will en vidéo de 5 s ;
- les consignes écrites arrivent en même temps que les consignes dites à voix haute.

**Fiche de tournage** :
- « Monteur, … » au début d'une consigne ;
- une seconde de pause après ;
- tenir la main ouverte immobile 1 s pour un objet posé dessus ;
- 3 s de pièce vide au début.

> **Précision de Will (09/10)** : les consignes du tableau L11 ne sont **que des EXEMPLES**. L'agent monteur doit accepter **n'importe quelle consigne de montage**, par exemple :
> - « divise l'écran en deux » ;
> - « rajoute un générique » ;
> - « mets un titre » ;
> - « accélère ce passage » ;
> - « mets une musique plus calme » ;
> - « fais un arrêt sur image »…
>
> Le vocabulaire est **ouvert** :
> - une consigne connue utilise un élément de la Bibliothèque ;
> - toute autre consigne est construite **sur mesure** par Claude (code HyperFrames / Remotion), avec le contrôle d'images ;
> - si un rendu réussi plaît à Will, il peut être enregistré comme nouvel élément réutilisable (« Garder ce modèle »).
>
> Coordination du 09/10 : les sessions axion-ia-1d, -75, -83 et -a1 ont confirmé ne toucher **ni au dépôt studio-axion-ia, ni à ses conteneurs**.
