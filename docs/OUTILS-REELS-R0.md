# Lot R0 — Connexions vraies (relevé)

> 03/10/2026 · branche `outils/r0` depuis `03d297b` (production) · plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md` (§2 C1-C2, §3, « R0 »).
> Aucun appel réseau, aucune dépense, aucune clé dans les processus de travail.

## Ce qui est fait

| Constat | Avant (03d297b) | Maintenant |
|---|---|---|
| C1 | L'écran fabriquait l'identifiant depuis le libellé (`idReel`) : « Remotion » → `remotion`, « WhisperX (studio-aligneur) » → `whisperx`. Choisir « le vrai » enregistrait un nom inconnu du registre : carte « À relier » pour toujours, simulation en silence. Faux choix « Plus tard » partout. | Les choix viennent du serveur, sous leur identifiant EXACT (`studio-rendu`, `studio-aligneur`, `claude`…). Chaque choix dit son coût et son état : « Relié », « À relier : un réglage manque sur le serveur » (phrase simple : aucun nom de réglage à l'écran, ordre de Will), « Pas encore disponible » (réglages posés, code pas encore livré : non cliquable), « Simulation ». Plus de « Plus tard ». |
| C1 (serveur) | `definirFournisseur` acceptait n'importe quel mot de 2 à 40 lettres. | Refuse un identifiant inconnu pour ce type (et les noms hérités de tout objet, « constructor »…). Un ancien choix inconnu déjà en base est signalé : « Ce choix n'existe plus : choisissez à nouveau » ; un choix connu, réglages posés mais code pas encore livré (ex. `buffer` avant R1), affiche « Buffer : pas encore disponible, la simulation reste active ». Le registre (`resoudreFournisseur`, `etatConnexion`) ne prend plus « constructor » pour un service relié. |
| C2 | La carte Montage ne disait pas ce qui serait vraiment monté. | Ligne « Montage réel pour : — » ; un format y figure dès que le serveur de rendu existe (`STUDIO_RENDU_URL`, `renduSimule()` faux : le moteur avocat rend alors sur le serveur) ET qu'un moteur réel est choisi pour lui (`moteur.<format>` ou `MOTEUR_<FORMAT>`), même règle que le lancement d'une fabrication. Indépendant du choix de la carte Montage (corrigé après relecture : la première version exigeait aussi le choix `studio-rendu`, à tort). |

### Fichiers

- `src/fournisseurs/catalogue.ts` (nouveau, pur) : par type, les implémentations prévues — identifiant, nom lisible, coût en mots simples, NOMS des réglages du serveur (ensembles alternatifs, interrupteurs à valeur exigée, adresses qui doivent commencer par http(s)://, comme `aligneurReel`), lot qui les livre. Les noms Remotion Lambda viennent de `VARIABLES_REMOTION_LAMBDA` (plus de copie). `reglagesManquants(impl, env)` ne lit que la présence (et le début d'une adresse).
- `src/fournisseurs/index.ts` : `optionsConnexion(type, valeurEnBase, env)` → `{ id, nom, mode, inscrit, pret, manque, cout, choisi }[]` et `choixConnu(type, id)`. Le bloc `IMPLEMENTATIONS` n'est pas touché.
- `src/services/reglages.ts` : `Connexion` porte `options` et `montageReelPour` (montage seulement) ; `reelPrevu` retiré (plus lu).
- `src/services/C-videos-publication-complements.ts` : `definirFournisseur` refuse un identifiant inconnu.
- `src/components/reglages/Connexions.tsx` : `idReel` supprimé ; `ChoixService` (une ligne pleine largeur par choix), `pastilleConnexion`, `resumeConnexion`, `ligneMontageReel`, `phraseARelier` (une seule phrase, sans nom de réglage). `components/reglages/libelles.ts` supprimé (`libelleService` n'avait plus d'appelant ; son test vérifie désormais les noms réellement servis).
- `src/app/(studio)/reglages/page.tsx` : transmet les nouveaux champs (aucune valeur de réglage).
- Finition (relecture simplicité) : titre FIXE par service (`TITRES_SERVICES` : « Étalonnage des couleurs », « Stockage des fichiers »…), indépendant du fournisseur relié ; le service relié n'apparaît que comme valeur choisie, en mots simples (« Stockage en ligne », « Serveur du studio » ; Claude, HeyGen, Buffer gardent leur nom). Plus de « (LUT) », « Cloudflare R2 », « Remotion Lambda » rendus (test rouge prouvé, puis vert). Images : « Banques d'images et images fabriquées ». `pastilleConnexion` et `resumeConnexion` dérivent de `etatOption`, seule fonction qui tranche « À relier » / « Pas encore disponible ».
- `tests/r0-connexions.test.ts` (nouveau, 25 tests) ; `tests/d3-calage.test.ts` : la connexion « Calage » porte désormais ses choix (attente élargie, le fond est inchangé) ; `tests/e2e1-console-services.test.ts` (n° 22) : vérifie les noms servis par `listerConnexions`.

## Preuves

- **Tests ROUGES prouvés sur 03d297b** : sources d'origine remises (seul le catalogue neuf, pur, laissé pour que le fichier se charge), `npx vitest run tests/r0-connexions.test.ts` → **13 échecs / 17**, dont :
  - « Montage → studio-rendu → Relié » et « Calage → studio-aligneur → Relié » (`TypeError … reading 'find'` : aucun choix réel servi) ;
  - « identifiant inconnu refusé » (`promise resolved "undefined" instead of rejecting` : `remotion` accepté) ;
  - « liste à 390 px » (phrase « À relier » absente) ;
  - « le code ne fabrique plus d'identifiant » (`idReel`, « Plus tard » présents) ;
  - « carte Montage » (`montageReelPour` absent) ; « catalogue ⊇ registre » (`optionsConnexion is not a function`).
  Les 4 tests verts sur l'ancien code portent sur le catalogue pur seul. Puis le code R0 remis → 17/17 verts.
  Un défaut trouvé à la relecture (`id in objet` acceptait « constructor ») a son test (rouge avant correction).
- **Relecture (exactitude, simplicité) : 6 rouges de comportement prouvés sur le premier état du lot (206c0c0…48d6ad6)**, puis verts :
  - montage : serveur de rendu + `moteur.avocat`, carte en Simulation → `expected [] to deeply equal [ 'Type avocat' ]` ;
  - choix prêt mais pas encore livré → « Ce choix n'existe plus » affiché à tort (2 tests) ;
  - adresse du calage sans http(s):// → jugée « prête » (`expected [] to deeply equal [ 'STUDIO_ALIGNEUR_URL' ]`) ;
  - « constructor » en base / dans `FOURNISSEUR_SCRIPT` → `resoudreFournisseur` renvoyait `Object` au lieu de la simulation ;
  - point 10 : `expected '<p class=…' not to match /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/` (noms de réglages rendus à l'écran).
- `npx tsc --noEmit -p .` = 0 (après `npx next typegen`, types de routes seulement ; ni `next build` ni `next dev`).
- `npx eslint` sur les fichiers touchés = 0. (`prettier --check` n'a pas de portée ici : le fichier d'origine 03d297b ne passe déjà pas ; aucune réécriture de format.)
- `npx vitest run --maxWorkers=2` complet : premier état **145 fichiers, 1 971 tests verts**, 1 ignoré. Après relecture (1 980 tests) : **1 974 verts + 5 dépassements du délai de 5 s** (machine à 100 % de processeur, 24 processus des autres lots, durée 780 s contre 442 s) dans 5 fichiers qui n'utilisent ni les connexions ni le catalogue (`e2e1-moteur-02`, `e2e1-restes-18`, `e2e2-gen-fabriquer-version`, `e2e2-gen-tu`, `g4-service`) ; relancés seuls avec `--testTimeout=60000` : **18/18 verts**. À repasser au complet à l'intégration, machine calme.
- Sécurité : test « aucune valeur de clé ne sort » — avec 8 réglages marqués, ni la liste envoyée au navigateur, ni la feuille, ni la liste rendue ne contiennent une valeur ni ses 4 derniers caractères. Seuls des NOMS de réglages partent dans les données, et AUCUN n'est rendu à l'écran (test « aucun nom de variable en majuscules », toutes cartes « À relier »).
- Aucune dépense : garde « choisir `claude` puis lister = 0 appel réseau » (`fetch` espionné ; garde, pas preuve nouvelle : ce chemin n'appelait déjà rien) ; plus le choix par `FOURNISSEUR_SCRIPT=claude` (option choisie, « Relié »).
- studio-rendu, briques et moteurs non touchés : démo M4 sans objet.

## Points d'intégration pour les autres lots

Chaque lot ajoute UNE ligne dans `IMPLEMENTATIONS` (`src/fournisseurs/index.ts`) ; le catalogue décrit déjà son service, l'écran le montrera « Relié » dès qu'il est inscrit. Rien à changer dans `catalogue.ts` tant que l'identifiant et les noms de réglages restent ceux-ci :

| Lot | Type → identifiant | Réglages du serveur (noms) |
|---|---|---|
| R1 | `publication` → `buffer` | `BUFFER_API_KEY` |
| R2 | `texte-reseaux` → `claude` | `ANTHROPIC_API_KEY` |
| R3 | `notification` → `web-push-email` | `VAPID_PUBLIQUE` + `VAPID_PRIVEE` + `VAPID_SUJET`, OU `EMAIL_SECOURS_CLE` + `EMAIL_SECOURS_EXPEDITEUR` + `EMAIL_SECOURS_DESTINATAIRE` |
| R4 | `miniature` → `studio-rendu` | `STUDIO_RENDU_URL` |
| R5 | `etalonnage`, `son` → `studio-rendu` | `STUDIO_RENDU_URL` |
| R6 | `alignement` → `studio-aligneur` (déjà inscrit) | `STUDIO_ALIGNEUR_URL` |
| R7 | `visage` → `heygen` ; `voix` → `heygen` (déjà inscrite) | `HEYGEN_API_KEY` ; visage : aujourd'hui aussi `FOURNISSEUR_VISAGE=heygen` (Looks B1 écrits et éteints) |
| — | `montage` → `studio-rendu`, `remotion-lambda` ; `script` → `claude` ; `stockage` → `r2` ; `illustration` → `reel` (déjà inscrits) | voir `catalogue.ts` |

- Si un lot change une condition d'inscription (ex. R7 retire l'exigence `FOURNISSEUR_VISAGE=heygen`), il met à jour l'entrée du catalogue dans le même commit. Le test « toute implémentation INSCRITE est décrite au catalogue » rougit si un lot inscrit un identifiant non catalogué ; le test « env.exemple » rougit si un nom de réglage cité manque à `deploiement/env.exemple`.
- Les tests R0 ne supposent jamais qu'un service d'un autre lot est absent du registre : ils resteront verts après R1-R8.
- Pour savoir si un service est vraiment actif côté serveur : `etatConnexion(type, valeurEnBase) === "relie"` (inchangé) ; pour l'écran : `optionsConnexion`.

## Restes

- Captures d'écran 390 px et bureau : à faire à l'intégration (pas de `next dev` ici, consigne) ; la mise en page est vérifiée par rendu (lignes pleine largeur, `min-w-0` + `truncate` dans la liste, détail qui revient à la ligne dans la feuille).
- Écart assumé : une adresse du calage mal écrite (sans http(s)://) est dite « un réglage manque » (elle est présente mais inutilisable) ; seule `STUDIO_ALIGNEUR_URL` est jugée sur son format, comme à l'inscription (`STUDIO_RENDU_URL` ne l'est pas à l'inscription, donc pas ici non plus).
- En production aujourd'hui, `BUFFER_API_KEY` est posée : la feuille « Publication » montrera « Buffer — Pas encore disponible » jusqu'à l'arrivée de R1 (vrai : le code d'envoi n'existe pas encore). Même chose pour les notifications si les réglages e-mail sont posés, jusqu'à R3.
- R8 : l'interrupteur `moteur.avocat` reste sans écran (prévu au lot R8) ; la carte Montage dit déjà la vérité sur son effet.
- Will : rien.
