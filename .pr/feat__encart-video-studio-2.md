Encart vidéo, côté Studio : le Studio parle au site avec les bonnes routes et sait lire ses réponses

## Ce que fait la PR
- Réglages : lus sur `GET /api/interne/reglages-publics` (route du site).
- Retrait : `DELETE /api/interne/videos` avec un corps `{schemaVersion, studioVideoId, motif}` (motif par défaut « obsolete »). Un 404 n'est « vidéo inconnue » que si le corps le dit (`video_inconnue`) ; une route absente lève maintenant une erreur claire (« route-absente ») au lieu de passer pour un succès.
- Publication : lit le 201 de la première publication, `version` et `rejeu`.
- Erreurs : champs en faute lus dans `champs`, les 409 se distinguent (retirée = définitif, adresse non disponible, version plus récente), 503 « réception éteinte » a sa phrase.
- Le site factice et les exemples du contrat (`docs/site-videos/contrat/`) suivent les mêmes formes.
- Rien n'est branché : le fournisseur « simulation » reste le choix par défaut.

Limites connues : le site rend `qualiopiCertificationObtenue` alors que le Studio lit `certifexempleCertificationObtenue` (nom anonymisé dans cette copie publique ; à aligner après vérification dans le dépôt privé) : la certification se lit donc « inconnue », ce qui rend les contrôles plus stricts, jamais moins ; `schemaVersion` des réglages n'est pas encore vérifié ; le plan `PLAN-LOTS-STUDIO.md` cite encore les anciennes routes. Aussi : le site factice laisse encore republier une vidéo retirée (le vrai site répond 409) ; à aligner dans une PR suivante avec la reprise automatique. Relecture opus, tour 1 : « À corriger », corrigé (200 de retrait vérifié, message du 409 `version_deja_publiee`, motif transmis par la simulation du registre, test des réglages). Le corps du POST (noms de champs) est traité par les PR 3 et 4.

## Base
`master` (indépendante des autres PR de la série ; la décision écrite est dans la PR 1).

## Tests
- Nouveau : `tests/site-videos/encart-2-routes-reponses.test.ts` (écrit rouge d'abord : 9 échecs avant le code).
- `tests/site-videos` : 289 tests verts. Typecheck complet propre, lint ciblé propre.

VERDICT OPUS : BON
