# CAL-03 : lire la vidéo, feuilleter le carrousel, agrandir l'infographie (FAIT, à relire)
- Fait : src/components/calendrier/ApercuMedia.tsx (vidéo : lecteur avec commandes et son ; carrousel : une seule image chargée à la fois, boutons et flèches du clavier, « Page n sur N » ; infographie : bouton « Agrandir », fenêtre avec Échap/Fermer ; icône et libellé de type via TYPES_CONTENU, jetons du thème seulement) ; src/services/pdf-pages.ts (une image par page à l'import, clés ordonnées, plafond de 20 pages, page illisible signalée sans bloquer ; rendu, comptage et rangement injectés, aucune dépendance ajoutée).
- Test : tests/cal-03-apercu-media.test.tsx, 16 passés (rouge d'abord : composant absent). Aucun appel réel.
- tsc : 147 erreurs, comme master (0 nouvelle). eslint : 0 erreur ; 3 avertissements @next/next/no-img-element dans ApercuMedia (pas d'eslint-disable posé ; master en a un dans ApercuPublication).
- Reste : brancher ApercuMedia dans ApercuPublication et fournir les liens (hors fichiers autorisés, ApercuPublication non touché) ; appeler rendrePagesPdf à l'import CAL-25 avec un vrai moteur de rendu (non fourni, aucune dépendance ajoutée) ; page /calendrier non touchée.
- Rien n'est publié.
- CORRECTIF (relecture z4) : ApercuMedia, le focus entre dans la fenêtre à l'ouverture (sur « Fermer »), Échap ferme, le focus revient au bouton déclencheur, Tab ne sort pas de la fenêtre ; boutons de 44 px au moins ; 20 essais passés ; tsc 146 erreurs avant et après ; eslint 0 erreur (3 avertissements img déjà présents).
contrôle anti-fuite : vide
