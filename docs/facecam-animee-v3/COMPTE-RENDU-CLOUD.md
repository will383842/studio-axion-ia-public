# Compte rendu de la session cloud : Face caméra animée v3 (16/10/2026)

Branche `interface-claire/lot-c-v3-integration` (créée depuis `interface-claire/lot-c-v2-integration`, avec `origin/interface-claire/lot-c` fusionné sans conflit). **Remplace la PR #284 (v2, style papier rejeté par Will).** Rien n'est fusionné.

## Ce qui est fait

1. **Branche et fusion** : fusion de `origin/interface-claire/lot-c` (éléments `motion-v3/lotA..lotE`, standard et critique v3) sans aucun conflit.
2. **`realisateur/catalogue-v3.ts`** : 23 fiches (id, famille, emplacement, forme, mouvement, sortie, durées min/max, visage couvert ou entier, coup de poing oui/non, « quand l'utiliser », bruitages, emprise posée…). **14 actifs** (le choix de Will : mosaique-videos, mot-derriere, fenetre-plein-cadre, carte-verre, bande-video, dalle-claquee, fenetre-telephone, notifications-verre, cercle-epaule, duel-video, rafale-trois-mots, fenetre-double, eclat-chiffre, mot-saute) et **9 inactifs** (fenetre-pivot, pilule-cote, arche-bas, carte-preuve, widget-chiffre, carte-retournee, mot-vertical-bord, citation-verre, mot-fenetre). `actif` est le seul champ à changer. « Famille » = le lot (fenêtre, forme vidéo, carte en verre, typographie, coup de poing) ; « coup de poing » = plein écran qui couvre le visage (6 actifs). Le catalogue v2 reste dans le code, mais la consigne et la sortie du réalisateur ne le proposent plus.
3. **`realisateur/regles-v3.ts`** (copie adaptée de `regles-v2.ts`), branchée dans `verifierPlan` (`regles.ts`) :
   - décisions fixes de Will, toutes **bloquantes** : **V1** visage entier ou entièrement couvert (emprise posée de chaque fiche contre la zone du visage ; tolérance : 3 images de visage partiel au plus, 4 refusées ; un élément « entier » n'en a aucune) ; **V2** aucun zoom ni mouvement de la prise (la descente sous `carte-verre` reste permise) ; **V3** rien qui couvre le visage avant 3 s, aucun coup de poing avant 8 s ; **V4** aucune musique (seuls les 28 fichiers de `sons/`) ; **V5** sous-titres jamais sur les yeux (y compris quand la prise descend) ; **V6** jamais deux fois de suite le même emplacement ni la même famille ; **V7** au plus un coup de poing par 20 à 25 s (écart d'au moins 20 s) ; **D0** seuls les éléments actifs.
   - erreurs ordinaires : variété sur 5 éléments (D2), cadence (D11, relâchée), bruitages (D12), quotas par élément (D14), littéralité (D15 : mots et nombres dits, « Villeexemple » interdit, une recherche de vidéo par vidéo qui reprend un mot de ce que l'élément illustre), historique (D13).
   - un plan v3 **remplace** cartes, fenêtres, calques et motions (ils doivent rester vides, D0b) : les quotas de bande, de rythme et de mini-vidéos de l'ancien catalogue ne s'y appliquent pas.
4. **Sous-titres +25 %** (`SousTitres.tsx`) : base 0,064 L → 0,08 L, hauteur maximale 0,045 H → 0,0563 H. La zone reste hors des yeux (contrôlée par V5 et par `cadrage.ts`, qui lit la même constante).
5. **Consigne du réalisateur** (`consignes.ts`) : nouvelle section « 0 » générée depuis le catalogue (uniquement les 14 éléments actifs, avec leurs champs), table « ce que Will dit → quel élément » (littéralité), décisions fixes V1 à V7, variété et cadence, forme des champs ; sortie `elementsV3` ajoutée au schéma demandé à Claude (`schemaSortieRealisateur`) et à `assemblerPlan`. Les anciens tableaux restent vides.
6. **Rendu final** : `motion-v3/registre-v3.tsx` associe les 23 ids aux composants Remotion et traduit un `ElementV3Plan` en props ; `VideoAnimee.tsx` rend `plan.elementsV3`, place les sous-titres selon l'élément et applique la descente de la prise sous `carte-verre`. Les bruitages viennent du catalogue via `bruitagesDuPlan` (les composants sont appelés sans leurs sons internes). Tous les `.tsx` commencent par `import React` (testé). Le schéma du plan (`plan.ts`) a un champ facultatif `elementsV3`.
7. **Tests** : voir les chiffres plus bas.
8. **Démo** : `docs/facecam-animee-v3/demo/demo-v3-20s.mp4`, 1080 × 1920, 30 i/s, 22,8 s (dont 1,5 s d'écran de fin), 3,0 Mo, avec bruitages, sans musique. C'est le **vrai rendu final** (`VideoAnimee`) sur l'image `prise-commune-1080x1920.png` : 8 éléments actifs, les 5 familles, 6 emplacements, un seul coup de poing (`dalle-claquee` à 9,2 s), visage entier jusqu'à 3,4 s, sous-titres agrandis. Le plan passe `verifierPlan` sans erreur (3 avertissements « tailles ») et est rendable. Reproduire : `npx tsx outils/facecam-animee-v3/generer-plan-demo.ts` puis, dans `studio-rendu/`, `node compositions/interface-claire/demo-v3/rendre-demo.mjs <sortie.mp4> <headless_shell>`.

## Ce qui n'est PAS fait, et les limites (dit franchement)

- **Les vidéos de la démo sont des placeholders** (mires ffmpeg colorées avec une légende) : aucune banque vidéo ni B-roll réel n'est dans le dépôt et je n'ai pas de clé Pexels. La démo montre les formes, les mouvements, la place et le rythme, pas des scènes littérales. Le contrôle de littéralité (D15) est fait sur les `recherches` du plan, pas sur des images.
- **Le circuit d'images (`images/`) n'est pas étendu aux `elementsV3`** : il remplit `plan.fenetres`, pas encore `elementsV3[].medias`. Tant que ce n'est pas fait, un vrai plan v3 sorti du réalisateur a des `recherches` mais pas de `medias` : les fenêtres vidéo n'auront pas leur vidéo en production. C'est le prochain chantier.
- **`mot-derriere` sans détourage** : le PNG de détourage de Will n'est pas fourni par la chaîne ; le composant utilise son repli (mot au-dessus de la tête), visible sur la démo.
- **Visage (V1)** : le contrôle porte sur l'emprise posée déclarée et sur le nombre d'images de visage partiel **tiré de la critique du 16/10** (comptage sur extraits isolés). Ce n'est pas une mesure image par image sur le rendu final ; ces valeurs restent à mesurer.
- **Appel réel à Claude Opus non testé** : la consigne et le schéma sont testés, mais aucun appel réseau n'a été fait ; le comportement réel d'Opus sur ces règles est à observer.
- Les placeholders ne reprennent pas les corrections de la critique v3 sur les composants (tailles de texte, bords coupés…) : je n'ai modifié aucun composant `motion-v3`.
- Écarts de calage constatés : `arche-bas` est codée sur le côté droit (et non en bas), classée « droite » ; `cercle-epaule` classé « bas ». `citation-verre` (inactive) : emprise recalée à x ≥ 0,76 pour ne pas entrer dans la zone du visage ; `carte-retournee` (inactive) : x1 ramené de 0,26 à 0,25 pour la même raison.
- Les règles ne demandent plus la micro-accroche d'ouverture de la v2 (premier élément entre 0,8 et 2 s) ni les quotas de lots : Will ne les a pas fixés pour la v3.

## Problèmes rencontrés

- Le dépôt n'avait pas de `node_modules` : installation par `pnpm install --frozen-lockfile` (le `npm ci` échoue faute de `package-lock.json`).
- `tsc --noEmit` donnait 4 erreurs `RouteContext` / `LayoutProps` : ce sont des types Next générés ; `npx next typegen` les corrige (rien de commité).
- Chromium du bac à sable : `chrome` refuse l'ancien mode headless ; le rendu utilise `chromium_headless_shell`.
- Un redémarrage du worker en cours de session a interrompu un lancement ; aucun fichier perdu.
- La suite de tests complète prend ~17 min.
- Le test `final-b-image-rendu-fichiers` signale que `plan-galerie.ts` importe `src/domaine/.../plan.ts`, absent de l'image Docker du rendu : **échec déjà présent avant mes changements** (comme `Frise.tsx` introuvable). Pour ne pas l'aggraver, le script qui génère le plan de démo est dans `outils/facecam-animee-v3/` (il importe `src/`), et `registre-v3.tsx` n'importe que des types de `src/` : il recopie les positions de sous-titres et la descente de la prise du catalogue (un test vérifie l'égalité).

## Résultats des tests

Tests existants modifiés : `sous-titres.test.ts` (3 bornes mises à l'échelle : hauteur 0,045 → 0,0563, base 0,064 → 0,08, hauteur visible 0,034 → 0,0425, toutes de +25 %, demande du 16/10). Aucun autre test existant n'a été modifié.

Nouveaux tests : `catalogue-v3.test.ts` (14), `diversite-v3.test.ts` (37, au moins un cas qui échoue et un cas qui passe par règle, dont 3 images acceptées / 4 refusées), `demo-v3.test.ts` (9) : **60 tests**.

Résultats chiffrés : voir la section « Mesures finales » ci-dessous.

## Mesures finales

- `npx vitest run` (suite complète, 514 fichiers) : **7048 tests passent, 5 échouent, 7 ignorés** (508 fichiers passent, 5 échouent, 1 ignoré).
- Les 5 échecs sont **tous antérieurs à mes changements** (même échec sur le commit de fusion avant toute modification, mesuré dans un worktree séparé) et sans rapport avec la v3 : `final-b-image-rendu-fichiers` (plan.ts hors de l'image Docker, `Frise.tsx` introuvable), `garde-regle-unique` (constante `EPS` définie 4 fois ; mes règles réutilisent celle de `regles-v2.ts`, donc 4 comme avant), `garde-ecran` (jargon technique à l'écran), `rendu-garde/garde` (composition figée), `services/miniatures-serie` (`Miniature.tsx` comparé à `origin/master`). `e2e-verif1-bc-serie` a échoué une fois puis passé (instable).
- Dossier `tests/facecam-animee` : 15 fichiers, **424 tests passent**, 3 ignorés.
- `npx tsc --noEmit` (racine) : **0 erreur** (après `next typegen`). `tsc` de `studio-rendu/` : 1 erreur déjà présente (`src/briques/tableau-scene/proprietes.ts`, `findLast`), aucune dans `compositions/`.
- `eslint` sur `src/moteurs/montage-facecam-animee` et `tests/facecam-animee` : 0 erreur, 2 avertissements déjà présents (`sous-titres.ts`).
