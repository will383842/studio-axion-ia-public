# Branchements — contrat d'exécution des lots A et B

> Écrit par l'architecte le 2026-10-02, après la **centralisation de la composition** (brique commune `composition`, `docs/ARCHITECTURE.md` §14).
> Mission de Will (02/10) : « lance la centralisation de la composition, puis M0b, M5, les prononciations, les décors réalistes et la veille des outils en autopilote ».
> **Ce document PRIME pour la répartition des fichiers.** Les consignes priment pour le fond : `PLAN-MOTEUR-AVOCAT.md` (B.4, B.6, lots M0b et M5), `PRONONCIATIONS-SYSTEME.md`, `MES-IMAGES-ORGANISATION.md`, `decors/CATALOGUE-DECORS.md`, `VEILLE-DES-OUTILS.md` (tous dans `Axion-IA/<dossier-de-plan-prive>/`).

Ordre : **lot A** = A1 ∥ A2 (en parallèle, fichiers DISJOINTS) → **lot B** = B1 ∥ B2 (en parallèle, fichiers DISJOINTS). Le lot B part du commit du lot A fusionné.

| Lot | Développeur | Contenu |
|---|---|---|
| A1 | dév. « voix » | **M0b** (voix HeyGen réelle, relier la voix de Will, écoute) + **prononciations** (système complet, 10 fonctions) |
| A2 | dév. « images » | **M5** (illustrations réelles : cascade vos images → déjà payées → Pexels / Pixabay → fabrication fal.ai, licences, anti-répétition) + **Mes images** (import, classement, confidentialité, validation en série) |
| B1 | dév. « décors » | **décors réalistes** (catalogue R1-R8, « un décor en une phrase » → 3 propositions montrées SUR Will, Looks HeyGen écrits et éteints, repli photo floutée, vignettes sur le double) |
| B2 | dév. « veille » | **veille des outils** (page « Veille », cartes par outil, alertes, résumé hebdomadaire, surveillance de la licence Remotion) |

---

## 0. Règles communes (toutes reprises de `MOTEUR-AVOCAT-EXECUTION.md` §0, plus celles-ci)

