# AUT-D : frein image→vidéo sous plafond de l'Usine
1. `src/services/image-video.ts` : l'accord de script absent ne refuse plus si `accordSansClicPour(dep.origine, videoId)` (indicatif OU Usine avec autonomie allumée) ; même règle pour la décision du script gardée (sinon la fabrication resterait à la porte).
2. Interrupteur éteint, à 0, absent ou illisible : comportement actuel inchangé (`PHRASE_ACCORD_ABSENT_IV`). Studio inchangé.
3. Le plafond lui-même est appliqué par la réservation qui suit (`verifierEtReserverSelonOrigine`, lot C) : ce lot ne le recode pas ; le test l'observe par un double.
4. Tests : `tests/autonomie-usine-image-video.test.ts` (7, mémoire, 0 €). Rouge vérifié sans le correctif : 2 échecs (allumée sous plafond, au plafond).
5. Mutation rejouée : `accordSansClicPour` → `budgetIndicatifPourVideo` : 2 tests rouges ; restauré, vert.
6. Constat hors périmètre (auditeur) : `budgetIndicatifPour` (mode-budget.ts) ne tient pour Usine que la chaîne exacte « usine » ; une origine « Usine », vide ou objet donne donc `indicatifIV` vrai ici (accord présumé), avant même AUT-D. À traiter dans un lot qui peut toucher mode-budget.ts.
7. Fichiers touchés : les trois autorisés, aucun autre.
