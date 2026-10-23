# 80 · Image → vidéo : plan d'intégration de la variété (16/10/2026)

**À quoi il sert.** Découper l'intégration des maquettes v3 **validées par Will** (planches `planche/`, verdict `planche/verdict-critique.json`) en **lots indépendants**, chacun fait par un agent dans sa propre PR, **en parallèle**, sans que deux lots touchent le même fichier. Ce document ne contient aucun code applicatif.

**Décisions de Will prises en compte** :
- l'ouverture est **adaptée à chaque réseau** (même voix, seule l'image d'ouverture change) ;
- **Facebook = deux fichiers** : Reel en 9:16 **et** fil en 4:5 ; **LinkedIn en 4:5** ; TikTok, Shorts, Reels Instagram en 9:16 ;
- **pas de version 30 s** pour l'instant (les plafonds actuels restent : versions courtes seulement au-delà du plafond) ;
- **toutes les variantes gardées** dans `verdict-critique.json` sont intégrées (10 axes), avec un **tirage au sort déterministe** qui garantit que deux vidéos ne se ressemblent pas.

---

## 1. Ce que le code fait aujourd'hui (lu le 16/10, master `3cf2576`)

| Morceau | Fichier | Ce qui compte pour la variété |
|---|---|---|
| Mise en scène (PURE) | `src/moteurs/montage-image-video/mise-en-scene.ts` (2 038 lignes) | `mettreEnSceneIV(entree)` → `LigneDeTempsIV` : plans, **blocs de rendu** (`ecran` / `toile` / `objets` / `moments`), événements (bruitages, rythme), sous-titres, repère. Boucle de relance du rythme (§ 6-8 : `construirePlans` → `construireBlocs` → `construireEvenements`). Rien de hasard. |
| Contrôles bloquants | `controles-scene.ts` | Calculés sur les **événements** (issus des écrans de la fiche), pas sur les blocs : une variante qui change le dessin sans changer ce qui est montré et quand reste contrôlée. |
| Fabrication | `fabrication.ts` | Une **version par groupe de réseaux** (fin propre à chaque réseau) ; chaque version refait `mettreEnSceneIV` → une ligne de temps par version. C'est là que l'ouverture par réseau se branche sans repayer la voix. |
| Rendu réel | `src/services/image-video-rendu.ts` | Un MP4 par bloc : `ecran` → `CasConcretEcran` (composition **empruntée au cas concret**, interdite en écriture), `toile` → `ImageVideoScene`, `objets` → `ImageVideoObjets`, `moments` → `ImageVideoMoments` ; puis montage `complet` (voix + bruitages + sous-titres variés). **`RATIO = "9:16"` en dur.** |
| Sous-titres variés | `sous-titres-varies.ts` | Intensité fixée à `INTENSITE_SOUS_TITRES_IV = "equilibre"` (SOU-B) : SOU-C = changer ce réglage. |
| Écran | `src/briques/schema-motion/types.ts` | `ECRAN_IV` = 9:16 seul ; bande des sous-titres 0,60 → 0,67. |
| Compositions | `studio-rendu/compositions/image-video/**` | `Compositions.tsx` (4 compositions de prod), `Toile.tsx` + `Noeud.tsx` (apparition « surgit »), `Camera.tsx` (suivi), `BandeauChiffres.tsx` (compteur), `PhraseChoc.tsx` (fin), `Entete.tsx`, `plan.ts`, `mise-en-page.ts`. Tests : `react-module.test.ts` parcourt **tout le dossier, sous-dossiers compris**. |
| Image Docker du rendu | `deploiement/studio-rendu/Dockerfile` | Copie `studio-rendu/compositions` et `src/briques/schema-motion` (entre autres), **pas** `src/moteurs/**`. Une composition ne peut donc importer que des briques copiées (test L17 de `galerie-prod.test.ts`). |
| Maquettes | `docs/…/variete/prototypes/d1…d3/*.tsx` | Composants Remotion des maquettes (≈ 3 700 lignes), rendus par `prototypes/rendre.mts`, mesurés par `prototypes/occupation.py`. Ce sont **les références visuelles** de chaque lot. |

