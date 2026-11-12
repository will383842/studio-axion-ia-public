# ADR-0004 · Zernio Z4 · Garde-fous d'envoi : chemins, mots interdits, étiquette IA, cibles, médias

- Statut : acceptée
- Date : 2026-11-01
- Chantier : Zernio, décisions D6, D7, D8, D9 et D10
- Liens : ADR-0001, ADR-0002, ADR-0003

## Contexte

L'API Zernio est large : comptes, connexions, clés, webhooks, messages, automatisations, publicités, envois groupés, files d'attente, publication immédiate. Le Studio n'en a besoin que d'une petite partie. Une clé API Zernio donne pourtant accès à tout : la sécurité doit donc venir du client du Studio lui-même, avant le réseau.

Par ailleurs :

- le filtre des mots interdits actuel ne regarde que le texte principal, alors que Zernio accepte des chaînes à de nombreux endroits (premier commentaire, contenu par réseau, titres, textes alternatifs, métadonnées) ;
- chaque réseau a ses propres champs pour la mention IA, et TikTok impose des consentements explicites ;
- un même compte Zernio peut porter plusieurs pages Facebook ou organisations LinkedIn : sans cible explicite, Zernio publie sur la page par défaut ;
- les médias passent par une adresse d'envoi temporaire, et chaque réseau a ses limites de formats.

## Décision

D6 · Liste fermée de chemins (refus AVANT le réseau, test à l'appui) : GET /v1/accounts ; GET /v1/accounts/{id}/facebook-page ; GET /v1/accounts/{id}/linkedin-organizations ; GET /v1/accounts/{id}/tiktok/creator-info ; GET /v1/accounts/{id}/instagram/publishing-limit ; POST /v1/media/presign ; PUT <uploadUrl> (https, hôte rendu par presign, SANS Authorization) ; POST /v1/posts (jamais publishNow) ; GET /v1/posts/{id} et /v1/posts ; PUT /v1/posts/{id} (formes de D5 seulement) ; GET /v1/analytics. Refusés : tout DELETE, PUT sur les comptes (dont selectedPageId et linkedin-organization), connexion et déconnexion de compte, api-keys, webhooks/* (jusqu'à Z6), messages, automatisations, publicités, bulk-upload, files d'attente, publishNow sous toutes ses formes. Interrupteur : réglage zernio.envoi_autorise (défaut vrai) ; faux = toutes les écritures refusées, lectures permises, vérifié en premier dans le client.

