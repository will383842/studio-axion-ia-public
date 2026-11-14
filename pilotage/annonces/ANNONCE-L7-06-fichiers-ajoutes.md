# ANNONCE L7-06 : fichiers ajoutés à la fiche (autorisation du pilote)

Fiche: L7-06 (Zernio devient l'outil d'envoi par défaut). Le pilote autorise, en plus de la liste de la fiche, ces fichiers
dont les attentes dépendaient encore de l'ancien défaut Buffer :

- outils/gardes/regles-de-fer.mjs : retrait des deux seules exceptions « date-buffer » périmées (finitions-envoi.ts, outil-publication.ts) ; garde resserrée, jamais relâchée.
- tests/a-publier.test.ts : attentes mises au défaut Zernio (faux client), aucun test retiré ni sauté.
- tests/r1-ecrans-buffer.test.ts : libellé du bouton d'envoi mis au défaut Zernio.
- src/services/comptes-envoi-zernio.ts (nouveau) et tests/publication/a-publier-zernio-comptes.test.ts (nouveau) : comptes Zernio à cocher dans « À publier » (relecture Opus, point 4.1).
- src/services/zernio-cibles.ts, src/app/(studio)/reglages/actions-zernio.ts : phrase sans « Compte Buffer » ; « Tester » garde les cibles Zernio.
- 8 fichiers de tests/zernio (e2e-01-routage, e2e-04-service, z2e-anti-doublon, z2s-routage, z3c-connexions, z1t-outil-publication, z3c-arret-et-comptes, fin-zernio-finitions) : attentes remises au défaut Zernio, accord écrit du parcours viral.

Aucune zone interdite touchée : tests/zernio/z3e-envoi.test.ts reste à la session Zernio (accord demandé à part). Aucune zone partagée touchée.
