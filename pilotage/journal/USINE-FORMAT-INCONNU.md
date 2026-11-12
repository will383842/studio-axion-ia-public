# USINE-FORMAT-INCONNU : refuser une idée au format inconnu (FAIT, 12/11/2026) — 1 point bloqué
- Fichiers : src/services/usine-sujet.ts (code exporté format_non_disponible, formatPourIdeeUsine sans repli, refus journalisé avant tout sujet), tests/usine-format-inconnu.test.ts (nouveau). Dépendance RC-02 : aucune branche, rien de son code n'est utilisé.
- Critère 1 (format inconnu refusé, aucun sujet, matière ni rappel à l'usine) : tenu, tests/usine-format-inconnu.test.ts « format inconnu : aucun sujet… » et « idée sans aucun format ».
- Critère 2 (refus journalisé avec la signature) : tenu, même fichier, « le refus est journalisé avec la signature de l'idée ».
- Critère 3 (format connu, avec ou sans accents, trouvé comme avant) : tenu, « un format connu est trouvé… » et « un format connu crée toujours le sujet ».
- Critère 4 (rouge sur le code actuel) : tenu, 10 tests sur 11 rouges avant le code, 11 verts après. Format « bientôt » refusé aussi.
- Tests : fichier de la fiche 11 passés, 0 échoué ; usine-idees 100 % vert. Voisins : sur master 2 échecs déjà là (usine-comite-affichage, 2 tests). Avec ma branche : 3 échecs de plus dans tests/generateur/sujets-traites/controle-sujet.test.ts (3 tests).
- BLOQUÉ, CORRECTIF REQUIS : ces 3 tests (et 2 de usine-comite-affichage) fabriquent une idée sans format et comptaient sur le repli ; leur fichier n'est pas dans fichiers_autorises. Donner un format (ex. Facecam) à leur doublure d'idée.
- PILOTAGE : le journal côté usine est dans STU-PORTE-CMD ; le 422 vers l'usine n'est pas câblé ici (actions.ts hors liste).
- contrôle anti-fuite : vide
