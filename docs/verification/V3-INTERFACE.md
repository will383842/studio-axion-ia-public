# Vérif V3 — interface (10/10/2026)

Vérificateur V3. Branche `verif/v3-interface`, partie de `master` à jour (`85655d2`). **Rien n'a été fusionné ni déployé ; aucun serveur touché ; aucun appel réel.**

## Conditions

- Studio construit (`pnpm build`) puis lancé en local avec `next start`, **mode simulation** : `STUDIO_SANS_BASE=1` (base de démonstration en mémoire), `STUDIO_VEILLE=0` (veille des outils coupée : elle lit des sites externes), aucune clé de service dans l'environnement → tous les fournisseurs restent en **Essai**. Compte d'essai : mot de passe jetable (empreinte argon2 et `SESSION_SECRET` générés pour la séance, jamais écrits dans le dépôt).
- Robot Playwright (Chromium préinstallé) : **81 pages × 2 largeurs = 162 passages, 2 712 clics** (boutons, onglets, interrupteurs, cases, boutons radio, menus déroulants ; liens vérifiés par leur code HTTP). Largeurs : **390 px** (iPhone, tactile) et **1440 px** (bureau).
- Relevé automatique à chaque page et chaque clic : erreurs de la console, exceptions, requêtes en échec (≥ 400), écran vide, chargement encore là après 6 s, textes anglais, textes tronqués, boutons qui ne réagissent pas, dialogues qui ne se ferment pas (Échap puis bouton « Fermer »), contrastes < 3:1, éléments qui sortent de l'écran à 390 px. Chaque alerte a ensuite été **revérifiée à la main** (sonde Playwright) avant d'être retenue.
- Non cliqués volontairement : « Déconnecter », « Révoquer », « Supprimer », « Retirer », « Archiver », « Changer le mot de passe » (lors du premier passage, le robot bureau a cliqué « Déconnecter les autres appareils » et a coupé la session du robot mobile : comportement attendu, pas un défaut).

## Défauts corrigés (test e2e rouge d'abord, puis vert)

Tests ajoutés : `tests/e2e-ui/interface.spec.ts` (config `playwright.ui.config.ts`, commande `E2E_MDP=… pnpm test:e2e-ui`, serveur lancé tout seul en simulation). **12/12 verts** (6 tests × mobile + bureau).

| # | Défaut | Où | Preuve rouge | Correctif |
|---|---|---|---|---|
| 1 | **« Mes animations » → 404** au chargement direct (lien de la Bibliothèque, rechargement, favori) ; la Bibliothèque précharge le lien → 404 + erreur console à **chaque** visite de `/bibliotheque`. | `src/proxy.ts` | `curl` sur master : 404 ; test unitaire `final-b-adresses-404` rouge | Le proxy prenait `/bibliotheque/animations` pour une rubrique « animations » inconnue ; ajoutée aux pages fixes. |
| 2 | **« NOUVELL / E VIDÉO »** : le grand titre de l'accueil coupé en plein mot à 390 px. | `src/app/(studio)/page.tsx` | test « Nouvelle vidéo tient sans couper le mot » rouge à 390 px | Taille qui suit la largeur (`clamp(28px, 9vw, 40px)`), 6xl inchangé sur bureau. |
| 3 | **Code de la prise écrasé en « 000… »** à côté de « Monter ma prise » (fiche sujet face caméra, 390 px). | `src/components/generateur/FicheSujet.tsx` | test « code de la prise reste lisible » rouge à 390 px, vert à 1440 px | Base de 7 rem : le bouton passe dessous au lieu d'écraser le code. |
| 4 | **« 100 / % »** : le pourcentage d'« En cours » (accueil) passe sur deux lignes ; pas d'espace insécable. | `src/app/(studio)/_accueil/EnCours.tsx` | test « pourcentage tient sur une ligne » rouge sur l'ancien code (390 et 1440 px) | `100 %` avec espace insécable, case plus large, sans retour à la ligne. |
| 5 | **Lecteur vidéo : « Lire » sur une source illisible** (lien expiré, réseau, format) → exception non gérée (`The element has no supported sources`) et rien à l'écran. | `src/components/ui/LecteurVideo.tsx` | test « source illisible » rouge (exception + aucun message) | Refus de lecture rattrapé : message « Cette vidéo ne se lit pas pour l'instant. Rechargez la page ; si cela continue, téléchargez-la. » |

Note sur 5 : dans ce conteneur, les vidéos de démonstration (H.264) ne se lisent pas parce que le Chromium libre n'a pas le codec ; en vrai Chrome / Safari elles se lisent. Le défaut corrigé est l'absence de gestion de l'échec, réelle partout.

Test existant ajusté : `tests/e2e1-console-ecrans.test.ts` (lit le texte du proxy) suit la nouvelle liste des pages fixes.

## Constats déjà connus (PR en cours — non refaits)

| Constat de prod | Sur master `85655d2` | Comment vérifié |
|---|---|---|
| Un clic sur un format lance la fabrication **sans confirmation** | **Persiste** : `FormatsFacecam.changer()` appelle `changerFormatsFacecamAction` dès le clic. | Lecture du code (fiche face caméra inaccessible en simulation, voir plus bas). |
| « Cartes et effets » vide malgré 6 cartes auto | **Persiste probablement** : la feuille ne liste que `vue.passages` ; PR #13 (`fix/cartes-finitions`) ouverte, non fusionnée. | Lecture du code. |
| Durée affichée = estimation | **Non vérifiable en simulation** (pas de montage face caméra terminé). | — |
| Chat masqué pendant un nouveau format | **Persiste** : `possible = prete && !enFabrication` est passé à `FilMonteur`, qui masque la saisie quand `possible` est faux ; un nouveau format est une fabrication en cours. | Lecture du code. |

## Ce qui n'a pas pu être parcouru en simulation

- **Fiche vidéo face caméra complète** (panneaux Coupes, Retoucher l'image, Cartes et effets, Sous-titres, formats, chat du monteur, Publier) : elle n'existe qu'après un montage par la **chaîne réelle** (stockage R2 + studio-rendu + aligneur + monteur Claude). En simulation, le parcours « J'ai déjà filmé ma vidéo » → `/envoyer` → envoi d'une vraie vidéo (fabriquée par ffmpeg) **fonctionne**, puis s'arrête proprement sur « Le serveur de montage face caméra n'est pas relié » et le brouillon « Votre vidéo » face caméra (capture `facecam-apres-envoi-390.png`). Pour aller plus loin il faudrait un montage simulé ou des données de démonstration face caméra — hors du périmètre « corriger » ; à décider par la session studio.
- **Boutons « Tester » de Réglages** : ils n'apparaissent que pour une clé présente (Clés des services payants) ou un Buffer relié ; sans clé ils sont remplacés par « À relier » / désactivés. Les cliquer ferait de toute façon un appel réel : non testés, conformément à la consigne. Les 13 fiches de connexion (Écriture, Double, Voix, Montage, Images, Étalonnage, Son, Miniatures, Publication, Textes, Notifications, Stockage, Calage) s'ouvrent, proposent Essai / service à relier, « Enregistrer », et se ferment (390 et 1440 px).
- Écrire › sujets et tournage : il n'y a pas de sujet dans la démo ; ceux créés pendant la séance (dont « J'ai déjà filmé ») ont été ouverts. Aucune séance de tournage dans la démo (`/ecrire/tournage` : état vide correct).

## Alertes écartées après vérification

