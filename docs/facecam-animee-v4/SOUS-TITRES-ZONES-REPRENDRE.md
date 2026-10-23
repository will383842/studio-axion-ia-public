# Sous-titres v4 dans la zone sûre TikTok / Reels / Shorts — REPRENDRE

Branche : `facecam-animee/sous-titres-zones-reseaux` (aucune PR ouverte).

## Fait (commité et poussé)
- Zone sûre 9:16 combinée dérivée de `zoneProtegeeCombinee` (`src/reseaux`, non modifié) : haut 14, droite 18, bas 30, gauche 6 %.
- `catalogue-v4.ts` : `ZONE_SURE_916_V4`, `Y_SOUS_TITRES_MAX_V4` (0,666 H, bas de boîte 0,70) et `Y_SOUS_TITRES_MIN_V4` (0,174 H, haut de boîte 0,14), `placerDansZoneSureV4`, `bordGaucheSousTitresV4`. `ySousTitresV4` borne la position voulue.
- `regles-v4.ts` : V5b contrôle la valeur ÉCRITE de la fiche (hors zone sûre = erreur) puis la position calculée ; V5a (yeux) conservée.
- Rendu : `studio-rendu/.../motion-v4/communs/zone-sure-v4.ts` (copie pure, sans import de `src/`), utilisée par `registre-v4.tsx` (`positionSousTitresV4`) et `briques-v4.tsx` (`SousTitresV4` : largeur max 0,76 L, centré si ça tient entre 0,18 et 0,82 L sinon décalé à gauche, plancher de corps 62 -> 48).
- Tests : `tests/facecam-animee/zone-sure-sous-titres-v4.test.ts` (nouveau), `catalogue-v4.test.ts` adapté. 43 tests verts sur les 3 fichiers concernés.

## Positions avant -> après (centre, fraction de H)
- Base (M1) : 0,66 + d (0,72 à d = 0,06) -> plafonné à 0,666.
- Carte (M2) : inchangée (0,375 à d = 0,26 ; 0,66 + d plafonné avant 0,2).
- Fenêtres (0,72 / 0,78 carrousel), plein cadre (0,82 mosaïque, 0,76 duel) -> 0,666 (juste sous la fenêtre qui finit à 0,63).
- Pile de notifications (M7) : 0,075 -> 0,174 (haut de la zone sûre).
- Cas « yeux » : si le bornage tombe sur la bande des yeux (prise très descendue, d = 0,32), les sous-titres passent juste AU-DESSUS de la bande (marge 0,005), jamais sous le haut de la zone sûre.

## Fait ensuite (même branche, après merge de master)
- (a) Copies `lot1..lot5` alignées : `centreSousTitres` (lot1), `ySousTitresReel` (lot2), `ySt` (lot3 : bornage + plancher de la zone sûre à la place de 0,86/0,06), `SousTitresV4`/`ySousTitresSurYeux` (lot4), `position-st.ts` (lot5) passent par `placerDansZoneSure` (`communs/zone-sure-v4.ts`). Test : `tests/facecam-animee/zone-sure-lots-v4.test.ts`.
- (b) Mots longs MESURÉS (Chromium + Montserrat 900, script `sous-titres-zones/mesurer-mots-longs.mjs`) : « accompagnement » 923 px à corps 84 -> corps 74 (813 px), « administratives » 852 -> corps 80 (812 px), plaque comprise 70 et 76 ; max 820,8 px (0,76 L) : aucun ne déborde, aucune coupe. Deux mots très longs ensemble ne tiennent pas à 48 (1 030 px) : `SousTitresV4` les EMPILE (un mot par ligne, corps réduit pour que chaque ligne tienne, bloc remonté si besoin pour que son bas reste <= 0,70 H).
- (c) `PileNotifications` : bulles de 116 px, décalage 0,052 H, bas <= 0,70 H (ombre comprise), haut >= 0,52 H (le visage finit à 0,52 H à D0, donc toujours entier). Emprise M7 du catalogue : 0,52 -> 0,70 (avant 0,60 -> 0,90).
- Image de contrôle : `sous-titres-zones/controle-mot-long-bulles.png` (1080×1920, vraie prise + vraie police ; ce n'est PAS un rendu Remotion : géométrie reprise des constantes, script `image-controle.mjs`), contours TikTok / Reels / Shorts dessinés par-dessus.

## Reste à faire
- Rendu Remotion réel d'une planche (non fait : `remotion` n'est pas installé dans le conteneur, rendu trop lourd).
- Les bulles font 940 px de large (0,87 L) : elles dépassent la marge droite des réseaux (0,82 L). Hors consigne (seul le bas était demandé) ; à réduire (<= 0,76 L) si Will le veut.
- Tests : avant comme après, 6 fichiers de `tests/facecam-animee/` ne se chargent pas ici (package `remotion` absent : cartes-pleines, elements-visibles, mise-en-page, son-v4, sous-titres, + mots-interdits-ecran « copie du conteneur »). Ces échecs viennent de l'environnement, pas des changements. `tsc --noEmit` : aucune erreur dans les fichiers touchés hors « Cannot find module 'remotion' ».
