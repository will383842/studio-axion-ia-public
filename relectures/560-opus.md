VERDICT PROVISOIRE : en cours

Relecture PR 560 (tête 6239a1b7fda9a0f9c1bea3769f6900c230f939dd).

- (d) diff : 10 fichiers attendus exactement (626+/17-). OK.
- (f) aucun nom de personne dans les lignes ajoutées ni dans les messages de commit. OK.
- (b) sondes : variable absente/vide/blancs/«,»/«*»/«compte,*»/«;»/4 comptes/4e compte/casse/espace interne/entrée vide/non listé : cible d'essai écartée, rien ne part. OK.
- (a) sonde : cible normale, variable vide ou mal formée : lien envoyé comme master. Écart repéré : lecture du catalogue supplémentaire au M1 (5 lectures contre 4 sur master) ; en erreur elle bascule en « cible_essai » (M1 sans lien, sans alerte). En cours de qualification.
- (e) CI de la tête 6239a1b : 9/9 verts (eslint et tsc différentiels, tests des fichiers touchés, nouveaux tests, build). scripts/echecs-connus.json inchangé. eslint local des 8 .ts modifiés : 0 erreur. Comparaison locale branche/master des 86 fichiers de tests concernés : en cours.
