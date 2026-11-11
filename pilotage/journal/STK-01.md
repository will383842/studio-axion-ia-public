# STK-01 : stock de messages
- Fait : type MessageStock + archiverMessage (seule définition, src/domaine/stock-messages.ts), collection stockMessages dans depots.ts, mémoire, COLLECTIONS de postgres. Archiver = copie datée (archiveLe), rien n'est supprimé.
- Fichiers : les 4 sources de la fiche + tests/stock-messages.test.ts + ce journal. Dépendances L1-05 et L1-06 fusionnées (journaux finals).
- Tests : fiche 5/5 ; avec calendrier, plan-editorial, envois-planifies : 25 passés, 0 échoué. Dossiers voisins (domaine, donnees, suppression-video) : 216 passés, 1 échoué.
- Échec : suppression-video-orphelins.test.ts (TRAITEMENT_SUPPRESSION, hors fiche, non touché) ; il échouait déjà depuis L1-06 (creneauxEditoriaux, journalDecalages) et exige maintenant aussi stockMessages.
- Reste : une petite fiche pour ajouter ces 3 collections à src/services/suppression-video.ts. Relecture.
- Douteux : champs du message (texte, réseau, creeLe, archiveLe) déduits de la fiche, très courte. Suite complète non lancée (consigne).
- contrôle anti-fuite : vide
