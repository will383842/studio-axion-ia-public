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
