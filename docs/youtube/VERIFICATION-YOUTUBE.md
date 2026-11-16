# Vérification YouTube (fiche UO-12)

État relevé le 16/11/2026, après fusion de master. YouTube Shorts a **déjà** son interrupteur, éteint par défaut : rien n'est envoyé, aucun appel réel. Cette fiche n'en ajoute pas d'autre.

## Interrupteur (un seul)
- Réglage existant `zernio.youtube_actif` (`src/fournisseurs/publication/zernio-youtube.ts`, constante `CLE_YOUTUBE_ACTIF`), lu par `src/services/youtube-zernio.ts` ; la porte est branchée dans `src/fournisseurs/publication/zernio.ts:73`.
- Vaut faux s'il est absent, illisible (panne) ou différent de `true`. Seul le fondateur le pose à vrai.
- `verifierYoutubePret(etat, reseau)` (`src/domaine/youtube-pret.ts`, pur) rend en français ce qui manque POUR CE RÉSEAU (chaîne reliée, prise en charge par le diffuseur, limites du registre) ; « prêt » seulement si la liste est vide.
- `youtubeEnvoiPermis()` est faux tant que `zernio.youtube_actif` est faux ou que la liste n'est pas vide.
- Lecture côté serveur : `src/services/interrupteur-youtube.ts` (lecture seule, même clé, aucune écriture, aucun appel au diffuseur). Non branché dans l'envoi.

## État réel (preuves fichier:ligne)
| Constat | Preuve |
|---|---|
| `youtube-shorts` est pris en charge : la table associe `youtube-shorts` à `youtube` (lot B). Seul YouTube long est refusé (« n'est pas porté »). | `src/fournisseurs/publication/zernio-corps.ts:118` (table) et `:120-125` (`plateformeZernio`). |
| Limites YouTube présentes dans le registre (durée max 43200 s, légende 5000). | `src/reseaux/index.ts:186-203` |
| Limites YouTube Shorts présentes (durée max 180 s, légende 100). | `src/reseaux/index.ts:205-222` |
| `RESEAUX_PAR_DEFAUT` existe et n'inclut PAS `youtube-shorts` (`linkedin`, `instagram`, `tiktok`). | `src/domaine/reseaux-par-defaut.ts:8` |
| Shorts : prêt côté code dès qu'une chaîne YouTube est reliée ; YouTube long : jamais prêt (diffuseur). | `tests/interrupteur-youtube.test.ts` |

## Hors périmètre (non touché)
- Aucun fichier `zernio*` (src ni tests) n'est modifié. Le branchement de `youtubeEnvoiPermis` dans l'envoi relève de la zone Zernio : fiche à créer après accord.
- Écran Réglages (session interface) ; aucune migration.
