Encart vidéo, côté Studio : une vidéo qui devient « validée » part au site (interrupteur éteint par défaut)

## Ce que fait la PR
- Nouvel interrupteur `site.repriseValidees`, **éteint par défaut** : tant qu'il est éteint, rien ne change.
- `reprendreSiValidee` : quand l'étape d'une vidéo devient « validée », elle est envoyée au site après coup (jamais sous un verrou, car un appel au site peut durer 10 s), à condition que la garde de la PR 5 l'accepte (jamais « à relire », jamais retirée, jamais décochée par le fondateur) et que `publicationAuto` accepte aussi (générateur autorisé, envoi automatique allumé, contrôles SITE-01 à 17). Elle ne lève jamais.
- `rattraperVideosValidees` : passe de rattrapage à lancer à la main, pour les vidéos déjà validées, programmées ou publiées.
- Branchée seulement dans `changerEtapeEditoriale`. Les autres endroits où une vidéo devient validée (validation de version, validation en lot, fin de fabrication) sont à brancher dans une suite, pour garder cette PR petite.

## Base
`feat/encart-video-studio-5` (la garde et le marqueur de la PR 5, intégrés par fusion de branche, sans réécriture). À fusionner après la PR 5. Touche `services/videos.ts` et `services/site-videos.ts` : à annoncer à la session qui met le Studio en ligne.

## Tests
- `tests/site-videos/encart-6-reprise-validees.test.ts` (écrit rouge d'abord : 7 échecs avant le code).
- `tests/site-videos` : 293 tests verts, lint ciblé propre.

VERDICT OPUS : en attente
