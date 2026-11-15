# Relecture Opus v2 — PR 565 (fiche RC-15, alertes de performance)

**VERDICT : À CORRIGER** — tête complète relue `d5be6ad936de82a8ed2ac115a9d94b5b14b3ec97` (origin/usine/RC-15)

## Correction demandée

1. **`tests/alertes/rc-15-performance.test.ts` (borne de `src/domaine/alertes/performance.ts:40`) — gravité MINEURE.**
   La borne `v >= 0` de `vuesLisibles` n'est gardée par aucun test : la mutation `v >= 0` → `v > 0` **survit** (16/16 verts).
   Effet vérifié par sonde jetable sous cette mutation :
   - `evaluerChute([0, 0, 0] (10 relevés), 100)` → « non-evalue » au lieu de « alerte » : une vraie chute à zéro vue serait réduite au silence ;
   - `evaluerDecolle({vues: 0, nbReleves: 10}, 100)` → « non-evalue » au lieu de « ok » ;
   - `medianeCompte([0, 0, 5])` → 5 au lieu de 0.
   Correction attendue (tests seulement, le code est juste) : ajouter des cas à 0 vue — A16 `[0,0,0]` médiane 100 → alerte fiable,
   A17 0 vue → ok fiable, `medianeCompte([0, 0, 5])` → 0 — pour qu'une vue nulle reste lisible.

## Ce qui est corrigé et conforme (points de la 1re relecture sur 59ce1f71)

- Point 1 (vue négative) : **corrigé**. `vuesLisibles` (fini et ≥ 0) remplace `estNombre` dans `medianeCompte` (:46), A17 (:63) et A16 (:77) ;
  en-tête du module mis à jour (:8). Sondes : vues −1/−5 → « non-evalue »/« non-evalue » pour A17 et A16 (y compris une seule sur trois) ;
  `medianeCompte([-4, 2, 3])` → 2,5 ; `[-1, -2]` → null ; `-0` traité comme 0 (`[-0, 3]` → 1,5) ; vue 0 toujours lisible sur la tête.
- Point 2 (tests des négatifs) : **ajoutés** (commit 79fb439d) et **rouges avant le correctif** (3 échecs sur 79fb439d, 16/16 sur d5be6ad9).
- Mutations à la main sur le correctif : borne supprimée, `>= -1`, filtre de la médiane revenu à `estNombre`, A17 revenu à `estNombre`,
  A16 revenu à `estNombre`, `every` → `some` sur la lisibilité A16 : **toutes tuées**. Survivantes : `>= 0` → `> 0` (point 1 ci-dessus) ;
  inversion de l'ordre « médiane / vues » dans A16 (mutation équivalente : même « non-evalue »).
- Périmètre : diff (base de fusion → tête) limité à `src/domaine/alertes/performance.ts` et `tests/alertes/rc-15-performance.test.ts`.
  `scripts/echecs-connus.json` inchangé (sur la branche et après fusion à blanc).
- Master a avancé (efba326e, 3 commits devant la branche) : fusion à blanc propre ; dossier tests/alertes 65/65 après fusion.
- `tsc --noEmit` : 146 erreurs sur master, 146 sur la tête et après fusion, aucune dans les fichiers RC-15 (non régressé).
  `eslint` propre sur les deux fichiers.
- Aucun nom de personne dans le diff ni dans les messages de commit.
- Suite vitest complète non lancée (seuls tests/alertes et le fichier RC-15 vérifiés).
