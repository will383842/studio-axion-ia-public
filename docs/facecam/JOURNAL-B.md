# Journal du lot B « Chaîne vidéo » — 09/10/2026 (session cloud, branche `feat/facecam-b`)

Référence : `PLAN-FACECAM-v4.md` (§ D lot B, B.5 à B.9, B.15 à B.20, B.24, correctifs de fin), détails dans
`PLAN-IMPLEMENTATION-FACECAM.md` (L2 à L5, L7). Branche créée depuis `origin/feat/facecam` (lot A), qui y a été
refusionnée trois fois (lots A, D, E1, E2 et la planche motion). Rien n'est fusionné dans master, aucune PR, aucun
déploiement, aucun serveur touché.

## Ce qui est fait

### 1. Brique `src/briques/coupes/` (PURE, testée)
- `consignes.ts` : seule une phrase qui COMMENCE par « Monteur » est une consigne (premier mot, après un point ou après
  un blanc ≥ 0,5 s) ; elle va jusqu'au point final ou jusqu'au premier blanc ≥ 0,8 s (40 mots, 15 s au plus).
  Repérées AVANT les coupes, y compris dans le début et la fin jetés ; `versConsignesFacecam` les rend au format
  `ConsigneFacecam` (état « comprise », comme l'attend l'agent monteur du lot D).
