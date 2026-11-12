# NEW-ARG-01c : aucun montant à l'écran, lot c (6 fichiers)
- Constat : page vidéo et layout ne rendent déjà aucun montant (coûts non affichés). Trou fermé dans Apercu : la feuille « Votre avatar parle » utilisait `phraseAvatarParle`, qui écrit un montant ; remplacée par une phrase sans montant.
- Messages venus du serveur (erreurs, confirmation) : passés par `messageSansMontant` (aide de NEW-ARG-01) dans Apercu, Express, Fabrication. lancer-avec-voyant.ts inchangé (texte fixe, et un test existant remplace le module par une doublure). Alerte conservée, sans montant ; aucun lancement bloqué ; signature de ConfirmationPrix inchangée.
- Serveur (services, domaine, calculs, plafonds) non touché ; les coûts restent enregistrés.
- Test : tests/sans-prix/new-arg-01c.test.tsx (rouge avant, vert après).
