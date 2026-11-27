Encart vidéo, côté Studio : marqueur « décochée par le fondateur » et garde de reprise automatique

## Ce que fait la PR
- Nouveau marqueur `decocheeParWill` dans l'état « Sur le site » d'une vidéo : posé quand la case « Sur le site » est décochée, effacé quand elle est recochée. Respecter la seule valeur `choisie: false` ne suffirait pas, c'est aussi la valeur d'une vidéo jamais cochée.
- Nouvelle garde pure `gardeRepriseAuto` : une vidéo ne peut être reprise automatiquement que si son étape est validée, programmée ou publiée, qu'elle n'est pas retirée (retrait définitif côté site), pas un retrait raté, pas décochée par le fondateur, pas déjà en ligne.
- Rien n'est branché : aucun comportement existant ne change (`publicationAuto` est inchangée). Le déclencheur vient dans la PR 7.

## Base
`master`. Touche `domaine/site-videos/types.ts` et `services/site-videos.ts` : à annoncer à la session qui met le Studio en ligne.

## Tests
- `tests/site-videos/encart-5-reprise-auto.test.ts` (écrit rouge d'abord).
- `tests/site-videos` : 285 tests verts, lint ciblé propre.

VERDICT OPUS : en attente
