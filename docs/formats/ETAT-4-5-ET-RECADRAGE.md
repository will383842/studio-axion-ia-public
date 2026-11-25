# État du 4:5 et du recadrage sans zoom (fiche UO-10)

Constat fait sur le code du dépôt, sans rien modifier dans `src/`. Tâches d'origine de l'usine : T8, T9, T10, T11.

## Ce qui existe déjà

| Tâche | État | Où |
|---|---|---|
| T8 · fenêtre 4:5 sans zoom au-delà du 9:16, yeux à 30-38 % | **fait** (code) | `src/briques/formats-facecam/cadrage.ts` (`fenetreFormat`, `plansDuFormat`, agrandissement plafonné à 1,16, yeux visés à 34 %) |
| T11 · 9:16 toujours coché, format choisi refait d'office | **fait** (code) | `src/briques/formats-facecam/ratios.ts` (`formatsDemandes`, `lireFormatsFacecam`), `src/moteurs/montage-facecam/declinaisons.ts` (`formatsDeLaFabrication`) |
| T9 · rendu 4:5 de la face caméra animée | **non fait** | voir « Ce qui bloque » |
| T10 · rendu 4:5 du cas concret | **non fait** | voir « Ce qui bloque » |

Tests déjà présents (cités, non dupliqués) :
- `tests/facecam-formats.test.ts` : cadrage par format depuis la piste du visage (yeux à 30-38 %, jamais plus agrandi que le 9:16 serré, ratio 4:5 inclus) et « formats gardés dans les entrées (`facecamFormats`) : refaits d'office par une nouvelle version ».
- `tests/formats/recadrage-sans-zoom-et-formats-coches.test.ts` (UO-10) : T8 et T11 écrits explicitement pour une piste fictive et un plan 9:16, et contrôle de ce document.

## Ratios déclarés par chaque générateur (`src/formats/*/index.ts`)

| Générateur | Déclaration | Chemin et ligne |
|---|---|---|
| gabarit | `ratios: ["9:16"]` | src/formats/_gabarit/index.ts:39 |
| avocat | `ratios: ["9:16", "4:5", "1:1"]` | src/formats/avocat/index.ts:133 |
| cas concret | `ratios: ["9:16"]` | src/formats/cas-concret/index.ts:112 |
| démo face caméra | `ratios: ["9:16"]` | src/formats/demo-facecam/index.ts:30 |
| face caméra animée | `ratios: ["9:16"]` | src/formats/facecam-animee/index.ts:41 |
| face caméra | `ratios: ["9:16"]` | src/formats/facecam/index.ts:43 |
| image vidéo | `ratios: ["9:16"]` | src/formats/image-video/index.ts:61 |
| podcast | `ratios: ["16:9", "9:16"]` | src/formats/podcast/index.ts:27 |
| tableau animé | `ratios: ["9:16"]` | src/formats/tableau-anime/index.ts:62 |
| tableau de bord | `ratios: ["4:5", "9:16", "1:1", "16:9"]` | src/formats/tableau-de-bord/index.ts:29 |
| tutoriel outil | `ratios: ["4:5", "9:16", "1:1"]` | src/formats/tutoriel-outil/index.ts:32 |
| vidéo longue | `ratios: ["16:9"]` | src/formats/video-longue/index.ts:33 |

Remarque : le face caméra déclare le 9:16 seul dans son générateur, mais ses déclinaisons 4:5, 1:1 et 16:9 passent par la brique `formats-facecam` et `entrees.facecamFormats`, pas par cette déclaration.

## Ce qui bloque

- **T9 · non fait** : la face caméra animée ne déclare que le 9:16 (`src/formats/facecam-animee/index.ts:41`), et son rendu est figé en 1080 × 1920 (`SORTIE_V4` dans `src/moteurs/montage-facecam-animee/chaine-v4.ts`, ligne 199).
- **T10 · non fait** : le cas concret ne déclare que le 9:16 (`src/formats/cas-concret/index.ts:112`) et passe par son propre moteur, `src/moteurs/montage-cas-concret/index.ts`, qui écrit la résolution en dur (`resolution: "1080x1920"`, ligne 814), et non par `SORTIE_V4` de `chaine-v4.ts`.

Les deux demandent de toucher le moteur de montage, le service de rendu et la composition : fiche à part, après décision. Rien n'a été supprimé.
