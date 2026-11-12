# CAL-12b : mode Agenda sur téléphone (FINAL, à relire)
- Fait : VueAgenda.tsx, la semaine en liste jour par jour (lundi d'abord), cartes de CAL-12 ; un appui ouvre ApercuPublication (tiroir de CAL-12, feuille du bas à 860 px) ; flèches sur la liste filtrée ; aujourd'hui marqué et amené à l'écran. Test autorisé d'office : non (chemin dans la fiche).
- Fichiers : src/components/calendrier/VueAgenda.tsx, tests/calendrier/cal-12b-agenda.test.tsx, ce journal.
- Tests : cal-12b 16 passés, 0 échoué (rouge avant le code : module absent) ; dossiers voisins (tests/calendrier, rc-36, rc-37) 21 fichiers, 372 passés, 0 échoué. tsc : 147 erreurs sur master, 147 avec la branche (aucune nouvelle). eslint : rien.
- Critères : 375 px sans défilement horizontal : tenu cal-12b-agenda.test.tsx bloc « ne crée aucun défilement horizontal » (classes, pas de navigateur) ; appui ouvre le tiroir : bloc « un appui ouvre le tiroir de CAL-12 » ; jour vide en une phrase, vouvoiement : bloc « un jour sans publication ».
- CORRECTIF 12/11 : boutons d'au moins 38 px : tenu, test « au moins 38 px de haut ». « Sous 860 px, le menu se cache et le calendrier s'ouvre sur aujourd'hui » : l'ouverture sur aujourd'hui est faite ici (défilement vers le jour, sans animation si le système la déconseille) ; le menu caché et le choix de cette vue sous 860 px relèvent de la page (hors liste).
- Reste : brancher VueAgenda dans la page /calendrier sous 860 px (et lui passer `criteres` et l'action de décalage) ; sans action, le tiroir dit d'ouvrir la vue Semaine.
- Douteux : rendu non vérifié dans un navigateur (pas de jsdom) ; couleurs : jetons du thème seulement.
- contrôle anti-fuite : vide
