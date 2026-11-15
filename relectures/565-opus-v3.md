# Relecture Opus v3 — PR 565 (fiche RC-15, alertes de performance)

**VERDICT : OK — FUSION POSSIBLE** sur la tête complète `c2edcc27a30cc5a22c34de60b56b938d80a376c1` (origin/usine/RC-15)

## Point unique de la 2e relecture (borne `v >= 0` de `vuesLisibles`) : corrigé

- Commit c2edcc27 (tests seulement, +9 lignes dans `tests/alertes/rc-15-performance.test.ts`) ajoute les trois cas demandés :
  - `medianeCompte([0, 0, 5])` → 0 ;
  - A17 : `evaluerDecolle(pub(0, 10), 100)` → `{ id: "A17", niveau: "ok", statut: "fiable" }` ;
  - A16 : `evaluerChute([pub(0,10) ×3], 100)` → `{ id: "A16", niveau: "alerte", statut: "fiable" }`.
- Sonde jetable (non poussée) : mutation `v >= 0` → `v > 0` à `src/domaine/alertes/performance.ts:40`
  → **3 échecs / 19** (exactement les trois nouveaux cas). Code remis : 19/19 verts.

## Autres contrôles

- `src/domaine/alertes/performance.ts` : **non modifié** depuis d5be6ad9 (diff vide).
- Périmètre (base de fusion a24e3767 → tête) : uniquement `src/domaine/alertes/performance.ts` et `tests/alertes/rc-15-performance.test.ts`.
- `scripts/echecs-connus.json` : inchangé sur la branche et après fusion à blanc.
- Fusion à blanc avec master (efba326e, 3 commits devant) : propre ; `tests/alertes` 68/68 après fusion.
- `eslint` propre sur les deux fichiers ; `tsc --noEmit` : 146 erreurs (même nombre qu'en v2 sur master), aucune dans les fichiers RC-15.
- Aucun nom de personne dans le diff ni dans les messages de commit.
- Suite vitest complète : non concluante dans cet environnement (exécution bloquée au-delà de 10 min, arrêtée) ; non exigée, comme en v2.
