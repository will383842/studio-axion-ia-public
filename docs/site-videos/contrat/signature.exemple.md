# Signature des appels du studio (contrat version 1)

Exemple vérifié par le test `s4-contrat` : changer une ligne ici sans changer le code (ou l'inverse) fait échouer le test.

Chaque appel porte trois en-têtes :

- `x-axion-horodatage` : secondes Unix ;
- `x-axion-nonce` : 16 octets aléatoires en hexadécimal ;
- `x-axion-signature` : `HMAC-SHA256(secret, "<horodatage>.<nonce>.<MÉTHODE>.<chemin>.<sha256 hex du corps>")` en hexadécimal (corps vide : sha256 de la chaîne vide).

Le site refuse (401) : signature fausse (comparaison en temps constant), horodatage à plus de 300 s, nonce déjà vu dans les 10 dernières minutes.

## Exemple (`POST /api/interne/videos`, corps = `passeport.exemple.json` sérialisé sans espace)

- secret : `secret-d-exemple-du-contrat`
- horodatage : `1760781600`
- nonce : `00112233445566778899aabbccddeeff`
- sha256 du corps : `c986bc4da4b628f3fcf2871aab558f838a41a3b2a4f303c8204eea4f1ec8e192`
- chaîne signée : `1760781600.00112233445566778899aabbccddeeff.POST./api/interne/videos.c986bc4da4b628f3fcf2871aab558f838a41a3b2a4f303c8204eea4f1ec8e192`
- signature : `4be7eb27815a929811f4a01ea44fbe37bb7ba85c07051d578fed760eab8a4480`
