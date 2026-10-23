# Journal du lot D « Parcours et agent monteur » — 09/10/2026 (session cloud, branche `feat/facecam-d`)

Référence : `PLAN-FACECAM-v4.md` (§ C parcours cible, § D lot D, B.11 à B.14, B.16, B.25 à B.27, correctif motion et précision « Discuter avec mon monteur »). Branche créée depuis `origin/feat/facecam` (lot A), qui y a été refusionnée en cours de route. Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché.

## Ce qui est fait

### 1. Agent monteur, module PUR (`src/moteurs/montage-facecam/monteur/`)
- `operations.ts` : schéma Zod de l'`OperationMontage` étendue au face caméra : `ajouterCarte{modele|html}`, `zoom`, `ecranPartage`, `miseEnPage{cote|vignette}`, `couleurs`, `son`, `masquerPersonne`, `texteDerriere`, `vitesse`, `arretImage`, `titre`, `generique`, plus `couper`, `retablir`, `retirer`. Union en `anyOf`, objets fermés (sortie structurée). Les opérations sont calées sur un **index de mot** de la transcription (le code calcule les secondes : « calé sur le mot exact »).
  - `lireReponseMonteur` relit la réponse **opération par opération** : une opération mal formée n'emporte pas les autres ; **vocabulaire ouvert** : une opération inconnue qui porte un texte devient `ajouterCarte` sur mesure.
