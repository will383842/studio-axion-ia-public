# Relecture PR 565 — RC-15 Alertes de performance

**VERDICT : À CORRIGER** — tête complète relue `59ce1f71d1985fce3c14c0353c112d9cfbaddcfe` (origin/usine/RC-15)

## Corrections demandées

1. **`src/domaine/alertes/performance.ts:38-39` et `:61`, `:75` — gravité MOYENNE.** Un nombre de vues négatif est accepté comme mesure lisible
   (`estNombre` ne teste que la finitude). Conséquences vérifiées par sonde :
   - `evaluerChute([{vues:-1,nbReleves:10} ×3], 100)` → **A16 « alerte » statut « fiable »** : une donnée corrompue déclenche une alerte de chute ;
   - `evaluerDecolle({vues:-5,nbReleves:10}, 100)` → « ok » « fiable » au lieu de « non évalué » ;
   - `medianeCompte([-4, 2, 3])` → 2 : les valeurs négatives polluent la médiane du compte (`:44`).
   Cela contredit l'en-tête du module (« une mesure illisible donne non évalué »). Correction attendue : une vue < 0 est illisible
   (→ « non-evalue » pour A16/A17, ignorée par `medianeCompte`).
2. **`tests/alertes/rc-15-performance.test.ts` — gravité MINEURE.** Ajouter les cas négatifs (vues < 0 pour A16 et A17, médiane calculée avec une valeur négative)
   pour verrouiller la correction 1.

## Ce qui est conforme

- Périmètre : uniquement `src/domaine/alertes/performance.ts` + `tests/alertes/rc-15-performance.test.ts`. Rien dans `scripts/echecs-connus.json`.
- Aucun nom de personne dans le diff ni le message de commit.
- RC-14 fusionnée sur master (#523) ; `Niveau` et `evaluerSeuil` de `seuil.ts` réutilisés (seuil.ts identique sur master), aucune comparaison de seuil dupliquée hors de `evaluerSeuil`.
- Sans IA, fonctions pures (pas d'horloge, réseau ni base ; entrées non modifiées, `filter` avant `sort`).
- Branche en retard de 4 commits sur master (f98e77a5) mais fusion à blanc propre.
- Bornes exactes (sondes jetables, non poussées) :
  - 9 relevés → « trop tôt », aucune alerte même à 10 000 vues ; 10 relevés → évalué ; relevés NaN/négatifs → « trop tôt ».
  - A17 : 200 pour médiane 100 → ok (strict) ; 200,01 → alerte ; médiane paire 2,5 : 5 → ok, 5,01 → alerte.
  - A16 : 49,99/49,99/50 → ok (50 % pile non alerté) ; 49,99 ×3 → alerte ; 0 ×3 → alerte.
  - Médiane : impaire, paire (non triée [10,1,4,3] → 3,5), un seul élément, NaN/null/Infinity ignorés, vide → null ; médiane 0 ou négative → « non évalué ».
  - Vues null/undefined/NaN/Infinity → « non évalué ».
  - Consécutivité : seules les 3 dernières comptent — [1,1,80,1] et [1,80,1,1] → ok ; [80,1,1,1] → alerte ; une ancienne publication à 9 relevés n'influe pas.
- Mutations à la main (15) : relevesMin 9/11, facteur 2,5, chute 0,6, 2 publications, `>` → `>=` (A17), `<` → `<=` (A16), `>=` → `>` sur les relevés,
  `every` → `some`, médiane 0 acceptée, médiane paire fausse, 3 premières au lieu de 3 dernières, suppression du « trop tôt » A16, tri supprimé :
  **toutes font rougir au moins un test**. Seule survivante : `=== "ok"` → `!== "alerte"`, mutation équivalente (valeur déjà garantie finie).
- Tests RC-15 : 13/13 ; dossier tests/alertes : 62/62 sur la fusion à blanc.
- `tsc --noEmit` : 146 erreurs sur master, 146 après fusion, aucune dans les fichiers RC-15 (non régressé). `eslint` propre sur les deux fichiers.
- Suite vitest complète : non concluante (arrêtée à la limite de temps de 30 min) ; seul le dossier tests/alertes a été vérifié.
