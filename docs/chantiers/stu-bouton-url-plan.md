# STU-BOUTON : plan (escaladé, aucun code)

## Constat
- Port d'envoi : `src/fournisseurs/zernio-inbox.ts` (`envoyerMessage`, `versBoutons`) ; validation du corps : `src/fournisseurs/publication/zernio-inbox-corps.ts` (`exigerBoutons`, liste blanche `DOMAINES_PERMIS_PAR_DEFAUT`, `formeLienPageGuide`).
- Aujourd'hui seuls les boutons `postback` sont permis (type, titre ≤ 20, charge bornée).
- La doc Zernio du dépôt (`docs/zernio/openapi-extrait-1.418.1.json`, ADR 0001-0004, parcours-viral) ne décrit NI `buttons`, NI `postback`, NI un bouton de type URL pour les messages inbox : l'extrait OpenAPI ne contient pas les routes inbox.

## Pourquoi on s'arrête
Inventer la forme d'un bouton URL (`web_url`, `url`…) sans la doc serait une supposition sur un corps de requête envoyé à Meta.

## Plan une fois la forme documentée
1. Réglage neuf, éteint par défaut (seul `true` allume ; absent/illisible = corps actuel octet pour octet).
2. Dans `zernio-inbox.ts` : si allumé et si le lien signé de la page guide passe `formeLienPageGuide` + liste blanche, ajouter un bouton URL ; sinon repli sur le comportement actuel.
3. Dans `zernio-inbox-corps.ts` : autoriser ce type de bouton, URL limitée à NOS domaines.
4. Sans toucher `parcours-conversation.ts` ni `machine-conversation.ts` (le port reçoit le lien déjà calculé, à confirmer : si l'appelant ne le fournit pas, il faudra ces deux fichiers).
5. Tests : éteint = instantané identique ; allumé = bon bouton ; URL hors domaine = repli ; un stop gagne toujours ; mutations prouvées.

## Besoin
La documentation Zernio/Meta du bouton URL (gabarit bouton) ajoutée au dépôt, et la confirmation que l'appelant peut fournir le lien au port.
