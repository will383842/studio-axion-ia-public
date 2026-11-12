# STU-PORTE-OCC — journal
- Fait : route POST /api/usine/creneaux-occupes (lecture seule, jeton de la porte via garderPorte), réponse = réseau, jour, heure seulement.
- Fichiers : src/app/api/usine/creneaux-occupes/route.ts, tests/porte-v2/creneaux-occupes.test.ts, ce journal.
- Dépendance L3-17 : absente de master (fusion à plat) ; branche origin/usine/L3-17 fusionnée dans cette branche, cadence.ts non modifié.
- Tests : tests/porte-v2 + tests/cadence + tests/porte-usine-garde-budget.test.ts : 52 passés, 0 échoué (suite complète non lancée, consigne).
- Reste : relecture Opus ; la fusion de L3-17 dans master devra précéder celle-ci. Période limitée à 400 jours, POST car la porte exige un corps JSON.
- Douteux : rien de connu.
- contrôle anti-fuite : vide

## Corrections après relecture (avis opus-v1-y2)
- Statut « propose » absent du jeu d'essai : corrigé (propose, publie, echec ajoutés ; seule l'archive libère) — tests/porte-v2/creneaux-occupes.test.ts, premier test. Le test devient rouge si estOccupe exclut « propose » (vérifié par retrait temporaire).
- Limite exacte de 400 jours : corrigée (400 passe, 401 refusé) — test « limite exacte de 400 jours ».
- Liste des réseaux recopiée : corrigée (route.ts utilise RESEAUX_TAXONOMIE) — test « accepte chacun des réseaux de la taxonomie ».
- src/services/cadence.ts (jour visé / heure de Paris) : reporté, hors fichiers autorisés ; PILOTAGE : fiche de suivi de cadence.
- Remarques « n'écrit rien » et validation du fondateur : conformes, rien à faire.
Tests : tests/porte-v2 + tests/cadence + tests/porte-usine-garde-budget.test.ts : 72 passés, 0 échoué ; tsc et eslint propres. contrôle anti-fuite : vide
