# ADR-0010 · Calendrier éditorial propre au Studio

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-11
- Chantier : usine à contenu, décision D8-07
- Liens : ADR-0001, ADR-0013

## Contexte

Le Studio doit pouvoir programmer ses publications à la main dès la première version, sans attendre l'usine. L'usine, de son côté, propose des dates par défaut. Il faut dire qui décide de quoi, sans ambiguïté, pour éviter deux calendriers qui se contredisent.

## Décision

- Le Studio tient son propre calendrier éditorial : la programmation à la main est possible dès la V1.
- Par défaut, la date d'une publication est fixée par l'usine (décision D-14 maintenue).
- Le choix du fondateur l'emporte toujours : une date posée ou changée à la main dans le Studio remplace la date proposée par l'usine, et l'usine ne la modifie plus.
- Le Studio fait foi pour une date posée à la main ; pour une date non touchée, c'est la proposition de l'usine qui s'applique. Cette nuance doit toujours rester écrite.
- Rien ne part sans la validation du fondateur : le calendrier ne déclenche aucun envoi à lui seul.

## Conséquences

- Positives : un seul sens de priorité, lisible ; la programmation manuelle ne dépend pas de l'usine.
- À surveiller : afficher dans le Studio l'origine de chaque date (usine ou main) ; test de non-écrasement d'une date posée à la main.
- Aucune donnée privée dans ce document.
