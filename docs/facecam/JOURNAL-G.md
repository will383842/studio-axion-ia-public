# Journal du lot G « Usage réel » — 09/10/2026 (session cloud, branche `feat/facecam-g`)

Référence : `PLAN-FACECAM-v4.md` (B.14, B.23, B.24, n° 11, n° 32), journaux `JOURNAL-E.md` (§ « Restes connus »),
`JOURNAL-D.md`, `JOURNAL-B.md`, `JOURNAL-E1.md`. Branche créée depuis `origin/feat/facecam`, qui y a été refusionnée
(lots F1 et F3). Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché, aucune dépense
réelle : Claude, HeyGen et Higgsfield ne sont jamais appelés (doubles de simulation, faux `fetch`).

Exigence de Will tenue : **le fil « Discuter avec mon monteur » et les consignes modifient VRAIMENT la vidéo.**

## 1. Ce qui est fait

### 1.1 `retoucher()` RÉELLE du moteur montage-facecam (+ `capacites.retoucheParPlan: true`)
- Nouveau module pur `src/moteurs/montage-facecam/retouche.ts` :
  - `signatureMontage(entrees)` : ce qui décide de chaque étape (coupes en vigueur, 3 crans d'image + teinte, réglages
    du son, empreinte de tout ce que l'habillage lit) ;
  - `partiesARefaire(avant, après)` : coupes → **assemblage** ; crans/teinte → **image** ; son → **son** ; le reste
    (carte, écran partagé, mise en page, sous-titres, style, élément retiré, consigne annulée) → **habillage seul** ;
  - `repriseDeLaChaine` : à la fin de chaque version, `projetMontage.reprise` garde les clés R2 et petits résultats
    (transcription — sans les mots en ligne —, visages, son monté, passe image 10 bits, piste montée, coupes, plans,
    mots montés, décor, formats F1 sans leur habillage, **cartes rendues par empreinte**) ; < 20 Ko ;
  - `etatPourRetouche` : état de départ de la chaîne pour la nouvelle version — ce qui reste valable est repris, le
    reste est retiré et refait par la chaîne au tour suivant. Le monteur n'est jamais rappelé (ses passages sont déjà
    dans les entrées) ;
  - `etapesRetouche` : étapes montrées et **temps estimé réaliste** (passe image ≈ 9 × la durée, son ≈ 0,5 ×, piste
    ≈ 1 ×, une carte ≈ 3,5 min, composition ≈ 1,5 × + 1 min) → « Prête vers 14 h 35 » (`heurePrete`).
- Ce qui est refait, exactement (testé, `tests/facecam-retouche.test.ts`) :
  | Consigne | Studio-aligneur | Studio-rendu |
  |---|---|---|
  | Couper / rétablir (fil, feuille Coupes, Annuler une consigne) | `son`, `image:cadrage` (passe gardée si sa bande couvre les nouveaux cadres, sinon refaite) | composition (cartes inchangées reprises) |
  | Retoucher l'image (3 crans) / « plus chaud » | `image:passe`, `image:cadrage` | composition |
  | Son (« plus fort », « sans débruitage ») | `son`, `image:cadrage` | composition |
  | Carte, écran partagé, mise en page, élément retiré, style | **rien** | seules les cartes changées + composition |
  | Sous-titres corrigés (onglet Sous-titres, « Appliquer à la vidéo ») | **rien** | composition avec ces groupes |
- La chaîne lit maintenant aussi les **coupes demandées** (« coupe ce passage ») — avant, elles étaient ignorées.
- Les entrées EFFECTIVES (commande + ce que le monteur a posé + correction de la relecture) pilotent toute la chaîne ;
  la version finie les rend (`projetMontage.entrees`) et `travaux.ts` les range sur la **version** ET la vidéo : la
  retouche suivante repart d'elles (avant, la version gardait des entrées sans les coupes ni les clés : « Ce passage
  n'existe plus »).
- **L'ancienne version reste visible pendant le recalcul** (la nouvelle n'est choisie qu'à la fin, comme avant) ; la
  réponse du fil dit « Nouvelle version prête vers 14 h 35 ; l'actuelle reste visible d'ici là ».
