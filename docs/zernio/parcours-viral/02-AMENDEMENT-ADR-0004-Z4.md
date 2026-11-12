# Amendement n°1 à l'ADR-0004 (Zernio Z4) · Ouverture limitée des webhooks et des messages

- Statut : proposé (documents seulement)
- Date : 2026-11-01
- Amende : ADR-0004, décision D6 (liste fermée de chemins) et D7 (filtre des mots interdits)
- Lié : ADR-0005 (parcours mot → e-mail → guide)

## Pourquoi un amendement
L'ADR-0004 (D6) refuse `webhooks/*` (« jusqu'à Z6 »), les messages et les automatisations. Le parcours viral a besoin de recevoir les commentaires, d'y répondre en public et d'écrire en privé. La liste fermée doit donc s'élargir, mais le moins possible, par chemin et par méthode, jamais par motif large. Les chemins exacts sont à figer depuis la description OpenAPI de Zernio (comme Z0) ; les noms ci-dessous sont des intentions, pas des chemins vérifiés.

## Ajouts demandés à D6 (intentions, chemins exacts à figer)
1. **Réception d'événements** : un seul webhook entrant, vérifié par signature. Création et mise à jour du webhook réservées à une action humaine ; le secret du webhook entrant est lu dans l'**environnement** (`ZERNIO_WEBHOOK_SECRET`, COR-PV2 ; et non en base), jamais dans le dépôt. Le format de signature reste à confirmer par un essai réel (voir `05-ESSAI-REEL-WEBHOOK.md`).
2. **Lecture** des commentaires et des conversations (méthode GET seule).
3. **Réponse publique** à un commentaire : une seule écriture, après contrôle « mot seul » (Q9) et « un seul envoi par commentaire et par personne ».
4. **Message privé** de réponse à un commentaire : écriture limitée aux gabarits validés ; forme « bouton Recevoir ici » seulement après une adresse mal écrite (Q2).
5. Reste refusé : tout DELETE, envois groupés, publicités, clés, connexion et déconnexion de compte, files d'attente, `publishNow`, messages à une personne qui n'a pas commenté, tout message sans événement déclencheur.

## Garde-fous ajoutés
- **Interrupteur propre** `parcours.envoi_autorise` (défaut : faux jusqu'à décision de l'opérateur), vérifié avant tout, en plus de `zernio.envoi_autorise`.
- **Plafonds** (par heure, par jour), **disjoncteur** automatique sur erreurs répétées, **« Tout arrêter »** avec confirmation.
- **Un seul envoi par commentaire et par personne**, journalisé.
- **D7 étendu** : les gabarits de réponse publique et de message privé passent par le filtre récursif des mots interdits (jetons concaténés compris), avant le réseau. Les textes entrants des commentateurs ne sont jamais copiés dans un envoi.
- **Pas d'adresse e-mail dans le Studio** : l'adresse transite vers le site sans être conservée ; le journal ne garde que des références opaques.
- **Aucun identifiant de compte, de page ou de personne en clair dans le dépôt** (D9 inchangé).

## Conséquences
- Positives : le parcours devient possible sans ouvrir toute l'API ; chaque chemin ajouté a son test de refus.
- Négatives : chaque évolution (autre réseau, autre type de message) exige un nouvel amendement ; le contrôle « mot seul » peut manquer quelques demandes légitimes écrites autrement (accepté, Q9).

## À DÉCIDER PAR L'OPÉRATEUR
- **Q11** : contrat de traitement et pays d'hébergement de Zernio : à lire avant d'activer l'interrupteur.
- **QG** : plafond de fabrication (borne budgétaire commune), montant À DÉCIDER (valeurs dans la note privée).

## Tests à prévoir
- Chemins ajoutés acceptés ; échantillon de chemins voisins refusés sans appel réseau.
- Interrupteur `parcours.envoi_autorise` faux : toute écriture du parcours refusée, lectures permises.
- Gabarit contenant un mot interdit (jetons concaténés) : refus avant le réseau.
- Deuxième envoi pour le même commentaire et la même personne : refusé.
