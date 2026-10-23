# Journal du lot I « Effets spéciaux branchés dans la chaîne » — 09/10/2026 (session cloud, branche `feat/facecam-i`)

Référence : `JOURNAL-F3.md` (§ « Reste » et « Points d'attention »), `JOURNAL-E.md` (raccords de la chaîne), `JOURNAL-C.md` (habillage, cartes plein écran). Branche créée depuis `origin/feat/facecam` (refusionnée régulièrement). Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché, aucune dépense (aucun appel Claude, HeyGen ni Higgsfield ; rendus locaux et doubles de simulation).

## 1. Planche des effets (livrée en premier)
- `docs/facecam/planche-effets/index.html` + 6 MP4 de 5 s (1080 × 1920, 25 i/s, H.264, < 3 Mo chacun) : logo 3D dans la main, téléphone 3D, vitre → plan suivant (avec bruitage), vitre → carte « Le temps perdu », écran qui se plie, zoom à travers l'écran.
- Rendu local (`cd studio-rendu && npm ci && npx tsx scripts/planche-effets.ts`), Chromium sans affichage + WebGL logiciel.
- Deux corrections pour y arriver :
  - `wavMono16` (brique `son-verre.ts`) n'écrivait pas l'en-tête du bloc `data` : FFmpeg refusait le WAV (planche bloquée sur la vitre ; le bruitage aurait aussi été illisible en production). Corrigé + testé.
  - `planche-effets.ts` : délai par image porté à 180 s (la vitre qui révèle la carte dépassait 30 s par image sur 4 cœurs chargés).
- Contrôle visuel (images extraites et relues, toutes les vidéos) : visage jamais caché ; logo et téléphone posés dans la paume (le téléphone reste sous le menton) ; vitre : fissures fines sur l'image figée, éclats qui tombent et dégagent le visage révélé (un éclat fin passe sur la joue pendant 2-3 images, sans le cacher) ; carte « Le temps perdu » lisible ; zoom traversant net. **Point à juger par Will** : le pli de l'écran est discret (fond sombre, pli peu contrasté).
- Tailles : 0,47 à 2,58 Mo (une seule passe à CRF 22 suffit, aucune ne dépasse 3 Mo).

## 2. Effets branchés dans `habiller()` (`chaine.ts`, ajouts commentés « Lot I »)
- Nouveau fichier `src/moteurs/montage-facecam/effets-chaine.ts` (toute la logique ; `chaine.ts` ne gagne que des appels).
- Le monteur (dépendance `monteur`) rend en plus ses `passages` (facultatif) ; la chaîne garde les seuls passages d'effets (`etat.monteur.effets`). Branchement réel : `facecam-branchements.ts` renvoie `resultat.etat.facecam.passages`.
- Après les cartes : `preparerEffetsFacecam` avec la piste `/visages` (relue sur R2), les coupes actives (complément des passages gardés), le cadre de chaque plan (`plan.cadre` ÷ taille de la source, selon l'instant monté), les raccords `coupesSec`, la lumière (§ 6).
- Chaque effet = une demande `composition` SANS mode (opération existante). Les références `entree:piste` / `entree:carte` sont remplacées par les adresses signées par la chaîne : l'opération sans mode de `studio-rendu` ne les remplace pas (elle ajoute les entrées à plat) — sans ce remplacement, l'effet n'aurait pas trouvé sa vidéo.
- Vitre qui révèle une carte : la carte titre est rendue d'abord (suivie avec les autres cartes de l'habillage) ; l'effet attend qu'elle soit faite.
- `cartesPleinEcranEffets` : les MP4 d'effets s'ajoutent aux `cartesPleinEcran` (coupe franche, son de la piste dessous).
- Effet raté : main introuvable → aucun rendu, passage marqué `sansDetourage` + `echecsEffet` ; rendu en panne (après un nouvel essai si réessayable) ou carte révélée ratée → effet retiré de la composition (plan et bruitage). Dans les deux cas : « 1 élément non fait — Un effet spécial ».
- Drapeaux recopiés dans `entrees.facecam` : `livraisonChaine().facecam.passages` (effets seulement) ; `entreesAvecLivraison` remplace les passages de même identifiant (rien n'est ajouté ni retiré).
- Sans effet demandé : chaîne strictement inchangée (testé).
- Déclinaisons 4:5 / 1:1 / 16:9 (lot F1) : les effets n'y sont PAS posés (rendus en 1080 × 1920 sur la piste 9:16) — à faire si Will le demande.

## 3. Look en double — corrigé
- Constat : `poserCartesPleinEcran` posait les cartes en plans d'illustration, donc `plagesLookBroll` leur appliquait la LUT du Look : **les cartes de motion recevaient le Look** (charte faussée) et les effets l'auraient reçu deux fois.
- Correction : drapeau facultatif `sansLook` sur `PlanScene` (ajout pur), posé par `poserCartesPleinEcran` (cartes ET effets), filtré par `plagesLookBroll`. Un vrai B-roll garde le Look (testé).

## 4. Qualité
- Le contrat de l'opération `composition` sans mode n'avait aucun réglage de qualité. Ajout FACULTATIF dans `studio-rendu/src/operations/composition.ts` : `parametres.crf` (0-51, + espace bt709) ; absent → réglages par défaut, comme avant. La chaîne demande `crf: 10` (`CRF_EFFETS`).
- ⚠️ Prend effet au prochain déploiement de `studio-rendu` (non fait, consigne) ; d'ici là, le paramètre est ignoré.

## 5. Bruitage de verre
- `outils/bruitages/fabriquer.mts` fabrique aussi `public/bruitages/verre-1.wav` (synthèse de la brique, ramenée à 0,4 s : le mixage ne pose pas plus long ; niveau actif −20 dBFS, crête −3) + entrée au manifeste. Les 20 autres sons sont restés identiques à l'octet.
- Posé à `monteeSec` (début de la vitre) à −21 dB sous la voix (`GAIN_SOUS_VOIX_DB`, discret), seulement si la consigne le veut (`bruitage: true`). La composition reçoit le média `bruit-verre-1` (`/bruitages/verre-1.wav`) ajouté à la commande.
- Pas ajouté à la Bibliothèque (`src/donnees/bruitages.ts`) : il n'est jamais posé par le chef d'orchestre, seulement par l'effet demandé.

## 6. Lumière
- `estimerLumiere` branchée sur l'image de contrôle du début (vignette de la piste montée, 0,5 s), zone du visage d'après la piste ; repli `luminanceVisage` (dans la brique) si l'image ou le visage manque.
- Décodage : nouvelle dépendance facultative `lireImageRvb` ; branchement réel par FFmpeg (270 × 480). ⚠️ Le conteneur de l'application n'embarque pas FFmpeg aujourd'hui : en production, c'est donc le repli qui jouera tant que FFmpeg n'y est pas (ou qu'une route du `studio-aligneur` ne rend pas l'image en RVB).

## 7. Contrôle
- Une image au milieu de chaque effet, rendue par l'opération `image-fixe` EXISTANTE (même composition, mêmes propriétés), déposée à `…/effets/<passage>-controle.png`, jamais bloquante.
- Passée à la relecture Claude (`relire`, contexte `imagesEffets`), légende « le visage doit rester visible » (défaut `visage-cache` déjà au rôle de relecture).

## Fichiers communs touchés (ajouts minimaux, commentés « Lot I »)
`chaine.ts`, `dependances.ts`, `index.ts`, `raccords.ts` (moteur facecam) ; `services/facecam-branchements.ts` ; `briques/composition/scene.ts` (`sansLook`) ; `briques/motion/pose.ts` ; `briques/habillage-facecam/broll.ts` ; `briques/effets-speciaux/son-verre.ts` (correction WAV) ; `studio-rendu/src/operations/composition.ts` (`crf` facultatif) ; `studio-rendu/scripts/planche-effets.ts` (délai) ; `outils/bruitages/fabriquer.mts` + `public/bruitages/` ; `deploiement/studio-rendu/Dockerfile` (une ligne : copie de `src/briques/effets-speciaux`, importée par les compositions d'effets mais jamais copiée dans l'image — en production, `studio-rendu` n'aurait pas démarré avec les compositions d'effets ; le test `final-b-image-rendu-fichiers` était rouge sur `feat/facecam` pour cette raison).

## Tests
- `tests/facecam-effets-chaine.test.ts` (9 tests) : effets rendus dans la chaîne simulée (composition sans mode, CRF, adresses signées, carte révélée avant la vitre, image de contrôle, MP4 posés, verre mixé) ; effet raté retiré + « 1 élément non fait » ; main introuvable → drapeau recopié dans `entrees.facecam`, main trouvée → rendu avec la lumière de la vignette ; sans effet, chaîne inchangée ; pas de Look en double (effets et cartes) ; utilitaires ; WAV et banque.
- tsc : rien de nouveau (4 erreurs `RouteContext` / `LayoutProps` déjà présentes : types générés par `next typegen`) ; tsc de `studio-rendu` (après `npm ci`) propre ; eslint propre sur les fichiers touchés.
- Vitest ciblés (`tests/facecam-*`, `d1-bruitages`, `final-b-image-rendu-fichiers`) : verts sauf 1 échec déjà présent sur `origin/feat/facecam`.
- Vitest complet : 3139 réussis, 4 échecs, dont aucun n'est dû au lot I :
  - `facecam-effets-speciaux` « catalogue » : l'entrée « Fais cette animation en spectaculaire » (lot C2) se glisse dans les 8 premiers exemples ; le test F3 compare à `CATALOGUE_MONTEUR.slice(0, 8)`. Déjà rouge sur `feat/facecam`, pas touché (lots en parallèle).
  - `garde-regle-unique` : `ESSAIS_MAX = 2` défini dans `chaine.ts` et `declinaisons.ts` (lot F1). Déjà rouge, pas touché (`chaine.ts` est aussi modifié par le lot G).
  - `e2e-verif1-bc-serie` : échec de délai sous charge (rendu en parallèle) ; vert lancé seul.
  - `final-b-image-rendu-fichiers` : corrigé par le lot I (Dockerfile).

## Reste / à décider
- Déployer `studio-rendu` (CRF facultatif + copie de la brique effets) : à faire par Will, rien n'est déployé.
- FFmpeg absent du conteneur de l'application : la lumière mesurée ne jouera qu'une fois un décodeur disponible (repli `luminanceVisage` d'ici là).
- Effets dans les déclinaisons 4:5 / 1:1 / 16:9 : non posés.
- Validation de Will sur la planche avant d'annoncer les effets.
