# Vérification A2 — fabrication d'une vidéo « type avocat », de bout en bout (10/10/2026)

- **Base :** master `fc894ae` (PR #22 incluse), branche `verif/a2-fabrication-avocat`.
- **Règles tenues :** rien fusionné, rien déployé, aucun serveur lancé, **aucun appel réel** (HeyGen, Claude, ElevenLabs : doubles et simulations seulement ; aucun `fetch` vers un fournisseur).
- **Méthode :** lecture du code et des docs du moteur avocat (`MOTEUR-AVOCAT-EXECUTION.md`, journaux FFmpeg), trois audits parallèles (Express/HeyGen/coût ; monteur/chat/reprise/argent ; montage/export), puis **chaque défaut confirmé par un test ROUGE avant sa correction** (rouge vérifié en retirant la correction, vert après).
- **Exécuté pour de vrai, hors serveur :**
  - **FFmpeg 8.1** statique (BtbN `n8.1.3`, avec libvmaf, zscale, libx264, libx265) en tête du PATH. *Écart :* l'image `mwader/static-ffmpeg:8.1.1` épinglée dans les Dockerfile n'a pas pu être tirée (Docker Hub : limite de téléchargement anonyme). Même branche 8.1, mêmes filtres.
  - **Rendu Remotion réel** des cartes de l'avocat (`studio-rendu/scripts/controle-cartes.ts`, Chromium local `/opt/pw-browsers`), en 9:16, 4:5 et 1:1 : `captures/a2-cartes-avocat-remotion.jpg`.
  - Sources synthétiques : `testsrc2`, `sine`, décor PNG uni, double webm VP9 avec alpha.

Légende : ✅ OK · 🔧 KO trouvé **et corrigé** (test rouge → vert) · ⚠️ KO trouvé, **non corrigé** (reste) · ➖ non vérifiable ici.

---

## 1. Résultat par étape

| # | Étape | Verdict | Preuve |
|---|---|---|---|
| 1 | Assistant Express, « Rapide » / « Pas à pas » (enchaînement, blocs manquants) | ✅ | `assistant/express/logique.ts`, tests `m3-votre-video`, `correcteur-ui2` |
| 2 | Plateau : décor par défaut N1, tenue, posture | 🔧 | Une posture de vidéo restée « debout » associait un double principal **assis** à un second angle **debout** : l'écran annonçait 1 angle, le serveur en fabriquait (et faisait payer) 2. Corrigé : `domaine/distribution.ts` (la posture du principal l'emporte). |
| 2b | Tenue filmée seulement dans l'autre posture (`Distribution.tsx` `PlateauCompact`) | ⚠️ probable | « Pas encore filmé » au lieu du repli que prévoit `FeuillePlateau`. Lu, pas exécuté (écran). |
| 3 | Voix HeyGen : choix (vidéo > format > défaut > première prête), repli | ✅ | `domaine/voix-format.ts`, test `d2-voix-format` |
| 3b | Voix HeyGen : coût **tracé** | 🔧 | Arrondi simple au taux 0,9 : une voix courte était tracée **0 €**, et le taux réglé par Will était ignoré. Corrigé : centime supérieur, taux de la commande (`fournisseurs/heygen/voix.ts`, `DemandeLecture.tauxUsdEur`). |
| 4 | Double HeyGen : looks, `reference_look_id` dans `engine` (jamais au premier niveau) | ✅ | `fournisseurs/heygen/rendus.ts:96`, test A2 |
| 4b | Refus 400 lisible (« HeyGen a refusé la demande. », texte anglais en console seulement, masqué) | ✅ | `client.ts` `erreurDepuisReponse` |
| 4c | Échec de rendu classé | 🔧 | « Access denied: consent… » et « Avatar look not found » devenaient « HeyGen n'a pas pu lire le son », **réessayable** : rendu renvoyé jusqu'à 3 fois pour rien. Corrigé (ordre des causes, message « HeyGen ne trouve plus votre double ou cette tenue »). |
| 4d | « Sans fond impossible » | 🔧 | Tout refus 400 citant « webm » faisait passer la vidéo en fond uni. Corrigé : détourage, transparence ou webm « non pris en charge » seulement. |
| 5 | Coût affiché et confirmation : « Fabriquer · X € », seuil, « Essai gratuit » | ✅ libellés et seuil | `logique.ts` `libelleBoutonFabriquer`, `decisionLancement` |
| 5b | Budget : même règle à l'écran et au serveur | 🔧 | Express comparait le **total** (textes des réseaux facultatifs compris) au restant ; le serveur, la part bloquante : bouton actif, puis feuille « Budget du mois » sans issue. Corrigé : l'aperçu renvoie `budget.bloquant`, Express l'utilise (seuil et budget). |
| 5c | Essai gratuit et budget | ⚠️ décision de Will | Un essai **tout simulé** (rien n'est payé) est grisé « Budget du mois dépassé » si le budget est bas, et refusé au serveur. `couts.ts` dit que les lignes simulées « ne comptent jamais dans le budget », mais **9 tests existants** (`e2e2-argent-*`, `c1-argent-b5`, `services`, `e2e1-moteur-02`…) exigent que le budget s'applique aux fabrications simulées. Correction essayée puis **retirée** (elle cassait ce contrat testé). Décision à prendre : les essais gratuits comptent-ils dans le budget ? |
| 6 | Découpage avocat : deux angles (principal trois-quarts, second face, jamais deux fois de suite, jamais sur l'accroche) | ✅ | 768 cas variés (4 scripts × 4 débits × 3 répartitions × 4 intensités × lèvres × en pied) : 0 faute, 0 alerte `controlerRythme` |
| 6b | Coupes : jamais dans un mot (R1) | 🔧 | À 3,5 mots/s, la sortie d'une illustration tombait **dans un mot** (12,477 s dans « le ») : repli sans regard aux mots. Corrigé (`decoupage.ts`), R1 testé à 3,5 / 4,4 / 5,5 mots/s. |
| 6c | Nettoyage des blancs (tête < 0,1 s, blancs ≤ 120 ms) | ✅ réel | `nettoyage.test`, `montage-avocat-son` (vrai FFmpeg) |
| 7 | Multicaméra (si activée, prises filmées) : l'accroche de face | 🔧 | Accroche et appel veulent tous deux la face ; à égalité l'appel gagnait, l'accroche partait **de côté**. Corrigé : l'accroche est une contrainte dure (`briques/multicamera/realisation.ts`). |
| 7b | Multicaméra : angle principal passé au double | ⚠️ à trancher | `avocat-branchements.ts:25` prend `visagesResolus.face` en premier alors que le principal avocat est « trois-quarts ». Lu, pas tranché : dépend de l'angle voulu pour les caméras fabriquées. |
| 8 | Sous-titres (lignes 48 / 57 / 61 %, encadré ≥ 80 px) | ✅ | `m4b-montage` |
| 8b | Sous-titres pendant une carte plein écran | 🔧 | « tout de suite. » restait dessiné au milieu de la carte « Ne payez pas tout de suite » : l'avocat ne transmettait pas `textesAffiches`. Corrigé (`supplementsMissionH`). |
| 9 | Cartes motion, 13 modèles, via `cartesPourFormat` (option `avocat.motionCommune`, coupée par défaut) | ✅ 12/13 | Dimensions exactes 1080×1920, 1080×1350, 1080×1080. `capture-annotee` ne sort jamais (pas d'image fournie) : prévu. |
| 9b | **Correctifs face caméra du 10/10 sur `choix.ts` partagé** (« un/une » n'annonce plus une liste ; aucun point fait de liaison) | 🔧 **régression avocat** | Le filtre des mots de liaison jetait les **sigles** : « Trois pièges : TVA, URSSAF et CFE » → **aucune carte** ; « SAS » perdu dans « SAS, SARL ou EURL ». Corrigé (sigles gardés) ; ajout des annonces juridiques (contrats, statuts, droits, obligations, documents, preuves, recours, options, solutions, conditions, critères). Les correctifs du 10/10 tiennent (« une chose à faire » n'est pas une liste ; tests face caméra : 215 verts). |
| 9c | Liste dont l'annonce a un complément | 🔧 | « trois erreurs à ne pas commettre : … » : 1er point « À ne pas commettre », 3e point perdu. Corrigé. |
| 9d | Check-list avec « vérifiez » dans l'énumération | 🔧 | « Trois réflexes : lisez l'avis, vérifiez… » : titre cassé, 2 cases sur 3. Corrigé (`choix-etendu.ts`). |
| 9e | Correctif `disposerListe` (b11c847) en plein écran avocat | ✅ réel | Rendu Remotion : listes dans la zone en 9:16, 4:5, 1:1, sigles visibles. 5 points longs : tiennent en 4:5 et 1:1. |
| 9f | Liste de 5 points de 8 mots en 9:16 | ⚠️ risque | `tient=false` (bas 1685 px, zone 1613). Rien ne rattrape côté avocat. Rare (le choix automatique écarte les points > 8 mots). |
| 10 | Export : graphe `gbrp` 8 bits sous FFmpeg 8.1, 3 formats | ✅ réel | Étiquettes BT.709 / tv / yuv420p, High 4.1, 25/1, faststart, aucune image noire |
| 10b | Master : une image par image avec décor ou micro PNG | 🔧 **grave** | `setpts=N/25/TB` tronqué par FFmpeg : 249 images sur 250, deux au même instant, une sautée (petite saccade sur les lèvres, **tout master avocat avec décor image**). Corrigé : `settb=1/25,setpts=N` (`studio-rendu/src/composition/image-ffmpeg.ts`). Test réel : 100 images, horodatages 0…99 exacts. |
| 10c | Note VMAF (une image sur 5) | 🔧 | Images choisies par **numéro** : une image en moins décalait toutes les paires (55 au lieu de 97 ; alerte sous 93 et relance CRF pour rien). Corrigé : choisies par **instant** (`round(t*fps)`). Test réel : export privé d'une image → note > 90. |
| 10d | Débit 12-16 Mb/s | ✅ 2 passes / ⚠️ CRF 17 | 2 passes : 13,9-14,0 Mb/s. CRF 17 : 9:16 à 16,99 Mb/s (source synthétique avec grain, très dure), 4:5 10,4, 1:1 7,2. Mineur, non corrigé. |
| 10e | Son AAC 48 kHz | ✅ | 256 demandés, 240 mesurés (limite de l'encodeur, déjà notée dans le code) |
| 11 | Monteur avocat : « C'est fait » jamais dit à tort | 🔧 | Zoom tombant sur une illustration, ou « 3 caméras » sans prise filmée : « C'est fait » alors que rien n'était appliqué. Corrigé : refus clair (`REFUS_ZOOM_ILLUSTRATION`, `REFUS_TROIS_CAMERAS_DOUBLE`). |
| 11b | Réglage `avocat.monteur` appliqué en production | ⚠️ | Rien n'écrit jamais `entrees.avocatConsignes` : le monteur avocat ne reçoit aucune consigne hors tests. Pas d'« habitudes » pour l'avocat. Fonction à construire (écran et contrat), pas un correctif. |
| 12 | Chat avec le monteur **après création** (vidéo avocat) | ⚠️ | `services/monteur-facecam.ts:251` : « Le monteur ne travaille que sur les vidéos face caméra » ; chat affiché pour le face caméra seulement. Fonction absente pour l'avocat. |
| 13 | Retouches avocat (passage, revoix) | 🔧 / ⚠️ | 🔧 Une vraie vidéo avocat se voyait **proposer un prix** puis refuser à la confirmation : la réponse dit maintenant tout de suite que la retouche n'existe pas (rien n'est lu ni payé). ⚠️ La retouche d'un passage et la revoix restent indisponibles pour l'avocat réel ; en démo, la nouvelle version ne reprend pas les cadrages demandés (`fabrication.ts` `creerRetouche`). |
| 14 | Reprise après redémarrage (HeyGen en attente, montage en cours) | ✅ | Envoi en deux tours, titre unique et même clé d'idempotence ; voix « en vol » comptée en dépense probable. Suites `r7e`, `paquet4`, `e2e1-gen-reprise` vertes. Réserve assumée par le code : une voix coupée en plein appel est relue (payée deux fois, comptée). |
| 15 | Dépenses tracées, plafonds bloquants **avant** l'appel payant, en français | ✅ | `credits.ts` `verifierBudgetEtCredits` au lancement et à « Réessayer » ; plafond de secondes du double avant l'envoi (`double.ts`). |
| 15b | Budget restant pendant une fabrication | 🔧 | La voix HeyGen payée en cours de route était comptée deux fois (dépense + engagement entier) : lancements bloqués à tort. Corrigé : l'engagement d'un travail en cours retire ce que ce travail a déjà payé (`couts.ts` `engagementCompte`). |
| 16 | Mot interdit « avatar » montré à Will | ⚠️ décision de Will | `MESSAGE_SANS_FOND_IMPOSSIBLE`, raison de confirmation « Votre avatar parle… », ligne de prix « Votre avatar ». Contraire à `MOTS_INTERDITS_ECRAN`, mais semble un choix délibéré du lot R7e : à trancher. |
| 17 | Rendu Remotion complet de la vidéo (studio-rendu) | ➖ partiel | Cartes rendues pour de vrai (images fixes). `npm ci` de studio-rendu fonctionne ; le navigateur de Remotion (remotion.media) est refusé par le proxy : on passe `browserExecutable` (Chromium local), ce que `REGLAGES_RENDU` ne propose pas en production. |

---

## 2. Corrections (16 défauts corrigés)

| Défaut | Fichiers | Test rouge → vert |
|---|---|---|
| Sigles jetés des listes (régression du 10/10), annonces juridiques | `src/briques/motion/choix.ts` | `tests/a2-fabrication-avocat.test.ts` (4) |
| Complément de l'annonce pris pour un point | `src/briques/motion/choix.ts` | idem (1) |
| Check-list cassée par « vérifiez » | `src/briques/motion/choix-etendu.ts` | idem (1) |
| Échec HeyGen mal classé (accord, look) | `src/fournisseurs/heygen/rendus.ts` | idem (2) |
| Faux « sans fond impossible » | `src/fournisseurs/heygen/client.ts` | idem (1) |
| Coût de la voix tracé à 0 € / taux ignoré | `src/fournisseurs/heygen/voix.ts`, `src/fournisseurs/types.ts`, `src/moteurs/montage-avocat/index.ts` (+ `tests/a1-voix-heygen.test.ts` aligné sur le centime supérieur) | idem (1) |
| Express ≠ serveur sur le budget | `src/services/fabrication.ts` (`budget.bloquant`), `src/assistant/etapes/Express.tsx` | idem (1) |
| Budget compté deux fois pendant la fabrication | `src/services/couts.ts` | idem (1) |
| « C'est fait » dit à tort par le monteur avocat | `src/moteurs/montage-avocat/monteur.ts`, `index.ts` | idem (3) |
| Modification avocat chiffrée puis refusée | `src/services/modifications.ts` | idem (1) |
| Postures mélangées | `src/domaine/distribution.ts` | idem (2) |
| **Master : image sautée avec décor PNG** | `studio-rendu/src/composition/image-ffmpeg.ts` | idem, **vrai FFmpeg** (1) |
| **VMAF apparié par numéro** | `studio-rendu/src/composition/ffmpeg.ts` (+ `tests/ffmpeg8-qualite.test.ts` adapté) | idem, **vrai FFmpeg + libvmaf** (1) |
| Coupe dans un mot à débit lent | `src/moteurs/montage-avocat/decoupage.ts` | `decoupage.test.ts` R1 à 3,5 / 4,4 / 5,5 mots/s |
| Accroche de côté en multicaméra | `src/briques/multicamera/realisation.ts` | `tests/a2-fabrication-avocat.test.ts` (1) |
| Sous-titre répété sous la carte | `src/moteurs/montage-avocat/index.ts`, `src/briques/composition/montage.ts` | `tests/h-avocat-mission-h.test.ts` (1) |

## 3. Contrôles

- **Suite complète (vitest, FFmpeg 8.1 en tête du PATH) :** voir § 6.
- **`next typegen` puis `tsc --noEmit` :** 0 erreur (après `npm ci` de `studio-rendu` : sans ses dépendances, 9 erreurs « module @remotion introuvable », toutes dans `studio-rendu`).
- **`tsc` de studio-rendu :** 0 erreur. **`eslint .` :** 0 erreur.

## 4. Restes (non corrigés, par priorité)

1. **Essais gratuits et budget du mois** (n° 5c) : contrat contradictoire, à trancher par Will.
2. **Chat du monteur après création, retouche d'un passage, revoix : absents pour l'avocat** (n° 12, 13). Fonctions à construire (≈ 2-3 j).
3. **Monteur avocat jamais alimenté en production** (n° 11b) : rien n'écrit `avocatConsignes`, pas d'habitudes.
4. **Démo : la retouche ne reprend pas les opérations** (cadrage demandé non appliqué à la nouvelle version, `creerRetouche`).
5. **Multicaméra : angle principal passé au double** (`avocat-branchements.ts:25`, face au lieu de trois-quarts ; identifiant du studio envoyé si `idExterne` manque) — à trancher.
6. **Liste de 5 points longs en 9:16** qui déborde (n° 9f).
7. **CRF 17 en 9:16 au-dessus de 16 Mb/s** sur une source très grainée (n° 10d).
8. **« avatar » à l'écran** : décision de Will (n° 16).
9. **Tenue filmée dans l'autre posture** : repli absent dans `PlateauCompact` (n° 2b, probable).
10. **Voix « lecture interrompue »** enregistrée sans `travailId` : si le travail repart, son engagement ne la retranche pas (même famille que 15b, cas rare).
12. **« flouter » (Bibliothèque) avec FFmpeg 8.1.3** : à revérifier avec l'image 8.1.1 officielle (§ 6).
11. **Remotion en production** : `browserExecutable` non réglable (`REGLAGES_RENDU`) si le serveur ne peut pas joindre remotion.media.

## 5. Plan d'ESSAI RÉEL minimal (à autoriser par Will)

Tarifs du code : voix HeyGen **0,03 ¢ US / caractère** (16 caractères par seconde parlée), Avatar V **7 ¢ US / seconde rendue**, taux 0,90 € / $. Montage, sous-titres, son, export : sur notre serveur, 0 €.

| Étape | Ce qu'on vérifie | Coût estimé |
|---|---|---|
| 0. Lecture des looks et voix du compte (gratuit), puis un rendu volontairement refusé (look inexistant) | `reference_look_id`, refus lisible « HeyGen ne trouve plus votre double… », **non réessayé** | 0 € |
| 1. Script avocat de **15 s**, un angle, sans illustration ni textes des réseaux : voix HeyGen | coût tracé = 240 car. × 0,03 ¢ = 7,2 ¢ US → **0,07 €** (et non 0 €) | 0,07 € |
| 2. Rendu du double, angle principal, 15 s | webm transparent, idempotence, dépense tracée | 15 × 7 ¢ = 1,05 $ → **0,95 €** |
| 3. Montage + export 9:16 sur le serveur (FFmpeg 8.1.1 de l'image) | 375 images exactes, VMAF ≥ 93, 12-16 Mb/s, AAC 48 kHz | 0 € |
| 4. Redémarrage du serveur pendant l'étape 2 (reprise) | rien n'est repayé (même titre, même clé) | 0 € |
| **Total** | | **≈ 1,02 €** |
| Option : second angle (15 % ≈ 2,3 s) | deux angles, posture identique | + 0,15 € |
| Option : déclinaisons 4:5 et 1:1 | serveur seulement | 0 € |

**Plafond à régler avant l'essai : 3 €** (budget du mois et seuil de confirmation), pour couvrir un éventuel second essai. Confirmer à l'écran « Fabriquer · ≈ 1,02 € » (ou 1,17 € avec le second angle).

## 6. Suite complète

FFmpeg 8.1 (BtbN n8.1.3) en tête du PATH, code final de la branche :

- **3 622 tests réussis, 1 en échec, 3 sautés** (289 fichiers, 590 s).
- L'échec : `tests/a2-traitement-image.test.ts` « flouter » (traitement d'image de la Bibliothèque, **hors avocat**). FFmpeg répond « Conversion failed! » avec ce FFmpeg 8.1.3 de BtbN ; le test **passe avec le FFmpeg 6.1 du système**, et il échoue de la même façon sur master. À revérifier avec l'image officielle 8.1.1 (`deploiement/verifier-outils-video.sh`) avant d'en faire un défaut.
- Premier passage de la suite (avant le retrait de la correction 5c) : 12 échecs. 9 venaient de cette correction (contrat testé, voir 5c), 1 de l'ancien arrondi de la voix (`a1-voix-heygen`, aligné), 2 de dépassements de temps de `e2e-verif1-bc-serie` sous charge (verts seuls, deux fois, et verts dans le second passage complet), plus « flouter ».
- `next typegen` + `tsc --noEmit` : 0 erreur. `tsc` de studio-rendu : 0 erreur. `eslint .` : 0 erreur.
