# 60 · Critique indépendante du plan « Image → vidéo » (14/10/2026)

Relecture seule de origin/master 769aedae + origin/interface-claire/lot-c. (Fichier recopié par la direction : le critique n'a pas pu écrire, disque C: plein.)

## 0. « 103 .tsx sans React » = FAUSSE ALERTE
Prod : `npm ci --omit=dev` → pas de typescript → esbuild compile en JSX classique ; `reactShim` pose `globalThis.React` APRÈS le chargement des compositions → seul le JSX évalué au niveau module casse (cas d'`elements.tsx`, #201). 105 fichiers sans import React sur master, AUCUN avec JSX au niveau module. Correction : garder l'import dans nos fichiers ; test qui refuse tout JSX au niveau module sans React + bundle sans typescript. Ne pas alerter 43/17.

## BLOQUANT
- B1 Shorts impossible avec les pièces empruntées : `ReseauCas` sans Shorts, `DemandePlanDesFins` exige `offre`, `codeVersionCasConcret` écrit « CC » en dur. → `planDesFinsIV` propre (lecture de `finPour`/`TABLE_FINS_DIAGNOSTIC`), lignes `fin-ty-*` pour Shorts, `offre` ajoutée à la carte + écran Déposer.
- B2 L'appel à commenter demandé par Will absent par défaut (fin = diagnostic). → question de commentaire propre à l'image avant la fin réseau (banque : `fin-if-question`, `fin-ty-question-tache`) ; rien de dit sur LinkedIn.
- B3 Caméra : toile 3×3 + zoom ≥ 0,55 → on ne voit que ~1,8 écran, pas le schéma entier. → vue d'ensemble = scène dédiée (schéma réduit sans texte à lire, ou l'image source) ; contrôle de taille de texte effective (taille × zoom ≥ plancher).
- B4 Nouveaux bruitages : `DeclencheurBruitage` fermé (`src/domaine/types.ts:1748`), repris dans `briques/intensite/bruitages.ts:69`, `intensite/types.ts:135`, `donnees/bruitages.ts:23`, `SonDuPlan.tsx:10` + Bibliothèque. → lot L4 bis coordonné, ou faire entrer les 6 sons dans les 5 déclencheurs ; D5 doit couvrir aussi les 20 sons existants non validés.

## IMPORTANT
- I1 `nombresDe` (`montage-cas-concret/regles.ts:252`) perd unités, « 23h14 », « 24h/24 » ; second `nombresDe` dans `domaine/preuves-saisie.ts:91`. → extracteur propre (brut, valeur, unité) testé sur les 6 images.
- I2 Lecture d'image : pas de tuiles agrandies pour petits textes, pas de refus image illisible / type inconnu ; `ImageClaude` = JPEG/PNG seulement.
- I3 Q19 (silence de fin ≥ 300 ms) mesuré sur le mixage final échoue à cause du son de clôture → mesurer sur la piste voix seule.
- I4 Q18 : Whisper invente des phrases sur les silences (« Sous-titres réalisés par… ») → transcrire la voix seule, filtrer les parasites, borner à la durée de voix.
- I5 Q14 rythme : un panoramique compterait comme changement → ne compter que apparitions de nœuds/chiffres/objets et changements de fond.
- I6 D1 (dire le lien sur LinkedIn) contredit la décision de Will du 12/10 (`banque.ts:82-88`) → présenter comme remise en cause, défaut = ne rien dire.
- I7 Promesses non sourcées (« Zéro erreur », « dès le premier jour », « 0 demande perdue ») jamais introduites comme « situation type » → annonce obligatoire + contrôle des formules absolues (DGCCRF, « ne pas trop s'engager »).
- I8 L10 refait l'extraction d'images existante (`montage-facecam/chaine.ts:778`) ; images fixes rendues en cloud (typescript installé) ne prouvent pas le rendu de prod.
- I9 Conflit « mot pour mot » vs « interdits » (phrase-choc contenant un mot interdit ; Will ajoute un chiffre) → règle de priorité + message à Will.

## MINEUR
M1 sortes de bruitages ≠ déclencheurs · M2 « 17 lots » vs 18, coûts 2 € vs 2,05/2,90 € · M3 image A = photo de vraies personnes : règle à fixer · M4 12 micro-objets K11 à créer, pas à réutiliser · M5 test L1 non déterministe · M6 88 s > 60 s conseillé LinkedIn/Shorts → règle par réseau.

## Vérifié conforme
~25 pièces réutilisées existent avec les signatures annoncées (voix.ts, fin-de-voix.ts, fins.ts, finPour, textesDePublication [adaptateur requis], MOTS_INTERDITS_FORMAT, EXEMPLE_TON_V4, socle-will, coupes/texte.ts, relecture.ts, controle-image, Icone, EtiquetteCompteur…). `W09` contient « machine » (`modeles-will.ts:24`). Règles de Will respectées (voix unique, pas de musique, pas de banque payante, jamais Haiku, cloud). Coûts plausibles (~1 €/vidéo). Ajouter `src/domaine/types.ts` à la liste à coordonner.
