# Lot R5 — Étalonnage et son, outils du serveur (relevé, 03/10/2026)

Plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md`, constat C7, lot R5. Branche `outils/r45`, après R4.

## Ce qui change pour Will

- **Bibliothèque > Couleurs** : une LUT qu'il importe reçoit sa **vraie image « après »** (la photo de référence
  passée dans sa LUT, calculée sur notre serveur, gratuit). Le curseur d'intensité mélange ensuite l'avant et
  l'après exactement comme la vidéo le fera. Sans l'outil réel relié : « aperçu approché », comme avant.
- Plus de pastille « Essai » sur cet écran ; le bouton « Ajouter cette LUT » n'est plus marqué « Essai ». Le
  message dit « Couleur ajoutée », ou « Couleur ajoutée · aperçu approché » (relecture : plus de « LUT » à l'écran).
- Le fichier `.cube` est désormais vraiment gardé dans le stockage (avant : seul son nom l'était).
- Son : le mixage réel existe (chaîne de la voix du montage, musique qui s'efface sous la voix, −14 LUFS, crête
  ≤ −1,5 dBTP). Aucun écran ne l'appelle encore (préparation du podcast).

## Comment c'est fait

| Morceau | Fichier |
|---|---|
| Opération `etalonnage` : LUT lue et vérifiée, MÉLANGÉE à l'identité selon l'intensité (même calcul que le montage, exact), puis FFmpeg `lut3d` tétraédrique en RVB ; image (file courte, JPEG ou PNG) ou vidéo (file longue, H.264 BT.709, son copié) ; intensité 0 = aucune LUT | `studio-rendu/src/operations/etalonnage.ts` |
| Opération `mixage` : `preparerSon` (la chaîne du montage, `son/chaine.ts`, réutilisée telle quelle), musique bouclée qui s'efface sous la voix (`gainsEffacement`, gain calculé sur la voix), voix centrée, niveau final remesuré (3 passes au plus), WAV stéréo 48 kHz 24 bits | `studio-rendu/src/operations/mixage.ts` |
| Contrat : `OperationRendu` + `"etalonnage"`, `"mixage"` ; `appliquer` reçoit `source?`, `mixer` reçoit `source?` (adresses signées par le studio) ; réponse du mixage `creteVraieDbtp?` (ajouts purs) | `src/fournisseurs/types.ts`, `studio-rendu/src/contrat.ts`, `studio-rendu/src/index.ts` |
| Fournisseurs « studio-rendu » (gratuits) et attente bornée commune (panne passagère soumise à nouveau 2 fois, délai : image 60 s, vidéo et mixage 20 min) ; inscription dans `outilsServeur()` avec `STUDIO_RENDU_URL` ; une ligne par type dans le registre | `src/fournisseurs/rendu/etalonnage.ts`, `son.ts`, `attente.ts`, `inscription.ts`, `src/fournisseurs/index.ts` |
| Service : image « après » (référence à 100 %), copie UNE fois dans le stockage des fichiers publics que le serveur de rendu doit lire (`/demo/…`, `/luts/…` → `studio/{env}/public/…`), `.cube` enregistré avec ses vrais octets | `src/services/etalonnage.ts` |
| Import : `.cube` envoyé par le navigateur (`envoyerFichier`, gros fichiers compris) ou déposé par le serveur depuis son contenu ; seul un fichier `studio/{env}/element/lut/….cube` est accepté ; une panne de l'image après n'empêche jamais l'import | `src/app/(studio)/bibliotheque/actions.ts`, `src/components/bibliotheque/EcranLut.tsx` |

Activation : `FOURNISSEUR_ETALONNAGE=studio-rendu`, `FOURNISSEUR_SON=studio-rendu` (ou Réglages > Connexions quand
R0 sera fusionné), avec le stockage R2 relié.

## Preuves

- **ROUGE prouvé sur 03d297b** (`actions.ts` identique à 03d297b au moment du passage) :
  `R5 · une LUT importée reçoit sa vraie image « après » > ROUGE (03d297b)` →
  `AssertionError: image après: expected undefined to be truthy`. Vert ensuite.
- `tests/r5-operations.test.ts` (9, VRAI FFmpeg) : écart FFmpeg / `lib/lut3d` ≤ 2/255 sur la LUT Axion clair-obscur
  65 points (mesuré : **1/255 au plus sur les 4 LUT Axion**, écart moyen 0,26 à 0,50/255) ; intensité 0 → image
  identique pixel pour pixel ; 50 % → mélange exact de l'avant et de l'après (± 1,5/255) ; LUT cassée refusée sans
  dépôt ; mixage de la voix de démonstration M4 sans et avec musique → **−14 LUFS ± 0,5 et crête vraie ≤ −1,5 dBTP**
  mesurés sur le fichier rendu, stéréo 48 kHz.
- `tests/r5-etalonnage-son.test.ts` (7) : chemin complet du studio avec un vrai `studio-rendu` local et un faux seau
  R2 en mémoire : le `.cube` est dans le stockage octet pour octet, l'image de référence publique y est copiée une
  fois, une seule demande à 100 %, image « après » rangée sur la LUT ; `.cube` envoyé par le navigateur repris ; un
  autre fichier refusé ; fournisseurs réels choisis par `FOURNISSEUR_<TYPE>`, gratuits ; sans source : refus clair.
- `npx tsc --noEmit -p .` = 0 ; `studio-rendu` `tsc` = 0 ; eslint des fichiers du lot = 0 ; vitest complet : voir le
  rapport final.

## Démonstration M4 inchangée (R4 + R5)

Démonstration refaite APRÈS les deux lots par `outils/demo-m4/rendre-demo.mts` inchangé, puis une seconde fois avec
les compositions de 03d297b ; empreinte = MD5 (12 premiers caractères) des lignes `ffmpeg -f framemd5` hors
commentaires, images puis son (méthode recalée sur la vidéo du dépôt) — `docs/captures/r45/demo-m4-inchangee.json` :

| Format | Avec les lots | Avec 03d297b |
|---|---|---|
| 9:16 | 59cf135d2d1b / 1a829a7c2541 | 59cf135d2d1b / 1a829a7c2541 (fichier identique octet à octet) |
| 4:5 | 484cf25eb7ee / 1a829a7c2541 | 484cf25eb7ee / 1a829a7c2541 |
| 1:1 | cec2f851029f / 1a829a7c2541 | cec2f851029f / 1a829a7c2541 |

**Les lots ne changent rien à la démonstration.** ⚠ Les empreintes de référence 0302e1a08c99 / 4cfe49eac70c /
c6b1aa0e3fe5 sont celles de la vidéo du dépôt, rendue AVANT `1e7eb49` (« sous-titres lisibles sur fond clair ») :
03d297b lui-même ne les donne plus (le son, lui, est identique). La vidéo du dépôt est laissée telle quelle.

## Points d'attention

- Les LUT importées AVANT ce lot n'ont pas d'image « après » (leur `.cube` n'a jamais été gardé) : les réimporter.
- À vérifier hors de ce lot (R8) : le montage réel signe les LUT Axion sous leur clé publique `/luts/…`, qui n'existe
  pas dans le seau R2. `cleLisibleParLeRendu` (`src/services/etalonnage.ts`) fait la copie nécessaire : à brancher
  dans `signer` du moteur avocat si le premier montage réel le confirme.
- `appliquer` sur une VIDÉO et `mixer` attendent jusqu'à 20 min (file longue) : à appeler hors verrou, depuis un
  travail, jamais depuis une page.

## Corrections après les 3 refus de relecture (R4 + R5, 03/10 soir)

Ce qui change pour Will : le titre écrit sur une miniature fait **5 mots au plus, toujours** (même quand il vient du
générateur ou qu'il le tape lui-même : il est raccourci, jamais refusé) et le titre enregistré est **exactement**
celui de l'image ; un fichier de couleur démesuré ou piégé est refusé par une phrase simple ; l'écran parle de
« couleur », plus de « LUT ».

| Lentille | Correction | Fichiers |
|---|---|---|
| Exactitude | 5 mots au plus partout : couverture du générateur (`couvertureDe`), fournisseur (`couvertureDepuisTitre` sur tout texte posé), titre tapé sur une miniature où il est écrit (`choisirMiniature` : c'est CE texte qui est posé et enregistré) | `src/services/miniatures.ts`, `src/fournisseurs/rendu/miniature.ts`, `src/services/videos.ts`, `OngletMiniature.tsx` |
| Sécurité | Lecture d'un `.cube` bornée (`lireCube`, navigateur, studio et serveur de rendu) : 50 Mo de texte au plus, grille ≤ 65 points annoncée une fois et AVANT les couleurs (place réservée une fois), arrêt dès la première couleur en trop, exactement 3 nombres décimaux par ligne dans [−4 ; 4] (ni hexadécimal, ni infini), bornes lisibles et dans l'ordre ; taille hors 17/32/33/64/65 refusée avant tout dépôt ; `.cube` stocké relu (≤ 50 Mo comptés octet par octet), « prêt » et identique à celui vérifié ; téléchargements du serveur de rendu plafonnés (en-tête ET flux) ; erreurs sans adresse signée ; lecture vidéo limitée aux protocoles du réseau | `src/lib/lut3d.ts`, `src/lib/qc-lut.ts`, `src/services/etalonnage.ts`, `actions.ts`, `EcranLut.tsx`, `studio-rendu/src/outils.ts`, `operations/*.ts` |
| Simplicité | UNE attente de rendu (`executerRendu`, `src/fournisseurs/rendu/attente.ts`) pour miniatures, étalonnage, son, vignette de décor, floutage, captures du site ; petits outils communs (`commun.ts` : segment de stockage, identifiant sûr, validité des adresses) ; durée du mixage vérifiée une seule fois | `src/fournisseurs/rendu/*.ts`, `src/services/decors.ts`, `mes-images.ts`, `source-axion.ts`, `mixage.ts` |
| Son | La musique s'efface vraiment sous la voix (gain calculé sur la voix, mesuré ≥ 6 dB) ; niveau hors cible après 3 passes → refus (« Le son n'atteint pas le niveau voulu sans saturer »), jamais un son livré hors cible | `studio-rendu/src/operations/mixage.ts` |
| Visuels | Apostrophe typographique ’ (rendu vérifié) ; « bas » : trait orange SOUS le titre, place réservée dans la zone en vertical comme en 16:9 ; « bandeau » : titre clair, mot mis en valeur en foncé sur UNE pastille crème (« 45 JOURS » d'un seul tenant) ; couleurs = jetons du studio | `Miniature.tsx`, `miniature-mise-en-page.ts` |

Preuves (chaque garde ajoutée rougit, prouvé par mutation temporaire puis restauration, fichier identique après) :
borne du fournisseur, du titre tapé, de la couverture du générateur (`tests/r4-miniatures*.test.ts`) ; taille ≤ 65,
arrêt à la couleur en trop, nombre décimal, plage [−4 ; 4], 50 Mo de texte, bornes inversées, taille avant couleurs,
phrase sans nom technique, trait réservé, apostrophe, compteur du téléchargement, protocoles, adresse retirée, durée,
effacement de la musique, refus hors cible (`tests/r45-relecture.test.ts`) ; taille annoncée refusée avant dépôt,
`.cube` pas arrivé, relu ≠ vérifié, 51 Mo stockés sous une fiche qui ment (`tests/r5-etalonnage-son.test.ts`).
Exemples rendus en local après correction (`outils/miniatures/rendre-exemples.mts`) : regardés, conformes.

**Démonstration M4 refaite après ces corrections** (`outils/demo-m4/rendre-demo.mts`, sorties du dépôt remises à
l'identique ensuite) : 9:16 **59cf135d2d1b / 1a829a7c2541**, 4:5 **484cf25eb7ee / 1a829a7c2541**, 1:1
**cec2f851029f / 1a829a7c2541** — la nouvelle référence est tenue (l'ancienne 0302e1a08c99… est périmée depuis
1e7eb49, c'est voulu).

## Corrections sécurité (relecture R45 sécurité, tête 2ec5382 — veto levé point par point, 03/10)

Ce qui change pour Will : rien à l'écran pour un fichier normal. Un fichier de couleur piégé est refusé en quelques
millisecondes par une phrase simple (« Une ligne de ce fichier de couleur est beaucoup trop longue… », « … contient
trop de lignes vides ou de commentaires. », « … est bien plus gros que ce qu'annonce sa taille. ») au lieu de bloquer
le studio plusieurs minutes. Le serveur de rendu ne lit et n'écrit plus que le stockage du studio, et refuse de
démarrer en production sans sa clé.

| N° | Défaut | Correction | Fichiers |
|---|---|---|---|
| 1 | Expression des nombres à retour arrière quadratique (jeton de 200 Ko : 18,6 s) | Expression SANS ambiguïté (`\d+(?:\.\d*)?` : le point sépare obligatoirement les deux parties) ; AVANT toute expression : 256 signes au plus par ligne (vérifié dès que la ligne en cours dépasse, même lue par morceaux) et 32 par nombre | `src/lib/lut3d.ts` |
| 2 | `split` du fichier entier (50 Mo de sauts de ligne : +1,8 Go) | Lecture LIGNE PAR LIGNE sans tableau (`LecteurCube` : parcours par `indexOf`, seule la ligne en cours est gardée) ; 1 000 lignes hors couleurs avant les couleurs, 64 après ; une fois la grille annoncée, 80 signes par couleur en moyenne (65³ → 22 Mo au plus). Même lecteur aux trois endroits : navigateur (`lireCube`), studio (`lireCubeStocke` : flux du stockage décodé au fil de l'eau, comparé morceau par morceau au contenu vérifié, plus de `Buffer.concat`), studio-rendu (`lireCubeFichier` : fichier lu en flux, étalonnage ET montage) | `src/lib/lut3d.ts`, `src/lib/qc-lut.ts` (`validerLut`), `src/services/etalonnage.ts`, `studio-rendu/src/lut.ts`, `operations/etalonnage.ts`, `operations/composition.ts` |
| 3 | Clé `STUDIO_RENDU_CLE` facultative | studio-rendu REFUSE DE DÉMARRER en production sans clé (`cleDeDemarrage`, l'image fixe `NODE_ENV=production`) ; le studio refuse `STUDIO_RENDU_URL` sans clé en production (au démarrage, `refusRenduSansCle` dans `instrumentation.ts`, et dans `obtenirServiceRendu`) | `studio-rendu/src/serveur.ts`, `index.ts`, `src/lib/demarrage.ts`, `src/instrumentation.ts`, `src/fournisseurs/rendu/client.ts` |
| 4 | Aucune liste d'hôtes (SSRF) | Hôtes permis sur le modèle de `HOTES_CAPTURE` : le point d'accès R2 du compte, calculé comme le studio (`R2_PUBLIC_HOST`, sinon `{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, transmises au conteneur par le compose) + `STUDIO_RENDU_HOTES` facultative ; `https:` seulement, sans port ni identifiants. Appliqué : à l'entrée du serveur (toute adresse d'une demande, dépôts de `parametres.depots` compris → 400 « adresse refusée », rien n'est lancé), dans `telecharger` et `deposer` (jamais de redirection suivie), avant de donner une adresse à FFmpeg (miniature, analyse : protocoles du réseau + formats permis `-format_whitelist`) | `studio-rendu/src/outils.ts`, `serveur.ts`, `operations/miniature.ts`, `operations/analyse-media.ts`, `deploiement/docker-compose.yml`, `deploiement/env.exemple` |
| 5 | Repli fichier local de la miniature actif en production | Chemin local accepté SEULEMENT en mode essai explicite (`STUDIO_RENDU_ESSAI=1`, sans effet si `NODE_ENV=production`) ; sinon refus. Les tests (`vitest.config.mts`) et les scripts locaux (`outils/*/…mts`, `studio-rendu/scripts/essai-local.ts`) posent ce mode eux-mêmes | `operations/miniature.ts`, `outils.ts` |
| 6 | FFmpeg ouvre les fichiers téléchargés sans format imposé | Format reconnu à ses premiers octets (`formatReconnu` : PNG, JPEG, WebP, MOV/MP4, WAV, FLAC, Ogg, MP3 ; une liste de lecture ou un texte n'est rien → « Fichier d'un type non permis. ») puis IMPOSÉ avec `-protocol_whitelist file -f <format>` avant chaque `-i` (`lectureLocale`) : étalonnage (image, vidéo, et ffprobe des dimensions) ; mixage : chaque entrée est réécrite par nous en WAV (format imposé, durée coupée au plafond), toute la suite ne lit que ce WAV | `outils.ts`, `operations/etalonnage.ts`, `operations/mixage.ts` |
| 7 | Téléchargements sans plafond, PCM pleine durée en mémoire | `telecharger` : 4 Go par défaut pour TOUTE entrée ; vidéo d'étalonnage 4 Go ; mixage : voix 400 Mo, musique 400 Mo, ton de pièce 50 Mo, bruitage 20 Mo (20 au plus). Musique mélangée PAR BLOCS de 20 s (`EffaceurMusique` à état + `melangerParBlocs`, quelques Mo, résultat identique au calcul d'un seul tenant). La chaîne de la voix (`preparerSon`, partagée avec le montage et la démo M4) reste en mémoire : passer en flux serait trop lourd et toucherait la démo, d'où un **plafond strict de 10 minutes** (≈ 0,6 Go), commenté dans le code — le mixage n'est branché sur aucun écran, il faudra passer la chaîne en flux avant d'accepter un podcast plus long | `outils.ts`, `operations/etalonnage.ts`, `operations/mixage.ts` |
| 8 | Import sans `fichierId` ni contenu : LUT gardée sans que ses octets soient vus | En stockage réel : refus (« Ce fichier de couleur n'a pas pu être lu. Choisissez-le de nouveau. »), rien n'est gardé ; ce chemin reste permis en simulation seulement (`exigerOctetsDuCube`) | `src/services/etalonnage.ts`, `src/app/(studio)/bibliotheque/actions.ts` |
| 9 | Raccourci « même longueur » aussi pour un stockage réel sans lecture signée | Raccourci SEULEMENT si `stockage.mode === "simulation"` ; un stockage réel qui ne sait pas relire le fichier → refus | `src/services/etalonnage.ts` |

**Tests** (`tests/r45-securite.test.ts`, 24 tests ; `tests/r5-etalonnage-son.test.ts`, 3 tests de plus) :
- n° 1 chronométrés : 200 000 chiffres + lettre refusés par l'expression seule en **< 50 ms** ; **jeton de 1 Mo refusé
  en < 50 ms** (`lireCube`) et en < 500 ms par tout le chemin du studio (stockage → flux → refus) ; 32 / 256 signes ;
  lecture par morceaux ; l'expression accepte et refuse exactement les mêmes nombres qu'avant ;
- n° 2 mémoire : **50 Mo de sauts de ligne refusés en < 500 ms avec moins de 50 Mo de mémoire en plus** (navigateur /
  `lireCube`, studio-rendu / fichier lu en flux, studio / flux du stockage) ; 1 000 / 64 lignes hors couleurs ; borne
  liée à la grille ; un vrai .cube passe toujours, un fichier stocké plus long que le contenu vérifié est refusé ;
- n° 3 à 9 : refus de démarrer sans clé (studio-rendu, studio au démarrage et dans le client) ; hôtes permis, adresse
  interne, port, identifiants, hôte voisin, `file://` ; mode essai jamais en production ; adresse non permise JAMAIS
  appelée (lecture et dépôt) ; redirection jamais suivie ; 400 du serveur, dépôts compris ; chemin local hors essai ;
  liste de lecture déguisée refusée (étalonnage image et vidéo, mixage, analyse, avec un morceau réellement servi) ;
  formats reconnus ; plafonds (4 Go par défaut, voix 500 Mo annoncés refusés) ; durée > 10 min refusée avant tout
  téléchargement ; mélange par blocs = calcul d'un seul tenant (musique plus courte comprise) ; import sans octets en
  stockage réel ; stockage réel sans lecture signée.

