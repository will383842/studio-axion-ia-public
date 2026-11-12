# TXT-SOURCE — texte du post depuis le vrai script (final)
Fait : source du texte = script relié, puis script gardé (tableau, face caméra animée, écrans du cas concret, fiche image → vidéo), titre en dernier ; la vue porte texteDepuis:"titre" et l'écran dit « Texte proposé depuis le titre seulement ». Script vide/blanc/illisible = absent.
Fichiers : src/services/source-texte-post.ts (nouveau), publications.ts, vues.ts, KitPublication.tsx, tests/ecriture-post/txt-source.test.ts (nouveau). Moteurs lus, jamais modifiés ; aucune couleur hors thème.
Critères tenus : (1) script du générateur demandé : txt-source.test.ts « (1) » x4 ; (2) titre + phrase : « (2) » x2 ; (3) aucun mot du titre absent du script dans texteScript : « (3) » ; (4) retouche à la main intacte : « (4) ».
Tests : fiche 11 passés, 0 échoué (rouges avant : 4 échecs sans le code de publications.ts, fichier absent sans le module). Voisins (40 fichiers publication + ecriture-post) : 489 passés, 12 échoués = tests/garde-ecran, r1-relecture, r8-bout-en-bout, identiques sur master. tsc : aucune erreur nouvelle ; eslint : aucune erreur.
Douteux : « aucun mot du titre » lu comme le texte de script demandé (champ texteScript) ; le champ titre de la demande reste transmis (utilisé par les contrôles et le titre LinkedIn). Cas concret et image → vidéo écrivent déjà leurs textes (KIT-CC-IV) : leurs lecteurs de script sont prévus mais seulement testés en pur.
Reste : rien.
contrôle anti-fuite : vide

## Corrections après relecture (12/11/2026)
- À corriger (titre dans la demande) : corrigé. DÉCISION DU PILOTE du 12/11/2026, 17 h 25 (vaut CORRECTIF) : publication.ts autorisé ; avec un script, le titre ne part plus (titre vide dans la demande, ligne « Titre : » absente de la consigne) ; sans script, le titre reste la source et l'écran le dit. Fichier ajouté à la liste : src/generateur/roles/publication.ts. Tenu : tests/ecriture-post/txt-source.test.ts « (3) » x2 (rouges avant : 2 échecs).
- Remarque (boucles vides) : corrigé, contrôle demandes().length > 0 dans chaque test.
- Remarque (phrase non rendue par KitPublication) : reporté, aucun test de rendu existant pour ce composant ; la vue porte texteDepuis.
- Remarque (lectures inutiles) : corrigé, scriptsGardesParLeGenerateur n'est lu que sans script relié.
- Tests : ecriture-post 44 passés, 0 échec ; zernio + r2-role-publication + e7 + couleurs = 1987 passés, 0 échec. r2-textes-publication (2) et schemas-claude-limites (1) échouent déjà sans ma correction. tsc : 147 / 147, 0 nouvelle.
contrôle anti-fuite : vide
