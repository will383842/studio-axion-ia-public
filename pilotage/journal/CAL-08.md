# CAL-08 : alertes discrètes du calendrier
Fait : service pur src/services/pret-a-partir.ts (liste de contrôle par réseau : texte, hashtags, premier commentaire, mot, fichier, date ; jamais bloquant, aucun prix) ; composant PretAPartir.tsx (liste du tiroir, bouton Copier) ; GrilleSemaine : compteur du jour, filtre « À compléter », case de créneau vide en pointillé ; CarteEntreeCalendrier : une seule icône d'alerte, infobulle = premier manque.
Fichiers : src/components/calendrier/{GrilleSemaine,CarteEntreeCalendrier,PretAPartir}.tsx, src/services/pret-a-partir.ts, tests/calendrier/cal-08-alertes.test.tsx.
Tests : test rouge d'abord (import absent), puis tests/calendrier (26 fichiers, 527 tests) et tests/visuels/couleurs-theme-seulement : verts. tsc et eslint : aucune erreur nouvelle sur les fichiers touchés.
Reste : brancher la page calendrier (hors périmètre : calendrier/page.tsx interdit) ; la lecture des mots (mots-lecture.ts) doit être passée par l'appelant, sinon « mot : à vérifier à la main ». Règle des hashtags (HSH-01) : valeur de départ « au moins un », à confirmer.
Douteux : le journal est dans pilotage/journal/ du dépôt public (la fiche ne donne pas d'autre emplacement).
