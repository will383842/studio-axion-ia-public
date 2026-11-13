# STU-PORTE-LECT : porte v2 côté Studio, appel 2 (lire l'état d'une commande)
Fait : route POST /api/usine/commandes/[id] (l'identifiant est la clé de la commande ; jeton vérifié par garderPorte ; porte fermée tant que le secret du studio n'est pas posé). Lecture seule : aucune écriture, aucun envoi.
- Réponse : état et dates seulement (jour, instant, date de validation, date de refus). Ni texte de publication, ni compte, ni média, ni motif de refus, ni donnée de personne.
- Commande inconnue ou identifiant mal formé : 404 « introuvable ». Sans jeton : 401 ; porte éteinte : 404.
- Test « aucune écriture » : créneaux, paramètres et journal des décalages identiques avant et après l'appel.
Fichiers : src/app/api/usine/commandes/[id]/route.ts, tests/porte-v2/lecture-etat.test.ts, ce journal.
Tests : test rouge d'abord (route absente), puis tests/porte-v2, tests/cadence et tests/porte-usine-garde-budget.test.ts : 145 verts. eslint : aucune erreur ; tsc : aucune erreur dans les fichiers de la fiche (146 erreurs déjà présentes ailleurs, inchangées).
Hypothèses à relire (la fiche ne liste pas les états exacts, à aligner sur le contrat de STU-PORTE-CMD) :
- États rendus : recue, mise_de_cote, a_valider (y compris validée non programmée), programmee, publiee, refusee ; trois ajouts hors liste de la fiche : echec, manquee, archivee.
- Lecture en POST avec corps { contrat: 2 } (la porte exige un corps JSON), comme creneaux-occupes.
- « Tout arrêter » ne bloque pas la lecture.
