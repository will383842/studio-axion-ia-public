# Journal de la mission V « Vérification après J, K et L » — 09/10/2026 (session cloud, branche `feat/facecam`)

Point de départ : `feat/facecam` à `5e1f2af` (fusion de L, après celle de J + K en `1700530` ; conflit d'imports résolu
à la main dans `src/moteurs/montage-facecam/monteur/operations.ts`). Démarrage ≈ 13:40 UTC, fin ≈ 14:25 UTC.
**Rien n'est fusionné dans master, aucune PR ouverte, rien déployé, aucun serveur touché, aucune dépense** (aucun appel
Claude, HeyGen ni Higgsfield ; doubles de simulation, `fetch` interdit dans les tests).

## 1. Résultats EXACTS

| Contrôle | Résultat |
|---|---|
| `npm ci` dans `studio-rendu/` | OK |
| `pnpm install --frozen-lockfile` (racine) | OK |
| `npx next typegen` | OK (« Types generated successfully ») |
| `tsc --noEmit` racine | **0 erreur** (avant et après les ajouts de V) |
| `tsc --noEmit` dans `studio-rendu/` | **0 erreur** |
| `eslint .` | **0 problème** |
| Vitest complet, 1ʳᵉ passe (13:54 UTC, avant le test V) | **3 352 réussis, 2 échecs, 3 sautés (3 357) ; 271 fichiers verts, 2 en échec, 1 sauté (274)**, 549,7 s |
| Vitest complet, 2ᵉ passe (14:11 UTC, avec le test V) | **3 360 réussis, 0 échec, 2 sautés (3 362) ; 274 fichiers verts, 1 sauté (275)**, 548,2 s |
| `next build` | **réussi** (2 avertissements préexistants : `process.exit` dans `src/instrumentation.ts`, Edge Runtime ; fichier non touché) |
| Python `studio-aligneur` (`python3 -m unittest discover -s tests`) | **36 tests OK** (33 de Z + 3 de K dans `test_decor.py`). 1ʳᵉ passe : 29 lancés, 3 erreurs d'import `numpy` (absent du conteneur) → `python3 -m pip install numpy` → 36 OK. Rien à voir avec le code (l'image Docker l'embarque). |
| `git apply --check docs/facecam/ACTIVATION-FACECAM.patch` | **OK** (rien à régénérer) |

### Échecs de la 1ʳᵉ passe et relances seules
- `tests/e2e-verif1-bc-serie.test.ts` « CORRECTEUR FINAL A » : *Test timed out in 5000ms* (toléré, connu, charge).
  **Relancé seul : 14/14 vert.** Vert aussi dans la 2ᵉ passe complète.
- `tests/garde-ecran.test.ts` : **vert** dans les deux passes complètes ; relancé seul quand même : **6/6 vert**.
- `tests/r2-textes-publication.test.ts` « pré-vol : crédit Claude suivi insuffisant → aucun appel » : **échec
  d'assertion** (4 appels Claude doublés au lieu de 0), pas un délai — donc hors de la liste tolérée, examiné :
  - aucun fichier de ce chemin n'a changé depuis la vérification Z (`git diff c4e39db HEAD` vide sur `credits.ts`,
    `publications.ts`, `depense-claude-video.ts`, `generation-claude.ts`, `couts.ts`, `_commun.ts`, `src/donnees`,
    le test et ses aides) : **sans lien avec J, K ou L** ;
  - relancé seul **4 fois : 40/40 à chaque fois** ; 2 fois sous charge CPU artificielle (4 × `yes`) : 40/40 ; **vert
    dans la 2ᵉ passe complète**. Non reproductible : instabilité ponctuelle d'ordre ou de charge.
  - Piste (non corrigée, pour ne pas toucher un test commun sans preuve) : `brancherClaude()` lance
    `void credits.declarerRecharge("anthropic", 500)` sans l'attendre ; si cette écriture d'un test précédent arrive
    tard, le crédit suivi du test « pré-vol » n'est plus de 1 centime. À rendre attendue par la session qui tient ce
    test si l'échec revient.

