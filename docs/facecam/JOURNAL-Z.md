# Journal de la mission Z « Intégration finale » — 09/10/2026 (session cloud, branche `feat/facecam`)

Plan qui prime : `PLAN-FACECAM-v4.md`. Démarrage 12:00 UTC, fin des fusions 12:43 UTC, vérification complète
12:44-13:05 UTC. **Rien n'est fusionné dans master, aucune PR ouverte, rien déployé, aucun serveur touché, aucune
dépense** (aucun appel Claude, HeyGen ni Higgsfield ; doubles de simulation seulement). Poussé par petits commits sur
`origin/feat/facecam`.

## 1. Fusions faites (dans l'ordre) et conflits résolus

| # | Branche | Commit de fusion | Conflits | Résolution |
|---|---|---|---|---|
| 1 | `origin/feat/facecam-g` (retouche réelle, mise en page, relecture appliquée, Décor IA, plafond) | `b8fee28` | `composition/scene.ts`, `montage-facecam/chaine.ts` (7 blocs), `montage-facecam/dependances.ts`, `services/facecam-branchements.ts` | Les deux apports gardés partout (détail ci-dessous). |
| 2 | `origin/feat/facecam-h` (centralisation) | `4991229` | `composition/montage.ts`, `montage-facecam/chaine.ts` | `supplementsMiseEnPage` (G) + `supplementsParRatio` et `multicamera` (H) ; mises en page + piste multicaméra dans la base de composition. |
| 3 | `origin/feat/facecam-f1` (3 commits arrivés après son intégration) | `ea4d77e` | `chaine.ts`, `declinaisons.ts` (déjà réglés par H : `ESSAIS_MAX` exporté une fois) | Côté intégration gardé ; apport F1 : style des cartes repris par les formats. |
| 4 | `origin/feat/facecam-f3` (6 commits arrivés après son intégration) | `40fe72f` | `tests/facecam-effets-speciaux.test.ts` | Les deux intentions gardées (voir § 3). Apport : flou float16, garde-fou visage en cascade, pli lisible, planche finale. |
| 5 | `origin/feat/facecam-f2` (modèles 7-13) — `JOURNAL-F2.md` vu à 12:37 | `748bece` | aucun | Catalogue étendu branché dans `CATALOGUE_ACTIF` (§ 2). |
| 6 | `origin/feat/facecam-i2` (objet posé sur la paume) — `JOURNAL-I2.md` vu à 12:37 | `b25a2ad` | aucun | « Reste » d'I2 raccordé (§ 2). |

### Détail de la fusion G × I
- `scene.ts` : `PlanScene.sansLook` (I) **et** `PlanScene.miseEnPage` (G).
- `dependances.ts` : `ServicesFacecam.relire` (contexte `ContexteRelecture` avec `imagesEffets`, I), `lireImageRvb` (I)
  **et** `relecture` (relecture ciblée, G).
- `facecam-branchements.ts` : `debutDuTravail` + `maintenant` (G) et le type `ImageRvb` (I) ; le monteur rend
  `cartes`, `passages` (I) **et** `entrees` (G) ; branchements `lireImageRvb` (I) **et** `relecture` (G).