**Chaque garde rougit son test** : prouvé par mutation temporaire de chacune des **24 gardes** (expression ambiguë
remise, longueur par nombre, longueur par ligne, lignes hors couleurs ×3 endroits, borne de grille, clé ×2, liste
d'hôtes, téléchargement, dépôt, 400 du serveur, redirection, chemin local, essai en production, format, formats de
l'analyse, plafond par défaut, plafond de la voix, durée, état des blocs, n° 8, n° 9) : **24 / 24 ROUGES**, fichier
rétabli à l'identique après chaque essai.

**Contrôles** : `npx tsc --noEmit` (racine) 0 erreur ; `npx tsc -p tsconfig.json --noEmit` (studio-rendu) 0 erreur ;
`pnpm lint` 0 erreur ; `npx vitest run` complet : **150 fichiers, 2 048 tests verts** (1 fichier et 2 tests sautés,
comme avant).

**Démonstration M4** : références **non touchées** (59cf135d2d1b / 484cf25eb7ee / cec2f851029f, son 1a829a7c2541).
Le seul changement sur son chemin est la lecture des LUT (`lireCubeFichier` au lieu de `readFile` + `lireCube`) :
vérifié une fois, l'ancienne et la nouvelle lecture donnent des valeurs **identiques octet pour octet** sur les 4 LUT
livrées ; la chaîne du son (`son/chaine.ts`) n'est pas modifiée. Le script de la démo pose le mode essai (ses entrées
sont servies par 127.0.0.1). La démo n'a pas été re-rendue dans ce lot (aucun test ne l'a rendu nécessaire).

