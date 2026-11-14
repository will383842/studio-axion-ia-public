# AUT-B : écran Réglages « L'Usine en automatique »

Plan USINE-AUTONOMIE-SOUS-PLAFOND, § 2.1, 2.3, 2.7, lot AUT-B. Interrupteur ÉTEINT par défaut, aucun montant par défaut dans le code.
- Carte `usine-automatique` dans « Services reliés » : interrupteur, « Plafond du mois (€) », Enregistrer, état du mois, phrase fixe.
- Action `reglerAutonomieUsineAction(actif, plafondEuros)` : `exigerSession`, `Math.round(x*100)`, borne 0 à 100 000 €, puis `reglerAutonomieUsine` seul ; `revalidatePath("/reglages")`.
- Allumer avec 0 € : refusé avec une phrase claire, côté écran et côté service ; rien n'est écrit.
- Mutations rejouées (rouge puis restauré) : sans `exigerSession` (1 rouge) ; 0 € allumé accepté (1 rouge) ; `Math.floor` (2 rouges, dont 19,99 € → 1 998 c).
- Tests : `tests/autonomie-usine-ecran.test.ts` (13) + `autonomie-usine-*` : 70 verts. Lint propre, tsc : 146 erreurs, aucune nouvelle.
