# Règles officielles des réseaux (fiche L8-01)

Relevé du 2026-11-12. Source de vérité des constantes chiffrées : une valeur non trouvée sur une source officielle vaut « inconnu ». Les données sont dans `regles-officielles.json` (même contenu, vérifié par `tests/reseaux/regles-officielles.test.ts`).

**Limite de ce relevé.** Les sites officiels de LinkedIn, Meta (Instagram, Facebook), TikTok et la documentation en ligne de Zernio n'étaient pas joignables depuis la session de recherche (réseau fermé). Aucune page officielle d'un réseau n'a donc été lue : tout ce qui n'est pas dans la copie de la spec Zernio du dépôt vaut « inconnu ». La spec Zernio est lue dans docs/zernio/openapi-extrait-1.418.1.json (version 1.429.1 de la spec en ligne), fournie au dépôt par une session précédente. Cellule « secondaire » = chiffre propre à un réseau cité par Zernio, pas lu chez le réseau.

Niveaux de preuve : **officiel** (page du réseau ou de Zernio lue), **secondaire** (source non officielle, ou chiffre du réseau seulement cité par Zernio), **inconnu** (non trouvé). Aucune source n'a plus de 6 mois ; la règle « à revérifier » s'appliquera dès qu'une date aura plus de 6 mois.

YouTube : éteint (non relevé).

## LinkedIn

