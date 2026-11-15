# Relecture PR 599 (L8-10 : contrôle de non-copie pour la republication)

**VERDICT : À CORRIGER** sur la tête complète ca9fdf48ace5f5eeab87ad702d9c143c3e8d65c9 (code correct, un trou de test sur le critère de proximité)

## À corriger

1. `tests/republication/non-copie.test.ts:32-37` : le test « refuse une proximité de 0,6 ou plus » ne teste pas la proximité. Son texte contient « Vos relances clients chaque lundi matin », soit 6 mots repris d'affilée : la sonde donne `motif: "reprise"` (proximité 0,889). La branche `motif: "proximite"` (`src/domaine/republication/non-copie.ts:58`) n'est couverte par **aucun** test : si on la retire, la suite reste verte. Correctif : un texte sans 6 mots d'affilée, avec `expect(r.motif).toBe("proximite")`.
2. `tests/republication/non-copie.test.ts` (à ajouter) : il manque un test sur la borne, avec une proximité d'environ 0,59 acceptée et de 0,6 exactement refusée. Les sondes montrent que le code est juste (23/39 = 0,5897 → ok ; 12/20 = 0,6 → refus `proximite`), mais rien ne le garantit dans la suite.

## Vérifié, conforme

- Fichiers modifiés : uniquement `src/domaine/republication/non-copie.ts` et `tests/republication/non-copie.test.ts`.
- La constante 6 est importée de L3-13 (`TAILLE_ALERTE_POST`, `memoire-posts.ts:12`) et n'est jamais recopiée. Le seuil 0,6 est marqué `hypothese`.
- Fonctions pures : aucun réseau, aucune variable d'environnement, entrées non modifiées. Aucune mention de Buffer, aucun nom de personne (seul « le fondateur » apparaît).
- `scripts/echecs-connus.json` est inchangé. Les tests ciblés passent en local (9/9). Les contrôles GitHub de la PR sont verts (8/8).
- Sondes jetables (supprimées après usage) :
  - texte vide ou ponctuation seule → accepté, proximité 0 ;
  - majuscules et accents retirés → reprise détectée ;
  - exactement 5 mots → accepté, 6 mots → refus `reprise` ;
  - citation entre « » ou "" → tolérée ;
  - citation avec la même copie hors guillemets → refusée ;
  - guillemet non fermé → refusé ;
  - texte entièrement cité → refus `identique` (cela se défend).

## Observations (non bloquantes, comportement hérité de L3-13)

- `reprisesDAffilee` exige au moins `PLEINS_MIN` = 2 mots pleins dans la fenêtre : 6 mots-outils d'affilée ne sont pas refusés.
- Une élision collée change le mot : « l'automatise » est différent de « automatise ».