Restes connus (hors du cahier de cette relecture) : les entrées de la composition (montage) sont téléchargées depuis
les seuls hôtes permis et plafonnées, mais leur format n'est pas encore imposé avant FFmpeg/Remotion ; à traiter avec
la même discipline (`formatFichier` + `lectureLocale`) dans un lot qui re-rend la démo M4.

## Corrections sécurité, 2e lecture (relecture R45 sécurité, tête f9b586c — 03/10)

La 2e lecture a refusé pour deux défauts **introduits** par la liste d'hôtes de `studio-rendu`. Les deux sont corrigés,
avec un test chacun, prouvé **ROUGE sur f9b586c** puis vert.

**A — Adresse lue autrement par FFmpeg (contournement de la liste d'hôtes).** Avant : l'adresse était vérifiée avec
`new URL`, mais la chaîne d'origine partait à FFmpeg/ffprobe, qui ne la lit pas pareil
(`https://<hôte R2>\@10.0.0.5:6379/x` : hôte R2 pour Node, `10.0.0.5:6379` pour FFmpeg).
Maintenant (`studio-rendu/src/outils.ts`, `adressePermise`) :
- toute adresse contenant `\`, `@`, un espace ou un caractère de contrôle est refusée ;
- toute adresse qui n'est pas déjà sous sa forme normalisée (`new URL(a).href !== a`) est refusée ;
- `exigerAdressePermise` (et `entreePermise` de la miniature) rend l'adresse normalisée : c'est **elle seule** qui
  part à FFmpeg (miniature), ffprobe (analyse de média) et `fetch` (téléchargement, dépôt).
Les adresses signées du studio (encodage RFC 3986) sont déjà normalisées : elles passent sans changement.
Test : `relecture R45 (2e) A` (`tests/r45-securite.test.ts`) — le piège `\@10.0.0.5:6379`, un `@` dans le chemin,
espace, tabulation, caractère nul, majuscules, `..`, adresse sans chemin : tous refusés ; une adresse signée réelle
acceptée. Rouge sur f9b586c : « expected true to be false » sur le piège.

**B — La capture du site était refusée (régression).** Avant : le serveur passait aussi la page de `capture-site`
(`https://www.axion-ia.com/…`) à la liste des hôtes du stockage → 400 « adresse refusée » à chaque tour « Source Axion ».
Maintenant (`studio-rendu/src/serveur.ts`, `adressesRefusees`) : pour `capture-site` seulement, `entrees.page` est
vérifiée par **sa propre liste, plus stricte** (`HOTES_CAPTURE` : axion-ia.com et www.axion-ia.com, via
`adresseAutorisee`, vérifiée aussi dans l'opération) et retirée du contrôle générique. Les hôtes permis ne sont
**pas** élargis : le site n'est ni lisible par `telecharger` ni cible de dépôt. Le dépôt (`sortie.urlDepot`) de la
capture reste vérifié comme partout.
Test : `relecture R45 (2e) B` — capture vers `https://www.axion-ia.com/avocats` avec dépôt R2 : **202** ; vers
`https://exemple.com/`, vers `127.0.0.1`, ou avec un dépôt hors stockage : **400** ; `www.axion-ia.com` reste refusé
pour l'analyse de média (en `media` comme en `page`). Rouge sur f9b586c : « expected 1 to be 0 ».

**Petit défaut D — fichiers .cube aux fins de ligne « \r » seules (anciens Mac).** Avant : tout le fichier devenait
une seule ligne, refusée comme « ligne trop longue » (sûr, mais message trompeur). Maintenant (`LecteurCube`,
`src/lib/lut3d.ts`, partagé par navigateur, studio et studio-rendu) : `\n`, `\r\n` et `\r` seul finissent une ligne ;
un `\r\n` coupé entre deux morceaux du flux compte pour une seule fin. Les positions de `\n` et `\r` ne sont
recherchées qu'une fois dépassées (temps linéaire, mêmes bornes de longueur qu'avant). Test : `relecture R45 (2e) D`
— même LUT lue avec `\n`, `\r`, `\r\n`, et `\r\n` coupé à chaque `\r`. Rouge sur f9b586c (« ligne beaucoup trop
longue ») et rouge aussi si l'on oublie le `\r\n` coupé (« trop de lignes vides »).

**Petit défaut C — non traité dans ce lot** : imposer `formatFichier` + `lectureLocale` à toutes les autres entrées
téléchargées (composition, assemblage, nettoyage audio, traitement d'image, mesure du son) touche une dizaine de
fichiers et la chaîne de la démo M4 ; ce n'est pas une petite correction. Il reste attendu avant la mise en
production de la composition réelle (voir « Restes connus » ci-dessus).

**Contrôles** : `npx tsc --noEmit` racine 0 erreur, studio-rendu 0 erreur ; `npx eslint .` 0 erreur ;
`npx vitest run` complet : **150 fichiers, 2 051 tests verts** (1 fichier et 2 tests sautés, comme avant).
