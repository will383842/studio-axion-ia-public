# ADR-0012 · Anti-répétition et sonde de publication

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-11
- Chantier : usine à contenu, décision D8-07
- Liens : ADR-0002, ADR-0010

## Contexte

Un contenu ne doit pas partir deux fois, ni ressembler trop à un contenu récent. Il faut aussi pouvoir vérifier qu'une publication est bien en ligne, sans la refaire.

## Décision

- Anti-répétition : avant toute programmation, le Studio compare le contenu à ceux déjà publiés ou programmés (empreinte du texte et des visuels, puis ressemblance). Un contenu trop proche est signalé au fondateur, qui tranche.
- Idempotence : une publication a une clé unique ; la rejouer ne produit jamais un second envoi.
- Sonde de publication : après une publication validée, une lecture seule vérifie l'état de l'envoi chez le diffuseur. La sonde n'écrit rien et ne republie jamais.
- En test, la sonde est remplacée par une doublure : aucun appel réel.
- Un échec de la sonde est signalé, jamais corrigé automatiquement.

## Conséquences

- Positives : pas de doublon, état de publication vérifiable.
- À surveiller : seuil de ressemblance à régler par le fondateur ; fréquence de la sonde limitée.
