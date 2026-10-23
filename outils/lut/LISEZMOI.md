# LUT Axion — atelier développeur (lot M4)

Décision de Will du 01/10 soir (`<dossier-de-plan-prive>/luts/A-INTEGRER-DANS-LE-STUDIO.md`) : les LUT sont
fabriquées dans le ton des visuels Buffer, **pas** dans l'interface.

| Fichier | Rôle |
|---|---|
| `generateur-lut-buffer.py` | générateur 65 points (linéarisation, opérations C1-continues, protection gaussienne de la peau) |
| `qc.py` | contrôle : gris monotone, cassure max < 0,02 (`python qc.py fichier.cube…`) |
| `LUT-Axion-avant-apres.jpg`, `Comparaison-LUT-ancienne-v1-v3.jpg` | preuves visuelles |

Les 4 LUT livrées sont dans `public/luts/` : **Clair-obscur** (défaut avocat, élément `lut-avocat-v1`), **Naturel**
(défaut selfie), **Doux**, **Nuit**. « Sans LUT » reste toujours possible.

- Copier de nouvelles versions depuis le dossier du plan : `node scripts/importer-luts.mjs` (contrôle avant copie).
- Test automatique de chaque `.cube` livré (taille 65, en-tête, gris monotone, cassure < 0,02) : `tests/luts.test.ts`.
- Le même contrôle s'exécute à l'import d'une LUT par Will (`src/lib/qc-lut.ts`) : refus clair si elle est cassée,
  avertissement au-delà de 0,02.
- Au rendu : LUT mélangée à l'intensité de la vidéo, posée par FFmpeg (`lut3d`, interpolation tétraédrique) sur tous
  les calques image, avant les textes ; priorité plan > vidéo > visage > format.

## Aperçu rapide (02/10)

L'aperçu du plateau (écran « Votre vidéo ») ne lit plus le `.cube` 65³ (7,4 Mo de texte, 275 000 lignes) : il lit une
**copie réduite 33³ en binaire 8 bits** (≈ 105 Ko), `public/luts/apercu/<nom>.33.bin`. C'est exactement la texture que
le navigateur fabriquait déjà à partir du `.cube` (écart 0 sur les 4 LUT, `tests/apercu-lut.test.ts`). **Le rendu final
garde le `.cube` 65³, intact.**

- Après chaque import de LUT : `pnpm exec tsx outils/lut/apercus.mts` (le test échoue si une copie manque ou n'est plus à jour).
- Une LUT importée par Will (stockée dans R2) n'a pas de copie : l'aperçu lit son `.cube`, comme avant.
- Mesure avant / après : `E2E_MDP='…' node outils/apercu-lut/mesurer.mjs <url> [essais]` →
  `docs/captures/apercu-lut-avant.json`, `docs/captures/apercu-lut-apres.json`.
