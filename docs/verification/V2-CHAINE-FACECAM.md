# Vérification V2 — chaîne face caméra de bout en bout (10/10/2026)

Vérificateur V2, branche `verif/v2-chaine-facecam` partie de `master` (85655d2), puis fusionnée avec `master`
(79aa203 : #13, #16, #17, #18, #21 arrivés pendant la vérification).

> **Après fusion avec master** : #18 (« contrôles qualité justes ») a corrigé EN PARALLÈLE deux des défauts trouvés
> ici, d'une autre façon : le contrôle de synchro compare désormais le son monté au son de la prise (plus de bouche),
> et `debruiter_afftdn` compense son retard. Leur version est gardée ; mes corrections de ces deux points (synchro
> calibrée sur la bouche, `debruiter_secours`) et leurs tests (`test_controles_synchro.py`, `test_son_secours.py`)
> sont retirés. Contrôle sur la vraie piste montée de la prise synthétique : la synchro de #18 donne **0 image**
> (corrélation 0,89). Les autres corrections restent. **Rien n'est fusionné ni déployé,
aucun serveur touché, aucun appel réel** (ni Claude, ni HeyGen, ni Higgsfield, ni R2) : un faux R2 local, le VRAI
`studio-aligneur` et le VRAI `studio-rendu` lancés sur le poste, la VRAIE `avancerChaine` du studio. Outils pour
rejouer : `outils/verification-v2/` (README).

## Synthèse

| # | Étape | Verdict | Corrigé ici |
|---|---|---|---|
| 1 | Réception iPhone (« J'ai déjà filmé ma vidéo » → `/envoyer` → `recevoirVideoFacecam` → `monterJeLis`) | OK | — |
| 2 | Sonde et préparation (rotation −90°, HLG → SDR BT.709, 29,97 → 25 i/s) | OK | — |
| 3 | Coupes (début / fin, blancs, « euh », consigne, reprise, reprise absorbée) | OK, **1 KO en aval** | transcription recalée livrée (le monteur perdait 12 mots d'IMG_7747) |
| 4 | Son (débruitage, chaîne voix, −14 LUFS / −1,5 dBTP) | **KO** (secours) | `afftdn` retardait le son de 25 ms |
| 5 | Visages, réalisation, cadrage, zooms 100 / 115 / 130 | **KO** | visage non suivi sur prise portrait → montage entier en échec |
| 6 | Passe image (anti-grain, lumière, bonne mine, BT.709 10 bits) | OK (1080 × 1920) / **KO mémoire en 4K portrait** | FFmpeg limité aux 2 fils du conteneur : 5,54 → 4,19 Go |
| 7 | Piste montée et contrôles machine | **KO** | contrôle de synchro : −2 images « bloquant » sur une vidéo synchrone ; −5 sur bouche immobile |
| 8 | Sous-titres (calage, jonction de l'écran partagé, doublons) | OK | — |
| 9 | Cartes automatiques (13 modèles, densité, placement, vide, débordement) | **KO** (3 défauts) | sur-titre recouvert (icône + mot) ; liste « icône, 2, 3 » ; sur-titre « Diagnostic fuite dure » |
| 10 | Composition finale et export (texte en 4:4:4 10 bits, export 8 bits, master 10 bits, VMAF) | OK (1 doublon de texte signalé) | — |
| 11 | Formats 4:5, 1:1, 16:9 | **KO** sur prise portrait | 100 = 115 = 130 % en 16:9 (sautes à chaque coupe) |
| 12 | Reprise après redémarrage de chaque conteneur ; priorité du 9:16 | **KO** | aligneur : 2 tours sans réponse = son perdu / passe perdue ; rendu : 1 tour sans réponse = vidéo sans sous-titres ni cartes ; les 18 cartes des formats passaient avant les 6 du 9:16 |
| 13 | Limites mémoire | **KO** en 4K portrait | voir 6 |

Douze défauts trouvés (dix corrigés ici, deux par #18 en parallèle), chacun prouvé d'abord (test rouge ou mesure réelle) ; TypeScript : `tests/v2-*.test.ts`, 3 fichiers, 19 tests ;
Python : `studio-aligneur/tests/test_cadrage.py`, 2 tests, vrai
FFmpeg. La mémoire 4K est prouvée par mesure (5,54 → 4,19 Go), pas par un test.

## 0. Moyens et limites de l'environnement

- **FFmpeg 8.1.1 introuvable ici** (proxy : johnvansickle et GitHub refusés). Utilisé : FFmpeg **7.0.2** statique
  (libvmaf, zscale, loudnorm, afftdn) — le binaire de `imageio-ffmpeg` —, et le 6.1.1 du système (flite, drawtext). Les
  contrôles réels du dépôt passent avec le 7.0.2 : `python -m aligneur.controle_ffmpeg` **16/16 OK** (HDR → SDR juste
  « à 3 sur 255 près », afftdn, loudnorm 2 passes, étiquettes BT.709…), `tsx src/controle-ffmpeg.ts` **21/21 OK**
  (exports 8 et 10 bits 2 passes et CRF, master face caméra 10 bits, note VMAF, relance unique sous 93). Le contrôle
  FFmpeg 8 reste celui de `deploiement/verifier-outils-video.sh` dans les images construites.
- **Whisper** : modèle sur huggingface.co, refusé (403). `/transcrire` est remplacé, dans le harnais seulement, par les
  mots connus de la prise synthétique (temps exacts par construction). Tout le reste de l'aligneur est réel.
- **DeepFilterNet** non installé (torch absent) : la route `/son` prend son **secours `afftdn`** — c'est ce chemin qui
  est vérifié (et corrigé, § 4). Le chemin DeepFilterNet n'a pas pu être exécuté.
- **MediaPipe 1.1.0** réel (modèles `face_landmarker` / `hand_landmarker` téléchargés), avec la `libEGL` du Chromium
  de l'environnement (absente du système ici ; présente dans l'image de prod).
- **Remotion** : téléchargement de Chrome Headless Shell 149 refusé ; rendu fait avec le Chromium Headless 141 de
  Playwright (même API), en rendu GPU logiciel (lent : 1 à 3 min par carte sur 4 cœurs partagés).
- Machine : 4 cœurs, 15 Go. Les conteneurs de prod ont `cpus: 2` et `mem_limit` 4500m (aligneur) / 3g (rendu).

## 1. Sources

**Prise synthétique « iPhone »** (`outils/verification-v2/sons.py`, `video.py`) : 68,54 s, **HEVC Main10 HLG BT.2020,
29,97 i/s, stockée 1920 × 1080 avec `rotation=-90`** (affichée 1080 × 1920, comme un iPhone tenu droit), AAC 48 kHz.
Visage réel (photo du dépôt), bouche animée par la voix, grain, **code-barres Gray 12 bits = numéro d'image source**
(lu ensuite sur chaque image montée). Voix de synthèse (filtre `flite`) à −24 dBFS RMS, souffle rose −50 dBFS,
ronflette 50 Hz −55 dBFS. Ligne de temps : pièce vide 0 → 4,0 s ; P1 ; P2 ; **consigne « Monteur, mets un zoom ici. »**
à 12,39 s ; P3 ; **« euh »** à 21,32 s ; P4 ; **reprise** « Un outil de plus ne règle rien, alors que » (29,07 s) puis
la phrase entière (32,98 s) ; P6 ; **blanc de 2,6 s** ; P7, « Un, … Deux, … Trois, … » ; P9 ; P10 ; fin à jeter 3,5 s.
Variante **4K portrait** (2160 × 3840, 4 s) pour la mémoire.

**Données réelles** : `tests/fixtures/img7747-v2-montage-reel.json` et `img7747-transcription-whisper.txt`.

## 2. Étape par étape

### 2.1 Réception — OK
`creerVersionFacecamDepuisTexte` (texte gardé tel quel, une phrase par segment, version validée sans Claude),
`vueEnvoiFacecam`, `recevoirVideoFacecam` (prise rangée sous la séance, demande écrite → consigne, `monterJeLis`
lancé ; serveur non relié → vidéo reçue, raison dite) : `tests/facecam-deja-filme.test.ts` vert (5 tests). L'écran
d'envoi lit `videoWidth` / `videoHeight` / `duration` ; une durée illisible (HEVC sur certains navigateurs) vaut 0 et
la chaîne prend celle de la transcription : sans effet.

### 2.2 Sonde et préparation — OK
`sonder` : 1080 × 1920 après rotation, `hlg`, son présent. Passe image et cadrage : **les 1199 images de la piste
montée portent le bon numéro d'image source** (écart −0,40 à +0,60 image à 29,97 i/s, aucune au-delà de 1,5 ; les
3 tranches de 30 s de la passe se recollent sans dérive). Couleurs : la prise HLG brute paraît délavée, la piste
montée a le bon contraste (planche d'images comparée à l'œil) ; étiquettes **BT.709 tv, yuv420p10le** sur toutes les pistes.

### 2.3 Coupes — OK (vraie chaîne, prise synthétique)
Mode texte, 0 phrase manquante, 10 passages gardés, 68,54 s → **47,96 s** :

| Coupe | Prise (s) | Attendu |
|---|---|---|
| début | 0 → 3,88 | parole à 4,00 : 3 images gardées avant |
| consigne « mets un zoom ici. » | 11,44 → 15,08 | consigne 12,39 → ~14,1, blancs d'1 s compris |
| hésitation « euh » | 21,00 → 22,04 | « euh » 21,32, P4 à 22,14 |
| reprise | 28,52 → 32,88 | 1re tentative 29,07, phrase entière 32,98 |
| 6 blancs raccourcis | dont 44,16 → 46,64 | blanc de 2,6 s |
| fin | 65,28 → 68,535 | dernier mot + 7 images |

Bornes toutes sur la grille des 25 i/s. **IMG_7747** (données réelles) : reprise absorbée retirée (101,04 → 110,72),
0 phrase manquante, 0 coupe dans un mot, 0 borne hors grille, 82,68 s, réalisation sans écart (aucun plan trop long,
écarts de taille ≥ 12 %, grammaire respectée).

**KO en aval (corrigé)** : les **recalages** de la reprise absorbée restaient dans l'état de la chaîne ; la vidéo
recevait la transcription BRUTE. Le monteur (demandes de Will après coup, `services/monteur-facecam.ts` →
`motsPourMonteur`) voyait alors « Quel que soit votre taille. Si vous sentez que du temps vous » (12 mots) comme
coupés et « échappe, » décalé : 300 mots vus au lieu de 312. Correction : la chaîne dépose
`transcription-recalee.json.gz` et la livre à la vidéo (`livraisonChaine`).

### 2.4 Son — KO sur le secours, corrigé
Résultat `/son` : **−14,0 LUFS, −1,5 dBTP, plage 1,5 LU, 47,96 s = durée des coupes**, ton de pièce sous les
raccords. Mesure par corrélation (fenêtre de 0,4 s au milieu de chaque passage gardé, son monté contre son
d'origine) : **−25 ms sur les 10 passages** (son en retard sur l'image, constant, aucune dérive). Cause isolée filtre
par filtre (salves de bruit) : `afftdn` **+25,00 ms** ; passe-haut, égaliseur, dé-esseur, compresseur, loudnorm
linéaire : 0. Correction (`son.debruiter_secours`) : le son débruité est recalé sur l'original par corrélation (FFT,
0 à 100 ms, refus sous r = 0,5). Après correction, chaîne réelle : **0 ms** (+0,1 à +6 ms sur les passages nets).
Le chemin DeepFilterNet (`enhance(pad=True)`) n'a pas pu être exécuté ici.

### 2.5 Visages, réalisation, cadrage — KO, corrigé
MediaPipe réel : visage trouvé 100 %, 20 plans 9:16 (100 / 115 / 130 %), coupes et punch-ins, cadres pairs dans la
prise. Les yeux tombent à 25-32 % (la photo est cadrée haut : une prise 9:16 ne laisse aucune marge à 100 %) ; c'est
le contrôle `yeuxHorsBande` qui le dit, pas un défaut.

**KO** : `/visages` en échec (premier passage réel : MediaPipe sans `libEGL`) → la chaîne calculait les plans pour une
source **supposée 3840 × 2160** ; cadre 1216 × 2160 dans une prise de 1080 × 1920 → FFmpeg « Nothing was written »,
**le montage entier échouait** (règle v4 n° 24 : visage raté = cadre centré, jamais d'échec). Corrections :
`/transcrire` rend `largeurSource` / `hauteurSource` (prise après rotation), `dimensionsSource(etat)` les utilise après
`/visages` ; et le cadrage ramène tout cadre dans l'image lue (`cadre_dans_image`). Vérifié en réel : vidéo livrée,
« 1 élément non fait — Le cadrage du visage ».

### 2.6 Passe image — OK en 1080 × 1920 ; mémoire KO en 4K portrait, corrigée
Bruit du visage 0,87 → 0,67 (`bruitRatio` 0,77 : jamais plus granuleux), teinte peau 49°, gains fixes. Le visage de
la photo est très clair (197 → 200, cible 100-140) : alerte « Visage trop clair » attendue (gain plancher 0,85).

**Mémoire** (pic du processus + FFmpeg enfants, `memoire.py`) : 1080 × 1920 ≈ 1,8 Go. **4K portrait 2160 × 3840 :
5,54 Go** (encodeur x264 2,6 Go, décodeur 1,6 Go, Python 1,0 Go) **> 4,5 Go** du conteneur → tué. FFmpeg prenait un fil
par cœur de l'HÔTE. Correction : décodage, filtres et encodage limités à `STUDIO_ALIGNEUR_FILS` (2, les CPU du
conteneur), anticipation x264 à 10 images (encodeur seul : 3,66 → 2,49 Go). **Pic 4K : 4,19 Go**, mêmes mesures d'image
au centième. Marge mince : voir « Restes ».

### 2.7 Piste montée et contrôles machine — KO, corrigé
Contrôles réels : 0 noir, 0 image figée, 0 image isolée, −14 LUFS, −1,5 dBTP. **`decalageSynchroImages` = −2 → alerte
BLOQUANTE « Son et image décalés de -2 image(s) »** alors que la synchro mesurée est exacte (code-barres + corrélation
du son). Cause : la piste « bouche » n'a qu'un échantillon toutes les 0,08 s et la bouche s'ouvre avant le son ; **sur
la prise d'origine, sans aucun montage, la même mesure donne déjà −2**. Second défaut : bouche immobile (ou son sans
relief) → toutes les corrélations nulles → `max` rendait la première clé, **−5** (vrai FFmpeg). Corrections
(`image.decalage_par_correlation`, `decalage_synchro`) : rien de mesurable → `None` ; et le contrôle **retranche le
décalage mesuré sur la prise d'origine** aux mêmes instants (la chaîne passe `prise` au cadrage, 9:16 et formats).
Sur la vraie piste : −2 sans référence, **0 calibré** ; un retard de 3 images introduit exprès est bien mesuré à 3.

### 2.8 Sous-titres — OK
IMG_7747 : 103 groupes de 1 à 4 mots, aucun chevauchement, aucun hors durée, aucun doublon (texte consécutif ou mot au
même instant), aucun trou de plus d'1 s ; orthographe du texte validé (« Certifexemple », « Un, où part »). Prise
synthétique : 127 mots montés (`source: texte`), dernier mot à 47,68 s pour 47,96 s. Position à la jonction pendant un
écran partagé : composition réelle regardée image par image à 2 ; 9,5 ; 16 ; 27 ; 36 ; 46,5 s — en plein cadre la
ligne est sous la bouche ; pendant les 6 écrans partagés elle est **exactement à la jonction** (50 %), le visage et la
bouche restent visibles en bas. **Doublon de texte (reste, décision produit)** : pendant la carte titre finale
« Réservez votre appel diagnostic gratuit », le sous-titre « Réservez votre appel » s'affiche en même temps ; même
chose, en partie, sur les listes (le point affiché est aussi sous-titré). Aucun groupe de sous-titres en double.

### 2.9 Cartes automatiques — 3 défauts, corrigés
IMG_7747 : 8 cartes, 5 modèles, aucune erreur de préparation, rendues pour de vrai (1080 × 960, 25 i/s). Entrée et
sortie : 3 à 5 images vides (0,12-0,2 s, l'animation du panneau) — pas un panneau vide.
- **Icône + mot** : sur-titre « Pas un problème de travail » sur 2 lignes en écran partagé ; la géométrie supposait une
  ligne → « Une fuite » posé SUR « DE TRAVAIL ». Correction : lignes du sur-titre mesurées (capitales espacées de
  0,16 em, à côté du trait) dans `geometrieIconeMot`.
- **Liste** non numérotée dont un seul point a une icône : pastilles « icône, 2, 3 » (on cherche le 1). Correction :
  point neutre pour les points sans icône.
- **Chiffre** : « Le diagnostic fuite dure 45 minutes… » donnait le sur-titre « Diagnostic fuite dure ». Correction
  (`cartes-auto.ts`) : le verbe qui mène au chiffre (dure, prend, coûte, demande, représente…) est retiré.
- Liste à 3 lignes : dernier panneau à 14 px de la jonction (tient).
- Prise synthétique : 6 cartes (liste, liste « Chez Axion-IA », problème → solution, chiffre « 45 min · gratuit · en
  visio », liste numérotée « 3 questions », titre d'appel final), toutes en moitié haute, sans chevauchement, une
  toutes les 6 s environ sur 48 s.
Rendu après correction (image fixe Remotion, mêmes paramètres réels) : sur-titre sur 2 lignes dégagé, « Une fuite »
dessous ; liste « icône, point, point ».

### 2.10 Composition finale et export — OK
Vraie composition `studio-rendu` (Remotion + FFmpeg 7.0.2), habillage repris après le redémarrage de studio-rendu :
6 cartes, 6 écrans partagés, sous-titres. **Sortie 9:16 : H.264 High 4.1, yuv420p, BT.709 tv, 1080 × 1920, 25 i/s,
47,96 s, 1199 images, faststart, AAC 48 kHz stéréo ; −14 LUFS, crête vraie −3,5 dBTP ; VMAF 98,59 (min 96,63, 5e
centile 97,44, seuil 93, aucune relance)**. Master sans texte : H.264 High 10, yuv420p10le, BT.709, PCM 24 bits. Le
texte est posé en YUV 4:4:4 10 bits puis descendu une seule fois en 4:2:0 8 bits (`grapheExport`, source 10 bits) —
graphe aussi exécuté par `controle-ffmpeg.ts` (21/21). Alertes : « Visage trop clair (200) » (la photo est très
claire : vrai), info « Niveau dans les pauses de −42 à −18 dB (attendu −48 à −35) » (une « pause » mesurée contient
de la voix ; information seulement). L'alerte « Son et image décalés de −2 image(s) » de ce passage vient du cadrage
fait AVANT la correction du § 2.7 ; refait avec le code corrigé (passage t-r) : 0, aucune alerte de synchro.

### 2.11 Formats 4:5, 1:1, 16:9 — KO sur prise portrait, corrigé
Vrai cadrage des 3 formats : 1080 × 1350, 1080 × 1080, 1920 × 1080, **47,96 s chacun**, 1199 images ; en 4:5 et 1:1
**chaque image porte le bon numéro source** (en 16:9 le code-barres sort du cadre). **KO** : sur une prise portrait, le
plancher d'agrandissement (1,16) écrasait les tailles : **16:9 : 100 = 115 = 130 % (992 × 558)** ; 4:5 et 1:1 : 6,5 %
puis 0 % d'écart → chaque coupe devient une saute (même cadre des deux côtés), contre la grammaire (≥ 12 %). Aussi en
16:9 depuis une 4K portrait (115 → 130 : 4,4 %). Correction : `hauteurDeTaille` garde ≥ 12,5 % entre tailles voisines
quand le plancher l'effacerait ; source 4K paysage inchangée (les 25 tests des formats restent verts).

### 2.12 Contrôles qualité — voir 2.7 et 2.10.

### 2.13 Reprise après redémarrage de chaque conteneur — KO, corrigé
- **studio-aligneur** : ses travaux vivent sur disque et reprennent au redémarrage (`TravauxFacecam`, vérifié). Mais
  côté studio, chaque tour sans réponse comptait comme un échec : nouvel identifiant (`-e1`, tout recalculé, la
  passe déjà faite par tranches perdue), et au **2e tour** (10 s en prod) le **son → vidéo en échec**, la **passe image →
  vidéo livrée sans retouche**. Correction : le client marque `injoignable` les pannes de transport ;
  `suiviApresLecture` / `suiviApresSoumission` (chaîne et formats) attendent sans consommer d'essai, même
  identifiant, **60 tours au plus (≈ 5 min)**, puis l'ancienne règle. Réel (tour de 5 s comme
  en prod) : aligneur **tué (`kill -9`) à 07:50:49 en pleine passe image**, 1re tranche de 30 s finie, relancé 30 s
  plus tard (6 tours sans réponse) → travail `t-r-passe` gardé (même identifiant, **0 essai consommé**), repris sur
  disque par l'aligneur, tranche déjà faite réutilisée ; chaîne finie à 07:58:44, **version complète, aucun saut**,
  1199/1199 images au bon numéro source, synchro calibrée 0, −14 LUFS. Avant la correction, le 2e tour sans réponse
  rendait la passe « non faite » (vidéo livrée sans retouche d'image).
- **studio-rendu** : la moindre `ErreurRendu` réessayable (redémarrage, 5xx, réseau) pendant les cartes ou la
  composition **abandonnait tout l'habillage** (vidéo sans sous-titres ni cartes) ; côté formats, l'erreur sortait
  même de la chaîne. Correction : `renduPassager` — on reprend au tour suivant (60 tours au plus), un échec définitif
  abandonne comme avant. Réel : studio-rendu **tué pendant le rendu des cartes** (`kill -9`, file perdue) → 4 tours
  de suite sans réponse (`renduInjoignable` 4), **habillage conservé, aucun saut** ; relancé, il reçoit à nouveau les
  6 cartes (`suivreRendu` resoumet un rendu inconnu) et la composition suit (§ 2.10). Un `studio-rendu` relancé
  nettoie aussi ses dossiers temporaires orphelins (vu en réel : « 4 dossier(s) … effacé(s) »).
- **studio** (Next) : l'état de la chaîne est enregistré à chaque tour et toute soumission est idempotente par
  identifiant ; un redémarrage du studio rejoue au pire un tour (vérifié par lecture du code, pas en réel).

### 2.14 Limites mémoire — voir 2.6.

## 3. Corrections (fichiers)

| Défaut | Fichiers | Tests (rouges d'abord) |
|---|---|---|
| Cadre hors prise portrait (visage non suivi) | `chaine.ts` (`dimensionsSource`), `declinaisons.ts`, `client.ts`, `transcrire.py`, `image.py` (`cadre_dans_image`) | `tests/v2-chaine-facecam.test.ts`, `test_cadrage.py` |
| Aligneur injoignable = essais perdus | `client.ts` (`injoignable`), `chaine.ts` (`suiviApres*`, `INJOIGNABLE_MAX`), `declinaisons.ts` | `v2-chaine-facecam` (redémarrage ; éteint pour de bon) |
| Rendu injoignable = habillage abandonné | `chaine.ts` (`renduPassager`), `declinaisons.ts` | `v2-chaine-facecam` |
| Transcription non recalée livrée | `chaine.ts` (`transcription-recalee.json.gz`) | `v2-chaine-facecam` (IMG_7747, 312 mots) |
| `afftdn` +25 ms | corrigé par #18 (`retard_afftdn`), version gardée à la fusion | tests de #18 |
| Synchro : −5 sur bouche immobile, −2 biais | corrigé par #18 (son monté contre son de la prise), version gardée à la fusion | `test_synchro.py` (#18), `v2-chaine-facecam` |
| Formats : tailles écrasées | `formats-facecam/cadrage.ts` (`hauteurDeTaille`) | `tests/v2-formats-portrait.test.ts` |
| Sur-titre recouvert ; liste « icône, 2, 3 » | `MotionIconeMot.tsx`, `MotionListe.tsx` | `tests/v2-cartes-geometrie.test.ts` |
| Sur-titre « Diagnostic fuite dure » | `habillage-facecam/cartes-auto.ts` | `tests/v2-cartes-geometrie.test.ts` |
| Cartes des formats devant celles du 9:16 | `chaine.ts` (`habiller`) | `v2-chaine-facecam` (ordre de la file) |
| Mémoire 4K | `media.py` (`FILS_FFMPEG`), `image.py` | mesure réelle (5,54 → 4,19 Go) |

## 4. Restes et recommandations

- **FFmpeg 8.1.1** n'a pas tourné ici (7.0.2 et 6.1.1). Les commandes changées (`-threads`, `-filter_threads`,
  `-x264-params rc-lookahead=10`) existent dans les trois versions ; `deploiement/verifier-outils-video.sh` les
  rejouera dans les images construites, comme prévu par `mettre-a-jour.sh`.
- **DeepFilterNet** (chemin normal du son) et **Whisper** (`/transcrire`) n'ont pas pu être exécutés (torch et modèles
  injoignables). À mesurer en prod une fois : le retard éventuel de DeepFilterNet (`retard()` de `son.py` le donne en
  une ligne) — s'il n'est pas nul, le même recalage s'applique.
- **Mémoire 4K portrait** : 4,19 Go pour 4,5 Go de limite, marge mince (Python 1,1 Go à lui seul en 2160 × 3840).
  Recommandé : `mem_limit: 5500m` pour `studio-aligneur` (le serveur a 15 Go), décision d'exploitation laissée à la
  session studio. L'étape « cadrage » n'a pas été mesurée en 4K (elle encode du 1080 × 1920).
- **16:9 tiré d'une prise portrait** : la fenêtre fait 992 × 558 px sur une prise 1080 × 1920 (agrandie ×1,9 à ×2,4),
  tête serrée, image moins nette. Rien ne le signale à Will : proposer une alerte « format tiré d'une vidéo verticale »
  ou ne pas proposer le 16:9 dans ce cas.
- **Yeux à 25-32 %** en 9:16 sur une prise déjà 9:16 cadrée haut : à 100 %, aucune marge pour recadrer ; le contrôle
  le dit (`yeuxHorsBande`). Rien à corriger dans le code.
- **Contrôle de synchro** : la piste « bouche » n'a que 12,5 échantillons par seconde ; le seuil « > 1 image » reste à
  la limite de la précision. Calibré sur la prise, il ne voit plus que l'écart dû au montage ; à surveiller sur de
  vraies vidéos.
- **Attente d'un conteneur injoignable** : 60 lectures (≈ 5 min à un tour toutes les 5 s). Si le redémarrage de
  `studio-aligneur` (chargement des modèles) dépassait 5 min, l'ancienne règle reprend (2 essais).
- **Rendu des cartes** ici : 1 à 6 min par carte (Chromium 141 en GPU logiciel, 4 cœurs partagés avec l'aligneur) ;
  non représentatif de la prod, mais montre que 18 cartes de formats devant le 9:16 coûtaient cher (corrigé).
- **Doublon carte / sous-titres** (décision produit, non changée) : quand une carte affiche la phrase dite (titre
  d'appel final, points de liste), le sous-titre la répète en même temps. Proposition : masquer les sous-titres
  pendant une carte « titre » dont le texte couvre les mots dits (règle à valider par Will).
- Non vérifié ici : Décor IA, effets réalistes payants, multicaméra, relecture Claude (options payantes ou coupées par
  défaut, hors de la chaîne iPhone de base).

## 5. Vérifications

- **Après fusion avec master (79aa203)** : Vitest complet (délai 30 s) **288 fichiers, 3548 tests verts**, 3 ignorés ;
  Python 58 verts ; `controle_ffmpeg` 16/16 ; `tsc` (studio et studio-rendu) et `eslint` : 0 erreur.

- **Vitest, suite complète** (avec les corrections) : 284 fichiers, **3455 tests verts**, 3 ignorés, **4 en dépassement de
  délai** (5 s) dans `e2e-verif1-bc-serie`, `garde-ecran`, `google-drive-import` : machine chargée (aligneur et
  Remotion en parallèle) ; relancés avec `--testTimeout=60000` : **34/34 verts**. `e2e-verif1-bc-serie` et
  `garde-ecran` dépassaient déjà le délai sur `master` avant toute modification (suite de référence : 3438 verts,
  2 en dépassement).
- Ciblés facecam (`tests/facecam-*`, `v-coherence-facecam`, `z-integration-facecam`, `h-facecam*`, `tests/v2-*`,
  briques coupes / habillage / formats / réalisation / motion, moteur facecam) : verts.
- `tests/v2-*.test.ts` : 19 tests (chaîne, reprise des conteneurs, synchro, IMG_7747, priorité, formats portrait,
  cartes), tous rouges avant leur correction.
- **Python** `studio-aligneur` après fusion : **58 tests verts** (dont `test_cadrage.py` ; tests de #18 compris).
- `python -m aligneur.controle_ffmpeg` avec le code modifié : 16/16 (FFmpeg 7.0.2 et 6.1.1).
  `studio-rendu/src/controle-ffmpeg.ts` : 21/21 (7.0.2).
- `next typegen` + `tsc --noEmit` (état final) : 0 erreur ; `tsc` de `studio-rendu` : 0 erreur ; `eslint` sur les fichiers
  touchés et `outils/verification-v2` : 0 erreur, 0 avertissement.
- Chaînes réelles : t-b (visage non suivi), t-c / t-d (complète + formats + habillage, studio-rendu tué en route),
  t-r (aligneur tué en route), mesure mémoire 4K avant / après.
