# Format « Vidéo longue » (code VL)

**État au 18/11/2026 : statut `masque`, éteint, non inscrit.** Fiche VL-03 du générateur dédié « Vidéo longue » (option C, décision de Williams du 18/11/2026). Rien n'est allumé, rien n'est publié, aucune dépense.

## But

Une vidéo horizontale 16:9 de 4 à 12 minutes, destinée à YouTube, découpée en chapitres, sur la voix validée par l'utilisateur. Aucun visage ni musique.

## Ce que déclare la fiche (`src/formats/video-longue/index.ts`)

| Point | Valeur |
|---|---|
| Identifiant et code | `video-longue`, `VL` (ajouté à `src/formats/registre-codes.ts`) |
| Statut | `masque` ; pas de `ouvertDansLaNavigation` : aucun lien dans le menu ni carte ajoutée à la main |
| Adresse de création | `/videos/longue` (écran écrit par VL-06) |
| Ratio | `16:9` seul (ratio maître) |
| Durée | depuis le script ; zone verte 240 à 720 s ; au-delà, une remarque, jamais un refus ; cible par défaut 360 s |
| Musique | interdite |
| Moteur | `montage-video-longue` (écrit par VL-04) |
| Prix | non masqué : l'accord de prix reste exigé (le coût estimé de 3 à 7 $ demande le oui explicite de Williams avant tout allumage) |

## Règles

- Aucune phrase n'est ajoutée sans le choix de l'utilisateur ; le script validé fait foi.
- Vouvoiement ; palette ivoire, noir et terracotta, Manrope, ni bleu ni jaune.

## Ce qui reste à faire par d'autres (hors de cette fiche)

- Inscription dans `src/formats/index.ts` : will-dc, après le oui de Williams (import : `import { formatVideoLongue } from "./video-longue";`).
- Moteur, ids et LUT : VL-04. Entrée dans `.github/workflows/gv-tests-moteurs.yml` : will-dc.
- Tant que le format n'est pas inscrit, le test « inscrit partout » ne le voit pas : il ne change donc rien.
