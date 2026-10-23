# Banc de fidélité à la v4

Mesure l'écart entre la vidéo de référence (`docs/formats/v4-reference/v4.mp4`) et le format « Cas concret » rendu à
partir du même texte et des mêmes heures de mots. Rendu local gratuit : aucune voix, aucun appel payant.

- `fiche-v4.ts` : la v4 en fiche d'écrans du format (V4-3 : le script validé du cas, un écran par plan), calée sur
  `voix4.json`, passée par la chaîne du format.
- `banc.mts` : images de la v4 (ffmpeg) et du format (Remotion), SSIM, recouvrement des formes, composants, planche,
  puis `docs/formats/v4-reference/RAPPORT-ECARTS.md`.
- `rapport.ts` : écriture du rapport.
- `leviers.mts` : taille du gabarit d'étape selon la zone sûre et la bande des sous-titres (calcul pur).

Commandes (racine du studio, après `pnpm install` et `npm --prefix studio-rendu ci`) :

    pnpm exec tsx outils/v4-fidelite/banc.mts --etat avant --sans-rapport   # chaîne d'avant la mission B
    pnpm exec tsx outils/v4-fidelite/banc.mts --etat apres --sans-rapport   # fin de V4-1 (zone sûre des 4 réseaux)
    pnpm exec tsx outils/v4-fidelite/banc.mts --etat v4-2 --sans-rapport    # V4-2 (à lancer sur la branche de V4-2 : sortie/v4-2)
    pnpm exec tsx outils/v4-fidelite/banc.mts                               # V4-3, script validé : écrit RAPPORT-ECARTS.md
    pnpm exec tsx outils/v4-fidelite/leviers.mts

Navigateur : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome`, sinon celui de Playwright. Sortie : `outils/v4-fidelite/sortie/`
(non commitée). Environ 2 minutes par passage.
