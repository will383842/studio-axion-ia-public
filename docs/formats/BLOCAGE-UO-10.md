# UO-10 — blocage (15/11/2026)

Fiche UO-10 (formats 4:5 et recadrage sans zoom) : lancement impossible, les critères sont introuvables.

## Constaté (dépôt privé de plans, lecture seule)
- `usine/fiches-a-lancer/` : aucune fiche UO-10 (ni UO-09). `usine/fiches/` et `fiches/UO-10.md` n'existent pas.
- Recherche de « UO-10 » sur toutes les branches distantes : seulement le registre (`usine/decisions-extrait-registre-2026-11-15.json`, statut `a_faire`, dépend de L1-01, taille S, « fichiers et critères écrits le 15/11/2026 (concepteur Opus) ; prête après accord de la coordination »), la ligne de coordination du 15/11 qui la dit lancée, et l'audit de vitesse (`AUDIT-20`).
- Aucun fichier de critères du concepteur n'est publié nulle part.
- L'audit de vitesse indique seulement : partir de l'existant (vignettes et miniatures 1:1 et 4:5 sans rognage déjà sur master, #266 #267 #268) ; reste le recadrage des rendus hors vignettes. Trop vague pour écrire un test rouge fiable sans inventer les critères.

## Décision
Aucun test ni document de l'état écrit : inventer les critères risquerait un test faux. Pas de PR.

## Pour débloquer
Le concepteur (ou le fondateur) pousse les critères de UO-10 dans le dépôt privé (`usine/fiches-a-lancer/UO-10.md`), puis relancer la routine. Fichiers prévus : `docs/formats/ETAT-4-5-ET-RECADRAGE.md` et `tests/formats/recadrage-sans-zoom-et-formats-coches.test.ts`.
