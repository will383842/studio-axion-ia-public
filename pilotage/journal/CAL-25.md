# CAL-25 — final
Fait : formats par réseau (raison en français, limites incluses), dépôt relu (taille + empreinte, sinon refus et entrée « propose » = brouillon), rattachement vidéo/visuel, lien public via relais L5-04 et téléversement serveur seulement après validation, ratio, affiche, urlDeLecture (600 s).
Fichiers : src/domaine/calendrier/formats-media.ts, src/services/medias-deposes.ts, src/components/calendrier/DepotMedia.tsx, AjouterEntree.tsx, tests/calendrier/cal-25-media-depose.test.ts (test rouge vérifié : modules absents avant le code).
Critères tenus (tests/calendrier/cal-25-media-depose.test.ts) : stockage privé jusqu'à validation « dépôt complet », « après validation » ; format refusé non bloquant « format refusé par le réseau » ; lien signé « lien public signé » ; empreinte/taille « taille relue », « empreinte relue » ; téléversement serveur « le serveur téléverse » ; ratio/affiche/urlDeLecture « expose le ratio ». CORRECTIFS (validation « non », L5-04 dépendance) : tenus.
Tests : tests/calendrier + relais-buffer + mediatheque : 357 passés, 0 échoué (dont 18 de la fiche). tsc : aucune erreur sur mes fichiers.
Reste : DepotMedia ne branche pas encore l'envoi réel (/api/depots) ni l'action ajouterEntree (hors fichiers autorisés) ; le téléverseur chez le diffuseur est un port injecté, non branché. Limites de format prudentes, à confirmer.
Douteux : « brouillon » = statut « propose » (pas de statut brouillon dans le plan). Le test de composant ne vérifie que le texte rendu.
contrôle anti-fuite : vide
