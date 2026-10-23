# Harmonisation Face caméra v4 : compte rendu (17/10/2026)

Branche `interface-claire/v4-harmonisation` (depuis `interface-claire/lot-c`). Remplace les 5 PR des lots 1 à 5 (`interface-claire/v4-lot1..5`), toutes fusionnées ici sans conflit.

## Fait
1. **Fusion** des 5 branches de lots (aucun conflit : dossiers séparés).
2. **Zéro turquoise** : #5CE1E6, #0A6E74 et la palette A supprimés des 5 `commun-lotN.tsx`. Palette unique (section L) : orange vif #F07C3E (`ACCENT_1`), blanc sur contour encre (`ACCENT_2`, chiffres et états qui étaient turquoise), encre #110A05, ivoire #E9DCC8 / #FBF7EF, gris #9A948C. Le trait barré de `CercleEpaule` passe orange ; `Chrono` n'a plus de variante turquoise.
   - Résultat de `grep -rniE "5ce1e6|5be1e6|0a6e74|turquoise|cyan" studio-rendu/compositions/interface-claire/motion-v4/` : **aucune ligne** (vérifié juste avant la PR).
   - Le paramètre `palette` est resté dans les signatures (type `Palette = "B"`, valeur ignorée par `accents()`) pour ne pas toucher ~390 appels ; à nettoyer plus tard.
3. **Briques communes** : `motion-v4/communs/briques-v4.tsx` = source unique des jetons (COULEURS, TRAIT, OMBRE, RAYON, DESCENTE, `accents`), ressorts nommés, `courbe/lerp/melange/secousse`, `Plaque`, `Pose`, descente/remontée de la prise (`descenteA`), `SousTitresV4` (position recalculée à chaque image, mot en cours orange), `EtiquetteTete`, `BarreProgression`, `Sons`/bruitages normalisés. Base : la version du lot 5, la plus complète et la seule qui calcule yST(f) = 0,66 + D(f) depuis la descente réelle.
   - Lot 5 : `commun-lot5.tsx` ne fait plus que `export * from "../communs/briques-v4"` (les 4 éléments gardés du lot 5 utilisent donc directement les briques communes).
   - Lots 1 à 4 : leurs `commun-lotN.tsx` importent et ré-exportent les jetons communs (COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE, type Palette).
4. **Catalogue** `motion-v4/catalogue-v4.ts` : 39 éléments, 26 `actif: true`, 13 `actif: false` avec raison (voir limite plus bas).
5. **26 extraits** re-rendus (540x960, 30 i/s, son AAC, H.264 crf 28) dans `docs/facecam-animee-v4/extraits-final/<Nom>.mp4` (max 0,56 Mo) + planche contact `<Nom>-planche.jpg` (max 206 Ko). Planches regardées une à une pour 13 d'entre elles et passées au détecteur de teinte cyan pour les 26 : plus de turquoise de la charte ; sous-titres jamais sur les yeux sur les planches regardées.
6. **`selection-26.mp4`** : les 26 extraits dans l'ordre demandé, numéro 1 à 26 dans un carré encre en bas à droite, filtre concat, 30 i/s constants, AAC. 2 520 images pour 84,0 s (= 84 × 30). 6,4 Mo.

## Variantes locales gardées (non fusionnées dans `briques-v4`)
Les lots 1 à 4 gardent leurs propres `Plaque`, `Anim/Pop`, `SousTitresV4`, `Prise`, `EtiquetteTete`, `BarreProgression`, `Sons`, chargement de polices : leurs signatures diffèrent (images relatives `i`, `f` ou `frame`, polices différentes) et les 22 éléments concernés sont rendus avec ces versions. Les remplacer sans pouvoir comparer image par image était risqué. Les jetons sont, eux, communs. Reste à faire : migrer élément par élément vers les briques communes.

## tsc
`npm ci` puis `npx tsc --noEmit` dans `studio-rendu` : **0 erreur dans `motion-v4/`** (avant et après). Erreurs préexistantes ailleurs : `interface-claire/Carte.tsx`, `VideoAnimee.tsx`, `cadrage.ts`, `src/domaine/facecam-animee/plan.ts`, `src/briques/tableau-scene/proprietes.ts` (hors périmètre, non touchées) et « Cannot find type definition file for 'node' » avant installation.

## Points d'attention
- **MosaiqueVideos** : une meuleuse bleu-vert apparaît dans un b-roll (image de la vidéo, pas un élément graphique). Le détecteur de teinte la signale ; à remplacer par un autre clip si Will veut zéro bleu-vert même dans les vidéos.
- `briques-v4.tsx` charge Montserrat 900 depuis `polices/Montserrat-900-latin*.woff2` du dossier public : tout rendu qui importe les briques doit fournir ces fichiers (ceux du lot 5 suffisent).
- La section « Contre-vérification tour 2 » de la critique n'existe pas dans le dépôt (la critique s'arrête à la section « 1 » du tableau) : les raisons des 13 éléments en coulisse viennent du tableau des notes (notes basses, éliminatoires, doublons, risque DGCCRF, texte libre) et des décisions de Will ; à relire. Les durées min/max du catalogue sont indicatives.
- Son non écouté par moi (aucun humain), seulement présence de la piste.
- Les sous-titres de démonstration ne disent pas ce que dit la voix de la prise (limite déjà notée par la critique).

## Reste à faire
Migrer les éléments des lots 1 à 4 vers les briques communes ; retirer le paramètre `palette` ; écoute humaine des bruitages ; test des 4 fonds sur les 26 ; décision pour la meuleuse de MosaiqueVideos.
