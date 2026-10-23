# API Higgsfield utilisée par le décor IA (lot L10)

> État au 09/10/2026 : **aucun appel réel** n'a été fait par le studio. Ce qui suit vient de l'essai mené le 08/10 avec
> le **connecteur Higgsfield** (voir `docs/facecam/PLAN-IMPLEMENTATION-FACECAM.md`, « RÉSULTATS DE L'ESSAI » et
> « Essai v2 »). Les points marqués **SUPPOSÉ** sont à vérifier sur la documentation officielle avant le premier essai
> réel ; ils sont tous rangés dans `CONTRAT_SUPPOSE` (`client.ts`), le seul endroit à corriger.

## Ce qui est sûr (vu à l'essai du 08/10)

| Point | Valeur |
|---|---|
| Modèle FLUX 3 Video Edit | `flux_3_video_edit` — 15 s au plus, **1 crédit/s**, consigne écrite, pas d'image de référence |
| Modèle Kling 3.0 Omni Edit | `kling_video_edit` — avec **image de référence du décor**, devis 30 crédits / 15 s (≈ 2 crédits/s) |
| Envoi d'un média | 3 temps : `media_upload` (réserve, rend une adresse présignée) → `PUT` des octets sur cette adresse → `confirm` |
| Préréglage | Higgsfield peut proposer un préréglage ; on le refuse avec `declined_preset_id` pour garder notre consigne |
| Visage réel | accepté par FLUX (aucun refus) |
| Sortie | même durée que l'entrée (15,04 s pour 15 s), 704×1248 en vertical, **24 i/s**, son à remettre par-dessus |

## SUPPOSÉ (à vérifier)

| Point | Supposé dans `CONTRAT_SUPPOSE` |
|---|---|
| Adresse de base | aucune par défaut : `HIGGSFIELD_API_URL` obligatoire pour le mode réel |
| Authentification | en-tête `Authorization: Bearer <HIGGSFIELD_API_KEY>` |
| Solde | `GET /v1/account/balance` → `{ credits }` |
| Réserver un média | `POST /v1/media_upload` `{ filename, content_type, size }` → `{ media_id, upload_url }` |
| Confirmer | `POST /v1/media_upload/{media_id}/confirm` |
| Lancer | `POST /v1/generations` `{ model, params: { video_media_id, prompt, reference_image_media_id?, declined_preset_id?, duration } }` → `{ job_id }` ; en-tête `idempotency-key` |
| Suivre | `GET /v1/generations/{job_id}` → `{ status: queued/in_progress/completed/failed/nsfw, progress, credits_used, result: { url, width, height, duration, fps } }` |
| Codes HTTP | 401/403 clé refusée, 402 solde insuffisant, 429/5xx indisponible |

## Garde-fous du studio

- Le double de simulation est pris **par défaut** ; le mode réel exige que l'appelant le demande (`fournisseurHiggsfield({ reel: true })`), la clé et l'adresse.
- La clé ne part **jamais** vers l'adresse présignée (PUT sans en-tête d'authentification) et n'apparaît dans aucun message.
- Toute demande est vérifiée **avant** l'appel (modèle, durée ≤ 15 s, image de référence pour Kling, consigne non vide).
- Le solde est lu **avant** de lancer la première passe d'une vidéo ; s'il ne couvre pas toute la vidéo, rien ne part.
