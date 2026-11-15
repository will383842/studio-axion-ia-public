# Relecture PR 572 (Opus)

**VERDICT : OK — FUSION POSSIBLE sur la tête complète 14bc28ea6f2048a58ac3f42230a36cce19602167**

PR 572 « Lot B + C : YouTube Shorts par Zernio (éteint par défaut) et retiré des réseaux par défaut », branche `zernio/youtube-shorts-b-c`, 22 fichiers, +1143/-21, 7 commits. Relecture en lecture seule, seul ce fichier est écrit.

## Points vérifiés

1. **Éteint par défaut.** `zernio.youtube_actif` vaut `false` par défaut (`src/services/etat-production.ts:21`). Seul le booléen `true` l'allume (`youtubeActifBrut`, `src/fournisseurs/publication/zernio-youtube.ts`). La porte est double :
   - côté service, `exigerYoutubeZernioPret` agit avant la préparation et la réservation (`src/services/publications.ts:947-948`) ;
   - côté fournisseur, `reglagesYoutubeSiPermis` agit avant le premier corps et tout appel client (`src/fournisseurs/publication/zernio.ts:152`). La lecture est bornée à 500 ms. Une exception, un délai dépassé ou une valeur autre que `true` donnent un refus.

   Il faut aussi des réglages enregistrés : les 5 champs exacts, jamais complétés par `PROPOSITION_YOUTUBE`. `definirYoutubeActif(true)` refuse sans réglages valides. Aucun écran n'est ajouté, donc on ne peut allumer que par un geste explicite. Les autres envois (`.envoyer`) passent tous par le fournisseur Zernio, qui est gardé.
2. **Aucun appel réel dans les tests.** `fetch` est remplacé dans b4 (stub global, la réponse est factice pour toute adresse). b5 utilise `clientPret` et `lireYoutube` doublés. Les clés et les adresses sont fictives (`*.test`).
3. **YouTube Shorts retiré des réseaux par défaut sans perte.** Le défaut tient dans une seule constante (`src/domaine/reseaux-par-defaut.ts`), reprise aux 6 emplacements. La migration 24 (`src/services/migrations/etape-24-reseaux-sans-youtube.ts`) :
   - n'est jouée qu'une fois (repère) ;
   - sauvegarde d'abord l'ancienne valeur dans `reseaux.parDefaut.avantLotC`, sans jamais l'écraser ;
   - garde `creeLe` ;
   - ne touche pas une valeur absente, illisible ou réduite à YouTube seul ;
   - ne supprime rien.
4. **Périmètre.** Les 22 fichiers correspondent au plan décrit dans la PR : corps et fournisseur Zernio YouTube, interrupteur, service, constante de défaut, migration 24, test r2 retouché (liste attendue seulement) et 7 tests `tests/youtube-zernio`. Le plafond local de 10 Shorts par jour figure dans `zernio-client.ts`. Les corps Instagram, Facebook, LinkedIn et TikTok sont inchangés : les tests b5 le prouvent pour TikTok et Instagram, avec un corps identique et `lireYoutube` jamais appelé.
5. **Tests ciblés.** `npx vitest run tests/youtube-zernio tests/r2-textes-publication.test.ts` donne 8 fichiers et 112 tests verts, sur la tête de la PR comme sur sa fusion avec le master actuel (d19d8d2c, fusion sans conflit). Sur 25 fichiers liés (zernio-corps, migrations, reseaux.parDefaut), on a 298 verts et 11 rouges : `e2e-verif1-d-interrupteurs` et `r8-bout-en-bout`. Ces 11 rouges sont **identiques sur master** (11 rouges, Buffer gelé par #561), comme la PR le déclare. Ils ne sont pas causés par la PR.
6. `scripts/echecs-connus.json` est **inchangé**.
7. **Aucun nom de personne et aucun prix** (montant) dans le diff. La description mentionne seulement « prix montré plus bas », sans montant.
8. **Contrôles GitHub sur la tête 14bc28ea : 9 sur 9 verts** (next build, tests des fichiers touchés, règles de fer, garde de zone, tests ciblés, eslint/tsc différentiels, tests des nouveaux tests, garde interne, build Docker).

## Remarques non bloquantes

1. `src/services/publications.ts:948` (faible) : si YouTube Shorts est coché alors que l'interrupteur est éteint, **tout** l'envoi Zernio de la vidéo est refusé, pas seulement YouTube. C'est voulu (« refus net ») et sans risque, puisque rien ne part. Une fois le lot C appliqué, YouTube n'est plus coché par défaut. À garder en tête pour le futur écran.
2. `src/fournisseurs/publication/zernio-corps.ts:94` (information) : `plateformeZernio("youtube-shorts")` ne lève plus d'exception. Les comptes YouTube reliés à Zernio apparaissent donc désormais dans les cibles (`zernio-cibles.ts`, `comptes-envoi-zernio.ts`, calendrier). Le contenu ne peut toujours pas partir, à cause de la double porte. Aucun compte YouTube n'est relié à ce jour.
3. Le Short refuse tout format autre que `9:16` et toute durée supérieure à 180 s. C'est prudent et cohérent avec le plan.
