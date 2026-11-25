<!-- N-10. Le rendu ne tourne pas dans la CI (aucune ligne de `.github/`) : la session qui déploie lance `npx tsx outils/images-reference/rendre-et-comparer.mts` avant toute mise en ligne d'une pièce neuve. -->
# Images de référence (N-10)

Une pièce neuve est rendue en image fixe et comparée à une image gardée. Si plus de 1 % de l'image a changé (seuil de `tests/images-reference/references.json`), le script sort en code 1.

## Lancer
Depuis la racine du Studio, **à la main**, par la session qui déploie (jamais la CI, jamais à la construction d'une image) :

    npx tsx outils/images-reference/rendre-et-comparer.mts

`@remotion/*` n'est installé que dans `studio-rendu/` (`cd studio-rendu && npm ci`) ; le script le résout par ce chemin. `ffmpeg` doit être présent. Sans accès à remotion.dev, indiquer un navigateur : `STUDIO_NAVIGATEUR=/chemin/du/chrome-headless-shell`. Liste vide : « aucune pièce à comparer », code 0.

## Ajouter une pièce
1. Ajouter dans `pieces` : `{ "id", "composition", "image" (numéro d'image), "ratio", "fichier" (PNG dans tests/images-reference/images/) }`.
2. Créer la référence : `… rendre-et-comparer.mts --mettre-a-jour <id>`, regarder l'image, la garder.
3. Les polices (Manrope pour le neuf) doivent être chargées avant le rendu (`delayRender`), sinon l'image change d'une machine à l'autre.
4. Ne pas prendre la pièce de démonstration de `essais-visuels/` (carrousels).

## Régénérer une référence
Jamais pour faire passer le test, et **jamais sans une ligne au journal** (règle 13 de G13-04). `--mettre-a-jour <id>` réécrit l'image et le dit à l'écran.

## Version des compositions
`versionCompositions` de `references.json` doit égaler la version DÉRIVÉE des empreintes de `tests/segments-rendu/version-compositions.json` (`versionDerivee`, `tests/segments-rendu/version-derivee.ts` ; le script l'affiche en cas d'écart). Si une composition a changé, revoir chaque pièce, puis recopier la valeur affichée ; sinon le script refuse de comparer.
