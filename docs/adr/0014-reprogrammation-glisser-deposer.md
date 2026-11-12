# ADR-0014 · Reprogrammation : événements pointer natifs plutôt qu'une bibliothèque de glisser-déposer

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-12
- Chantier : calendrier éditorial, fiche CAL-11a
- Liens : ADR-0010

## Contexte

Le calendrier doit permettre de déplacer une publication d'un jour à un autre en la faisant glisser. Deux voies existent : une bibliothèque de glisser-déposer, ou les événements pointer du navigateur (pointerdown, pointermove, pointerup) écrits dans le Studio. Une nouvelle dépendance est une modification sensible : elle se décide par écrit avant tout code.

Contraintes : fonctionner au clavier et sur téléphone, rester léger, ne rien envoyer sans validation du fondateur, et afficher après chaque déplacement un bandeau « Annuler » de 10 secondes (même durée partout).

## Options comparées

| Critère | Bibliothèque de glisser-déposer | Événements pointer natifs |
| --- | --- | --- |
| Poids | Une dépendance de plus à installer, à mettre à jour et à auditer ; code ajouté au navigateur. | Aucun paquet ; quelques dizaines de lignes dans le Studio. |
| Clavier | Souvent fourni (capteur clavier), mais avec ses propres conventions à vérifier. | À écrire : sélection d'une carte, flèches pour changer de jour, validation explicite. Testable sans navigateur. |
| Téléphone | Gestes tactiles gérés, réglages à faire pour ne pas gêner le défilement. | Pointer unifie souris et doigt ; le geste long avant déplacement et la propriété `touch-action` évitent de bloquer le défilement. |
| Risque | Mises à jour, changements de version, compatibilité avec React 19 et Next. | Cas limites à couvrir soi-même (annulation du geste, sortie de zone), par des tests. |
| Cohérence | Deuxième manière de faire à côté des composants existants. | Reste dans le code du Studio, relisible par la même équipe. |

Un point commun aux deux : le déplacement ne fait que PROPOSER un nouveau jour. L'enregistrement passe par la même action de report que le bouton « Décaler » (L4-06), donc par la validation du fondateur ; une entrée confiée au diffuseur reste refusée par cette action.

## Décision

Les événements pointer natifs sont retenus ; aucune bibliothèque de glisser-déposer n'est ajoutée. Le fichier package.json n'est donc pas modifié par cette fiche, et la PR ne porte pas l'étiquette de fusion sensible.

Règles pour la fiche de mise en œuvre (CAL-11b et suivantes) :

- Chemin clavier obligatoire et équivalent au glisser : toute action possible à la souris l'est aussi au clavier, avec annonce vocale du jour visé.
- Téléphone : geste long avant de saisir une carte, `touch-action` réglé pour garder le défilement ; le bouton « Décaler » reste toujours disponible.
- Bandeau « Annuler » de 10 secondes après chaque déplacement, partout.
- Un échec ou une annulation du geste ne change jamais la date enregistrée.
- Si les tests montrent un cas impossible à tenir sans bibliothèque, une nouvelle décision écrite sera demandée au fondateur avant d'ajouter une dépendance.

## Conséquences

- Positives : aucun poids ni risque de chaîne d'approvisionnement ajouté ; un seul chemin d'enregistrement ; accessibilité testable.
- À surveiller : le code de gestes écrit à la main doit rester court et couvert par des tests (clavier, annulation, sortie de zone).
- Aucune donnée privée ni aucun montant dans ce document.
