# NEW-ARG-01f : aucun montant affiché, lot f (tableau animé, 6 fichiers)
- Fait : les six écrans n'affichaient aucun montant écrit en dur (CoutVoixTableau ignore déjà le prix) ; seul trou : les phrases et messages renvoyés par le serveur étaient rendus tels quels et peuvent contenir un prix. Ils passent maintenant par `messageSansMontant` (aide de NEW-ARG-01, réutilisée, rien de créé).
- Fichiers : EcrireScriptTableau, HistoriqueTableau, NouvelleVideoTableau, RetouchesTableau, SuiviTableau, SuiviTacheTableau (src/components/formats/tableau-anime/), tests/sans-prix/new-arg-01f.test.tsx (nouveau), ce journal. Aucun fichier de src/components/ui, src/services ni src/domaine touché.
- Données de coût, calculs, plafonds, `confirmerPrix` et ses appels : intacts. Aucun lancement bloqué (le montant du serveur est toujours accepté et renvoyé tel quel).
- Test rouge d'abord : 7 échecs sans le code, vert avec (rendu de l'historique + garde sur le source pour les phrases posées en état).
- Tests : nouveau test + couleurs-theme-seulement + tests existants des fichiers touchés : 274 passés, 2 échoués (import-texte-commun, échouent déjà avant mon changement). tsc : 173 lignes, identique à NEW-ARG-01/master. eslint : aucune erreur.
- Reste hors lot (fiches suivantes) : les autres fichiers du grep.
