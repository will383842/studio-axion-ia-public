# Signature des appels du studio (contrat version 1)

Exemple vérifié par le test `s4-contrat` : changer une ligne ici sans changer le code (ou l'inverse) fait échouer le test.

Chaque appel porte trois en-têtes :

- `x-axion-horodatage` : secondes Unix ;
- `x-axion-nonce` : 16 octets aléatoires en hexadécimal minuscule (32 caractères) ;
- `x-axion-signature` : `v1=` suivi de `HMAC-SHA256(secret, "v1\n<horodatage>\n<nonce>\n<MÉTHODE>\n<chemin>\n<sha256 hex du corps>")` en hexadécimal minuscule (64 caractères ; corps vide : sha256 de la chaîne vide). Forme identique à celle du vérificateur du site (`src/server/videos/signature.ts`) ; horodatage sur 10 chiffres.

Le site refuse (401) : signature fausse (comparaison en temps constant), horodatage à plus de 300 s, nonce déjà vu dans les 10 dernières minutes.

## Exemple (`POST /api/interne/videos`, corps = `passeport.exemple.json` sérialisé sans espace)

- secret : `secret-d-exemple-du-contrat`
- horodatage : `1760781600`
- nonce : `00112233445566778899aabbccddeeff`
- sha256 du corps : `c986bc4da4b628f3fcf2871aab558f838a41a3b2a4f303c8204eea4f1ec8e192`
- chaîne signée (sauts de ligne écrits \n) : `v1\n1760781600\n00112233445566778899aabbccddeeff\nPOST\n/api/interne/videos\nc986bc4da4b628f3fcf2871aab558f838a41a3b2a4f303c8204eea4f1ec8e192`
- signature : `v1=80df6d7cc2d2acb3bee99fb9ab0d9d7f8c50c7ee35b79219401082b4f1c3ee5c`

## Vecteur de SIGNATURE commun studio ↔ site (route des guides, secret FICTIF de test)

> ⚠️ Ce premier corps (avec `idRun`) est un vecteur de SIGNATURE uniquement : il ne respecte pas le schéma strict du site (un vrai appel recevrait 422). Ne pas le recopier comme exemple de requête ; utiliser le corps conforme ci-dessous.

Calculé avec l'algorithme du site (`src/server/videos/signature.ts`). Le même vecteur est vérifié par `tests/site-videos/s4-signature.test.ts` ; le site doit le vérifier de son côté.

- secret : `secret-fictif-de-test-pv2`
- horodatage : `1760781600`
- nonce : `00112233445566778899aabbccddeeff`
- méthode : `POST`
- chemin : `/api/interne/demandes-guide-reseau`
- corps (octets exacts) : `{"mot":"GUIDE","reseau":"instagram","accord":"non_demande","idRun":"run_exemple_0001"}`
- sha256 du corps : `7fa43e9ae5d7c0a854f7d46e6b2be9cd7f0341916a708eaf3c06c9259a9f2722`
- en-tête `x-axion-signature` attendu : `v1=e9876c7e1b20ac0862c564b4a02acca0ce3a336f2c1c64b2111d4950b5bafab9`

### Corps de requête conforme au schéma strict du site (secret FICTIF de test)
Même secret, horodatage, nonce, méthode et chemin que ci-dessus. Ce corps respecte `SchemaDemandeGuideReseau` du site (`src/server/guides-reseau/contrat.ts`, `.strict()`) ; l'adresse est fictive, sur le domaine réservé `example.com`. Vérifié par `tests/site-videos/s4-signature.test.ts`.

- corps (octets exacts) : `{"schemaVersion":1,"cleIdempotence":"run_exemple_0001","email":"lecteur-fictif@example.com","mot":"GUIDE","reseau":"instagram","guide":"guide-ia","accord":"non_demande","versionTexteM1":"m1-v1","locale":"fr"}`
- sha256 du corps : `80307b47bfe118bda71c7aafd42f2f96c7b819c16011fdd7a52a122a46408678`
- signature attendue : `v1=585e0fcf1e132f19265c09958042c5cf6206ed061761023174540ca3202e7809`
