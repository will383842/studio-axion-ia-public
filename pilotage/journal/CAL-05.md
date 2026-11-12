# CAL-05 : vue Mois (FAIT, à relire, 12/11/2026)
- Fait : GrilleMois (L4-03) tenait déjà 6 rangées, lundi d'abord, repère par réseau. Ajout dans calendrier-plages.ts de jourDeParis (instant → jour de Paris, vide/illisible → null) et adresseVueJour (clic → vue Jour, pas la semaine). GrilleMois.tsx inchangé. Test autorisé d'office : tests/calendrier/cal-05-vue-mois.test.tsx.
- Critères tenus (test) : 1er sous le bon jour, 6 rangées, nov. 2026 et févr. 2027 :39-62 ; jours de Paris, 23 h 30 le 30 reste le 30 :65-89 ; clic → vue Jour (CORRECTIF 12/11, remplace « la semaine ») et repère par réseau :92-117.
- Tests : cal-05 9 passés, 0 échoué (rouge avant : jourDeParis et adresseVueJour absents) ; tests/calendrier + calendrier-*.test + couleurs-theme-seulement : 425 passés, 0 échoué. tsc : 147 erreurs, comme master, 0 nouvelle. Aucune couleur ajoutée.
- PILOTAGE : la maquette calcule 4 à 6 rangées selon le mois, la fiche impose 6 (février 2027) : 6 gardé, à trancher. La vue Mois de la page (VueMois, page.tsx, hors liste) n'utilise pas encore GrilleMois ni adresseVueJour : à brancher.
- contrôle anti-fuite : vide
