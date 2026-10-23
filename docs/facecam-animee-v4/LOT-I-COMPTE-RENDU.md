# Lot I — Face caméra animée v4 branchée dans le studio (17/10/2026)

Branche `interface-claire/lot-i` (depuis `interface-claire/lot-c`, `master` fusionné). **Rien n'est fusionné, rien n'est mis en ligne.**

## En bref

La v4 validée par Will (répétition générale du 17/10) tourne maintenant par la **chaîne de production du studio** :

> prise déposée par Will → transcription horodatée (`studio-aligneur`, celle du face caméra) → coupes des silences (`calculerCoupes`, recalées sur 30 i/s) → réalisateur (**vrai appel à Claude Opus** par le chemin de dépense du studio, consigne v4, `verifierPlan`, 3 essais ; repli : plan v4 minimal) → rendu `InterfaceClaireFaceCameraV4` par le **service de rendu du studio** → vidéo rangée dans le studio (page `/videos/<id>`, comme les autres générateurs). **Plus de Drive.**

**Répétition générale par cette chaîne** (même code que le serveur, vrais fichiers) : la prise `prise-complete-IMG7747.mp4` donne une vidéo **identique en contenu** à la vidéo validée : même durée (82,688 s ; 82,700 s après la normalisation du son ajoutée par la session parallèle), mêmes 38 plaquettes, mêmes 120 groupes de sous-titres, zéro Certifexemple, **son identique** (corrélation 1,000, aucun décalage), images quasi identiques (PSNR moyen 43,3 dB, pire image 36,2 dB : écarts d'encodage seulement). Vidéo, planche contact et comparaison dans `docs/facecam-animee-v4/lot-i/`.

## Ce qui est branché

| Morceau | Fichier | Ce qu'il fait |
|---|---|---|
| Chaîne pure | `src/moteurs/montage-facecam-animee/chaine-v4.ts` | Machine à états (transcription → coupes → mise en scène → rendu → prête). Un pas par passage de la boucle, état gardé dans le travail (`parametres.facecamAnimeeV4`), « Réessayer » ne refait que l'étape arrêtée. Un travail extérieur en cours (transcription, rendu) ne bloque pas la boucle : il est repris par son identifiant au passage suivant, jamais relancé en double. `couperPriseV4` = calcul de la répétition (test : mêmes 30 intervalles, mêmes mots). |
| Moteur | `src/moteurs/montage-facecam-animee/index.ts` | Avec une prise déposée : la vraie chaîne. `refusAuLancement` **levé** : il refuse seulement une commande sans prise (l'ancien squelette de démonstration) et, tant que le format est en essai, une commande sans l'accord d'essai de Will. |
| Réalisateur Opus | `realisateur/role-v4.ts` + service | Rôle `realisateur-facecam-animee` v4 (`claude-opus-5-5`, effort élevé, 24 000 jetons de sortie au plus), consigne v4, forme de la réponse en JSON. Passe par `executerRolePourVideo` (plafond propre de la vidéo, limite du mois, pré-vol, réservation, coût réel). `realiser` lit la réponse (zod), `verifierPlan`, renvoie les erreurs exactes, 3 essais. |
| Repli sans Claude | `realisateur/plan-minimal-v4.ts` | Remplace la « version simple » de l'ancien catalogue : plaquettes v4 simples, bout à bout, emplacements alternés, un coup de poing toutes les ~17 s, mots dits seulement, jamais de mot interdit. Sur la prise IMG_7747 : 38 plaquettes, **0 erreur** de `verifierPlan`. Utilisé seulement si Claude est en panne, non relié, au plafond, ou refusé 3 fois. |
| Service | `src/services/facecam-animee.ts` | Outils réels (transcription, Opus, rendu, adresses signées) branchés au moteur par la boucle ; écran de dépôt (`deposerFacecamAnimee`). Outils injectables (répétition, tests). |
| Écran | `src/app/(studio)/face-camera-animee/` + `src/components/formats/facecam-animee/DepotPrise.tsx` | Dépôt de la vidéo filmée (envoi par morceaux du studio), texte dit facultatif (orthographe des sous-titres, reprises mieux coupées), accord d'essai à cocher la 1ʳᵉ fois, « Animer ma vidéo » → page de la vidéo. Joignable **par son adresse seulement** (aucun menu). |
| Rendu | `studio-rendu/src/operations/facecam-v4.ts` | Opération `composition`, mode `facecam-v4` : prise brute téléchargée et **montée par FFmpeg** (même filtre que la répétition : aucun zoom, fond intact), médias servis par `servirDossier` (dossier plat de liens : `sons/` + 3 bruitages maison, `broll/`, Montserrat 900 woff2, Montserrat Black, Inter Bold, logo), composition rendue, ré-encodage (CRF 22, ≤ 3,4 Mb/s), vignette. **Refuse un plan qui porte des sons** (jamais de musique). |
| Médias par adresse | `motion-v4/communs/medias-v4.ts` | `mediaV4()` remplace tous les `staticFile` des plaquettes v4 et de `VideoAnimeeV4` : adresse complète (`mediasBase` dans les props) en production, `staticFile` sinon (studio Remotion, planches, `rendre-repetition.mjs` inchangés). |

Garde-fous : jamais de musique (plan v4 sans piste de sons ; refus côté rendu) ; mots interdits à l'écran actifs (V8 dans `verifierPlan`, filet dans `VideoAnimeeV4`, repli qui ne les affiche jamais) ; chaque `.tsx` des plaquettes commence par `import React` (testé) ; aucune valeur importée de `src/` par les compositions (testé — voir la panne n° 1).

### Visible pour Will seul (mécanisme exact)

- `src/formats/facecam-animee/index.ts` : `statut: "actif"` **et** `reserveAWill: true` (nouveau champ optionnel de `DefinitionFormat`, `src/formats/types.ts`). La session « Bientôt » qui grise tout `statut !== "actif"` ne le grise donc pas.
- `src/formats/index.ts` : `listerFormats()` et `listerFormatsActifs()` **excluent** les formats `reserveAWill` (grilles « Nouvelle vidéo », menus, idées, personnages, prix…) ; `trouverFormat` / `obtenirFormat` par identifiant marchent toujours (la page d'une vidéo existante s'affiche). Aucun lien de menu.
- La page `/face-camera-animee` n'est joignable que par son adresse, derrière la session du studio ; le moteur (`refusAuLancement`) refuse tout lancement réel sans l'**accord d'essai de Will** (case à cocher, réglage `facecamAnimee.accordEssaiReel`) tant que `reserveAWill` est vrai. Pour ouvrir à tous plus tard : retirer `reserveAWill`.
- Tests : `lot-i.test.ts` (« actif mais réservé à Will », absent des listes, accord exigé) et `socle.test.ts`.

## Pannes rencontrées et corrigées

1. **Le paquet des compositions aurait cassé en production** : `interface-claire/plan-galerie.ts` importait une VALEUR de `src/domaine/facecam-animee/plan.ts` (avec `zod`), fichier que l'image de rendu ne copie pas et dont le paquet ne trouve pas `zod`. La version du plan est maintenant écrite en toutes lettres (le type garde l'égalité) ; test ajouté. (C'est sans doute la cause des 2 échecs de base `final-b-image-rendu-fichiers` et `image-video/galerie-prod`.)
2. **`staticFile` en production** : le service de rendu ne bâtit pas de dossier public ; toutes les polices, sons, B-roll et la prise passent maintenant par `mediaV4` et `servirDossier`.
3. **Précision du filtre de montage** : j'arrondissais les intervalles à 4 décimales ; repris tels quels pour un filtre identique à la répétition (test d'égalité au caractère près).
4. **Navigateur de Remotion (poste de répétition seulement)** : il voulait télécharger son navigateur (réseau fermé ici) ; pointé sur le navigateur local déjà installé. Rien de changé dans le dépôt ; en production le navigateur est déjà dans l'image.
5. **`server-only`** empêche de lancer le service hors de Next : la répétition est un test vitest lancé à la main (`REPETITION_PROD=1`), qui utilise le vrai service.

## Répétition générale de la chaîne de production

`tests/facecam-animee/repetition-prod.test.ts` (`REPETITION_PROD=1 REPETITION_SORTIE=… npx vitest run tests/facecam-animee/repetition-prod.test.ts`) :
- moteur `montage-facecam-animee` (lancer, puis `avancer` toutes les 5 s comme la boucle) + outils du service ;
- **vrai service de rendu** lancé en local (`studio-rendu`, `tsx src/index.ts`), appelé par le vrai client HTTP ;
- à la place des connexions du serveur : stockage local (adresses `http://127.0.0.1` au lieu des adresses signées R2), transcription faster-whisper de cette même prise (`tests/fixtures/img7747-v2-montage-reel.json` ; le modèle Whisper ne se télécharge pas ici), **faux client Claude** qui rejoue `plan-realisateur.json` (aucune clé ici), passé par l'adaptateur du service ;
- avec le texte dit (le script de la prise), comme lors de la répétition validée.

Résultat (`docs/facecam-animee-v4/lot-i/rapport-comparaison.json`) : passages *coupes (0 s) → mise en scène (5 s) → rendu (10 s) → prête (1 052 s)* ; 1 appel « Opus » ; 30 intervalles gardés, 82,667 s montées ; 38 plaquettes ; vidéo 1080 × 1920, 30 i/s, AAC 48 kHz, 34,2 Mo, 82,688 s (validée : 82,688 s) ; plan identique (plaquettes, sous-titres, durée) ; « grâce à Certifexemple » s'affiche « grâce à » ; son identique ; PSNR moyen 43,3 dB.

⚠ Cette répétition a tourné **avant** la fusion des changements de son de la session parallèle (−4 dB bruitages, loudnorm) : voir la section suivante pour le passage refait après fusion.

### Répétition finale (code du son définitif) — 17/10, 11:43 → 12:00

Même test, branche fusionnée avec `master` (858047d) : **réussi**. Passages *coupes (0 s) → mise en scène (5 s) → rendu (10 s) → prête (1 017 s)* ; 38 plaquettes, 120 groupes de sous-titres, durée **82,667 s** (= la prise montée, plus de rembourrage), PSNR moyen 43,3 dB face à la vidéo validée. Planche contact **2 i/s regardée en entier** (`planche-contact-2ips-a.jpg` et `-b.jpg`, 166 images) : zéro « Certifexemple » (« grâce à » seul), sous-titres au niveau du torse, jamais sur les yeux, aucun zoom, fond de la prise intact, mêmes plaquettes et même ordre que la répétition validée.

### Son (décision de Will du 17/10)

| | voix + bruitages d'avant | après |
|---|---|---|
| Niveau intégré | **−27,4 LUFS** | **−14,4 LUFS** |
| Pic vrai | −10,0 dBFS | **−2,0 dBTP** (cible ≤ −1,5) |
| Écart fort/faible (LRA) | 5,3 LU | 3,3 LU |

- **Bruitages −4 dB** : un seul multiplicateur `GAIN_BRUITAGES` (`motion-v4/communs/medias-v4.ts`), appliqué dans les 5 endroits qui jouent un bruitage (`briques-v4`, `lot1` à `lot4/commun-*`). La voix n'est pas touchée avant la normalisation : elle domine donc davantage.
- **Normalisation** (`studio-rendu/src/operations/facecam-v4.ts`, `normaliserSonV4`) : `loudnorm` en deux passes (mesure, puis gain) visant −14 LUFS, pic −2,5 dBTP ; le son est encodé en AAC, **puis re-mesuré** (`ebur128`) ; si le pic vrai dépasse −1,5 dBTP après l'AAC (l'encodage ajoute 0,7 à 2 dB selon le son — mesuré −0,7 dBTP avec une marge fixe de 1 dB sur la vraie prise), la marge est augmentée (1, 2, 3, 4, 5 dB) jusqu'à conformité. La vidéo est ensuite ré-encodée avec ce son **copié tel quel**. Mesures renvoyées par le service : `lufs`, `picVraiDbtp`, `margePicDb`. Aucun autre générateur n'est touché (l'opération `facecam-v4` est propre à ce format).
- Tests : `tests/facecam-animee/son-v4.test.ts` (3) : gain de −4 dB présent dans les 5 briques ; filtres purs ; vrai FFmpeg sur une « voix » à −27 LUFS et sur une voix avec claquements : résultat à −14 ± 1 LUFS, pic vrai ≤ −1,5 dBTP, mesuré par `ebur128` après l'AAC.

## Fichiers touchés HORS face caméra animée (coordination)

- `src/services/boucle.ts` : **une ligne** `import "./facecam-animee";` (raccord du moteur, comme `./image-video`).
- `studio-rendu/src/operations/composition.ts` : **deux lignes** (import + aiguillage `mode === "facecam-v4"` vers la nouvelle opération) ; le reste de l'opération n'est pas touché.
- Nouveau fichier `studio-rendu/src/operations/facecam-v4.ts` (propre au format, dans le service de rendu partagé).
- Fusion de `master` : 11 conflits, tous dans `studio-rendu/compositions/interface-claire/` (Fenetre, SousTitres, cartes/*) et tous sur la seule ligne `import React` ajoutée des deux côtés ; version de la branche gardée (elle l'avait déjà).
- **Liste exacte des autres fichiers partagés modifiés** (hors dossiers `facecam-animee`) :
  - `src/formats/types.ts` (champ optionnel `reserveAWill`) ; `src/formats/index.ts` (`listerFormats` / `listerFormatsActifs` l'excluent) ;
  - `src/briques/intensite/orchestrateur.ts` (`EPS` exporté, pour que la garde « une règle écrite une fois » passe) ;
  - `src/polices-ttf.d.ts` (déclaration des `.ttf`, supprime 5 erreurs `tsc` de la base) ; `scripts/approvisionner-fenetres.ts`, `scripts/essai-realisateur.ts`, `scripts/mesure-rythme.ts` (outils du générateur, nouveaux) ; `src/services/boucle.ts` et `studio-rendu/src/operations/composition.ts` (voir ci-dessus) ;
  - `src/domaine/facecam-parcours.ts` : inchangé (`DUREE_MIN_SEC` y est importé par `chaine-v4.ts`) ;
  - `deploiement/studio-rendu/Dockerfile` (une ligne `COPY` de `src/domaine/facecam-animee/plan.ts`, type seul) ;
  - `studio-rendu/compositions/interface-claire/cartes/Frise.tsx` (un commentaire reformulé) et `studio-rendu/compositions/interface-claire/*` (briques v4, `elements.tsx`…, propres au générateur) ;
  - `tests/v4-argent.test.ts` : **identique à master** (le double de test est renommé côté face caméra) ;
  - `tests/final-b-image-rendu-fichiers.test.ts`, `tests/image-video/galerie-prod.test.ts` : inchangés (ils passent).

Aucun fichier des autres générateurs (image → vidéo, tableau animé, cas concret, scripts) n'est supprimé ; leurs règles et leur son ne sont pas touchés.

## À prévoir en production (aucun réglage touché ici)

- **`ANTHROPIC_API_KEY`** déjà utilisée par le studio, et Claude **activé pour les textes** (réglage `fournisseur.texte-reseaux` ou `FOURNISSEUR_TEXTE_RESEAUX=claude`) : c'est le même interrupteur que « Image → vidéo » (`claudeActif`). Sinon : plan v4 minimal (aucune dépense).
- Réglages facultatifs : `facecamAnimee.plafondClaudeUsd` (plafond Claude par vidéo, défaut 4 $ : 3 essais du réalisateur) ; `facecamAnimee.accordEssaiReel` (posé par la case de l'écran).
- `STUDIO_ALIGNEUR_URL` (transcription), `STUDIO_RENDU_URL` + `STUDIO_RENDU_CLE`, stockage R2 : les mêmes que le face caméra et « Image → vidéo ».
- **Durée du rendu** : 17 min 30 ici pour 83 s de vidéo (2 pages de navigateur sur 4 cœurs : réglage par défaut du service). Le service coupe un montage à **20 min** (`delaiLongueMs`). Sur un serveur plus lent ou plus chargé, une vidéo de 90 s risque ce plafond : prévoir `STUDIO_RENDU_CONCURRENCE=4` (≈ 7 à 8 min, mesuré à la répétition du 17/10) ou relever le plafond de la file longue. **À décider par la session des mises en ligne.**
- Le service de rendu doit être redéployé avec la nouvelle opération (aucune variable nouvelle).

## Tests (avant / après)

- **Base** (`master` 858047d, mêmes fichiers rejoués dans un worktree) : échecs préexistants `cas-concret/variete/l3c`, `garde-ecran`, `image-video/controles`, `rendu-garde/garde`, `v5-serveur-scripts` (+ `tableau/formats/rendu-reel`, qui a besoin du téléchargement du navigateur Remotion, réseau fermé ici).
- **Branche, après la fusion de master, avant mes corrections** : 9 570 réussis, 11 échecs : les 6 ci-dessus **plus 5 dus à la face caméra animée** : liste des icônes (`realisateur.test`), `garde-regle-unique` (`EPS` et `DUREE_MIN_SEC` recopiés), `final-b-image-rendu-fichiers` (commentaire de `Frise.tsx` pris pour un import), `image-video/galerie-prod` (`plan.ts` non copié dans l'image de rendu), `v4-argent` (double de test nommé `executerRole`). Tous corrigés (icônes ajoutées à `ICONES_AUTORISEES`, constantes importées, commentaire reformulé, ligne `COPY` au Dockerfile du rendu, double renommé).
- **Branche, suite complète finale** (`npx vitest run`, 654 fichiers) : **9 575 réussis, 6 échecs : exactement ceux de la base, aucun nouveau**. Ajouts : `son-v4.test.ts` (3), `lot-i.test.ts` (19).
- `npx tsc --noEmit` (racine) : aucune erreur en plus de `master` (la branche en a même 5 de moins : polices `.ttf`, `src/polices-ttf.d.ts`) ; `studio-rendu` : les 2 mêmes (`findLast`).

## Ce qui reste

1. **Appel réel à Opus jamais fait** (aucune clé ici) : la consigne, la forme JSON et les 3 essais sont branchés et testés avec un faux client ; le premier vrai appel dira si Opus tient les règles v4 du premier coup (taille de la réponse : 24 000 jetons au plus).
2. **Transcription réelle** : passe par la route `transcrire` du face caméra ; non rejouée ici (modèle non téléchargeable). Le glossaire du face caméra n'est pas encore transmis.
3. Sans texte dit, les coupes sont en mode « libre » (sur IMG_7747 : 91 s au lieu de 82,7 s) : coller le texte donne le résultat validé.
4. Retouche par la conversation et autres formats d'image : pas encore (refus clair).
5. Historique d'une vidéo à l'autre (D13 v4) : les règles v4 ne le lisent pas encore.
6. Points déjà notés à la répétition : densité de la mosaïque, littéralité de la 2ᵉ mosaïque, bruitages à écouter.
