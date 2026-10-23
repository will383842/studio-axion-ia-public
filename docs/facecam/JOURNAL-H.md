# Journal de la mission H « Centralisation » — 09/10/2026 (session cloud, branche `feat/facecam-h`)

Référence : `PLAN-FACECAM-v4.md` (correctif « Motion design qualité EXTRÊME et CENTRALISÉ »), journaux C, C2, D, E, F4.
Branche partie de `origin/feat/facecam`, qui y a été refusionnée deux fois (lots F1, F3, puis lot I), conflits résolus en
gardant les deux côtés. **Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché, aucun
appel réel (Claude, HeyGen, Higgsfield) : doubles de simulation et services injectés seulement.**

Exigence de Will : tout ce qui est construit est CENTRALISÉ et réutilisable par tous les types de vidéos. Règle absolue
pour l'avocat : seulement des paramètres FACULTATIFS ; absents, l'avocat fonctionne exactement comme avant (vérifié par
test). Jamais de bandeau « nom · Axion-IA ».

## Ce qui est fait

### 1. Motion design centralisé (brique `motion`)
- **API unique** `src/briques/motion/pourFormat.ts` :
  `cartesPourFormat({ format, ratio, phrases, intensite, demandes, habitude, mots, maxCartes, dureeVideoSec })`.
  - modèle choisi d'après la phrase (`choisirModele`) ou demandé (titre à l'écran, consigne, fil) ; le titre n'est
    jamais choisi seul (B.21) ;
  - style par `choisirStyleMotion` (demande > habitude > intensité > sobre) ; « sobre » n'est pas écrit (propriétés
    identiques au lot C) ;
  - durée bornée par la fiche du modèle et le garde-fou 3-8 s ; calage au mot dit ; jamais deux cartes l'une sur
    l'autre ;
  - le catalogue passe par `CATALOGUE_ACTIF` (jamais une liste en dur) : les modèles 7-13 du lot F2 y entrent en
    remplaçant ses fonctions par celles du catalogue étendu, aucun format n'a rien d'autre à changer.
- **Rendu commun des cartes** `src/briques/motion/rendu-cartes.ts` : opération `composition` EXISTANTE sans mode, suivie
  tour après tour, un nouvel essai, carte ratée écartée (jamais bloquant).
- **Avocat** (`src/moteurs/montage-avocat/motion.ts`, réglage caché `avocat.motionCommune`, coupé) : aux places de ses
  illustrations (`illustration`, `intentionIllustration`), titres (`titreEcran`) et emphases, l'avocat demande ses cartes
  à l'API unique (au plus une toutes les 12 s, jamais dans l'accroche) ; la carte remplace l'illustration du plan (rien
  n'est fabriqué ni payé pour ce plan ; carte ratée → le double, comme une illustration sans fichier). Composition par
  format d'image (`BaseComposition.supplementsParRatio`).

### 2. Agent monteur centralisé (brique `monteur`)
- `src/briques/monteur/` : consignes « Monteur, … » (repérage de la brique `coupes`) et fil ; **ancrage** sur un mot
  (déplacé du lot D, le face caméra le réexporte : même fonction) ; **relecture tolérante** `lireReponseOperations`
  (même algorithme que le lot D, vérifié résultat pour résultat) ; schéma `schemaConsigneLue` et `schemaReponsePour` ;
  opérations communes (carte du catalogue actif, zoom, titre, retirer, « 3 caméras ») identiques au face caméra (vérifié
  par leur schéma JSON) ; familles de demandes ; **réponse claire** au refus (`refusClair`).
- Adaptateurs : face caméra (`montage-facecam/monteur/adaptateur.ts`, enveloppe le lot D sans rien changer) ; avocat
  (`montage-avocat/monteur.ts`, réglage `avocat.monteur`, coupé) : « 3 caméras », zoom (plan en poitrine), carte et
  titre (si la motion commune est allumée), style ; tout le reste → « Pour une vidéo avocat, je ne sais pas encore
  faire … : rien n'a été changé. » Version simple par règles fixes, **aucun appel Claude**. Registre
  `src/moteurs/monteurs.ts` (`adaptateurMonteur(format)`).

### 3. Multicaméra branchée et centralisée (JOURNAL-F4 « Ce qui reste » 1 à 4, + face caméra)
- (a) **Moteur avocat** : après `decouper()`, pour des prises filmées, `passeMulticameraAvocat` (injectée par les
  services, `services/avocat-branchements.ts`) ; piste rangée dans `projetMontage.multicamera` et reprise pour un format
  ajouté. Commande : `entrees.avocatMulticamera` figé au lancement depuis `avocat.multicamera`.
- (b) **Composition** (`briques/composition` + `studio-rendu`) : `EntreeComposition.multicamera` ; les plans « double »
  sont coupés aux plans de caméra (`briques/multicamera/composition.ts`), zoom continu appliqué sur l'angle montré ;
  `PlanScene.camera`, `ProprietesImageComposition.cameras` ; FFmpeg (`image-ffmpeg.ts`) et repli navigateur
  (`ImageComposee.tsx`) lisent l'angle. Absent : paramètres identiques (test). Une piste du double de SIMULATION n'est
  jamais lue par une composition réelle (la vidéo reste à une caméra).