- `chaine.ts` :
  - `EtatChaine.monteur` porte `entrees` (G) et `effets` (I) ; la dépendance `monteur` rend `entrees` et `passages` ;
    `DependancesChaine` a `lireImageRvb` (I) et `relire` (G) ;
  - habillage : cartes reprises par empreinte et sous-titres corrigés (G), PUIS effets spéciaux (I), cartes plein
    écran des effets ajoutées (I), mises en page posées (G) ;
  - **la retouche réelle (G) reprend les effets (I)** : `effetsDesEntrees(entrees)` (nouveau, `retouche.ts`) remet dans
    `etat.monteur.effets` les passages d'effets en vigueur (le monteur n'est jamais rappelé), dans `etatPourRetouche`
    et dans les deux replis de `index.ts` (`retoucher`, `recalquer`). L'empreinte `habillage` de `signatureMontage`
    contient déjà l'opération et `sansDetourage` de chaque passage : **un effet ajouté, réglé ou retiré ne relance que
    l'habillage** (testé) ;
  - relecture ciblée (G) : le milieu de chaque effet est relu sous l'identifiant de son passage, légende « Effet
    spécial à … — le visage doit rester visible » (reprend l'intention du contrôle du lot I). L'ancienne relecture
    « vignette + imagesEffets » du lot I ne sert plus que sans relecture ciblée (règle du lot G).
- Fusion H : la piste multicaméra est rangée dans la reprise et **reprise par la retouche tant que la piste montée
  n'est pas refaite** (habillage seul) ; refaite si coupes, image ou son changent (aucun angle refabriqué pour une carte).

## 2. « Ce qui reste » appliqué
- **H** — `montage-facecam/monteur/operations.ts` pointe sur la brique commune : `schemaConsigneLue` (brique),
  `schemaReponseMonteur = schemaReponsePour(schemaOperationFacecam)`, `lireReponseMonteur = lireReponseOperations(brut,
  schemaOperationFacecam, [reparerEffetSpecial, enCarteSurMesure])` ; même résultat (tests du lot D, F3, H verts + test Z).
- **H / F3 / I** — effets dans le catalogue commun : `src/briques/monteur/effets.ts` (`CATALOGUE_EFFETS_COMMUN`,
  exporté par la brique) ; `CATALOGUE_EFFETS` du face caméra en est la copie (mêmes entrées, même ordre).
- **F2** — `CATALOGUE_ACTIF` (`pourFormat.ts`) = `CATALOGUE_ACTIF_ETENDU` (13 modèles) ; les 6 modèles du lot C restent en
  `CATALOGUE_ACTIF_BASE`. Le titre plein écran n'est jamais choisi seul. ⚠️ Conformément au JOURNAL-F2 (validation de
  Will d'abord), le **vocabulaire du monteur face caméra reste à 6 modèles** (`MODELES_CARTE`, option
  `modelesEtendus` coupée) : seuls les formats qui passent par l'API unique `cartesPourFormat` (avocat avec
  `avocat.motionCommune`, coupé par défaut ; formats futurs) voient les 13 modèles. Test F2 « non branché » adapté.
- **I2** — raccords laissés « au lot qui tient la chaîne » :
  - `effets-chaine.ts` : `realismeDeLaVignette` (reflets `carteEnvironnement`, flou et grain `caracterePrise` de la
    vignette, flou ramené en px de sortie) passés à `preparerObjetMain` (facultatifs ; sans vignette, rendu d'avant) ;
  - `studio-aligneur/aligneur/visages.py` : chaque main porte ses **21 points** (x recalé par la bande, z à l'échelle
    de la largeur) et son **côté** (`Left` → `gauche`) — sans eux, la production gardait l'objet qui flotte. Tests purs
    `studio-aligneur/tests/test_mains.py` (2).
- **eslint F2** : 3 erreurs `react-hooks/immutability` (`MotionGraphique.tsx`, `GraphiqueSpectaculaire.tsx`,
  `TitrePleinEcranSpectaculaire.tsx`) corrigées sans changer l'image (parts du camembert et premier mot clé calculés
  avant le rendu), + 2 avertissements (variables inutilisées).

## 3. Échecs signalés par G — état
- `facecam-effets-speciaux` (catalogue) : ordre retenu = **carte, style C2 « Fais cette animation en spectaculaire »,
  puis les 6 familles suivantes (8 exemples), puis les 3 effets F3 en fin (11 au total)**. Le test garde les deux
  intentions : les 8 exemples d'avant en tête avec le style C2 juste après la carte, ET la liste de 11 fermée par les 3
  effets. Vert.
- `final-b-image-rendu-fichiers` : la brique `effets-speciaux` est copiée par `deploiement/studio-rendu/Dockerfile`
  (lots I et H) ; `mise-en-page.ts` (G) aussi. Vert (52 tests).
- `EffetTransition.tsx` : corrigé par H ; l'erreur n'est pas revenue après la fusion des derniers commits F3.
- `garde-regle-unique` : vert (`ESSAIS_MAX` écrit une fois).

