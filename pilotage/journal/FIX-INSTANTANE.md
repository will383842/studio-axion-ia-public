# FIX-INSTANTANE

Cause : l'instantané du registre des réseaux figeait `dureeMaxSec: 90` pour Facebook, alors que le registre (`src/reseaux/index.ts:146`) portait 180 s sans source. Le relevé L8-01 donne 90 s (`facebook.reseau.format_video`, `docs/reseaux/regles-officielles.json:385`, Reel 3 à 90 s, preuve secondaire via la spec Zernio qui cite le guide Meta). Il ne mentionne 180 s nulle part pour Facebook, et le code traite toute vidéo Facebook comme un Reel. L'instantané d'avant était juste ; c'est le registre qui était faux.

Choix : retour à 90 s dans `src/reseaux/index.ts:146` avec la source en commentaire (à revérifier sur la page Meta), instantané `tests/reseaux/instantane-tables-formats.test.ts` laissé à 90 (modification annulée), tests alignés (`src/reseaux/registre.test.ts`, `src/reseaux/profils-sortie.test.ts`). `REEL_FACEBOOK_DUREE_SEC` (60 s côté envoi, décision prudente de RES-01) inchangé. Aucun test sauté.

CORRECTIF (relecture z22, 13/11/2026) : le 180 n'était pas voulu ; l'ancienne présentation « voulu et documenté » est retirée. Reste à noter : le commentaire de `src/reseaux/profils-sortie.ts:34` et le libellé `source` (l. 69) parlent encore d'un registre à 180 s, hors liste de la correction.
