# NEW-ARG-01-tests : tests rouges après le retrait des prix
Lancés : s3-fiche-ui, fiche-video-ordre, e2e1-restes-mineurs, c3-scripts-reels. 4 échecs, tous causés par un prix ou un coût qui n'est plus affiché (décision du fondateur : aucun prix dans le Studio). Les 48 autres tests passaient.
Alignés (seul tests/ touché ; le reste de chaque test est conservé) :
- c3-scripts-reels B11 : la page Atelier n'appelle plus `prixLancement` ni n'écrit de montant (assertion inversée) ; le calcul du service reste testé.
- fiche-video-ordre : la fiche n'appelle plus `chiffresCoutVideo`, la liste de coûts passée à OngletDetails est vide.
- e2e1-restes-mineurs n° 24 : idem ; la pastille Essai sur un chiffre est vérifiée dans ChiffresVideo.tsx, où elle vit.
- s3-fiche-ui : « Réécrire avec Claude » reste proposé si le réglage est allumé, sans « ≈ » ni montant.
Échec d'une autre cause : aucun.
Lien « Voir la migration » (BlocZernio.tsx ligne 123) : href="/reglages#migration", soit la page Réglages. L'ancre existe : <span id="migration"> dans src/app/(studio)/reglages/page.tsx (ligne 223). Rien changé.
Tests : les 4 fichiers verts (52 tests). tsc et eslint : aucune erreur sur ces fichiers.
