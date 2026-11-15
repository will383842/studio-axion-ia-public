# Relecture PR 568 (v2) — fiche MAQ-01

VERDICT PROVISOIRE : en cours

Tête relue : ca497989f0e7615be72ce5037fc6225ec30a4838 (usine/MAQ-01-v2)

## Vérifications (au fil de l'eau)
- Tête complète confirmée : `git rev-parse origin/usine/MAQ-01-v2` = ca497989f0e7615be72ce5037fc6225ec30a4838.
- (1) Maquettes contre `bc821af3` : les 4 pages ne diffèrent que d'une ligne chacune, le lien Google Fonts retiré (demandé par la 1re relecture). Tout le reste est identique à l'octet. Le test est identique à l'octet à celui de `bc821af3`.
- (2) Diff (base commune) : 5 fichiers, 4 pages `docs/maquettes/*/index.html` + `tests/maquettes/maq-01-maquettes.test.ts`. Aucun code applicatif. `scripts/echecs-connus.json` non touché.
