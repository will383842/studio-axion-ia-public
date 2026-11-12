# STK-01 : stock de messages
- Fait : type MessageStock + archiverMessage (seule définition, src/domaine/stock-messages.ts), collection stockMessages dans depots.ts, mémoire, COLLECTIONS de postgres. Archiver = copie datée (archiveLe), rien n'est supprimé.
- Fichiers : les 4 sources de la fiche + tests/stock-messages.test.ts + ce journal. Dépendances L1-05 et L1-06 fusionnées (journaux finals).
- Tests : fiche 5/5 ; avec calendrier, plan-editorial, envois-planifies : 25 passés, 0 échoué. Dossiers voisins (domaine, donnees, suppression-video) : 216 passés, 1 échoué.
- Échec : suppression-video-orphelins.test.ts (TRAITEMENT_SUPPRESSION, hors fiche, non touché) ; il échouait déjà depuis L1-06 (creneauxEditoriaux, journalDecalages) et exige maintenant aussi stockMessages.
- Reste : une petite fiche pour ajouter ces 3 collections à src/services/suppression-video.ts. Relecture.
- Douteux : champs du message (texte, réseau, creeLe, archiveLe) déduits de la fiche, très courte. Suite complète non lancée (consigne).
- contrôle anti-fuite : vide

## Corrections après relecture (v1-r8)
- À corriger (TRAITEMENT_SUPPRESSION sans stockMessages, creneauxEditoriaux, journalDecalages) : corrigé, 3 clés « sans-lien » ajoutées dans src/services/suppression-video.ts (fichier HORS liste de la fiche, ajouté sur demande de l'avis). Test rouge préexistant : tests/suppression-video-orphelins.test.ts (16/17 avant, 17/17 après).
- Tests : suppression-video* + stock-messages : 8 fichiers, 70 passés, 0 échoué. tsc : aucune erreur dans suppression-video.ts (erreurs préexistantes dans tests/zernio, hors fiche).
- Douteux : CreneauEditorial a un videoId facultatif ; « sans-lien » ne le détache pas à la suppression d'une vidéo. À trancher par une autre fiche.
- Remarques (Depot.supprimer, champs du message) : reportées, à confirmer par le fondateur.
- contrôle anti-fuite : vide

## Corrections après relecture (avis opus-v1-u8)
- creneauxEditoriaux « sans-lien » faux (orphelin prouvé) : corrigé. Traitement « detache » ; planifierSuppression retire le videoId du créneau (le créneau reste). Test ajouté dans tests/suppression-video-orphelins.test.ts (rouge puis vert) : fichier de test HORS liste, ajouté comme l'avis le demande.
- Fichier src/services/suppression-video.ts hors fichiers_autorises, sans CORRECTIF de fiche : REPORTÉ au pilotage (je ne peux pas écrire de CORRECTIF dans la fiche). Ordre de fusion conseillé : L0-07 → L1-06 → STK-01. Les deux fichiers hors liste sont à couvrir par un CORRECTIF avant fusion.
- stockMessages, journalDecalages : « sans-lien » confirmé juste par l'avis. Remarques (Depot.supprimer, champs du message) : reportées au fondateur.
- Tests : suppression-video* + stock-messages + calendrier + plan-editorial : 10 fichiers, 84 passés, 0 échoué. tsc : aucune erreur dans les fichiers touchés.
- contrôle anti-fuite : vide

## Corrections après relecture (avis opus-v1-w2)
- Constat 1 (fichiers hors liste sans CORRECTIF) : levé par le CORRECTIF du 12/11 de la fiche, qui autorise src/services/suppression-video.ts et tests/suppression-video-orphelins.test.ts.
- Constat 2 (un créneau « publie » perdait sa vidéo) : corrigé ; seuls les créneaux ni publiés ni archivés sont détachés ; « publie » et « archive » gardent videoId et figurent dans GARDES_APRES_SUPPRESSION. Un cas de test par statut (propose, a_valider, valide, programme, echec détachés ; publie, archive gardés), rouge avant, vert après.
- ATTENTION, conflit avec master : la fusion de master (L1-06, PR 323) fait EFFACER les créneaux non publiés de la vidéo (« garde-publiees »). Le CORRECTIF de STK-01 demande de les DÉTACHER : suivi ici, « garde-publiees » retiré pour creneauxEditoriaux. Deux tests de L1-06 mis à jour en conséquence (hors liste, ajoutés ici) : tests/calendrier/suppression-creneaux.test.ts et tests/calendrier/depot-creneaux.test.ts. Le pilotage doit confirmer que le détachement remplace l'effacement décidé par L1-06.
- Fusion de master : conflit dans src/domaine/depots.ts résolu (journalDecalages en DepotAjoutSeul de master, plus stockMessages).
- Constat 3 (remarque : créneau « valide »/« programme » détaché reste dans ce statut sans vidéo, ses envois non partis sont effacés) : reporté, à trancher par le pilotage.
- Constat 4 (Depot.supprimer, champs du message) : reporté au fondateur.
- Tests : suppression-video* + stock-messages + calendrier + plan-editorial + envois-planifies : 22 fichiers, 186 passés, 0 échoué (testTimeout 60 s).
- contrôle anti-fuite : vide

## Corrections après relecture (avis opus-v1-c2)
- Compilation (clé `journalDecalages` en double, TS1117) : corrigé, une seule clé dans `TRAITEMENT_SUPPRESSION`. Preuve : `tsc --noEmit` donnait TS1117 en :104 avant, plus aucune erreur dans ce fichier après (le typage n'est pas visible de vitest).
- Deux tests de calendrier hors liste : bloqué, CORRECTIF requis. Chemins exacts : tests/calendrier/depot-creneaux.test.ts et tests/calendrier/suppression-creneaux.test.ts. Les retirer de la branche ferait retomber le test de L1-06 sur master (« garde-publiees »), donc ils restent modifiés en attendant un CORRECTIF qui les nomme et confirme que le détachement remplace l'effacement.
- master (origin/master) refusionné ; tests : stock-messages + suppression-video* + calendrier + plan-editorial : 24 fichiers, 211 passés, 0 échoué.
- contrôle anti-fuite : vide
