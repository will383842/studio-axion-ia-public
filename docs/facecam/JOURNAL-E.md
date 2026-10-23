# Journal du lot E « Intégration » — 09/10/2026 (session cloud, branche `feat/facecam`)

Référence : `PLAN-FACECAM-v4.md` (le plan qui prime), journaux `JOURNAL.md` (A), `JOURNAL-B.md`, `JOURNAL-C.md`,
`JOURNAL-D.md`, `JOURNAL-E1.md`, `JOURNAL-E2.md`. Travail fait directement sur `feat/facecam`. Rien n'est fusionné dans
master, aucune PR, aucun déploiement, aucun serveur touché. `refusAuLancement` est GARDÉ et le format reste `masque` :
la bascule est préparée à part (`ACTIVATION-FACECAM.patch`, voir § 4).

## 1. Raccords faits entre les lots

| Raccord | Où | Comportement |
|---|---|---|
| Dernier correctif du lot D (accord de prix côté serveur) | fusion `origin/feat/facecam-d` | `confirme: false` + `accordDuFormat` : `c1-argent-b6` vert. |
| **Habillage (lot C) branché sur la chaîne (lot B)** | `montage-facecam/chaine.ts` (étape 7), `etapes-chaine.ts` | Après la piste montée et les mots montés : `habillageFacecam()` → chaque carte part en opération `composition` **sans mode** (aucun contrat nouveau), puis la composition finale `mode: "complet"` par `avancerCompositions` (mêmes reprises que l'avocat) avec `sourcePreCadree`, `source10bits`, écrans partagés, cartes plein écran, ligne des sous-titres, Look des B-roll. La vidéo livrée est la vidéo composée (sous-titres vérifiés) ; la piste montée reste dans `projetMontage.montageCle`. Carte ratée (1 nouvel essai) → retirée, « 1 élément non fait » ; composition en panne définitive → piste montée livrée sans habillage. Étapes « Les sous-titres et cartes » et « La vidéo finale » suivent les rendus. |
| Brique commune `composition` | `briques/composition/montage.ts` | `BaseComposition.supplements` (facultatif) : les champs face caméra de l'`EntreeComposition`. Absent : rien ne change (avocat inchangé). |
| **Agent monteur (lot D)** | `chaine.ts` (2 bis) + `services/facecam-branchements.ts` | Une fois, dès les coupes : `monteurPourFabrication` reçoit les mots de la prise et les entrées **avec les coupes calculées** (temps du montage justes) ; plafond atteint → version simple sans appel Claude. Ses entrées (passages, consignes, `facecamMonteur`) sont gardées sur la vidéo ; ses cartes (`cartesDesPassages`) partent à l'habillage. Panne → « 1 élément non fait — Le monteur », jamais bloquant. |
| Correspondances D → C | `montage-facecam/raccords.ts` | `ajouterCarte` → `CartePosee` : `ecran-partage` → `moitie-haute`, `textes` → données (`carteDepuisTextes`), `CodeCarte.timeline` → `CodeSurMesure.js` (code relu sur R2), carte sur mesure sans code → modèle fixe choisi d'après la description (`choisirModele`). `CONVENTION_TEXTES` ajouté à la consigne du monteur. |
| `relireImagesControle` (lot D) | `index.ts` du moteur + branchements | À la fin de la chaîne (version complète seulement) : relecture Claude de la vignette de la vidéo finie ; défauts journalisés en console. Jamais bloquante. |
| **Décor IA (lot E1)** | `chaine.ts` (5 bis), `index.ts`, `fabrication.ts`, Réglages | `entrees.facecamDecorIa` figé au lancement depuis `facecam.decorIa.actif` (**coupé par défaut**). Coupé : aucune étape, rien n'est appelé. Allumé : étape « Le décor » après « L'image » ; `passeDecorFacecam` ; décor appliqué → `decor` (plan) donné au cadrage ; repli → « 1 élément non fait — Le décor ». Les routes du studio-aligneur pour extraire / reposer / mesurer un passage n'existent pas encore : `extrairePassage` rend `null`, donc **aucun crédit n'est dépensé** (repli « Décor non réussi »). Section « Décor IA » posée dans Réglages, visible avec « Mon monteur » au passage en `actif`. |
| **Sélecteur Drive (lot E2) sur l'envoi facecam (lot D)** | `components/facecam/EnvoiIphone.tsx` | « Depuis mon Google Drive » sous « Choisir ma vidéo » : `SelecteurDrive` (cible `rush` / variante, même dépôt R2 par morceaux) puis la même réception que l'iPhone (`recevoirVideoFacecamAction`, demande au monteur comprise). |
| `plafondClaudeAtteint` | `fabrication.ts` | Déjà rempli pour `facecam` par le lot D (vérifié). |
| **Réglage caché « réel »** | `fabrication.ts` (`PARAM_FACECAM_REEL = "facecam.aligneur.reel"`) | Lu au lancement, **coupé par défaut**, aucun écran. Allumé : `entrees.facecamAligneurReel = true` ; avec `STUDIO_ALIGNEUR_URL`, la chaîne réelle monte la vidéo. Sinon le moteur garde son squelette et refuse le lancement. |
| Livraison → `entrees.facecam` | `services/travaux.ts`, `raccords.ts` (`entreesAvecLivraison`) | À la fin du travail : clés R2 (piste, points, transcription), coupes auto ; coupes rétablies, passages et consignes écrites gardés ; consigne dite ajoutée une fois. |
| Injection des services | `montage-facecam/dependances.ts` | `brancherServicesFacecam()` (le moteur pur n'importe jamais un service) ; posé au chargement de `services/facecam-branchements.ts` (importé par `fabrication.ts` et `boucle.ts`, services lourds importés à la demande : pas de cycle). Habillage seulement si `studio-rendu` est réel (`STUDIO_RENDU_URL`) : sinon la piste montée est livrée telle quelle (jamais de fausse clé). |

## 2. Échecs connus corrigés

- `c1-argent-b6-confirmation` : corrigé par le lot D (fusionné ici), vert.
- `e2e1-secu-variables` : `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_URL` transmises par le compose (`${VAR:-}`) et documentées
  vides dans `env.exemple`. `GOOGLE_DRIVE_ESSAI` est un réglage du **double** : déclaré « développement seulement »
  (ignoré quand `NODE_ENV=production`, commenté dans `env.exemple`, jamais transmis) ; le test reçoit cette variable
  dans sa liste `DEVELOPPEMENT` (registre que le test tient, comme `STUDIO_APERCU_MESURES`). Les variables Google OAuth
  étaient déjà transmises (lot E2).
- `garde-ecran` : exemple de recherche Drive « Chercher par nom de fichier » (plus de `IMG_7747`) ; journal du Décor IA =
  la phrase pour Will (`resultat.message`), statut et raison en `console.warn`.
- `garde-regle-unique` : `MO` importé de `lib/envoi-multipart` ; les délais Google Drive et Higgsfield, règles
  distinctes, renommés `DELAI_GOOGLE_MS` et `DELAI_HIGGSFIELD_MS`.
- `g7a-programmer` (rouge AVANT le chantier, aussi rouge sur `origin/master`) : **test faux** — écrit le 03/10 avec un
  jour J au 05/10, devenu passé ; un brouillon passé ne compte plus comme envoyé (règle voulue). Horloge figée au 03/10
  dans ce test (`vi.useFakeTimers({ toFake: ["Date"] })`), code inchangé.
- Lint (`eslint .`) : 2 erreurs dans `FilMonteur.tsx` (lot D) corrigées (fil reçu recopié pendant le rendu, identifiant
  provisoire sans `Date.now`).

## 3. Vérification complète (une fois, à la fin, sur `cb1bfe3`)

- `next typegen` : OK. `tsc --noEmit` (racine) : **0 erreur** (après `npm ci` dans `studio-rendu/` pour Remotion ;
  sans lui, les 9 seules erreurs sont les modules Remotion absents). `tsc` dans `studio-rendu/` : 0 erreur.
- `eslint .` : **0 problème**.
- Vitest complet : **3 050 réussis, 1 échec, 3 sautés (3 054) ; 250 fichiers verts, 1 en échec, 1 sauté (252)**.
  Le seul échec : `e2e-verif1-bc-serie` (« Reprendre l'écriture après 3 pannes », dépassement de 5 s). Relancé seul :
  1 échec puis 14/14 vert. **Préexistant prouvé** : sur `origin/master` (arbre séparé), 3 lancements seuls → 1 échec,
  puis 2 verts ; c'est un test sensible à la charge, sans lien avec le face caméra.
- Nouveau : `tests/facecam-integration.test.ts` (11 tests) — correspondances D → C, livraison → `entrees.facecam`,
  chaîne → monteur → cartes → composition finale, carte ratée, composition en panne, monteur en panne, Décor IA coupé /
  appliqué / repli, étape « Le décor », branchements, réel jamais pris par défaut, `refusAuLancement` gardé.
- `next build` : **réussi**.
- Python `studio-aligneur` : `python -m unittest discover -s tests` → **26 tests OK** (numpy 2.1.3 seul, sans modèles).
- `origin/master` n'a pas avancé (0 commit à reprendre) : rien à fusionner.
- Lot C2 (`feat/facecam-c2`) : voir § 6 (fusionné après cette vérification, suite repassée).

## 4. Liste précise pour la mise en ligne (session locale)

### Variables d'environnement (`.env` du serveur, transmises par le compose)
- Chaîne vidéo : `STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200` (active aussi le profil `calage` par
  `mettre-a-jour.sh`), `FOURNISSEUR_ALIGNEMENT=studio-aligneur`, `STUDIO_RENDU_CLE` (déjà posée, partagée).
  Facultatif : `STUDIO_ALIGNEUR_DELAI_SEC` (900 par défaut ; une passe image de 2 min ≈ 18 min mesurée au lot B → **poser
  1800**).
- Habillage : `STUDIO_RENDU_URL` (à vérifier sur le serveur : sans elle, la piste montée sort sans sous-titres ni cartes).
- Google Drive (lot E2) : `FOURNISSEUR_GOOGLE_DRIVE=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_DRIVE_COMPTE=compte@exemple.fr` ; facultatifs `GOOGLE_REDIRECTION`, `GOOGLE_DRIVE_CLE`.
  Ne JAMAIS poser `GOOGLE_DRIVE_ESSAI`.
- Décor IA (lot E1) : `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL` — **à laisser vides** tant que les routes d'extraction
  ne sont pas écrites et l'API vérifiée (`src/fournisseurs/higgsfield/API.md`).

### Conteneurs
- `COMPOSE_PROFILES` / profil **`calage`** : actif dès que `STUDIO_ALIGNEUR_URL` est une adresse http(s)
  (`deploiement/commun.sh`, `calage_actif`). Vérifier `docker compose --profile calage ps`.
- `docker build` de `studio-aligneur` : le Dockerfile lance `python -m aligneur --precharger` (tests compris) ; vérifier
  que le journal du build affiche les **4 lignes « prêt »** (Whisper small, MediaPipe visage, MediaPipe mains,
  DeepFilterNet ; repli `afftdn` si DeepFilterNet ne charge pas). Prévoir ≥ 6 Go de disque, plus 2 à 4 Go de `/tmp` par
  vidéo de 2 min.
- `mem_limit` de `studio-aligneur` : **3500m** (déjà dans le compose ; **4500m depuis le 09/10**, pic mesuré en
  production 3,23 Go sur 3,42 Go pendant une passe image de 2 min, voir docs/JOURNAL-FFMPEG-RECENT.md ; **6000m depuis
  le 10/10** : la passe « formats » a atteint 4,40 Go, fils FFmpeg désormais bornés, voir
  docs/facecam/JOURNAL-FICHE-CARTES-FORMATS.md) ; contrôler `docker stats` pendant une passe image (pic attendu < 6 Go). `studio-rendu` : 3g, inchangé (cartes ≈ 3,5 min chacune sur 4 cœurs : surveiller la file).
- `studio-rendu` : reconstruire l'image (brique `motion` copiée, compositions `Motion*` et `CarteSurMesure`).

### Ce qu'il faut basculer pour passer en actif — `docs/facecam/ACTIVATION-FACECAM.patch`
`git apply docs/facecam/ACTIVATION-FACECAM.patch` (vérifié applicable sur `feat/facecam`) fait exactement :
1. `src/formats/facecam/index.ts` : `statut: "masque"` → `"actif"` (+ `tests/facecam-fondations.test.ts` qui le vérifie) ;
   « Mon monteur » et « Décor IA » apparaissent alors dans Réglages.
2. `src/services/fabrication.ts` : réglage caché `facecam.aligneur.reel` **allumé par défaut** (`false` en base le
   recoupe sans redéployer).
3. `refusAuLancement` : **gardé** (recommandé), message rendu actionnable. Depuis le lot B il ne refuse QUE quand la
   chaîne réelle n'est pas disponible (réglage coupé ou `STUDIO_ALIGNEUR_URL` absente) : le retirer ferait sortir les
   vidéos de démonstration du squelette comme de vraies vidéos. Ne le retirer que si l'on veut ce comportement.
Puis : `tsc`, Vitest complet, `next build`, et un essai réel sur IMG_7747 (temps, mémoire, bruit, ΔE, coupes).

### Restes connus (non bloquants pour la mise en ligne)
- Décor IA : routes `studio-aligneur` d'extraction / dépôt / mesure d'un passage, et lecture du plan `decor` dans
  l'étape « cadrage » de `/image` (aujourd'hui ignoré par Python) ; API Higgsfield supposée.
- `retoucher()` réelle (lot D) et `capacites.retoucheParPlan` : tant qu'ils manquent, le fil et les feuilles sont refusés
  hors démo (`RETOUCHE_INDISPONIBLE`).
- Relecture : une seule image (la vignette) ; les corrections proposées ne sont pas encore appliquées (journalisées).
- Plafond par vidéo des textes Claude (0,30 $) partagé avec le monteur : relever `claude.plafondKitUsd` avant la
  mise en ligne, sinon la version simple sort souvent.
- Vignette et côté (`miseEnPage`), écran partagé 4:5 / 1:1 : lot C.

## 6. Fusion du lot C2 (et du lot F4 arrivé entre-temps), suite repassée

- `JOURNAL-C2.md` publié sur `origin/feat/facecam-c2` à 10:51 UTC : fusion sans conflit. Raccord ajouté : le style de
  chaque carte (lot C2) est posé à l'habillage (`cartePosee` : demande de Will lue dans la description, sinon vidéo
  « très dynamique » → Spectaculaire, sinon Sobre ; test ajouté, 12 tests dans `facecam-integration`).
- Une autre session avait poussé sur `origin/feat/facecam` la même fusion C2 et le lot F4 (multicaméra avocat, coupé par
  défaut) : refusionnés ici par un commit de fusion, sans conflit.
- Après fusion : `tsc --noEmit` **0 erreur**, `eslint .` **0 problème**, Vitest complet **3 090 réussis, 2 échecs,
  2 sautés (3 094) ; 252 fichiers verts, 2 en échec, 1 sauté (255)** :
  - `e2e-verif1-bc-serie` : dépassement de 5 s sous charge ; **relancé seul : 14/14 vert** (instable aussi sur master) ;
  - `e2e-verif1-g-import-autonome` : ne tourne que si `.next/standalone` existe (créé par le `next build` de cette
    session) et suppose la disposition **pnpm** de `node_modules` ; le cloud a installé par `npm` (sans
    `pnpm-lock`), donc `unpdf` est en tête de `node_modules`. Artefact d'environnement, sans lien avec le code
    (à repasser localement avec `pnpm install`).

## 5. Texte de PR prêt à coller

```
Titre : Face caméra — format complet (lots A à E) : chaîne vidéo, habillage, agent monteur, Décor IA, Google Drive

## Résumé
Nouveau format « Vidéo face caméra » : Will se filme à l'iPhone (ou choisit sa vidéo dans Google Drive), le studio
coupe (reprises, hésitations, consignes « Monteur, … »), règle le son (−14 LUFS) et l'image (Look Will, 10 bits),
cadre en 9:16, puis habille (sous-titres calés au mot, écrans partagés, cartes de motion design) et livre.
- Lot A : fondations (format masqué, moteur `montage-facecam`, sans prix, plafond Claude → version simple).
- Lot B : chaîne vidéo réelle dans `studio-aligneur` (/transcrire, /visages, /son, /image), coupes, réalisation.
- Lot C : brique commune `motion` (6 modèles + carte sur mesure), habillage pré-cadré 10 bits dans `studio-rendu`.
- Lot D : parcours (envoi iPhone, attente, « Votre vidéo », fil « Discuter avec mon monteur »), agent monteur.
- Lot E1 : Décor IA (Higgsfield), option coupée par défaut. Lot E2 : import Google Drive (lecture seule).
- Lot E : raccords entre lots, réglage caché du réel (coupé), échecs connus de la suite corrigés.

## Sécurité et argent
- Aucun prix affiché pour le face caméra ; aucune confirmation écrite en dur (`accordDuFormat` côté serveur).
- Réel jamais pris par défaut : réglage caché `facecam.aligneur.reel` + `STUDIO_ALIGNEUR_URL`.
- Décor IA coupé par défaut, aucun crédit dépensé tant que les routes d'extraction manquent.
- Jetons Google chiffrés (AES-256-GCM), portée `drive.readonly`, jamais envoyés au navigateur.

## Vérifications
- tsc 0 erreur, eslint 0 problème, next build OK.
- Vitest : 3 090 réussis / 3 094 (`e2e-verif1-bc-serie` : dépassement de 5 s sous charge, vert seul, instable aussi
  sur master ; `g-import-autonome` : disposition npm au lieu de pnpm dans le cloud).
- Python studio-aligneur : 26 tests OK.

## Mise en ligne
Voir docs/facecam/JOURNAL-E.md § 4 (variables, profil `calage`, build avec `--precharger`, mem_limit,
docs/facecam/ACTIVATION-FACECAM.patch pour passer en actif).
```
