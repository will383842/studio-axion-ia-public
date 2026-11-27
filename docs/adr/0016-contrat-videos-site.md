# ADR-0016 · Vidéos sur le site : le contrat du site fait foi

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-27
- Chantier : encart vidéo côté Studio (fiche QS-EV-STUDIO), PR 1 : décision écrite, aucun code
- Liens : conception « encart vidéo » du dépôt du site (branche `docs/conception-encart-video`, § 1.6 et § 9, lot S-0)

## Contexte

Le Studio envoie une vidéo au site par un appel signé (le Studio pousse, le site reçoit ; le site n'appelle jamais le Studio). Les deux dépôts ont écrit chacun leur contrat, et ils ne correspondent pas :

- les noms de champs diffèrent (`versionContrat` / `schemaVersion`, `idStudio` / `studioVideoId`, `slugPropose` / `slug`, `dureeSec` / `dureeSecondes`…) ;
- le site refuse tout champ inconnu (objets stricts) : tel quel, chaque envoi reçoit un 422 ;
- les bornes de longueur diffèrent (titre 1 à 60 chez le Studio, 20 à 100 chez le site, etc.) ;
- les routes diffèrent (retrait, réglages) et les réponses aussi (code 201, champs `version` et `rejeu`, erreurs sous `champs`) ;
- un 404 de route est lu par le Studio comme « vidéo inconnue », donc comme un succès : un retrait raté passerait sans aucun signal.

## Décision

1. **Le contrat du site fait foi** (il est en production, strict, et porte les attestations). Le Studio s'aligne ; le site ne bouge pas pour lui.
2. Le Studio n'envoie que ce que le site attend : plus de `motsCles`, `generateur`, `credits`, `publieLe`.
3. Les bornes de longueur du site deviennent des contrôles bloquants du Studio : une page qui ferait 422 au site est « à relire avant le site » côté Studio, avant tout appel.
4. Les routes sont celles du site : `POST /api/interne/videos`, `DELETE /api/interne/videos` (avec un corps portant la version, l'identifiant de la vidéo et le motif), `GET /api/interne/reglages-publics`.
5. Un 404 de route n'est plus « vidéo inconnue ». Seul le corps `{ erreur: "video_inconnue" }` l'est.
6. Un retrait est **définitif** côté site : republier une vidéo retirée donne 409. Le Studio ne tente pas de la reprendre ; une vidéo qui revient passe par une nouvelle identité de page. (Si le fondateur préfère que le site accepte la republication, ce sera un changement du site et une autre décision.)
7. Rien ne s'allume par cette décision : l'envoi réel reste éteint (fournisseur « simulation » par défaut, stockage public non relié).

## Découpage (Studio)

| PR | Contenu |
|----|---------|
| 1 | Cette décision (document seul) |
| 2 | Routes et réponses du fournisseur alignées sur le site, test croisé |
| 3 | Thèmes fermés et bornes de longueur du site, en contrôles purs |
| 4 | Corps d'envoi aligné sur le schéma du site (fonction pure, pas encore branchée) |
| 5 | L'archivage d'une vidéo la retire aussi du site |
| 6 | Marqueur « décochée par le fondateur » et garde pure d'envoi automatique |
| 7 | Déclencheur « validée » hors verrou, derrière un interrupteur éteint par défaut |

Hors de ces sept PR, à faire plus tard : vignettes 4:3, 1:1 et affiche 16:9 (zone miniatures, à annoncer), stockage public réel sur un seau R2 dédié (geste du fondateur), branchement des variables (fiche manuelle).

## Conséquences

- Les PR 2 à 7 s'appuient sur cette décision ; aucune n'envoie quoi que ce soit en réel.
- Le test croisé de la PR 2 est la preuve : il rejoue les trois appels (réglages, publication, retrait) contre les formes que le site attend.