- Dialogues « qui ne se ferment pas » (recherche, décors « À créer », plusieurs fiches de connexion) : se ferment bien à Échap ; le robot regardait pendant l'animation de fermeture.
- `/maquettes-generateur`, `/styleguide` → 404 : voulu en production (`FERMEES_EN_PRODUCTION`).
- `/formats` → `/videos`, `/idees` → `/ecrire?onglet=idees` : redirections voulues.
- Contraste « Avertissement 1.03 » sur les fiches vidéo : texte `sr-only` (invisible, lu par le lecteur d'écran).
- Interrupteurs « sans nom » de Réglages : nommés par `<label for>` (`Interrupteur.tsx`).
- Dialogue natif vide après « Réécrire » (fiche v-02) : garde « modifications non enregistrées » déclenchée par le départ du robot ; non reproduit à la main.
- Avertissements WebGL « GPU stall » : pilote graphique logiciel du conteneur.
- Textes tronqués relevés : titres de cartes volontairement limités (`line-clamp`/`truncate`) avec le titre complet ailleurs ; seuls les cas 3 et 4 cachaient l'information et ont été corrigés.
- « Open space » (nom d'un décor) : usage courant en français, laissé.
- Tests unitaires : 3 échecs sur la suite complète lancée **pendant** la construction et le robot (délais de 5 s dépassés) ; verts isolément, avec et sans les changements de cette branche.

## Résultats page par page

Légende : « x/y OK » = éléments cliqués qui réagissent normalement (ou mènent à une autre page) sur les éléments essayés ; les éléments destructifs non cliqués comptent dans y. Aucun bouton inerte, aucune exception hors lecteur vidéo (corrigé), aucun chargement infini, aucun débordement horizontal à 390 px, aucun écran vide (hors redirections).

Captures clés (`docs/verification/captures/`) : `accueil`, `bibliotheque`, `mes-animations`, `nouvelle-facecam`, `deja-filme`, `fiche-avocat-v01`, `ecrire`, `reglages`, `calendrier` en `-390` et `-1440` ; `avant-accueil-390.png` (titre coupé, avant correctif) ; `facecam-apres-envoi-390.png`.

| Page | 390 px | 1440 px |
|---|---|---|
| `/` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/bibliotheque` | HTTP 200 · 20/20 OK | HTTP 200 · 18/18 OK |
| `/bibliotheque/accessoire` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/bibliotheque/animations` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/bibliotheque/bruitage` | HTTP 200 · 26/27 OK | HTTP 200 · 24/25 OK |
| `/bibliotheque/couleurs` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/bibliotheque/decor` | HTTP 200 · 20/20 OK | HTTP 200 · 18/18 OK |
| `/bibliotheque/habillage` | HTTP 200 · 9/9 OK | HTTP 200 · 7/7 OK |
| `/bibliotheque/illustration-image` | HTTP 200 · 31/31 OK | HTTP 200 · 29/29 OK |
| `/bibliotheque/illustration-video` | HTTP 200 · 26/26 OK | HTTP 200 · 24/24 OK |
| `/bibliotheque/logo` | HTTP 200 · 9/9 OK | HTTP 200 · 7/7 OK |
| `/bibliotheque/lut` | HTTP 200 · 19/19 OK | HTTP 200 · 17/17 OK |
| `/bibliotheque/mes-images` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/bibliotheque/musique` | HTTP 200 · 14/14 OK | HTTP 200 · 12/12 OK |
| `/bibliotheque/police` | HTTP 200 · 8/8 OK | HTTP 200 · 6/6 OK |
| `/bibliotheque/profil-son` | HTTP 200 · 10/10 OK | HTTP 200 · 8/8 OK |
| `/bibliotheque/prononciations` | HTTP 200 · 21/27 OK | HTTP 200 · 19/25 OK |
| `/bibliotheque/rushs` | HTTP 200 · 9/9 OK | HTTP 200 · 7/7 OK |
| `/bibliotheque/style-montage` | HTTP 200 · 10/10 OK | HTTP 200 · 8/8 OK |
| `/bibliotheque/style-sous-titres` | HTTP 200 · 9/9 OK | HTTP 200 · 7/7 OK |
| `/calendrier` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/ecrire` | HTTP 200 · 17/17 OK | HTTP 200 · 15/15 OK |
| `/ecrire/atelier` | HTTP 200 · 15/15 OK | HTTP 200 · 13/13 OK |
| `/ecrire/matieres` | HTTP 200 · 22/22 OK | HTTP 200 · 20/20 OK |
| `/ecrire/tournage` | HTTP 200 · 5/5 OK | HTTP 200 · 3/3 OK |
| `/ecrire/voix` | HTTP 200 · 13/13 OK | HTTP 200 · 11/11 OK |
| `/envoyer/var-5e99b619bb05` | HTTP 200 · 6/6 OK | HTTP 200 · 4/4 OK |
| `/formats` | HTTP 200 · 7/7 OK | HTTP 200 · 0/0 OK |
| `/formats/avocat` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/formats/ecran-partage` | HTTP 200 · 8/8 OK | HTTP 200 · 5/5 OK |
| `/formats/facecam` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/formats/motion` | HTTP 200 · 8/8 OK | HTTP 200 · 5/5 OK |
| `/formats/podcast` | HTTP 200 · 8/8 OK | HTTP 200 · 5/5 OK |
| `/formats/selfie` | HTTP 200 · 8/8 OK | HTTP 200 · 5/5 OK |
| `/formats/ugc` | HTTP 200 · 5/5 OK | HTTP 200 · 2/2 OK |
| `/formats/createur-b` | HTTP 200 · 5/5 OK | HTTP 200 · 2/2 OK |
| `/hors-ligne` | HTTP 200 · 0/0 OK | HTTP 200 · 0/0 OK |
| `/idees` | HTTP 200 · 0/0 OK | HTTP 200 · 0/0 OK |
| `/maquettes-generateur` | HTTP 404 · 4/4 OK | HTTP 404 · 2/2 OK |
| `/mesures` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/mesures/ce-qui-marche` | HTTP 200 · 6/6 OK | HTTP 200 · 5/5 OK |
| `/modeles` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/nouvelle` | HTTP 200 · 4/4 OK | HTTP 200 · 2/2 OK |
| `/nouvelle/avocat` | HTTP 200 · 14/14 OK | HTTP 200 · 12/12 OK |
| `/nouvelle/facecam` | HTTP 200 · 14/14 OK | HTTP 200 · 12/12 OK |
| `/nouvelle/facecam?brouillon=v-86552f50d290` | HTTP 200 · 11/11 OK | HTTP 200 · 10/10 OK |
| `/personnages` | HTTP 200 · 5/5 OK | HTTP 200 · 3/3 OK |
| `/personnages/p-clara` | HTTP 200 · 8/8 OK | HTTP 200 · 6/6 OK |
| `/personnages/p-sophie` | HTTP 200 · 11/11 OK | HTTP 200 · 9/9 OK |
| `/personnages/p-will` | HTTP 200 · 13/13 OK | HTTP 200 · 11/11 OK |
| `/reglages` | HTTP 200 · 39/47 OK | HTTP 200 · 39/46 OK |
| `/reglages/google-drive` | HTTP 200 · 5/5 OK | HTTP 200 · 3/4 OK |
| `/scripts` | HTTP 200 · 17/17 OK | HTTP 200 · 0/0 OK |
| `/scripts/script-1` | HTTP 200 · 17/19 OK | HTTP 200 · 15/17 OK |
| `/scripts/script-2` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-3` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-4` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-5` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-6` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-7` | HTTP 200 · 33/33 OK | HTTP 200 · 30/31 OK |
| `/scripts/script-8` | HTTP 200 · 19/19 OK | HTTP 200 · 16/17 OK |
| `/scripts/script-ref-podcast-1` | HTTP 200 · 12/12 OK | HTTP 200 · 11/12 OK |
| `/styleguide` | HTTP 404 · 4/4 OK | HTTP 404 · 2/2 OK |
| `/veille` | HTTP 200 · 6/6 OK | HTTP 200 · 4/4 OK |
| `/videos` | HTTP 200 · 7/7 OK | HTTP 200 · 5/5 OK |
| `/videos/a-ranger` | HTTP 200 · 18/18 OK | HTTP 200 · 17/17 OK |
| `/videos/v-01` | HTTP 200 · 41/45 OK | HTTP 200 · 39/43 OK |
| `/videos/v-02` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-03` | HTTP 200 · 39/43 OK | HTTP 200 · 37/41 OK |
| `/videos/v-04` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-05` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-06` | HTTP 200 · 39/43 OK | HTTP 200 · 37/41 OK |
| `/videos/v-07` | HTTP 200 · 13/13 OK | HTTP 200 · 11/11 OK |
| `/videos/v-09` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-10` | HTTP 200 · 15/16 OK | HTTP 200 · 37/41 OK |
| `/videos/v-11` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-12` | HTTP 200 · 39/43 OK | HTTP 200 · 37/41 OK |
| `/videos/v-13` | HTTP 200 · 40/44 OK | HTTP 200 · 38/42 OK |
| `/videos/v-14` | HTTP 200 · 39/43 OK | HTTP 200 · 37/41 OK |
| `/videos/v-15` | HTTP 200 · 39/43 OK | HTTP 200 · 37/41 OK |
| `/videos/v-86552f50d290` | HTTP 200 · 0/0 OK | HTTP 200 · 10/10 OK |

<details><summary>Détail bouton par bouton (robot)</summary>


**`/` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/bibliotheque` — 390 px** (22 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « Axion chaud » : OK
- [radio] « Axion clair-obscur (v1) » : OK
- [radio] « Axion doux » : OK
- [radio] « Axion naturel » : OK
- [radio] « Axion nuit » : OK
- [radio] « Cinéma contrasté » : OK
- [radio] « Neutre » : OK
- [radio] « Aucun » : OK
- [radio] « Avocat » : OK
- [radio] « Axion pop » : OK
- [radio] « Karaoké » : OK
- [radio] « Sobre » : OK
- [radio] « Avocat : encadré d'ouverture » : OK
- [radio] « Axion complet » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque` — 1440 px** (20 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « Axion chaud » : OK
- [radio] « Axion clair-obscur (v1) » : OK
- [radio] « Axion doux » : OK
- [radio] « Axion naturel » : OK
- [radio] « Axion nuit » : OK
- [radio] « Cinéma contrasté » : OK
- [radio] « Neutre » : OK
- [radio] « Aucun » : OK
- [radio] « Avocat » : OK
- [radio] « Axion pop » : OK
- [radio] « Karaoké » : OK
- [radio] « Sobre » : OK
- [radio] « Avocat : encadré d'ouverture » : OK
- [radio] « Axion complet » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/accessoire` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Micro de podcast micro · podcast » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/accessoire` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Micro de podcast micro · podcast » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/animations` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/animations` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/bibliotheque/bruitage` — 390 px** (60 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Écouter Tic 1 » : OK
- [button] « Retirer » : — non cliqué (destructif)
- [button] « Valider » : OK
- [button] « Écouter Papier 1 » : OK
- [button] « Écouter Vibration 1 » : OK
- [button] « Écouter Souffle court 1 » : OK
- [button] « Écouter Pop grave 1 » : OK
- [button] « Trier » : OK
- [button] « Ambiance bureau ambiance » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ambiance bureau » » : OK
- [button] « Clic transition » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Clic » » : OK
- [button] « Ding notification » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ding » » : OK
- [button] « Impact sourd impact » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Impact sourd » » : OK
- [button] « Pop notification » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Pop » » : OK
- [button] « Souffle transition » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Souffle » » : OK
- [button] « Ton de pièce silence · pièce · ambiance » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ton de pièce » » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/bruitage` — 1440 px** (58 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Écouter Tic 1 » : OK
- [button] « Retirer » : — non cliqué (destructif)
- [button] « Valider » : OK
- [button] « Écouter Papier 1 » : OK
- [button] « Écouter Vibration 1 » : OK
- [button] « Écouter Souffle court 1 » : OK
- [button] « Écouter Pop grave 1 » : OK
- [button] « Trier » : OK
- [button] « Ambiance bureau ambiance » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ambiance bureau » » : OK
- [button] « Clic transition » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Clic » » : OK
- [button] « Ding notification » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ding » » : OK
- [button] « Impact sourd impact » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Impact sourd » » : OK
- [button] « Pop notification » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Pop » » : OK
- [button] « Souffle transition » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Souffle » » : OK
- [button] « Ton de pièce silence · pièce · ambiance » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Ton de pièce » » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/couleurs` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Palette Axion À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/couleurs` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Palette Axion À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/decor` — 390 px** (20 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Demander un décor Une phrase, 3 propositions sur votre double » : OK · dialogue ouvert puis fermé
- [button] « Halo orange, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Crème chaud, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Lumière dorée, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Bureau bois clair-obscur, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bibliothèque, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bureau de direction, À créer » : OK · dialogue ouvert puis fermé
- [button] « Salle de réunion, À créer » : OK · dialogue ouvert puis fermé
- [button] « Atelier, À créer » : OK · dialogue ouvert puis fermé
- [button] « Studio podcast, À créer » : OK · dialogue ouvert puis fermé
- [button] « Salon café, À créer » : OK · dialogue ouvert puis fermé
- [button] « Open space, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bureau sombre, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Noir chaud, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Studio chaleureux, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Réserve et rangés (3) » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/decor` — 1440 px** (18 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Demander un décor Une phrase, 3 propositions sur votre double » : OK · dialogue ouvert puis fermé
- [button] « Halo orange, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Crème chaud, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Lumière dorée, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Bureau bois clair-obscur, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bibliothèque, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bureau de direction, À créer » : OK · dialogue ouvert puis fermé
- [button] « Salle de réunion, À créer » : OK · dialogue ouvert puis fermé
- [button] « Atelier, À créer » : OK · dialogue ouvert puis fermé
- [button] « Studio podcast, À créer » : OK · dialogue ouvert puis fermé
- [button] « Salon café, À créer » : OK · dialogue ouvert puis fermé
- [button] « Open space, À créer » : OK · dialogue ouvert puis fermé
- [button] « Bureau sombre, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Noir chaud, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Studio chaleureux, Prêt » : OK · dialogue ouvert puis fermé
- [button] « Réserve et rangés (3) » : OK

**`/bibliotheque/habillage` — 390 px** (9 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat : encadré d'ouverture avocat · encadré » : OK · dialogue ouvert puis fermé
- [button] « Axion complet logo · carte finale » : OK · dialogue ouvert puis fermé
- [button] « Sobre discret » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/habillage` — 1440 px** (7 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat : encadré d'ouverture avocat · encadré » : OK · dialogue ouvert puis fermé
- [button] « Axion complet logo · carte finale » : OK · dialogue ouvert puis fermé
- [button] « Sobre discret » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/illustration-image` — 390 px** (31 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Tout 13 » : OK
- [button] « Images 9 » : OK
- [button] « Vidéos 4 » : OK
- [button] « chiffres » : OK
- [button] « écran » : OK
- [button] « ordinateur » : OK
- [button] « téléphone » : OK
- [button] « accord » : OK
- [button] « ambiance » : OK
- [button] « appel » : OK
- [button] « bureau » : OK
- [button] « carnet » : OK
- [button] « clavier » : OK
- [button] « client » : OK
- [button] « comptable » : OK
- [button] « contrat » : OK
- [button] « croissance » : OK
- [button] « Bureau le soir » : OK · dialogue ouvert puis fermé
- [button] « À vérifier Calculatrice et factures » : OK · dialogue ouvert puis fermé
- [button] « Contrat sur une table » : OK · dialogue ouvert puis fermé
- [button] « Écran d'ordinateur » : OK · dialogue ouvert puis fermé
- [button] « Poignée de main » : OK · dialogue ouvert puis fermé
- [button] « Salle de réunion » : OK · dialogue ouvert puis fermé
- [button] « Téléphone (incrustation d'appel) » : OK · dialogue ouvert puis fermé
- [button] « Téléphone et SMS » : OK · dialogue ouvert puis fermé
- [button] « Tribunal vide » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/illustration-image` — 1440 px** (29 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Tout 13 » : OK
- [button] « Images 9 » : OK
- [button] « Vidéos 4 » : OK
- [button] « chiffres » : OK
- [button] « écran » : OK
- [button] « ordinateur » : OK
- [button] « téléphone » : OK
- [button] « accord » : OK
- [button] « ambiance » : OK
- [button] « appel » : OK
- [button] « bureau » : OK
- [button] « carnet » : OK
- [button] « clavier » : OK
- [button] « client » : OK
- [button] « comptable » : OK
- [button] « contrat » : OK
- [button] « croissance » : OK
- [button] « Bureau le soir » : OK · dialogue ouvert puis fermé
- [button] « À vérifier Calculatrice et factures » : OK · dialogue ouvert puis fermé
- [button] « Contrat sur une table » : OK · dialogue ouvert puis fermé
- [button] « Écran d'ordinateur » : OK · dialogue ouvert puis fermé
- [button] « Poignée de main » : OK · dialogue ouvert puis fermé
- [button] « Salle de réunion » : OK · dialogue ouvert puis fermé
- [button] « Téléphone (incrustation d'appel) » : OK · dialogue ouvert puis fermé
- [button] « Téléphone et SMS » : OK · dialogue ouvert puis fermé
- [button] « Tribunal vide » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé

**`/bibliotheque/illustration-video` — 390 px** (26 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Tout 13 » : OK
- [button] « Images 9 » : OK
- [button] « Vidéos 4 » : OK
- [button] « chiffres » : OK
- [button] « écran » : OK
- [button] « ordinateur » : OK
- [button] « téléphone » : OK
- [button] « accord » : OK
- [button] « ambiance » : OK
- [button] « appel » : OK
- [button] « bureau » : OK
- [button] « carnet » : OK
- [button] « clavier » : OK
- [button] « client » : OK
- [button] « comptable » : OK
- [button] « contrat » : OK
- [button] « croissance » : OK
- [button] « Expirée Café et carnet » : OK · dialogue ouvert puis fermé
- [button] « Clavier en gros plan » : OK · dialogue ouvert puis fermé
- [button] « Graphique qui monte » : OK · dialogue ouvert puis fermé
- [button] « Ville la nuit » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/illustration-video` — 1440 px** (24 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Tout 13 » : OK
- [button] « Images 9 » : OK
- [button] « Vidéos 4 » : OK
- [button] « chiffres » : OK
- [button] « écran » : OK
- [button] « ordinateur » : OK
- [button] « téléphone » : OK
- [button] « accord » : OK
- [button] « ambiance » : OK
- [button] « appel » : OK
- [button] « bureau » : OK
- [button] « carnet » : OK
- [button] « clavier » : OK
- [button] « client » : OK
- [button] « comptable » : OK
- [button] « contrat » : OK
- [button] « croissance » : OK
- [button] « Expirée Café et carnet » : OK · dialogue ouvert puis fermé
- [button] « Clavier en gros plan » : OK · dialogue ouvert puis fermé
- [button] « Graphique qui monte » : OK · dialogue ouvert puis fermé
- [button] « Ville la nuit » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé

**`/bibliotheque/logo` — 390 px** (9 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Logo (incrustation d'appel) appel · logo · incrustation » : OK · dialogue ouvert puis fermé
- [button] « Logo Axion À moi » : OK · dialogue ouvert puis fermé
- [button] « Logo monochrome À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/logo` — 1440 px** (7 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Logo (incrustation d'appel) appel · logo · incrustation » : OK · dialogue ouvert puis fermé
- [button] « Logo Axion À moi » : OK · dialogue ouvert puis fermé
- [button] « Logo monochrome À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/lut` — 390 px** (19 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [checkbox] « Type avocat » : OK
- [checkbox] « Face caméra » : OK
- [checkbox] « Podcast » : OK
- [checkbox] « Type Créateur B » : OK
- [checkbox] « Écran partagé » : OK
- [checkbox] « Motion design » : OK
- [checkbox] « Avis client » : OK
- [button] « Axion chaud 70% » : OK
- [button] « Axion clair-obscur (v1) 70% » : OK
- [button] « Axion doux 70% » : OK
- [button] « Axion naturel 60% » : OK
- [button] « Axion nuit 70% » : OK
- [button] « Cinéma contrasté 60% » : OK
- [button] « Neutre 50% » : OK
- [button] « Ajouter une couleur » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/lut` — 1440 px** (17 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [checkbox] « Type avocat » : OK
- [checkbox] « Face caméra » : OK
- [checkbox] « Podcast » : OK
- [checkbox] « Type Créateur B » : OK
- [checkbox] « Écran partagé » : OK
- [checkbox] « Motion design » : OK
- [checkbox] « Avis client » : OK
- [button] « Axion chaud 70% » : OK
- [button] « Axion clair-obscur (v1) 70% » : OK
- [button] « Axion doux 70% » : OK
- [button] « Axion naturel 60% » : OK
- [button] « Axion nuit 70% » : OK
- [button] « Cinéma contrasté 60% » : OK
- [button] « Neutre 50% » : OK
- [button] « Ajouter une couleur » : OK · dialogue ouvert puis fermé

**`/bibliotheque/mes-images` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Toutes 0 » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/mes-images` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Toutes 0 » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des images » : OK · dialogue ouvert puis fermé

**`/bibliotheque/musique` — 390 px** (14 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Élan énergique · positif » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Élan » » : OK
- [button] « Nappe calme calme · podcast » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Nappe calme » » : OK
- [button] « Pulsation rythmé · motion » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Pulsation » » : OK
- [button] « Tension douce tension-douce · sérieux » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Tension douce » » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/musique` — 1440 px** (12 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Élan énergique · positif » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Élan » » : OK
- [button] « Nappe calme calme · podcast » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Nappe calme » » : OK
- [button] « Pulsation rythmé · motion » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Pulsation » » : OK
- [button] « Tension douce tension-douce · sérieux » : OK · dialogue ouvert puis fermé
- [button] « Écouter « Tension douce » » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/police` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Archivo Black Libre » : OK · dialogue ouvert puis fermé
- [button] « Manrope Libre » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/police` — 1440 px** (6 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Archivo Black Libre » : OK · dialogue ouvert puis fermé
- [button] « Manrope Libre » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/profil-son` — 390 px** (10 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat : voix sèche avocat · voix » : OK · dialogue ouvert puis fermé
- [button] « Podcast À moi » : OK · dialogue ouvert puis fermé
- [button] « Rythmé avec bruitages À moi » : OK · dialogue ouvert puis fermé
- [button] « Voix claire À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/profil-son` — 1440 px** (8 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat : voix sèche avocat · voix » : OK · dialogue ouvert puis fermé
- [button] « Podcast À moi » : OK · dialogue ouvert puis fermé
- [button] « Rythmé avec bruitages À moi » : OK · dialogue ouvert puis fermé
- [button] « Voix claire À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/prononciations` — 390 px** (27 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « A → Z » : OK
- [radio] « Récents » : OK
- [radio] « Plus utilisés » : OK
- [button] « Écouter « Axion-IA » » : OK
- [button] « Axion-IA « axion i-a » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Axion-IA » » : — non cliqué (destructif)
- [button] « Écouter « ChatGPT » » : OK
- [button] « ChatGPT « tchatte-jé-pé-té » dans 1 vidéo » : OK · dialogue ouvert puis fermé
- [button] « Archiver « ChatGPT » » : — non cliqué (destructif)
- [button] « Écouter « PME » » : OK
- [button] « PME « pé-èm-eu » dans 2 vidéos » : OK · dialogue ouvert puis fermé
- [button] « Archiver « PME » » : — non cliqué (destructif)
- [button] « Écouter « Certifexemple » » : OK
- [button] « Certifexemple « ka-lio-pi » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Certifexemple » » : — non cliqué (destructif)
- [button] « Écouter « RGPD » » : OK
- [button] « RGPD « èr-jé-pé-dé » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « RGPD » » : — non cliqué (destructif)
- [button] « Écouter « Williams » » : OK
- [button] « Williams « wi-liamz » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Williams » » : — non cliqué (destructif)
- [button] « Ajouter un mot » : OK · dialogue ouvert puis fermé
- [button] « Coller une liste » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/prononciations` — 1440 px** (25 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « A → Z » : OK
- [radio] « Récents » : OK
- [radio] « Plus utilisés » : OK
- [button] « Écouter « Axion-IA » » : OK
- [button] « Axion-IA « axion i-a » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Axion-IA » » : — non cliqué (destructif)
- [button] « Écouter « ChatGPT » » : OK
- [button] « ChatGPT « tchatte-jé-pé-té » dans 1 vidéo » : OK · dialogue ouvert puis fermé
- [button] « Archiver « ChatGPT » » : — non cliqué (destructif)
- [button] « Écouter « PME » » : OK
- [button] « PME « pé-èm-eu » dans 2 vidéos » : OK · dialogue ouvert puis fermé
- [button] « Archiver « PME » » : — non cliqué (destructif)
- [button] « Écouter « Certifexemple » » : OK
- [button] « Certifexemple « ka-lio-pi » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Certifexemple » » : — non cliqué (destructif)
- [button] « Écouter « RGPD » » : OK
- [button] « RGPD « èr-jé-pé-dé » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « RGPD » » : — non cliqué (destructif)
- [button] « Écouter « Williams » » : OK
- [button] « Williams « wi-liamz » pas encore utilisé » : OK · dialogue ouvert puis fermé
- [button] « Archiver « Williams » » : — non cliqué (destructif)
- [button] « Ajouter un mot » : OK · dialogue ouvert puis fermé
- [button] « Coller une liste » : OK · dialogue ouvert puis fermé

**`/bibliotheque/rushs` — 390 px** (9 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « 0001-FC-TT-L · prise 1 0001-FC-TT-L · je lis » : OK · dialogue ouvert puis fermé
- [button] « Mains sur le clavier clavier · travail » : OK · dialogue ouvert puis fermé
- [button] « Marche dans le couloir marche · bureau » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des rushs » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/rushs` — 1440 px** (7 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « 0001-FC-TT-L · prise 1 0001-FC-TT-L · je lis » : OK · dialogue ouvert puis fermé
- [button] « Mains sur le clavier clavier · travail » : OK · dialogue ouvert puis fermé
- [button] « Marche dans le couloir marche · bureau » : OK · dialogue ouvert puis fermé
- [button] « Ajouter des rushs » : OK · dialogue ouvert puis fermé

**`/bibliotheque/style-montage` — 390 px** (10 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat avocat · coupes franches » : OK · dialogue ouvert puis fermé
- [button] « Calme À moi » : OK · dialogue ouvert puis fermé
- [button] « Rythmé À moi » : OK · dialogue ouvert puis fermé
- [button] « Très rythmé À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/style-montage` — 1440 px** (8 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Avocat avocat · coupes franches » : OK · dialogue ouvert puis fermé
- [button] « Calme À moi » : OK · dialogue ouvert puis fermé
- [button] « Rythmé À moi » : OK · dialogue ouvert puis fermé
- [button] « Très rythmé À moi » : OK · dialogue ouvert puis fermé
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/bibliotheque/style-sous-titres` — 390 px** (9 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Avocat Karaoké · 4 mots » : OK · dialogue ouvert puis fermé
- [button] « OUI, MAIS JAMAIS Axion pop Impact · 3 mots » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Karaoké Karaoké · 4 mots » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Sobre Minimal · 6 mots » : OK · dialogue ouvert puis fermé
- [button] « Nouveau style » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/bibliotheque/style-sous-titres` — 1440 px** (7 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Avocat Karaoké · 4 mots » : OK · dialogue ouvert puis fermé
- [button] « OUI, MAIS JAMAIS Axion pop Impact · 3 mots » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Karaoké Karaoké · 4 mots » : OK · dialogue ouvert puis fermé
- [button] « Oui, mais jamais Sobre Minimal · 6 mots » : OK · dialogue ouvert puis fermé
- [button] « Nouveau style » : OK · dialogue ouvert puis fermé

**`/calendrier` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/calendrier` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/ecrire` — 390 px** (17 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plus de filtres » : OK · dialogue ouvert puis fermé · mène à `/ecrire?filtres=1`
- [tab] « Scripts » : OK
- [tab] « Idées 8 » : OK · mène à `/ecrire?onglet=idees`
- [tab] « Matières » : OK · mène à `/ecrire?onglet=matieres`
- [tab] « Ma voix » : OK · mène à `/ecrire?onglet=voix`
- [button] « Nouvelle série » : OK
- [button] « TT » : OK · mène à `/ecrire?reseau=tiktok`
- [button] « IG » : OK · mène à `/ecrire?reseau=instagram`
- [button] « YS » : OK
- [button] « in » : OK · mène à `/ecrire?reseau=linkedin`
- [button] « f » : OK · mène à `/ecrire?reseau=facebook`
- [button] « Format » : OK · dialogue ouvert puis fermé
- [summary] « Légende » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/ecrire` — 1440 px** (15 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plus de filtres » : OK · dialogue ouvert puis fermé · mène à `/ecrire?filtres=1`
- [tab] « Scripts » : OK
- [tab] « Idées 8 » : OK · mène à `/ecrire?onglet=idees`
- [tab] « Matières » : OK · mène à `/ecrire?onglet=matieres`
- [tab] « Ma voix » : OK · mène à `/ecrire?onglet=voix`
- [button] « Nouvelle série » : OK
- [button] « TT » : OK · mène à `/ecrire?reseau=tiktok`
- [button] « IG » : OK · mène à `/ecrire?reseau=instagram`
- [button] « YS » : OK
- [button] « in » : OK · mène à `/ecrire?reseau=linkedin`
- [button] « f » : OK
- [button] « Format » : OK · dialogue ouvert puis fermé
- [summary] « Légende » : OK

**`/ecrire/atelier` — 390 px** (15 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plusieurs » : OK
- [button] « Une phrase à vous facultatif » : OK
- [button] « Réseaux : modifier » : OK · dialogue ouvert puis fermé
- [button] « Format : modifier » : OK · dialogue ouvert puis fermé
- [button] « Qui parle : modifier » : OK · dialogue ouvert puis fermé
- [button] « Vous ou tu : modifier » : OK · dialogue ouvert puis fermé
- [button] « But : modifier » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [summary] « Je choisis » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/ecrire/atelier` — 1440 px** (13 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plusieurs » : OK
- [button] « Une phrase à vous facultatif » : OK
- [button] « Réseaux : modifier » : OK · dialogue ouvert puis fermé
- [button] « Format : modifier » : OK · dialogue ouvert puis fermé
- [button] « Qui parle : modifier » : OK · dialogue ouvert puis fermé
- [button] « Vous ou tu : modifier » : OK · dialogue ouvert puis fermé
- [button] « But : modifier » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [summary] « Je choisis » : OK

**`/ecrire/matieres` — 390 px** (22 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Il manque surtout des questions de clients » : OK · dialogue ouvert puis fermé
- [button] « Matière » : OK · dialogue ouvert puis fermé
- [button] « Plusieurs » : OK · dialogue ouvert puis fermé
- [radio] « Tout 0 » : OK
- [radio] « Questions 0 » : OK
- [radio] « Avis 0 » : OK
- [radio] « Observations 0 » : OK
- [radio] « Paroles 0 » : OK
- [radio] « Cas clients 0 » : OK
- [radio] « Idées reçues 0 » : OK
- [radio] « Anecdotes 0 » : OK
- [radio] « Limites 0 » : OK
- [radio] « Études 0 » : OK
- [radio] « Actualités 0 » : OK
- [radio] « Démos 0 » : OK
- [radio] « Chiffres et preuves 0 » : OK
- [button] « Dicter » : OK · dialogue ouvert puis fermé
- [switch] « (sans texte) » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/ecrire/matieres` — 1440 px** (20 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Il manque surtout des questions de clients » : OK · dialogue ouvert puis fermé
- [button] « Matière » : OK · dialogue ouvert puis fermé
- [button] « Plusieurs » : OK · dialogue ouvert puis fermé
- [radio] « Tout 0 » : OK
- [radio] « Questions 0 » : OK
- [radio] « Avis 0 » : OK
- [radio] « Observations 0 » : OK
- [radio] « Paroles 0 » : OK
- [radio] « Cas clients 0 » : OK
- [radio] « Idées reçues 0 » : OK
- [radio] « Anecdotes 0 » : OK
- [radio] « Limites 0 » : OK
- [radio] « Études 0 » : OK
- [radio] « Actualités 0 » : OK
- [radio] « Démos 0 » : OK
- [radio] « Chiffres et preuves 0 » : OK
- [button] « Dicter » : OK · dialogue ouvert puis fermé
- [switch] « (sans texte) » : OK

**`/ecrire/tournage` — 390 px** (6 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « 0003-FC-TT-L » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/ecrire/tournage` — 1440 px** (6 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « 0005-FC-TT-L » : OK

**`/ecrire/voix` — 390 px** (13 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ma façon de parler 1 » : OK
- [button] « Mes textes 0 » : OK
- [button] « Mes expressions 0 » : OK
- [button] « Mes positions 0 » : OK
- [button] « Mes thèmes 12 » : OK
- [button] « Mes interdits 7 » : OK
- [button] « Tournures interdites 93 » : OK
- [button] « Règles des réseaux 3 » : OK
- [button] « Prononciation 6 » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/ecrire/voix` — 1440 px** (11 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ma façon de parler 1 » : OK
- [button] « Mes textes 0 » : OK
- [button] « Mes expressions 0 » : OK
- [button] « Mes positions 0 » : OK
- [button] « Mes thèmes 12 » : OK
- [button] « Mes interdits 7 » : OK
- [button] « Tournures interdites 93 » : OK
- [button] « Règles des réseaux 3 » : OK
- [button] « Prononciation 6 » : OK

**`/envoyer/var-5e99b619bb05` — 390 px** (6 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Choisir ma vidéo Dans la photothèque, la dernière vidéo filmée. L'envo » : OK
- [button] « Depuis mon Google Drive » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/envoyer/var-5e99b619bb05` — 1440 px** (4 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Choisir ma vidéo Dans la photothèque, la dernière vidéo filmée. L'envo » : OK
- [button] « Depuis mon Google Drive » : OK · dialogue ouvert puis fermé

**`/formats` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK (navigation)
- [button] « Filtres » : OK (navigation)
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK (navigation)
- [button] « Créer » : OK (navigation)
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/formats` — 1440 px** (0 éléments interactifs)


**`/formats/avocat` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/formats/avocat` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/formats/ecran-partage` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/ecran-partage` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/formats/facecam` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/formats/facecam` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/formats/motion` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/motion` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/formats/podcast` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/podcast` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/formats/selfie` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/selfie` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/formats/ugc` — 390 px** (5 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/ugc` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/formats/createur-b` — 390 px** (5 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Me prévenir » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK (vérifié ailleurs)

**`/formats/createur-b` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/hors-ligne` — 390 px** (0 éléments interactifs)


**`/hors-ligne` — 1440 px** (0 éléments interactifs)


**`/idees` — 390 px** (0 éléments interactifs)


**`/idees` — 1440 px** (0 éléments interactifs)


**`/maquettes-generateur` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/maquettes-generateur` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/mesures` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/mesures` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/mesures/ce-qui-marche` — 390 px** (6 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Mettre à jour ESSAI » : OK
- [button] « TT Essai V3 face caméra 0001-FC-TT-L · rien de semblable encore » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/mesures/ce-qui-marche` — 1440 px** (6 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Mettre à jour ESSAI » : OK
- [button] « TT Prise lisible 1791616357492 0007-FC-TT-L · rien de semblable encore » : OK
- [button] « TT Essai V3 face caméra 0001-FC-TT-L · rien de semblable encore » : OK

**`/modeles` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions : Avocat 45 s vertical » : OK
- [button] « Plus d'actions : Avocat 60 s carré LinkedIn » : OK
- [button] « Depuis une vidéo réussie » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/modeles` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Depuis une vidéo réussie » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions : Avocat 45 s vertical » : OK
- [button] « Plus d'actions : Avocat 60 s carré LinkedIn » : OK

**`/nouvelle` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/nouvelle` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/nouvelle/avocat` — 390 px** (14 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Importer un fichier » : OK · dialogue ouvert puis fermé
- [button] « Mes scripts » : OK · dialogue ouvert puis fermé
- [button] « Une idée » : OK · dialogue ouvert puis fermé
- [button] « Script : Collez votre texte » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Halo orange · Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK · dialogue ouvert puis fermé
- [button] « Style : Axion clair-obscur (v1) · Avocat » : OK · dialogue ouvert puis fermé
- [button] « Coût : Après le texte » : OK (vérifié ailleurs)
- [button] « Créer » : OK (vérifié ailleurs)
- [button] « Plus » : OK (vérifié ailleurs)

**`/nouvelle/avocat` — 1440 px** (12 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Importer un fichier » : OK · dialogue ouvert puis fermé
- [button] « Mes scripts » : OK · dialogue ouvert puis fermé
- [button] « Une idée » : OK · dialogue ouvert puis fermé
- [button] « Script : Collez votre texte » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Halo orange · Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK (vérifié ailleurs)
- [button] « Style : Axion clair-obscur (v1) · Avocat » : OK (vérifié ailleurs)
- [button] « Coût : Après le texte » : OK (vérifié ailleurs)

**`/nouvelle/facecam` — 390 px** (14 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « J'ai déjà filmé ma vidéo » : OK
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Importer un fichier » : OK · dialogue ouvert puis fermé
- [button] « Mes scripts » : OK · dialogue ouvert puis fermé
- [button] « Une idée » : OK · dialogue ouvert puis fermé
- [button] « Script : Collez votre texte » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK · dialogue ouvert puis fermé
- [button] « Style : Axion naturel · Avocat · Rythmé » : OK (vérifié ailleurs)
- [button] « Créer » : OK (vérifié ailleurs)
- [button] « Plus » : OK (vérifié ailleurs)

**`/nouvelle/facecam` — 1440 px** (12 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « J'ai déjà filmé ma vidéo » : OK
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Importer un fichier » : OK · dialogue ouvert puis fermé
- [button] « Mes scripts » : OK · dialogue ouvert puis fermé
- [button] « Une idée » : OK · dialogue ouvert puis fermé
- [button] « Script : Collez votre texte » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Chemise noire · Assis » : OK (vérifié ailleurs)
- [button] « Voix : Ma voix » : OK (vérifié ailleurs)
- [button] « Style : Axion naturel · Avocat · Rythmé » : OK (vérifié ailleurs)

**`/nouvelle/facecam?brouillon=v-86552f50d290` — 390 px** (11 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Script : ≈ 11 s · Vous » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK · dialogue ouvert puis fermé
- [button] « Style : Axion naturel · Avocat · Rythmé » : OK · dialogue ouvert puis fermé
- [button] « Voir les plans ESSAI » : OK
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/nouvelle/facecam?brouillon=v-86552f50d290` — 1440 px** (10 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Script : ≈ 11 s · Vous » : OK · dialogue ouvert puis fermé
- [button] « Plateau : Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK · dialogue ouvert puis fermé
- [button] « Style : Axion naturel · Avocat · Rythmé » : OK · dialogue ouvert puis fermé
- [button] « Voir les plans ESSAI » : OK
- [button] « Fabriquer ESSAI » : OK

**`/personnages` — 390 px** (5 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter un personnage » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/personnages` — 1440 px** (3 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter un personnage » : OK · dialogue ouvert puis fermé

**`/personnages/p-clara` — 390 px** (8 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 1 » : OK
- [tab] « Voix » : OK
- [button] « Prêt 90 Face Face, studio Pull crème · Studio podcast » : OK · dialogue ouvert puis fermé
- [button] « Ajouter un visage » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/personnages/p-clara` — 1440 px** (6 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 1 » : OK
- [tab] « Voix » : OK
- [button] « Prêt 90 Face Face, studio Pull crème · Studio podcast » : OK · dialogue ouvert puis fermé
- [button] « Ajouter un visage » : OK · dialogue ouvert puis fermé

**`/personnages/p-sophie` — 390 px** (11 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 1 » : OK
- [tab] « Voix » : OK
- [tab] « Accord » : OK
- [button] « Voir l'accord » : OK
- [button] « À compléter Face Face, cabinet Tailleur · Bureau » : OK · dialogue ouvert puis fermé
- [summary] « La séance, dans l'ordre » : OK
- [button] « Enregistrer l'accord » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/personnages/p-sophie` — 1440 px** (9 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 1 » : OK
- [tab] « Voix » : OK
- [tab] « Accord » : OK
- [button] « Voir l'accord » : OK
- [button] « À compléter Face Face, cabinet Tailleur · Bureau » : OK · dialogue ouvert puis fermé
- [summary] « La séance, dans l'ordre » : OK
- [button] « Enregistrer l'accord » : OK

**`/personnages/p-will` — 390 px** (13 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 2 » : OK
- [tab] « Voix » : OK
- [button] « Prêt 92 Face Face, chemise noire Chemise noire · Fond noir » : OK · dialogue ouvert puis fermé
- [button] « Prêt 88 Trois quarts Trois quarts, veste Veste sombre · Fond noir » : OK · dialogue ouvert puis fermé
- [button] « Vidéo type avocat Habituel · Face, chemise noire » : OK · dialogue ouvert puis fermé
- [button] « Vidéo face caméra Habituel · Face, chemise noire » : OK · dialogue ouvert puis fermé
- [button] « Choisir mon double HeyGen » : OK · dialogue ouvert puis fermé
- [summary] « La séance, dans l'ordre » : OK
- [button] « Ajouter un visage » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/personnages/p-will` — 1440 px** (11 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [tab] « Visages 2 » : OK
- [tab] « Voix » : OK
- [button] « Prêt 92 Face Face, chemise noire Chemise noire · Fond noir » : OK · dialogue ouvert puis fermé
- [button] « Prêt 88 Trois quarts Trois quarts, veste Veste sombre · Fond noir » : OK · dialogue ouvert puis fermé
- [button] « Vidéo type avocat Habituel · Face, chemise noire » : OK · dialogue ouvert puis fermé
- [button] « Vidéo face caméra Habituel · Face, chemise noire » : OK · dialogue ouvert puis fermé
- [button] « Choisir mon double HeyGen » : OK · dialogue ouvert puis fermé
- [summary] « La séance, dans l'ordre » : OK
- [button] « Ajouter un visage » : OK · dialogue ouvert puis fermé

**`/reglages` — 390 px** (85 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Changer » : OK · dialogue ouvert puis fermé
- [button] « Déconnecter » : — non cliqué (destructif)
- [button] « Écriture des scripts Prévu : Claude Essai » : OK · dialogue ouvert puis fermé
- [button] « Double (visage) Prévu : HeyGen Essai » : OK · dialogue ouvert puis fermé
- [button] « Voix Prévu : HeyGen Essai » : OK · dialogue ouvert puis fermé
- [button] « Montage Prévu : Montage sur le serveur du studio, Montage en ligne (pl » : OK · dialogue ouvert puis fermé
- [button] « Images d'illustration Prévu : Banques d'images et images fabriquées Es » : OK · dialogue ouvert puis fermé
- [button] « Étalonnage des couleurs Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Son et mixage Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Miniatures Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Publication Prévu : Buffer Essai » : OK · dialogue ouvert puis fermé
- [button] « Textes de publication Prévu : Claude Essai » : OK · dialogue ouvert puis fermé
- [button] « Notifications (téléphone, e-mail) Prévu : Téléphone et e-mail Essai » : OK · dialogue ouvert puis fermé
- [button] « Stockage des fichiers Prévu : Stockage en ligne Essai » : OK · dialogue ouvert puis fermé
- [button] « Calage des sous-titres Prévu : Calage sur le serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [radio] « Brouillon dans Buffer Vous relisez et programmez dans Buffer » : OK
- [radio] « Programmer directement La date choisie ici part telle quelle » : OK
- [switch] « (sans texte) » : OK
- [radio] « Sans fond, posé sur vos décors » : OK
- [radio] « Fond uni » : OK
- [switch] « (sans texte) » : OK
- [button] « Modifier » : OK
- [radio] « 0 € Août » : OK
- [radio] « 0 € Sept. » : OK · dialogue ouvert puis fermé
- [radio] « 0 € Oct. » : OK
- [button] « Relever » : OK
- [switch] « (sans texte) » : OK
- [switch] « (sans texte) » : OK · dialogue ouvert puis fermé
- [button] « Retirer Accueil » : — non cliqué (destructif)
- [button] « Retirer Formations » : — non cliqué (destructif)
- [button] « Retirer Audit » : — non cliqué (destructif)
- [button] « Retirer Implémentation » : — non cliqué (destructif)
- [button] « Retirer Tarifs » : — non cliqué (destructif)
- [button] « Retirer Questions fréquentes » : — non cliqué (destructif)
- [button] « Retirer À propos » : — non cliqué (destructif)
- [button] « Relire maintenant » : OK
- [switch] « (sans texte) » : OK
- [switch] « (sans texte) » : OK
- [checkbox] « in LinkedIn » : OK
- [checkbox] « IG Instagram » : OK
- [checkbox] « f Facebook » : OK
- [checkbox] « TT TikTok » : OK
- [checkbox] « YT YouTube » : OK
- [checkbox] « YS YouTube Shorts » : OK
- [button] « Ajouter » : OK

**`/reglages` — 1440 px** (84 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Changer » : OK · dialogue ouvert puis fermé
- [button] « Déconnecter » : — non cliqué (destructif)
- [button] « Écriture des scripts Prévu : Claude Essai » : OK · dialogue ouvert puis fermé
- [button] « Double (visage) Prévu : HeyGen Essai » : OK · dialogue ouvert puis fermé
- [button] « Voix Prévu : HeyGen Essai » : OK · dialogue ouvert puis fermé
- [button] « Montage Prévu : Montage sur le serveur du studio, Montage en ligne (pl » : OK · dialogue ouvert puis fermé
- [button] « Images d'illustration Prévu : Banques d'images et images fabriquées Es » : OK · dialogue ouvert puis fermé
- [button] « Étalonnage des couleurs Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Son et mixage Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Miniatures Prévu : Serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [button] « Publication Prévu : Buffer Essai » : OK · dialogue ouvert puis fermé
- [button] « Textes de publication Prévu : Claude Essai » : OK · dialogue ouvert puis fermé
- [button] « Notifications (téléphone, e-mail) Prévu : Téléphone et e-mail Essai » : OK · dialogue ouvert puis fermé
- [button] « Stockage des fichiers Prévu : Stockage en ligne Essai » : OK · dialogue ouvert puis fermé
- [button] « Calage des sous-titres Prévu : Calage sur le serveur du studio Essai » : OK · dialogue ouvert puis fermé
- [radio] « Brouillon dans Buffer Vous relisez et programmez dans Buffer » : OK
- [radio] « Programmer directement La date choisie ici part telle quelle » : OK
- [switch] « (sans texte) » : OK
- [radio] « Sans fond, posé sur vos décors » : OK
- [radio] « Fond uni » : OK
- [switch] « (sans texte) » : OK
- [button] « Modifier » : OK · dialogue ouvert puis fermé
- [radio] « 0 € Août » : OK
- [radio] « 0 € Sept. » : OK
- [radio] « 0 € Oct. » : OK
- [button] « Relever » : OK · dialogue ouvert puis fermé
- [switch] « (sans texte) » : OK
- [switch] « (sans texte) » : OK
- [button] « Retirer Accueil » : — non cliqué (destructif)
- [button] « Retirer Formations » : — non cliqué (destructif)
- [button] « Retirer Audit » : — non cliqué (destructif)
- [button] « Retirer Implémentation » : — non cliqué (destructif)
- [button] « Retirer Tarifs » : — non cliqué (destructif)
- [button] « Retirer À propos » : — non cliqué (destructif)
- [button] « Relire maintenant » : OK
- [switch] « (sans texte) » : OK
- [switch] « (sans texte) » : OK
- [checkbox] « in LinkedIn » : OK
- [checkbox] « IG Instagram » : OK
- [checkbox] « f Facebook » : OK
- [checkbox] « TT TikTok » : OK
- [checkbox] « YT YouTube » : OK
- [checkbox] « YS YouTube Shorts » : OK
- [button] « Ajouter » : OK

**`/reglages/google-drive` — 390 px** (5 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Connecter mon Drive » : OK · mène à `/reglages/google-drive?drive=relie`
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/reglages/google-drive` — 1440 px** (4 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Reconnecter » : OK · mène à `/reglages/google-drive?drive=relie`
- [button] « Déconnecter » : — non cliqué (destructif)

**`/scripts` — 390 px** (17 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Plus de filtres » : OK (navigation)
- [tab] « Scripts » : OK
- [tab] « Idées 8 » : OK (navigation)
- [tab] « Matières » : OK (navigation)
- [tab] « Ma voix » : OK (navigation)
- [button] « Nouvelle série » : OK
- [button] « TT » : OK · mène à `/ecrire?onglet=scripts&reseau=tiktok`
- [button] « IG » : OK · mène à `/ecrire?onglet=scripts&reseau=instagram`
- [button] « YS » : OK · mène à `/ecrire?onglet=scripts&reseau=youtube-shorts`
- [button] « in » : OK (navigation)
- [button] « f » : OK · mène à `/ecrire?onglet=scripts&reseau=facebook`
- [button] « Format » : OK · dialogue ouvert puis fermé
- [summary] « Légende » : OK
- [button] « Créer » : OK (navigation)
- [button] « Plus » : OK (navigation)

**`/scripts` — 1440 px** (0 éléments interactifs)


**`/scripts/script-1` — 390 px** (34 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « v1 94 » : OK
- [button] « Modifier : Vous collez vos fichiers clients dans ChatGPT ? Regardez ce » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique quoi garder pour vous, en trente secondes. » : OK
- [button] « Modifier : Un texte d'exemple, oui. Les noms de vos clients, non. » : OK
- [button] « Modifier : Selon le réglage, ce que vous envoyez peut servir à amélior » : OK
- [button] « Modifier : Sauf si ce réglage est coupé, ou avec une offre pour les en » : OK
- [button] « Modifier : Et c'est vous qui répondez des données de vos clients. » : OK
- [button] « Modifier : Retenez un geste : retirer les noms avant de coller. » : — non cliqué (destructif)
- [button] « Modifier : Et c'est le geste qu'on oublie le plus vite. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-1`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-1` — 1440 px** (32 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « v1 94 » : OK
- [button] « Modifier : Vous collez vos fichiers clients dans ChatGPT ? Regardez ce » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique quoi garder pour vous, en trente secondes. » : OK
- [button] « Modifier : Un texte d'exemple, oui. Les noms de vos clients, non. » : OK
- [button] « Modifier : Selon le réglage, ce que vous envoyez peut servir à amélior » : OK
- [button] « Modifier : Sauf si ce réglage est coupé, ou avec une offre pour les en » : OK
- [button] « Modifier : Et c'est vous qui répondez des données de vos clients. » : OK
- [button] « Modifier : Retenez un geste : retirer les noms avant de coller. » : — non cliqué (destructif)
- [button] « Modifier : Et c'est le geste qu'on oublie le plus vite. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-1`

**`/scripts/script-2` — 390 px** (48 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Vous faites sûrement cette erreur. Comme presque tout le mo » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique comment l'éviter, en trente secondes. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Un client m'a raconté exactement cette situation : 2 500 €  » : OK
- [button] « Modifier : Écrivez « règle » en commentaire, je vous envoie le modèle. » : OK
- [button] « Modifier : Et c'est exactement l'erreur que font la plupart des dirige » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-2`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-2` — 1440 px** (46 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Vous faites sûrement cette erreur. Comme presque tout le mo » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique comment l'éviter, en trente secondes. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Un client m'a raconté exactement cette situation : 2 500 €  » : OK
- [button] « Modifier : Écrivez « règle » en commentaire, je vous envoie le modèle. » : OK
- [button] « Modifier : Et c'est exactement l'erreur que font la plupart des dirige » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-2`

**`/scripts/script-3` — 390 px** (48 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Télétravail : quels outils pour l'équipe ? On me pose la qu » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Restez : la réponse tient en trois points. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Les chiffres sont clairs : neuf dossiers sur dix se jouent  » : OK
- [button] « Modifier : Envoyez cette vidéo à quelqu'un qui en a besoin. » : OK
- [button] « Modifier : Parce que, encore une fois, presque tout le monde se trompe » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-3`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-3` — 1440 px** (46 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Télétravail : quels outils pour l'équipe ? On me pose la qu » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Restez : la réponse tient en trois points. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Les chiffres sont clairs : neuf dossiers sur dix se jouent  » : OK
- [button] « Modifier : Envoyez cette vidéo à quelqu'un qui en a besoin. » : OK
- [button] « Modifier : Parce que, encore une fois, presque tout le monde se trompe » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-3`

**`/scripts/script-4` — 390 px** (48 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Neuf personnes sur dix se trompent sur ce point. Et vous ? » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant de vous lancer. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Un dirigeant de PME l'a appris à ses dépens : 135 € d'amend » : OK
- [button] « Modifier : Essayez dès lundi. Le lien est en description. » : OK
- [button] « Modifier : Et maintenant, vous savez pourquoi on se trompe autant. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-4`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-4` — 1440 px** (46 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Neuf personnes sur dix se trompent sur ce point. Et vous ? » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant de vous lancer. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Un dirigeant de PME l'a appris à ses dépens : 135 € d'amend » : OK
- [button] « Modifier : Essayez dès lundi. Le lien est en description. » : OK
- [button] « Modifier : Et maintenant, vous savez pourquoi on se trompe autant. » : OK
- [button] « Créer la vidéo » : OK

**`/scripts/script-5` — 390 px** (54 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Vous faites sûrement cette erreur. Comme presque tout le mo » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique comment l'éviter, en trente secondes. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Un client m'a raconté exactement cette situation : 2 500 €  » : OK
- [button] « Modifier : Écrivez « règle » en commentaire, je vous envoie le modèle. » : OK
- [button] « Modifier : Et c'est exactement l'erreur que font la plupart des dirige » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-5`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-5` — 1440 px** (52 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Vous faites sûrement cette erreur. Comme presque tout le mo » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Je vous explique comment l'éviter, en trente secondes. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Un client m'a raconté exactement cette situation : 2 500 €  » : OK
- [button] « Modifier : Écrivez « règle » en commentaire, je vous envoie le modèle. » : OK
- [button] « Modifier : Et c'est exactement l'erreur que font la plupart des dirige » : OK
- [button] « Créer la vidéo » : OK

**`/scripts/script-6` — 390 px** (48 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Un outil IA gratuit : un piège ? On me pose la question cha » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Restez : la réponse tient en trois points. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Les chiffres sont clairs : neuf dossiers sur dix se jouent  » : OK
- [button] « Modifier : Envoyez cette vidéo à quelqu'un qui en a besoin. » : OK
- [button] « Modifier : Parce que, encore une fois, presque tout le monde se trompe » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-6`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-6` — 1440 px** (46 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Un outil IA gratuit : un piège ? On me pose la question cha » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Restez : la réponse tient en trois points. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Les chiffres sont clairs : neuf dossiers sur dix se jouent  » : OK
- [button] « Modifier : Envoyez cette vidéo à quelqu'un qui en a besoin. » : OK
- [button] « Modifier : Parce que, encore une fois, presque tout le monde se trompe » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-6`

**`/scripts/script-7` — 390 px** (57 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Neuf personnes sur dix se trompent sur ce point. Et vous ? » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant de vous lancer. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Un dirigeant de PME l'a appris à ses dépens : 135 € d'amend » : OK
- [button] « Modifier : Essayez dès lundi. Le lien est en description. » : OK
- [button] « Modifier : Et maintenant, vous savez pourquoi on se trompe autant. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-7`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-7` — 1440 px** (55 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Neuf personnes sur dix se trompent sur ce point. Et vous ? » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant de vous lancer. » : OK
- [button] « Modifier : Gardez toujours une trace écrite. » : OK
- [button] « Modifier : Un e-mail daté vaut mieux qu'une promesse orale. » : OK
- [button] « Modifier : C'est votre meilleure protection. » : OK
- [button] « Modifier : Attention à une idée reçue tenace. » : OK
- [button] « Modifier : Ce n'est pas parce que tout le monde le fait que c'est perm » : OK
- [button] « Modifier : Le juge regarde les faits, pas les habitudes. » : OK
- [button] « Modifier : Deuxième point, souvent oublié : les délais. » : OK
- [button] « Modifier : Passé un certain temps, il est trop tard pour agir. » : OK
- [button] « Modifier : Notez la date dès le premier jour. » : OK
- [button] « Modifier : Côté employeur, la logique est la même. » : OK
- [button] « Modifier : Une règle claire évite la plupart des conflits. » : OK
- [button] « Modifier : Et elle rassure tout le monde. » : OK
- [button] « Modifier : Premier point : tout se joue avant, pas après. » : OK
- [button] « Modifier : Ce qui compte, c'est la règle écrite. » : OK
- [button] « Modifier : Et c'est là que ça devient intéressant. » : OK
- [button] « Modifier : Il y a trois cas, et un seul est vraiment risqué. » : OK
- [button] « Modifier : Le premier : tout est prévu par écrit. Aucun souci. » : OK
- [button] « Modifier : Le dernier : rien n'est dit. Là, attention. » : OK
- [button] « Modifier : Un dirigeant de PME l'a appris à ses dépens : 135 € d'amend » : OK
- [button] « Modifier : Essayez dès lundi. Le lien est en description. » : OK
- [button] « Modifier : Et maintenant, vous savez pourquoi on se trompe autant. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-7`

**`/scripts/script-8` — 390 px** (34 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « v1 91 » : OK
- [button] « Modifier : Relancer un devis par SMS. Oui, ça se fait. » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant d'envoyer. » : OK
- [button] « Modifier : Oui, si le client vous a donné son numéro pour ce devis. » : OK
- [button] « Modifier : Commencez par un e-mail, plus facile à retrouver. » : OK
- [button] « Modifier : Puis un SMS court, deux jours après au minimum. » : OK
- [button] « Modifier : Un SMS sans votre nom ni le numéro du devis passe pour une  » : OK
- [button] « Modifier : Mettez le numéro du devis dans le message. C'est un repère. » : OK
- [button] « Modifier : Parce qu'un devis sans relance, ça arrive vraiment. » : OK
- [button] « Créer la vidéo » : OK · mène à `/nouvelle/avocat?script=script-8`
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/scripts/script-8` — 1440 px** (32 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « v1 91 » : OK
- [button] « Modifier : Relancer un devis par SMS. Oui, ça se fait. » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Voici ce qu'il faut savoir avant d'envoyer. » : OK
- [button] « Modifier : Oui, si le client vous a donné son numéro pour ce devis. » : OK
- [button] « Modifier : Commencez par un e-mail, plus facile à retrouver. » : OK
- [button] « Modifier : Puis un SMS court, deux jours après au minimum. » : OK
- [button] « Modifier : Un SMS sans votre nom ni le numéro du devis passe pour une  » : OK
- [button] « Modifier : Mettez le numéro du devis dans le message. C'est un repère. » : OK
- [button] « Modifier : Parce qu'un devis sans relance, ça arrive vraiment. » : OK
- [button] « Créer la vidéo » : OK

**`/scripts/script-ref-podcast-1` — 390 px** (103 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Ajouter aux favoris » : OK
- [button] « Plus d'actions » : OK
- [button] « Modifier : Bienvenue. Aujourd'hui, une question simple : l'IA va-t-ell » : OK
- [button] « Modifier : Mon invité y répond depuis quinze ans. » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Comment tout a commencé pour vous ? » : OK
- [button] « Modifier : Qu'est-ce que les gens comprennent mal, selon vous ? » : OK
- [button] « Modifier : Au début, je n'y croyais pas du tout. » : OK

**`/scripts/script-ref-podcast-1` — 1440 px** (101 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Retirer des favoris » : — non cliqué (destructif)
- [button] « Plus d'actions » : OK
- [button] « Modifier : Bienvenue. Aujourd'hui, une question simple : l'IA va-t-ell » : OK
- [button] « Modifier : Mon invité y répond depuis quinze ans. » : OK
- [button] « Améliorer » : OK
- [button] « Plus percutant » : OK
- [button] « Plus court » : OK
- [button] « Modifier : Comment tout a commencé pour vous ? » : OK
- [button] « Modifier : Qu'est-ce que les gens comprennent mal, selon vous ? » : OK
- [button] « Modifier : Au début, je n'y croyais pas du tout. » : OK

**`/styleguide` — 390 px** (4 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/styleguide` — 1440 px** (2 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé

**`/veille` — 390 px** (6 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Vérifier » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/veille` — 1440 px** (4 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Vérifier » : OK
- [button] « Ajouter » : OK · dialogue ouvert puis fermé

**`/videos` — 390 px** (7 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir plusieurs vidéos » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos` — 1440 px** (5 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Filtres » : OK · dialogue ouvert puis fermé
- [button] « Trier » : OK
- [button] « Choisir » : OK

**`/videos/a-ranger` — 390 px** (18 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Mes données dans ChatGPT : quel risque ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Un outil IA gratuit : un piège ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Automatiser ses devis en 3 étapes Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « L'IA peut-elle remplacer mon comptable ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Factures ressaisies à la main : que faire ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Télétravail : quels outils pour l'équipe ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Ce que j'ai appris cette semaine Vidéo selfie Ranger » : OK · dialogue ouvert puis fermé
- [button] « Relancer un devis par SMS : bonne idée ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Dirigeant de PME : l'IA au quotidien Podcast type interview Ranger » : OK · dialogue ouvert puis fermé
- [button] « ChatGPT peut-il lire vos fichiers clients ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Créer un devis en 2 minutes Écran partagé Ranger » : OK · dialogue ouvert puis fermé
- [button] « L'IA va-t-elle remplacer les avocats ? Podcast type interview Ranger » : OK · dialogue ouvert puis fermé
- [button] « 3 chiffres sur l'IA en PME Motion design Ranger » : OK · dialogue ouvert puis fermé
- [button] « RGPD : 5 erreurs de PME Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/a-ranger` — 1440 px** (17 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Mes données dans ChatGPT : quel risque ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Un outil IA gratuit : un piège ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Automatiser ses devis en 3 étapes Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « L'IA peut-elle remplacer mon comptable ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Factures ressaisies à la main : que faire ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Télétravail : quels outils pour l'équipe ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Ce que j'ai appris cette semaine Vidéo selfie Ranger » : OK · dialogue ouvert puis fermé
- [button] « Relancer un devis par SMS : bonne idée ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Dirigeant de PME : l'IA au quotidien Podcast type interview Ranger » : OK · dialogue ouvert puis fermé
- [button] « ChatGPT peut-il lire vos fichiers clients ? Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Créer un devis en 2 minutes Écran partagé Ranger » : OK · dialogue ouvert puis fermé
- [button] « L'IA va-t-elle remplacer les avocats ? Podcast type interview Ranger » : OK · dialogue ouvert puis fermé
- [button] « 3 chiffres sur l'IA en PME Motion design Ranger » : OK · dialogue ouvert puis fermé
- [button] « RGPD : 5 erreurs de PME Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé
- [button] « Plannings et congés : automatiser sans erreur Vidéo type avocat Ranger » : OK · dialogue ouvert puis fermé

**`/videos/v-01` — 390 px** (47 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « ChatGPT peut-il lire vos fichiers clients ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [radio] « V1 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches 1 » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé 1 actif » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-01` — 1440 px** (45 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « ChatGPT peut-il lire vos fichiers clients ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [radio] « V1 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches 1 » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé 1 actif » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 3 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-02` — 390 px** (47 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Relancer un devis par SMS : bonne idée ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Programmée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 3 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-02` — 1440 px** (45 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Relancer un devis par SMS : bonne idée ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Programmée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 3 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 1 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK
- [button] « Publier · 1/4 ESSAI » : OK (vérifié ailleurs)

**`/videos/v-03` — 390 px** (43 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « L'IA peut-elle remplacer mon comptable ? » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-03` — 1440 px** (41 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « L'IA peut-elle remplacer mon comptable ? » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 2 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-04` — 390 px** (45 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Télétravail : quels outils pour l'équipe ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches 1 » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-04` — 1440 px** (43 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Télétravail : quels outils pour l'équipe ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches 1 » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 5 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-05` — 390 px** (46 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Mes données dans ChatGPT : quel risque ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-05` — 1440 px** (44 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Mes données dans ChatGPT : quel risque ? » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 8 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 4/4 ESSAI » : OK

**`/videos/v-06` — 390 px** (44 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Un outil IA gratuit : un piège ? » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK
- [button] « Créer » : OK · dialogue ouvert puis fermé
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-06` — 1440 px** (42 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Un outil IA gratuit : un piège ? » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 4 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 4/4 ESSAI » : OK

**`/videos/v-07` — 390 px** (13 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [radio] « Rapide » : OK (navigation)
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Script : ≈ 55 s · Vous » : OK (navigation)
- [button] « Plateau : Halo orange · Chemise noire · Assis » : OK · dialogue ouvert puis fermé
- [button] « Voix : Ma voix » : OK · dialogue ouvert puis fermé
- [button] « Style : Axion clair-obscur (v1) · Avocat » : OK · dialogue ouvert puis fermé
- [button] « Coût : Calcul en cours » : OK · dialogue ouvert puis fermé
- [button] « Voir les plans ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Fabriquer ESSAI » : OK (navigation)
- [button] « Créer » : OK (navigation)
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-07` — 1440 px** (11 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK (navigation)
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK (navigation)
- [button] « Script : ≈ 55 s · Vous » : OK (navigation)
- [button] « Plateau : Halo orange · Chemise noire · Assis » : OK (navigation)
- [button] « Voix : Ma voix » : OK (navigation)
- [button] « Style : Axion clair-obscur (v1) · Avocat » : OK · dialogue ouvert puis fermé
- [button] « Coût : Calcul en cours » : OK · dialogue ouvert puis fermé
- [button] « Voir les plans ESSAI » : OK (navigation)
- [button] « Fabriquer ESSAI » : OK (navigation)

**`/videos/v-09` — 390 px** (45 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « RGPD : 5 erreurs de PME » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 4/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-09` — 1440 px** (44 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « RGPD : 5 erreurs de PME » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 9 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK

**`/videos/v-10` — 390 px** (18 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Plannings et congés : automatiser sans erreur » » : KO→corrigé (exception lecteur)
- [button] « Plus d'actions » : OK
- [button] « Restaurer » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Historique » : OK
- [button] « Proposition 1 » : OK
- [tab] « Instagram » : OK
- [tab] « YouTube » : OK
- [button] « Créer » : OK
- [button] « Plus » : OK

**`/videos/v-10` — 1440 px** (41 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Plannings et congés : automatiser sans erreur » » : KO→corrigé (exception lecteur)
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Automatisation » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-11` — 390 px** (45 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « L'IA va-t-elle remplacer les avocats ? » » : KO→corrigé (exception lecteur)
- [radio] « 16:9 » : OK
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook Avertissement » : OK
- [tab] « YT YouTube » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram Avertissement » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts Avertissement » : OK
- [button] « Copier » : OK
- [button] « Retirer #Podcast » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Entrepreneuriat » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-11` — 1440 px** (43 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « L'IA va-t-elle remplacer les avocats ? » » : KO→corrigé (exception lecteur)
- [radio] « 16:9 » : OK
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 7 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram Avertissement » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts Avertissement » : OK
- [tab] « YT YouTube » : OK
- [tab] « f Facebook Avertissement » : OK
- [button] « Copier » : OK
- [button] « Retirer #Podcast » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Entrepreneuriat » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-12` — 390 px** (43 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Dirigeant de PME : l'IA au quotidien » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook Avertissement » : OK
- [tab] « YT YouTube » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram Avertissement » : OK
- [tab] « TT TikTok Avertissement » : OK
- [tab] « YS YouTube Shorts Avertissement » : OK
- [button] « Copier » : OK
- [button] « Retirer #Podcast » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Entrepreneuriat » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-12` — 1440 px** (41 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Dirigeant de PME : l'IA au quotidien » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 6 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram Avertissement » : OK
- [tab] « TT TikTok Avertissement » : OK
- [tab] « YS YouTube Shorts Avertissement » : OK
- [tab] « YT YouTube » : OK
- [tab] « f Facebook Avertissement » : OK
- [button] « Copier » : OK
- [button] « Retirer #Podcast » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #Entrepreneuriat » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-13` — 390 px** (45 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « 3 chiffres sur l'IA en PME » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #Chiffres » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-13` — 1440 px** (44 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « 3 chiffres sur l'IA en PME » » : KO→corrigé (exception lecteur)
- [radio] « 9:16 » : OK
- [button] « Publiée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 2 formats » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 13 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #Chiffres » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 0/4 ESSAI » : OK · dialogue ouvert puis fermé

**`/videos/v-14` — 390 px** (43 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Créer un devis en 2 minutes » » : KO→corrigé (exception lecteur)
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #Productivité » : — non cliqué (destructif)
- [button] « Retirer #Outils » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-14` — 1440 px** (42 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Créer un devis en 2 minutes » » : KO→corrigé (exception lecteur)
- [button] « Validée, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 12 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #Productivité » : — non cliqué (destructif)
- [button] « Retirer #Outils » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK

**`/videos/v-15` — 390 px** (43 éléments interactifs)

- [button] « Rechercher » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Ce que j'ai appris cette semaine » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « f Facebook » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [button] « Copier » : OK
- [button] « Retirer #Entrepreneur » : — non cliqué (destructif)
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 3/4 ESSAI » : OK · dialogue ouvert puis fermé
- [button] « Créer » : OK
- [button] « Plus » : OK · dialogue ouvert puis fermé

**`/videos/v-15` — 1440 px** (42 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK · dialogue ouvert puis fermé
- [button] « Lire « Ce que j'ai appris cette semaine » » : KO→corrigé (exception lecteur)
- [button] « À relire, changer l'étape » : OK · dialogue ouvert puis fermé
- [button] « Plus d'actions » : OK
- [tab] « Publier » : OK
- [tab] « Retouches » : OK
- [tab] « Miniature » : OK
- [tab] « Sous-titres » : OK
- [tab] « Script » : OK
- [tab] « Qui parle » : OK
- [tab] « Réglages » : OK
- [tab] « Résultats » : OK
- [tab] « Historique » : OK
- [checkbox] « Image » : OK
- [checkbox] « Son » : OK
- [checkbox] « Sous-titres » : OK
- [checkbox] « Droits » : OK
- [button] « Télécharger 1 format » : OK · dialogue ouvert puis fermé
- [button] « Lien privé Aucun » : OK · dialogue ouvert puis fermé
- [button] « Buffer Programmer ESSAI » : OK · dialogue ouvert puis fermé
- [radio] « Aucune » : OK
- [radio] « L'IA au travail en 45 s ép. 11 » : OK
- [button] « Nouvelle série » : OK
- [checkbox] « (sans texte) » : OK
- [tab] « in LinkedIn » : OK
- [tab] « IG Instagram » : OK
- [tab] « TT TikTok » : OK
- [tab] « YS YouTube Shorts » : OK
- [tab] « YT YouTube Avertissement » : OK
- [tab] « f Facebook » : OK
- [button] « Copier » : OK
- [button] « Retirer #Entrepreneur » : — non cliqué (destructif)
- [button] « Retirer #PME » : — non cliqué (destructif)
- [button] « Retirer #IA » : — non cliqué (destructif)
- [button] « Ajouter » : OK
- [switch] « (sans texte) » : OK
- [button] « Réécrire ESSAI » : OK
- [button] « Télécharger » : OK · dialogue ouvert puis fermé
- [button] « Lien privé » : OK · dialogue ouvert puis fermé
- [button] « Publier · 1/4 ESSAI » : OK

**`/videos/v-86552f50d290` — 390 px** (0 éléments interactifs)


**`/videos/v-86552f50d290` — 1440 px** (10 éléments interactifs)

- [button] « Rechercher Ctrl K » : OK · dialogue ouvert puis fermé
- [button] « Notifications, 5 nouvelles » : OK (navigation)
- [radio] « Rapide » : OK
- [radio] « Pas à pas » : OK · dialogue ouvert puis fermé
- [button] « Script : ≈ 11 s · Vous » : OK (navigation)
- [button] « Plateau : Chemise noire · Assis » : OK (navigation)
- [button] « Voix : Ma voix » : OK (navigation)
- [button] « Style : Axion naturel · Avocat · Rythmé » : OK · dialogue ouvert puis fermé
- [button] « Voir les plans ESSAI » : OK
- [button] « Fabriquer ESSAI » : OK

</details>

