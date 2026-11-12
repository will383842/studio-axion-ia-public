# CAL-02 : vue du jour du calendrier (FAIT, 12/11/2026)
- Fait : ?vue=jour&date= (heure par heure, heure de Paris, créneaux « Libre » de 8 h à 19 h, élargis aux publications hors plage ; jour passé sans créneau libre), début du texte (110 car. au plus), filtres ?reseaux=a,b (pastilles), bouton segmenté Semaine | Mois (BarreVue, pas de bouton Jour), flèches/Aujourd'hui/« Retour à la semaine » gardant date et filtres. Jour ouvert par clic : case du mois et tuile de jour de la liste mobile.
- Fichiers : page.tsx (modifié, rien retiré), VueJour.tsx (nouveau), tests/cal-02-vue-jour.test.tsx (test autorisé d'office). Départ origin/master (L4-05, L4-15, CAL-01 dedans).
- Tests : 393 passés, 0 échoué (21 fichiers : cal-02, calendrier-page, tests/calendrier, calendrier-composants, rc-36, e2e1-console-ecrans, final-b-mobile, lecture, plages). Rouge sans le code : 19 échecs sur 23 (vérifié). Suite complète non lancée (consigne).
- Critères : jour trié + créneaux libres, tenu cal-02 « affiche… triées » et « créneaux libres » ; bascule garde date et filtres, tenu « garde la date et les filtres » ; bouton Semaine|Mois, jour par clic, tenu « deux boutons seulement » et « clic sur un jour du mois ». CORRECTIFS 11/11 (rang 2 : routine code ; rang 29 : pas de 3e bouton) tenus. Pièges : rien retiré (« ?semaine=N »), vouvoiement, aucun prix : tenus (dernier test).
- PILOTAGE : tests/calendrier/liens.test.ts (L4-15) fige « Semaine = /calendrier » en vue mois et semaine datée : le lien Semaine de ces deux vues ne garde donc pas la date (il garde les filtres) ; à lever par CORRECTIF. Le clic sur l'en-tête de jour de la grille ordinateur (ApercuPublication.tsx, hors liste) n'ouvre pas encore le jour ; la case du mois et la tuile mobile le font.
- Douteux : les filtres ?reseaux= ne s'appliquent que dans la vue du jour (semaine et mois les transportent dans les liens sans filtrer) ; « Ajouter » sur un créneau libre non fait (hors liste) ; rendu visuel non vérifié.
- contrôle anti-fuite : vide

## Corrections après relecture (u1, 12/11/2026)
- Bouton segmenté sur les trois vues : corrigé. Semaine et Mois rendent BarreVue (flèches, Aujourd'hui, « Semaine | Mois »), ChoixVue est supprimé. Tenu : tests/cal-02-vue-jour.test.tsx « le bouton segmenté… » (3 vues).
- Lien Semaine de la vue Mois : corrigé, garde la date (celle demandée, sinon celle d'aujourd'hui) et les filtres ; la semaine datée garde aussi sa date ; sans date, /calendrier. Tenu : « vue mois : Semaine garde la date… », « vue semaine datée… ».
- tests/calendrier/liens.test.ts (L4-15, hors liste, modifié sur demande de l'avis) : l'attente « Semaine = /calendrier » vaut désormais pour la vue sans date seulement.
- Remarques (filtres ?reseaux= hors vue Jour, bouton « + Ajouter ce jour-là ») : reportées, fichiers hors liste.
- tsc : master 147 erreurs, branche 147, identiques (0 nouvelle). Contrôle anti-fuite : vide.
- Rouge sans le code : 8 échecs sur 37 (vérifié). Après : 449 passés, 0 échoué (23 fichiers : cal-02, tests/calendrier, calendrier-*, rc-36, rc-37, e2e1-console-ecrans, final-b-mobile, couleurs-theme-seulement).