- `refusRetouche` (nouveau, facultatif dans le contrat des moteurs) : sans chaîne réelle, refus clair AVANT toute
  réservation (jamais une vidéo d'essai à la place de la vraie) — branché dans `lancerRetouche`, « Réessayer » et le
  recalque.
- `recalquer` (sous-titres) : la vidéo face caméra rend désormais ses sous-titres (`resultat.sousTitres`), l'onglet
  Sous-titres devient utilisable ; « Appliquer à la vidéo » ne refait que l'habillage.
- Formats du lot F1 : repris par la retouche (habillage toujours refait ; pistes des formats refaites si l'image ou le
  son changent ; formats refaits depuis les nouveaux plans si les coupes changent).
- Python : la passe image lit `teinte` (« plus chaud / plus froid », gains doux R/B) ; `/son` lit `voix.nettoyer`
  (débruitage coupé à la demande) et `voix.volume` (± 1 LU, toujours dans la tolérance du contrôle −14 ± 1).

### 1.2 Mise en page `miseEnPage{cote|vignette}` réellement rendue
- Géométrie pure `src/briques/habillage-facecam/mise-en-page.ts` :
  - **côté** : colonne de Will = 55 % de la largeur, visage à **40 %** de la largeur depuis son bord (35-45 %), la carte
    sur les 45 % restants (rendue à sa largeur : 486 px) ; entrée en 9 images (même courbe que l'écran partagé) : la
    colonne glisse de sa place vers son côté, la carte entre par l'autre bord ; sous-titres dans la colonne de Will
    (mécanisme `colonne` du lot F1) ;
  - **vignette** : carte plein écran, Will dans un coin en haut (10 % du haut, marge 5 %), **30 % de la largeur**
    (28-35 %), proportions 4:5, visage ≈ 42 % de la vignette ; recadrage calculé pour ne **jamais agrandir un pixel de
    la source 4K** (`echelleSource ≤ 1`, élargi sur un punch-in fort).
- Branchements : `PlanScene.miseEnPage` + `EntreeComposition.misesEnPage` + `BaseComposition.supplementsMiseEnPage`
  (ajouts purs), graphe FFmpeg `filtresMiseEnPage` dans `studio-rendu`, cartes collectées par `composition.ts`.
- Monteur → habillage : l'opération `miseEnPage` habille la carte qu'elle recouvre ; seule, elle a une carte faite de sa
  description (titre animé à défaut de modèle). L'opération `ecranPartage` (« divise l'écran ») a enfin sa carte
  (avant : ignorée par `cartesDesPassages`).
- Fil : « mets-moi à droite », « petite version de moi » → `miseEnPage` (règles fixes déjà présentes, Claude sinon).
- **Vrai rendu FFmpeg testé** (piste rouge + « visage » blanc, carte bleue) : carte à gauche, visage à 60 % de la
  largeur, Will à droite ; puis vignette blanche dans le coin haut droit sur la carte.

### 1.3 Relecture Claude appliquée (B.24)
- `src/moteurs/montage-facecam/relecture.ts` : `instantsDeControle` (3 premières secondes, chaque carte et écran partagé
  au milieu, chaque raccord, la dernière image ; 24 images au plus, raccords échantillonnés au-delà) et
  `appliquerRelecture` (bords de détourage ratés → variante sans détourage ; puis LA première correction utilisable,
  jamais un effet à détourage décidé seul).
- Dans la chaîne : après la vidéo finie (composée), étape `image:images` du studio-aligneur (nouvelle, `executer_images`
  en Python : JPEG 540 px par instant) → **UN appel** (`relireImagesControle`, rôle `relecture-facecam`) → la correction
  est convertie en entrées et **appliquée par la retouche dans le même travail** (seules les étapes touchées sont
  refaites, nouveaux identifiants de travail `-t1`) → la version livrée est corrigée. **Jamais de seconde relecture** ;
  jamais en retouche ; jamais quand le plafond est atteint ; une extraction ratée → livrée sans relecture.
- L'ancienne relecture « vignette seule » ne sert plus que si la chaîne n'a pas la relecture ciblée.

### 1.4 Décor IA (lot E1) utilisable
- Python `studio-aligneur/aligneur/decor.py`, étapes de `/image` : **extraire** (image seule d'un passage de la passe
  image, fenêtre 9:16, 720 × 1280 pour Higgsfield), **reposer** (25 i/s par `fps=25`, jamais `setpts`/`atempo` —
  refusés —, taille de la fenêtre, 10 bits, durée exacte), **mesurer** (écart bouche / voix d'origine au pas de 40 ms,
  ressemblance de la forme du visage, visage trouvé ; MediaPipe absent → mesure impossible → repli). Calculs purs
  testés sans MediaPipe.
- **Cadrage** (`executer_cadrage`) : lit le plan `decor` (appliqué) : chaque plan est coupé aux bornes des morceaux
  retouchés, qui remplacent la passe image sur leur intervalle (son de la prise inchangé).
- Chaîne : fenêtre 9:16 pleine hauteur sur la médiane des cadres (`fenetreDecor`), donnée à la passe décor avec la passe
  image et la prise ; décor appliqué → **zooms limités à 110 %** et cadres gardés dans la fenêtre (`plansSousDecor`) ;
  chaque morceau retouché reçoit son adresse de lecture pour le cadrage.
- Service `src/services/decor-passages.ts` : les trois fonctions de `passeDecorFacecam` reliées au studio-aligneur
  (travail soumis puis suivi, délai 10 min, panne → `null` = repli). Aligneur non réel → rien ne part.
- **Toujours COUPÉ par défaut** ; Higgsfield reste le double tant que `facecam.decorIa.reel` n'est pas allumé ET que
  ses clés ne sont pas posées.

### 1.5 Plafond Claude propre au face caméra
- `executerRolePourVideo(…, { facecam: { depuis } })` : le monteur, sa relecture et ses cartes sur mesure comptent sur
  **leur propre plafond par version** (`facecam.plafondVersionUsd`, **1,50 $** par défaut, réglable en base), depuis le
  début du tour (message du fil, ou début du travail de fabrication). Leurs dépenses (étape « Monteur · … ») et
  réservations (`txtpub-fcm-…`) ne comptent plus dans le plafond des textes de publication (0,30 $), et inversement.
- Jamais affiché : plafond de version atteint → arrêt « plafond-video » sans montant → **version simple**, sans la
  mention ; seul le plafond **mensuel** reste visible (Réglages) et garde « Plafond du mois atteint — relever ? ».
- « Plafond atteint sort toujours la version simple » vérifié : plafond du mois (aucun appel, mention), plafond de
  version (un refus, version simple, pas de second appel), relecture jamais appelée sous plafond, cartes sur mesure
  écartées à l'habillage (`versionSimple`).

## 2. Fichiers communs touchés (ajouts minimaux)
- `src/moteurs/types.ts` : `refusRetouche?` (facultatif).
- `src/services/fabrication.ts` : appel de `refusRetouche` dans `retoucheSousVerrou` (2 lignes).
- `src/services/travaux.ts` : `refusRetouche` dans « Réessayer » ; entrées finales face caméra rangées sur la version
  et la vidéo (branche `montage-facecam` seulement).
- `src/services/recalque.ts` : `refusRetouche` avant de créer la version (face caméra).
- `src/services/depense-claude-video.ts` : option `facecam`, plafond de version, exclusions croisées.
- `src/briques/composition/scene.ts` (`PlanScene.miseEnPage?`), `parametres.ts` (`misesEnPage?`, colonnes des
  sous-titres), `montage.ts` (`supplementsMiseEnPage?`) : absents, rien ne change (tests de l'avocat verts).
- `studio-rendu/src/composition/image-ffmpeg.ts` (`filtresMiseEnPage`, branche `mp`), `operations/composition.ts`
  (cartes des mises en page).
- `src/fournisseurs/facecam/simulation.ts` : étape `images` et bande rendue par la passe (comme le vrai Python).
- `studio-aligneur/aligneur/image.py` (étapes `images`, `extraire|reposer|mesurer`, teinte, décor au cadrage),
  `son.py` (volume, nettoyage), nouveau `decor.py`.
- Lot D / E : `monteur/agent.ts` (mention seulement pour le plafond du mois), `monteur-facecam.ts` (plafond, « Prête
  vers », `motsDeLaPrise`), `facecam-branchements.ts` (relecture ciblée, décor relié, début du travail),
  `dependances.ts` (`relecture`, `travailId` au monteur), `raccords.ts` (mise en page, écran partagé), `habillage.ts`.
- Lot F1 : rien de son périmètre n'est réécrit ; la retouche reprend ses `declinaisons`. Lots F2, F3, F4 : non touchés.

## 3. Résultats exacts (fin de session)
Sur `feat/facecam-g` (après fusion de `origin/feat/facecam` à `2260324`, lots F1 et F3) :
- `next typegen` puis `tsc --noEmit` (racine) : **0 erreur** ; `tsc` dans `studio-rendu/` (après `npm ci`) : **0 erreur**.
- `eslint .` : **1 erreur, préexistante** — `studio-rendu/compositions/commune/effets/EffetTransition.tsx:301`
  (`react-hooks/refs`, lot F3) ; même erreur sur `origin/feat/facecam` (arbre séparé). Aucun problème dans les fichiers
  du lot G.
- Vitest complet : **3 164 réussis, 3 échecs, 3 sautés (3 170) ; 257 fichiers verts, 3 en échec, 1 sauté (261)**,
  548 s. Les 3 échecs sont **préexistants**, reproduits sur `origin/feat/facecam` seul :
  - `facecam-effets-speciaux` (catalogue « Que puis-je demander ? » : l'exemple C2 « en spectaculaire » passe avant
    celui du lot F3) ;
  - `final-b-image-rendu-fichiers` : `src/briques/effets-speciaux/*.ts` (lot F3) non copiés par
    `deploiement/studio-rendu/Dockerfile` — `habillage-facecam/mise-en-page.ts` (lot G) y est ajouté, lui ;
  - `garde-regle-unique` : `ESSAIS_MAX = 2` recopié dans `declinaisons.ts` (lot F1) et `chaine.ts`.
  `e2e-verif1-bc-serie` (sensible à la charge) est passé vert cette fois.
- Nouveaux tests : `tests/facecam-retouche.test.ts` (15), `tests/facecam-mise-en-page.test.ts` (8, dont un vrai rendu
  FFmpeg), `tests/facecam-decor-g.test.ts` (5), `tests/facecam-plafond-monteur.test.ts` (4) ; `facecam-monteur` (+1),
  `facecam-integration` (plan décor avec sa fenêtre).
- `next build` : **réussi**.
- Python `studio-aligneur` : `python3 -m unittest discover -s tests` → **31 tests OK** (26 + 5 nouveaux dans
  `test_decor.py` : mesures pures, découpage du plan aux morceaux du décor, extraire et reposer sur FFmpeg réel).

## 4. Reste
- Retouche d'une version faite AVANT ce lot (sans `projetMontage.reprise`) : tout est refait (monteur non rappelé) —
  correct mais long. Musique et bruitages du monteur : toujours pas rendus (hors périmètre ; leurs changements ne
  relancent que l'habillage). `teinte` et `volume` : réglages Python à valider à l'œil / à l'oreille sur IMG_7747.
- Formats F1 : les cartes des formats sont rendues de nouveau à chaque retouche (pas encore reprises par empreinte) ;
  la mise en page (côté, vignette) n'est posée qu'en 9:16.
- Relecture : seules les corrections du vocabulaire du monteur dont la cible existe s'appliquent (« retirer » une
  carte automatique `auto-n` n'a pas de passage à retirer : ignorée, vidéo livrée).
- Décor IA : la passe reste SÉQUENTIELLE dans un tour de la boucle (design du lot E1 : suivi Higgsfield jusqu'à 15 min
  par passage) ; à passer en machine à états avant d'allumer le réel. API Higgsfield toujours supposée
  (`src/fournisseurs/higgsfield/API.md`) ; seuils de raccord à régler sur de vraies sorties ; une retouche de l'image
  avec décor appliqué relance le décor (crédits).
- Le plafond de version court depuis le début du tour (message du fil ou début de la fabrication) ; une retouche lancée
  après un plafond du mois atteint à la fabrication garde `plafondClaudeAtteint` de la commande d'origine (version
  simple) jusqu'à la prochaine vidéo.
- Échecs préexistants hors périmètre (aussi sur `origin/feat/facecam`, voir § 3) : `tests/facecam-effets-speciaux`
  (catalogue : l'exemple C2 « en spectaculaire » s'insère avant celui du lot F3) et `eslint`
  `studio-rendu/compositions/commune/effets/EffetTransition.tsx:301` (réf. lue au rendu) — lot F3.

## 5. Ajouts à la liste de mise en ligne (JOURNAL-E § 4)
- Reconstruire **les deux images** : `studio-aligneur` (nouveau `decor.py`, étapes `images`/`extraire`/`reposer`/
  `mesurer` de `/image`, teinte, volume) et `studio-rendu` (mise en page dans le graphe FFmpeg).
- Réglage facultatif en base : `facecam.plafondVersionUsd` (1,50 $ par défaut ; aucun écran). Plus besoin de relever
  `claude.plafondKitUsd` pour le monteur.
- Vérifier après le premier essai réel : une retouche « carte » ne soumet AUCUN travail au studio-aligneur (journal du
  conteneur), une retouche « image » ne soumet que `passe` + `cadrage`, la relecture soumet une étape `images`.
- Disque R2 : chaque version écrit sous `facecam/<vidéo>/<version>/` ; les cartes reprises restent lues sous la version
  d'origine — ne pas purger les versions d'une vidéo encore en ligne.
- Décor IA : laisser `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_URL` VIDES et `facecam.decorIa.actif` coupé tant que la
  passe n'est pas en machine à états et l'API vérifiée.
