# Vérification YouTube (fiche UO-12)

État relevé le 16/11/2026. YouTube est **prêt côté code mais éteint** : rien n'est envoyé, aucun appel réel.

## Interrupteur
- Réglage `publication.youtube_actif` (`src/domaine/youtube-pret.ts`, constante `CLE_YOUTUBE_ACTIF`).
- Vaut faux s'il est absent, illisible (panne) ou différent de `true`. Seul le fondateur le pose à vrai.
- `verifierYoutubePret()` rend en français ce qui manque (chaîne reliée chez le diffuseur, prise en charge par le diffuseur, limites du réseau), sans appel réseau ; « prêt » seulement si la liste est vide.
- `youtubeEnvoiPermis()` est faux tant que le réglage est faux ou que la liste n'est pas vide (testé pour `youtube` et `youtube-shorts`, `tests/interrupteur-youtube.test.ts`).
- Lecture côté serveur : `src/services/interrupteur-youtube.ts` (lecture seule, aucune écriture, aucun appel au diffuseur).

## État réel (preuves fichier:ligne)
| Constat | Preuve |
|---|---|
| Le diffuseur ne prend pas YouTube en charge : `plateformeZernio` refuse tout réseau hors Instagram, Facebook, LinkedIn, TikTok. | `src/fournisseurs/publication/zernio-corps.ts:117` (table) et `:119-124` (fonction ; commentaire « YouTube n'est pas porté par Zernio »). |
| Limites YouTube présentes dans le registre (durée max 43200 s, légende 5000). | `src/reseaux/index.ts:186-203` |
| Limites YouTube Shorts présentes (durée max 180 s, légende 100). | `src/reseaux/index.ts:205-222` |
| Aujourd'hui la liste « ce qui manque » n'est donc jamais vide : « prise en charge par le diffuseur » manque. | `verifierYoutubePretDepuisBase()` (test « même réglé à vrai, YouTube n'est pas prêt »). |

### Point non confirmé
La fiche cite « RESEAUX_PAR_DEFAUT de l'usine sans youtube-shorts ». Cette constante n'existe pas sous ce nom dans le dépôt. Constats voisins : `src/briques/sous-titres/largeur.ts:10` (verticaux par défaut) et `src/services/plan-editorial.ts:34` (réseaux d'envoi) **incluent** `youtube-shorts`. À trancher avec la session usine ; rien n'est modifié ici.

## Hors périmètre (non touché)
- `zernio-corps.ts` n'est pas modifié. Le branchement de `youtubeEnvoiPermis` dans l'envoi (`zernio-corps.ts`, `a-publier-zernio.ts`, `zernio-cibles.ts`) relève de la zone Zernio : fiche à créer après accord.
- Écran Réglages (session interface) ; aucune migration.
