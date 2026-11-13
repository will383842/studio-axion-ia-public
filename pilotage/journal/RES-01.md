# RES-01 : limites des réseaux d'après le relevé officiel (L8-01)

- Fait : IMAGES_MAX.instagram passe de 10 à 20 (source et date en commentaire) ; TikTok : Commentaire, Duo, Collage décochées par défaut, cochées seulement si la personne les coche (champ `interactionsTiktok`) et si le créateur les permet ; Reel Facebook : 60 s gardé, commentaire citant les deux sources. Aucune autre constante changée. `src/reseaux/ecriture.ts` : non touché (rien à y changer).
- Tests : tests/reseaux/res-01-limites-officielles.test.ts (nouveau). Trois retouches accordées dans tests/zernio (z1p-corps:66, z1p-envoyer:98, e2e-02:291-297) faites, avec une assertion nouvelle (aucune case cochée d'avance).
- BLOQUÉ 1 : deux assertions de tests/zernio attendent encore « Instagram refuse 11 images » (e2e-02-fournisseur.test.ts:266-267 ; z1p-corps.test.ts:81-82). Elles sont hors des lignes accordées ; « tests/zernio en entier vert » est impossible sans les retoucher. Accord complémentaire de la session propriétaire nécessaire.
- BLOQUÉ 2 : la garde de zone n'offre aucun moyen pour une branche usine/* (aucune exception par accord ; zernio-corps.ts n'est pas couvert par RC-40 ; tests/zernio jamais). Garde non modifiée.
- Déjà rouge sur master : tests/reseaux/instantane-tables-formats.test.ts.
- Aucune PR ouverte.
