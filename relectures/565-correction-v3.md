# Correction v3 — PR 565 (RC-15, alertes de performance)

Tête de usine/RC-15 après correction : `c2edcc27a30cc5a22c34de60b56b938d80a376c1` (parent d5be6ad936de82a8ed2ac115a9d94b5b14b3ec97, sans force ni rebase).

- Tests seulement : `tests/alertes/rc-15-performance.test.ts` (+9 lignes), code `src/domaine/alertes/performance.ts` inchangé.
- Cas ajoutés : A16 `[0,0,0]` (10 relevés, médiane 100) → alerte fiable ; A17 `{vues: 0, nbReleves: 10}` → ok fiable ; `medianeCompte([0, 0, 5])` → 0.
- Mutation à la main `v >= 0` → `v > 0` : 3 échecs (les 3 nouveaux cas), 16 verts ; code remis. Sans mutation : 19/19.
- Seul `npx vitest run tests/alertes/rc-15-performance.test.ts` lancé.
