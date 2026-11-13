# ANNONCE L7-06 : fichiers ajoutés à la fiche (autorisation du pilote)

Fiche: L7-06 (Zernio devient l'outil d'envoi par défaut). Le pilote autorise, en plus de la liste de la fiche, ces fichiers
dont les attentes dépendaient encore de l'ancien défaut Buffer :

- outils/gardes/regles-de-fer.mjs : retrait des deux seules exceptions « date-buffer » périmées (finitions-envoi.ts, outil-publication.ts) ; garde resserrée, jamais relâchée.
- tests/a-publier.test.ts : attentes mises au défaut Zernio (faux client), aucun test retiré ni sauté.
- tests/r1-ecrans-buffer.test.ts : libellé du bouton d'envoi mis au défaut Zernio.

Aucune zone interdite touchée : tests/zernio/z3e-envoi.test.ts reste à la session Zernio (accord demandé à part). Aucune zone partagée touchée.
