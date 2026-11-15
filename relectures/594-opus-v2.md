# Relecture PR 594 (HSH-01c) — seconde relecture Opus, après correction

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `587ee1a10fee09d4e24f4f05f1b4bf2c0cb80177`** (= `origin/usine/HSH-01c` = tête de la PR).

## Constat 1 du premier verdict (MAJEUR : l'aperçu annonçait un commentaire qui ne part pas) — RÉSOLU

- `src/services/publications.ts:481` : l'aperçu passe désormais par `preparerEnvoi(…, surcharge = undefined, avecVideo = false, outil, placements)`,
  exactement les entrées de l'envoi de la feuille du kit (`envoyerVersBufferAction` → `envoyerVersBuffer` sans `premiersCommentaires`
  ni `avecPremierCommentaire` → `envoyerReel` → `preparerEnvoi(kitVue, r, undefined, false, outil, placements)`, `publications.ts:1047`).
- Le commentaire de la vidéo n'est plus présenté comme « final » : il est rendu à part (`aPoserALaMain`, `publications.ts:482-484`),
  affiché « Premier commentaire : à poser à la main » (`KitPublication.tsx:494-502`).
- Test sans options ajouté (`tests/reseaux/hsh-01c-placement-envoi.test.ts`, « envoi SANS options (comme la feuille du kit) »),
  deux réglages ; l'ancien test n'utilise plus `avecPremierCommentaire: true`. 8/8 verts.
- Sonde jetable (faux client Zernio, non poussée, supprimée) : Instagram et LinkedIn × réglage « texte » / « premier commentaire »
  × avec / sans commentaire de la vidéo, envoi **sans options** : dans les 8 cas, texte envoyé = texte de l'aperçu, premier commentaire
  envoyé = premier commentaire de l'aperçu (LinkedIn « premier commentaire » : `#Entrepreneur #PME #IA` des deux côtés ; sinon aucun) ;
  commentaire de la vidéo uniquement dans `aPoserALaMain` ; Instagram « premier commentaire » : hashtags restés dans le texte, phrase de
  repli présente. `fetch` espionné pendant `obtenirKit` : 0 appel.

## Constats 2 et 3 du premier verdict (mineurs, non bloquants)

Inchangés, hors fiche comme prévu : aperçu de la page « À publier » (`src/services/a-publier.ts`) qui ignore le réglage ; hashtags passés
en commentaire hors `verifierTextesAEnvoyer`. À reprendre dans une fiche suivante.

## Remarques non bloquantes

- `publications.ts:481` : `{ videoId, variante, serie } as unknown as VueKit` — correct aujourd'hui (`preparerEnvoi` et `commentairePour`
  ne lisent que ces champs), mais fragile si ces fonctions lisent un jour un autre champ du kit.
- L'aperçu prend l'outil par `outilDeEnvoi(r.reseau)` sans compte ; un routage par compte pourrait différer (cas marginal, déjà présent
  dans la première version). La branche de simulation (`publications.ts:809`) fixe l'outil à « buffer » : rien n'y part réellement.

## Non-régression et périmètre

- `tests/zernio`, `tests/youtube-zernio`, `tests/a-publier*`, `tests/reseaux/hsh-01*` : 221/222 fichiers, 3485 tests verts. Seul échec :
  `a-publier-premier-commentaire-zernio.test.ts` « cohérence … » — **échoue à l'identique sur origin/master** (préexistant, non causé
  par la PR, absent de `scripts/echecs-connus.json`, à traiter à part).
- Diff limité aux 3 fichiers autorisés ; `scripts/echecs-connus.json` inchangé ; aucune suppression ; aucun nom de personne ; aucune
  mention de Buffer ajoutée dans un texte visible (seuls l'identifiant d'outil `"buffer"` et des noms de fonctions existants).
- Aucun appel réel (faux client, 0 `fetch`).
- Contrôles GitHub sur `587ee1a1` : 9/9 terminés, tous verts.

Sondes jetables : non poussées et supprimées.
