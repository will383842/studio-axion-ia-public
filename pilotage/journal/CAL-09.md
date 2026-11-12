# CAL-09 : Semaine « Par réseau » en couloirs, densités Compact/Visuel, « + N autres »
Fait : GrilleSemaine accepte `densite` (Compact : 3 cartes par case sans titre ; Visuel : 2 cartes avec titre ; `DENSITES_SEMAINE`). Au-delà, « + N autres » : lien ou geste de l'appelant s'ils existent, sinon la case se déplie sur place (`<details>`) et montre toutes ses publications. Vues.tsx : `SelecteurDensiteSemaine` (boutons Compact/Visuel, `aria-pressed`) et `useDensiteSemaine`, choix retenu dans le navigateur (défaut Visuel, tolérant si la mémoire est fermée).
Fichiers : src/components/calendrier/{GrilleSemaine,Vues}.tsx, tests/calendrier/cal-09-couloirs.test.tsx.
Tests : test rouge d'abord (exports absents), puis tests/calendrier et tests/rc-37-vues-filtres : verts (538). tsc et eslint : aucune erreur nouvelle.
Reste : brancher le sélecteur et `densite` dans la page calendrier (ApercuPublication.tsx et page interdits ici). Le dépôt n'a pas jsdom : le clic réel n'est pas simulé, le test vérifie le rendu et la lecture/écriture de la mémoire.
Douteux : valeurs 3 et 2 cartes par case choisies faute de chiffre dans la fiche ; à confirmer sur la maquette. Aucun prix, aucun envoi.
