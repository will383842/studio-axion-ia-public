# ST-05 : blocage

Le mot « Buffer » ne peut pas disparaître de `src/domaine/corbeille.ts` et `src/services/corbeille.ts` sans toucher des fichiers fermés.

- `src/domaine/corbeille.ts:19` : le texte affiché « dans Buffer ou Zernio » est exigé mot pour mot par `tests/corbeille-ui.test.ts:25` (fichier fermé). Le changer casse ce test.
- `src/services/corbeille.ts:32,86` : la clé de retour `brouillonsBuffer` est lue par `GalerieVideos.tsx`, `EnTeteVideo.tsx`, `NettoyerNonTerminees.tsx`, `BoutonAnnuler.tsx`, `annulation-video.ts`, `videos/actions.ts`, `tests/corbeille.test.ts` et `tests/zernio/z2s-corbeille.test.ts` (tous fermés). La renommer casse la compilation et ces tests.
- `tests/st-05-corbeille-sans-buffer.test.ts` existe déjà sur master (#511) et tolère ces deux restes, justement pour cette raison.

Pour débloquer : autoriser le renommage `brouillonsBuffer` → `brouillonsExternes` (consommateurs + tests listés) et la mise à jour du texte attendu dans `tests/corbeille-ui.test.ts`. Aucune logique de corbeille à changer.

La branche `usine/ST-05-v2` ne contient que le commit de démarrage ; pas de PR ouverte.
