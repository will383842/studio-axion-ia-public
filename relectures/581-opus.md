# Relecture PR 581 (FB-REEL-a : règle du Reel Facebook)

**VERDICT : OK — FUSION POSSIBLE sur la tête complète 60ac5689e46c51eb5798a4afb6494607eba3f033**

(PR encore en brouillon : la sortir du brouillon avant fusion.)

## Vérifications
- Diff (2 commits, base master 648531f3, fusionnable « clean ») : uniquement `src/domaine/reel-facebook.ts` (nouveau) et `tests/publication/fb-reel.test.ts` (nouveau), exactement les fichiers autorisés de la fiche FB-REEL-a (precision-fiches-2026-11-15.md, branche precision/fiches-studio). `zernio-corps.ts` et `publications.ts` non touchés.
- Domaine : `estReelFacebook` vrai seulement pour 9:16 et min ≤ durée ≤ max ; bornes importées de `REEL_FACEBOOK_DUREE_SEC` (aucun littéral 3/60, vérifié par test de lecture du source). Durée absente, NaN, Infinity : refusées sans exception. Logique identique à la condition `contentType = "reel"` de `zernio-corps.ts` (bornes incluses).
- `avertissementReelFacebook` : null dans les limites ; sinon phrase en français, vouvoiement, cause dite (format, durée inconnue, trop courte, trop longue) ; jamais d'exception.
- Tests aux limites 2,9 / 3 / 60 / 60,1 s, 4:5, 1:1, 16:9, durée absente ; test rouge commité avant le code.
- Aucun appel réel (réseau, Zernio, Facebook), aucune clé, aucune publication, aucune suppression de données.
- `scripts/echecs-connus.json` inchangé. Aucun nom de personne, aucune mention de Buffer.
- Tests sur master + PR fusionnés : `tests/publication/fb-reel.test.ts`, `tests/zernio`, `tests/youtube-zernio`, `src/reseaux` : 213 fichiers, 3377 tests verts. `tsc` : 146 erreurs, identiques à master, aucune dans les fichiers de la PR.
- Contrôles GitHub : 8/8 terminés et verts.

## Remarques non bloquantes
1. `src/domaine/reel-facebook.ts:7-10` (mineure) : l'entrée s'appelle `format` alors que la fiche écrit `{ ratio, dureeSec }`. Choix cohérent avec `DemandePublication.format` et l'appel déjà fusionné `format: r.sortieConseillee.ratio` (`publications.ts`) : FB-REEL-b pourra passer `{ format: r.sortieConseillee.ratio, dureeSec }`. Contrat FB-REEL-b tenu, à signaler à son auteur.
2. `src/domaine/reel-facebook.ts:5` (mineure) : l'import de `zernio-corps.ts` (permis par la fiche) entraîne `zernio-client.ts` et `node:crypto` ; réutilisation dans un composant client (L5-02) impossible tel quel. Même schéma que `src/domaine/duree-par-reseau.ts`. À traiter un jour en déplaçant la constante dans un module sans dépendance.
3. `src/domaine/reel-facebook.ts:24` (cosmétique) : un `format` vide donne « Cette vidéo est en  : … ».
