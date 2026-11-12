# CAL-04 : final
Fait : src/domaine/calendrier/reponses-auto.ts (accepteReponseAutomatique : oui Instagram/Facebook seulement, non LinkedIn/TikTok quel que soit le réglage) ; ApercuPublication : bloc mot-clé (BlocMotsCommentaires, non modifié) seulement IG/FB ; LinkedIn/TikTok : « Réponses aux commentaires : toujours à la main sur … » + lien « À traiter » (/a-traiter), aucun bouton.
Critères tenus : 1 (tests/cal-04…test.tsx, « le bloc mot-clé est là » + « LinkedIn/TikTok ni bloc mot-clé »), 2 (« toujours à la main », lien href=/a-traiter, pas de bouton), 3 (« une fonction unique »).
CORRECTIFS : validation_williams non (rien à valider) ; BlocMotsCommentaires.tsx non touché (RC-38 en V2) : tenu, git diff vide dessus.
Tests : CAL-04 8/8 ; voisins (rc-36, rc-37, rc-38, calendrier*) 374 passés, 0 échoué en tout. Test rouge vérifié sans le code (4 échecs).
tsc : 147 erreurs avant et après, aucune nouvelle. Aucun fichier mots/parcours/guide-reseau modifié ; aucune couleur hors thème.
Test autorisé : celui de la fiche. Dépendances RC-36, RC-37, CAL-12 déjà dans master.
Douteux : le réseau inconnu n'affiche ni bloc ni phrase (choix). Le bloc reçoit `mots` en option ; l'appelant ne le fournit pas encore.
contrôle anti-fuite : vide
