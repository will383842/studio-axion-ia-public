# CAL-20 — journal des refus et règles proposées (final)
- Fait : domaine pur (src/domaine/calendrier/journal-refus.ts) et service en mémoire injectable (src/services/journal-refus.ts) ; aucun appel réel.
- Refus notés avec motif, date, réseau ; aucune suppression (liste en copie, pas de méthode supprimer).
- 3e refus du même motif (casse/espaces ignorés) : règle proposée une seule fois ; à 2 refus, rien.
- Une règle ne devient « appliquée » qu'après donnerAccord (accord du fondateur) ; refuserRegle l'écarte sans la supprimer.
- Fichiers : les 3 de la fiche + ce journal.
- Tests : tests/cal-20-journal-refus.test.ts, 10 passés, 0 échoué. Suite complète non lancée (consigne).
- Reste : la fiche signale que ce journal pourrait relever de l'usine (CAL-17) ; à trancher par le fondateur. Pas de dépôt de données (depots.ts non touché).
- contrôle anti-fuite : vide
