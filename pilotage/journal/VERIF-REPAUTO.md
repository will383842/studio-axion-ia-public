# VERIF-REPAUTO : garde sans IA, réponses automatiques (terminé, sans PR)
- Fait : tests/garde-reponses-auto.test.ts (16 tests) + étape dédiée dans .github/workflows/verifier.yml (lancée à chaque PR et push).
- Dépendance L0-17 : déjà sur master (verifier.yml). mots-capacites.ts lu sans modification ; tests/zernio intacts.
- Tests : 16 passés, 0 échoué ; avec pv5-reponse-publique : 31 passés, 0 échoué. Rouge vérifié : en mettant « auto » (réponse publique/message privé) sur linkedin_page et tiktok, 5 tests échouent ; fichier remis tel quel.
- Critère 1 (échoue si « auto » sur linkedin_page, linkedin_profil, tiktok) : tenu, test.each des lignes 22 à 40 du test.
- Critère 2 (lecture seule, tourne dans verifier.yml à chaque PR) : tenu, import ligne 4 du test ; étape « Garde sans IA » du workflow.
- Critère 3 (aucune IA, aucun appel réel) : tenu, fonctions pures uniquement.
- Contexte/cas limites : tout réseau futur au nom linkedin ou tiktok couvert (test ligne 18) ; témoin Facebook/Instagram resté auto (dernier test).
- Reste : fusion de verifier.yml par le fondateur (fichier sensible). Test vert sur master car RC-43 est déjà fusionnée.
- Contrôle anti-fuite : vide.