**Conséquences pour le découpage.**
1. `mise-en-scene.ts`, `Compositions.tsx` et `image-video-rendu.ts` sont des goulots : **seul le socle les modifie** (une fois, pour y poser des points d'accroche). Aucun lot parallèle n'y touche (exception écrite : le lot 4:5 pour le service, voir § 4).
2. Le contrat partagé par le moteur ET les compositions va dans `src/briques/schema-motion/variete.ts` (copié dans l'image Docker). Le reste du moteur va dans `src/moteurs/montage-image-video/variete/`.
3. Les écrans de texte empruntés au cas concret ne sont **jamais modifiés** : les nouveaux écrans (ouverture, texte, fin) sont des compositions **propres à l'IV**.

PR ouvertes vérifiées le 16/10 : seule #283 touche l'IV (`assemblage.ts` et deux tests) ; aucun fichier de ce plan n'est en commun, sauf `assemblage.ts` que **seul le lot final** peut lire (pas modifier).

---

## 2. Architecture visée (ce que le socle pose)

```
fabrication (lot final)                         mettreEnSceneIV(entree)  ← socle : entree.variete?, entree.format?
  tirerVarieteIV(graine = videoId, carte)            │  … construireBlocs(…)   (inchangé)
  → RecetteVarieteIV (10 codes)                      ▼
  recettePourVersion(recette, réseaux, format)   appliquerVarieteIV(étape)   ← socle : variete/index.ts (ordre fixe)
                                                     ├ axes/recit.ts        (lot REC)
                                                     ├ axes/ouverture.ts    (lot OUV-FIN)
                                                     ├ axes/typo.ts         (lot TYP-SOU)
                                                     ├ axes/chiffres.ts     (lot CHI)
                                                     ├ axes/camera.ts       (lot CAM-TRA)
                                                     ├ axes/apparition.ts   (lot APP-MAT)
                                                     ├ axes/fin.ts          (lot OUV-FIN)
                                                     ├ axes/transitions.ts  (lot CAM-TRA)
                                                     └ axes/matiere.ts      (lot APP-MAT)
                                                 → blocs (+ champ `variete` par bloc, nouveau bloc `sorte: "variete"`)
service de rendu (socle) : bloc `variete` → composition `ImageVideoVariete` ; tout bloc reçoit `variete` dans ses propriétés
compositions (socle) : <ContexteVariete> + <HabillageVariete> autour de chaque scène ; `ImageVideoVariete` aiguille vers
  compositions/image-video/variete/<axe>/ecran.tsx et …/<axe>/calque.tsx (un bouchon par axe, rempli par le lot de l'axe)
```

Règle d'or : **sans recette** (`entree.variete` absent), tout reste **exactement** comme aujourd'hui (références REC-A, CHI-A, CAM-A, TYP-A, APP-A, TRA-A, FIN-A, MAT-A, SOU-B) : tous les tests existants passent sans changement.

### Les codes tirés au sort (depuis `verdict-critique.json`)

| Axe | Variantes tirables (gardées) | Référence (sans recette, ou repli) | Retirées (jamais tirées) |
|---|---|---|---|
| 1 Ouverture | OUV-A, OUV-B, OUV-C, OUV-D, OUV-E | — (l'écran actuel ≈ OUV-D) | — |
| 2 Récit | REC-B, REC-C, REC-D | REC-A | — |
| 3 Chiffres | CHI-B, CHI-C, CHI-D, CHI-E | CHI-A | — |
| 4 Caméra | CAM-B, CAM-C, CAM-E | CAM-A | CAM-D |
| 5 Écrans de texte | TYP-B, TYP-C, TYP-D | TYP-A | — |
| 6 Apparition | APP-B, APP-C, APP-D | APP-A | — |
| 7 Transitions | TRA-B, TRA-C, TRA-D (une principale + coupes franches) | TRA-A | TRA-E |
| 8 Fin | FIN-C, FIN-D | FIN-A | FIN-B |
| 9 Matière | MAT-B, MAT-C, MAT-D | MAT-A | — |
| 10 Sous-titres | SOU-C | SOU-B | SOU-A |

**Choix proposé (réglable par une constante du socle, `REFERENCES_TIRABLES`)** : pour les axes Fin et Sous-titres, qui n'ont que 1 ou 2 variantes gardées, la référence est **aussi** tirable (FIN-A, SOU-B), sinon toutes les vidéos auraient les mêmes sous-titres appuyés. Pour les 8 autres axes, la référence ne sert que de **repli** (variante impossible sur cette image) ou quand il n'y a pas de recette.

**Par réseau** (doc 73 § 2, décisions du 16/10) : `recettePourVersion` remplace, pour une version 4:5 (LinkedIn, fil Facebook), TYP-B → TYP-C, SOU-C → SOU-B, FIN-C → FIN-D, CAM-E → CAM-B ; l'ouverture est **tirée par réseau** parmi celles qui conviennent (9:16 : de préférence OUV-A, OUV-D, OUV-C ; 4:5 : OUV-B, OUV-E, OUV-A), sans jamais changer les mots dits.

---

## 3. Le lot SOCLE (d'abord, seul)

**But.** Poser le contrat commun et les points d'accroche, **sans aucune variante dessinée**. Petit : ≈ 600 lignes, dont la moitié de tests et de bouchons.

**Fichiers créés**
- `src/briques/schema-motion/variete.ts` : types et constantes partagés moteur ↔ compositions (`AxeVariete`, `CodeVariante` par axe, `RecetteVarieteIV`, `FormatIV = "9:16" | "4:5"`, `CADRES_IV` : 9:16 = 1080 × 1920, 4:5 = 1080 × 1350 avec hauteur utile y 54 → 1215 et bande des sous-titres 1042 → 1176 (doc 76), `VarieteBlocIV` = `{ recette, format, donnees?: Partial<Record<AxeVariete, unknown>> }`, `BlocVarieteDonnees` = `{ axe: "ouverture" | "texte" | "chiffre" | "camera" | "fin"; code; donnees: unknown }`, `VARIANTES_GARDEES`, `REFERENCES`, `REFERENCES_TIRABLES`, `RETIREES`). Réexporté par `src/briques/schema-motion/index.ts` (une ligne).
- `src/moteurs/montage-image-video/variete/tirage.ts` : `tirerVarieteIV({ graine, carte, format, historique? })` (PUR : hachage sha256 de `graine|axe|k` → rang, jamais `Math.random`, jamais la date) ; interroge `possibles(carte, format)` de chaque axe ; applique `accepteHistoriqueIV` (bouchon du lot TIR) ; `recettePourVersion(recette, reseaux, format)` (substitutions par réseau ci-dessus) ; `RECETTE_REFERENCE_IV`.
- `src/moteurs/montage-image-video/variete/index.ts` : `EtapeVarieteIV` (`blocs`, `plans`, `recette`, `format`, `carte`, `fiche`, `chiffresDits`, `reseaux`, `replis: { axe, code, raison }[]`) et `appliquerVarieteIV(etape)` qui appelle les axes **dans l'ordre fixe** : récit → ouverture → typo → chiffres → caméra → apparition → fin → transitions → matière (les sous-titres sont lus au rendu). Règle écrite en tête : un bloc déjà `sorte: "variete"` n'est plus transformé par un axe suivant, sauf par transitions et matière (qui n'ajoutent que des propriétés).
- `src/moteurs/montage-image-video/variete/axes/{recit,ouverture,typo,chiffres,camera,apparition,fin,transitions,matiere}.ts` : **bouchons** (identité) avec la signature finale : `possibles(carte, format): CodeVariante[]` et `appliquer(etape): EtapeVarieteIV`.
- `src/moteurs/montage-image-video/variete/historique.ts` : bouchon `accepteHistoriqueIV(recette, historique) => true`.
- `studio-rendu/compositions/image-video/variete/ContexteVariete.tsx` : contexte React (`useVariete()` → recette, format, données du bloc, et, pour une toile, la scène calculée).
- `studio-rendu/compositions/image-video/variete/HabillageVariete.tsx` : enveloppe chaque scène par les calques des axes dans un ordre fixe (matière la plus externe, puis transitions, caméra, récit, chiffres).
- `studio-rendu/compositions/image-video/variete/{ouverture,texte,chiffres,camera,fin,recit,transitions,matiere}/ecran.tsx` et `…/calque.tsx` (selon l'axe) : **bouchons** (`ecran` : fond de la charte + marque ; `calque` : rend `children`). Chacun commence par `import React from "react";`.
- `studio-rendu/compositions/image-video/variete/CompositionVariete.tsx` : composition `ImageVideoVariete` (aiguillage `axe` → `ecran.tsx` de l'axe).
- `scripts/image-video/variete/images-fixes.mts` : **banc commun des lots** : construit la ligne de temps de la carte C (fixture `tests/image-video/fixtures/cartes/C.json`, fiche `FICHES_SIMULEES`, voix `pisteSimulee`, fins `planDesFinsIV`), avec une recette forcée (`--code OUV-A`, ou `--recette OUV-A,REC-B,…`) et un format (`--format 9:16|4:5`) ; prend les propriétés de chaque bloc par `parametresDuBloc` (le vrai service, pur) ; rend en JPEG, par `renderStill` sur le paquet `studio-rendu` (navigateur `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, `gl: "swangle"`, comme `prototypes/rendre.mts`), les images aux instants : début du bloc + 0,5 s, milieu, fin − 0,3 s de chaque bloc qui porte le code, plus 0,5 s / 1,5 s / 3 s pour une ouverture. Sortie : `<dossier>/<CODE>-<n>.jpg` + `instants.json`.
- `scripts/image-video/variete/cote-a-cote.py` : planche « maquette | moteur » par code (réutilise la mise en page de `prototypes/planche.py`) et lance `prototypes/occupation.py` sur les images du moteur ; écrit `mesures.md` (occupation, trou, équilibre, appoint, verdict).
- `tests/image-video/variete/socle.test.ts`, `tests/image-video/variete/invariants.ts` (aide partagée en LECTURE par les lots : `invariantsVarieteIV(sans, avec)` vérifie que les mêmes chiffres et textes de la carte restent montrés aux mêmes heures ± 0,2 s, que la durée et la voix sont identiques, et que les contrôles passent).

**Fichiers modifiés (seulement par le socle)**
- `src/moteurs/montage-image-video/mise-en-scene.ts` : `EntreeMiseEnSceneIV.variete?: RecetteVarieteIV` et `format?: FormatIV` ; `BlocRenduIV` reçoit `variete?: VarieteBlocIV` et la sorte `{ sorte: "variete"; … BlocVarieteDonnees }` ; `LigneDeTempsIV.variete?: { recette; format; replis }` ; dans la boucle § 6-8, `blocs = appliquerVarieteIV({ … blocs: construireBlocs(…) }).blocs` **seulement si** une recette est donnée ; `largeur/hauteur` lus dans `CADRES_IV[format]` (défaut 9:16).
- `src/services/image-video-rendu.ts` : `COMPOSITIONS_RENDU_IV.variete = "ImageVideoVariete"` ; `parametresDuBloc` passe `variete` dans les propriétés de chaque bloc et traite la sorte `variete`.
- `studio-rendu/compositions/image-video/Compositions.tsx` : inscrit `ImageVideoVariete` ; enveloppe `SceneImageVideo`, `CorpsSceneObjets`, `CorpsMoments` par `<ContexteVariete>` + `<HabillageVariete>` (aucun autre changement).
- `src/moteurs/montage-image-video/sous-titres-varies.ts` : **une ligne** : `LigneSousTitres` inclut `variete` (le lot TYP-SOU s'en sert).

**Tests attendus**
- tirage : même graine → même recette ; 200 graines → chaque variante gardée tirée au moins une fois, aucune retirée ; `recettePourVersion` applique les substitutions 4:5 ; aucun `Math.random` ni `Date` dans `variete/**` (lecture du source).
- sans recette : la ligne de temps des 6 cartes est **identique octet pour octet** (JSON) à celle de master (empreinte calculée avant et après, figée dans le test).
- avec une recette dont tous les axes sont des bouchons : mêmes blocs + champ `variete` ; `parametresDuBloc` d'un bloc `variete` vise `ImageVideoVariete`.
- **rouge sans le socle** : `import { tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage"` échoue sur master.
- `react-module.test.ts` et `galerie-prod.test.ts` (L17 : le Dockerfile copie ce que lisent les compositions) restent verts.

**Critère de fin mesurable** : `tests/image-video` vert (hors rouges connus), `tsc` et `eslint` propres sur les fichiers touchés ; `images-fixes.mts --code OUV-A` rend des images (bouchon : fond + marque) en moins de 10 min, et `cote-a-cote.py` produit la planche et `mesures.md`.

**Durée estimée** : 3 à 4 h d'agent (Opus). **Risques** : l'égalité octet pour octet sans recette (tout écart = régression à corriger avant de livrer) ; le banc de rendu (installation `npm --prefix studio-rendu ci` ≈ 3-5 min).

---

## 4. Les 8 lots parallèles (après le socle)

Chaque lot ne touche **que** ses fichiers. Aucun fichier n'est commun à deux lots parallèles ; aucun registre partagé (les bouchons du socle sont déjà inscrits, chaque lot remplit les siens).

### Tableau des lots et de leurs fichiers

| Lot | Variantes | Fichiers créés / modifiés (exclusifs) |
|---|---|---|
| **S · Socle** (d'abord) | — | voir § 3 |
| **1 · OUV-FIN** Ouvertures et fins | OUV-A, B, C, D, E · FIN-C, FIN-D (+ FIN-A tirable) | M `src/moteurs/montage-image-video/variete/axes/ouverture.ts`, M `…/axes/fin.ts` · M `studio-rendu/compositions/image-video/variete/ouverture/ecran.tsx`, M `…/variete/fin/ecran.tsx` · C `studio-rendu/compositions/image-video/variete/ouverture/*.tsx` (un fichier par variante), C `…/variete/fin/*.tsx`, C `…/variete/objets-ouverture.tsx` (horloge, téléphone, bulles, lune) · C `tests/image-video/variete/ouverture.test.ts`, C `tests/image-video/variete/fin.test.ts` · C `docs/formats/image-video/variete/integration/ouv-fin/` |
| **2 · REC** Récit | REC-B, REC-C, REC-D (+ correctif « repère 2/3 sur le schéma ») | M `…/variete/axes/recit.ts` · M `src/moteurs/montage-image-video/recettes.ts`, M `…/ecriture.ts`, M `…/ecriture.simulation.ts` (ajouts seulement : nouvelles fiches simulées par récit, sans toucher les existantes), M `…/regles.ts` (ossature permise par récit) · M `studio-rendu/compositions/image-video/variete/recit/calque.tsx`, C `…/variete/recit/*.tsx` (« Voici comment », bulle suivie, repère 1/3) · C `tests/image-video/variete/recit.test.ts` · C `docs/…/variete/integration/rec/` |
| **3 · CHI** Chiffres | CHI-B, CHI-C, CHI-D, CHI-E (+ correctif « chiffre qui claque sur une étape déjà posée ») | M `…/variete/axes/chiffres.ts` · M `studio-rendu/compositions/image-video/variete/chiffres/ecran.tsx`, M `…/variete/chiffres/calque.tsx`, C `…/variete/chiffres/*.tsx` (anneau, duel, géant, en objets, accent) · C `tests/image-video/variete/chiffres.test.ts` · C `docs/…/variete/integration/chi/` |
| **4 · CAM-TRA** Caméra et transitions | CAM-B, CAM-C, CAM-E · TRA-B, TRA-C, TRA-D | M `…/variete/axes/camera.ts`, M `…/variete/axes/transitions.ts` · M `studio-rendu/compositions/image-video/variete/camera/{ecran,calque}.tsx`, M `…/variete/transitions/calque.tsx`, C `…/variete/camera/*.tsx` (silhouette, point lumineux, côte à côte), C `…/variete/transitions/*.tsx` (raccord d'objet, balayage, plongée) · C `tests/image-video/variete/camera.test.ts`, C `tests/image-video/variete/transitions.test.ts` · C `docs/…/variete/integration/cam-tra/` |
| **5 · TYP-SOU** Écrans de texte et sous-titres | TYP-B, TYP-C, TYP-D · SOU-C (+ correctif « lignes au rythme des mots ») | M `…/variete/axes/typo.ts` · M `src/moteurs/montage-image-video/sous-titres-varies.ts` (intensité lue dans `ligne.variete`) · M `studio-rendu/compositions/image-video/variete/texte/ecran.tsx`, C `…/variete/texte/*.tsx` · C `tests/image-video/variete/typo.test.ts`, C `tests/image-video/variete/sous-titres.test.ts` · C `docs/…/variete/integration/typ-sou/` |
| **6 · APP-MAT** Apparition et matière | APP-B, APP-C, APP-D · MAT-B, MAT-C, MAT-D | M `…/variete/axes/apparition.ts`, M `…/variete/axes/matiere.ts` · M `studio-rendu/compositions/image-video/Toile.tsx`, M `…/image-video/Noeud.tsx` (lisent `useVariete()` ; sans recette : rendu inchangé) · M `…/variete/matiere/calque.tsx`, C `…/variete/apparition/*.tsx`, C `…/variete/matiere/*.tsx` (grain, trait fait main, profondeur) · C `tests/image-video/variete/apparition.test.ts`, C `tests/image-video/variete/matiere.test.ts` · C `docs/…/variete/integration/app-mat/` |
| **7 · F45** Format 4:5 et Facebook double | mise en page 4:5 (R45-OUV-A-1, R45-CHI-B-1, R45-CHI-D-1, R45-CAM-C-1, R45-FIN-D-1) ; LinkedIn 4:5 ; Facebook 9:16 + 4:5 | M `src/moteurs/montage-image-video/fabrication.ts` (versions par format, livraison Facebook à deux fichiers) · M `src/services/image-video-rendu.ts` (ratio lu dans la ligne, `centreSousTitres` 4:5) · M `src/moteurs/montage-image-video/sous-titres.ts` (bande par format) · M `src/moteurs/montage-image-video/publication.ts` · M `src/briques/schema-motion/types.ts` (bande et zone utile par format, 9:16 inchangé) · M `studio-rendu/compositions/image-video/{Entete.tsx,plan.ts,mise-en-page.ts}` · C `tests/image-video/variete/format-4x5.test.ts` · C `docs/…/variete/integration/f45/` |
| **8 · TIR** Anti-répétition | règles 72 § 5 et ressemblance 72 § 6.1 ; correctif « bruitages qui repartent toujours de la même variante » | M `src/moteurs/montage-image-video/variete/historique.ts` · C `src/moteurs/montage-image-video/variete/ressemblance.ts` · M `src/moteurs/montage-image-video/bruitages.ts` (point de départ tiré de la graine) · C `tests/image-video/variete/historique.test.ts`, C `tests/image-video/variete/bruitages-graine.test.ts` |
| **F · Assemblage + répétition générale** (en dernier) | tout | M `fabrication.ts` (tirage, recette gardée dans l'état, ouverture par réseau, récit donné à l'écriture), M `src/components/formats/image-video/vue.ts` (+ composant d'affichage de la recette, modifiable avant la voix), C `scripts/image-video/variete/repetition-generale.mts`, C `tests/image-video/variete/assemblage.test.ts`, C `docs/…/variete/integration/repetition/` ; tout fichier des lots pour résoudre les écarts |

C = créé, M = modifié. `…/variete/axes/` = `src/moteurs/montage-image-video/variete/axes/`.

**Deux exceptions surveillées.** `fabrication.ts` et `image-video-rendu.ts` sont touchés par le lot F45 **seul** parmi les lots parallèles ; le lot F passe après tout le monde. `bruitages.ts` est touché par TIR seul ; les autres lots ne changent pas les événements, donc pas les bruitages.

### Critère de fin commun à tous les lots d'axe (1 à 6)
1. **Tests** : le test du lot rougit sur la branche du socle (bouchons) et passe avec le lot ; `invariantsVarieteIV` passe pour chaque variante du lot sur les 6 cartes (ou repli justifié et inscrit dans `replis`) ; `tests/image-video` complet vert une fois à la fin.
2. **Images fixes** : `scripts/image-video/variete/images-fixes.mts --code <CODE>` en 9:16, et en 4:5 pour les variantes que `recettePourVersion` garde en 4:5 ; maquettes rendues par `prototypes/rendre.mts` avec le fichier `entree.tsx` du dossier `d1`/`d2`/`d3` ; `cote-a-cote.py` produit `docs/formats/image-video/variete/integration/<lot>/<CODE>.jpg` (maquette | moteur).
3. **Mesure** : `python3 -I docs/formats/image-video/variete/prototypes/occupation.py <dossier>` sur chaque image du moteur : **occupation ≥ 60 %, plus grand trou ≤ 15 %, équilibre ≥ 0,5, zone d'appoint ≥ 50 % (9:16)** (doc 74 § 2 bis, doc 76). Les écrans à deux aplats (OUV-B, CAM-E, TRA-C) sont aussi vérifiés à l'œil, comme en v3.
4. **Charte** (doc 74) : texte porteur ≥ 58 px, chiffre-clé ≥ 96 px, chiffre focal ≥ 230 px, un seul mot orange par écran, marque visible, rien dans les zones protégées.
5. Résultats écrits dans `docs/…/variete/integration/<lot>/mesures.md` et recopiés dans la PR.

---

### Lot 1 · OUV-FIN — Ouvertures et fins

**But.** Les 3 premières secondes de chaque version deviennent l'une des 5 ouvertures validées, choisie par réseau ; la fin devient FIN-C (boucle vers la première image) ou FIN-D (le chiffre reste au-dessus de la phrase-choc), ou reste FIN-A.
**Comment.** `axes/ouverture.ts` remplace le début du premier bloc (0 → fin de la première phrase, au plus 3,5 s) par un bloc `variete` `axe: "ouverture"` dont les données viennent de la carte (chiffre final, avant/après, heure, question de l'accroche, nœud d'alerte) ; `possibles` : OUV-A s'il y a un chiffre final, OUV-B pour les types avant-après et entonnoir (ou deux chiffres opposés), OUV-C s'il y a une heure ou un objet du quotidien, OUV-D toujours, OUV-E s'il y a un schéma. `axes/fin.ts` change la donnée du moment `phrase-choc` (sans toucher la phrase, mot pour mot) : FIN-C reprend l'objet de l'ouverture tirée, FIN-D garde le chiffre-clé.
**Tests.** Pour chaque code : le premier bloc est `variete/ouverture/<code>`, ses données contiennent le chiffre de la carte avec son unité ; la phrase-choc reste identique ; FIN-C sur une version dont l'ouverture est OUV-C rend l'horloge. **Rouge sans le lot** : avec la recette `OUV-A`, le premier bloc est encore `sorte: "ecran"`.
**Images attendues** : OUV-A-1/2, OUV-B-1/2, OUV-C-1/2, OUV-D-1/2, OUV-E-1/2, FIN-C-1, FIN-D-2, R45-OUV-A-1, R45-FIN-D-1.
**Durée** : 5 à 7 h (Opus), le plus gros lot visuel. **Risques** : la donnée d'ouverture n'existe pas dans toutes les cartes (→ repli inscrit, jamais un écran vide) ; OUV-A « rembobine » : ne jamais montrer un chiffre avant qu'il soit dit **sauf** dans l'ouverture (règle Q13 : vérifier que le contrôle des chiffres l'accepte, sinon le dire dans la PR, ne pas modifier `controles-scene.ts`).

### Lot 2 · REC — Récit

**But.** Le déroulé change dès le script : REC-B (résultat puis « voici comment »), REC-C (on suit un message, une commande), REC-D (« 3 étapes », repère 1/3 → 3/3 sur le schéma).
**Comment.** `recettes.ts` : un parcours par récit ; `ecriture.ts` : accepte `recit?: CodeRecit` et l'ajoute à la consigne de Claude (aucun appel en test : doubles) ; `regles.ts` : l'ossature permise suit le récit (résultat avant la douleur en REC-B) ; `ecriture.simulation.ts` : fiches simulées REC-B/C/D pour la carte C (ajouts) ; `axes/recit.ts` + `variete/recit/calque.tsx` : repère « k/3 » sur la toile (correctif 72 § 7 point 5), bulle suivie (REC-C), carte « Voici comment » (REC-B).
**Tests.** La consigne d'écriture contient le parcours du récit tiré ; une fiche REC-B qui met le résultat d'abord passe `verifierScript` ; REC-D : le repère est présent sur les blocs `toile` ; **rouge sans le lot** : `ecrireScriptIV(…, { recit: "REC-B" })` ne change pas la consigne.
**Images** : REC-B-1/2, REC-C-1/2, REC-D-1/2.
**Durée** : 4 à 5 h (Opus). **Risques** : le récit vit dans le script, donc dans la voix payée : il est tiré **avant** l'écriture et identique pour tous les réseaux (le lot F le branche) ; la règle « tout est expliqué dans l'ordre réel du processus » doit rester vraie (REC-B ne fait que déplacer le résultat).

### Lot 3 · CHI — Chiffres

**But.** Chaque chiffre de la carte est montré par la variante tirée : anneau (CHI-B), duel de tailles (CHI-C), chiffre géant (CHI-D), en objets (CHI-E).
**Comment.** `axes/chiffres.ts` transforme les moments `bandeau` et les accents de toile en blocs ou données `variete/chiffre` ; `possibles` : CHI-C seulement s'il y a deux chiffres comparables, CHI-E si le nombre se compte (≤ 20 objets), CHI-B pour un pourcentage, CHI-D toujours. Le calque `chiffres/calque.tsx` dessine l'**accent** sur une étape déjà posée (correctif 72 § 7 point 4), à la position lue dans la scène du contexte (`useVariete().scene`), sans toucher `Toile.tsx`.
**Tests.** Chaque chiffre de la carte reste montré **sur son mot** avec son unité (`invariantsVarieteIV`) ; CHI-C refusé sans paire → repli CHI-A inscrit ; **rouge sans le lot** : recette `CHI-B` → aucun bloc ni donnée `chiffre` `CHI-B`.
**Images** : CHI-B-1/2, CHI-C-1/2, CHI-D-1, CHI-E-2, R45-CHI-B-1, R45-CHI-D-1.
**Durée** : 4 à 5 h (Opus). **Risques** : le compteur actuel (CHI-A) sert aussi au bandeau final ; garder le bandeau entier lisible si plusieurs chiffres arrivent ensemble.

### Lot 4 · CAM-TRA — Caméra et transitions

**But.** Trois parcours de caméra (CAM-B vue d'ensemble puis plongée, CAM-C point lumineux qui court sur le fil, CAM-E deux branches côte à côte) et trois transitions (TRA-B raccord d'objet, TRA-C balayage orange, TRA-D on entre dans la carte), **une transition principale par vidéo + coupes franches**.
**Comment.** `axes/camera.ts` réécrit la `trajectoire` des blocs `toile` (CAM-B : plan d'ensemble au début et à la fin ; CAM-C : suit le point) et remplace la séquence des branches par un bloc `variete/camera` en CAM-E ; le point lumineux et la silhouette sont des calques (`camera/calque.tsx`). `axes/transitions.ts` pose `variete.donnees.transitions = { entree?, sortie? }` aux **jointures de blocs** choisies (au plus une sur deux, jamais au milieu d'une phrase-choc) ; le calque `transitions/calque.tsx` dessine la sortie dans les 0,4 dernières secondes du bloc A et l'entrée dans les 0,4 premières du bloc B (les blocs restent rendus séparément puis mis bout à bout : la jointure reste invisible).
**Tests.** Les contrôles de caméra (`controlerCamera`, Q15 : jamais trop vite pour lire) passent pour CAM-B/C ; CAM-E refusé en 4:5 si une branche fait moins de 400 px → repli ; une seule transition principale par ligne de temps ; **rouge sans le lot** : recette `TRA-C` → aucun bloc ne porte de transition.
**Images** : CAM-B-1/2, CAM-C-1/2, CAM-E-1/2, TRA-B-1/2, TRA-C-1, TRA-D-1, R45-CAM-C-1 ; plus deux images de part et d'autre d'une jointure (fin du bloc A, début du bloc B) pour chaque transition.
**Durée** : 6 à 8 h (Opus), le lot le plus risqué. **Risques** : la vitesse de caméra (Q15) ; la continuité visuelle d'une jointure entre deux MP4 séparés (vérifier sur la vidéo finale du lot F) ; CAM-E change la mise en page des branches.

### Lot 5 · TYP-SOU — Écrans de texte et sous-titres

**But.** Les écrans de texte deviennent propres à l'IV (TYP-B un mot géant à la fois, TYP-C lignes qui glissent, TYP-D le mot devient l'objet) ; les sous-titres passent en intensité appuyée (SOU-C) quand c'est tiré.
**Comment.** `axes/typo.ts` remplace les blocs `ecran` de scène émotion (sauf ceux déjà pris par l'ouverture) par des blocs `variete/texte`, avec **l'heure de chaque mot** (correctif 72 § 7 point 2 : les lignes avancent au rythme de la voix) ; `possibles` : TYP-D seulement si un mot a un objet connu (alerte → cloche, e-mail → enveloppe, 24h → horloge). `sous-titres-varies.ts` lit `ligne.variete.recette.sousTitres` (SOU-C → intensité « appuyée » de la brique ; sans recette : inchangé). Les écrans `CasConcretEcran` ne sont pas modifiés (TYP-A).
**Tests.** Chaque mot écrit apparaît au plus tard 0,15 s après son mot dit ; un seul mot orange par écran ; SOU-C donne plus de mots mis en avant que SOU-B sur la carte C et reste dans la bande (Q22) ; **rouge sans le lot** : recette `TYP-B` → les blocs émotion sont encore `ecran`.
**Images** : TYP-B-2, TYP-C-2, TYP-D-1/2, SOU-C-1 (avec les vrais sous-titres : image extraite du rendu de la composition `CalqueSousTitres`, ou témoin).
**Durée** : 4 à 5 h (Opus). **Risques** : TYP-B est déconseillé en 4:5 (déjà remplacé par le socle) ; un écran de texte trop long pour TYP-B → repli TYP-C.

### Lot 6 · APP-MAT — Apparition et matière

**But.** Les cartes du schéma apparaissent autrement (APP-B tracé au feutre, APP-C fantôme qui s'allume, APP-D cartes qui tombent) ; la matière change (MAT-B papier, MAT-C trait fait main, MAT-D profondeur douce), **dans la charte** (mêmes couleurs, mêmes polices).
**Comment.** `Toile.tsx` et `Noeud.tsx` lisent `useVariete()` (sans contexte ou sans recette : rendu identique à aujourd'hui) ; APP-C a besoin de tout le schéma pâle dès le début (`axes/apparition.ts` pose `dejaVus`/fantôme dans les propriétés de la toile) ; la matière est un **calque** (`matiere/calque.tsx` : grain de papier, filtre SVG de tremblé, ombres et épaisseur) appliqué à toutes les scènes, plus l'épaisseur des cartes dans `Noeud.tsx` (MAT-D).
**Tests.** Rendu « sans recette » de `Toile`/`Noeud` inchangé (empreinte du HTML statique rendu par `react-dom/server` avant/après, ou test existant de la toile vert) ; APP-C : tous les nœuds présents dès le début avec l'opacité fantôme, allumés à leur mot ; **rouge sans le lot** : recette `APP-C` → la toile n'a aucun nœud fantôme au début.
**Images** : APP-B-2, APP-C-2, APP-D-1, MAT-B-1, MAT-C-1, MAT-D-1.
**Durée** : 4 à 5 h (Opus). **Risques** : le filtre SVG coûte du temps de rendu (mesurer : pas plus de +30 % par image fixe) ; MAT-B est la plus subtile (verdict) : vérifier qu'elle se distingue de MAT-A en vignette.

### Lot 7 · F45 — Format 4:5, LinkedIn et Facebook double

**But.** Fabriquer une version 4:5 (1080 × 1350) pour LinkedIn et le fil Facebook, en plus du 9:16 pour TikTok, Shorts, Reels Instagram et **Reels Facebook**. Même voix, même script : une autre mise en page.
**Comment.** `types.ts` (brique) : bande des sous-titres et zone utile **par format** (le 9:16 garde exactement ses valeurs) ; `Entete.tsx`, `plan.ts`, `mise-en-page.ts` : en-tête resserré, masque de toile, zone utile en 4:5 ; `sous-titres.ts` : bande 1042 → 1176 en 4:5 ; `image-video-rendu.ts` : `RATIO` lu dans la ligne, `centreSousTitres` 4:5 ; `fabrication.ts` : une version par **(groupe de fins × format)** — LinkedIn → 4:5, Facebook → deux versions (9:16 Reel et 4:5 fil, même fin « Le lien est en commentaire »), livraison de Facebook avec **deux fichiers** (`fichierCle` du Reel + `fichierCleFil`) ; `publication.ts` : le texte du fil Facebook. Aucune nouvelle voix, aucune nouvelle transcription payée en plus de ce que la porte fait déjà par version (le dire dans la PR si le coût des contrôles augmente : il augmente d'une version).
**Tests.** Carte C, réseaux `linkedin` et `facebook` : 3 versions (LinkedIn 4:5, Facebook 9:16, Facebook 4:5) avec **une seule** piste voix ; la livraison Facebook a deux fichiers ; aucun texte ni chiffre hors de y 54 → 1215 en 4:5 ; la ligne de temps 9:16 reste identique à master ; **rouge sans le lot** : la version LinkedIn a `hauteur = 1920`.
**Images** : R45-OUV-A-1, R45-CHI-B-1, R45-CHI-D-1, R45-CAM-C-1, R45-FIN-D-1 côté mise en page (avec les variantes des lots 1, 3, 4 une fois fusionnées : avant, comparer l'en-tête, la toile et la bande des sous-titres de la galerie C en 4:5).
**Durée** : 6 à 8 h (Opus). **Risques** : le plus de fichiers partagés de la chaîne (fabrication, service) ; le coût des contrôles (une version de plus pour Facebook) ; l'interface « Votre vidéo » montre deux fichiers Facebook (signalé au lot F) ; les zones protégées du fil Facebook ne sont pas dans `src/reseaux/index.ts` (on prend celles de LinkedIn, comme le doc 73).

### Lot 8 · TIR — Deux vidéos ne se ressemblent pas

**But.** Le tirage du socle devient **garanti** : règles 72 § 5 (ouverture jamais la même que l'une des 3 dernières vidéos IV ; combinaison ouverture + récit + caméra jamais la même que l'une des 10 dernières ; ressemblance de recette < 60 % avec chacune des 10 dernières) ; si aucune combinaison ne passe, la **moins ressemblante** est prise (jamais de blocage).
**Comment.** `ressemblance.ts` : poids du doc 72 § 6.1 (ouverture 3, récit 2, caméra 2, apparition 2, chiffres 1,5, transitions 1,5, texte 1, fin 1, matière 1, sous-titres 0,5 ; total 15,5) ; `historique.ts` : `accepteHistoriqueIV` + `meilleurRepliIV` ; `bruitages.ts` : le point de départ des variantes de bruitage vient de la graine (correctif 72 § 7 point 3), sans recette ni graine : inchangé.
**Tests.** Exemples du doc 72 § 6.1 (19 % et 90 %) ; 30 tirages enchaînés avec historique : aucune ouverture répétée sur 3, aucune ressemblance ≥ 60 % sur 10 ; même historique → même choix ; **rouge sans le lot** : avec un historique de 3 vidéos en OUV-A, le socle peut encore tirer OUV-A.
**Images** : aucune (lot pur) ; planche « 3 tirages » faite au lot F.
**Durée** : 2 à 3 h (Sonnet suffit). **Risques** : l'historique doit lire les recettes des vidéos **publiées** : leur stockage est branché au lot F (ici : fonction pure qui reçoit la liste).

---

## 5. Le lot final F · Assemblage + répétition générale (après les 9 autres)

**But.** Brancher la variété dans la fabrication réelle et prouver, sur 3 vidéos de bout en bout, que tout tient, **sans aucun appel payant**.
**Branchement.**
- `fabrication.ts` : la recette est tirée **après la validation de la carte** et **avant l'écriture** (graine = `videoId`, historique = recettes des 10 dernières vidéos IV prêtes) ; elle est gardée dans l'état (reprise sans retirage) ; le récit est donné à `ecrireScriptIV` ; chaque version reçoit `recettePourVersion(recette, réseaux, format)` et son ouverture par réseau ; la recette est dans le journal et dans `resume.json`.
- Interface : la recette s'affiche à l'écran « Votre script » (`src/components/formats/image-video/vue.ts` + un petit composant) ; Will peut changer une variante **avant de payer la voix** (le récit ne change plus après le script).
- Lecture de l'historique : depuis les travaux IV « prêts » déjà stockés (aucune table nouvelle si l'état les contient).
**Répétition générale (3 vidéos).** Nouveau script `scripts/image-video/variete/repetition-generale.mts` :
1. Cartes C (embranchement), D (entonnoir), E (avant-après) des fixtures ; fiches simulées ; trois graines consécutives avec historique (la 2ᵉ voit la 1ʳᵉ, la 3ᵉ les deux) → trois recettes différentes (imprimées).
2. Voix : **`public/demo/essai-voix.mp3`** découpée/bouclée à la durée de chaque version par FFmpeg local, mots horodatés par `pisteSimulee` (aucune transcription payante) ; bruitages : les fichiers de `public/bruitages/*.wav`.
3. Rendu : le **vrai serveur `studio-rendu` lancé en local** avec un faux seau HTTP, comme `studio-rendu/scripts/essai-local.ts` (`STUDIO_RENDU_ESSAI=1`), puis le vrai service `rendreVersionIV` de `src/services/image-video-rendu.ts` branché dessus : scènes par bloc puis montage `complet`. Une commande par vidéo (chacune < 10 min ; sinon ne rendre que la version TikTok 9:16 + la version LinkedIn 4:5 de chaque vidéo).
4. Sorties dans `docs/formats/image-video/variete/integration/repetition/` : 3 MP4 **non commités** (trop lourds ; chemins et empreintes dans `resume.md`), images extraites à 0,5 s, 1,5 s, 3 s puis toutes les 3 s, **planche des 3 tirages** par `prototypes/tirages.py`, mesure `occupation.py` de chaque image, ressemblance de recette deux à deux (< 60 %), contrôles de la porte en doubles (`porteUniqueIV` avec transcription simulée).
**Tests.** `assemblage.test.ts` : fabrication complète en doubles avec variété : 5 réseaux → 6 fichiers (Facebook ×2), une seule voix payée (caisse), recette identique après reprise ; deux vidéos à la suite → ressemblance < 60 % ; **rouge sans le lot** : l'état de fabrication n'a pas de recette.
**Critère de fin** : 3 vidéos rendues, lues par FFprobe (durée = ligne de temps ± 0,1 s, 1080 × 1920 ou 1080 × 1350, son présent, aucune image noire ou figée > 0,5 s hors fin), toutes les images extraites passent les seuils d'occupation (hors fin et phrase-choc, vérifiées à l'œil), planche des 3 tirages : aucune paire d'images d'ouverture semblable.
**Durée** : 4 à 6 h (Opus), dont 1 à 2 h de rendu. **Risques** : le montage `complet` en local (FFmpeg + Chromium) peut dépasser 10 min par vidéo → découper par version ; écarts entre lots découverts seulement ici (jointures de transitions, 4:5 des variantes) : le lot F les corrige ou les liste.

---

## 6. Ordre et calendrier

```
J0        S · Socle  (3-4 h)  ── revue + fusion par la session studio
J0 + ½    ┌ 1 OUV-FIN (5-7 h) ┐
          ├ 2 REC     (4-5 h) │
          ├ 3 CHI     (4-5 h) │
          ├ 4 CAM-TRA (6-8 h) ├─ en parallèle, 8 routines, branches depuis le socle
          ├ 5 TYP-SOU (4-5 h) │
          ├ 6 APP-MAT (4-5 h) │
          ├ 7 F45     (6-8 h) │
          └ 8 TIR     (2-3 h) ┘
J2        revue + fusions (ordre conseillé : TIR, REC, CHI, TYP-SOU, APP-MAT, OUV-FIN, CAM-TRA, F45)
J2 + ½    F · Assemblage + répétition générale (4-6 h)
```
**Honnêtement** : 8 h de travail d'agent ne tiennent pas toujours dans une seule session cloud ; un lot qui s'arrête pousse sa branche et ouvre sa PR **en l'état** avec ce qui reste (règle « deux corrections au plus »), puis une seconde routine reprend la même branche. Total ≈ 45 à 60 h d'agent, ≈ 2 à 3 jours calendaires si les revues suivent.

## 7. Risques transverses
1. **Contrôles bloquants** : ils lisent les événements, pas le dessin. Une variante pourrait cacher un chiffre que les événements disent montré. Parade : `invariantsVarieteIV` obligatoire dans chaque lot, et les images fixes.
2. **Image Docker** : une composition qui importe un fichier non copié casse la prod (test L17). Parade : composants dans `studio-rendu/compositions/image-video/variete/**`, contrat dans `src/briques/schema-motion/variete.ts` ; jamais d'import de `src/moteurs/**` depuis une composition.
3. **`import React`** : chaque `.tsx` commence par `import React from "react";`, aucun JSX au niveau module (`react-module.test.ts`).
4. **Temps de rendu** : plus de blocs (ouverture, écrans de texte) = plus de MP4 de scène ; les scènes déjà rendues restent gardées par empreinte.
5. **Coût** : aucune dépense nouvelle **sauf** une version Facebook 4:5 de plus à contrôler (transcription + relecture par version) : à confirmer par Will lors de la fusion de F45.
6. **Correctif hors périmètre** : la seconde accroche écrite par Claude (72 § 7 point 1) demanderait une seconde voix (payante) ; non fait.

---

## 8. Consignes prêtes à coller (une routine cloud par lot)

Chaque consigne est autonome. Bloc commun (répété dans chacune) :
- dépôt `will383842/studio-axion-ia` ; lire d'abord `AGENTS.md`, `docs/REGLES-ROUTINES.md`, `(document interne non publié)`, puis ce document (`docs/formats/image-video/variete/80-PLAN-INTEGRATION.md`) ;
- **ne jamais fusionner**, rien déployer ; **aucun appel payant** (Claude, HeyGen, ElevenLabs, fal.ai, Higgsfield, Buffer, serveur de rendu distant, R2) : doubles seulement ;
- tests **au premier plan, jamais en arrière-plan** ; chaque commande < 10 min (sinon la découper par fichier) ;
- chaque `.tsx` de `studio-rendu` commence par `import React from "react";` et n'évalue aucun JSX au niveau module ;
- ne toucher **que** les fichiers listés pour le lot ; besoin d'un autre fichier : ne pas y toucher, l'écrire dans la PR ;
- fichiers interdits : `src/briques/fins/**`, `src/moteurs/montage-cas-concret/**`, `studio-rendu/compositions/cas-concret/**`, `studio-rendu/compositions/interface-claire/**`, `src/domaine/types.ts`, `src/briques/intensite/**`, `src/donnees/bruitages.ts`, `src/moteurs/montage-image-video/controles-scene.ts`.

### 8.0 Consigne · Socle
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), puis docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1 à 3 en entier).
MISSION : lot SOCLE de la variété Image → vidéo (§ 3 du plan). Contrat commun, tirage déterministe par graine,
points d'accroche dans mise-en-scene.ts, image-video-rendu.ts, Compositions.tsx, bouchons par axe, banc d'images fixes.
AUCUNE variante dessinée. Fichiers : exactement ceux du § 3 (créés et modifiés), rien d'autre.
RÈGLES : branche image-video/variete-socle depuis origin/master à jour ; ne jamais fusionner ; aucun appel payant ;
tests au premier plan, jamais en arrière-plan ; chaque commande < 10 min ; import React en tête de chaque .tsx de
studio-rendu, aucun JSX au niveau module ; aucun Math.random ni Date dans variete/** ; LF.
EXIGENCE CLÉ : sans recette, la ligne de temps des 6 cartes (fixtures tests/image-video/fixtures/cartes/A..F.json,
FICHES_SIMULEES, pisteSimulee) est identique octet pour octet à master : calcule l'empreinte AVANT de modifier quoi que
ce soit et fige-la dans tests/image-video/variete/socle.test.ts.
ÉTAPES : 1) git config core.autocrlf false ; pnpm install ; npm --prefix studio-rendu ci. 2) Test rouge d'abord
(import de tirerVarieteIV). 3) Contrat + tirage + bouchons + accroches. 4) Tests ciblés :
pnpm vitest run tests/image-video/variete tests/image-video/mise-en-scene.test.ts tests/image-video/rendu-reel.test.ts
tests/image-video/react-module.test.ts tests/image-video/galerie-prod.test.ts. 5) Banc :
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/images-fixes.mts --code OUV-A --format 9:16 --sortie /tmp/socle
puis python3 -I scripts/image-video/variete/cote-a-cote.py … (doit produire planche + mesures.md, même si le bouchon est vide).
6) À la fin, UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers touchés>.
LIVRAISON : commit, push -u origin image-video/variete-socle, PR vers master « Image → vidéo · variété : socle (contrat,
tirage, points d'accroche) », corps = résumé, fichiers, résultats exacts des commandes, rouges connus sans lien.
```

### 8.1 Consigne · Lot 1 OUV-FIN
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 1 »), 72-AXES-DE-VARIETE.md (axes 1 et 8), 73-ADAPTATION-PAR-RESEAU.md, 74-STANDARD-QUALITE.md,
76-mesure-occupation.md, planche/verdict-critique.json (OUV-*, FIN-*, R45-*).
MISSION : intégrer OUV-A, OUV-B, OUV-C, OUV-D, OUV-E, FIN-C, FIN-D (FIN-A reste la référence) dans le vrai moteur.
Références visuelles = maquettes v3 : docs/formats/image-video/variete/prototypes/d1-ouvertures-fins/{ouvertures,fins,
objets,r45}.tsx (à reprendre en composants de prod, pas à importer depuis docs/).
FICHIERS (exclusifs, rien d'autre) : src/moteurs/montage-image-video/variete/axes/ouverture.ts,
src/moteurs/montage-image-video/variete/axes/fin.ts, studio-rendu/compositions/image-video/variete/ouverture/** ,
studio-rendu/compositions/image-video/variete/fin/** , studio-rendu/compositions/image-video/variete/objets-ouverture.tsx,
tests/image-video/variete/ouverture.test.ts, tests/image-video/variete/fin.test.ts,
docs/formats/image-video/variete/integration/ouv-fin/** .
BRANCHE : si origin/master contient src/briques/schema-motion/variete.ts, partir de origin/master ; sinon de
origin/image-video/variete-socle. Branche image-video/variete-ouv-fin.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx de studio-rendu ; ne pas toucher mise-en-scene.ts, controles-scene.ts,
Compositions.tsx, image-video-rendu.ts ni les compositions du cas concret ; phrase-choc mot pour mot ; un chiffre jamais
montré avant d'être dit hors de l'ouverture.
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (recette OUV-A → premier bloc encore
« ecran »). 3) possibles() + appliquer() + composants. 4) pnpm vitest run tests/image-video/variete.
5) Pour chaque code : studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/images-fixes.mts --code <CODE>
--format 9:16 --sortie /tmp/ouv/moteur (et --format 4:5 pour OUV-A, FIN-D) ; maquettes :
studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/prototypes/rendre.mts
docs/formats/image-video/variete/prototypes/d1-ouvertures-fins/entree.tsx /tmp/ouv/maquette ; puis
python3 -I scripts/image-video/variete/cote-a-cote.py … --sortie docs/formats/image-video/variete/integration/ouv-fin.
CRITÈRE : chaque image du moteur : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint ≥ 50 % (9:16) par
python3 -I docs/formats/image-video/variete/prototypes/occupation.py ; textes ≥ 58 px, chiffre focal ≥ 230 px,
un mot orange. 6) À la fin UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ;
pnpm eslint <fichiers touchés>.
LIVRAISON : commit, push -u origin image-video/variete-ouv-fin, PR (vers master si le socle y est, sinon vers
image-video/variete-socle) « Image → vidéo · variété : ouvertures et fins (OUV-A…E, FIN-C, FIN-D) », corps = planches
côte à côte, tableau des mesures, résultats exacts des commandes, replis connus.
```

### 8.2 Consigne · Lot 2 REC
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 2 »), 72-AXES-DE-VARIETE.md (axe 2, § 7 point 5), 74-STANDARD-QUALITE.md,
planche/verdict-critique.json (REC-*).
MISSION : intégrer REC-B (résultat puis « voici comment »), REC-C (suivre un message), REC-D (3 étapes annoncées,
repère k/3 sur le schéma). REC-A reste la référence. Le récit est donné à l'écriture du script (consigne de Claude) :
en test, uniquement des doubles (aucun appel). Maquettes : docs/formats/image-video/variete/prototypes/d2-recit-chiffres-typo/recit.tsx.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/axes/recit.ts, src/moteurs/montage-image-video/recettes.ts,
src/moteurs/montage-image-video/ecriture.ts, src/moteurs/montage-image-video/ecriture.simulation.ts (AJOUTS seulement,
ne modifie aucune fiche existante), src/moteurs/montage-image-video/regles.ts,
studio-rendu/compositions/image-video/variete/recit/** , tests/image-video/variete/recit.test.ts,
docs/formats/image-video/variete/integration/rec/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-rec.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx de studio-rendu ; ne pas toucher mise-en-scene.ts, fabrication.ts, controles-scene.ts ;
l'explication reste complète et dans l'ordre réel du processus (REC-B déplace seulement le résultat au début).
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (ecrireScriptIV avec recit REC-B ne
change pas la consigne ; REC-D sans repère sur la toile). 3) Code. 4) pnpm vitest run tests/image-video/variete
tests/image-video/ecriture.test.ts tests/image-video/fabriquer-script.test.ts. 5) Images : scripts/image-video/variete/images-fixes.mts
--code REC-B|REC-C|REC-D --format 9:16 ; maquettes par prototypes/rendre.mts sur d2-recit-chiffres-typo/entree.tsx ;
cote-a-cote.py vers docs/formats/image-video/variete/integration/rec. CRITÈRE : seuils d'occupation du doc 76 sur chaque
image. 6) À la fin UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-rec, PR (vers master si le socle y est, sinon vers la branche du
socle) « Image → vidéo · variété : déroulé du récit (REC-B, REC-C, REC-D) », résultats exacts.
```

### 8.3 Consigne · Lot 3 CHI
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 3 »), 72-AXES-DE-VARIETE.md (axe 3, § 7 point 4), 74-STANDARD-QUALITE.md, 76-mesure-occupation.md,
planche/verdict-critique.json (CHI-*, R45-CHI-*).
MISSION : intégrer CHI-B (anneau), CHI-C (duel de tailles), CHI-D (chiffre géant), CHI-E (en objets) ; CHI-A reste la
référence. Corriger aussi « le chiffre qui claque sur une étape déjà posée n'est pas dessiné » (calque, sans toucher
Toile.tsx). Maquettes : docs/formats/image-video/variete/prototypes/d2-recit-chiffres-typo/chiffres.tsx et d1-ouvertures-fins/r45.tsx.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/axes/chiffres.ts,
studio-rendu/compositions/image-video/variete/chiffres/** , tests/image-video/variete/chiffres.test.ts,
docs/formats/image-video/variete/integration/chi/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-chi.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx ; chaque chiffre de la carte reste montré sur son mot, avec son unité
(invariantsVarieteIV de tests/image-video/variete/invariants.ts) ; ne pas toucher Toile.tsx, BandeauChiffres.tsx,
mise-en-scene.ts, controles-scene.ts.
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Test rouge d'abord (recette CHI-B → aucune donnée chiffre
CHI-B). 3) Code. 4) pnpm vitest run tests/image-video/variete. 5) Images : images-fixes.mts --code CHI-B|CHI-C|CHI-D|CHI-E
--format 9:16, et --format 4:5 pour CHI-B, CHI-D ; maquettes par prototypes/rendre.mts ; cote-a-cote.py vers
docs/formats/image-video/variete/integration/chi. CRITÈRE : occupation ≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5, appoint
≥ 50 % ; chiffre focal ≥ 230 px. 6) À la fin UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen &&
pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-chi, PR (vers master si le socle y est, sinon vers la branche du
socle) « Image → vidéo · variété : façons de montrer les chiffres (CHI-B…E) », résultats exacts.
```

### 8.4 Consigne · Lot 4 CAM-TRA
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 4 »), 72-AXES-DE-VARIETE.md (axes 4 et 7, règle « une transition principale + coupe franche »),
74-STANDARD-QUALITE.md, planche/verdict-critique.json (CAM-*, TRA-*, R45-CAM-C-1).
MISSION : intégrer CAM-B (vue d'ensemble en silhouette puis plongée), CAM-C (point lumineux qui court sur le fil),
CAM-E (deux branches côte à côte), TRA-B (raccord d'objet), TRA-C (balayage orange), TRA-D (on entre dans la carte).
CAM-D et TRA-E sont RETIRÉES : jamais produites. Maquettes : docs/formats/image-video/variete/prototypes/
d3-camera-schema-transitions/{camera,transitions,kit,r45}.tsx.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/axes/camera.ts,
src/moteurs/montage-image-video/variete/axes/transitions.ts, studio-rendu/compositions/image-video/variete/camera/** ,
studio-rendu/compositions/image-video/variete/transitions/** , tests/image-video/variete/camera.test.ts,
tests/image-video/variete/transitions.test.ts, docs/formats/image-video/variete/integration/cam-tra/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-cam-tra.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx ; ne pas toucher Camera.tsx, Toile.tsx, Noeud.tsx, mise-en-scene.ts,
controles-scene.ts ni la brique schema-motion (camera.ts) : la trajectoire est réécrite dans axes/camera.ts ;
controlerCamera (Q15) doit passer ; une seule transition principale par vidéo ; les blocs restent rendus séparément
(sortie dessinée dans les 0,4 s de fin du bloc A, entrée dans les 0,4 s de début du bloc B).
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (recette TRA-C → aucune transition ;
CAM-B → trajectoire inchangée). 3) Code. 4) pnpm vitest run tests/image-video/variete tests/image-video/camera.test.ts.
5) Images : images-fixes.mts --code CAM-B|CAM-C|CAM-E|TRA-B|TRA-C|TRA-D --format 9:16 (et 4:5 pour CAM-C) ; pour chaque
transition, deux images de part et d'autre d'une jointure ; maquettes par prototypes/rendre.mts sur
d3-camera-schema-transitions/entree.tsx ; cote-a-cote.py vers docs/formats/image-video/variete/integration/cam-tra.
CRITÈRE : seuils du doc 76 ; écrans à deux aplats (CAM-E, TRA-C) vérifiés aussi à l'œil. 6) À la fin UNE fois :
pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-cam-tra, PR (vers master si le socle y est, sinon vers la branche
du socle) « Image → vidéo · variété : caméra et transitions (CAM-B, C, E · TRA-B, C, D) », résultats exacts.
```

### 8.5 Consigne · Lot 5 TYP-SOU
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 5 »), 72-AXES-DE-VARIETE.md (axes 5 et 10, § 7 point 2), 74-STANDARD-QUALITE.md,
planche/verdict-critique.json (TYP-*, SOU-*).
MISSION : écrans de texte propres à l'IV : TYP-B (un mot géant à la fois), TYP-C (lignes qui glissent), TYP-D (le mot
devient l'objet : alerte → cloche, e-mail → enveloppe, 24h → horloge) ; chaque ligne arrive AU RYTHME DES MOTS DITS.
TYP-A reste la référence (écrans empruntés CasConcretEcran, NON modifiés). Sous-titres : SOU-C appuyé quand la recette le
dit (SOU-B sinon ; SOU-A retirée). Maquettes : prototypes/d2-recit-chiffres-typo/typo.tsx et d1-ouvertures-fins/soustitres.tsx.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/axes/typo.ts,
src/moteurs/montage-image-video/sous-titres-varies.ts, studio-rendu/compositions/image-video/variete/texte/** ,
tests/image-video/variete/typo.test.ts, tests/image-video/variete/sous-titres.test.ts,
docs/formats/image-video/variete/integration/typ-sou/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-typ-sou.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx ; ne pas toucher studio-rendu/compositions/cas-concret/**, mise-en-scene.ts,
image-video-rendu.ts, controles-scene.ts ; un seul mot orange par écran ; sous-titres toujours dans la bande (Q22) ;
sans recette, sous-titres identiques à master.
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (recette TYP-B → blocs émotion encore
« ecran » ; SOU-C → mêmes segments que SOU-B). 3) Code. 4) pnpm vitest run tests/image-video/variete
tests/image-video/sous-titres-varies.test.ts. 5) Images : images-fixes.mts --code TYP-B|TYP-C|TYP-D|SOU-C --format 9:16 ;
maquettes par prototypes/rendre.mts ; cote-a-cote.py vers docs/formats/image-video/variete/integration/typ-sou.
CRITÈRE : seuils du doc 76 ; mot écrit ≤ 0,15 s après son mot dit. 6) À la fin UNE fois : pnpm vitest run tests/image-video ;
pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-typ-sou, PR (vers master si le socle y est, sinon vers la branche
du socle) « Image → vidéo · variété : écrans de texte et sous-titres appuyés (TYP-B, C, D · SOU-C) », résultats exacts.
```

### 8.6 Consigne · Lot 6 APP-MAT
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2, 4 « Critère
de fin commun » et « Lot 6 »), 72-AXES-DE-VARIETE.md (axes 6 et 9), 74-STANDARD-QUALITE.md (charte : mêmes couleurs,
mêmes polices), planche/verdict-critique.json (APP-*, MAT-*).
MISSION : APP-B (tracé au feutre), APP-C (schéma fantôme qui s'allume), APP-D (cartes qui tombent) ; MAT-B (papier),
MAT-C (trait fait main), MAT-D (profondeur douce). APP-A et MAT-A restent les références (rendu actuel, inchangé sans
recette). Maquettes : prototypes/d3-camera-schema-transitions/apparition.tsx et prototypes/d1-ouvertures-fins/matiere.tsx.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/axes/apparition.ts,
src/moteurs/montage-image-video/variete/axes/matiere.ts, studio-rendu/compositions/image-video/Toile.tsx,
studio-rendu/compositions/image-video/Noeud.tsx, studio-rendu/compositions/image-video/variete/apparition/** ,
studio-rendu/compositions/image-video/variete/matiere/** , tests/image-video/variete/apparition.test.ts,
tests/image-video/variete/matiere.test.ts, docs/formats/image-video/variete/integration/app-mat/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-app-mat.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
import React en tête de chaque .tsx ; Toile.tsx et Noeud.tsx lisent useVariete() et rendent EXACTEMENT comme avant sans
recette ; ne pas toucher Compositions.tsx, Camera.tsx, mise-en-scene.ts ; filtre de matière : au plus +30 % de temps
par image fixe (mesurer et l'écrire).
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (recette APP-C → aucun nœud fantôme au
début). 3) Code. 4) pnpm vitest run tests/image-video/variete tests/image-video/mise-en-page.test.ts
tests/image-video/react-module.test.ts. 5) Images : images-fixes.mts --code APP-B|APP-C|APP-D|MAT-B|MAT-C|MAT-D --format 9:16 ;
maquettes par prototypes/rendre.mts ; cote-a-cote.py vers docs/formats/image-video/variete/integration/app-mat.
CRITÈRE : seuils du doc 76 ; MAT-B se distingue de MAT-A en vignette de 200 px (planche côte à côte). 6) À la fin
UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-app-mat, PR (vers master si le socle y est, sinon vers la branche
du socle) « Image → vidéo · variété : apparition du schéma et matière (APP-B, C, D · MAT-B, C, D) », résultats exacts.
```

### 8.7 Consigne · Lot 7 F45
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 1, 2 et « Lot 7 »),
73-ADAPTATION-PAR-RESEAU.md (en entier), 74-STANDARD-QUALITE.md § 3 (zones 4:5), 76-mesure-occupation.md (hauteur utile
4:5 : y 54 → 1215, bande des sous-titres 1042 → 1176).
DÉCISIONS DE WILL : LinkedIn en 4:5 (1080 × 1350) ; Facebook = DEUX fichiers (Reel 9:16 + fil 4:5) ; TikTok, Shorts, Reels
Instagram en 9:16 ; pas de version 30 s. Une seule voix payée par vidéo.
MISSION : la fabrication produit une version par (groupe de fins × format) ; le rendu lit le ratio de la ligne ; la mise
en page (en-tête, toile, zone utile, bande des sous-titres) marche en 4:5 ; la livraison Facebook porte deux fichiers.
Le 9:16 reste identique à master (test).
FICHIERS (exclusifs) : src/moteurs/montage-image-video/fabrication.ts, src/services/image-video-rendu.ts,
src/moteurs/montage-image-video/sous-titres.ts, src/moteurs/montage-image-video/publication.ts,
src/briques/schema-motion/types.ts, studio-rendu/compositions/image-video/Entete.tsx,
studio-rendu/compositions/image-video/plan.ts, studio-rendu/compositions/image-video/mise-en-page.ts,
tests/image-video/variete/format-4x5.test.ts, docs/formats/image-video/variete/integration/f45/** .
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-f45.
RÈGLES : ne jamais fusionner ; aucun appel payant (tests : doubles de tests/image-video/doubles-fabrication.ts et
doubles-rendu.ts) ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ; import React en tête de chaque
.tsx ; ne pas toucher mise-en-scene.ts (le socle lit déjà le format), ni src/reseaux/index.ts, ni src/briques/fins/** ;
si le coût des contrôles augmente (une version Facebook 4:5 de plus), l'écrire clairement dans la PR.
ÉTAPES : 1) pnpm install ; npm --prefix studio-rendu ci. 2) Tests rouges d'abord (version LinkedIn hauteur 1920 ;
Facebook un seul fichier). 3) Code. 4) pnpm vitest run tests/image-video/variete tests/image-video/rendu-reel.test.ts
tests/image-video/moteur.test.ts tests/image-video/mise-en-page.test.ts tests/image-video/plafond-confirme.test.ts.
5) Images : images-fixes.mts --recette (référence) --format 4:5 sur la carte C, et --format 9:16 pour comparer ;
occupation.py sur le 4:5 (≥ 60 %, trou ≤ 15 %, équilibre ≥ 0,5) ; planche côte à côte vers
docs/formats/image-video/variete/integration/f45. 6) À la fin UNE fois : pnpm vitest run tests/image-video ;
pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers> ; pnpm vitest run tests/organisation/image-autonome.test.ts.
LIVRAISON : commit, push -u origin image-video/variete-f45, PR (vers master si le socle y est, sinon vers la branche du
socle) « Image → vidéo · variété : format 4:5 (LinkedIn, fil Facebook) et Facebook en deux fichiers », résultats exacts.
```

### 8.8 Consigne · Lot 8 TIR
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (§ 2 et « Lot 8 »),
72-AXES-DE-VARIETE.md § 5 et § 6.1, § 7 point 3.
MISSION : rendre le tirage du socle GARANTI : ouverture jamais la même que l'une des 3 dernières vidéos IV ; combinaison
ouverture + récit + caméra jamais la même que l'une des 10 dernières ; ressemblance de recette < 60 % avec chacune des
10 dernières (poids : ouverture 3, récit 2, caméra 2, apparition 2, chiffres 1,5, transitions 1,5, texte 1, fin 1,
matière 1, sous-titres 0,5 ; total 15,5) ; si rien ne passe, prendre la moins ressemblante (jamais de blocage).
Corriger aussi : les bruitages repartent toujours de la même variante → point de départ tiré de la graine (sans graine :
inchangé). Fonctions PURES : l'historique est une liste reçue en paramètre.
FICHIERS (exclusifs) : src/moteurs/montage-image-video/variete/historique.ts,
src/moteurs/montage-image-video/variete/ressemblance.ts, src/moteurs/montage-image-video/bruitages.ts,
tests/image-video/variete/historique.test.ts, tests/image-video/variete/bruitages-graine.test.ts.
BRANCHE : depuis origin/master s'il contient src/briques/schema-motion/variete.ts, sinon depuis
origin/image-video/variete-socle ; branche image-video/variete-tir.
RÈGLES : ne jamais fusionner ; aucun appel payant ; tests au premier plan, jamais en arrière-plan ; commandes < 10 min ;
aucun Math.random ni Date ; ne pas toucher tirage.ts (le socle appelle déjà accepteHistoriqueIV), ni src/donnees/bruitages.ts.
ÉTAPES : 1) pnpm install. 2) Tests rouges d'abord (historique de 3 vidéos en OUV-A → le socle tire encore OUV-A ;
exemples 19 % et 90 % du doc 72). 3) Code. 4) pnpm vitest run tests/image-video/variete tests/image-video/bruitages.test.ts.
5) À la fin UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers>.
LIVRAISON : commit, push -u origin image-video/variete-tir, PR (vers master si le socle y est, sinon vers la branche du
socle) « Image → vidéo · variété : deux vidéos ne se ressemblent pas (historique, ressemblance) », résultats exacts.
```

### 8.9 Consigne · Lot final F (assemblage + répétition générale)
```
Réponds en français. Dépôt will383842/studio-axion-ia. Lis AGENTS.md, docs/REGLES-ROUTINES.md,
(document interne non publié), docs/formats/image-video/variete/80-PLAN-INTEGRATION.md (en entier, surtout § 5),
73-ADAPTATION-PAR-RESEAU.md, 76-mesure-occupation.md.
PRÉALABLE : les PR du socle et des lots 1 à 8 sont fusionnées dans master (vérifie : src/moteurs/montage-image-video/
variete/axes/*.ts ne sont plus des bouchons, historique.ts existe). Si l'une manque, NE COMMENCE PAS : écris lesquelles
manquent dans une PR brouillon vide de code et arrête-toi.
MISSION : 1) Brancher la variété dans fabrication.ts : recette tirée après la validation de la carte et avant l'écriture
(graine = videoId, historique = recettes des 10 dernières vidéos IV prêtes), gardée dans l'état (reprise sans retirage),
récit donné à ecrireScriptIV, recettePourVersion par version, ouverture par réseau. 2) Afficher la recette à l'écran
« Votre script » (src/components/formats/image-video/vue.ts + un petit composant), modifiable avant la voix (le récit ne
change plus après le script). 3) RÉPÉTITION GÉNÉRALE : 3 vidéos de bout en bout SANS APPEL PAYANT
(scripts/image-video/variete/repetition-generale.mts) : cartes C, D, E des fixtures, fiches simulées, trois graines
enchaînées avec historique ; voix = public/demo/essai-voix.mp3 découpée par FFmpeg local, mots par pisteSimulee ;
bruitages = public/bruitages/*.wav ; rendu = vrai serveur studio-rendu lancé en local avec un faux seau HTTP comme
studio-rendu/scripts/essai-local.ts (STUDIO_RENDU_ESSAI=1), puis le vrai service src/services/image-video-rendu.ts.
FICHIERS : fabrication.ts, src/components/formats/image-video/** (vue + composant), scripts/image-video/variete/
repetition-generale.mts, tests/image-video/variete/assemblage.test.ts, docs/formats/image-video/variete/integration/repetition/** ;
et, seulement pour corriger un écart entre lots, les fichiers des lots (le dire fichier par fichier dans la PR).
BRANCHE : image-video/variete-assemblage depuis origin/master à jour.
RÈGLES : ne jamais fusionner ; aucun appel payant (aucune clé, aucun serveur distant, aucun R2) ; tests au premier plan,
jamais en arrière-plan ; chaque commande < 10 min (une commande de rendu par vidéo ; si c'est plus long, ne rendre que
TikTok 9:16 et LinkedIn 4:5 de chaque vidéo) ; import React en tête de chaque .tsx ; ne pas commiter les MP4.
CRITÈRE : assemblage.test.ts (5 réseaux → 6 fichiers dont Facebook ×2, une seule voix payée, recette identique après
reprise, deux vidéos à la suite < 60 % de ressemblance) ; FFprobe sur chaque MP4 (durée = ligne de temps ± 0,1 s,
1080 × 1920 ou 1080 × 1350, son présent, aucune image noire ou figée > 0,5 s hors fin) ; images extraites à 0,5 s,
1,5 s, 3 s puis toutes les 3 s, mesurées par docs/formats/image-video/variete/prototypes/occupation.py (seuils du doc 76,
fin et phrase-choc vérifiées à l'œil) ; planche des 3 tirages par prototypes/tirages.py dans
docs/formats/image-video/variete/integration/repetition/ ; resume.md avec recettes, empreintes des MP4, mesures.
À la fin UNE fois : pnpm vitest run tests/image-video ; pnpm next typegen && pnpm tsc --noEmit ; pnpm eslint <fichiers> ;
pnpm vitest run tests/organisation/image-autonome.test.ts ; pnpm build.
LIVRAISON : commit, push -u origin image-video/variete-assemblage, PR vers master « Image → vidéo · variété : assemblage
et répétition générale (3 vidéos sans appel payant) », corps = planche des 3 tirages, mesures, résultats exacts, écarts
corrigés et restants.
```
