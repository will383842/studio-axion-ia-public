# Vérification V6 — Complétude du format face caméra (10/10/2026)

**Question unique : qu'est-ce qui MANQUE pour que le face caméra soit « parfait » selon Will ?**

- **Base :** master `85655d2` (PR #12 incluse). La PR #13 « finitions des cartes », encore ouverte, est lue mais non comptée.
- **Sources :**
  - `docs/facecam/EXIGENCES-WILL.md`, `PLAN-FACECAM-v4.md`, `PLAN-IMPLEMENTATION-FACECAM.md` et `CENTRALISATION.md` ;
  - tous les `JOURNAL-*.md` (facecam, FFmpeg récent, FFmpeg 8, tests verts) ;
  - les demandes récentes de Will ;
  - le code et les tests du dépôt.
- **Méthode :** lecture seule, en quatre audits parallèles (image et son, animations et plans, coupes et chat, parcours iPhone, langue et coût). Les constats les plus lourds ont été revérifiés à la main : composition `gbrp` 8 bits, `facecamLookWill` jamais écrit, cartes en « tout ou rien », Claude appelé seulement avec une consigne, invite Whisper.
- **Ce qui a été fait, et pas fait :** aucun code n'a été corrigé, rien n'a été fusionné ni déployé, aucun appel réel. Vitest n'a pas pu tourner dans ce conteneur (`node_modules` absent). Les tests Python de `studio-aligneur` ont tourné : 36 réussis sur 39, 3 en erreur parce que numpy manque ici.
- **Ce que veut dire « testé » :** un test existe et les journaux le disent vert. La mention précise toujours « réel » (vrai FFmpeg, Remotion ou vraie prise) ou « doubles » (simulation).

Légende des statuts :

- ✅ **fait et testé** ;
- 🟡 **fait, non testé** ;
- 🟠 **partiel** ;
- ❌ **absent** ;
- ⚠️ **trompeur** : le studio annonce la chose, mais elle n'a aucun effet.

Effort estimé en jours de session cloud (j), tests compris.

> **Mise à jour du 10/10 — lot P0 (branche `feat/lot-p0-v6`, NON fusionnée).** Les 9 exigences P0 ont été reprises, une par sous-lot, chacune avec un test vu rouge d'abord. Statuts mis à jour dans le tableau P0 ci-dessous. Résultats exacts et limites : `docs/facecam/JOURNAL-LOT-P0.md`.
>
> - **✅ (6) :**
>   - n° 1 : composition 10 bits de bout en bout ; un dégradé de mur garde 96 niveaux sur 96, contre 34 avant ;
>   - n° 3 : la passe visage est exécutée par un test ;
>   - n° 4 : le look gardé est écrit, mesuré et appliqué aux vidéos suivantes ;
>   - n° 6 : chaque opération du monteur est rendue, ou refusée avec « Pas encore possible » ;
>   - n° 8 : aucune phrase en double, alerte bloquante ;
>   - n° 9 : les cartes du monteur et les cartes automatiques se cumulent.
> - **🟠 (3) :**
>   - n° 2 : contrôle réel avec mire, mais pas d'alerte sur la prise de Will ;
>   - n° 5 : validation « C'est mon look », sans avant/après glissé ;
>   - n° 7 : invite verbatim et « euh » détectés dans le son, pas encore mesurés sur une vraie voix.
> - **Restent non rendus et refusés honnêtement :** vitesse, arrêt sur image, détourage (cache-moi, texte derrière) et musique.
> - **Le P1 et le P2 sont inchangés.**

---

## 1. Tableau trié par priorité (le lot suivant)

### P0 — Bloque le « parfait » (qualité d'image n°1, promesses non tenues)

| # | Exigence de Will | Statut | Preuve | Ce qu'il faut faire | Effort |
|---|---|---|---|---|---|
| 1 | **Qualité d'image n°1** : master « 10 bits », une seule descente en 8 bits, pas de bandes sur le mur | ✅ (lot P0, `9885bb4`) — était 🟠 | `studio-rendu/src/composition/image-ffmpeg.ts:159-175, 233, 245, 253, 316, 341` : toute la composition (piste de Will, écran partagé, cartes, concaténation) passe en `format=gbrp` / `gbrap`, du RVB **8 bits**. Seul l'encodage du master est en `yuv420p10le crf 8` (l.362-364). Le test `tests/facecam-pre-cadre.test.ts:107-114` ne lit que le texte des options. | Composer en `gbrp10le` / `gbrap10le` (ou `gbrp16le`) quand `source10bits` est actif. Ajouter un test au vrai FFmpeg : un dégradé de mur traverse la composition, puis on compte les paliers. | 1 j |
| 2 | **Qualité d'image n°1** : contrôle « aucune bande visible » | 🟠 (lot P0) — contrôle réel avec mire ; pas encore d'alerte sur la prise — était ❌ | Il n'existe qu'en commentaire (`src/briques/habillage-facecam/encodage.ts:5`). Pas de deband, pas de mesure. | Mesurer les paliers de l'histogramme ou de la dérivée sur une zone de mur, et lever une alerte. L'ajouter au contrôle réel `controle_ffmpeg.py` avec une mire en dégradé. | 0,5 j |
| 3 | **Qualité d'image n°1** : passe visage (rééclairage, débruitage renforcé sur le visage, bonne mine, dents, netteté, couleurs) | ✅ exécutée par un test (visage de synthèse) ; essai IMG_7747 à faire — était 🟡 | `studio-aligneur/aligneur/image.py:257-443` : le code existe. `executer_passe`, `Passe.traiter` et `executer_cadrage` ne sont exécutés **par aucun test ni contrôle**. Le contrôle réel n'envoie qu'une mire `testsrc2` à l'encodeur. JOURNAL-B l.124-127 : « essais manuels sur extraits de synthèse ». | Écrire un test Python d'intégration (numpy, OpenCV, MediaPipe) sur un extrait de 5 s avec un vrai visage : luminance du visage entre 100 et 140, bruit en baisse, dents seulement bouche ouverte, gain fixe. Puis un essai sur IMG_7747 avec les mesures écrites dans un journal. | 1,5 j |
| 4 | **Régler son look une fois pour toutes** : référence Lab (peau, mur), correspondance à chaque vidéo, ΔE00 < 4 | ✅ (lot P0, `5dbe713`) — était ⚠️ | `chaine.ts:505,515` et `declinaisons.ts:221` lisent `entrees.facecamLookWill`, mais **aucun code ne l'écrit** (recherche dans tout le dépôt). `deltaE00Peau` n'est donc jamais calculé (`image.py:621`) et l'alerte ΔE (`chaine.ts:304`) ne part jamais. `facecam.look` ne garde que les **crans** (`monteur-facecam.ts:178-185, 412-422`), repris seulement si la nouvelle vidéo est restée à « juste » (l.622). | Quand Will touche « Garder pour les prochaines vidéos », mesurer `peauLab` et `murLab` sur la vidéo validée, les ranger dans le réglage `facecam.look`, puis les copier dans `entrees.facecamLookWill` à chaque fabrication. Tester `delta_e00`, `lookGarde`, `retoucherImage` et la reprise sur la vidéo suivante. | 1 j |
| 5 | **Look validé par Will** au premier usage (plan v4 C : « Le premier usage ajoute seulement la validation du Look Will ») | 🟠 (lot P0, `fdc9b40`) — « C'est mon look » sans avant/après — était ❌ | Il n'existe ni écran, ni état, ni trace écrite d'une validation. Le format est passé `actif` (commit `9267233`) **avant** cette validation, alors que le plan v4 D (déploiement n°6) demandait l'ordre inverse. | Ajouter un écran « Votre look » au premier montage : avant/après glissé, 3 crans, « C'est mon look ». Il remplit la référence du n°4. | 1 j |
| 6 | **Animations complètes** et **modifier par le chat** : vocabulaire réellement rendu | ✅ rendu ou refusé clairement (lot P0, `cc8380a`) — était ⚠️ | Les opérations `zoom`, `titre`, `generique`, `vitesse`, `arretImage`, `masquerPersonne`, `texteDerriere`, son `musique` et `bruitage` sont acceptées et enregistrées, mais **aucun lecteur** ne les traite dans la chaîne, l'habillage ou studio-rendu (`raccords.ts:51` ne garde que les cartes, les écrans partagés et les mises en page). Le monteur répond « C'est fait » et produit une version identique. « Que puis-je demander ? » propose pourtant « Zoome… », « Rajoute un générique », « Accélère » (`monteur/catalogue.ts:37-52, 77`). | Rendre d'abord `zoom` (punch-in ou zoom lent passés à `realiser`), `titre` et `generique` (cartes du modèle titre), puis `vitesse` et `arretImage`. En attendant, retirer ces opérations de « Que puis-je demander ? » et répondre « Pas encore possible » au lieu de « C'est fait ». Un test par opération : la version produite diffère bien. | 2,5 j (0,3 j pour la réponse honnête seule) |
| 7 | **Couper bégaiements et phrases redites** : la transcription doit garder les disfluences | 🟠 (lot P0, `5201625`) — invite verbatim + « euh » acoustiques ; non mesuré sur vraie voix — était ❌ | `studio-aligneur/aligneur/transcrire.py:55-65` : faster-whisper `small` int8, `initial_prompt` « propre » (glossaire). Whisper efface les « euh » et les bégaiements. Preuve réelle : `tests/fixtures/img7747-transcription-whisper.txt` contient **0 « euh »**, et JOURNAL-REPRISE-CARTES note que « Whisper saute souvent un passage répété ». La brique `briques/coupes` (euh, « je je », mots inachevés) est donc presque aveugle sur une vraie prise. `transcrire_fichier` n'a aucun test. | Utiliser une invite avec disfluences (« Euh, je… je voulais, hum… ») et un modèle plus fin (`medium` ou `large-v3-turbo` int8, si la mémoire tient sous 3,5 Go). Ou bien un second passage d'alignement forcé qui garde les répétitions, en alimentant `motsLibres`, aujourd'hui lu par `chaine.ts:411` mais produit par personne. Valider sur une prise réelle **filmée exprès** avec des « euh », des bégaiements et une consigne « Monteur ». | 1,5 j |
| 8 | **Coupes** : contrôle « aucune phrase en double » (EXIGENCES-WILL l.27) | ✅ (lot P0, `5201625`) — était ❌ | `ControleCoupes` (`briques/coupes/index.ts:581-621`) n'a que `phrasesManquantes`, `consignesAudibles` et `coupesDansUnMot`. JOURNAL-COUPES-REPRISES reconnaît qu'une fin de phrase redite peut rester deux fois. | Coder `phrasesEnDouble` (mode texte : une phrase du texte retrouvée deux fois dans le montage ; mode libre : n-grammes de 4 mots ou plus répétés à moins de 10 s). En faire une alerte **bloquante** avec coupe automatique, et rendre `phrasesManquantes` bloquant aussi. | 0,7 j |
| 9 | **Animations nombreuses** : les cartes du monteur et les cartes automatiques doivent se cumuler | ✅ (lot P0, `9885bb4`) — était 🟠 | `habillage.ts:120` et `declinaisons.ts:518` : `e.cartes ?? planifierCartesAuto(...)`. **Dès qu'une seule carte vient du monteur, toutes les cartes automatiques disparaissent.** La PR #13 ne change pas ce point. | Fusionner les deux listes : les cartes du monteur d'abord, puis les cartes automatiques dans les trous, sans chevauchement et avec les plafonds du n°10. Test : une consigne + 80 s de prise donnent toujours au moins 5 cartes. | 0,5 j |

### P1 — Important (justesse, plans, « très peu de texte », habitudes)

| # | Exigence | Statut | Preuve | À faire | Effort |
|---|---|---|---|---|---|
| 10 | **Très peu de texte à l'écran** | 🟠 non conforme | IMG_7747 : 8 cartes, environ 48 s sur 82,7 s (**environ 58 % de la durée en écran partagé**), avec des listes de 3 ou 4 phrases complètes, plus les sous-titres. Le catalogue du monteur dit pourtant « 2 à 3 écrans partagés, 25 % au plus » (`monteur/catalogue.ts:44`). Seules limites de mots : une question (7 mots) et un appel à l'action (8 mots) (`cartes-auto.ts:181`). | Plafonner en automatique : 40 % de la durée au plus et 3 à 6 mots par ligne. Préférer les modèles visuels (chiffre, avant/après, ligne de temps) aux listes de phrases. Accorder la règle du catalogue et celle des cartes automatiques, sous une seule constante. **Les chiffres sont à faire trancher par Will** (nombre ou peu de texte). | 0,7 j |
| 11 | **Mes habitudes** appliquées à chaque vidéo | 🟠 | `monteur/agent.ts:136` : Claude n'est appelé que si `consignes.length`. Une vidéo sans « Monteur, … » n'applique donc **aucune** habitude. Aucun test. | Appeler le monteur quand il existe des habitudes, même sans consigne, ou appliquer les habitudes déterministes sans Claude. Ajouter un test. | 0,4 j |
| 12 | **Animations justes, posées automatiquement par Claude** (plan v4 : « Claude repère ce qui mérite une animation… ou en crée une sur mesure ») | 🟠 | Sans consigne, aucun appel Claude : toutes les cartes viennent de l'heuristique `planifierCartesAuto` (`cartes-auto.ts:510`). Elle est juste sur IMG_7747, mais ne connaît que des motifs. `CarteSurMesure` n'est **jamais** posée par défaut, malgré « D13 = activée ». | Ajouter une passe Claude « cartes » par vidéo (texte validé et mots montés en entrée, opérations `ajouterCarte` en sortie), sous le plafond du mois, avec l'heuristique en repli. Elle autorise une carte sur mesure au plus par vidéo, contrôlée par image. | 1,5 j |
| 13 | **Plusieurs plans de caméra** dans les déclinaisons 4:5, 1:1 et 16:9 | 🟠 | Les plans virtuels sont déclinés (`facecam-formats.test.ts:163`), mais `preparerHabillagesFormats` (`declinaisons.ts:636-646`) ne passe ni `multicamera` ni la mise en page côté / vignette. `coupesPrefereesSec: []` est passé en dur (`chaine.ts:719`), contrairement à son docstring. | Passer `multicamera` et `miseEnPage` aux compositions par format. Remplir `coupesPrefereesSec` avec les bornes des passages. Test par ratio. | 0,7 j |
| 14 | **Plusieurs plans** : rythme modulé | 🟠 | `realiser(... rythme: "equilibre")` est figé (`chaine.ts:481`). Ni l'intensité ni Will ne le changent. | Lire l'intensité de la vidéo (Sobre, Équilibré, Très dynamique) et permettre « Monteur, plus dynamique ». | 0,3 j |
| 15 | **Animations** : style Spectaculaire en intensité « Très dynamique » | 🟠 | Les cartes automatiques n'ont jamais de style : elles restent toujours en Sobre. Le style ne vient que des cartes du monteur (`raccords.ts:123`). | Appliquer `cartesPourFormat` et l'intensité aux cartes automatiques. | 0,2 j |
| 16 | **B-roll accordés au look**, refus des filigranes et du texte anglais | ❌ dans la chaîne | `refusBroll` et `REGLES_BROLL` (`briques/habillage-facecam/broll.ts`) ne sont appelés nulle part. Seule la LUT `lookBroll` est transmise (`habillage.ts:162`), sans aucun B-roll inséré. | Brancher les B-roll de la Bibliothèque et de la banque (pas de génération payante) : 1,2 à 2,5 s, accordés à la LUT, refus appliqué, 2 à 4 par minute. Ou bien les retirer du plan v1, **décision de Will**. | 1,5 j |
| 17 | **Coupes sans texte validé** : « Claude repère les redémarrages » | 🟠 | `briques/coupes/index.ts:227-269` : règles fixes (2 à 3 mots répétés, « pardon », « je recommence »). Aucun appel Claude. Une phrase abandonnée sans marqueur n'est pas coupée. Le critère « dernier essai **fluide** » n'existe pas : seul « complet » compte (`index.ts:136`). | Ajouter un appel Claude « reprises » en mode libre (transcription au mot en entrée, plages à couper en sortie, validées par Zod), avec repli sur les règles. Ajouter un score de fluidité (hésitations, pauses) pour départager les essais. | 1 j |
| 18 | **Coupes** : début et fin à jeter en vidéo libre | 🟠 | Regex de bavardage courtes : 8 mots au plus au début, 6 à la fin. Rien n'utilise l'image (regard hors caméra, main vers l'iPhone). | Utiliser `/visages` (regard, présence du visage) pour borner le début et la fin. | 0,5 j |
| 19 | **Son pro** : un seul traitement de la voix | 🟠 | La voix déjà traitée par `/son` repasse dans `preparerSon` de studio-rendu (`operations/composition.ts:360-376` ; `son/chaine.ts:34-45`). Le dé-esseur passe deux fois et la présence monte d'environ 4,3 dB au total. Le ton de pièce n'est présent que dans les fondus (`son.py:190`). La plage de 4 LU au plus n'est pas contrôlée. | Pour le face caméra, réduire `preparerSon` au gain et au limiteur. Rendre le ton de pièce continu. Alerter si la plage dépasse 4 LU. Tester `monter` (fondus de 15 ms) et DeepFilterNet. | 0,7 j |
| 20 | **Outils modernes** : DeepFilterNet réellement chargé | 🟠 | FFmpeg 8.1.1 est figé par empreinte dans les deux Dockerfile ✅. Mais si DeepFilterNet échoue, la construction passe quand même, en secours `afftdn`, en silence (`studio-aligneur/aligneur/__main__.py:44-49`). La vraie construction des images n'a jamais été faite (contrôles sur « images d'essai »). | Faire échouer la construction sans DeepFilterNet. Construire réellement les deux images une fois (CI ou serveur, au créneau annoncé) et garder le relevé. | 0,5 j |
| 21 | **Envoi iPhone simple** : seuil « Votre iPhone a réduit la vidéo » | 🟠 risque | `facecam-parcours.ts:38-48` : refus **bloquant** si le côté long fait moins de 2560 px ou si le débit est sous 8 Mb/s. Une vraie vidéo filmée en 1080p serait refusée comme « réduite ». `controlerFichier` n'a aucun test. | Comparer aux métadonnées de la prise (ou n'en faire qu'un avertissement non bloquant), accepter le 1080p et tester. | 0,3 j |
| 22 | **Image iPhone à 30 i/s** | 🟠 risque | `media.py:241` : `fps=25`. L'iPhone filme à 30 i/s par défaut, ce qui jette 1 image sur 6 (saccades). Rien ne prévient. | Conseiller le 25 i/s sur l'écran de départ de l'iPad. Ou bien garder 30 i/s de bout en bout, ou ré-échantillonner avec `minterpolate` / `framerate`. | 0,3 j |

### P2 — Finitions (parcours, langue, tests d'écrans)

| # | Exigence | Statut | Preuve | À faire | Effort |
|---|---|---|---|---|---|
| 23 | **Envoi iPhone** : analyse des 3 premières secondes, alerte HDR | 🟠 | Le navigateur ne regarde que la luminance d'une image vers 2 s, et `visageTrouvePct: 100` est écrit en dur (`EnvoiIphone.tsx:90-106, 191`). `EtatFacecam.HdrOuLog` n'est jamais produit : personne ne passe `hdr` à `analyserDebut`. | Appeler `/visages` sur 3 s dès la réception, puis `analyserDebut` côté serveur. Afficher l'état. | 0,5 j |
| 24 | **Notifications face caméra** prête / échec | 🟠 | `notificationFacecam` (`facecam-parcours.ts:128`) n'est utilisée nulle part. Ce sont les textes génériques de `travaux.ts:219-221, 443` qui partent. | Brancher ce texte pour le format facecam et le tester. | 0,2 j |
| 25 | **Envoi iPhone** : essai réel sur iPhone (Wake Lock, coupure réseau et reprise, photothèque contre Fichiers, HDR et Dolby Vision) | 🟡 jamais sur iPhone | Le code existe (`EnvoiIphone.tsx:52-72, 175-180, 274-290`, `lib/envoi-multipart.ts`). Seul le cœur multipart est testé. Aucun journal ne décrit un envoi depuis un vrai iPhone. | Faire un essai guidé par Will (liste de 6 cas), consigné dans un journal. Ajouter un test de composant pause/reprise. | 0,5 j + 20 min de Will |
| 26 | **Envoi iPhone** : champ dicté « Une demande pour le monteur ? » | 🟠 | Il n'apparaît qu'**après** le lancement de l'envoi (`EnvoiIphone.tsx:307-319`), et jamais pour un envoi par Google Drive. | L'afficher avant de choisir le fichier (facultatif) et sur la voie Drive. | 0,2 j |
| 27 | **Tout en français, vouvoiement** | 🟠 | L'interface, les erreurs et les états sont au vouvoiement ✅. La consigne de Claude impose le vouvoiement (`monteur/role.ts:92, 103`), mais « en français » n'y figure pas, en particulier pour le texte des cartes sur mesure (`html`). Les exemples visibles sont à l'impératif tutoyé (`monteur/catalogue.ts:37-52`, `FilMonteur.tsx:118`, `VotreVideoFacecam.tsx:249` : « Zoome », « Mets-moi », « Cache-moi ») : ce sont des phrases de Will au monteur, **à faire trancher par Will**. Il y a aussi de l'anglais visible : « look » (`MonMonteur.tsx:106`, `VotreVideoFacecam.tsx:228`). | Ajouter « Réponds et écris tout texte affiché en français » dans la consigne. Remplacer « look » par « Mon style d'image » si Will le souhaite. Écrire un test de langue sur les textes des cartes. | 0,2 j |
| 28 | **Modifier par le chat** : aperçu de l'animation dans le fil, retour en arrière sur plusieurs versions | 🟠 | Le fil ne montre aucun aperçu (plan v4 l.344). `revenirVersionAvant` (`monteur-facecam.ts:460`) ne remonte que d'un parent à la fois. `discuterAvecMonteur` n'est testé que sur les options payantes : il n'existe aucun test « zoom », « carte », « nouvelle version » ou « revenir ». | Ajouter une image de contrôle dans la réponse, une liste des versions, et des tests de bout en bout du service (Claude simulé). | 0,8 j |
| 29 | **Liste des coupes** lisible (« 3 reprises coupées, 12 s au début ») | 🟠 | `VotreVideoFacecam.tsx:102` et `temps.ts:97` comptent aussi les silences et les hésitations : le nombre est gonflé et la durée du début manque. | Afficher « N reprises coupées · X s au début · Y s à la fin » et regrouper les silences à part. Ajouter un test de rendu. | 0,2 j |
| 30 | **Opération inconnue → carte sur mesure** (vocabulaire ouvert) | 🟠 | `enCarteSurMesure` (`operations.ts:298`) ne sert qu'en simulation : en production, le `type` est une liste fermée (`enveloppe.ts`, `z.enum`). | Ajouter un type `autre` (description libre) à l'enveloppe et le transformer en carte sur mesure. | 0,3 j |
| 31 | **Titre fixe en haut** (D5) | ⚠️ | `src/formats/facecam/index.ts:67` (`accrocheVisuelle.titreFixe`) n'est lu par aucun code. Cela va dans le sens de « très peu de texte », mais la déclaration ment. | Retirer la déclaration ou la rendre, **décision de Will** (peu de texte : la retirer). | 0,1 j |
| 32 | **Tests d'écrans** (« Votre vidéo », feuilles, fil, envoi) et `alertesControles` | ❌ | Aucun test de rendu de `VotreVideoFacecam`, `FilMonteur` ou `EnvoiIphone`. `alertesControles` (`chaine.ts:293-308`) n'a aucun test. | Écrire des tests de composants (Testing Library) et un test unitaire des alertes. | 0,8 j |
| 33 | **Garder ce modèle** / **Mes animations** | 🟡 | `FilMonteur.tsx:94, 174`, `MesAnimations.tsx`, `appliquer.ts:360` : seul le schéma est testé. | Ajouter un test de bout en bout : garder, puis réutiliser dans une autre vidéo. | 0,3 j |
| 34 | **Rendu de bout en bout réel** (cartes automatiques, plans, sous-titres) | ❌ en CI | Les planches Remotion et l'essai `CarteSurMesure` sont des scripts manuels. Aucun rendu complet d'une vidéo face caméra n'est fait en test. | Ajouter un script de rendu court (10 s) dans `npm run verifier`, côté studio-rendu. | 0,7 j |
| 35 | **Docs à jour** | ⚠️ | JOURNAL-E et JOURNAL-V § 4 disent encore « le format reste masque ». `catalogue-actif-etendu.ts:4-5` parle encore de « 6 modèles ». La docstring `image.py:6` cite « zscale + hable ». JOURNAL-D présente tout le vocabulaire comme livré. | Mettre la documentation à jour (lot doc, 0,2 j). | 0,2 j |

**Total estimé :** P0 ≈ 10 j · P1 ≈ 8,5 j · P2 ≈ 5 j, soit environ 23,5 j de session (environ 6 à 8 jours au calendrier avec 3 sessions en parallèle).

---

## 2. Exigences déjà tenues (pour mémoire)

| Exigence | Statut | Preuve |
|---|---|---|
| **Pas de Décor IA** (trop cher) | ✅ | `services/decor-ia.ts:46` : `actif:false, reel:false`. Il faut un « Confirmer » par version et un jeton côté serveur (`decor-ia.ts:93-100`). Tests `decor-ia.test.ts`, `v-coherence-facecam` n°4 et 5. Multicaméra HeyGen (environ 7,6 €/min), effet réaliste et ultra réaliste : tous coupés par défaut. Aucune image générée (`sourcesAutorisees: bibliotheque, banque`). |
| Format sans prix | ✅ | `sansPrix`, `estimer()` = 0 (`montage-facecam/index.ts:234`) ; tests `facecam-fondations`, `c1-argent-b6`. |
| **FFmpeg récent** | ✅ (à construire en vrai, n°20) | FFmpeg 8.1.1 statique figé par empreinte (`deploiement/studio-rendu/Dockerfile:13,31`, `deploiement/studio-aligneur/Dockerfile:14,28`) ; `verifier-outils-video.sh`. |
| HDR, HLG, Dolby Vision 8.4 convertis en SDR BT.709 | ✅ (sur mire réelle) | `media.py:94-235` ; `studio-aligneur/tests/test_hdr.py` (10 tests). Reste à vérifier sur IMG_7747. |
| Export final 8 bits unique, tramage, `aq-mode=3`, VMAF | ✅ (vrai FFmpeg) | `studio-rendu/src/ffmpeg.ts:90-127` ; `tests/ffmpeg8-qualite.test.ts`. (Mais voir n°1 : la composition en amont est en 8 bits.) |
| −14 LUFS, −1,5 dBTP, loudnorm en 2 passes | ✅ (sinusoïde) | `son.py:228-235` ; contrôle `chaine_son`. |
| Plans virtuels sur la 4K, alternance 100/115 %, punch-in, 2-3 s, jamais plus de 6 s, grammaire | ✅ (doubles) | `briques/realisation` ; `realisation.test.ts:34-92`. Posés par défaut (`chaine.ts:481`). |
| Catalogue de 13 modèles, Sobre et Spectaculaire | ✅ (planches Remotion réelles) | `pourFormat.ts:59` ; planches `docs/facecam/planche-motion*` ; `facecam-motion-7-13.test.ts`, `facecam-monteur-13-modeles.test.ts`. |
| Cartes au bon mot, moitié haute, sous-titres de 1 à 4 mots sous la bouche | ✅ (doubles) | `calerCarteTous`, `GROUPEMENT_FACECAM` ; `facecam-reprise-cartes.test.ts`. |
| Reprises en mode texte (dernier essai complet) | ✅ (fixture réelle IMG_7747) | `briques/coupes/index.ts:136-173`, `absorbees.ts` ; `coupes.test.ts:245-299`, `facecam-reprise-cartes.test.ts`. |
| Silences > 0,25 s, jamais au milieu d'un mot, original intact, Rétablir | ✅ (doubles) | `coupes.test.ts:88, 109` ; `facecam-retouche.test.ts:119`. |
| Consignes « Monteur, … » repérées et coupées, aucune consigne audible | ✅ (doubles ; dépend du n°7) | `consignes.ts` ; `coupes.test.ts:136-165` ; alerte bloquante `chaine.ts:307`. |
| Fil « Discuter avec mon monteur » relié à Claude, une nouvelle version par échange | 🟡 | `monteur-facecam.ts:337-357` ; un seul nouvel essai guidé par l'erreur (`agent.ts:157`). |
| Envoi : 15 Go, horizontal accepté, reprise multipart, « Prête vers… », Arrêter | ✅ / 🟡 | `services/envois.ts:31-49` ; `facecam-fondations` ; `envoi-multipart` testé (`m1b`, `c5`) ; `facecam-retouche.test.ts:219`. |
| Étapes `["express","fabrication"]`, 12 états `EtatFacecam` en français | ✅ | `src/domaine/facecam.ts:106-144` ; test « chaque état a un libellé français ». |

## 3. Décisions à demander à Will (ne bloquent pas le lot, mais en fixent les chiffres)

1. **« Nombreuses animations » ou « très peu de texte ».** Proposition : 5 à 6 cartes par minute, 40 % de la durée au plus, 6 mots au plus par ligne, et des visuels plutôt que des phrases.
2. **B-roll en v1** (n°16) : les brancher depuis la Bibliothèque et la banque, ou les reporter.
3. **Exemples tutoyés** dans « Que puis-je demander ? » (ce sont des phrases de Will au monteur) : les garder ou les passer au vouvoiement. Remplacer le mot « look » ?
4. **Cadence de tournage** : régler l'iPhone en 25 i/s (le plus simple) ou garder 30 i/s.
5. **Prise d'essai** : filmer 1 min avec des « euh », des bégaiements, une reprise, une consigne « Monteur » et un HDR allumé. Elle sert de référence aux n°3, 7, 8 et 25.

## 4. Ordre conseillé du lot suivant

1. **Lot V6-a « Image » (≈ 5,3 j) :** n°1, 2, 3, 4, 5, puis 22.
2. **Lot V6-b « Monteur honnête et complet » (≈ 4,3 j) :** n°6 (réponse honnête tout de suite, puis rendu de zoom, titre et générique), 9, 10, 11, 15.
3. **Lot V6-c « Coupes réelles » (≈ 3,7 j) :** n°7, 8, 17, 18, validés sur la prise d'essai de la décision n°5.
4. **Lot V6-d « Plans, son, outils » (≈ 2,2 j) :** n°13, 14, 19, 20.
5. **Lot V6-e « Parcours et finitions » (≈ 8 j) :** n°12, 16 (selon Will), puis 21 et 23 à 35.
