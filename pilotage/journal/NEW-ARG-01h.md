# NEW-ARG-01h : retirer tout montant de l'écran, lot h

- Grep refait sur origin/master : sur les 6 fichiers du lot, KitPublication, RelireScript, BoutonAnnuler, BoutonArreter et index.ts n'affichent déjà aucun montant (lots précédents).
- Seul reste trouvé : l'icône « euro » du bandeau « En attente de crédit » dans `ProgressionEtapes.tsx`, remplacée par l'icône « horloge ».
- Rien supprimé des données : les coûts restent enregistrés, aucun lancement manuel n'est bloqué. La signature de `ConfirmationPrix` ne change pas.
- Test ajouté : `tests/nouveau-arg-01h-aucun-montant.test.ts` (rendu sans « € », « $ », « euros », ni nombre décimal ; garde sur les sources).
- Vérifs : vitest (14 fichiers liés + le nouveau) verts, eslint propre, tsc : aucune erreur dans les fichiers touchés (erreurs déjà présentes dans d'autres tests).
- Composant `src/components/ui/` touché : ProgressionEtapes, à annoncer à la session interface.
