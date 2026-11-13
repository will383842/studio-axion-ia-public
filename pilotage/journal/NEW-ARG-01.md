# NEW-ARG-01 : aucun prix ni budget affiché (final)
- Fait : les cinq composants ne rendent déjà aucun montant (EncartCout, JaugeBudget, BandeauCredits, EstimationCout : lot 3 antérieur, vérifiés par test). Seul trou trouvé et fermé : ConfirmationPrix affichait tel quel le message du serveur, qui peut contenir un prix (cas sans montant) ; `messageSansMontant` le masque. Signature publique inchangée.
- Fichiers : src/components/ui/ConfirmationPrix.tsx, tests/new-arg-01-aucun-prix-affiche.test.tsx (nouveau), ce journal. Aucun fichier de src/services ni src/domaine touché. Aucun garde-fou changé.
- Critère 1 (aucun €, $, « euros ») : tenu, tests/new-arg-01-aucun-prix-affiche.test.tsx (blocs EncartCout, JaugeBudget, BandeauCredits, EstimationCout, ConfirmationPrix « sans montant »). Rouge sans le code : 4 échecs ; vert avec.
- Critère 2 (confirmation sans prix, aucun lancement bloqué) : tenu, même fichier (« un montant connu est accepté tout de suite », Annuler/Confirmer présents).
- Critère 3 (services/domaine intacts) : tenu, git diff ne touche que les fichiers ci-dessus. Critère 4 (signature, 26 importeurs) : tenu, même fichier + tsc identique à master (173 lignes).
- Tests (cloud) : 3 tests existants de la fiche + harmonisation + regles-de-fer + tests voisins de ConfirmationPrix : 357 passés, 3 échoués ; ces 3 échouent déjà sur master (relecture-finale-petits, image-video-adaptateurs, confirmation-prix-auto). Suite complète non lancée.
- Garde regles-de-fer : 0 défaut (source écrite sans symbole d'argent).
- PILOTAGE : JaugeBudget affiche encore « x % du budget du mois » (pourcentage, sans montant) ; la fiche ne vise que les montants, à trancher par le fondateur. Les trois tests existants n'avaient pas rougi : non modifiés.
- contrôle anti-fuite : vide
