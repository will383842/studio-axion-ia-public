Encart vidéo, côté Studio : archiver une vidéo la retire aussi du site

## Ce que fait la PR
`archiverVideos` retire d'abord du site (page et fichiers publics) toute vidéo qui y est ou a pu y être, comme le font déjà la suppression définitive et la corbeille. Avant, une vidéo archivée restait en ligne. Si le site ne répond pas, rien n'est archivé et l'erreur le dit. Une vidéo jamais publiée : aucun appel au site.

Dépendance : à fusionner après la PR 2 (routes alignées), sinon le retrait du site n'aboutirait pas. Touche `services/videos.ts` (fichier partagé) : à annoncer à la session qui met le Studio en ligne.

## Base
`master`.

## Tests
- `tests/site-videos/encart-4-archivage.test.ts` (écrit rouge d'abord : 2 échecs sur 3 avant le code).
- `tests/site-videos`, `corbeille`, `correctifs`, `fiche-video-statut-usine`, `verification-transversale` : verts. Un test, `e2e1-console-services` n° 17 (recherche de personnages), échoue déjà sur `master`, sans lien avec cette PR.
- Lint ciblé propre.

VERDICT OPUS : BON
