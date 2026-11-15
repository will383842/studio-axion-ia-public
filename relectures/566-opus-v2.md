# Relecture PR 566 (fiche RC-34) — seconde relecture

VERDICT PROVISOIRE : en cours

Tête relue : 294d53a069c646a48827f435106ef28aeebd8a97

## Vérifications (au fil de l'eau)
- Tête complète : `git rev-parse origin/usine/RC-34-v2` = 294d53a069c646a48827f435106ef28aeebd8a97 (conforme).
- Fusion avec master a24e3767 : sans conflit ; tests RC-34 : 9/9 verts.
- Mutations (sondes jetables, non poussées), chacune fait rougir un test :
  - purge `brut.filter(estSignature)` remise → rouge (test « lignes non conformes conservées ») ✔ point 2 ;
  - garde « non liste » retirée (écrasement) → rouge (test « valeur non liste jamais écrasée ») ✔ point 1 ;
  - rétrogradation de l'état remise → rouge (test « rejeu planifie après publie ») ✔ point 3 ;
  - texte en clair rangé → rouge ✔ ; axes non hachés → rouge ✔.
