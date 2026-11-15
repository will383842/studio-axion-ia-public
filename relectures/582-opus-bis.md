# Relecture PR 582 (FB-REEL-b), bis

**VERDICT : À CORRIGER** sur la tête complète 058730330ff98c2b9d2463e5667410d595af8271 (= `origin/usine/FB-REEL-b`, base be7d73c = master avec #572 et #581).

Reste à vérifier : le lancement local de `tests/publication/ tests/zernio/ tests/youtube-zernio/` était encore en cours quand ce verdict a été écrit (voir le complément plus bas).

## À corriger
1. `tests/publication/fb-reel-envoi.test.ts:13` : `process.env.FOURNISSEUR_PUBLICATION = "buffer";` mentionne Buffer, ce que la consigne interdit. La ligne vient du banc existant (`tests/youtube-zernio/b4-envoi-service.test.ts`). Gravité : **bloquante au regard de la règle** (le correctif est trivial). Il faut retirer la ligne ou la remplacer par une valeur neutre, puis vérifier que le test reste vert.
2. `src/services/publications.ts:444` : l'avertissement Reel est rangé sous le code `"legende-trop-longue"`, alors qu'il ne concerne pas la légende. L'avertissement ne bloque rien aujourd'hui (seuls `trop-longue` et `ratio-absent` bloquent, dans `FeuilleEnvoyerBuffer.tsx:77`), mais ce code est trompeur pour tout futur lecteur des codes, HSH-01c compris. Gravité : **mineure**. Le commentaire l'assume, car un code propre au Reel demande le registre des réseaux, hors fiche. C'est acceptable si c'est noté comme dette.

## Observation (hors fiche, non bloquante)
- Dans l'interface, la carte du réseau recalcule ses avertissements côté navigateur (`KitPublication.tsx:267`, `verifierPourReseau`). Le texte de l'avertissement Reel n'y est donc **pas affiché** : seul le point d'alerte de l'onglet Facebook (`KitPublication.tsx:137`) le reflète. Le critère « figure dans `avertissements` du réseau Facebook du kit » est rempli côté données, mais l'utilisateur ne lit pas le message. C'est à reprendre dans une fiche qui autorise `KitPublication.tsx`.

## Vérifié, conforme
- Diff limité à `src/services/publications.ts` et `tests/publication/fb-reel-envoi.test.ts` (nouveau) : ce sont exactement les fichiers autorisés de la section `### FB-REEL-b`.
- Branchement à l'envoi : `format` = `sortieConseillee.ratio` et `dureeSec` = `sortieConseillee.dureeSec`, ajoutés pour `facebook` seulement. La condition YouTube Shorts (#572) est intacte (`reseau === "youtube-shorts" || reseau === "facebook"`), et les autres réseaux ne reçoivent toujours rien.
- `zernio-corps.ts:219` met `contentType: "reel"` seulement pour une vidéo 9:16 dans `REEL_FACEBOOK_DUREE_SEC`. Ce sont les mêmes bornes que `avertissementReelFacebook` (importées, pas recopiées) : l'avertissement et le corps envoyé sont cohérents.
- Un Reel hors règles (4:5, 2,9 s, 60,1 s) est averti dans le kit Facebook seulement. L'envoi n'est pas bloqué et part sans `contentType`, donc pas en Reel. C'est la conduite attendue par la fiche (« sans bloquer »).
- Aucun appel réel : `fetch` est simulé, la clé est fictive et les comptes s'appellent « exemple ». Aucune suppression de fichier.
- HSH-01c : rien n'est touché dans `texteAEnvoyer`, `commentairePour` ni les types exportés. Les seuls ajouts sont une entrée dans le tableau `avertissements` et une condition sur `prets`, donc aucun contrat n'est glissé.
- `scripts/echecs-connus.json` inchangé. Aucun nom de personne.
- Contrôles GitHub : 9 sur 9 verts sur 0587303 (règles de fer, garde des fichiers autorisés, eslint et tsc, next build, tests touchés et nouveaux, etc.).