## 4. Résultats EXACTS (une seule vérification complète, après toutes les fusions)
Sur `feat/facecam` à `c4e39db` (+ ce journal) :
- `npm ci` dans `studio-rendu/` : OK. `pnpm install --frozen-lockfile` à la racine : OK. `npx next typegen` : OK.
- `tsc --noEmit` racine : **0 erreur**. `tsc --noEmit` dans `studio-rendu/` : **0 erreur**.
- `eslint .` : **0 problème** (après la correction des 3 erreurs F2 ; 1ʳᵉ passe : 3 erreurs, 2 avertissements).
- Vitest complet : **3 259 réussis, 1 échec, 3 sautés (3 263) ; 266 fichiers verts, 1 en échec, 1 sauté (268)**, 551 s.
  Le seul échec : `e2e-verif1-bc-serie` « CORRECTEUR FINAL A » (*Test timed out in 5000ms*), échec préexistant connu
  sensible à la charge ; **relancé seul : 14/14 vert**.
- Non-régression avocat (dans la suite complète, et en ciblé avant : `src/moteurs/montage-avocat`, `montage-avocat`,
  `m4`, `g6b`, `f4`, `h-avocat-mission-h` « options absentes ») : **vert**.
- `next build` : **réussi**.
- Python `studio-aligneur` : `python3 -m unittest discover -s tests` → **33 tests OK** (31 + 2 de `test_mains.py`).
  Remarque d'environnement : numpy n'était pas installé dans ce conteneur (3 erreurs d'import à la 1ʳᵉ passe), installé
  par `python3 -m pip install numpy`, puis tout vert ; rien à voir avec le code (l'image Docker l'embarque).
- Nouveaux tests : `tests/z-integration-facecam.test.ts` (6) : retouche × effets × multicaméra, relecture commune,
  catalogue commun, réalisme de la vignette.
- `git apply --check docs/facecam/ACTIVATION-FACECAM.patch` : **OK** sur la branche finale.

## 5. Branches non fusionnées
- Aucune branche `feat/facecam-*` n'a de commit absent de `feat/facecam` à 12:44 UTC (b, c, c2, d, e1, e2, f1, f2, f3,
  f4, g, h, i, i2 : 0). F2 et I2 sont arrivées à temps (12:37, bien avant la limite de 14:30).
- Non branché volontairement : vocabulaire du monteur à 13 modèles (attend la validation de Will sur la planche 7-13) ;
  option « ultra réaliste » d'I2 (réglage, demande, image de référence, dépense : à écrire) ; effets dans les
  déclinaisons 4:5 / 1:1 / 16:9.

## 6. LISTE DE MISE EN LIGNE (complète, à faire par Will — rien n'est fait ici)

### 6.1 Variables d'environnement (`.env` du serveur)
- Chaîne : `STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200` (active le profil `calage`), `FOURNISSEUR_ALIGNEMENT=
  studio-aligneur`, `STUDIO_RENDU_CLE` (déjà posée), **`STUDIO_ALIGNEUR_DELAI_SEC=1800`** (passe image de 2 min ≈ 18 min).
- Habillage : `STUDIO_RENDU_URL=http://studio-rendu:4100` (sans elle : piste montée sans sous-titres, cartes ni effets).
- Google Drive (E2) : `FOURNISSEUR_GOOGLE_DRIVE=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_DRIVE_COMPTE` ; facultatifs `GOOGLE_REDIRECTION`, `GOOGLE_DRIVE_CLE`. **Jamais** `GOOGLE_DRIVE_ESSAI`.
- Higgsfield (Décor IA E1/G, ultra réaliste I2, effet réaliste par IA K) : `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL`
  **à laisser VIDES** (passe décor encore séquentielle, API supposée). Même posées, rien ne part sans le jeton de
  confirmation de la version (garde serveur du lot J). Mission V : J, K et L n'ajoutent **aucune autre variable**.

### 6.2 Conteneurs à reconstruire (les trois)
1. **app** (`studio`) : tout le code des lots A à Z, plus J (cartes « Option payante » et garde serveur), K (effet
   réaliste par IA) et L (13 modèles dans le monteur). Après `git apply docs/facecam/ACTIVATION-FACECAM.patch` si l'on
   passe en actif (format visible, `facecam.aligneur.reel` allumé par défaut, refus clair sans chaîne réelle).
   Facultatif : FFmpeg dans l'image de l'app → lumière, reflets et grain mesurés sur la vignette (sinon repli
   `luminanceVisage`, sans reflets mesurés).
