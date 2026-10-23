# Journal — fiche vidéo : cartes, formats, mémoire (10/10)

Constats faits en production sur la vidéo face caméra `v-f9fa51b46cba`. Branche
`fix/fiche-video-cartes-formats-memoire`, partie d'`origin/master` e80f6ec (PR #9 fusionnée). Aucun appel réel,
aucun serveur touché, rien de fusionné ni de déployé.

## 1. « Cartes et effets » ne listait pas les cartes automatiques

### Cause
- La feuille lisait `vue.passages` : seulement les passages du **monteur**. Les 6 cartes automatiques
  (`habillage.cartes` auto-1 … auto-6) sont planifiées par `planifierCartesAuto` **pendant l'habillage**, dans la
  chaîne, et n'étaient rangées nulle part où la fiche pouvait les lire.
- De plus, `habillageFacecam` faisait `e.cartes ?? planifierCartesAuto(...)` : la moindre carte demandée au monteur
  effaçait **toutes** les cartes automatiques (même chose dans `habillageFacecamRatio` pour les formats).

### Correction
- `src/moteurs/montage-facecam/cartes-video.ts` (nouveau, pur) :
  - `cartesAutoDeLaVideo(mots, durée, gestes, cartesDuMonteur)` : cartes automatiques avec les gestes de Will
    appliqués, et une vue de chacune (`posee` / `retiree` / `masquee`) ;
  - clé **stable** d'une carte automatique (`cleCarteAuto` : modèle + textes, sans les instants) ;
  - `textesDeCarte` / `carteAvecTextes` : textes d'une carte, un par ligne ; un nouveau texte est posé **dans** la
    carte d'origine (icônes, numérotation, sur-titre, instants dits gardés ; aller-retour identique vérifié sur les 8
    cartes du fixture réel) ; texte qui ne tient pas → message clair ;
  - temps : un déplacement est gardé **dans la prise** (`debutPriseSec`) et ramené au montage d'après les passages
    gardés (`priseVersMonteeGardes`), comme les passages du monteur.
- Gestes gardés dans `entrees.facecamMonteur.cartesAuto` (`ReglagesMonteur.cartesAuto`), lus par la chaîne
  (`chaine.ts`, `habiller`) et passés à l'habillage de chaque format (`RepriseHabillage.cartesAuto`). **Une carte
  retirée ne revient pas** : la retouche suivante relit le même geste par la même clé.
- Cartes du monteur et cartes automatiques **cohabitent** (`cartesAPoser`, `habillage.ts`) : une carte automatique qui
  tombe sur une carte du monteur s'efface devant elle (« Cachée : une carte du monteur passe au même moment »). Une
  carte automatique déplacée passe avant les autres.
- Retouche partielle : les gestes entrent dans l'empreinte `habillage` de `signatureMontage` (et seulement s'il y en
  a : empreinte inchangée pour les versions d'avant) → `partiesARefaire` = `habillage` seul ; les cartes inchangées
  sont reprises par leur empreinte (aucun rendu de plus).
- La chaîne range les vues des cartes automatiques dans `projetMontage.cartesAuto`. Pour une version d'avant (comme
  `v-f9fa51b46cba`), le service les **replanifie** comme la chaîne : mots montés (`projetMontage.motsMontesCle`,
  R2), durée de la reprise, gestes et cartes du monteur.
- Service (`services/monteur-facecam.ts`) : `vueVotreVideo().cartes` (toutes les cartes et tous les effets, par ordre
  d'apparition) ; `retirerCarteAuto`, `remettreCarteAuto`, `deplacerCarte` (auto ou monteur : ancre du passage
  décalée dans la prise puis `recalerPassages`), `changerTexteCarte` (auto, ou carte de modèle / écran partagé du
  monteur : `operation.textes`). Aucun appel Claude ; chaque geste = une nouvelle version (`lancerRetouche`).
