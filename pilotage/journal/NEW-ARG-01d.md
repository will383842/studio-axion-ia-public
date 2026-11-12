# NEW-ARG-01d : aucun montant à l'écran, lot d (6 fichiers)
- Fait : les six fichiers ne rendaient déjà aucun montant propre ; restaient les messages du serveur affichés tels quels (erreurs, refus, avis). Ils passent maintenant par `messageSansMontant` (aide de NEW-ARG-01, rien de créé). Commentaires et libellés mentionnant « € » ou « euros » nettoyés.
- Fichiers : FeuillePlateau.tsx, VoirLesPlans.tsx, logique.ts, SuiviCasConcret.tsx, BoutonFabriquer.tsx (StockDesCas.tsx déjà propre, inchangé) ; tests/sans-prix/new-arg-01d.test.tsx (nouveau) ; ce journal.
- Aucun calcul, plafond ni donnée de coût touché ; signature de ConfirmationPrix inchangée ; aucun lancement bloqué (mode indicatif testé).
- Test rouge d'abord : 4 échecs avant correction, vert après. Test voisins (new-arg-01, couleurs-theme-seulement, m3-votre-video, correcteur-ui2) : 123 passés.
- Des tests d'e2e « panne à l'étape… » ont échoué dans la sélection par nom ; ils dépendent de la base et n'ont rien à voir avec ces fichiers (non relancés sur master ici).