## 2. Corrections faites
Aucune casse due aux fusions J / K / L : `tsc`, `eslint`, `next build`, Vitest et Python passent sans rien changer au
code. Ajouts de V :
- **Nouveau test** `tests/v-coherence-facecam.test.ts` (5 tests, verts) — le croisement J × K × L, que les tests de
  chaque lot ne couvraient pas ensemble :
  1. vocabulaire : 13 modèles (`MODELES_CARTE`), effets 3D puis `effetRealisteIA` en fin ; le catalogue de Claude cite
     les modèles 7-13, les 3 effets 3D et l'effet réaliste ; « Que puis-je demander ? » = 14 exemples (L) ; mentions
     « réaliste, payant » et « en 3D, gratuit » (K) ;
  2. une réponse de Claude qui mélange carte `check-list` (L), `objetMain` (F3) et `effetRealisteIA` (K) est relue
     telle quelle (rien écarté, rien changé en carte sur mesure) ;
  3. `appliquerOperations` : la carte et l'objet 3D sont posés, l'effet réaliste part en `aConfirmer` et **n'ajoute
     aucun passage** (mêmes passages que sans lui) ;
  4. réglages par défaut : `facecam.effetRealiste` → `{ reel: false }`, Décor IA coupé (`actif`/`reel` faux),
     multicaméra face caméra et avocat coupées, prix du crédit Higgsfield = défaut ;
  5. en réel avec les variables Higgsfield posées mais **sans jeton** : `higgsfieldPourOption` ne rend aucun client
     pour `effet-realiste-ia`, `decor-ia` et `effets-main-ultra`, et **aucun appel réseau**.
- Commentaire périmé corrigé dans `src/services/options-payantes-higgsfield.ts` (I2 « pas encore fusionnée » → fusionné ;
  le point d'entrée sert aussi à l'effet réaliste K). Aucun changement de comportement.
- `JOURNAL-Z.md` § 6 complété (J, K, L) et § 7 renvoyé au texte final ci-dessous.

## 3. Cohérence vérifiée (lecture du code + tests)
- **Monteur** : `SCHEMAS_OPERATION` = vocabulaire de base, puis `objetMain`, `vitreBrisee`, `transitionEcran` (F3), puis
  `effetRealisteIA` (K) ; `ajouterCarte.modele` = 13 modèles (L, garde de types sur `IdModeleMotionTous`) ; relecture
  avec les réparateurs effet spécial → effet réaliste → carte sur mesure. Le conflit d'imports de `operations.ts` est
  bien résolu (les deux imports K et L présents, `tsc` 0).
- **Garde serveur** : les seuls points qui fabriquent un client réel sont `fournisseurHiggsfield` (enveloppé par
  `garderHiggsfield`, refus sans garde) et `choisirFournisseurMulticamera` (enveloppé par `garderMulticamera`). Tous les
  appelants passent par eux (`options-payantes-higgsfield.ts`, `decor-ia.ts` — client injecté gardé aussi —,
  `multicamera.ts`) ; `effets-ultra-realistes.ts` (I2) n'appelle que le double. **Aucune option payante ne part sans
  jeton de confirmation** (tests J 14 + 20, K 10 + 4, V 5).
- **Coupé par défaut** : Décor IA, multicaméra (avocat, face caméra), ultra réaliste I2, effet réaliste K (`reel: false`) ;
  Réglages › Décor IA refuse `actif: true` sans `confirme`.
- **Avocat sans options** : comportement inchangé — L n'a rien changé de l'avocat (ajouts purs dans la brique motion),
  J ne pose la garde que sur des fournisseurs coupés par défaut ; tests avocat (`montage-avocat`, `m4`, `g6b`, `f4`,
  `h-avocat-mission-h` « options absentes ») verts dans les deux passes complètes.

## 4. Correctif d'activation
`git apply --check docs/facecam/ACTIVATION-FACECAM.patch` passe sur la branche finale : rien à régénérer. Il fait
toujours : format `facecam` en `actif`, `facecam.aligneur.reel` allumé par défaut (`false` en base le coupe),
`refusAuLancement` gardé avec « Le serveur de montage face caméra n'est pas relié. Vérifiez Réglages > Connexions. »,
et le test des fondations adapté. Il ne touche à aucun réglage payant (tous restent coupés).

## 5. LISTE DE MISE EN LIGNE — finale et complète (à faire par Will — rien n'est fait ici)

### 5.1 Variables d'environnement (`.env` du serveur)
- Chaîne : `STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200` (active le profil `calage`),
  `FOURNISSEUR_ALIGNEMENT=studio-aligneur`, `STUDIO_RENDU_CLE` (déjà posée), **`STUDIO_ALIGNEUR_DELAI_SEC=1800`**.
- Habillage : `STUDIO_RENDU_URL=http://studio-rendu:4100` (sans elle : piste montée sans sous-titres, cartes ni effets).
- Google Drive (E2) : `FOURNISSEUR_GOOGLE_DRIVE=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_DRIVE_COMPTE` ; facultatifs `GOOGLE_REDIRECTION`, `GOOGLE_DRIVE_CLE`. **Jamais** `GOOGLE_DRIVE_ESSAI`.
- Higgsfield (Décor IA, ultra réaliste I2, effet réaliste par IA K) : `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL`
  **à laisser VIDES** jusqu'à l'essai réel conseillé (API supposée). Même posées : rien ne part sans jeton (garde J).