1. **Clés réelles** : `<fichier de secrets local>` (`HEYGEN_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `FAL_KEY`). Ne jamais les afficher, ni les écrire dans un fichier du dépôt, ni les commiter : elles se chargent dans l'environnement du processus d'essai seulement. **Pas de clé Anthropic** : tout ce qui demande Claude (classement d'images, requêtes, résumés de la veille, détection fine des mots à risque) reste **simulé derrière son fournisseur** (règles déterministes), et branché plus tard sans changer d'interface.
2. **Appels réels : seulement pour prouver le lot, au minimum, plafonds stricts** (total de la mission : HeyGen ≤ 1 $, fal.ai ≤ 1 $) :

   | Lot | Autorisé | Interdit |
   |---|---|---|
   | A1 | HeyGen : `GET /v3/voices?type=private` (gratuit) et `POST /v3/voices/speech` sur 3 à 5 phrases courtes, **≤ 1 $** | toute vidéo d'avatar, toute création de look ou de double |
   | A2 | Pexels, Pixabay (gratuits) ; fal.ai : 1 image + 1 clip de 5 s au plus, **≤ 0,60 $** | générer une personne, un logo, un uniforme |
   | B1 | fal.ai : 3 photos de décor SANS personne, **≤ 0,40 $** ; HeyGen en LECTURE seule (`GET`) | `POST /v3/avatars`, `POST /v3/avatars/looks`, toute vidéo d'avatar (les Looks restent écrits et éteints) |
   | B2 | sources publiques (registre npm, GitHub, pages de nouveautés, catalogue fal.ai) | rien de payant |

   Chaque appel payant est noté dans le rapport du lot (point d'accès, coût relevé). La simulation reste le défaut ; **tous les tests passent sans aucune clé**.
3. **Rien n'est jamais effacé** (on range, on archive, on versionne). **Français, vouvoiement**, très peu de texte, aucun mot interdit (job, render, prompt, token, API, upload, pipeline, workflow, mock, fictif, dashboard, avatar). **Mobile d'abord** (390 px), jetons de couleur, composants `@/components/ui`. Captures à 390 px de chaque écran livré (`scripts/captures.mjs`, `E2E_MDP='…'` en ligne de commande seulement).
4. **Fin de lot** : `pnpm exec tsc --noEmit` = 0, `(cd studio-rendu && npx tsc -p tsconfig.json --noEmit)` = 0 si touché, `pnpm exec eslint .` = 0 erreur 0 avertissement, `pnpm exec vitest run` vert, `pnpm build` vert ; commit en français (dernière ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) puis `git push`. **Aucun déploiement** : la session principale déploie.
5. On n'arrête que ses propres processus, par PID. On ne touche pas au serveur de production.
6. **Un fichier = un propriétaire par lot.** Besoin d'un fichier d'un autre développeur du même lot : on ne le modifie pas, on crée un fichier à soi ou on écrit la demande dans le rapport. Les fichiers marqués « figé » ci-dessous ne changent que par **ajout pur facultatif en fin d'interface**, signalé dans le rapport.
7. Tests de chaque lot dans des fichiers à son nom : `tests/a1-*.test.ts`, `tests/a2-*.test.ts`, `tests/b1-*.test.ts`, `tests/b2-*.test.ts` (ou à côté du code, dans ses dossiers).

---

## 1. Interfaces figées par l'architecte le 02/10 (déjà dans le code)

| Fichier | Ce qui est posé (ne pas renommer, ne pas changer de forme) | Pour |
|---|---|---|
| `src/briques/composition/**` | brique commune : `RecetteComposition`, `parametresComposition(c, e, recette)`, `OutilsMontage.recette`, scène (`ProprietesImageComposition.reductionLarge`, `transformation(…, reduction?)`), `ParametresDemandeComposition` | tous ; **B1 seul** peut la modifier au lot B |
| `src/domaine/types.ts` | `Prononciation.ecriture/portee/source/ecouteeLe/utilisations`, `SourcePrononciation` | A1 |
| | `ElementBibliotheque.origine/categorieImage/description/motsClesEn/cadrageVertical/confidentialite/qualiteImage/empreinte/importeDepuis/valideLe`, `OrigineIllustration`, `CategorieMesImages` (bureau · consoles · interventions · evenements · clients · objets · marque), `ZoneSensible`, `ConfidentialiteImage` | A2 |
| | `ValeurDecor.vignetteDoubleFichierId/demande` | B1 |
| | `VeilleOutil`, `VeilleNouveaute`, `SourceVeille`, `EtatVeille`, `StatutNouveaute`, `TypeNotification` + `veille` | B2 |
| `src/domaine/depots.ts`, `donnees/memoire/index.ts`, `donnees/postgres/index.ts` | collections `veilleOutils`, `veilleNouveautes` (mémoire et Postgres) | B2 |
| `src/domaine/prononciations.ts` | `prononciationsActives(liste, { voixId, personnageId })` → `{ mot, prononciation }[]` : **le seul point** où la Bibliothèque devient la liste d'une voix ou d'une commande (appelé par `services/fabrication.ts` et `services/personnages.ts`) | A1 (propriétaire, le remplit) |
| `src/services/prononciations.ts` | service des prononciations, sorti de `bibliotheque.ts` (qui le ré-exporte) | A1 (propriétaire) |
| `src/fournisseurs/types.ts` | `FournisseurIllustration.analyserImage?` + `AnalyseImage` ; `FournisseurScript.resumerNouveaute?` ; `OperationRendu` + `traitement-image` (aussi dans `studio-rendu/src/contrat.ts`) | A2, B2 |
| `src/fournisseurs/index.ts` | crochets d'inscription : `voixHeygen()`, `visagesHeygen()` (`fournisseurs/heygen/inscription.ts`), `illustrationsReelles()` (`fournisseurs/illustration/inscription.ts`) ; le registre ne se touche plus | A1, B1, A2 |
| `src/services/migrations.ts` | étapes **12 à 15** réservées, une par fichier : `services/migrations/etape-12-prononciations.ts` (A1), `etape-13-mes-images.ts` (A2), `etape-14-decors-realistes.ts` (B1), `etape-15-veille.ts` (B2) ; résumé rangé dans `rapport.lots[nom]` | A1, A2, B1, B2 |
| `deploiement/docker-compose.yml`, `deploiement/env.exemple` | toutes les variables des lots A et B : `FOURNISSEUR_ILLUSTRATION`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `FAL_KEY`, `FOURNISSEUR_VISAGE`, `STUDIO_VEILLE`, `GITHUB_TOKEN_VEILLE`, `ANTHROPIC_API_KEY`, `FOURNISSEUR_SCRIPT` (et déjà `HEYGEN_API_KEY`, `FOURNISSEUR_VOIX`) | personne n'y touche |
| `src/components/notifications/ClocheNotifications.tsx` | style de la notification `veille` | — |

Restent figés (contrat M0, `MOTEUR-AVOCAT-EXECUTION.md` §1) : `CommandeFabrication` v2, `DemandeLecture` / `ResultatLecture`, `VoixExistante`, `FournisseurVoix.lire/listerVoixExistantes`, `FournisseurIllustration.chercher/generer/animer/choisir`, `ResultatBanque`, `FournisseurVisage.creerLook`, `ElementBibliotheque.utilisations/derniereVideoId/dernierRangVideo/fabrique`, `ResultatFabrication.elementsCrees`. **`next.config.ts` (CSP) n'est touché par personne** : aucun domaine tiers n'y entre ; tout média tiers est recopié dans R2 ou relayé par une route du studio.

---

## 2. Lot A — A1 ∥ A2, fichiers DISJOINTS

### 2.1 Propriété des fichiers

| | **A1 — M0b + prononciations** | **A2 — M5 + Mes images** |
|---|---|---|
| Fournisseurs | `src/fournisseurs/heygen/**` (client HTTP HeyGen commun, `voix.ts`, `inscription.ts` → `voixHeygen()`) | `src/fournisseurs/illustration/**` (`pexels.ts`, `pixabay.ts`, `fal.ts`, `reel.ts`, `inscription.ts` → `illustrationsReelles()`), `src/fournisseurs/simulation/autres.ts` (simulation de `analyserImage`), `src/fournisseurs/rendu/**` si besoin |
| Domaine (pur) | `src/domaine/prononciations.ts` (portée, variantes, écriture, détection des mots à risque, lecture d'une liste collée) | `src/domaine/illustrations.ts` (nouveau : score de correspondance, anti-répétition à 10 vidéos, cascade) , `src/domaine/mes-images.ts` (nouveau : catégories, état « prête ») |
| Services | `src/services/prononciations.ts`, `src/services/personnages.ts`, `src/services/migrations/etape-12-prononciations.ts` | `src/services/fabrication.ts`, `src/services/bibliotheque.ts`, `src/services/illustrations.ts` (nouveau), `src/services/mes-images.ts` (nouveau), `src/services/travaux.ts` (si `elementsCrees` l'exige), `src/services/migrations/etape-13-mes-images.ts` |
| Moteur avocat | `src/moteurs/montage-avocat/report.ts` (variantes et façon d'écrire dans la substitution) + `report.test.ts` | `src/moteurs/montage-avocat/index.ts` (génération payante au moteur → `elementsCrees`) |
| Écrans | `src/components/personnages/OngletVoix.tsx`, `src/components/bibliotheque/EcranPrononciations.tsx`, `src/components/prononciations/**` (nouveau : feuille d'ajout avec ▶ avant / après, pastilles « Comment dire … ? », « Mal prononcé ? », collage en lot ; ses actions serveur dans `components/prononciations/actions.ts`), `src/assistant/etapes/Script.tsx`, `src/components/videos/fiche/OngletSousTitres.tsx`, `src/app/(studio)/personnages/**`, `src/app/(studio)/videos/[id]/**` | `src/assistant/etapes/Apercu.tsx`, `src/app/(studio)/nouvelle/[format]/actions.ts`, `src/app/(studio)/bibliotheque/**` (`page.tsx`, `[type]/page.tsx`, `actions.ts`), `src/components/bibliotheque/**` **sauf** `EcranPrononciations.tsx`, `src/domaine/libelles.ts`, `src/components/coquille/navigation.ts` |
| Routes | `src/app/api/voix/ecoute/route.ts` (relais du MP3 HeyGen, `exigerSession`) | `src/app/api/mes-images/**` si un dépôt de dossier l'exige |
| `studio-rendu` | — | `studio-rendu/src/operations/traitement-image.ts` (floutage des zones sur une COPIE, empreinte, vignette 9:16), `studio-rendu/src/index.ts` |
| Tests | `tests/a1-*.test.ts` | `tests/a2-*.test.ts` |

Personne au lot A ne touche : `src/briques/**`, `src/formats/**`, `src/domaine/types.ts` (figé : ajouts purs signalés seulement), `src/fournisseurs/index.ts`, `src/fournisseurs/types.ts`, `src/services/migrations.ts`, `deploiement/**`, `next.config.ts`, `studio-rendu/compositions/**`.

### 2.2 A1 — M0b (voix HeyGen) + prononciations

**M0b** (B.4, B.0 §17, annexe A du contrat M4) :
- `fournisseurs/heygen/voix.ts` : `listerVoixExistantes` (`GET /v3/voices?type=private`, paginé `limit` ≤ 100 + `token`, type de clone déduit de `available_engines`, `audioSeul` vérifié) ; `lire` (`POST /v3/voices/speech`, tout le texte en UN appel ≤ 5 000 caractères, `locale: 'fr-FR'`, `speed` 1,0 puis réglé dans les limites B.4 v3.2 : pas de 0,05, plafond 1,15 ; **aucune balise `<break>`**), `word_timestamps` → `mots`, MP3 recopié aussitôt dans R2 (`StockageFichiers`), coût relevé ; **reçoit un texte DÉJÀ substitué et `prononciations: []`** (contrat M1 : la voix ne substitue pas une seconde fois). Erreurs typées `ErreurFournisseur` (`quota` si crédits API épuisés, `refuse`, `indisponible`).
- `inscription.ts` → `{ heygen: … }` si `HEYGEN_API_KEY` ; activation `FOURNISSEUR_VOIX=heygen` (ou réglage `fournisseur.voix`).
- `services/personnages.ts` : `relierVoixExistante(personnageId, idExterne)` → `Voix` prête (`minutesEnregistrees: 0`) + `RessourceFournisseur { fournisseur: 'heygen', idExterne: voice_id, versionModele: 'instant' }` ; accord exigé (`ACCORD_MANQUANT`).
- `OngletVoix.tsx` : « Relier ma voix HeyGen » → liste, ▶ écoute (par `/api/voix/ecoute`, jamais le domaine HeyGen dans la page), choix ; `MINUTES_CONSEILLEES = 30` pour le seul secours ElevenLabs ; curseurs masqués selon le fournisseur (HeyGen : vitesse seule).
- **Test d'écoute** (3 phrases difficiles : « Un bon PV, puis un pépin », un montant, un nom propre) : fichiers produits et écoutables dans la console ; le `Parametre` `voix.choixWill` = « je garde » est déjà acquis (Will, 02/10 : « elle me convient ») — le poser par la migration 12 s'il manque, sans écraser.
- Contrôle de l'horodatage HeyGen sur sa voix (`outils/alignement/`, écart moyen) consigné dans le rapport ; débit mesuré (mots/s et syllabes/s) et respirations présentes ou non.

**Prononciations** (`PRONONCIATIONS-SYSTEME.md`, 10 fonctions) :
1. ▶ avant / après dans la feuille d'ajout (phrase type « Chez **mot**, nous… » lue par la voix par défaut ; coût affiché ; simulation sans clé).
2. Détection dans le script (`domaine/prononciations.ts`, pur) : sigles en majuscules, noms propres inconnus, anglicismes (liste), chiffres avec unités, mots hors dictionnaire (liste locale) ; pastilles « Comment dire *Teleos* ? » à l'étape Script (`Script.tsx`, donc aussi dans « Votre vidéo ») ; un mot déjà connu n'est plus proposé.
3. « Mal prononcé ? » sur un mot des sous-titres de la fiche vidéo → ajout en un geste + proposition de refaire la phrase seule (`lancerRetouche` existant).
4. Collage en lot `mot = prononciation`, aperçu, doublons signalés.
5. Recherche, tri (date / alphabétique), « utilisé dans N vidéos » (`utilisations`).
6. Variantes automatiques (casse, pluriel simple, avec ou sans tiret / espace) **dans `prononciationsActives` et `report.ts`** (le report des horodatages garde la correspondance).
7. Dire (`prononciation`) ≠ écrire (`ecriture`, sous-titres) : `prononciationsActives` renvoie `ecriture` (champ facultatif déjà posé dans `CommandeFabrication.prononciations`) ; les sous-titres affichent `ecriture ?? mot`. La brique sous-titres impose déjà la graphie de `mot` : A1 lui passe la bonne graphie depuis la liste, sans modifier `briques/`.
8. Portée : toutes les voix par défaut, ou une voix / un personnage (`portee`), appliquée par `prononciationsActives`.
9. Contrôle sur la fiche vidéo : « Prononciation ajoutée depuis : refaire la phrase ? » quand une vidéo fabriquée AVANT l'ajout contient le mot (comparaison à `commande.prononciations` de sa version).
10. Liste de départ (Axion-IA, IA, PV, RGPD, TVA, PME, TPE, CRM, API, SEO, Excel, Telegram, ChatGPT, Claude, HeyGen), `source: 'depart'`, à valider à l'écoute (`ecouteeLe`) : migration étape 12, jamais réécrite.

**Critères de fin A1**
- [ ] Voix de Will listée et reliée par l'écran (essai réel, ≤ 1 $), 3 phrases d'écoute produites, horodatage contrôlé, coût relevé dans le rapport ; aucune vidéo d'avatar, aucun look.
- [ ] Sans clé : tout fonctionne en simulation (tests verts sans `HEYGEN_API_KEY`).
- [ ] Les 10 fonctions des prononciations, une règle = un test (`domaine/prononciations.ts`, report avec variantes et écriture, migration 12 idempotente).
- [ ] Captures 390 px : Voix (relier, écouter), Prononciations (liste, ajout avec ▶, collage), pastilles à l'étape Script, « Mal prononcé ? ».

### 2.3 A2 — M5 (illustrations réelles) + Mes images

**M5** (B.6) — cascade à l'Aperçu (service), génération au moteur :
- 0. **Mes images d'abord** : éléments `illustration-*` `origine: 'personnelle'` **prêts** (`confidentialite.statut === 'prete'`), score sur `motsCles` + `description` + mot ancre (`Plan.motAncre`) ; pastille « Mes images » à l'Aperçu.
- 0 bis. **Réutilisation avant toute dépense** : tous les `illustration-*` (y compris `fabrique` et banques déjà téléchargées) au-dessus du seuil ; anti-répétition à 10 vidéos (`utilisations`, `derniereVideoId`, `dernierRangVideo`, mis à jour à la fabrication) ; l'Aperçu distingue « réutilisé (0 €) » et « à fabriquer ».
- 1. **Banques gratuites** (Pexels, Pixabay) : vidéos VERTICALES seulement (jamais un 16:9 recadré), durée suffisante, sans texte ni logo, licence `{ source, usageCommercial: true }` ; chaque résultat copié dans R2 et enregistré en élément `illustration-video` (`origine: 'banque'`) que Will verrouille avant de payer.
- 2. **Fabrication payante au moteur** (`moteurs/montage-avocat/index.ts`) : image (Nano Banana ou Flux) puis clip de 5 s (Kling ou Seedance) via fal.ai, **jamais de personne, de logo ni d'uniforme**, jamais de zoom lent sur image fixe ; `elementsCrees` (`fabrique: true`, `origine: 'fabriquee'`, licence, pastille « IA » dans la console) ; coût réel relevé. Mode « économique » : banques seulement.
- Requêtes : simulées (mots-clés FR → EN par table locale, objet / action concrets autour du mot ancre) tant qu'il n'y a pas de clé Claude ; le refus des images génériques est simulé par règles.

**Mes images** (`MES-IMAGES-ORGANISATION.md`) :
- Dépôt en vrac (fichiers, sélection multiple, dossier) par l'envoi multipart existant (`ZoneDepot` + `envoi`) ; empreinte → doublons jamais réimportés (rien n'est supprimé).
- Classement à l'import par `FournisseurIllustration.analyserImage` (simulé : catégorie, mots-clés FR / EN, description, cadrage vertical, zones sensibles, visage d'un tiers, qualité) ; opération `traitement-image` de `studio-rendu` : floutage des zones validées sur une **copie** (`confidentialite.fichierFlouteId`), vignette, empreinte.
- Écran « Mes images » (Bibliothèque) : grille par catégorie, recherche, filtre par mot-clé, « utilisée dans N vidéos », pastilles à vérifier (orange) / prête (vert) / floutée / vidéo ; **validation en série** (un geste par image : OK, ou corriger catégorie et mots-clés) ; licence « Propriété Axion-IA » ; « accord client » pour Clients ; visage d'un tiers → « accord nécessaire » (case) ; archivage, jamais de suppression.
- Seules les images **prêtes** entrent dans la cascade ; même LUT et même grain que les autres illustrations (déjà le cas : la brique `composition` les traite comme toute illustration).
- Import d'un dossier Google Drive : **hors lot** (option notée dans le rapport, aucune écriture sur le Drive).

**Critères de fin A2**
- [ ] Une vidéo de démonstration dont l'Aperçu montre la cascade complète : une image de « Mes images », une illustration réutilisée (0 €), une vidéo Pexels ou Pixabay réelle (verticale, licence), et une image + un clip fal.ai réels (≤ 0,60 $, aucune personne) ; coût affiché = coût relevé.
- [ ] Sans clé : tout en simulation, tests verts.
- [ ] Anti-répétition, score, cascade, licences, doublons, états de confidentialité : une règle = un test.
- [ ] Captures 390 px : Mes images (grille, validation en série, zones floutées), Aperçu avec les pastilles d'origine et le coût « réutilisé / à fabriquer ».

---

## 3. Lot B — B1 ∥ B2, fichiers DISJOINTS (après le lot A fusionné)

### 3.1 Propriété des fichiers

| | **B1 — décors réalistes** | **B2 — veille des outils** |
|---|---|---|
| Fournisseurs | `src/fournisseurs/heygen/**` (`looks.ts`, `visage.ts`, `inscription.ts` → `visagesHeygen()` ; le client HTTP d'A1 est réutilisé, pas recopié), `src/fournisseurs/illustration/fal.ts` (une fonction « photo de décor sans personne », si absente), `src/fournisseurs/simulation/autres.ts` | `src/fournisseurs/simulation/script.ts` (simulation de `resumerNouveaute`) |
| Domaine / données | `src/domaine/decors.ts`, `src/donnees/decors-catalogue.ts` | `src/veille/**` (nouveau : une source par fichier — `npm.ts`, `github.ts`, `page.ts`, `fal.ts`, `anthropic.ts` — comparaison, empreintes, `versions-utilisees.ts`), `src/domaine/libelles.ts` |
| Services | `src/services/decors.ts` (nouveau : « un décor en une phrase » → 3 propositions, vignettes sur le double, validation), `src/services/personnages.ts` (Looks = visages `origine: 'genere'`), `src/services/fabrication.ts` (choix du décor dans la commande, si besoin), `src/services/migrations/etape-14-decors-realistes.ts` | `src/services/veille.ts` (nouveau : lecture quotidienne, nouveautés, « Essayer » / « Ignorer », résumé hebdomadaire), `src/services/notifications.ts`, `src/services/reglages.ts`, `src/services/migrations/etape-15-veille.ts`, `src/instrumentation.ts` (lancement de la tâche quotidienne, `STUDIO_VEILLE=0` la coupe) |
| Brique commune | **`src/briques/composition/**`** (un Look réel = décor DANS la vidéo du double : pas de décor ni de liseré posés ; photo floutée en repli) et `studio-rendu/**` (vignette d'un décor sur le double par l'opération `image-fixe` + `CompositionImage`) | — |
| Écrans | `src/components/bibliotheque/EcranDecors.tsx` (nouveau, « Mes décors »), `src/components/decors/**` (nouveau), `src/app/(studio)/bibliotheque/[type]/page.tsx` (aiguillage du type `decor` seulement), `src/components/personnages/OngletVisages.tsx` | `src/app/(studio)/veille/**` (nouveau : page, `_composants/`, `actions.ts`), `src/components/coquille/navigation.ts` (tuile « Veille » du menu Plus, pastille), `src/app/(studio)/reglages/**` (Réglages > Outils) |
| Tests | `tests/b1-*.test.ts` | `tests/b2-*.test.ts` |

Personne au lot B ne touche : `src/domaine/types.ts` (figé), `src/fournisseurs/index.ts`, `src/fournisseurs/types.ts`, `src/services/migrations.ts`, `deploiement/**`, `next.config.ts`. B2 ne touche ni `briques/`, ni `studio-rendu/` ; B1 ne touche ni `veille/`, ni la navigation, ni les réglages.

### 3.2 B1 — décors réalistes (`decors/CATALOGUE-DECORS.md`, B.3)

- Méthode hybride déjà dans la brique (`decorScene`) : fonds neutres posés par le studio ; **Look HeyGen** = Will généré dans la pièce (le décor est dans la vidéo du double) ; repli **photo réelle floutée** (Bibliothèque de Will ou image générée sans personne).
- **Looks HeyGen écrits et ÉTEINTS** : `creerLook` (`POST /v3/avatars` type `prompt` ou `POST /v3/avatars/looks`, toujours à partir du même look de base), suivi par interrogation (`GET /v3/avatars/looks/{id}`), `Visage.origine: 'genere'`, statut `a_verifier` ; inscrits par `visagesHeygen()` seulement si `HEYGEN_API_KEY` ET `FOURNISSEUR_VISAGE=heygen` ; **aucune création au cours du lot** (accord de Will requis, et D4 vérifie Avatar V + fond pour ce type de look). Tests sur réponses enregistrées, sans réseau.
- **« Un décor en une phrase »** → 3 propositions montrées **sur Will** (vignette = image détourée de son double posée sur le décor par la brique `composition`, gratuite) ; Will en garde une (`ValeurDecor.demande.retenu`) ; les autres sont rangées, jamais supprimées. Tant que les Looks sont éteints, les propositions sont des photos de décor générées SANS personne (fal.ai, ≤ 0,40 $ pour les 3) posées en `photo-incrustee`.
- Catalogue R1-R8 complété (description, vignette sur le double), **3 à 5 décors récurrents** mis en avant ; N2, N4, N6 restent en réserve ; N1 reste le défaut avocat.
- Brique `composition` : quand le décor est un Look réel (`lookIdParAngle` et piste du double issue de ce look), ni décor ni liseré ne sont posés ; sinon repli et alerte (déjà en place). **La démonstration M4b doit rester identique** (refaire `outils/demo-m4/rendre-demo.mts` et comparer les empreintes comme dans `docs/captures/m4-demo/centralisation-preuve.json`).

**Critères de fin B1**
- [ ] Écran « Mes décors » : catalogue, mis en avant / réserve, « Demander un décor » → 3 propositions sur le double (essai réel fal.ai ≤ 0,40 $, aucune personne générée), choix, archivage.
- [ ] Looks HeyGen : code complet, éteint, testé sans réseau ; aucune création de look ni de double, aucune vidéo d'avatar.
- [ ] Démonstration M4b inchangée (empreintes identiques) ; nouvelle démonstration avec un décor photo-incrusté.
- [ ] Captures 390 px de « Mes décors » et d'une vignette sur le double.

### 3.3 B2 — veille des outils (`VEILLE-DES-OUTILS.md`)

- Collections `veilleOutils` / `veilleNouveautes` (figées). Outils de départ (migration 15) : HeyGen (developers.heygen.com/changelog), ElevenLabs (changelog), **Remotion** (npm `remotion` + versions GitHub + **`LICENSE.md` surveillé : un changement = alerte rouge**), modèles d'illustration (catalogue fal.ai), Claude (liste des modèles Anthropic — carte grise « impossible de vérifier » tant qu'aucune clé), WhisperX, FFmpeg (versions GitHub), réseaux sociaux (pages d'aide listées dans `src/reseaux`). Will peut ajouter un outil (nom + adresse).
- **Version utilisée lue dans le code** : `src/veille/versions-utilisees.ts` GÉNÉRÉ depuis `studio-rendu/package.json` (l'image du studio ne contient pas `studio-rendu/`) + un test qui échoue si les deux divergent ; versions d'API et modèles depuis les réglages des fournisseurs.
- Tâche **une fois par jour** dans le processus du studio (comme la boucle de fond : une seule fois par processus, jamais deux lectures en même temps), coupée par `STUDIO_VEILLE=0` ; délai maximal par source ; une source muette = carte grise, **jamais une fausse alerte « à jour »**.
- Résumé « Ce que ça change pour vos vidéos » / intérêt / risque par `FournisseurScript.resumerNouveaute` (simulé tant qu'aucune clé Claude, règles : licence ou prix → rouge).
- Alertes : pastille sur le menu, notification `veille` dans la cloche, e-mail **seulement** si intérêt fort ou rouge, résumé hebdomadaire le lundi matin. « Essayer » crée une tâche (notification + journal) ; « Ignorer » range. **Rien n'est jamais mis à jour automatiquement.**
- Page « Veille » (menu Plus et Réglages > Outils) : une carte par outil (nom, version utilisée, dernière version, date, état ✅ / 🟠 / 🔴 / gris), nouveautés en dessous.

**Critères de fin B2**
- [ ] Lecture réelle des sources publiques au cours du lot (registre npm, GitHub, pages), résultats consignés ; Remotion affiché 4.0.532 « utilisée » ; un changement simulé de `LICENSE.md` produit une alerte rouge (test).
- [ ] Sans réseau : tests verts (réponses enregistrées) ; une source muette → carte grise (test).
- [ ] Notifications, e-mail filtré, résumé du lundi : une règle = un test.
- [ ] Captures 390 px de la page « Veille » et d'une nouveauté ouverte.

---

## 4. Rapport attendu de chaque lot (en fin de ce document, une annexe par lot)

Livré (fichiers), essais réels faits (point d'accès, coût relevé), fichiers figés touchés (ajouts purs), écarts aux consignes à trancher par Will, ce qui reste. Puis commit + push ; le déploiement est fait ensuite par la session principale.

---

## Annexe A2 — M5 (illustrations réelles) + « Mes images » (02/10)

**Livré**
- Domaine pur : `src/domaine/illustrations.ts` (mots, traduction locale FR → EN, requête du plan, refus générique / personnes / logos / uniformes, score, anti-répétition à 10 vidéos, cascade 0 et 0 bis, banques verticales et pertinentes, coûts) ; `src/domaine/mes-images.ts` (7 catégories, états, validation, doublons, recherche).
- Fournisseurs : `src/fournisseurs/illustration/{pexels,pixabay,fal,reel,depot,types,inscription}.ts` (`illustrationsReelles()` → `reel` si une clé existe ; `FOURNISSEUR_ILLUSTRATION=reel` ; `FAL_PLAFOND_USD` facultatif) ; `src/fournisseurs/simulation/analyse-image.ts` + `analyserImage` sur la simulation (`autres.ts`).
- Services : `src/services/illustrations.ts` (cascade à l'Aperçu, résultat de banque → élément `origine: banque` recopié, rang des vidéos, usages, mode économique) ; `src/services/mes-images.ts` ; `fabrication.ts` (cascade dans `plansApercu`, `ApercuFabrication.illustrations`, copie floutée lue par le montage, `entrees.illustrationsEconomique` / `fournisseurIllustration`, usages au lancement, `changerModeEconomiqueApercu`) ; `travaux.ts` (élément fabriqué : origine, 1 utilisation) ; `bibliotheque.ts` (comptage) ; migration étape 13.
- Moteur avocat : `src/moteurs/montage-avocat/fabrication-illustrations.ts` + branchement dans `index.ts` (étape « Illustrations » par étapes, jamais plus que l'estimation, reprise sans repayer, ligne « Illustrations à fabriquer » à la place de la ligne d'essai de la brique, `elementsCrees`, clips gardés pour un format ajouté).
- `studio-rendu/src/operations/traitement-image.ts` (flouter sur une COPIE, vignette 9:16, mesurer) inscrite dans `studio-rendu/src/index.ts`.
- Écrans : « Mes images » (`components/bibliotheque/mes-images/**`, tuile et route `/bibliotheque/mes-images`, actions dans `bibliotheque/actions.ts`, route d'essai local `api/mes-images/essai-local`, hors production) ; Aperçu (`Apercu.tsx` : pastilles d'origine, vignettes par plan, « Réutilisé · 0 € / À fabriquer », mode économique ; action `modeEconomiqueAction`).

**Essais réels (clés locales, jamais écrites)**
- Pexels `GET /videos/search` et Pixabay `GET /api/videos/` : 0 € — `docs/captures/m5-demo/banques.json` (réponses tronquées pour les tests : `tests/fixtures/a2-*.json`).
- fal.ai : UNE image `fal-ai/nano-banana` (3,9 ¢) + UN clip 5 s `fal-ai/bytedance/seedance/v1/pro/fast/image-to-video` 720p (10,8 ¢) = **0,147 $** (tarifs publiés ; facture fal non lue par programme), via le vrai service + le vrai moteur (`A2_PREUVE_REELLE=1 pnpm exec vitest run tests/a2-preuve-reelle.test.ts`) — rapport `preuve-m5.json`, fichiers `fal-image.jpg`, `fal-clip.mp4` (aucune personne, aucun texte lisible, aucun logo).

**Fichiers figés touchés** : aucun (`types.ts` des domaine / fournisseurs, registre, migrations.ts, `next.config.ts`, `briques/**` intacts).

**Écarts à trancher par Will**
- Pertinence des banques jugée par RÈGLES (mots de la requête dans la description) tant qu'il n'y a pas de clé Claude : Pexels renvoie souvent des vidéos sans rapport (« un homme devant une machine » pour « parking ticket »), elles sont écartées.
- Pixabay : très peu de vidéos verticales (≈ 1 à 6 % des résultats) ; Pexels fournit l'essentiel.
- Le moteur d'essai (`simulation`) garde son ancienne estimation ; le format avocat ne montre le coût réel des illustrations qu'avec `MOTEUR_AVOCAT=montage-avocat` (réglage déjà prévu).
- La clé Pixabay du fichier de secrets contient une espace au milieu (copier-coller coupé) : recollée automatiquement par `clesDepuisEnv`.

**Reste**
- Import Google Drive : adresse vérifiée, lecture seule, « à relier » (aucune lecture réelle).
- Classement d'images, requêtes et refus des images génériques : simulés (règles) jusqu'à une clé Claude.
- Floutage d'une VIDÉO de Mes images : non fait (elle reste « à vérifier » si elle a des zones).
- En local sans R2 ni `studio-rendu`, la copie floutée reprend l'original et l'écran pose le flou ; le vrai floutage FFmpeg est testé (`tests/a2-traitement-image.test.ts`).

---

## Annexe B1 — décors réalistes (02/10)

**Livré**
- Domaine pur `src/domaine/decors.ts` (ajouts) : récurrents 3 à 5 (`decorsRecurrents`, `peutMettreEnAvant`), états d'un décor (`etatDecor`), coût d'un Look (`estimationLook`, 1 $ par angle manquant, 0 € s'il existe), `lookReelPourAngle`, phrase → lieu en anglais sans personne (`sujetDecorEn`), 3 requêtes (dorée, jour, soir : `requetesPropositions`), consigne de Look ≤ 1 000 caractères (`consigneLook`).
- Catalogue `src/donnees/decors-catalogue.ts` : description anglaise de R1 à R8, vignette SUR le double de N1 à N6 (`public/demo/decors/sur-double/`).
- Looks HeyGen ÉCRITS ET ÉTEINTS : `fournisseurs/heygen/looks.ts` (`POST /v3/avatars` type `prompt` à partir du même look de base, `Idempotency-Key`, `GET /v3/avatars/looks/{id}`, liste des looks privés), `heygen/visage.ts` (`creerLook`, `suivre` ; le reste répond « lot M6 »), `visagesHeygen()` n'inscrit rien sans `HEYGEN_API_KEY` ET `FOURNISSEUR_VISAGE=heygen`. Client HTTP d'A1 réutilisé (ajout pur : en-têtes facultatifs).
- Brique `composition` : Look réel (look pour l'angle + `EntreeComposition.pistesDepuisLook`) = ni décor ni liseré posés, piste opaque, côtés prolongés par l'image du look floutée ; `vignette-decor.ts` (vignette d'un décor sur le double). `studio-rendu/src/operations/image-fixe.ts` : `references: true` résout les `entree:<nom>`.
- Service `src/services/decors.ts` : écran, demande en une phrase (coût AVANT, confirmation, 3 propositions `photo-incrustee` sans personne, vignette sur le double par `studio-rendu` quand il est relié), garder (les autres RANGÉES), ranger / remettre (N1 reste), mettre en avant, Look au premier usage (coût, confirmation, un look par angle, visages `genere` `a_verifier`, réutilisé gratuitement), validation sur capture, suivi des looks. `services/personnages.ts` : `doublesDeBasePourLooks`, `enregistrerLookGenere`. Migration 14 (vignettes posées si absentes, jamais un choix de Will réécrit, idempotente).
- Écrans : `components/bibliotheque/EcranDecors.tsx`, `components/decors/**` (vignette, demande, détail, actions) ; aiguillage `decor` dans `bibliotheque/[type]/page.tsx` ; pastille « Généré » dans `OngletVisages.tsx`.
- Tests : `tests/b1-decors.test.ts` (31), `tests/b1-decors-reel.test.ts` (2), réponses HeyGen enregistrées `tests/fixtures/b1-heygen-looks.json`.

**Essais réels**
- fal.ai `fal-ai/nano-banana` : 3 photos de décor sans personne (« un bureau en bois avec une bibliothèque »), **0,117 $** (tarif publié) — `docs/captures/b1-decors/preuve-photos.json`.
- HeyGen, lecture seule et gratuite : `GET /v3/avatars/looks?ownership=private` (vide : pas encore de double) et `GET /v3/avatars/looks/{id}` sur un look public. Aucune création de look ni de double, aucune vidéo.
- Vignettes sur le double (9) et démonstration du décor photo-incrusté en 9:16, 4:5, 1:1 : rendues en local par `image-fixe`, 0 €.
- Démonstration M4b refaite : empreintes identiques (`docs/captures/b1-decors/demo-m4-inchangee.json`).

**Écarts à trancher par Will**
- Prix d'un Look : la documentation dit « 1 crédit API par look » ; le studio affiche 1 $ par angle (palier Pro, 0,99 $), à relever au premier look réel.
- Pas de double de Will : les vignettes montrent la silhouette simulée.

**Reste**
- Aperçu de « Votre vidéo » : appeler `estimerLookDecor` / `preparerLookDecor` quand un décor réaliste sans look est choisi (le service est prêt, l'écran n'est pas branché).
- Prolonger les côtés en 4:5 et 1:1 pour un Look réel : l'image du look doit être recopiée dans le stockage au premier look réel.
