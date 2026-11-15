# Relecture PR 564 (fiche L5-26)

VERDICT PROVISOIRE : en cours

Tête examinée : 5969b4832903eeb3e73ced955a90f14f1e9233e1 (usine/L5-26-v2)

## Étape 1 : sondes (jetables, non poussées)
- Diff : 2 fichiers, tous deux autorisés.
- E-mail dissimulé accepté : « nom [at] exemple.fr », « nom @ exemple.fr », « nom@exemple .fr », « nom＠exemple.fr », « nom%40exemple.fr ». Majuscules refusées (correct).
- post_ref vide / espaces / null : non rattaché (correct) ; « p1 » et « p1 » entouré d'espaces comptés comme deux publications.
- Contrat : utm_campaign de charge-crm-v3.json = « guide_reseau », refusé par construireLienSuivi (underscore) ; le test de forme refuserait « 0042-TB-IG ».