2. **studio-rendu** : brique `motion` (13 modèles, Sobre + Spectaculaire), `CarteSurMesure`, mise en page côté /
   vignette (graphe FFmpeg), multicaméra (angle par morceau), compositions d'effets + brique `effets-speciaux`
   (`paume.ts`, `ObjetSurPaume`, objets réalistes), `crf` facultatif de l'opération `composition`. Tant qu'il n'est
   pas reconstruit, le `crf: 10` des effets est ignoré et les compositions F2/I2 n'existent pas.
3. **studio-aligneur** : `decor.py` (extraire / reposer / mesurer), étapes `images` et décor de `/image`, teinte,
   volume et débruitage de `/son`, **points et côté des mains dans `/visages`** (I2/Z). Lot K : `reposer` accepte
   `original`, `fonduSec`, `accorderCouleurs` (raccord de couleur et fondu de 0,2 s), le cadrage lit le plan `effets`. Vérifier les 4 lignes « prêt »
   du `--precharger` (Whisper small, MediaPipe visage, MediaPipe mains, DeepFilterNet ; repli `afftdn`).

### 6.3 Mémoire, disque, délais
- `studio-aligneur` : `mem_limit 6000m` depuis le 10/10 (3500m avant le 09/10 : pic 3,23 Go sur 3,42 Go ; 4500m le
  09/10 ; la passe « formats » a ensuite atteint 4,40 Go, voir docs/facecam/JOURNAL-FICHE-CARTES-FORMATS.md), 2 CPU
  (compose) ; pic attendu < 6 Go sur une passe image (contrôler
  `docker stats`) ; ≥ 6 Go de disque pour l'image, 2 à 4 Go de `/tmp` par vidéo de 2 min.
- `studio-rendu` : `mem_limit 3g` inchangé ; temps : carte ≈ 3,5 min (4 cœurs), cartes Spectaculaire 3D de F2 plus
  lentes (25-33 s pour 10 images fixes), objet sur la paume ≈ 0,8 s par image (suréchantillonnage 2×, WebGL logiciel),
  vitre qui révèle une carte > 30 s par image sous charge → surveiller la file.
- app : `mem_limit 1g` inchangé.
- Retouche : estimation « Prête vers » (passe image ≈ 9 × la durée, son ≈ 0,5 ×, piste ≈ 1 ×, carte ≈ 3,5 min,
  composition ≈ 1,5 × + 1 min).
- R2 : ne pas purger les versions d'une vidéo encore en ligne (les cartes reprises sont lues sous la version d'origine).

