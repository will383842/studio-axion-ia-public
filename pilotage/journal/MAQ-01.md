# MAQ-01 : journal (final)
- Fait : 4 maquettes HTML statiques (À publier, Stock, Infographie, Écrans sans prix), menu fixe à gauche sur fond foncé, pages claires, sans montant, vouvoiement, mention « Maquette fictive ».
- Fichiers : docs/maquettes/{a-publier,stock,infographie,ecrans-sans-prix}/index.html, tests/maquettes/maq-01-maquettes.test.ts.
- Tests : 35 passés, 0 échoué (fiche), avec et sans fichier de motifs privés fourni à l'exécution.
- Reste : EN ATTENTE DE VALIDATION ÉCRITE DU FONDATEUR avant tout code (INF-01, NEW-ARG-01) ; la fiche ne passe pas « fait ».
- Douteux : textes d'exemple à relire par le fondateur ; RC-35 : pas de branche, validée hors dépôt (aucune dépendance de code).

## Corrections après relecture
- Test public qui écrivait des mots privés : corrigé (motifs lus dans un fichier fourni hors dépôt, variable INTERDITS_PUBLIC_FICHIER ; sans fichier le contrôle est sauté et le dit). Les anciens commits restent dans l'historique de la branche (pas de force-push permis) : à traiter par le fondateur.
- Journal « en cours » : corrigé (journal final, 35/0).
- Validation écrite du fondateur absente : reporté, statut « en attente de validation ».
- Étiquette « Essai » : corrigé (« Création »), test ajouté.
- Motif vouvoiement : corrigé (/\b(vous|votre|vos)\b/).
- contrôle anti-fuite : vide
