# Suivi Instagram (`follow-status`) — notes INSTA-A

Ce lot ajoute un client et un port de LECTURE seule. Aucun parcours ne les appelle : rien ne part en réel.

## Ce que dit la doc publique Zernio

- Route : `GET /v1/accounts/{accountId}/follow-status/{userId}`, paramètre facultatif `refresh`.
- Réponse : un champ `isFollower` valant `true` (la personne suit le compte), `false` (elle ne le suit pas) ou `null` (inconnu). La réponse peut aussi contenir un nom et un pseudo : notre code ne les lit jamais.
- `refresh=true` demande une lecture fraîche plutôt qu'une valeur mise en cache chez Zernio.

## Ce que fait notre code

- Liste fermée : seule la méthode GET est permise ; le seul paramètre permis est `refresh=true` ; aucun corps, aucune clé d'idempotence.
- Lecture : `true` → suit ; `false` → ne suit pas ; tout le reste (null, absent, chaîne, corps illisible) → inconnu. Seul le champ `suit` est rendu.
- Port : compte hors liste permise ou identifiant illisible → panne définitive sans appel ; erreur passagère (débit, limite incertaine, à vérifier, délai, 5xx, envoi coupé) → non définitive ; autre erreur Zernio → définitive.
- Un résultat inconnu ou une panne ne vaut JAMAIS « suit » : au moindre doute, rien ne part.

## Ce qui N'EST PAS prouvé

- L'accès à la route et son prix selon notre formule : à confirmer chez Zernio.
- L'identifiant attendu : est-ce bien celui de l'expéditeur du message privé reçu ? À vérifier.
- La fraîcheur réelle de la réponse avec `refresh=true`, et le délai entre un suivi et sa visibilité.

## Plan d'essai (compte de test uniquement)

1. Avec un compte de test fictif, une personne de test qui ne suit pas : lire, attendre `ne_suit_pas`.
2. Faire suivre le compte, relire aussitôt puis après quelques minutes : noter le délai avant `suit`.
3. Lire avec l'identifiant d'un expéditeur de message privé de test : vérifier que c'est le bon identifiant.
4. Noter le coût facturé par lecture et l'éventuel refus d'accès (403).
5. Ne rien brancher tant que ces quatre points ne sont pas notés.
