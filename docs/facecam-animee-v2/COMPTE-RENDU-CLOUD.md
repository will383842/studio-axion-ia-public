# Compte-rendu de la session cloud — intégration v2 « énergie » (16/10/2026)

Branche `interface-claire/lot-c-v2-integration` (depuis `interface-claire/lot-c`). Rien n'est fusionné, déployé ni mis en ligne.

## Fait
1. **État des lieux** (avant toute modification) : `npx vitest run tests/facecam-animee` = 278 réussis, 3 ignorés, 0 rouge. tsc racine : 4 erreurs déjà là (`RouteContext`, `LayoutProps`, types Next générés absents). tsc `studio-rendu` : 2 erreurs déjà là (`findLast` dans `src/briques/tableau-scene/proprietes.ts`).
2. **Catalogue** `src/moteurs/montage-facecam-animee/realisateur/catalogue-v2.ts` : 24 entrées (id, lot, emplacement, forme, mouvement, sortie, angle, couvreVisage, taille %, durée en images, contenu attendu, bruitages…). `actif` est le seul champ à changer : 17 true (9 favoris + 8), 7 false.
3. **Règles D0 à D15** dans `regles-v2.ts`, branchées dans `verifierPlan` ; le plan porte un champ facultatif `elementsV2`. D0, D1, D3, D4, D9, D10 bloquent le rendu (`estRendable`). 67 tests, un cas qui échoue et un qui passe par règle.
4. **Démo** `DemoV2` (540×960, 30 i/s, 15 s), rendue : `docs/facecam-animee-v2/demo/demo-v2-15s.mp4` (672 Ko, h264 + bruitages, sans musique). 8 éléments, 4 lots, coup de poing tampon-déchirure à 10,7 s. Script : `studio-rendu/compositions/interface-claire/demo-v2/rendre-demo.mjs`.

## Tests et tsc, avant → après
- Tests facecam : 278 réussis / 3 ignorés → **364 réussis / 3 ignorés** (+86 nouveaux, aucun test existant modifié ni rendu obsolète).
- tsc racine : 4 erreurs → 4 (les mêmes). tsc studio-rendu : 2 → 2 (les mêmes).
- `import React` présent dans les .tsx ajoutés ou modifiés (DemoV2.tsx, Compositions.tsx ; contrôlé par test). Signature d'`Icone` intacte. Aucun élément motion-v2 réécrit.

## Ce qui ne marche pas / limites (honnêtement)
- **Pas branché sur Opus ni sur `realiserParRegles`** : la consigne et le schéma de sortie du réalisateur ne connaissent pas encore les éléments v2. Seul le CONTRÔLE existe.
- **Rythme non adapté** : `rythme.ts`, la bande de cartes (8-35 %) et le trou de 0,7 s ne comptent pas encore les éléments v2. Un plan v2 pur échouerait encore à ces anciens contrôles.
- Pour un plan qui porte des éléments v2, **R5a-c (variété des 15 familles) et R5d (cadence) ne sont plus appliqués** : D2, D3 et D11 les remplacent. À valider.
- Les règles D1, D2, D3, D5 à D8, D12 lisent la suite des éléments v2 seuls (les anciennes familles n'ont pas d'étiquettes) ; D4, D9, D10, D11 lisent la ligne de temps fusionnée.
- Les règles à pourcentage (D3c, D4a, D4d, D5a, D5b, D7a) ne jugent qu'à partir de 10 éléments (quotas de vidéo) ; D3a/b seulement sur 60 s et plus. Sur 15 s, 8 éléments, elles ne pouvaient pas toutes tenir (voir « à trancher »).
- Tailles et angles marqués « estimée » dans le catalogue (fleche, demi-lune, vertical, bulle…) : à mesurer sur rendu. Aucun élément latéral actif n'est sous 6 % sauf **bulle-cri (5,5 % estimé)**.
- E5 (halo) n'a qu'un élément actif (mot-saute, 2 par vidéo au plus) : le quota « 3 par 90 s » est impossible tant que onde-de-choc est écarté. De même, une vidéo de 60 s doit avoir E1-E6 dans chaque fenêtre.
- Démo : aucune suite des 17 actifs ne tient toutes les règles avec les 5 lots sur 15 s ; la démo a 4 lots (pas le lot 4). Transcription **fictive**, pas de sous-titres. Sons « à sourcer » absents : le tampon joue `drop_004` / `whoosh-out` PROVISOIREMENT. Volumes des fiches multipliés par 6 (sans voix).
- Noms : les ids sont ceux des .tsx (`traits-vitesse`, `gerbe-formes`, `pile-de-lettres`), pas `traits-de-vitesse` ni `gerbe-de-formes`. Le standard appelle encore l'élément 14 « orbite-lettres » : il est remplacé par `pile-de-lettres` (E3, pas E5).

## TOLÉRANCE À VALIDER (non validée par Will)
Un plein écran peut laisser le visage partiel jusqu'à **3 images** à l'entrée/sortie. Chiffres du catalogue : tampon 1, éclat-chiffre 2, dalle 2, duel 3 (au maximum), rafale non chiffrée (la fonction `imagesVisagePartiel` du .tsx rend 0). À l'état posé : visage entier ou entièrement couvert.

## À trancher par Will
1. Valider ou refuser la tolérance de 3 images.
2. Confirmer les 17 éléments actifs (champ `actif`) : faut-il réactiver un des 7 écartés une fois refait plus grand ? onde-de-choc est le seul halo d'accroche de rechange.
3. Les règles à pourcentage sur courtes vidéos (seuil de 10 éléments) et le remplacement de R5 par D2/D3/D11 pour les plans v2.
4. Autoriser un élément (autocollant, mot-saute, bulle-cri) jusqu'à 2 fois par vidéo, et pile-de-lettres / coups de poing 1 fois (lu dans les fiches).
5. Lancer le lot suivant : brancher consigne Opus, règles fixes et rythme sur les éléments v2.
6. Sourcer en CC0 les 9 sons manquants (autocollant, scotch, papier, tampon, déchirure ×2, pop, bloup, boum).
7. Juger la démo (énergie, échelle des éléments latéraux).