- (c) **Analyseur réel** `src/fournisseurs/multicamera/analyseur.ts` (calculs purs, testés) branché par
  `services/analyseur-angles.ts` sur des services EXISTANTS : durée par l'opération `analyse-media` (ffprobe) de
  `studio-rendu`, visage et bouche par la route `/visages` de `studio-aligneur`, synchro bouche/son par corrélation de
  l'ouverture de la bouche avec la parole active (± 400 ms, interpolation), présence du visage à ~1 image/s. Utilisé
  seulement si `reel: true`.
- (d) **« Monteur, fais-le en 3 caméras »** : reconnu par le monteur commun (famille `multicamera`), allume la
  multicaméra de la vidéo avocat ; côté face caméra, les consignes dites sont passées à la passe.
- (e) **Face caméra** (`briques/multicamera/facecam.ts`, `services/multicamera-facecam.ts`, réglage
  `facecam.multicamera`, coupé) : même brique, même service commun (`services/multicamera.ts`) ; face = la piste montée
  de Will, angles 2 et 3 = double HeyGen sur le même son ; branchée dans la chaîne (`multicamera` des dépendances,
  passe une fois avant l'habillage, panne → une caméra).
- Toujours : `reel` faux par défaut, aucun look créé à la volée en réel, aucun prix affiché (le coût réel passera par
  la confirmation et les crédits existants).

### 4. Inventaire de centralisation
- `docs/facecam/CENTRALISATION.md` : tableau de chaque brique (sous-titres, composition, motion, monteur, multicaméra,
  coupes, calage, réalisation, décor IA, habillage, déclinaison/formats, intensité, son, image/Look, effets spéciaux).
- Corrigé simplement : **`src/briques/calage/`** (report des horodatages et calage des mots, importés par la chaîne face
  caméra et la brique coupes depuis le moteur avocat ; déplacés sans changer le code, réexportés par l'avocat).

### 5. Échecs trouvés sur la base `origin/feat/facecam` (intégration F1 / F3), corrigés simplement
- `final-b-image-rendu-fichiers` : brique `effets-speciaux` absente du Dockerfile de `studio-rendu` (le lot I a fait la
  même correction ; fusion résolue sur sa ligne). *Rien n'est déployé.*
- `facecam-effets-speciaux` : test du catalogue écrit avant l'exemple de style du lot C2 → attente alignée.
- `garde-regle-unique` : `ESSAIS_MAX = 2` recopié dans `declinaisons.ts` (F1) → exporté une fois par `chaine.ts`.
- `eslint .` : `EffetTransition.tsx` (F3) lisait une référence pendant le rendu → image figée gardée en état.

## Fichiers communs touchés (ajouts facultatifs ; absents, rien ne change)
- `src/briques/composition/montage.ts` : `BaseComposition.supplementsParRatio` et `multicamera`, posés dans
  `demandeComposition` seulement s'ils existent.
- `src/briques/composition/parametres.ts` : `EntreeComposition.multicamera` (entrées `camera-*`, plans coupés).
- `src/briques/composition/scene.ts` : `PlanScene.camera`, `CameraScene`, `ProprietesImageComposition.cameras`.
- `studio-rendu/src/composition/image-ffmpeg.ts`, `studio-rendu/src/operations/composition.ts`,
  `studio-rendu/compositions/commune/ImageComposee.tsx` : lecture de l'angle d'un morceau (aucune opération nouvelle,
  aucun contrat changé).
- `src/briques/motion/index.ts` (exports), `src/briques/multicamera/{index,types,reglage}.ts` (ajouts),
  `src/briques/coupes/texte.ts` (import depuis `briques/calage`).
- `src/moteurs/montage-avocat/index.ts` : `passesMissionH` après le découpage (rien quand aucune option), rendu des
  cartes avant la composition, `supplementsMissionH`, champs facultatifs du projet ; `report.ts` et `alignement.ts`
  deviennent des réexportations.
- `src/moteurs/montage-facecam/chaine.ts`, `dependances.ts` : dépendance facultative `multicamera` ; imports du calage ;
  `ESSAIS_MAX` exporté. `monteur/role.ts` : ancrage réexporté depuis la brique.
- `src/services/fabrication.ts` : réglages cachés figés au lancement (`entreesAvocatDuLancement`, `facecamMulticamera`) ;
  `src/services/boucle.ts` : chargement de `avocat-branchements` ; `src/services/facecam-branchements.ts` : passe
  multicaméra ; `src/services/multicamera-avocat.ts` : fabrication via le service commun.
- `deploiement/studio-rendu/Dockerfile` (ligne COPY de la brique effets, identique au lot I). Tests des autres lots :
  `tests/facecam-effets-speciaux.test.ts` (une attente). `studio-rendu/compositions/commune/effets/EffetTransition.tsx`.

## Tests ajoutés
- `tests/h-briques-communes.test.ts` (16) : API motion (modèle, titre jamais automatique, paramètres de l'opération,
  styles, chevauchements, catalogue actif), rendu des cartes (sans mode, essai, écartée), monteur (relecture identique
  au lot D, schémas identiques, ancrage commun, consignes, registre et réponses claires), multicaméra en composition
  (coupes, zooms continus, angle écarté, parts), face caméra (coupée, simulation jamais en réel), analyseur (synchro
  ± 40 ms, présence ~1 image/s).
- `tests/h-avocat-mission-h.test.ts` (5) : moteur avocat de bout en bout (prises « je lis », réponse réelle enregistrée
  de l'aligneur) — options absentes : aucune clé nouvelle, une seule composition ; motion commune (carte `MotionTitre`
  rendue puis posée) ; multicaméra (réelle lue, simulée jamais lue) ; sans prise filmée : rien appelé ; monteur.
- `tests/h-facecam-multicamera.test.ts` (3) : chaîne face caméra (coupée, allumée, en panne).

## Résultats exacts (fin de session, après la 2ᵉ fusion de `origin/feat/facecam`)
- `npm ci` dans `studio-rendu/` (dépendances Remotion), `pnpm install --frozen-lockfile` à la racine, `next typegen`.
- `tsc --noEmit` racine : **0 erreur** ; `tsc --noEmit` dans `studio-rendu/` : **0 erreur**.
- `eslint .` : **0 problème** (après la correction de `EffetTransition.tsx`, rouge sur la base).
- Vitest complet : **3 166 réussis, 1 échec, 3 sautés (3 170) ; 259 fichiers verts, 1 en échec, 1 sauté (261)**, 515 s.
  Le seul échec : `e2e-verif1-bc-serie` (« CORRECTEUR FINAL A », *Test timed out in 5000ms*), échec préexistant connu
  (JOURNAL-E) ; relancé seul : **14/14 vert**.
- Non-régression avocat : tests de composition, découpage, nettoyage, report (`src/moteurs/montage-avocat`), contrats
  (`montage-avocat.contrat`, `m4-studio-rendu`), G6b, F4, et le test « options absentes » de la mission H : **verts**.
- `next build` : **réussi**.

## Ce qui reste
- **Après l'intégration de F2** : brancher le catalogue étendu dans `CATALOGUE_ACTIF` (`pourFormat.ts`, 5 fonctions).
- **Après F3/G** : faire pointer `montage-facecam/monteur/operations.ts` sur les schémas et la relecture de la brique
  (`lireReponseOperations(brut, schemaOperationFacecam, [reparerEffetSpecial, enCarteSurMesure])`), même résultat.
- **Avocat, Claude** : l'adaptateur avocat n'a que la version simple (règles fixes) ; un rôle Claude « monteur avocat »
  (même chemin de dépense et plafond que le face caméra) reste à écrire. Écran : fil « Discuter avec mon monteur » pour
  l'avocat (les consignes arrivent par `video.entrees.avocatConsignes`).
- **Consignes dites dans une prise avocat** : la prise est calée par alignement FORCÉ sur le texte ; une phrase
  « Monteur, … » hors texte n'y apparaît pas. Il faut une transcription libre de la prise (route `/transcrire` du
  face caméra) pour la relever automatiquement ; `consignesDites(mots)` est prêt.
- **Multicaméra réelle** : la passe attend les rendus HeyGen dans le tour (bloquant en réel) → la découper en phases
  comme le double (lot R7d) avant `reel: true`. Face caméra : extraire le son de la piste montée (WAV) pour
  `audio_url` ; passer la piste aux compositions des déclinaisons F1.
- **Analyseur** : mesure réelle à valider sur un essai de 15 s par angle (JOURNAL-F4, « Ce que Will doit faire »).
- **Format ajouté (avocat)** : les cartes motion sont rendues par ratio au lancement ; un format ajouté plus tard garde
  les plans d'origine (ses cartes ne sont pas encore rendues).
- `briques/habillage-facecam` → `briques/habillage` ; son des prises avocat par `/son` (voir CENTRALISATION.md).

## Réglages à allumer après la mise en ligne (tous cachés, coupés par défaut)
| Réglage (table des paramètres) | Valeur pour allumer | Effet |
|---|---|---|
| `avocat.motionCommune` | `true` ou `{ "actif": true, "habitude": ["en spectaculaire"] }` | Cartes de la brique motion aux places des illustrations, titres et emphases de l'avocat. |
| `avocat.monteur` | `true` | Les consignes de `video.entrees.avocatConsignes` sont lues par le monteur commun (version simple). |
| `avocat.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Avocat « je lis » en 3 caméras (simulation tant que `reel` est faux). |
| `facecam.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Face caméra en 3 caméras (simulation tant que `reel` est faux). |
| `…multicamera.reel` + `looks[<double>]` | `true` + identifiants des looks « côté » et « contre-plongée » | Seulement après l'essai de 15 s par angle validé par Will ; exige `STUDIO_RENDU_URL` et `STUDIO_ALIGNEUR_URL`. |
