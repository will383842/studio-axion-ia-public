# FIX-INSTANTANE

Cause : l'instantané du registre des réseaux figeait `dureeMaxSec: 90` pour Facebook, alors que le registre (`src/reseaux/index.ts:146`) porte 180 s. Ce 180 est voulu et documenté par la fiche L1-01 (`pilotage/journal/L1-01.md` : « durée vidéo lue dans le registre (180 s) » ; la décision de 90 s est portée par le profil de sortie, pas par le registre) et affirmé par `src/reseaux/registre.test.ts:58` et `src/reseaux/profils-sortie.test.ts:38`. Aucune fiche L3-14 / L8-01 / CAL-19 n'a changé cette valeur.

Choix : changement voulu, donc mise à jour de l'instantané attendu pour cette seule valeur (`tests/reseaux/instantane-tables-formats.test.ts:104`, 90 → 180, commentaire citant L1-01). Aucune autre assertion modifiée, aucun test sauté, `src/reseaux` inchangé.