- Actions serveur (`actions-facecam.ts`) et feuille `components/facecam/CartesVideoFacecam.tsx` : modèle, texte,
  moment (temps monté), pastille « Automatique », Retirer / Remettre, Modifier (« Moment dans la vidéo » →
  Déplacer ; « Texte de la carte », une ligne par texte → Changer le texte). Un geste à la fois (la version suivante
  part de la version affichée).

## 2. Carreaux de formats : un toucher lançait 10 à 20 min de calcul

### Cause
- `FormatsFacecam` : cocher un format envoyait tout de suite `changerFormatsFacecam` → `reexporter` (passe image
  élargie sur la prise 4K quand le format sort de la bande traitée). Toucher un format prêt le **décochait**.
- Progression : `reexporter` annonçait `dureeEstimeeSec: 3` ; `avancerReexportFacecam` ne regardait que les cadrages,
  ×0,5 tant que la passe élargie tournait, soit 0 → borné à **1 %** pendant toute la passe ; la fin estimée (3 s)
  était dépassée et l'extrapolation de `finEstimee` exige ≥ 5 % → « encore 0 s · 1 % ». Côté studio-aligneur, la
  passe ne publiait sa progression qu'en fin de tranche de 30 s (8 % → 92 % d'un coup sur une vidéo courte).