D7 · Filtre des mots interdits récursif : réutilise motsInterditsEnvoi (fournisseurs/publication/mots-interdits-envoi.ts). Parcours de TOUTES les chaînes du corps (texte, customContent, firstComment, documentTitle — placé dans platformSpecificData de l'entrée LinkedIn, pas dans mediaItems —, title des médias, altText, description, valeurs de metadata), puis contrôle de la sérialisation JSON entière. Refus avant le réseau. S'applique aux POST, aux PUT, au GET avant promotion et à l'import. Tests avec jetons concaténés.

D8 · Étiquette IA et TikTok : mention IA transmise seulement là où un champ existe : Instagram platformSpecificData.isAiGenerated: true ; TikTok videoMadeWithAi: true (vidéo seulement, jamais sur une photo). Facebook et LinkedIn : rien transmis, rien ajouté au texte. TikTok, 5 champs posés à chaque envoi : contentPreviewConfirmed: true, expressConsentGiven: true (les deux viennent de la case obligatoire, cochée à chaque envoi, sans option pour la passer), allowComment, allowDuet, allowStitch (valeurs permises lues dans creator-info ; si le créateur les a coupés : false). Aussi privacyLevel lu dans creator-info (public seulement en app Business) ; commercialContentType: "brand_organic" si « Votre marque ». Emplacement exact des champs figé par Z0 depuis l'OpenAPI. Refus serveur si la case n'est pas cochée.

D9 · Cibles Facebook et LinkedIn : 2e page Facebook = même accountId + platformSpecificData.pageId. LinkedIn page = organizationUrn ; profil = sans organizationUrn sur la connexion profil. Tout post Facebook ou LinkedIn sans cible explicite est refusé (jamais la page par défaut). Cible du Studio : accountId, accountId:fb:<pageId>, accountId:li:<n°>, ces identifiants vivent en base sur le serveur, jamais dans le dépôt. Journal d'import : documents import-buffer en base (jsonb, aucune migration), lus par l'écran Migration et par une synchro propre ; ils servent à mesurer le critère de résiliation.

D10 · Médias et formats : le serveur lit R2 (adresse signée interne) et pousse en flux vers uploadUrl avec Content-Length (adresse d'envoi valable 3 600 s). Le relais #147 reste pour Buffer jusqu'à Z5. Vidéo : Reel Facebook si 9:16 et 3 à 60 s, sinon vidéo du fil ; Instagram vidéo seule = Reel, shareToFeed: true. Images : 10 au plus sur Instagram et Facebook, 20 sur LinkedIn, un seul type de média par post LinkedIn, texte alternatif exigé (125 signes). PDF LinkedIn : un document, 100 Mo, titre exigé (le Studio l'exige même si Zernio replie sur le titre du média), au plus 60 signes, filtré. Dates : toujours Z + timezone "Europe/Paris". Pas de changement d'heure dans la fenêtre (prochain : 28/03/2027). Vidéo 4:5 : acceptée sur LinkedIn, non documentée ailleurs : essai réel requis.

## Conséquences

- Positives
  - Une clé Zernio fuitée côté Studio ne peut servir qu'aux chemins de la liste : pas de suppression, pas de déconnexion, pas de publication immédiate, pas de nouvelle clé.
  - L'interrupteur `zernio.envoi_autorise` coupe toutes les écritures d'un geste, sans couper la lecture ni la synchro.
  - Aucun mot interdit ne peut partir par un champ secondaire, ni par une concaténation de jetons : le contrôle porte aussi sur la sérialisation entière.
  - La mention IA est exacte et honnête : transmise là où le réseau la prévoit, jamais inventée dans le texte.
  - Les consentements TikTok sont donnés à chaque envoi, par un humain, et vérifiés côté serveur.
  - Jamais de publication sur une page par défaut non voulue.
  - Aucun identifiant de compte ou de page dans le dépôt public.
- Négatives
  - Chaque nouveau besoin d'API (webhooks en Z6 par exemple) exige d'élargir la liste, donc une nouvelle ADR ou un amendement.
  - Le filtre récursif refuse parfois un envoi pour une chaîne peu visible (métadonnée, texte alternatif) : le message de refus doit nommer le champ.
  - La case TikTok obligatoire à chaque envoi ajoute un geste, assumé.
  - Deux chemins de média coexistent jusqu'à Z5 (relais #147 pour Buffer, flux direct pour Zernio).
  - La vidéo 4:5 hors LinkedIn reste à valider par un essai réel avant d'être proposée.

## Alternatives écartées

- **Liste noire de chemins interdits** plutôt que liste fermée : tout chemin nouveau ou oublié passerait ; écartée.
- **Se fier aux portées de la clé Zernio** : la granularité ne couvre pas les formes de `PUT` ni `publishNow` ; écartée comme garde unique.
- **Contrôle d'interrupteur en fin de client** : une écriture pourrait partir avant ; écartée, il est vérifié en premier.
- **Filtrer seulement le texte principal** : laisse passer `firstComment`, `customContent`, `altText`, métadonnées ; écartée.
- **Ajouter une mention IA dans le texte sur Facebook et LinkedIn** : modifie le message sans champ prévu par le réseau ; écartée.
- **Mémoriser la case TikTok d'un envoi à l'autre** : le consentement doit être explicite à chaque envoi ; écartée.
- **Laisser Zernio choisir la page par défaut** : publication possible sur la mauvaise page ; écartée.
- **Écrire les identifiants de cible dans un fichier de configuration du dépôt** : dépôt public ; écartée, ils vivent en base.
- **Réutiliser le relais #147 pour Zernio** : étape inutile, le serveur peut pousser en flux directement ; écartée.
- **Dates en heure locale sans `Z`** : ambiguïtés de fuseau ; écartée.

## Tests qui la prouvent

- D6 : chaque chemin de la liste est accepté ; un échantillon de chemins refusés (`DELETE /v1/posts/{id}`, `PUT /v1/accounts/{id}`, `selectedPageId`, connexion, déconnexion, `api-keys`, `webhooks/*`, messages, automatisations, publicités, `bulk-upload`, files d'attente) est refusé **sans aucun appel réseau** (client HTTP simulé qui échoue s'il est appelé).
- D6 : `publishNow` refusé sous toutes ses formes (corps, paramètre de requête, casse différente).
- D6 : `PUT <uploadUrl>` refusé si non https, si l'hôte diffère de celui rendu par presign, ou si un en-tête `Authorization` est présent.
- D6 : `zernio.envoi_autorise = false` → toutes les écritures refusées, les GET passent ; l'interrupteur est lu avant toute autre vérification.
- D7 : un mot interdit placé dans chacun des champs listés (texte, `customContent`, `firstComment`, `documentTitle` de `platformSpecificData`, `title`, `altText`, `description`, valeur de `metadata`) provoque un refus avant le réseau ; même chose avec des jetons concaténés qui ne forment le mot que dans la sérialisation JSON.
- D7 : le filtre s'applique au POST, aux deux formes de PUT, au GET avant promotion et à l'import.
- D8 : Instagram porte `isAiGenerated: true` ; TikTok vidéo porte `videoMadeWithAi: true`, TikTok photo ne le porte pas ; Facebook et LinkedIn ne portent aucun champ IA et le texte est inchangé.
- D8 : TikTok porte les 5 champs à chaque envoi ; `allowDuet` coupé dans creator-info → `false` ; case non cochée → refus serveur ; `commercialContentType: "brand_organic"` seulement si « Votre marque ».
- D9 : post Facebook ou LinkedIn sans cible explicite refusé ; `accountId:fb:<pageId>` produit `platformSpecificData.pageId` ; `accountId:li:<n°>` produit `organizationUrn` ; profil LinkedIn sans `organizationUrn`.
- D9 : garde de dépôt : aucun identifiant de compte ou de page en clair dans les sources.
- D10 : envoi en flux avec `Content-Length` ; refus au-delà de 10 images (Instagram, Facebook) et 20 (LinkedIn) ; refus d'un post LinkedIn mêlant deux types de média ; texte alternatif manquant ou de plus de 125 signes refusé ; PDF LinkedIn sans titre, de plus de 60 signes ou de plus de 100 Mo refusé.
- D10 : vidéo 9:16 de 3 à 60 s → Reel Facebook, sinon vidéo du fil ; vidéo seule Instagram → Reel avec `shareToFeed: true`.
- D10 : toute date sérialisée se termine par `Z` et le corps porte `timezone: "Europe/Paris"`.
