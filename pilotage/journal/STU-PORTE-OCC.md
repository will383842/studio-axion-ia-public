# STU-PORTE-OCC — journal
- Fait : route POST /api/usine/creneaux-occupes (lecture seule, jeton de la porte via garderPorte), réponse = réseau, jour, heure seulement.
- Fichiers : src/app/api/usine/creneaux-occupes/route.ts, tests/porte-v2/creneaux-occupes.test.ts, ce journal.
- Dépendance L3-17 : absente de master (fusion à plat) ; branche origin/usine/L3-17 fusionnée dans cette branche, cadence.ts non modifié.
- Tests : tests/porte-v2 + tests/cadence + tests/porte-usine-garde-budget.test.ts : 52 passés, 0 échoué (suite complète non lancée, consigne).
- Reste : relecture Opus ; la fusion de L3-17 dans master devra précéder celle-ci. Période limitée à 400 jours, POST car la porte exige un corps JSON.
- Douteux : rien de connu.
- contrôle anti-fuite : vide
