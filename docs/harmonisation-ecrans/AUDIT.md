# Audit des écrans de création (18/10/2026, base `origin/master`)

Relevé en lecture seule, préalable au [PLAN.md](PLAN.md). Chemins sous `src/`, pages sous `app/(studio)/`.

## Socle commun visé (`components/ui/`)
- `EnTetePage({titre, sousTitre?, retour?, actions?, surTitre?, className?})` — `EnTetePage.tsx:8`.
- `BarreEtapes({etapes:{cle,libelle}[], courante, onAller?, className?})` — `BarreEtapes.tsx:15`.
- `BarreActionCollee({children, secondaire?, className?, auDessusDesOnglets=true})` — `BarreActionCollee.tsx:9` (collée au-dessus des onglets du bas sur mobile, cale `h-24 lg:hidden`, statique dès `lg`).
- Voisins : `EtatVide`, `ProgressionEtapes` (+ `BarreProgression`), `Squelette`, `hooks/useTravaux.ts` (sondage 2 s, 15 s au repos, `/api/travaux`).

Communs à tous : un seul `error.tsx` (groupe `(studio)`) ; `loading.tsx` seulement pour `nouvelle/`, `nouvelle/[format]/`, `cas-concret/`, `image-video/`, `videos/[id]/`. La coquille pose `marge-onglets-bas` (`coquille/Coquille.tsx:41`).

## Écran par écran

| Écran | En-tête | Étapes | Action principale | Suivi de fabrication | Récents | Vide / chargement |
|---|---|---|---|---|---|---|
| **Face caméra** `/nouvelle/facecam` (`nouvelle/[format]/page.tsx` → `DejaFilme` puis `assistant/Assistant.tsx`, étapes `express`+`fabrication`) | **maison** `EnTeteAssistant` (`Assistant.tsx:205,212,247`) + `<h1>` « Votre vidéo » (`etapes/Express.tsx:380`) | **aucune** (branche express sort avant, `Assistant.tsx:202-209`) | `BarreActionCollee` ✅ (`Express.tsx:451`) | `etapes/Fabrication.tsx` plein écran, `useTravaux` + `ProgressionEtapes`, **barre maison `fixed bottom-0` z-45** (l.133) qui masque les onglets ; puis `AttenteFacecam` sur `/videos/[id]` | **aucune** | `loading.tsx` ✅ |
| **Avocat** `/nouvelle/avocat` | idem face caméra | idem | ✅ | idem, puis `SuiviTravail` sur `/videos/[id]` | aucune | ✅ |
| **Face caméra animée** `/face-camera-animee` (`DepotPrise`, `EstimationCout`, `FeuilleScriptsValides`) | `EnTetePage` ✅ (l.24) | **aucune** | **en ligne** « Animer » (`DepotPrise.tsx:235`) | aucun sur l'écran ; renvoi `/videos/[id]` ou `/formats/facecam-animee` (`DepotPrise.tsx:121`) | **liste en ligne** (page l.26-43, `Carte` + `phrasePaye`), `dernieresFacecamAnimee(6)` | **pas d'`EtatVide`**, **pas de `loading.tsx`** |
| **Tableau animé** `/tableau/nouvelle` (`NouvelleVideoTableau`, `RelireScript`) + `/tableau/traces/[id]` | `EnTetePage` ✅ (l.22 ; traces l.23) | aucune à la création (`EtapesTableau` = suivi) | via `RelireScript.tsx:348` seulement | `SuiviTacheTableau` (server action toutes les 3 s + `router.refresh`) ; fabrication `SuiviTableau` (`useTravaux` → `EtapesTableau`) sur `/videos/[id]` | `BrouillonsRecentsTableau({recents, courant?})` ✅ (meilleur candidat générique) | `EtatVide` ✅ ; **pas de `loading.tsx`** ; traces affichent un coût en `$` (l.25) |
| **Cas concret** `/cas-concret` (`entree/EntreeCasConcret`, `FeuilleVotreVideo`, `RelireAvantLancement`) | `EnTetePage` ✅ (l.40) | aucune | **en ligne** `BoutonFabriquer` (`FeuilleVotreVideo.tsx:176`, dans une feuille) | sur `/videos/[id]` : `SuiviCasConcret` (`useTravaux` + relectures 0/1,5/4/8/15 s, relance POST) | aucune (catalogue de cas) | `EtatVide` ✅, `loading.tsx` ✅ |
| **Image → vidéo** `/image-video` (`Depot`) | `EnTetePage` ✅ (l.25) | `EtapesImageVideo` ✅ (enveloppe `BarreEtapes`) | **en ligne** `BoutonFabriquer` (`Depot.tsx:179`) | — | **liste en ligne** lots + vidéos (`page.tsx:28-51`), `dernieresLotsImageVideo(3)`, `dernieresImageVideo(6)` | `loading.tsx` ✅, pas d'`EtatVide` (rien si vide) |
| **Image → vidéo** `/image-video/[videoId]` (`CarteComprise`, `ScriptEcrans`/`ScriptRelireIV`, `Fabrication`, `VosVideos`) | `EnTetePage` ✅ (l.28, retour lot ou dépôt) | `EtapesImageVideo` ✅ | selon l'écran (relecture : `RelireScript`) | `image-video/Fabrication` : `setInterval` 4 s sur `GET /api/image-video/[videoId]`, `router.refresh` si signature change | `VosVideos` (sorties, pas des récents) | `EtatVide` « introuvable » ✅ ; **pas de `loading.tsx`** |
| **Image → vidéo, lot** `/image-video/lot/[lotId]` (`DepotLot`, `SuiviLot`) | `EnTetePage` ✅ (l.21) | `EtapesLot({courante})` ✅ | `BarreActionCollee` ✅ (`SuiviLot.tsx:152-170`) | `SuiviLot` : 4 s sur `/api/image-video-lot/[lotId]` | — | `EtatVide` ✅ ; **pas de `loading.tsx`** |
| **Essai** `/essais/relire-script` | `EnTetePage` ✅ | — | via `RelireScript` | — | — | rien |
| **Bientôt** : podcast (`formats/podcast/index.ts:19`), createur-b, écran partagé, motion, ugc/avis client (`formats/autres.ts:21,67,130,175`) | carte grisée `CarteFormat compacte` (`opacity-70`, `aria-disabled`, pastille « Bientôt », `nouvelle/page.tsx:82-93`) ; `/nouvelle/<id>` → `/formats/<id>` | — | `BoutonMePrevenir` dans `BarreActionCollee` (`formats/[id]/page.tsx:231`) | — | — | `EtatVide` « Ce format arrive bientôt » (l.201) ; **titre « Mes vidéos » même pour un format Bientôt** (l.65) |
| **Masqués** : selfie (`autres.ts:221`), image-video (`formats/image-video/index.ts:48`, mais page atteignable par adresse) | exclus de `listerFormats` (`formats/index.ts:53`) | — | — | — | — | — |

