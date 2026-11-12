# CAL-12b : mode Agenda sur téléphone (FINAL, à relire)
- Fait : VueAgenda.tsx, la semaine en liste jour par jour (lundi d'abord), cartes de CAL-12 ; un appui ouvre ApercuPublication (tiroir de CAL-12, feuille du bas à 860 px) ; flèches sur la liste filtrée ; aujourd'hui marqué et amené à l'écran. Test autorisé d'office : non (chemin dans la fiche).
- Fichiers : src/components/calendrier/VueAgenda.tsx, tests/calendrier/cal-12b-agenda.test.tsx, ce journal.
- Tests : cal-12b 16 passés, 0 échoué (rouge avant le code : module absent) ; dossiers voisins (tests/calendrier, rc-36, rc-37) 21 fichiers, 372 passés, 0 échoué. tsc : 147 erreurs sur master, 147 avec la branche (aucune nouvelle). eslint : rien.
- Critères : 375 px sans défilement horizontal : tenu cal-12b-agenda.test.tsx bloc « ne crée aucun défilement horizontal » (classes, pas de navigateur) ; appui ouvre le tiroir : bloc « un appui ouvre le tiroir de CAL-12 » ; jour vide en une phrase, vouvoiement : bloc « un jour sans publication ».
- CORRECTIF 12/11 : boutons d'au moins 38 px : tenu, test « au moins 38 px de haut ». « Sous 860 px, le menu se cache et le calendrier s'ouvre sur aujourd'hui » : l'ouverture sur aujourd'hui est faite ici (défilement vers le jour, sans animation si le système la déconseille) ; le menu caché et le choix de cette vue sous 860 px relèvent de la page (hors liste).
- Reste : brancher VueAgenda dans la page /calendrier sous 860 px (et lui passer `criteres` et l'action de décalage) ; sans action, le tiroir dit d'ouvrir la vue Semaine.
- Douteux : rendu non vérifié dans un navigateur (pas de jsdom) ; couleurs : jetons du thème seulement.
- contrôle anti-fuite : vide

## Corrections après relecture
- Corrigé (à corriger 1) : sous un filtre, un jour qui a des publications masquées dit « Aucune publication avec ces filtres. » (mot de la maquette), plus « rien de prévu ». Un jour sans aucune publication garde sa phrase « rien ce jour ». Tenu : tests/calendrier/cal-12b-agenda.test.tsx, blocs « un filtre qui masque tout », « un filtre qui garde une partie du jour », « sans filtre ». Rouge avant le code (2 échecs), vert après.
- PILOTAGE : branchement de VueAgenda dans src/app/(studio)/calendrier/page.tsx sous 860 px, hors fichiers_autorises, CORRECTIF requis. Lignes à ajouter : (a) `import { VueAgenda } from "@/components/calendrier/VueAgenda";` après la ligne 15 ; (b) juste avant le bloc « Ordinateur » (ligne 152), `<div className="min-[860px]:hidden"><VueAgenda entrees={semaine.map(entreeDepuisPublication)} semaineDu={lundiCle} aujourdhui={aujourdhui} /></div>` ; (c) le bloc ordinateur (ligne 153, `hidden lg:block`) devient `hidden min-[860px]:block` si la bascule doit se faire à 860 px ; (d) la liste par jour déjà rendue en mobile par la page (autour des lignes 125-146) est à retirer ou à garder selon la décision. Le menu caché sous 860 px relève aussi de la mise en page, hors fiche.
- Remarque maquette (phrases de jour vide, vue Jour sous 860 px) : PILOTAGE, le pilote dit laquelle fait foi ; non modifiée.
- Remarque (défilement horizontal prouvé par les classes seulement) : reporté, pas de navigateur dans ce test.
- Tests : cal-12b 18 passés, 0 échoué ; tests/calendrier + couleurs 22 fichiers, 434 passés, 0 échoué. tsc : 147 erreurs, comme master (aucune nouvelle). master fusionné (aucun conflit).
- contrôle anti-fuite : vide