- `texte.ts` : formes comparables (reprend `normaliser` de l'avocat), phrases du texte, « euh », mots inachevés,
  toutes les occurrences d'une phrase (une occurrence abandonnée en route est une reprise), tolérance aux fautes de
  Whisper sur les noms (distance d'édition ≤ 25 % sur les mots de 5 lettres et plus).
- `index.ts` (`calculerCoupes`) :
  - texte validé : la DERNIÈRE occurrence complète de chaque phrase, choisie à rebours (chaque phrase finit avant le
    départ de la suivante) ; tout ce qui précède la première phrase = `debut`, tout ce qui suit la dernière = `fin`,
    le reste = `reprise` ; moins de 60 % des phrases retrouvées → bascule en vidéo libre (`texteNonRetrouve`) ;
  - vidéo libre : bavardage d'installation (« c'est bon, ça tourne ? ») et de fin (« voilà »), début de phrase
    répété, « pardon, je recommence » (la phrase abandonnée part avec), marqueur au milieu d'une phrase ;
  - hésitations : « euh », mots inachevés, bégaiements (« le le », « il faut il faut ») ;
  - blancs > 0,25 s ramenés à 0,10 s (dans une phrase) ou 0,15 s (entre deux phrases) ; chute de 0,35-0,6 s gardée
    avant une phrase forte, 2 au plus (choisies ailleurs, sinon notées : « ! », chiffre, « Mais… », phrase courte) ;
  - jamais de coupe dans un mot ; bornes calées sur les images (25 i/s) ; 3 images gardées avant le premier mot,
    7 après le dernier (v4 n° 23) ; une zone retirée est découpée par nature (une consigne dans le début jeté reste une
    coupe `consigne` à part : rétablir le début ne rend jamais la consigne audible) ;
  - outils : `gardesApres` (rétablir = assemblage seul), `versMontage` / `versPrise`, `motsDuMontage`,
    `resumeCoupes` (« 3 passages retirés, 2:11 devient 1:34 »), `controlerCoupes` (phrases manquantes, consignes
    audibles, coupe dans un mot).
- **Cas F0 testé** : début 0 → 15,1 s, reprise 101,8 → 111,2 s (dernier essai gardé), fin 118,3 → 130,7 s, aucune
  phrase manquante ni doublée, « 3 passages retirés, 2:11 devient 1:3x ».

### 2. Brique `src/briques/realisation/` (PURE, testée)
- `grammaire.ts` : constante `GRAMMAIRE_MONTAGE` (v4 n° 19 : ≥ 90 % de coupes franches, punch-in instantané, 2 zooms
  flous au plus, entrée d'écran partagé 8-10 images et courbe unique, jamais de fondu sur le visage, zoom lent ≤ 3 %/s,
  écart de taille ≥ 12 %, même cadre 1 fois sur 4 si la tête bouge < 3 %) et `verifierGrammaire` (utilisable par les
  cartes du lot C et l'agent du lot D).
- `piste.ts` : format de la piste du visage (json.gz de `/visages`), écrit à l'identique côté Python.
- `index.ts` (`realiser`) : cadre FIXE par plan (médiane du visage), zone morte de 3 %, yeux à 34 % (bande 30-38 %),
  tailles 100 / 115 / 130 % (115 % au plus si grain fort), chaque coupe change la taille d'au moins 12 %, punch-ins au
  début d'un mot important (`enValeur`, nombre, mot plein long) pour un changement toutes les 2-3 s (Équilibré),
  jamais plus de 6 s ; Sobre et Très dynamique prévus. `controlerRealisation` : plans trop longs, écarts de taille,
  yeux hors bande, grammaire.

### 3. `studio-aligneur` : routes réelles (Python)
- `media.py` : sonde (rotation, HDR, son), préparation (HLG/PQ → SDR BT.709 `zscale` + tonemap `hable`, 25 i/s),
  lecture d'images en flux par FFmpeg (jamais toute la vidéo en mémoire), tranches de 30 s, dépôts R2 par adresse
  signée en flux, json.gz, `ErreurTravail` typée (rendue telle quelle par `TravauxFacecam`).
- `/transcrire` (`transcrire.py`) : faster-whisper `small` int8, VAD (les longs silences font halluciner Whisper),
  glossaire en `initial_prompt` ET `hotwords` ; le texte validé n'est PAS donné à Whisper (il masquerait les reprises).
  Mots inline dans le résultat (≤ 6 000), json.gz complet sur R2.
- `/visages` (`visages.py`) : MediaPipe FaceLandmarker (1 image sur 2) et HandLandmarker (1 sur 6), en mode vidéo,
  sur la BANDE utile (le visage est trop petit pour le détecteur sur l'image 16:9 entière ; la bande est centrée sur
  le visage repéré d'abord sur 5 images entières), lissage aller-retour, trous interpolés, tranches gardées sur disque
  (reprise). Dépôts : `piste` (légère, lue par le studio) et `points` (≈ 130 points utiles aux masques, lus par
  `/image`).
- `/son` (`son.py`) : DeepFilterNet 3 mélangé à 85 % (secours `afftdn`, jamais d'échec pour ça), montage sur les
  passages gardés avec fondu de 15 ms à CHAQUE coupe et ton de pièce continu (les 3 s de pièce vide, sinon la seconde
  la plus calme), fondu final de 50 ms, chaîne voix (passe-haut 80 Hz, présence +2,5 dB à 4 kHz, dé-esseur,
  compression douce), `loudnorm` en deux passes −14 LUFS / −1,5 dBTP / LRA 4 ; mesures `ebur128`.
- `/image` (`image.py`), deux étapes :
  - « passe » : UNE passe Python sur la bande utile, dans le temps de la prise : anti-grain temporel adaptatif AVANT
    tout éclaircissement (renforcé dans la boîte du visage), lumière virtuelle douce + fond assombri de 12 % (ovale très
    doux, aucun détourage), gain global FIXE (pas de pompage, plafonné à 1,3), bonne mine (lissage qui garde 75 % du
    grain, teint, cernes, effet réduit du côté déjà éclairé), yeux seule netteté, dents seulement bouche ouverte avec
    fondu sur 3 images et plafond = blanc des yeux, couleurs mesurées UNE fois sur la peau et le mur (mur coloré
    respecté), cible Look Will (Lab) si fournie, LUT du format à son intensité, x264 10 bits crf 8 (une image clé par
    seconde). Mesures rendues : luminance et bruit du visage avant / après, teinte de la peau, ΔE00 avec la référence.
  - « cadrage » : chaque plan de la réalisation découpé, recadré, mis à 1080×1920 (lanczos), bout à bout sur le temps
    du montage (aucune dérive avec le son), son monté en PCM 24 bits → piste montée 10 bits PRÉ-CADRÉE (pour
    `sourcePreCadree` du lot C), vignette, contrôles machine : `blackdetect`, `freezedetect`, image isolée (< 3 images),
    `ebur128`, synchro son-image (corrélation ouverture de la bouche / énergie de la voix, en images). Option `preparer`
    : secours qui recadre la prise directement si la passe image a échoué.
- `__main__.py` : exécutants branchés (`/segmenter` reste en 501 pour le lot D) ; `--precharger` télécharge aussi
  Whisper, MediaPipe et DeepFilterNet à la construction de l'image.

### 4. Moteur `montage-facecam` : la chaîne réelle
- `chaine.ts` : machine à états avancée à chaque tour de la boucle de fond (aucune attente longue). Ordre :
  transcription + visages → consignes puis coupes → son monté → réalisation → passe image (Look Will) → piste montée
  pré-cadrée + contrôles → mots montés (texte validé horodaté par la transcription, puis calé sur le son monté par
  l'aligneur existant `/alignements`, déposé en json.gz). L'état ne garde que des clés, des identifiants et de petits
  résultats (coupes, plans) ; tous les résultats sont rangés sous `facecam/<vidéo>/<version>/` : la prise d'origine
  n'est que LUE.
- Règle de panne : transcription ratée → aucune coupe ; visages ratés → cadre centré ; passe image ratée → la prise
  est recadrée telle quelle ; chaque saut donne « 1 élément non fait — … ». Son ou montage final ratés → échec
  RÉESSAYABLE (une vidéo sans son n'est pas livrable) ; « Réessayer » repart de l'étape ratée, le reste est gardé.
  Un travail inconnu du conteneur (redémarrage) est soumis à nouveau (2 essais).
- `etapes-chaine.ts` : les étapes du lot A suivent la chaîne (Le son, Les coupes, L'image, Le montage…) ; résultat
  9:16 1080×1920, alertes des contrôles (noir, image figée, image isolée, niveau, synchro, visage plus granuleux que
  l'original, visage trop sombre ou trop clair, ΔE ≥ 4, teinte hors tons chair, phrase manquante, consigne audible),
  `projetMontage` léger (clés R2, coupes, plans, sauts, `motsMontesCle`). Aucun prix (lignes à 0).
- `dependances.ts` : le réel n'est pris QUE si la commande le demande (`entrees.facecamAligneurReel === true`) ET que
  `STUDIO_ALIGNEUR_URL` existe ; stockage R2 signé (lecture 24 h, dépôt 6 h), lecture / écriture json.gz.
  Aucune variable d'environnement nouvelle.
- `glossaire.ts` : glossaire maison (Axion-IA, Certifexemple, OPCO…), à compléter.

## Fichiers communs touchés (ajouts facultatifs)
- `src/moteurs/montage-facecam/index.ts` (lot A) : dépendance facultative `chaine` ; `refusAuLancement` ne refuse plus
  quand la chaîne réelle est demandée ; `lancer` / `avancer` / `reessayer` passent par la chaîne seulement si elle
  est là. Sans elle : squelette du lot A inchangé (ses 26 tests restent verts).
- `studio-aligneur/aligneur/facecam.py` (lot A) : une `ErreurTravail` est rendue avec son code et son message.
- `studio-aligneur/aligneur/__main__.py`, `studio-aligneur/requirements.txt` (+ `requirements-sans-dependances.txt`).
- `deploiement/studio-aligneur/Dockerfile` : bibliothèques EGL/GLES (exigées par MediaPipe), second `pip --no-deps`,
  cache des modèles dans l'image (`XDG_CACHE_HOME`).
- `deploiement/docker-compose.yml` : `mem_limit` de `studio-aligneur` 2500m → 3500m (v4 n° 6). Rien d'autre.
  (09/10 : porté à 4500m, pic mesuré en production 3,23 Go sur 3,42 Go ; voir docs/JOURNAL-FFMPEG-RECENT.md. 10/10 :
  6000m, la passe « formats » a atteint 4,40 Go ; voir docs/facecam/JOURNAL-FICHE-CARTES-FORMATS.md.)
- Non touchés : `studio-rendu` (aucune opération, aucune file, aucun contrat), types du domaine, formats,
  `moteurs/index.ts`, client TS `fournisseurs/facecam`, habillage, interface.

## Tests
- `src/briques/coupes/coupes.test.ts` (11) : cas F0, dernier essai gardé, blancs, résumé, original jamais modifié
  (prise figée, tout se rétablit), temps montage ↔ prise, consignes « Monteur » (dans le début jeté, jamais audibles),
  hésitations et chute, vidéo libre, texte non retrouvé.
- `src/briques/realisation/realisation.test.ts` (7) : rythme Équilibré (≤ 6 s), écart ≥ 12 % à chaque coupe, 3 tailles,
  punch-ins au début des mots, yeux 30-38 %, grain fort, Sobre, grammaire.
- `tests/facecam-chaine.test.ts` (7) : ordre de la chaîne, original jamais modifié (la prise n'est que lue), règle de
  panne (visages + passe image), son en panne → réessayable, moteur de bout en bout sans prix, calage des mots montés,
  réel jamais pris par défaut.
- `tsc --noEmit` propre hors `studio-rendu/` (dépendances Remotion absentes du cloud ; `next typegen` lancé avant).
- Suite Vitest complète : voir le résultat en bas de ce journal.
- Python (sans test ajouté, v4 « Tests gardés ») : essais manuels en cloud sur des extraits 4K de synthèse :
  `/son` (secours afftdn, −14,0 LUFS), `/image` passe + cadrage (10 bits, 1080×1920, contrôles), `/visages` sur un
  visage réel (image publique d'OpenCV) centré et décentré : 100 % des images, 3,4 s pour 4 s de vidéo. Les tests
  Python existants restent verts (19).

## Ce qui reste
- **Activer le réel** : dans `construireCommande` (service, lot D/E), recopier un réglage caché (par exemple
  `facecam.aligneur.reel`) dans `entrees.facecamAligneurReel` ; activer le profil `calage` et `STUDIO_ALIGNEUR_URL`
  en prod (non vérifié : aucun serveur touché). Le lancement réel est alors permis.
- **Persister les données** : `projetMontage.facecam` (clés R2, `coupes.auto`, consignes) est à recopier dans
  `Video.entrees.facecam` par le service à la fin du travail (le moteur est pur) ; `projetMontage.motsMontesCle` pour
  les sous-titres.
- **Lot C** : composer la piste montée (`projetMontage.montageCle`, 10 bits, pré-cadrée, son PCM) avec
  `sourcePreCadree` + `source10bits`, sous-titres depuis `motsMontesCle` ; d'ici là les étapes « Les sous-titres et
  cartes » et « La vidéo finale » passent avec le montage et la sortie est la piste montée. Contrôle « sous-titres
  alignés sur les coupes » : lot C.
- **Lot D** : appeler `monteurPourFabrication` après les coupes (consignes de `projetMontage.facecam.consignes`,
  mots montés) ; `retoucher()` réelle : rétablir une coupe = refaire seulement `/son` et l'étape « cadrage » (la passe
  image est dans le temps de la prise : réutilisable telle quelle), un cran d'image = refaire la passe et le cadrage.
  Aujourd'hui une retouche relance un squelette.
- **Lot E1** (décor IA) : insérer `passeDecorFacecam` après la passe image, avant le cadrage.
- **Essai réel** sur IMG_7747 : temps de calcul, mémoire de pointe, bruit du visage, ΔE, réglages fins (seuils des
  coupes, force de la lumière, du lissage, des dents).

## Points d'attention pour l'intégration
- **Non essayés en cloud** (proxy : pytorch.org et Hugging Face bloqués) : DeepFilterNet (installé `--no-deps` car il
  déclare numpy < 2 ; repli `afftdn` automatique s'il ne charge pas) et faster-whisper (modèle `small` téléchargé à la
  construction). À vérifier au premier `docker build` : `python -m aligneur --precharger` doit afficher les 4 lignes
  « prêt ».
- MediaPipe 1.1 (le 0.10.21 interdisait numpy 2) exige `libEGL.so.1` : ajouté au Dockerfile. OpenCV épinglé en 4.11
  (MediaPipe tirerait la 5). `requests` ajouté (faster-whisper l'importe, huggingface_hub 1.x ne l'amène plus).
- **Temps de calcul** : passe image ≈ 0,36 s par image en 1640×2160 sur 4 cœurs du cloud → ≈ 18 min pour 2 min de
  vidéo, au-dessus de l'objectif de 15 min. Pistes : demi-définition pour l'anti-grain hors visage, float16, ou
  bande plus étroite (union réelle des cadres, déjà utilisée par la chaîne).
- **Un travail lourd à la fois** côté face caméra, mais le calage des sous-titres (`/alignements`) a son propre fil :
  le calage des mots montés peut tourner pendant une passe image (court, mais à surveiller avec `docker stats`).
- **Disque** : tranches et intermédiaires sur `/tmp` du conteneur (≈ 2 à 4 Go pour 2 min en 10 bits crf 8) ;
  dossiers vidés dès le résultat déposé. Un dépôt R2 en un seul PUT est limité à 5 Go : au-delà de ≈ 4 min de vidéo,
  il faudra un dépôt par morceaux pour l'intermédiaire 10 bits.
- `ResultatsFacecam` (client du lot A) ne décrit que les champs de base : la chaîne lit les champs en plus (bande,
  mesures, contrôles, vignette, mots) par des types locaux, sans modifier le client.
- Codes d'alerte : `image-noire`, `defaut-visuel`, `niveau-sonore`, `synchronisation`, `export` (aucun code ajouté).
- La balance des blancs du mur ne s'applique qu'à un mur peu coloré (chroma ≤ 10 plein effet, ≥ 20 aucun) : un mur
  orange reste orange.

## Résultat de la suite Vitest complète (branche `feat/facecam-b`, après fusion de `feat/facecam` à 1ab4e81)
- 3 028 réussis, 5 fichiers en échec, **aucun dans un fichier du lot B** :
  - `g7a-programmer` : déjà rouge avant le lot A (journal du lot A) ;
  - `e2e-verif1-bc-serie` (2) : dépassements de 5 s sous la charge de la suite complète (comme au lot A) ;
  - `c1-argent-b6-confirmation` : `confirme: true` dans `src/services/envoi-facecam.ts` (lot D) ;
  - `e2e1-secu-variables` : `GOOGLE_DRIVE_ESSAI`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL` non transmises par le
    compose (lots E1 / E2) ;
  - `garde-ecran` : `SelecteurDrive.tsx:163` (lot E2) et `decor-ia.ts:122` (lot E1) ;
  - `garde-regle-unique` : constantes recopiées dans `google-drive/*` et `higgsfield/client.ts` (lots E1 / E2).
  À corriger par leurs lots ou à l'intégration (lot E « Fin »).
