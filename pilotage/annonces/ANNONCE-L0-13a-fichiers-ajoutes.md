# ANNONCE · L0-13a : fichiers de tests à ajouter

L0-13a (plus aucun envoi par Buffer) fait rougir 5 tests hors des listes de L0-13a, L0-13f et L0-13g, verts sur master.
Ils posent `FOURNISSEUR_PUBLICATION=buffer` ou la clé Buffer et attendent le fournisseur Buffer inscrit :

- `tests/buffer-gel/a1-comptes-et-tester.test.ts`
- `tests/buffer-gel/a1-synchro-sans-buffer.test.ts`
- `tests/r1-buffer-client.test.ts`
- `tests/e2e-verif1-a2-publication.test.ts`
- `tests/e2e-verif1-d-interrupteurs.test.ts`

Décision « accord L0-13 » du fondateur : ces 5 tests SONT modifiés (commit c77631af), dans le sens « Buffer ne peut plus envoyer ». Reste à les inscrire dans `fichiers_autorises` de la fiche. Détail : `pilotage/journal/L0-13a.md`.
