Encart vidéo, côté Studio : le corps d'envoi au format du site (fonction pure, pas encore branchée)

## Ce que fait la PR
- Nouvelle fonction pure `corpsSite` : fabrique le corps exact que le site attend (`schemaVersion`, `studioVideoId`, `version`, `slug`, `description`, `theme`, `lien`, `fichiers` avec empreinte et dimensions, `ia`, `personnesALImage`, `attestations`…). Plus de `motsCles`, `generateur`, `credits`, `publieLe`. Durée arrondie à l'entier, chapitres convertis (`finSec` supprimé), transcription vide devenue `null`.
- Sans l'attestation « aucun client nommé, aucun logo », la fonction refuse de fabriquer le corps ; `personnesALImage` n'a pas de valeur par défaut.
- Test croisé : une copie du schéma strict de réception du site (`tests/site-videos/helpers-schema-site.ts`) valide le corps produit ; elle refuse bien un corps hors bornes.
- Rien ne l'appelle encore : l'envoi réel continue d'utiliser l'ancien corps. Le branchement (description, lien, vignettes 4:3 et 1:1, clés de fichiers du site) vient dans une suite, avec le stockage public réel.

## Base
`master`, indépendante des autres PR.

## Tests
- `tests/site-videos/encart-7-corps-site.test.ts` : 9 tests ; lint ciblé propre. La copie du schéma reprend aussi les règles croisées du site (chapitres, chemins). Les chapitres dont le début arrondi tomberait sur la durée ou sur le précédent sont écartés, et aucun chapitre n’est envoyé sous 30 s. Relecture opus : tours 1 et 2 « À corriger », corrigés ; tour 3 BON.

VERDICT OPUS : BON
