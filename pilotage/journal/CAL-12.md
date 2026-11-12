# CAL-12 : tiroir en dialogue modal accessible (FINAL, à relire)
- Fait : TiroirAccessible.tsx (<dialog> natif, showModal(), aria-modal, Échap, piège du focus, retour à la carte, clic sur le voile, feuille du bas à 860 px et moins comme la maquette, sans glissement si le système demande moins d'animations). ApercuPublication.tsx passe par lui ; SemaineAvecApercu reçoit `criteres` (filtres RC-37) : grille et flèches ne parcourent que la liste filtrée.
- Fichiers : src/components/calendrier/TiroirAccessible.tsx, ApercuPublication.tsx, tests/calendrier/cal-12-tiroir.test.tsx, ce journal. Aucun autre fichier.
- Tests : cal-12 19 passés, 0 échoué (4 rouges sans le changement d'ApercuPublication, tous rouges avant le code) ; dossiers voisins (tests/calendrier, rc-36, rc-37, calendrier-*) 20 fichiers, 355 passés, 0 échoué. tsc et eslint : rien. Suite complète non lancée (règle).
- Critères : Échap/focus/retour carte : tenu cal-12-tiroir.test.tsx, blocs « Échap et clic », « showModal » ; Suivant/Précédent filtrés : bloc « liste FILTRÉE » ; téléphone 375 px : bloc « feuille du bas » ; <dialog> + showModal + piège + aria-modal : blocs 1 et 2.
- CORRECTIF 12/11 « moins d'animations, sans glissement » : tenu, bloc « feuille du bas… moins d'animation » (le test lit le texte du CSS, faute de navigateur).
- CORRECTIF 11/11 : mode Agenda mobile = CAL-12b, non fait ici.
- Reste : la page /calendrier (hors liste) ne passe pas encore `criteres` à SemaineAvecApercu, ni les filtres RC-37 ; à brancher dans une fiche suivante. Rendu non vérifié dans un navigateur (pas de jsdom) : douteux, surtout l'animation et l'inertie du fond.
- L'ancienne <aside> reste à l'intérieur du dialogue pour garder les tests RC-36 verts (flèches du clavier).
- contrôle anti-fuite : vide