### 6.4 Réglages cachés (table des paramètres) — à allumer APRÈS la mise en ligne, un par un
| Réglage | Valeur | Quand |
|---|---|---|
| `facecam.aligneur.reel` | `true` (défaut avec le correctif d'activation ; `false` le coupe) | Dès la mise en ligne. |
| `facecam.plafondVersionUsd` | 1,50 par défaut (rien à poser) | Seulement pour changer le plafond du monteur par version. |
| `facecam.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Après un essai simulé. |
| `avocat.motionCommune` | `true` ou `{ "actif": true, "habitude": ["en spectaculaire"] }` | Après validation de la planche 7-13 (13 modèles actifs). |
| `avocat.monteur` | `true` | Quand Will veut les consignes avocat (version simple). |
| `avocat.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Après un essai simulé. |
| `…multicamera.reel` + `looks` | `true` + looks « côté » / « contre-plongée » | Après l'essai de 15 s par angle validé (exige les deux URL). |
| `facecam.decorIa` (`actif`, `reel`) | **laisser coupé** | Tant que la passe décor n'est pas en machine à états et l'API Higgsfield vérifiée. |
| Ultra réaliste (I2) | coupé (`REGLAGE_ULTRA_REALISTE_DEFAUT`), pas encore de réglage en base | À brancher plus tard. |
| `optionsPayantes.prixCreditHiggsfieldCentimes` (J) | 5 par défaut (rien à poser) | À recaler sur la 1ʳᵉ facture Higgsfield (sert au devis de la carte « Option payante »). |
| `optionsPayantes.demandes` (J) | écrit par le studio (cartes en attente, jetons) | **Ne jamais écrire à la main.** |
| `facecam.effetRealiste` (K) | `{ "reel": false }` par défaut (double de simulation) | Après l'essai réel conseillé (JOURNAL-K : 1 passage de 5 s, < 1 €) : `{ "reel": true }` + les 2 variables Higgsfield. Chaque effet reste confirmé une fois. |
| `facecam.effetsRealistes.<videoId>` (K) | écrit par le studio (effets déjà payés, repris sans repayer) | Ne jamais écrire à la main. |
| Monteur à 13 modèles (L) | **actif par défaut** (aucun réglage) | Rien à faire ; le titre plein écran n'est posé que sur demande. |

### 6.5 Contrôles après le premier essai réel (IMG_7747)
- Temps, mémoire, bruit, ΔE, coupes ; une retouche « carte » ne soumet AUCUN travail au studio-aligneur, une retouche
  « image » seulement `passe` + `cadrage`, la relecture une étape `images` ; un effet : main paume vers le haut
  reconnue (sinon conseil « Montrez la paume ouverte vers le haut… »), visage jamais caché.

## 7. Texte de PR prêt à coller (ne PAS ouvrir sans l'accord de Will)

> Remplacé par le texte final (lots A à L) de `JOURNAL-V.md` § 6 ; la liste ci-dessus (§ 6) est complétée par V.

```
Titre : Face caméra — format complet (lots A à Z) : chaîne vidéo, habillage, monteur, retouche réelle, effets, briques communes

## Résumé
Nouveau format « Vidéo face caméra » : Will se filme à l'iPhone (ou choisit sa vidéo dans Google Drive), le studio
coupe, règle le son (−14 LUFS) et l'image (Look Will, 10 bits), cadre en 9:16, habille (sous-titres au mot, cartes de
motion design, écrans partagés, mises en page, effets spéciaux) et livre ; le fil « Discuter avec mon monteur »
modifie vraiment la vidéo.
- A : fondations (format masqué, moteur `montage-facecam`, sans prix, plafond Claude → version simple).
- B : chaîne réelle dans `studio-aligneur` (/transcrire, /visages, /son, /image), coupes, réalisation.
- C / C2 : brique commune `motion` (6 modèles + sur mesure, styles Sobre et Spectaculaire), habillage 10 bits.
- D : parcours (envoi, attente, « Votre vidéo », fil du monteur), agent monteur.
- E1 / E2 / E : Décor IA (coupé), import Google Drive (lecture seule), raccords.
- F1 : déclinaisons 4:5, 1:1, 16:9. F2 : modèles d'animation 7 à 13. F3 : effets spéciaux à la demande.
  F4 : multicaméra avocat (coupée).
- G : retouche réelle par étapes, mise en page côté / vignette, relecture Claude appliquée, Décor IA utilisable
  (coupé), plafond propre au monteur (1,50 $ / version, invisible).
- H : centralisation (API motion unique, monteur commun, multicaméra commune ; avocat en options facultatives).
- I / I2 : effets branchés dans la chaîne (rendus, ratés retirés, bruitage de verre, lumière, contrôle) ; objet posé
  sur la paume vers le haut, rendu réaliste.
- Z : intégration finale (fusions G, H, F1, F3, F2, I2 ; retouche × effets × multicaméra ; catalogue à 13 modèles
  dans l'API unique ; points des mains dans /visages).

## Sécurité et argent
- Aucun prix affiché ; aucun réel par défaut (réglage caché + URL des services) ; Décor IA, multicaméra réelle et
  ultra réaliste coupés ; jetons Google chiffrés, portée drive.readonly.

## Vérifications
- tsc 0 erreur (racine et studio-rendu), eslint 0 problème, next build OK.
- Vitest : 3 259 réussis / 3 263 (1 échec connu `e2e-verif1-bc-serie`, délai sous charge, 14/14 vert seul ; 3 sautés).
- Python studio-aligneur : 33 tests OK. Non-régression avocat : verte.

## Mise en ligne
docs/facecam/JOURNAL-Z.md § 6 (variables, 3 conteneurs à reconstruire, mémoire, réglages à allumer) et
docs/facecam/ACTIVATION-FACECAM.patch pour passer en actif.
```
