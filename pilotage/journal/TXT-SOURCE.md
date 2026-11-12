# TXT-SOURCE — texte du post depuis le vrai script (final)
Fait : source du texte = script relié, puis script gardé (tableau, face caméra animée, écrans du cas concret, fiche image → vidéo), titre en dernier ; la vue porte texteDepuis:"titre" et l'écran dit « Texte proposé depuis le titre seulement ». Script vide/blanc/illisible = absent.
Fichiers : src/services/source-texte-post.ts (nouveau), publications.ts, vues.ts, KitPublication.tsx, tests/ecriture-post/txt-source.test.ts (nouveau). Moteurs lus, jamais modifiés ; aucune couleur hors thème.
Critères tenus : (1) script du générateur demandé : txt-source.test.ts « (1) » x4 ; (2) titre + phrase : « (2) » x2 ; (3) aucun mot du titre absent du script dans texteScript : « (3) » ; (4) retouche à la main intacte : « (4) ».
Tests : fiche 11 passés, 0 échoué (rouges avant : 4 échecs sans le code de publications.ts, fichier absent sans le module). Voisins (40 fichiers publication + ecriture-post) : 489 passés, 12 échoués = tests/garde-ecran, r1-relecture, r8-bout-en-bout, identiques sur master. tsc : aucune erreur nouvelle ; eslint : aucune erreur.
Douteux : « aucun mot du titre » lu comme le texte de script demandé (champ texteScript) ; le champ titre de la demande reste transmis (utilisé par les contrôles et le titre LinkedIn). Cas concret et image → vidéo écrivent déjà leurs textes (KIT-CC-IV) : leurs lecteurs de script sont prévus mais seulement testés en pur.
Reste : rien.
contrôle anti-fuite : vide
