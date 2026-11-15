# L0-13 — blocage (15/11/2026)

Fiche : retrait du chemin d'envoi Buffer (compte Buffer fermé, décision du fondateur du 15/11). Aucun code modifié.

## Pourquoi je m'arrête
- Aucun fichier `L0-13.md` n'existe dans `usine/fiches-a-lancer` (ni `usine/fiches`) ni dans `fiches/` du Studio. Seule existe la ligne du registre (taille L, statut « a_faire ») : pas de liste `fichiers_autorises`, donc pas de périmètre sûr. Impossible de respecter « fichiers de la fiche seulement ».
- La ligne du registre dit encore « attend » : essai réel RC-08a (geste du fondateur) et accord du parcours viral, car le retrait casse environ 20 fichiers de `tests/zernio` (zone interdite sans accord écrit). La décision du 15/11 (compte fermé) lève peut-être le premier point ; le second n'est pas documenté.
- Dépendances listées : L0-06, L0-12, L3-10, RC-40, L7-06 — état non vérifié ici.

## Périmètre réel constaté sur master (e176eb0, PR 594 fusionnée)
- Chemin d'envoi : `src/components/publication/FeuilleEnvoyerBuffer.tsx`, `src/services/relais-buffer.ts`, `routage-publication.ts`, `boucle.ts`, `publications.ts`, `journal-envoi*.ts`, `src/components/reglages/BlocBuffer.tsx`, `src/components/migration/*`, et ~30 fichiers de `src/services/import-buffer/*` (lecture historique : à garder, données de personnes).
- Résidus ST-05 : clé `brouillonsBuffer` dans `services/corbeille.ts`, `services/annulation-video.ts`, `app/(studio)/videos/actions.ts`, 4 composants `components/videos`, `tests/corbeille.test.ts`, `tests/zernio/z2s-corbeille.test.ts` ; texte « dans Buffer ou Zernio » dans `domaine/corbeille.ts`, `tests/corbeille-ui.test.ts`, `tests/st-05-corbeille-sans-buffer.test.ts`. Proposition de ST-05 : clé `brouillonsExternes`, message « restent chez l'outil d'envoi ».

## Pour débloquer
1. Écrire la fiche L0-13 avec la liste exacte des fichiers (envoi retiré ; `import-buffer/*` en lecture conservé ; alias de lecture des anciennes clés stockées).
2. Accord écrit du parcours viral pour les tests `tests/zernio`.
3. Confirmer que RC-08a n'est plus requis depuis la décision du 15/11.