- J, K, L : **aucune autre variable**.

### 5.2 Conteneurs à reconstruire (les trois)
1. **app** (`studio`) : lots A à Z + J (cartes « Option payante », garde serveur, actions Confirmer / Annuler) + K
   (effet réaliste par IA, étape 5 ter de la chaîne) + L (13 modèles dans le monteur). `git apply
   docs/facecam/ACTIVATION-FACECAM.patch` avant la construction pour passer en actif. Facultatif : FFmpeg dans
   l'image de l'app (lumière, reflets, grain mesurés sur la vignette).
2. **studio-rendu** : brique `motion` (13 modèles, Sobre + Spectaculaire), `CarteSurMesure`, mise en page,
   multicaméra, compositions d'effets + brique `effets-speciaux` (paume, objets réalistes), `crf` facultatif. L
   n'ajoute aucun contrat (compositions F2 déjà inscrites) ; J et K n'y touchent pas.
3. **studio-aligneur** : `decor.py` (extraire / reposer / mesurer ; **K : `reposer` avec `original`, `fonduSec`,
   `accorderCouleurs`**), étapes `images` et décor de `/image` (**K : le cadrage lit le plan `effets`**), `/son`,
   points et côté des mains dans `/visages`. Vérifier les 4 lignes « prêt » du `--precharger`.

### 5.3 Mémoire, disque, délais
- `studio-aligneur` : `mem_limit 6000m` depuis le 10/10 (3500m avant le 09/10, pic mesuré 3,23 Go sur 3,42 Go ; 4500m
  le 09/10 ; passe « formats » à 4,40 Go le 10/10), 2 CPU ; pic < 6 Go par passe image ; ≥ 6 Go de disque pour l'image,
  2 à 4 Go de `/tmp` par vidéo de 2 min.
- `studio-rendu` : `mem_limit 3g` ; carte ≈ 3,5 min (4 cœurs), Spectaculaire 3D 25-33 s / 10 images, objet sur la
  paume ≈ 0,8 s / image, vitre qui révèle une carte > 30 s / image sous charge → surveiller la file.
- app : `mem_limit 1g`. **Un seul serveur app** : la consommation du jeton de confirmation est protégée par une file en
  mémoire (J, K) ; plusieurs serveurs exigeraient une écriture conditionnelle en base.
- Retouche : estimation « Prête vers » (passe image ≈ 9 × la durée, son ≈ 0,5 ×, piste ≈ 1 ×, carte ≈ 3,5 min,
  composition ≈ 1,5 × + 1 min). Un effet réaliste changé ne refait que la piste montée.
- R2 : ne pas purger les versions d'une vidéo encore en ligne.

