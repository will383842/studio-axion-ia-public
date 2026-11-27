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
2. Le Studio n'envoie que ce que le site attend : plus de `motsCles`, `generateur`, `credits`, `publieLe`. Il crée ce que le site exige et que le Studio n'a pas : `description` (80 à 300), `lien` obligatoire (liste blanche du site), `ia{voixGeneree, doubleNumerique}`, `personnesALImage` (jamais rempli par défaut), `attestations{aucunNomNiLogoDeClient}`, `serie: null` au début, et `transcription: null` plutôt qu'une chaîne vide.
3. Les bornes de longueur du site deviennent des contrôles bloquants du Studio : une page qui ferait 422 au site est « à relire avant le site » côté Studio, avant tout appel. Le titre est ramené à **20 à 60** caractères (le plafond de 60 du Studio est gardé, on ne l'ouvre pas jusqu'aux 100 du site).
4. Les routes sont celles du site : `POST /api/interne/videos`, `DELETE /api/interne/videos` (avec le corps `{schemaVersion, studioVideoId, motif}`), `GET /api/interne/reglages-publics`.
   Motifs, liste fermée du site : `obsolete`, `erreur`, `demande_tiers`, `autre`. Correspondance : archivage, corbeille et extinction d'un générateur donnent `obsolete` ; retrait manuel donne `autre`.
5. Un 404 de route n'est plus « vidéo inconnue ». Seul le corps `{ erreur: "video_inconnue" }` l'est. Les 409 se distinguent (retirée, adresse indisponible, version plus récente) et le 503 `reception_eteinte` a sa phrase claire.
6. Un retrait est **définitif** côté site : republier une vidéo retirée donne 409. Le Studio ne tente pas de la reprendre ; une vidéo qui revient passe par une nouvelle identité de page. (Si le fondateur préfère que le site accepte la republication, ce sera un changement du site et une autre décision.)
7. Rien ne s'allume par cette décision : l'envoi réel reste éteint (fournisseur « simulation » par défaut, stockage public non relié).

## Découpage (Studio)

| PR | Contenu |
|----|---------|
| 1 | Cette décision (document seul) |
| 2 | Routes et réponses du fournisseur alignées sur le site, test sur les routes et les réponses (réglages, publication, retrait) |
| 3 | Thèmes fermés et bornes de longueur du site, en contrôle pur éteint par défaut |
| 4 | Corps d'envoi aligné sur le schéma du site (fonction pure, pas encore branchée ; le branchement et le test croisé complet du corps relèvent de la suite, hors de ces sept PR) |
| 5 | L'archivage d'une vidéo la retire aussi du site |
| 6 | Marqueur « décochée par le fondateur » et garde pure d'envoi automatique |
| 7 | Déclencheur « validée » hors verrou, derrière un interrupteur éteint par défaut |

Hors de ces sept PR, à faire plus tard : branchement du corps aligné, contrôle bloquant « personnage qui témoigne » (tout personnage autre que le fondateur qui témoigne d'un résultat bloque l'envoi), vignettes 4:3, 1:1 et affiche 16:9 (zone miniatures, à annoncer), stockage public réel sur un seau R2 dédié (geste du fondateur), branchement des variables (fiche manuelle).

## Conséquences

- Ordre : l'archivage (PR 5) vient après l'alignement des routes (PR 2), sinon un retrait échouerait sans signal.
- Classe : les PR 2, 4, 5 et 7 touchent des fichiers partagés (`types.ts`, `services/videos.ts`, fournisseurs) : elles sont à annoncer à la session qui met le Studio en ligne, et prennent `sensible-a-fusionner` dès qu'elles envoient quelque chose.
- Les PR 2 à 7 s'appuient sur cette décision ; aucune n'envoie quoi que ce soit en réel.
- Le test de la PR 2 rejoue les trois appels (réglages, publication, retrait) contre les formes de réponse que le site rend ; le test croisé du corps de publication complet viendra avec le branchement du corps.
