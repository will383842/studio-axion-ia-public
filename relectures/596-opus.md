# Relecture PR 596 (L0-13c) — Opus

**OK — FUSION POSSIBLE sur la tête complète 86551a569019c8c59c8ece8ea9d3c3917b8ff1a7**

## Vérifié
- Périmètre : 13 fichiers de la liste de la fiche + `pilotage/journal/L0-13c.md` (journal habituel) + `tests/a-publier-carte-par-video.test.ts` (seul hors liste autorisé, « Compte Buffer » → « Compte Zernio », une ligne).
- Fusion avec master actuel (a95161d9, 597 et 598 incluses) : `git merge-tree` sans conflit ; fusion simulée testée.
- Fiche vidéo : `vueEnvoiZernio()` lit `zernio.canaux` en base, jamais `buffer.canaux` ; `null` en simulation ; aucun appel réseau (test avec `fetch` piégé) ; réseau sans compte : « Reliez ce compte dans Zernio ».
- Réglages : `BlocBuffer.tsx` et `actions-buffer.ts` retirés (code seul), plus de `vueBuffer` ; `OUTILS_PLACEMENT` et « L'Usine en automatique » intacts.
- Aucune donnée supprimée ni réécrite : `services/buffer.ts` inchangé (réglages `buffer.*` toujours lus), aucune écriture nouvelle.
- Inchangés : `tests/zernio/*`, `src/**/import-buffer/*`, `scripts/echecs-connus.json`, `services/buffer.ts`, `finitions-envoi.ts`, `BlocZernio.tsx`.
- Aucun nom de personne ajouté (les lignes ajoutées disent « le fondateur »).
- Le nouveau test lit les cinq composants et échoue si « Buffer » revient hors libellé historique ; noms de fichiers et de fonctions conservés.
- Tests locaux (tête et fusion) : l0-13c, r1-ecrans-buffer, buffer-gel, a-publier-carte-par-video, tests/zernio, tests/reglages, e2e1-console-ecrans : verts.
- Contrôles GitHub : 13/13 verts.

## Constats sans lien (rouges aussi sur master, non touchés par la PR)
- `tests/r1b-comptes.test.ts` (9 rouges, « Zernio n'est pas relié (clé absente) ») : rouge sur la base a388d852 et sur master.
- `tests/site-videos/s1-reglages-ui.test.ts` (1 rouge, signalé dans le journal) et `tests/reglages-plafond-sujet.test.ts` (3 rouges) : rouges sur master aussi.
- Remarque : les commentaires préexistants (non modifiés) de `FeuilleEnvoyerBuffer.tsx` contiennent encore un prénom ; hors de cette PR, à traiter par une fiche de nettoyage.