### 5.4 Réglages cachés (table des paramètres) — APRÈS la mise en ligne, un par un
| Réglage | Valeur | Quand |
|---|---|---|
| `facecam.aligneur.reel` | `true` (défaut avec le correctif d'activation ; `false` le coupe) | Dès la mise en ligne. |
| `facecam.plafondVersionUsd` | 1,50 par défaut (rien à poser) | Pour changer le plafond du monteur par version. |
| `facecam.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Après un essai simulé. |
| `avocat.motionCommune` | `true` ou `{ "actif": true, "habitude": ["en spectaculaire"] }` | Planche 7-13 validée par Will le 09/10 : possible dès que voulu. |
| `avocat.monteur` | `true` | Quand Will veut les consignes avocat (version simple). |
| `avocat.multicamera` | `{ "actif": true, "reel": false, "looks": {} }` | Après un essai simulé. |
| `…multicamera.reel` + `looks` | `true` + looks « côté » / « contre-plongée » | Après l'essai de 15 s par angle validé ; chaque vidéo demande sa confirmation (J). |
| `facecam.decorIa` (`actif`, `reel`) | **laisser coupé** | Tant que la passe décor n'est pas en machine à états et l'API Higgsfield vérifiée. Allumer demande la carte (J). |
| Ultra réaliste (I2) | coupé (`REGLAGE_ULTRA_REALISTE_DEFAUT`), pas de réglage en base | À brancher plus tard via `higgsfieldUltraRealisteMain`. |
| `optionsPayantes.prixCreditHiggsfieldCentimes` (J) | 5 par défaut (rien à poser) | À recaler sur la 1ʳᵉ facture Higgsfield (devis des cartes). |
| `taux.usdEur` | 0,9 par défaut | Devis HeyGen en € de la multicaméra. |
| `optionsPayantes.demandes` (J) | écrit par le studio | **Ne jamais écrire à la main.** |
| `facecam.effetRealiste` (K) | `{ "reel": false }` par défaut | Après l'essai réel conseillé (JOURNAL-K : 1 passage de 5 s, FLUX puis Kling, < 1 €) : `{ "reel": true }` + variables Higgsfield + studio-aligneur réel. |
| `facecam.effetsRealistes.<videoId>` (K) | écrit par le studio (effets payés, repris sans repayer) | Ne jamais écrire à la main. |
| Monteur à 13 modèles (L) | actif par défaut, aucun réglage | Rien à faire. |

### 5.5 Contrôles après le premier essai réel (IMG_7747)
- Temps, mémoire, bruit, ΔE, coupes ; retouche « carte » : AUCUN travail au studio-aligneur ; retouche « image » :
  `passe` + `cadrage` seulement ; relecture : une étape `images` ; effet 3D : paume reconnue, visage jamais caché.
- J : une option payante demandée montre la carte « Option payante — environ X € … [Confirmer] [Annuler] » ;
  Annuler → version gratuite, aucune dépense ; aucune autre page n'affiche de prix (hors Réglages › Mon monteur).
- K : « Rajoute au bon endroit un téléphone dans ma main et jette-le sur l'écran » → carte avec aperçu, « Changer de
  moment », Confirmer → nouvelle version « prête vers … » ; en simulation, aucun crédit.
- L : « montre-le en check-list », « en camembert » → la carte du bon modèle ; jamais de titre plein écran non demandé.

## 6. Texte de PR final (lots A à L) — prêt à coller, ne PAS ouvrir sans l'accord de Will

```
Titre : Face caméra — format complet (lots A à L) : chaîne vidéo, habillage, monteur à 13 modèles, retouche réelle, effets 3D et réalistes, options payantes confirmées

## Résumé
Nouveau format « Vidéo face caméra » : Will se filme à l'iPhone (ou choisit sa vidéo dans Google Drive), le studio
coupe, règle le son (−14 LUFS) et l'image (Look Will, 10 bits), cadre en 9:16, habille (sous-titres au mot, cartes de
motion design à 13 modèles, écrans partagés, mises en page, effets spéciaux) et livre ; le fil « Discuter avec mon
monteur » modifie vraiment la vidéo. Toute option payante est annoncée et confirmée avant la moindre dépense.
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
- J : options payantes — carte « Option payante — environ X € pris sur vos crédits … [Confirmer] [Annuler] », plafond
  du mois prioritaire, jeton à usage unique lié à la version, garde serveur au point d'appel de chaque fournisseur
  réel (Higgsfield, HeyGen) : sans jeton, aucun appel payant.
- K : effet réaliste par IA au bon endroit (« un téléphone dans ma main, jeté sur l'écran ») : moment choisi et
  vérifié, consigne vidéo anglaise, carte avec aperçu et « Changer de moment », fabrication Higgsfield reposée dans la
  piste (raccord de couleur, fondu), vitre brisée à l'impact, repli 3D gratuit et « Réessayer » confirmé. Coupé
  (`facecam.effetRealiste.reel` faux).
- L : les 13 modèles d'animation par défaut dans le monteur face caméra (vocabulaire, catalogue, consigne, version
  simple, raccords, déclinaisons, écrans partagés d'office ; titre plein écran seulement sur demande).
- Z / V : intégrations finales (retouche × effets × multicaméra, catalogue commun, points des mains dans /visages ;
  cohérence J × K × L testée).

## Sécurité et argent
- Seule la carte de confirmation montre un prix (et le total du mois dans Réglages › Mon monteur) ; aucun réel par
  défaut (réglages cachés + URL / clés des services) ; Décor IA, multicaméra réelle, ultra réaliste et effet réaliste
  coupés ; aucune option payante sans jeton de confirmation (garde serveur) ; jetons Google chiffrés, drive.readonly.

## Vérifications
- tsc 0 erreur (racine et studio-rendu), eslint 0 problème, next build OK.
- Vitest complet : 3 360 réussis / 3 362 (0 échec, 2 sautés ; 274 fichiers verts, 1 sauté).
  Une 1ʳᵉ passe sous charge avait 2 échecs ponctuels hors face caméra (`e2e-verif1-bc-serie` délai de 5 s ;
  `r2-textes-publication` pré-vol), verts relancés seuls et dans la 2ᵉ passe.
- Python studio-aligneur : 36 tests OK. Non-régression avocat : verte.
- `git apply --check docs/facecam/ACTIVATION-FACECAM.patch` : OK.

## Mise en ligne
docs/facecam/JOURNAL-V.md § 5 (variables, 3 conteneurs à reconstruire, mémoire, réglages à allumer, contrôles) et
docs/facecam/ACTIVATION-FACECAM.patch pour passer en actif.
```
