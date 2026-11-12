# ADR-0011 · Stockage et classement des visuels

- Statut : brouillon (à valider par le fondateur)
- Source : à confronter à D8-07 avant validation
- Date : 2026-11-11
- Chantier : usine à contenu, décision D8-07
- Liens : ADR-0010, ADR-0013

## Contexte

L'usine et le Studio produisent des visuels (images, vignettes, vidéos). Sans règle commune de rangement, les fichiers se perdent, se dupliquent ou deviennent introuvables.

## Décision

- Les visuels sont rangés dans le stockage objet du Studio, sous un chemin stable : réseau, format, puis identifiant du contenu.
- Chaque visuel porte une fiche minimale : identifiant, contenu d'origine, format, date de création, empreinte du fichier pour détecter les doublons.
- Classement par contenu et par format, jamais par personne.
- Rien n'est supprimé : un visuel retiré est archivé.
- Les ajouts manuels du fondateur ne sont jamais bloqués (sauf format technique refusé).
- Aucun identifiant de compte ni adresse de stockage dans le dépôt public.

## Conséquences

- Positives : retrouver un visuel, éviter les doublons, relire l'historique.
- À surveiller : taille du stockage, tests de chemin avec données fictives uniquement.
