# 51 · Tâches — 19 lots livrables en PR indépendantes (L1-L18, L9 scindé en L9a/L9b) + L4 bis conditionnel

Plan de référence : `50-PLAN-ARCHITECTE.md` (2ᵉ passe, après `60-CRITIQUE`). Dépôt `studio-axion-ia`, branches `image-video/<lot>` partant d'`origin/master` (0b427109 au 14/10 soir).

**Changements de la 2ᵉ passe** : L1 (extracteur `chiffresDe`, `offre`, formules absolues, photos, fixture figée) · L2 (zoom 0,8-1,6, taille effective, scène « Ensemble ») · L4 (aucun son nouveau ni type modifié : rattachement aux 5 déclencheurs ; L4 bis conditionnel) · L5 (tuiles, conversion PNG, refus) · L6 (question de commentaire, situation type, priorité des règles, chapitres détachables ; mode « deux vidéos » retiré) · L7 (test React corrigé) · L9 scindé en L9a/L9b (12 micro-objets à dessiner, scène « Ensemble ») · **L10 remplacé** (rendu fidèle à la prod ; plus d'opération nouvelle) · L11 (rythme sans la caméra) · L12 (piste voix seule gardée, version courte) · L13 (écoute et fin sur la voix seule, extraction existante) · L14 (`planDesFinsIV` à 5 réseaux, LinkedIn muet, plafonds par réseau) · L15 (validation de carte 10 premières vidéos) · L18 (plafonds de dépense).

**Règles communes à tous les lots**
- Une PR par lot, **jamais fusionnée sans Will**.
- Tests, vérification des types et build **en routine cloud**, jamais sur le PC.
- Aucune dépense : clés absentes, doubles de simulation.
- Agents **Opus** pour le difficile, **Sonnet** pour le reste, **jamais Haiku**.
- Avant chaque PR : `ListAgents`, puis `SendMessage` aux sessions voisines (axion-ia-43 cas concret, axion-ia-ca interface claire, axion-ia-17 mises en ligne du studio), puis `gh pr diff --name-only` des PR ouvertes pour éviter tout fichier commun.
- Fichiers **interdits en écriture** :
  - `src/briques/fins/banque.ts` (et tout `src/briques/fins/**`) ;
  - `src/moteurs/montage-cas-concret/**` (dont `recette-voix.ts`) ;
  - `src/formats/cas-concret/**`, `src/services/cas-concret*.ts`, `src/components/formats/cas-concret/**` ;
  - `studio-rendu/compositions/cas-concret/**` et `studio-rendu/compositions/interface-claire/**` ;
  - `src/formats/facecam-animee/**`, `src/moteurs/montage-facecam-animee/**`, `src/domaine/facecam-animee/**`, `tests/facecam-animee/**`, `scripts/essai-realisateur.ts` ;
  - **ajoutés (critique)** : `src/domaine/types.ts` (dont `DeclencheurBruitage`), `src/briques/intensite/**`, `src/components/intensite/SonDuPlan.tsx`, `src/donnees/generateur/modeles-will.ts` (le mot « machine » y est signalé à la session propriétaire, pas corrigé par nous) ;
  - `src/donnees/bruitages.ts`, `outils/bruitages/fabriquer.mts`, `public/bruitages/manifeste.json` : seulement au lot L4 bis, s'il a lieu, après accord des sessions voisines ;
  - les 5 fichiers de raccord, sauf au lot L17.
- Chaque `.tsx` de `studio-rendu` commence par `import React from "react";` et n'évalue aucun JSX au niveau module.
- Tests dans `tests/image-video/` (nouveau dossier). Tous **déterministes** : aucune date, aucun hasard, aucun ordre d'objet non trié.

Légende des dépendances : « ← Lx » = attend la fusion de Lx. « ⟂ » = dépend d'une autre session.

---

## Vague 1 — fondations pures (parallélisables)

### L1 · Carte de l'image : contrat, chiffres, contrôles, complexité, durée
- **Fichiers** : `src/domaine/image-video/carte.ts` (zod `carte-image/1`, avec `offre`, `automatisation`, `phraseChocValidee`, `formulesAbsolues`, `photoPersonnes`, `ajoutWill`), `src/domaine/image-video/chiffres.ts` (**`chiffresDe` → `{ brut, valeur, unite }`**, I1), `src/domaine/image-video/formules.ts` (liste des formules absolues + proposition prudente), `src/domaine/image-video/complexite.ts` (U, C, B, D, N → classe, cible, fourchette, mots, chapitres avec `essentiel`), `src/domaine/image-video/plafonds.ts` (table des plafonds par réseau et règle en 4 cas du § 3), `src/domaine/image-video/icones.ts`, `tests/image-video/carte.test.ts`, `tests/image-video/chiffres.test.ts`, `tests/image-video/fixtures/cartes/{A..F}.json`, `tests/image-video/fixtures/cartes/faux-16-noeuds.json` (figé, M5).
- **Dépend de** : rien.
- **Modèle** : Opus.
- **Acceptation** :
  - les 6 cartes passent le schéma ; types recalculés : A, B → benefices ; C → embranchement ; D → entonnoir ; E, F → avant-apres ; classes : A, B → simple ou moyenne ; C → branches ; D, E, F → moyenne ;
  - `chiffresDe` rend brut/valeur/unité justes sur toutes les chaînes des 6 images : « 23h14 », « 24h/24 », « 4 sec », « 80 % », « 19 min/commande », « 20 cmd/jour », « 6h », « 45 sec », « 2h », « 3 secondes », « 23 min », « 1er jour », « 0 demande perdue » ;
  - formules absolues repérées : F « Zéro erreur » / « risque erreur : zéro », C « 0 demande perdue », A « dès le premier jour » / « dès le 1er jour », D « 0 question sans réponse » — chacune avec une proposition ;
  - A : la photo est marquée `photoPersonnes` ; A, B : `offre` = formation ; C-F : `automatisation: true` ;
  - le faux schéma figé à 16 nœuds et 3 branches donne « très complexe », 3 chapitres, toujours les mêmes (lancé 20 fois), au moins un chapitre non essentiel ;
  - plafonds : 58 s TikTok → livrée ; 66 s TikTok → mention ; 74 s TikTok → version courte demandée ; 91 s Facebook → jamais livrée telle quelle ;
  - cohérence : F signale « 19 × 20 = 6 h 20 ≠ 6 h » sans rien corriger ; D valide 16 + 4 = 20.
- **Test** : vitest (routine cloud).

### L2 · Types purs du motion de schéma + disposition sur la toile + trajectoire de caméra
- **Fichiers** : `src/briques/schema-motion/types.ts`, `disposition.ts` (couches par profondeur, colonnes par branche ; + **disposition réduite « Ensemble »** à l'échelle d'un écran), `camera.ts` (avance 0,2-0,3 s, courbe douce, vitesse ≤ 1,2 écran/s, **zoom 0,8-1,6**, plus de dézoom d'ensemble), `lisibilite.ts` (**taille effective = taille × zoom ≥ plancher**, B3), `index.ts`, `tests/image-video/disposition.test.ts`, `tests/image-video/camera.test.ts`.
- **Dépend de** : L1 (types de la carte). Peut démarrer sur une copie des types, puis se rebaser.
- **Modèle** : Opus.
- **Acceptation** :
  - aucun chevauchement de boîtes sur C, D, E, F et sur le faux schéma à 16 nœuds, à l'échelle toile comme à l'échelle « Ensemble » ;
  - branche majoritaire à gauche, en orange ;
  - le nœud parlé est entièrement dans le cadre à l'heure de son mot ;
  - aucune vitesse ni aucun zoom hors bornes ; aucun texte lisible sous le plancher effectif à aucun instant ;
  - la disposition « Ensemble » ne porte aucun texte de plus de 3 mots (pastilles, chiffres-clés) ;
  - module pur, importable par `studio-rendu`.
- **Test** : vitest.

### L3 · Fichier d'emprunts épinglé
- **Fichiers** : `src/moteurs/montage-image-video/emprunts.ts` (ré-exports du § 0.3 corrigé : **sans `planDesFins` ni `nombresDe`**), `tests/image-video/emprunts.test.ts` (épingle : `texteAvecNombres`, `controlerFinDeVoix` sur un WAV synthétique, `finPour("linkedin")` sans appel à commenter, présence et `dit` des lignes `fin-if-question`, `fin-ty-question-tache`, `fin-ty-lien-profil` (Shorts compris), `fin-li-*` à `dit: ""`, `MOTS_INTERDITS_FORMAT`, `DECLENCHEUR_DE`, type `Offre`).
- **Dépend de** : ⟂ axion-ia-43 (prévenir : liste des symboles importés, aucune modification demandée).
- **Modèle** : Sonnet.
- **Acceptation** : l'import ne crée aucun cycle ; les tests rougissent si l'un des symboles ou l'une des lignes de banque lues change.
- **Test** : vitest.

### L4 · Bruitages : rattachement aux déclencheurs existants + règles de pose (aucun son nouveau)
- **Fichiers** : `src/moteurs/montage-image-video/bruitages.ts` (sortes `separation`, `camera`, `chute`, `frappe`, `coche`, `alerte` + sortes v4 ; table `DECLENCHEUR_IV` → les 5 déclencheurs existants ; pose d'après les événements de la ligne de temps, patron `poserBruitages` ; seuls les sons validés reçus), `tests/image-video/bruitages.test.ts`.
- **Dépend de** : rien. **Ne touche ni `domaine/types.ts`, ni `briques/intensite/**`, ni `donnees/bruitages.ts`, ni `SonDuPlan.tsx`, ni `fabriquer.mts`, ni le manifeste.**
- **Modèle** : Sonnet.
- **Acceptation** :
  - chaque sorte se résout vers un `DeclencheurBruitage` existant (test exhaustif, compile sans modifier le type) ;
  - au moins 1 son par changement visible (définition de Q14) sur les 6 lignes de temps d'essai ;
  - jamais deux sons à moins de 0,1 s ; clôture 1,5 s avant la fin ; aucune piste de musique ;
  - aucun son validé reçu → refus explicite (« aucun bruitage validé »), jamais une vidéo muette livrée.
- **Test** : vitest, plus écoute par Will des **20 sons existants** dans la Bibliothèque (question n° 2 de `52`).

### L4 bis · (conditionnel) Variantes nouvelles sous les déclencheurs existants
- **Seulement si** l'écoute de Will juge qu'un moment (séparation, chute, coche, alerte, souffle de caméra, frappe) n'a pas de son juste.
- **Fichiers** : `outils/bruitages/fabriquer.mts` (recettes de variantes 5, 6… sous le même déclencheur), `public/bruitages/{declencheur}-{5..}.wav`, `public/bruitages/manifeste.json` (ajout seul), `src/donnees/bruitages.ts` (ajout seul dans `SONS_BANQUE`). Jamais de déclencheur nouveau.
- **Dépend de** : L4 + écoute de Will. ⟂ axion-ia-43 et axion-ia-17 (fichiers communs ; accord et ordre de fusion avant d'écrire).
- **Modèle** : Sonnet.
- **Acceptation** : manifeste valide (niveaux, CC0) ; nouvelles variantes « à vérifier » ; aucun autre fichier modifié ; Will les écoute.

---

## Vague 2 — lecture et écriture (Claude, en simulation)

### L5 · Lecteur d'image : préparation, double lecture vision, fusion, écarts, refus
- **Fichiers** : `src/moteurs/montage-image-video/lecture/preparation.ts` (**conversion en PNG** de tout format reçu ; **4 tuiles ×2** avec 10 % de recouvrement ; refus si < 800 px de côté), `lecture/consigne.ts`, `lecture/index.ts` (2 appels indépendants : image entière + tuiles ; zod ; fusion par le code ; écarts ; alertes ; **refus** si < 3 textes lus ou type reconnu par aucune lecture ; photos de personnes repérées), `lecture/simulation.ts`, `tests/image-video/lecture.test.ts`.
- **Dépend de** : L1, L3.
- **Modèle** : Opus.
- **Acceptation** :
  - en simulation, les 6 images redonnent exactement les cartes attendues ;
  - une lecture B modifiée (« 4 sec » → « 4 min ») produit un écart visible ;
  - image de 600 px, image sans texte, type inconnu → refus avec une phrase simple (« Je ne reconnais pas ce type d'image : choisissez-le ») et possibilité pour Will d'imposer le type ;
  - un WebP en entrée part en PNG vers Claude (`ImageClaude` = JPEG/PNG) ;
  - prix réservé avant l'appel (`pireCasUsd`) ; aucun appel réel dans les tests ; nom de fichier jamais transmis à Claude.
- **Test** : vitest. Lectures réelles seulement après accord de dépense de Will (étape 1, plafond 2 €).

### L6 · Fiche et recettes par type, écriture du script, règles bloquantes
- **Fichiers** :
  - `src/domaine/image-video/fiche.ts` (zod `fiche-image/1` : parties, scènes, refs, `surMot`, fonds, 2 accroches, **`questionCommentaire`**, chapitres avec `essentiel`) ;
  - `src/moteurs/montage-image-video/recettes.ts` (8 types, ossature unique ; « situation type » obligatoire si automatisation ; chapitres non essentiels détachables) ;
  - `ecriture.ts` (1 appel Opus, ≤ 2 avec relance guidée ; `blocsSocleWill` + `EXEMPLE_TON_V4` via `emprunts.ts`, **avec la consigne de ne jamais reprendre le mot « machine »** présent dans un exemple de ton) ;
  - `regles.ts` (Q04-Q10 + Q05 bis + Q08 bis ; **ordre de priorité I9** : interdits > formules absolues > mot pour mot > rien d'inventé ; ajouts de Will acceptés comme source) ;
  - `ecriture.simulation.ts` (scripts A-F de `40-SCRIPTS…`, complétés de leur question et de l'annonce « situation type ») ;
  - `tests/image-video/ecriture.test.ts`.
- **Dépend de** : L1, L3.
- **Modèle** : Opus.
- **Acceptation** :
  - les 6 scripts de simulation passent toutes les règles ;
  - un script qui oublie « quatre secondes » (C) est refusé ; qui ajoute « 30 % » est refusé ; mais « 30 % » ajouté par Will est accepté et marqué ;
  - la phrase-choc modifiée d'un mot est refusée ; une phrase-choc contenant « machine » est refusée **même mot pour mot**, avec une reformulation proposée ;
  - F : « Zéro erreur » non tranché → bloquant ; tranché « garder » ou « reformuler » → passe ;
  - C-F sans « situation type » → refusé ;
  - question de commentaire : > 12 mots, avec un mot à commenter ou un lien → refusée ;
  - « machine », « Martin » sans « par exemple » → refusés ;
  - les durées estimées tombent dans la classe ; mode très complexe : chapitres « 1/3 », « 2/3 », « 3/3 », un chapitre non essentiel qui ne renvoie à rien après lui ;
  - le mode « deux vidéos » n'existe pas dans cette version (rejet explicite du réglage).
- **Test** : vitest.

---

## Vague 3 — composants de rendu (galerie sans dépense)

### L7 · Composants Remotion 1 : toile, caméra, nœud, flèche, embranchement
- **Fichiers** : `studio-rendu/compositions/image-video/{Toile,Camera,Noeud,FlecheCourbe,Embranchement}.tsx`, `studio-rendu/compositions/image-video/Compositions.tsx` (`ImageVideoScene` + `ImageVideoGalerie`, **non inscrites dans `Racine.tsx` avant L17**), `tests/image-video/react-module.test.ts` (**refuse tout JSX évalué au niveau module dans un `.tsx` sans import React** ; bundle le dossier en `jsx: "transform"` sans typescript et le charge sans `globalThis.React`).
- **Dépend de** : L2.
- **Modèle** : Opus.
- **Acceptation** :
  - le test React rougit sur un fichier piège (constante JSX au niveau module, sans import) et passe sur notre dossier ;
  - images fixes de l'image C à 6 instants (entrée, séparation, branche A, retour, branche B, scène « Ensemble ») **rendues depuis le paquet de L10** et déposées dans le Drive de vérification ;
  - charte v4 (Anton, deux fonds, un mot orange) ; import seul du socle `cas-concret/socle` et d'`interface-claire` ; aucun fichier hors du dossier.
- **Test** : vitest + images fixes (via L10).

### L8 · Composants Remotion 2 : entonnoir, nuée, écran partagé, additionneur
- **Fichiers** : `studio-rendu/compositions/image-video/{Entonnoir,Nuee,EcranPartage,Additionneur}.tsx`.
- **Dépend de** : L7.
- **Modèle** : Sonnet (relecture Opus de la mise en mouvement).
- **Acceptation** : images fixes des images D, E et F aux instants clés ; 20 enveloppes, dont 16 cochées en cascade ; 8 + 6 + 5 = 19 posé sur son mot.
- **Test** : idem L7.

### L9a · Composants Remotion 3 : bénéfices, bandeau, repère, recherche, alerte, e-mail, dossiers, sources, phrase-choc, **Ensemble**
- **Fichiers** : `studio-rendu/compositions/image-video/{CarteBenefice,BandeauChiffres,RepereChapitre,Recherche,Alerte,EmailStructure,Dossiers,Sources,PhraseChoc,Ensemble}.tsx`.
- **Dépend de** : L7.
- **Modèle** : Sonnet (relecture Opus).
- **Acceptation** : images fixes des images A et B (cinq cartes, récapitulatif) ; repère « 2/3 » ; phrase-choc mot à mot avec lueur ; scène « Ensemble » de C et du faux schéma à 16 nœuds : tout le schéma visible, aucun texte à lire sous le plancher ; image A : **aucune personne de la photo**, paperboard redessiné.

### L9b · Les 12 micro-objets (à dessiner)
- **Fichiers** : `studio-rendu/compositions/image-video/MicroObjet.tsx`, `studio-rendu/compositions/image-video/micro-objets/*.tsx` (12 dessins maison animés), `src/briques/schema-motion/micro-objets.ts` (banque fermée des 12 noms).
- **Dépend de** : L7.
- **Modèle** : Sonnet (relecture Opus).
- **Acceptation** : 12 dessins dans le style des dessins maison, chacun avec sa micro-animation ; images fixes sur A et B. **Point d'arrêt Will** : il juge la galerie (L7-L9b) à l'image avant L11 (question n° 1 de `52`, avec la maquette).

---

## Vague 4 — chaîne de fabrication

### L10 · Rendu fidèle à la prod (remplace l'ancienne « opération images clés »)
- **Pourquoi** : l'extraction d'images du fichier final **existe déjà** (opération `controle`, `etape: "images"`, appelée par `montage-facecam/chaine.ts:778`) ; et des images fixes rendues en cloud avec typescript installé ne prouvent rien sur la prod (I8).
- **Fichiers** : `scripts/image-video/galerie-prod.ts` (construit le paquet `studio-rendu` comme la prod : `npm ci --omit=dev`, sans typescript, puis rend les images fixes de la galerie depuis ce paquet), consigne de la routine cloud. **Aucune opération nouvelle, aucune mise en ligne du serveur de rendu.**
- **Dépend de** : L7 (premier usage). Indépendant ensuite.
- **Modèle** : Sonnet.
- **Acceptation** : la galerie se rend depuis un paquet sans typescript ; un fichier piège avec JSX de niveau module sans import React y casse le rendu (preuve que le banc voit ce que voit la prod).
- **Test** : routine cloud.

### L11 · Mise en scène déterministe : fiche + heures des mots → ligne de temps
- **Fichiers** : `src/moteurs/montage-image-video/mise-en-scene.ts` (scènes « émotion » → props `CasConcretEcran` ; schéma → props `ImageVideoScene` + caméra L2 ; **scène « Ensemble »** aux ouvertures de chapitre et après les branches), `calage.ts`, `controles-scene.ts` (Q12-Q15 dont **taille effective**, Q20-Q23, Q25 ; **Q14 ne compte pas les mouvements de caméra**), `sous-titres.ts`, `tests/image-video/mise-en-scene.test.ts`.
- **Dépend de** : L2, L4, L6, L7-L9b.
- **Modèle** : Opus.
- **Acceptation** :
  - sur les 6 images, heures de mots simulées à 2,75 mots/s : toutes les règles passent ;
  - un chiffre dit mais pas montré est refusé ; un trou de 2,6 s sans changement est refusé **même s'il contient un panoramique** ;
  - un texte lisible à zoom 0,8 sous le plancher effectif est refusé ;
  - des sous-titres sous 68 % pour IG et FB sont refusés ;
  - question de commentaire mise en scène dans le segment de fin, absente du segment LinkedIn.
- **Test** : vitest.

### L12 · Voix et assemblage : corps une fois, une lecture par segment de fin, WAV obligatoire, versions courtes
- **Fichiers** : `src/moteurs/montage-image-video/voix.ts` (pilote `avancerVoixCasConcret`, `controlerPrise`, ressemblance v4 via `emprunts.ts` ; segment de fin = question + fin), `assemblage.ts` (WAV obligatoire ; coupes `recalerCoupesSurSilences` ; tempo ×1,08 ; mixage voix + bruitages, −14 LUFS, aucune musique ; **piste voix seule de chaque version gardée** avec son empreinte, pour Q18-Q19 ; **version courte** taillée dans la même voix aux bornes de chapitre mesurées), `tests/image-video/voix.test.ts`.
- **Dépend de** : L1 (plafonds), L3, L6. ⟂ axion-ia-43 (informer ; aucune modification de leurs fichiers).
- **Modèle** : Opus.
- **Acceptation** :
  - une prise avec « euh » déclenche une lecture neuve, 3 au plus ; une voix payée n'est jamais relue à la reprise ;
  - sans WAV : refus avec une phrase claire (aucun repli MP3) ;
  - version courte : aucun nouvel appel HeyGen ; coupe refusée si la borne de chapitre ne tombe pas dans un silence mesuré ≥ 300 ms ;
  - piste voix seule produite pour chaque version, empreinte reportée dans le mixage.
- **Test** : vitest (HeyGen simulé).

### L13 · Contrôles finaux et porte unique
- **Fichiers** :
  - `src/moteurs/montage-image-video/ecoute.ts` (Q18-Q19 **sur la piste voix seule** : route `transcrire`, bornage à la durée de voix, filtre des phrases parasites, `occurrences`/`memeMot`/`nombreEnLettres` ; Q19 fichier final : voix finie ≥ 1,5 s avant la fin par la ligne de temps + empreinte de piste) ;
  - `relecture-finale.ts` (Q26 : images extraites par l'**opération existante** `controle` / `etape: "images"` ; extraction ratée = refus) ;
  - `controles.ts` (Q01-Q28 avec Q05 bis, Q08 bis, Q11 bis ; une ligne par contrôle et par version ; phrase pour Will) ;
  - `porte.ts` (verdict unique, sur TOUTES les versions, versions courtes comprises ; mention orange « un peu longue » non bloquante) ;
  - `tests/image-video/controles.test.ts`.
- **Dépend de** : L11, L12.
- **Modèle** : Opus.
- **Acceptation** :
  - une transcription simulée à laquelle manque la dernière phrase est refusée ;
  - une transcription qui contient « Sous-titres réalisés par… » après la voix **n'est pas** refusée ;
  - un son de clôture sur le mixage ne fait pas échouer Q19 (mesure sur la voix seule) ;
  - un chiffre non entendu est refusé ; une relecture « manque : 20 % » est refusée ;
  - le verdict lit toutes les versions ; aucun contrôle ne se saute en silence quand une donnée manque : il échoue.
- **Test** : vitest.

### L14 · Versions par réseau et textes de publication
- **Fichiers** : `src/moteurs/montage-image-video/fins.ts` (**`planDesFinsIV`**, type `ReseauIV` à 5 réseaux, `codeVersionIV` « 0042-IV-YS », `liensSuivisIV` ; lit la banque en lecture seule, lignes `fin-ty-*` Usine pour Shorts ; `offre` de la carte ; réglage `appelCommentaire`), `reseaux.ts` (application des plafonds par réseau : livrée / mention / version courte / non livrée), `publication.ts` (adaptateur vers `textesDePublication` ; question propre à l'image dans le texte LinkedIn ; contrôle des interdits sur le post ET le premier commentaire), `tests/image-video/reseaux.test.ts`.
- **Dépend de** : L1, L3, L6.
- **Modèle** : Sonnet.
- **Acceptation** :
  - Shorts présent avec une fin complète (diagnostic + lien profil) ;
  - LinkedIn : **rien dit ni affiché** à la fin, aucune question dans la vidéo ; question + lien dans le texte du post ;
  - question de commentaire présente sur IG, FB, TT, YS ;
  - fin « diagnostic » partout tant qu'aucun mot ni cadeau réel n'est branché (aucune promesse d'envoi) ;
  - liens suivis distincts par réseau ; « Villeexemple » dans un post est refusé ;
  - 74 s → TikTok, Shorts, LinkedIn en version courte ; Instagram et Facebook en version longue.
- **Test** : vitest.

### L15 · Format, moteur et machine à états
- **Fichiers** :
  - `src/formats/image-video/index.ts` (`statut: "masque"`, `codeClassement: "IV"`, `musique: "interdite"`, `moteur: "montage-image-video"`, 9:16 pour les 5 réseaux, réglages `decoupage: "chapitres"` (seule valeur), `appelCommentaire`, `validationCarte: "toujours" | "si-doute"`, `bruitages: "discrets"` forcé) ;
  - `src/moteurs/montage-image-video/index.ts` (états `lecture → carte-a-valider → ecriture → script-a-valider → voix → mise-en-scene → rendu → controles → prete | refusee` ; reprise sans repayer ; prix annoncé puis réservé ; **carte à valider obligatoire tant que moins de 10 cartes validées**, puis selon le réglage) ;
  - `src/services/image-video.ts`, `image-video-carte.ts`, `image-video-scripts.ts` (persistance carte, script, choix de Will sur les formules, compteur de cartes validées) ;
  - `tests/image-video/moteur.test.ts`.
- **Dépend de** : L5, L6, L11-L14.
- **Modèle** : Opus.
- **Acceptation** :
  - bout en bout en simulation sur les 6 images, avec arrêts « carte à valider » et « script à valider » ;
  - à la 11ᵉ carte sans doute, en `si-doute`, l'arrêt « carte » est sauté ; avec un écart de lecture, il revient ;
  - aucune dépense avant la validation du script, hors lectures ;
  - le moteur refuse tout lancement réel tant que le format est masqué et que Will n'a pas donné son accord (même garde que FA) ;
  - plafond de dépense par lot d'essai respecté (arrêt net).
- **Test** : vitest.

### L16 · Interface : onglet « Image → vidéo » (5 écrans)
- **Fichiers** : `src/app/(studio)/image-video/**`, `src/components/formats/image-video/{Depot,CarteComprise,ScriptEcrans,Fabrication,VosVideos}.tsx` (patron cas concret recopié, jamais modifié), API sous `src/app/api/image-video/**`.
- **Dépend de** : L15. **Maquette des écrans 1 à 3 jugée par Will AVANT le code** (question n° 1 de `52`).
- **Modèle** : Sonnet.
- **Acceptation** :
  - parcours complet en simulation ; offre corrigeable au dépôt ;
  - carte corrigeable, écarts surlignés ;
  - script modifiable, question modifiable, phrases trop affirmatives avec « garder » / « version prudente », prix affiché ;
  - verdict par réseau en une phrase, mention « un peu longue » ou « version courte » visible ;
  - aucun terme technique à l'écran ; pas de mode sombre.
- **Test** : vitest + capture d'écran en cloud.

---

## Vague 5 — raccordement et essais

### L17 · Raccords dans les registres partagés (5 lignes)
- **Fichiers** (une ligne chacun) : `src/formats/registre-codes.ts`, `src/formats/index.ts`, `src/moteurs/ids.ts`, `src/moteurs/index.ts`, `studio-rendu/compositions/Racine.tsx`.
- **Dépend de** : L7-L9b, L15. ⟂ **axion-ia-ca** (accord et ordre de fusion avec la ligne FA) ; ⟂ **axion-ia-17** (une composition nouvelle entre dans le paquet de rendu commun).
- **Modèle** : Sonnet.
- **Acceptation** : le format reste masqué ; le test « JSX de niveau module » passe sur tout notre dossier ; le paquet construit comme la prod (L10) rend `ImageVideoScene` ; aucune autre ligne modifiée.
- **Test** : vitest complet + build en cloud.

### L18 · Banc sans dépense puis banc réel (sur accord, plafonds fermes)
- **Fichiers** : `scripts/banc-image-video.ts` (6 images bout en bout en simulation, rapport des contrôles ; mode réel avec plafond passé en argument), recalibrage du débit (constante de L1) après la première voix réelle.
- **Dépend de** : L17.
- **Modèle** : Sonnet.
- **Acceptation** : 6/6 en simulation, sans aucun refus. Réel en 3 étapes, chacune après le feu vert de Will sur la précédente : **1.** lecture des 6 images (plafond 2 €) ; **2.** la vidéo du chatbot (plafond 2 €) ; **3.** les 5 autres (plafond 9,50 €). Total au plus 13,50 €. Vidéos déposées dans le Drive de vérification.
- **Test** : routine cloud.

---

## Ordre et parallélisme

```
Vague 1 :  L1 ─┬─ L2 ── L7 ─┬─ L8  ─┐
               │      │     ├─ L9a ─┤ (arrêt Will : galerie + maquette)
           L3 ─┤      L10 ──┘─ L9b ─┤
           L4 ─┤ (écoute Will → L4 bis éventuel)
Vague 2 :      ├─ L5                │
               └─ L6 ─┬─────────────┴─ L11 ─┐
                      ├─ L12 ───────────────┤
                      └─ L14 ───────────────┴─ L13 ── L15 ── L16 ── L17 ── L18
```
Effectif conseillé : 4 agents en parallèle sur la vague 1 (L1, L3, L4, puis L2), puis 3 (L5, L6, L7+L10), puis 3 (L8, L9a, L9b).

## Ce qui dépend d'autres sessions

| Session | Ce qu'on lui demande | Lots |
|---|---|---|
| axion-ia-43 (cas concret) | Rien à modifier. L'informer de la liste des symboles importés (voix, fin de voix, `texteAvecNombres`, interdits, ton v4, `DECLENCHEUR_DE`, type `Offre`) ; `planDesFins` et `nombresDe` ne sont plus empruntés. Garde de fin sautée en silence (`fabriquer.ts:684`) et repli MP3 (`:628`) : restent chez elle, non empruntés. **Plus d'alerte « 103 .tsx sans React »** (fausse alerte) | L3, L6, L12 |
| Propriétaire du modèle de ton (`src/donnees/generateur/modeles-will.ts`) | Signaler que l'exemple W09 contient « machine » ; ne rien modifier nous-mêmes | L6 |
| axion-ia-ca (interface claire / FA) | Import seul de `interface-claire/**` ; ordre de fusion des 5 lignes de raccord ; après fusion de `lot-c`, import de la boucle du réalisateur au lieu du patron recopié | L7-L9b, L17 |
| axion-ia-17 (mises en ligne) | Plus d'opération nouvelle ni de mise en ligne du serveur de rendu ; avertissement avant L17 (nouvelle composition dans le paquet commun) ; accord avant L4 bis s'il a lieu | L17, L4 bis |
| Propriétaire de la publication Buffer (audit 40, P0-1 et P0-2) | Corriger le choix du fichier par réseau et le premier commentaire ; d'ici là, téléchargement ou brouillon seulement | L14, L16 |