- `role.ts` : rôle `monteur-facecam` (Opus, effort `high`, 16 000 jetons) — UN appel, sans outils ; reçoit la transcription horodatée (index, temps monté, mots retirés marqués), les coupes, les éléments posés, les consignes, le fil, les habitudes, « Mes animations » et le catalogue. Rôle `relecture-facecam` (Sonnet, liste fermée de défauts, corrections en opérations). `reglesFixes` = **version simple** par mots-clés (modèles fixes, aucun HTML, aucun appel). `ancreConsigne` : « à 0:32 », « quand je dis Certifexemple », ou juste après la consigne dite.
- `appliquer.ts` : application **pure** (nouvel état, rien modifié en place), grammaire imposée (zoom flou 2 au plus → punch-in, zoom lent 3 %/s, entrée d'écran partagé 9 images, cartes 3-8 s, titre plein écran jamais automatique, vitesse 0,5-2, arrêt 0,5-4 s, générique 2-8 s), **détourage seulement sur demande**, code HTML des cartes sorti vers R2 (le document ne garde que la clé). Chaque passage garde son **ancre dans la prise** (`recalerPassages` après une coupe rétablie). `annulerConsigne` défait une consigne sans toucher aux autres (traces par consigne).
- `agent.ts` : `piloterMonteur` — plafond atteint → version simple **sans aucun appel Claude** (ni relecture), avec « Plafond du mois atteint — relever ? » ; sinon 1 appel ; réponse inutilisable ou refus (plafond, crédit, panne) → version simple sans second appel ; relecture des images **1 correction au plus**, jamais de seconde relecture ; bords ratés → variante sans détourage (`sansDetourage`) et `EtatFacecam.EffetRate`.
- `detourage.ts` : plaque vide (filmée, sinon médiane si la couverture ≥ 97 %, sinon on le dit), demande `/segmenter` limitée aux secondes demandées (MediaPipe affiné par la plaque), seuils des bords, `deciderEffets`, « Effet non réussi — Réessayer ». Pas de RVM ni MatAnyone.
- `temps.ts` : prise ↔ vidéo montée, « 3 passages retirés · 2:11 → 1:34 ».
- `catalogue.ts` : catalogue constant (consigne de Claude, règles fixes, « Que puis-je demander ? »).

### 2. Services (serveur)
- `src/services/monteur-facecam.ts` : fil « Discuter avec mon monteur » (chaque message = **nouvelle version** via `lancerRetouche`, sans confirmation ; fil borné à 120 messages), Annuler une consigne, Coupes (Rétablir / Retirer), Retoucher l'image (3 crans + « Garder pour les prochaines vidéos »), retirer un élément, réessayer un effet, Revenir à la version d'avant (`parentVersionId` + `choisirVersion`), Mes habitudes, Mes animations (« Garder ce modèle » : index léger dans les paramètres, code sur R2), Réglages › Mon monteur (total du mois et plafond, « Relever »), json.gz sur R2 (repli mémoire en simulation), **points de branchement de la chaîne** : `monteurPourFabrication` et `relireImagesControle`.
- `src/services/envoi-facecam.ts` : réception d'une vidéo envoyée depuis l'iPhone (prise rangée sous sa version par `enregistrerPrise`, demande écrite → consigne, montage lancé seul par `monterJeLis` ; s'il ne peut pas partir, la vidéo reste reçue et la raison est dite).
- `src/services/plafond-claude.ts` : `plafondClaudeDuMoisAtteint()` (lu avant tout appel).
- `src/domaine/facecam-parcours.ts` (pur) : contrôle du fichier (réduit par iOS, trop court, vertical), analyse du début, 4 étapes parlantes, « Prête vers 14 h 20 », textes de notification prête / échec, pictogrammes de l'iPad.

### 3. Écrans (mobile d'abord, 390 px, charte du studio, aucun prix hors Réglages)
- `/envoyer/[varianteId]` (`EnvoiIphone`) : « Envoyer ma vidéo de : <titre> », 2 touchers, contrôle du fichier avant l'envoi, coup d'œil à la luminance du début, Wake Lock (repris au retour sur l'onglet), pause / reprise (« Envoi en pause à 63 % — Reprendre », reprise auto au retour du réseau), demande facultative au clavier ou au micro.
- Accueil : `RappelsEnvoi` (envoi en pause, vidéos face caméra à envoyer ; rien sinon).
- iPad (`lire/[varianteId]`) : `DepartIpad`, 4 pictogrammes et « C'est parti », pour le face caméra seulement.
- Fiche vidéo face caméra : `AttenteFacecam` (4 étapes parlantes, « Prête vers », « Vous pouvez fermer », notifications du téléphone allumées une fois, Arrêter sans montant, Réessayer) ; `VotreVideoFacecam` (« N passages retirés · avant → après », « J'ai compris N consignes » + Annuler, effets ratés + Réessayer, feuilles facultatives Coupes / Retoucher l'image / Cartes / Sous-titres / Version d'avant) ; `FilMonteur` ; barre « **Valider et publier** » ; montants masqués.
- Réglages › Mon monteur (`MonMonteur`), visible quand le format passe en `actif`. Bibliothèque › Mes animations (`/bibliotheque/animations`), tuile visible dès qu'une animation est gardée ou au passage en `actif`.

## Fichiers communs touchés (ajouts facultatifs : absents, rien ne change)
- `src/services/fabrication.ts` : `lancerRetouche(…, { entrees? })` (entrées de la nouvelle version) ; `plafondClaudeAtteint` rempli dans la commande **pour `facecam` seulement** (demandé par le journal du lot A).
- `src/fournisseurs/claude/client.ts` : `messages[].images?` (blocs image avant le texte) ; `src/generateur/roles/types.ts` : `EntreeRole.images?` (+ ≈ 1 600 jetons par image dans le pire cas). Sans images : corps de requête identique (tests g0 verts).
- `src/components/publication/BarreActionsVideo.tsx` : prop facultative `libellePublier` (défaut « Publier »).
- `src/app/(studio)/videos/[id]/page.tsx` : branche `facecam` (vue « Votre vidéo », attente, chiffres de coût retirés, « Demander une modification » remplacée par le fil) ; inchangée pour les autres formats.
- `src/app/(studio)/page.tsx` (rappels d'envoi), `src/app/(studio)/reglages/page.tsx` (section « Mon monteur » si facecam actif), `src/app/(studio)/bibliotheque/page.tsx` (tuile « Mes animations »), `src/app/(studio)/ecrire/sujets/[id]/lire/[varianteId]/page.tsx` (écran de départ si facecam).
- Aucun fichier de `studio-rendu`, `studio-aligneur`, `deploiement/`, formats, moteurs/index ou types de domaine.

## Tests
- `tests/facecam-monteur.test.ts` (9 tests, gardés : **plafond atteint → aucun appel Claude ni relecture, la vidéo sort** ; refus « plafond » pendant l'appel → version simple sans second appel ; **JSON de l'agent validé** (schéma en sortie structurée, relecture opération par opération, vocabulaire ouvert, calage au mot, code HTML vers R2, détourage refusé sans demande, réponse inutilisable → règles fixes) ; relecture à 1 correction et bords ratés ; Annuler ; résumé des coupes).
- Non-régression (suite Vitest complète, cloud) : 2 968 réussis, 3 échecs, tous **sans lien avec le lot D** :
  - `tests/g7a-programmer.test.ts` : déjà rouge avant le lot A (journal du lot A) ;
  - `tests/e2e-verif1-bc-serie.test.ts` (2 tests) : dépassement de 5 s, **aussi rouge sur `origin/feat/facecam` seul** dans ce conteneur (vérifié dans un arbre de travail séparé).
  - Un 4ᵉ échec trouvé par la suite (`c1-argent-b6-confirmation` : `confirme: true` écrit en dur dans `envoi-facecam.ts`) a été **corrigé** : l'accord vient de `accordDuFormat` côté serveur.
- `tsc --noEmit` : propre hors `studio-rendu/` (dépendances Remotion absentes dans le cloud) et types générés par `next typegen` (`RouteContext`, `LayoutProps`), comme au lot A.

## Ce qui reste
- **Chaîne vidéo (lot B)** : appeler `monteurPourFabrication` une fois la transcription posée (les consignes de `versConsignesFacecam`, état « comprise », sont exactement ce que le monteur attend) et brancher `relireImagesControle` dans `creerMoteurMontageFacecam({ relire })` avec les images de contrôle ; faire une vraie `retoucher()` qui relit `entrees.facecam` + `entrees.facecamMonteur` (passages, image, coupes rétablies et demandées, son, teinte) puis passer `capacites.retoucheParPlan` à `true` : **tant que ce n'est pas fait, le fil et les feuilles sont refusés hors démo (`RETOUCHE_INDISPONIBLE`)**.
- **Lot C** : rendre les passages posés (`PassageMonteur.operation`) ; correspondances : `CodeCarte.timeline` → `ProprietesCarteSurMesure.js`, `disposition "ecran-partage"` → `"moitie-haute"`, modèles identiques à `IdModeleMotion` ; une carte sur mesure sans code (`modele: null, html: null`) se compose depuis sa description ou retombe sur un modèle fixe. Aperçu animé des « Mes animations » quand GSAP local existe (aujourd'hui : image fixe, sans script).
- Analyse automatique des 3 premières secondes côté serveur (route `/visages` sur les 3 s) → `analyserDebut` ; aujourd'hui seule la luminance est regardée dans le navigateur.
- Avant/après glissé dans « Retoucher l'image » (il faut une image avant/après rendue par `/image`).
- Notification face caméra : `notificationFacecam` est prête ; `travaux.ts` notifie déjà prête et échec avec ses propres mots (à remplacer pour facecam si souhaité).

## Points d'attention pour l'intégration
- `entrees.facecamMonteur` est une clé SŒUR de `entrees.facecam` : `lireEntreesFacecam` (lot A) reconstruit l'objet et ignorerait des champs ajoutés dans `facecam`. Les passages posés par le monteur portent des champs en plus (`origine`, `ancre`, `operation`, `detourage`, `sansDetourage`) ; ne pas les filtrer en relisant `passages`.
- États des consignes : « comprise » = repérée, à interpréter ; le monteur la passe à « appliquee » ou « non-comprise » ; « annulee » après Annuler.
- Les appels du monteur passent par `executerRolePourVideo` : ils comptent dans le **plafond par vidéo des textes** (`claude.plafondKitUsd`, 0,30 $ par défaut), partagé avec les textes de publication. Un tour Opus avec carte sur mesure peut dépasser 0,30 $ : prévoir un plafond par vidéo propre au monteur ou relever ce réglage avant la mise en ligne (sinon : version simple).
- Fil, habitudes, animations et look sont des paramètres (`facecam.fil.<videoId>`, `facecam.habitudes`, `motion.animations-gardees`, `facecam.look`) : petits, bornés.
- Le plafond du mois est en dollars (`claude.plafondMensuelUsd`) et montré en euros dans Réglages › Mon monteur.
