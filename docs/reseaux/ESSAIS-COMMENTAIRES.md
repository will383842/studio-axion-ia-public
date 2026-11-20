# Essais réels des commentaires par réseau (L5-23)

Note datée du **20/11/2026**. Tous les essais ont été faits sur les vrais comptes, par Zernio, depuis le serveur. Les publications d'essai ont été retirées ensuite.

## 1. Premier commentaire posé à la publication

| Réseau | Résultat | Remarque |
|---|---|---|
| LinkedIn (page et profil) | Posé | `firstComment` transmis à Zernio |
| Facebook (page et profil) | Posé | `firstComment` transmis à Zernio |
| Instagram | Posé | Transmis par le Studio depuis ZRN-01 (#1411) |
| TikTok | Non | Pas de premier commentaire ; publication publique seulement |
| YouTube | Non | Jamais de `firstComment` |

## 2. Lecture des commentaires reçus

Route : `GET /v1/inbox/comments` (liste des publications), puis `GET /v1/inbox/comments/{post}?accountId=…`.

| Réseau | Annoncés | Lus | Résultat |
|---|---|---|---|
| Facebook | 1 | 1 | Lecture complète |
| LinkedIn | 1 | 1 | Lecture complète |
| Instagram | 3 | 2 | Lecture partielle : le compteur du réseau peut inclure des commentaires masqués ou supprimés |

Chaque commentaire lu porte : `id`, `message`, `createdTime`, `from`, `likeCount`, `replyCount`, `platform`, `url`, `replies`, `isHidden`.

## 3. Retrait d'une publication

- Facebook et LinkedIn : `POST /v1/posts/{id}/unpublish` fonctionne.
- Instagram et TikTok : refusé par Zernio. Suppression à la main dans l'application du réseau.

## 4. Conséquences pour le Studio

- Ne jamais comparer le compteur annoncé et le nombre de commentaires lus pour Instagram : un écart est normal.
- Les réponses aux commentaires restent à la main sur Instagram et TikTok tant qu'aucun essai de réponse n'a été fait.