### Correction
- `FormatsFacecam.tsx` : format pas encore fabriqué → fenêtre « Fabriquer le format carré ? Environ N min de calcul,
  gratuit. » [Annuler] [Fabriquer] ; format **prêt** (ou 9:16) → ouvert dans le lecteur, sans confirmation
  (`LecteurVersions` écoute l'événement `studio:lire-format`) ; format coché pas encore prêt → se décoche comme avant.
  (Retirer un format prêt : le dire au monteur, « retire la version carrée ».)
- `declinaisons.ts` : `estimationNouveauFormat` (passe élargie ≈ 5 s par seconde de prise, cadrage ≈ 1,5 s par
  seconde montée, habillage ≈ 1 min + 1 s par seconde montée : ≈ 15 min pour 2 min avec passe, ≈ 5 min sans) ;
  `progressionNouveauFormat` : chaque partie pèse sa durée estimée et suit la **vraie** progression du travail
  `/image` (`d.passeLarge.progression`, puis cadrages, puis habillage). `reexporter` annonce cette durée ;
  chaque tour réécrit `finEstimee` (au-delà de 5 %, le rythme réel compte pour moitié). `vueFormatsFacecam` donne les
  minutes estimées à la fenêtre de confirmation.
- `image.py` : progression publiée **chaque seconde de vidéo** pendant la tranche.
- Accueil (`EnCours.tsx`) : « encore 14 min » au-delà de 90 s (au lieu de « encore 840 s »).

## 3. Mémoire de studio-aligneur pendant la passe « formats »

- `deploiement/docker-compose.yml` : `mem_limit` de `studio-aligneur` **4500m → 6000m** (relevé à chaud à 6 Go en
  prod après le pic de 4,40 Go pour 4,395 Go permis). Serveur de 15 Go : base 0,5 + studio 1 + rendu 3 + aligneur 6 =
  10,5 Go au plus. Doc mise à jour : compose, `JOURNAL-E.md`, `JOURNAL-Z.md`, `JOURNAL-V.md`, `JOURNAL-B.md`,
  `docs/JOURNAL-FFMPEG-RECENT.md`.
- Cause du pic (mesurée) : les deux FFmpeg, pas Python. Sans borne, FFmpeg (décodage HEVC + filtres) et x264 prennent
  un fil par cœur **de l'hôte** (pas les 2 CPU du conteneur), chacun avec ses images 4K en vol, plus 40 images de
  prévision de x264 au préréglage `fast`.
- Correction (`media.py`, `image.py`) : `fils_ffmpeg()` = `STUDIO_ALIGNEUR_FILS` (2) pour le décodeur (`-threads`
  avant `-i`), les filtres (`-filter_threads`) et x264 (`-threads`) ; `-rc-lookahead 10` (intermédiaire quasi sans
  perte, crf 8) ; côté Python, conversions en place (une image flottante de moins), tampon brut lâché tout de suite,
  sortie 16 bits écrite sans `tobytes()` (`vers_16bits`, l'image gardée par l'anti-grain n'est jamais modifiée).

### Mesure (banc reproductible, `executer_passe` réelle)
Source synthétique 3840 × 2160, HEVC 10 bits étiquetée HLG (`arib-std-b67`), 12 s à 30 i/s ; bande **pleine largeur**
(3840, comme une passe élargie) ; LUT 17³ à 60 % ; sans points du visage. Pic = somme des RSS du processus Python et
de ses fils FFmpeg, relevée toutes les 50 ms. Machine de l'essai : 4 cœurs (la prod en a davantage : l'écart y est
plus grand, les fils non bornés suivant le nombre de cœurs de l'hôte).

| | Avant | Après |
|---|---|---|
| Pic total (Python + FFmpeg) | **5 135 Mo** | **3 553 Mo** (−31 %) |
| dont Python | 795 Mo | 750 Mo |
| Instantané pendant la passe (avant) | encodeur 2 835 Mo, décodeur 1 365 Mo, Python 661 Mo | — |
| Durée | 412,8 s | 371,3 s |
| Progressions publiées | 8, 92, 95 | 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 92, 95 |

## Tests — résultats exacts

- Nouveau `tests/facecam-fiche-cartes-formats.test.ts` : **10 tests, 10 passent** (cartes du fixture réel IMG_7747
  toutes listées ; clé stable et aller-retour des textes à l'identique ; retirer → ne revient pas à la retouche
  suivante, une carte de moins dans l'habillage ; déplacer → même durée, la carte recouverte est masquée ; changer le
  texte, refus clair ; cohabitation monteur + automatiques ; retouche « carte » = habillage seul ; temps prise →
  montage et lecture de « 0:32 » ; durée annoncée d'un nouveau format 10-20 min ; progression qui suit la passe).
- `tests/facecam-formats.test.ts` : + 1 test (moteur réel simulé, passe élargie « en cours » à 40 % : progression
  > 10 %, fin estimée dans le futur, puis 100 % une fois finie) → **26 tests, 26 passent**.
- Tests ciblés facecam (fiche, cartes, formats / déclinaisons, retouche, intégration : `tests/facecam-*.test.ts`,
  `h-facecam-multicamera`, `v-coherence-facecam`, `z-integration-facecam`, `g6-brique-declinaison`) :
  **23 fichiers, 281 tests, tous passent**.
- Suite complète `vitest run` : **281 fichiers passent, 1 ignoré ; 3 429 tests passent, 3 ignorés**.
- Python studio-aligneur (`python3 -m unittest discover -s tests`, Python 3.13, numpy 2.1.3, OpenCV 4.11, FFmpeg
  6.1.1) : **52 tests, OK** (46 avant + 6 nouveaux dans `tests/test_passe_memoire.py` : fils bornés du décodeur et
  de l'encodeur, `vers_16bits`, progression pendant la tranche sur une vraie passe).
- `next typegen` puis `tsc --noEmit` : **9 erreurs, toutes dans `studio-rendu/`** (modules `@remotion/renderer` et
  `@remotion/bundler` non installés dans ce sous-paquet ; fichiers non touchés) ; **0 erreur ailleurs**.
- `eslint` (tout le dépôt) : **0 erreur, 0 avertissement**.

## À vérifier en production (sans rien casser)
1. Fiche de `v-f9fa51b46cba` → Cartes : les 6 cartes automatiques apparaissent (replanifiées depuis les mots montés).
   Retirer l'une : nouvelle version, seule la piste habillée est refaite ; elle reste retirée ensuite.
2. Toucher « Carré » : la fenêtre « Fabriquer le format carré ? Environ N min » ; l'accueil montre une progression
   qui avance pendant la passe `…-passe-formats` et « encore N min ».
3. `docker stats studio-aligneur` pendant une passe « formats » : pic attendu nettement sous 6 Go (le compose garde
   6000m ; il pourra redescendre après mesure).