### Couche 1 : règles du réseau (LinkedIn)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | inconnu | inconnu | — | — |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | inconnu | inconnu | — | — |
| Statistiques | Profil personnel : mesures seulement pour les posts écrits par le compte connecté ; pages : tous les posts (d'après la spec Zernio, page LinkedIn non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Plafond de posts | inconnu | inconnu | — | — |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | inconnu | inconnu | — | — |
| Vidéo (durée, taille) | inconnu | inconnu | — | — |
| Carrousel / document PDF | 20 images ; un PDF de 100 Mo au plus, d'après la spec Zernio (page LinkedIn non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | inconnu | inconnu | — | — |

### Couche 2 : règles de Zernio (LinkedIn)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | Champ « premier commentaire » publié après le post | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | Refus (409) d'un contenu identique pour la même plateforme et le même compte dans les 24 h ; clé d'idempotence valable 24 h | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Statistiques | Route de statistiques de posts ; début par défaut 90 jours en arrière, étendue au plus 366 jours ; profil personnel : seulement pour les posts publiés via Zernio ; pages : tous les posts | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Plafond de posts | Plafond de rythme : 25 posts par heure et par compte, plus des plafonds quotidiens par plateforme (valeurs non données) | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | Les mots-dièse ne sont pas ajoutés tout seuls : ils doivent figurer dans le texte du post | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Vidéo (durée, taille) | inconnu | inconnu | — | — |
| Carrousel / document PDF | Jusqu'à 20 images, pas de multi-vidéo ; un seul PDF (100 Mo au plus) ; titre de document exigé par LinkedIn | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | Texte alternatif appliqué (valeur par image, la même pour tous les réseaux choisis) ; longueur non donnée | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |

## Instagram

### Couche 1 : règles du réseau (Instagram)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | inconnu | inconnu | — | — |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | inconnu | inconnu | — | — |
| Statistiques | inconnu | inconnu | — | — |
| Plafond de posts | inconnu | inconnu | — | — |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | inconnu | inconnu | — | — |
| Vidéo (durée, taille) | inconnu | inconnu | — | — |
| Carrousel / document PDF | inconnu | inconnu | — | — |
| Texte alternatif | inconnu | inconnu | — | — |

### Couche 2 : règles de Zernio (Instagram)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | Champ « premier commentaire » publié après le post (pas pour les Stories) | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | Refus (409) d'un contenu identique pour la même plateforme et le même compte dans les 24 h ; clé d'idempotence valable 24 h | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Statistiques | Route de statistiques de posts ; début par défaut 90 jours en arrière, étendue au plus 366 jours | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Plafond de posts | Quota glissant sur 24 h lu en direct par une route dédiée ; ne pas figer de chiffre (la valeur en direct fait foi) ; plus 25 posts/heure par compte | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | Les mots-dièse ne sont pas ajoutés tout seuls : ils doivent figurer dans le texte du post | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Vidéo (durée, taille) | Vidéo seule = Reel ; option de diffusion au fil ; durée non vérifiée par Zernio | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Carrousel / document PDF | inconnu | inconnu | — | — |
| Texte alternatif | Appliqué aux images du fil seulement, pas aux Reels ni aux Stories ; longueur non donnée | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |

## Facebook

### Couche 1 : règles du réseau (Facebook)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | inconnu | inconnu | — | — |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | inconnu | inconnu | — | — |
| Statistiques | inconnu | inconnu | — | — |
| Plafond de posts | inconnu | inconnu | — | — |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | inconnu | inconnu | — | — |
| Vidéo (durée, taille) | Reel : 3 à 90 s, d'après la spec Zernio qui cite le guide de publication Meta (page Meta non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Carrousel / document PDF | 10 images au plus par post, d'après la spec Zernio (page Meta non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | inconnu | inconnu | — | — |

### Couche 2 : règles de Zernio (Facebook)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | Champ « premier commentaire » publié juste après (posts et Reels, pas Stories) ; ignoré en brouillon | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | Refus (409) d'un contenu identique pour la même plateforme et le même compte dans les 24 h ; clé d'idempotence valable 24 h | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Statistiques | Route de statistiques de posts ; début par défaut 90 jours en arrière, étendue au plus 366 jours | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Plafond de posts | Plafond de rythme : 25 posts par heure et par compte, plus des plafonds quotidiens par plateforme (valeurs non données) | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Longueur de texte | inconnu | inconnu | — | — |
| Mots-dièse | Les mots-dièse ne sont pas ajoutés tout seuls : ils doivent figurer dans le texte du post | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Vidéo (durée, taille) | Reel : une seule vidéo verticale 9:16 ; Zernio ne contrôle pas la durée et cite le guide Meta : 3 à 90 s | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Carrousel / document PDF | Post : jusqu'à 10 images, pas de mélange image + vidéo ; carrousel à liens : 2 à 10 cartes, images seulement | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | Appliqué ; longueur non donnée | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |

## TikTok

### Couche 1 : règles du réseau (TikTok)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | Pas de premier commentaire côté TikTok dans la spec Zernio (page TikTok non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | inconnu | inconnu | — | — |
| Statistiques | inconnu | inconnu | — | — |
| Plafond de posts | inconnu | inconnu | — | — |
| Longueur de texte | Titre vidéo 2200 signes ; titre photo 90 signes, d'après la spec Zernio (page TikTok non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Mots-dièse | inconnu | inconnu | — | — |
| Vidéo (durée, taille) | inconnu | inconnu | — | — |
| Carrousel / document PDF | Carrousel photo jusqu'à 35 images, d'après la spec Zernio (page TikTok non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | TikTok n'a pas de texte alternatif, d'après la spec Zernio (page TikTok non consultée) | secondaire | [source](https://zernio.com/openapi.json) | 2026-11-12 |

### Couche 2 : règles de Zernio (TikTok)

| Règle | Valeur | Preuve | URL | Consulté le |
|---|---|---|---|---|
| Premier commentaire | Aucun champ de premier commentaire dans la spec TikTok | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Réponses aux commentaires | inconnu | inconnu | — | — |
| Messages privés | inconnu | inconnu | — | — |
| Duplication de contenu | Refus (409) d'un contenu identique pour la même plateforme et le même compte dans les 24 h ; clé d'idempotence valable 24 h | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Statistiques | Route de statistiques de posts ; début par défaut 90 jours en arrière, étendue au plus 366 jours | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Plafond de posts | Limites quotidiennes de publication directe TikTok, vérifiables à blanc (essai sans rien publier) ; plus 25 posts/heure par compte | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Longueur de texte | Titre vidéo jusqu'à 2200 signes ; titre d'un carrousel photo coupé à 90 signes | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Mots-dièse | Les mots-dièse ne sont pas ajoutés tout seuls : ils doivent figurer dans le texte du post | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Vidéo (durée, taille) | Durée maximale lue en direct dans les réglages du créateur (champ dédié) ; miniature JPG/PNG/WebP 20 Mo au plus | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Carrousel / document PDF | Carrousel photo jusqu'à 35 images | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |
| Texte alternatif | Ignoré : TikTok n'a pas de texte alternatif | officiel | [source](https://zernio.com/openapi.json) | 2026-11-12 |

## Constantes de `zernio-corps.ts` confrontées à leur source

(Fichier lu seulement, non modifié.)

| Constante | Valeur du code | Verdict | Cellule | Note |
|---|---|---|---|---|
| `REEL_FACEBOOK_DUREE_SEC` | 3 à 60 s | **écart** | `facebook.reseau.format_video` | Le code accepte 3 à 60 s ; la source citée (guide Meta, via la spec Zernio) donne 3 à 90 s. Écart prudent (le code refuse plus que nécessaire), sans risque d'envoi refusé, mais à confirmer sur la page Meta. |
| `ALT_MAX` | 125 signes | **inconnu** | `facebook.reseau.texte_alternatif` | Aucune source consultée ne donne 125 ; la spec Zernio ne donne que X 1000 et Pinterest 500. À prouver sur les aides officielles. |
| `TITRE_DOCUMENT_MAX` | 60 signes | **inconnu** | `linkedin.reseau.format_carrousel_document` | Aucune source consultée ne donne 60 pour le titre d'un document LinkedIn (la spec Zernio dit seulement que le titre est exigé). |
| `DOCUMENT_TAILLE_MAX` | 100 Mo | **conforme** | `linkedin.zernio.format_carrousel_document` | La spec Zernio dit : un PDF, 100 Mo au plus. |
| `IMAGES_MAX.linkedin` | 20 | **conforme** | `linkedin.zernio.format_carrousel_document` | La spec Zernio dit : jusqu'à 20 images. |
| `IMAGES_MAX.facebook` | 10 | **conforme** | `facebook.zernio.format_carrousel_document` | La spec Zernio dit : jusqu'à 10 images. |
| `IMAGES_MAX.tiktok` | 35 | **conforme** | `tiktok.zernio.format_carrousel_document` | La spec Zernio dit : carrousel photo jusqu'à 35 images. |
| `IMAGES_MAX.instagram` | 10 | **inconnu** | `instagram.zernio.format_carrousel_document` | Aucune valeur d'images Instagram dans la spec Zernio lue. |

## À valider par le fondateur

- Aucune page officielle d'un réseau n'a pu être lue : presque tout vaut « inconnu ». Il faut refaire la recherche avec un accès aux sites.
- Reel Facebook : le code coupe à 60 s, la source citée dit 90 s. Garder 60 par prudence ?
- Texte alternatif 125 signes : aucune source trouvée, à prouver ou à retirer.
- Titre de document LinkedIn 60 signes : aucune source trouvée, à prouver ou à retirer.
- Instagram : le nombre d'images d'un carrousel (10 dans le code) n'est pas prouvé.
- Zernio limite à 25 posts par heure et par compte : à garder en tête pour les grosses séries.
- Zernio refuse un texte identique sur le même compte dans les 24 h.
- Premier commentaire : Zernio le gère pour Facebook, Instagram et LinkedIn, pas pour TikTok.
- Réponses aux commentaires et messages privés : rien dans la spec Zernio lue, à chercher ailleurs.
- Statistiques d'un profil LinkedIn personnel : seulement pour les posts passés par Zernio.
