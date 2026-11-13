# L7-08 · lot B : tests/zernio préparés pour la porte « publication.editoriale_active » — fait, une PR, rien de fusionné
Contexte : la branche usine/L7-08 exige le réglage « publication.editoriale_active » (vrai) pour les envois du calendrier. Fusionnée avec master, elle rend rouges 43 tests dans 9 fichiers de tests/zernio. Ce lot les prépare AVANT elle (ordre de fusion de la relecture z9 : lot B d'abord).
Les 9 fichiers (trouvés par fusion jetable de origin/usine/L7-08 dans origin/master) : diag-studio-zernio, e2e-04-service, fix-cible-reessai, imp2-brouillons, imp3-corrections-imp2, imp3-jumeaux, imp3-relecture, journal-envoi, l7-08-envoi-calendrier (tous sous tests/zernio/).
Changement : dans la préparation de chaque test, le réglage est allumé par REGLAGE_EDITORIALE_ACTIVE (déjà exportée par src/services/promotion-envois.ts). Aucune attente modifiée, aucun test retiré, aucun fichier de src/ touché.
Écart signalé : imp2-brouillons et imp3-corrections-imp2 n'ouvraient pas non plus le réglage du calendrier (master ne fermait pas la création de brouillons) ; l'éditorial seul laissait 6 échecs. Ils allument aussi REGLAGE_ENVOI_CALENDRIER (même fichier source, préparation seulement).
Fichiers interdits (liaison-eteint-fige + son instantané, stop-s6-garde) : non touchés ; ils ne sont pas parmi les fichiers rouges.
Preuves : tests/zernio sur la branche seule (lot inerte, base master) : 141 fichiers, 2226 verts, 0 échec. Sur fusion jetable avec origin/usine/L7-08 : voir la description de la PR (mêmes chiffres attendus).
contrôle anti-fuite : vide
