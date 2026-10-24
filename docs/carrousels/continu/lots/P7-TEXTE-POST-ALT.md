# P7 — Texte du post, textes alternatifs, 1er commentaire : branche `carrousels/continu-p7` (après P1)
- `src/visuels/continu/texte/post.ts` (PUR) : `textePost(toile, reseau)`.
  - 1re ligne < 140 signes = question de fond ou promesse de la page 1 ;
  - puis les points clés de chaque page (une ligne courte chacun), puis UN appel de valeur (enregistrer, écrire en message privé).
  - Instagram : 2 200 signes et 5 mots-dièse au plus, choisis dans la famille du réseau (`src/reseaux/hashtags.ts`, `choisirDansFamille` si elle s'applique ; jamais #fyp, #viral, #pourtoi). Facebook : 5 000 signes, 0 à 3 mots-dièse.
  - Interdits : « commentez », chiffres sans fait, interdits de la porte (le texte passe par `ctx.interditsDans`).
- `textesAlternatifs(toile)` : `alt` de chaque page, sinon un alt construit depuis ses textes (≤ 125, « Page N sur M : … »).
- `premierCommentaire(toile)` : vide par défaut ; la source si une page cite un fait (aucune en V1).
## Tests ROUGES
Longueurs par réseau ; 1re ligne < 140 ; ≤ 5 mots-dièse sur Instagram ; aucun « commentez » ; alt ≤ 125 et un par page ; texte passé à la porte → vert sur l'exemple, rouge avec « Grenoble ».
