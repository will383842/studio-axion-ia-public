# Contrat Zernio (z0)

`openapi-extrait-1.418.1.json` est l'extrait des 9 chemins (11 opérations) de la liste fermée D6. Il provient de la spec en ligne **version 1.429.1** ; le nom du fichier garde « 1.418.1 » pour ne pas casser les références. Il a été fourni par la session principale (la routine cloud ne résout pas zernio.com). Ne pas le modifier à la main.

Les chemins utilisent `{accountId}` et `{postId}`.

## Où se posent les champs (d'après l'extrait)

Corps de `POST /v1/posts` : `title, content, mediaItems, platforms, scheduledFor, publishNow, isDraft, requiresApproval, dryRun, timezone, tags, hashtags, mentions, crosspostingEnabled, metadata, tiktokSettings, facebookSettings, recycling, queuedFromProfile, queueId`. Chaque entrée de `platforms` : `platform, accountId, customContent, customMedia, scheduledFor, platformSpecificData`.

| Champ | Emplacement |
|---|---|
| contentPreviewConfirmed, expressConsentGiven, allowComment, allowDuet, allowStitch, videoMadeWithAi, privacyLevel, commercialContentType | schéma `TikTokPlatformData` : soit `platformSpecificData` de l'entrée TikTok, soit `tiktokSettings` à la racine du corps (fusionné dans chaque entrée TikTok, l'entrée l'emporte). Exemples de la spec : `tiktokSettings`. |
| isAiGenerated (Instagram) | `InstagramPlatformData` → `platformSpecificData` de l'entrée Instagram |
| documentTitle | `LinkedInPlatformData` → `platformSpecificData` de l'entrée LinkedIn (pas dans `mediaItems`). Si `documentTitle` manque, LinkedIn reprend le `title` de l'élément de média, puis le nom du fichier. |
| firstComment | `platformSpecificData` des entrées Threads, Facebook, Instagram, LinkedIn (existe aussi dans `YouTubePlatformData`) |
| pageId | `FacebookPlatformData` → `platformSpecificData` de l'entrée Facebook |
| organizationUrn | `LinkedInPlatformData` → `platformSpecificData` de l'entrée LinkedIn |
| metadata | racine du corps de `POST /v1/posts` et `PUT /v1/posts/{postId}` (objet libre, renvoyé en lecture) |
| isDraft | racine du corps de `POST /v1/posts` et `PUT /v1/posts/{postId}` (booléen, défaut false) |
| Idempotency-Key | en-tête (optionnel, 255 caractères max) de `POST /v1/posts` ; même clé = même post pendant 24 h |

## Buffer (d'après docs/buffer/schema-2026-10.json)

- `firstComment` : présent dans `InstagramPostMetadataInput`, `FacebookPostMetadataInput`, `LinkedInPostMetadataInput` (et leurs types de lecture).
- `linkAttachment` : `FacebookPostMetadataInput`, `LinkedInPostMetadataInput`, `ThreadsPostMetadataInput`, `BlueskyPostMetadataInput`, `SubstackPostMetadataInput` ; type `LinkAttachmentInput` = `url, title, description, thumbnail`.
- `document` + titre : `AssetInput.document` de type `DocumentAssetInput` = `url, title, thumbnailUrl`.
- « Passer un post en brouillon » : **aucune mutation de ce nom**. `movePostToDraft` n'est qu'une valeur de l'énumération `PostAction`, pas une mutation. Les leviers réels : `saveToDraft` dans `CreatePostInput` et `EditPostInput`, et les mutations `createContentItemDraft`, `updateContentItemDraft`, `promoteContentItemDraftToPosts`.

## Profil LinkedIn (Z1-P) : comment il est prouvé

Une cible LinkedIn s'écrit `<compte>:li:<n°>` (page, avec son numéro d'organisation) ou `<compte>:li:profil` (profil personnel). Le profil n'est **jamais présumé** :

- À l'envoi réel, le fournisseur relit le compte chez Zernio (`listerComptes()`), retrouve celui de la cible et applique `compteLinkedinEstProfil`. Seules les valeurs explicites « personnel » (`personal`, `profile`, `person`) dans `accountType`, `profileType` ou `type` comptent ; toute autre valeur, ou un compte introuvable, donne « non » et la demande est refusée avant tout envoi.
- Un profil non prouvé ne reçoit donc jamais de publication : le refus est sûr et lisible, rien n'est écrit chez Zernio.
- À l'import des brouillons (IMP-2), la même preuve est exigée avant de créer un brouillon sur un profil (`profilLinkedinProuve`) ; sans elle, la ligne est refusée.
- La table des cibles refuse dès la validation une ligne LinkedIn qui ne nomme ni la page (`:li:<n°>`) ni le profil (`:li:profil`).
- Aucun identifiant réel n'est écrit dans le dépôt : la table des cibles reste sur le serveur, confirmée par l'opérateur (« C'est juste »).
