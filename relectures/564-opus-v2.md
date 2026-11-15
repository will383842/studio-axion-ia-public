# Relecture PR 564 (fiche L5-26) — 2e passe

## VERDICT : OK — FUSION POSSIBLE sur la tête complète `c46e034e92aafe22a822ad5fa863c45ae7be9cba`

(`origin/usine/L5-26-v2` = tête de la PR 564.) Les 4 points de la 1re relecture (`relecture/564-opus`, sur `5969b48`) sont corrigés.

## Les 4 points de la 1re relecture
1. **E-mails dissimulés : CORRIGÉ** (`src/domaine/publications/attribution-post.ts:37-56`). Toutes les formes citées sont refusées (sonde) : `nom [at] exemple.fr`, `nom(at)exemple.fr`, `nom @ exemple.fr`, `nom@ exemple.fr`, `nom@exemple .fr`, `nom＠exemple.fr`, `nom%40exemple.fr`. Les variantes ajoutées sont aussi refusées : `( at )`, `[ AT ] … . fr`, `<at>…<dot>`, `[point]`, `(arobase)`, `(dot)`, `﹫`, tout en pleine chasse, `%40…%2E`, tabulation ou saut de ligne autour de `@`, `@` précédé d'un espace sans chasse (U+200B), `%` isolé dans le texte (repli si `decodeURIComponent` échoue). Les textes sans e-mail sont acceptés : vide, `@compte_test`, `5 %`, `100%`, `site.fr`, URL avec `utm_source`, JSON `mot`/`post_ref`, `(at) la boutique. Merci`.
2. **Contrat utm_campaign : CORRIGÉ, avec un écart documenté et non bloquant** (`tests/attribution/jointure-mot-publication.test.ts:48-83`). Le motif de forme a été retiré. `utmCampaignDuLien(construireLienSuivi(...))` est vérifié égal au code, pour un code de version (`0042-TB-IG`) et un code de mot (`mot-guide`). La valeur du contrat, `guide_reseau`, est maintenant passée réellement à `construireLienSuivi` : le test affirme le refus (`ErreurLienSuivi`, `caractere_interdit`) et un `it.todo` attend que le contrat soit aligné.
   **Mon avis sur l'écart :** il est bien documenté (commentaire aux lignes 63-64, `it.todo` à la ligne 83, section « Écart connu » de la description de la PR). Il ne bloque pas cette PR : le contrat est figé par empreinte et `mesures.ts` sort du périmètre, donc la fiche ne peut pas le corriger. Le test ne laisse plus passer l'écart en silence : si le contrat est aligné, le test des lignes 71-82 deviendra rouge et obligera à activer le `todo`. La décision sur le contrat (`guide_reseau` → code avec tirets, ou assouplir le constructeur) relève d'une fiche à part. La mention « Décision à prendre avant fusion » dans la PR concerne donc le contrat, pas ce code.
3. **post_ref normalisé : CORRIGÉ** (`attribution-post.ts:27-31`). `"p1"`, `" p1 "` et `" p1 "` donnent une seule publication (sonde). `"P1"` reste distinct : c'est acceptable, une référence peut tenir compte de la casse.
4. **Cas de test manquants : CORRIGÉ** (lignes 17-21 et 34-42) : `post_ref` fait d'espaces, de tabulation ou `null`, `post_ref` entouré d'espaces, 12 formes dissimulées, 5 textes sans e-mail.

## Vérifications
- Tests : `Tests 27 passed | 1 todo (28)`.
- Mutations faites à la main, chacune rend des tests rouges : sans `deshabiller` → 8 rouges ; sans NFKC → 1 ; sans `decodeURIComponent` → 2 ; sans `[at]` → 4 ; sans `arobase` nu → 1 ; sans `[dot]` → 1 ; sans `\s*` autour de `@` → 5 ; sans `trim` de la clé → 1 ; sans `trim` pour le vide → 1 ; `utm_campaign`→`utm_content` → 2 ; tri inversé → 1.
- Périmètre : 2 fichiers, tous deux autorisés (`attribution-post.ts` et son test).
- tsc : 146 erreurs sur master `9ad0416` comme sur la PR, sorties identiques, aucune dans ces fichiers. eslint propre sur les 2 fichiers.
- `scripts/echecs-connus.json` inchangé.
- Aucun nom de personne (seuls le générique `Nom.Prenom` et des domaines `exemple.*`).
- La branche est fondée sur `da085be`. `origin/master` est à `9ad0416` (force-poussé) ; la fusion se fait sans conflit (`git merge-tree`).

## Remarques mineures, non bloquantes (à suivre éventuellement)
- `attribution-post.ts:40-51` : restent acceptés les mots nus sans crochets (`nom at exemple dot fr`, `nom arobase exemple point fr` : `point` nu n'est pas converti) et le double encodage (`nom%2540exemple.fr`). Ce sont des formes plus exotiques que celles du critère.
- `attribution-post.ts:37` : quelques faux positifs, dans le sens prudent (refus) : `rdv @ 14h. Ensuite`, `texte arobase seul. Fin`. C'est acceptable pour une jointure qui ne doit jamais contenir de donnée de personne.

Sondes jetables, non poussées.