## Écarts relevés
1. Face caméra / avocat : en-tête maison au lieu d'`EnTetePage`, aucune `BarreEtapes` en express.
2. Fabrication de l'assistant : barre maison `fixed bottom-0` au lieu de `BarreActionCollee`.
3. Action principale en ligne (non collée sur mobile) : face caméra animée, dépôt image → vidéo, cas concret.
4. Pas de `BarreEtapes` : face caméra animée, tableau animé (création), cas concret ; deux enveloppes différentes en image → vidéo.
5. Récents : 3 façons (liste en ligne FCA, liste en ligne IV, `BrouillonsRecentsTableau`) ; rien pour l'assistant ni le cas concret.
6. Sondage de l'état : 4 mécaniques (2 s `useTravaux`, 3 s server action, 4 s routes API dédiées, relectures programmées).
7. `loading.tsx` manquants : `face-camera-animee`, `tableau/*`, `image-video/[videoId]`, `image-video/lot/[lotId]`, `essais/*`.
8. États vides absents : FCA, dépôt IV (liste vide = rien).
9. `/formats/[id]` titre « Mes vidéos » pour un format Bientôt ; traces du tableau en `$`.

## Contrôles existants
- `docs/controles/GARDE-ECRAN.md` → `tests/garde-ecran.test.ts` : rien de technique à l'écran (variables d'env., codes, HTTP, `${e.message}`, identifiants interpolés, « Simulation », anglais technique) ; `tests/garde-regle-unique.test.ts` : une constante = un seul fichier.
- `docs/controles/AUDIT-C-ECRAN.md` → `tests/c-ecran-journal.test.ts` : seuls `ErreurStudio`/`ErreurLisible` s'affichent.
- **Aucun test de gabarit** (présence d'`EnTetePage`/`BarreEtapes`/`BarreActionCollee`). Voisins qui lisent le source : `tests/final-b-mobile.test.ts:30`, `tests/e2e1-console-ecrans.test.ts:255`.

## Spécificités à garder (non négociables)
- **Face caméra** : « J'ai déjà filmé » → `/envoyer/<varianteId>` (`DejaFilme`) ; **sans prix** (`sansPrix`, `Express.tsx:311`) ; « Prête vers… » ; notification téléphone une seule fois.
- **Avocat** : voix et avatar du format (`distributionParDefaut`).
- **Face caméra animée** : réservée à Will + case « J'accepte l'essai réel » ; plusieurs prises ; texte dit facultatif ; « Reprendre un script validé » (`DepotPrise.tsx:205`, `FeuilleScriptsValides`) ; phrase « payé » par carte.
- **Tableau animé** : écriture/découpage en tâches de fond ; prix confirmé avant relance ; repère « script relu » ; « Corriger la fiche »/« Relancer » avec fichiers partiels.
- **Cas concret** : cas validés / à valider (essai) ; refus annoncé avant le prix ; relecture avant lancement ; catalogue au lieu de récents.
- **Image → vidéo** : prix selon le nombre de réseaux ; plafond relevable ; lot avec vidéos « mises de côté » ; « Lien privé » dans Vos vidéos ; relecture derrière le réglage `imageVideo.relireScript` (éteint).
- **Bientôt / masqués** : grisés et non cliquables (décision du 17/10) ; masqués invisibles.
