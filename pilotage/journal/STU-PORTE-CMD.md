# STU-PORTE-CMD : porte v2 côté Studio, appel 1 (recevoir une commande de l'usine)
Fait : route POST /api/usine/commandes (jeton vérifié par garderPorte ; porte fermée tant que le secret du studio n'est pas posé). Une commande valide crée UN créneau « propose » d'origine usine ; jamais programmé ni publié, aucun envoi.
- Rejeu : l'identifiant du créneau vient de la clé d'idempotence ; même clé, aucun doublon (200, deja: true).
- Quota : au-delà de 1 créneau occupé par réseau et par jour (valeur de départ à confirmer), la commande est mise de côté (paramètre « usine-commande-cote:<clé> », aucun créneau), réponse 202.
- « Tout arrêter » : refus 423 avant toute lecture ou écriture.
Fichiers : src/app/api/usine/commandes/route.ts, tests/porte-v2/commandes.test.ts, ce journal.
Tests : test rouge d'abord (route absente), puis tests/porte-v2, tests/cadence et tests/porte-usine-garde-budget.test.ts : 116 verts. tsc et eslint : aucune erreur.
Hypothèses à relire (la fiche ne décrit que les trois critères) :
- Corps de la commande (contrat 2) : cle, reseau, jour, instant (ISO UTC), compteCible, videoId ou visuelId, repere : choisi ici, à aligner sur le contrat de l'usine.
- U-ARRET (dépôt usine) n'est pas fusionnée : l'état « Tout arrêter » est lu dans la variable USINE_TOUT_ARRETER (vide, 0, false, non : éteint ; toute autre valeur : actif). À remplacer par le contrat de U-ARRET.
- « Débloquable d'un clic » : la commande est conservée, mais le bouton de déblocage n'existe pas (hors fichiers autorisés) ; à prévoir dans une fiche d'écran.
