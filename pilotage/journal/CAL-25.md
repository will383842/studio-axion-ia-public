# CAL-25 — final
Fait : formats par réseau (raison en français, limites incluses), dépôt relu (taille + empreinte, sinon refus et entrée « propose » = brouillon), rattachement vidéo/visuel, lien public via relais L5-04 et téléversement serveur seulement après validation, ratio, affiche, urlDeLecture (600 s).
Fichiers : src/domaine/calendrier/formats-media.ts, src/services/medias-deposes.ts, src/components/calendrier/DepotMedia.tsx, AjouterEntree.tsx, tests/calendrier/cal-25-media-depose.test.ts (test rouge vérifié : modules absents avant le code).
Critères tenus (tests/calendrier/cal-25-media-depose.test.ts) : stockage privé jusqu'à validation « dépôt complet », « après validation » ; format refusé non bloquant « format refusé par le réseau » ; lien signé « lien public signé » ; empreinte/taille « taille relue », « empreinte relue » ; téléversement serveur « le serveur téléverse » ; ratio/affiche/urlDeLecture « expose le ratio ». CORRECTIFS (validation « non », L5-04 dépendance) : tenus.
Tests : tests/calendrier + relais-buffer + mediatheque : 357 passés, 0 échoué (dont 18 de la fiche). tsc : aucune erreur sur mes fichiers.
Reste : DepotMedia ne branche pas encore l'envoi réel (/api/depots) ni l'action ajouterEntree (hors fichiers autorisés) ; le téléverseur chez le diffuseur est un port injecté, non branché. Limites de format prudentes, à confirmer.
Douteux : « brouillon » = statut « propose » (pas de statut brouillon dans le plan). Le test de composant ne vérifie que le texte rendu.
contrôle anti-fuite : vide

## Corrections après relecture (u1, 12/11/2026)
- Dépôt sur une entrée validée ou programmée : elle repasse « a_valider » (revalidation du fondateur) ; entrée publiée : dépôt refusé. Corrigé, tests/calendrier/cal-25-media-depose.test.ts (bloc « un dépôt ramène l'entrée en brouillon »), rouge d'abord.
- Format refusé : porteValidee revérifie le format pour chaque réseau de l'entrée ; lien et téléversement refusés, 0 appel au diffuseur. Corrigé, même bloc, rouge d'abord.
- Formulaire : le fichier choisi est réellement envoyé (envoyerFichierChoisi, dépôt existant, entrée manuel-<clé>) puis rattaché par ajouterEntree ; format refusé jamais envoyé ; pas de renvoi sur « Ajouter quand même ». Corrigé, bloc « formulaire », rouge d'abord.
- Anciens tests : la validation est posée APRÈS le dépôt (ils supposaient un dépôt sans effet sur le statut).
- Reste : l'enregistrement serveur (enregistrerDepot) n'est branché à aucune action (hors fichiers autorisés) : PILOTAGE.
- master fusionné. Tests (calendrier, calendrier-*, visuels, relais, médiathèque) : 1906 passés, 0 échoué. tsc : 147 erreurs, comme master (0 nouvelle). Aucune couleur ajoutée.
contrôle anti-fuite : vide

## Corrections après relecture (x1, 12/11/2026)
- [bloquant] Ajout manuel sans fichier : TypeError (null.envoi), ajouterEntree jamais appelé. Corrigé (AjouterEntree.tsx : le cache d'envoi n'est lu que si un fichier est choisi). Test en tableau tests/calendrier/cal-25-formulaire.test.tsx, rouge d'abord (TypeError relevé), vert ensuite : sans fichier, bon format, format refusé, envoi en échec, dépôt sur entrée validée (revient à « a_valider »).
- [à corriger] Envoi du fichier en échec : l'entrée est maintenant créée sans fichier, phrase « le fichier n'a pas été envoyé (connexion) : … à joindre ensuite ». Corrigé (DepotMedia.tsx, ancien test « envoi en échec » réécrit).
- [remarque] Format refusé : le message de succès dit maintenant que le fichier n'a pas été envoyé et pourquoi. Corrigé, testé.
- [remarque] Ancien fichier d'une entrée « programme » non retiré chez le diffuseur : reporté, PILOTAGE (diffuseur hors liste).
- Fichier de test ajouté hors liste, nécessaire à l'avis : tests/calendrier/cal-25-formulaire.test.tsx. Master fusionné. Aucune couleur ajoutée.
- Tests (calendrier, calendrier-ajout-manuel, rc-32, couleurs) : 463 passés, 0 échoué. tsc : 147 erreurs, aucune nouvelle (master : 149 sur le même arbre).
contrôle anti-fuite : vide
