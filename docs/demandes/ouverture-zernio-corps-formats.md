# Demande à la session Zernio : formats de médias relayés

Le Studio relaie les médias au diffuseur par une adresse publique à jeton : `https://<studio>/api/medias-publics/<jeton>/<nom>`.
Noms servis (et eux seuls) : `video.mp4`, `image.png`, `image.jpg`, `document.pdf`. Le jeton est signé et expire ; faux ou expiré = 404.
L'ancienne adresse `/api/media-buffer/<jeton>/video.mp4` reste valable (alias).

À confirmer par écrit avant toute activation :
1. Le diffuseur accepte-t-il ces quatre formats par adresse (HEAD puis GET) ?
2. Le diffuseur lit-il les en-têtes `Content-Type`, `Content-Length` et `Range` de ces réponses ?
3. Quel format de corps pour déclarer image, PDF et vidéo dans un brouillon ?

Aucun essai réel ni aucune activation sans cette confirmation écrite et un geste du fondateur.
