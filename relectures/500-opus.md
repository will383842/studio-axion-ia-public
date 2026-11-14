# Relecture PR 500 — L2-04 : rendu des carrousels repris par la boucle

**Verdict : OK — fusion possible.** Tête relue : `62586487` (branche `usine/L2-04`). Aucun point bloquant ; remarques ci-dessous à traiter dans une fiche suivante.

## Critères de la fiche
1. **Périmé repris sans clic, récent non relancé** : OK. Filtre `src/visuels/services/boucle-rendu.ts:16-18` (`rendu_en_cours`, hors corbeille, ancienneté ≥ `RENDU_PERIME_MS` = 10 min) ; `lancerRendu` revérifie sous verrou (`src/visuels/services/carrousels.ts:312-314`) : double garde.
2. **boucle.ts = une ligne** : OK. Diff = +1 ligne (`src/services/boucle.ts:315`, annexe « rendus de carrousels », attente 0). Aucune ligne zernio, parcours-mot ni branchements-zernio touchée.
3. **lancerRendu injecté, aucun appel réel** : OK. Paramètre `lancer` (`boucle-rendu.ts:13`), `vi.fn` dans les quatre tests ; le point d'entrée réel `reprendreRendusDeLaBoucle` n'est pas exécuté par les tests.
4. **LinkedIn = un seul document PDF avec titre, autres réseaux en images** : respecté, non modifié par la PR (`src/visuels/services/rendu-reseaux.ts:11`, `:74-77` titre ≤ 40 signes ; contrôle de format `carrousels.ts:254`). La boucle ne reprend que le rendu de base, pas la préparation réseaux.

## Périmètre et gardes
- Fichiers : exactement les quatre attendus (boucle-rendu.ts, boucle.ts +1, tests/visuels/boucle-rendu.test.ts, pilotage/journal/L2-04.md). Aucun test existant modifié ni affaibli.
- `node outils/gardes/zone-interdite.mjs --fichiers …` : **vert**.
- Aucun nom de personne dans le diff.

## Tests relancés
- `tests/visuels` : 1808 passés, **1 échec** `coul-01-jetons` (compte d'orange) — **déjà en échec sur master** (vérifié), sans lien avec la PR.
- Tests de la boucle (13 fichiers `*boucle*.test.ts`, dont le nouveau) : 102/102 passés.
- Mutations rejouées (deux) : retrait de la condition d'ancienneté → « un visuel récent n'est pas relancé » échoue ; retrait de `!v.corbeilleLe` → « ignore les autres statuts et la corbeille » échoue. Tests non tautologiques.

## Rafale, boucle infinie, coût
- **Pas de rafale** : l'annexe ne se superpose pas à elle-même (`boucle.ts:128-129`, carte « en vol ») ; reprises séquentielles ; `lancerRendu` réécrit `renduDemandeLe` sous verrou, donc un visuel repris n'est plus éligible avant 10 min ; seul le dernier lancement conclut (jeton, `carrousels.ts:327`).
- **Coût** : le rendu passe par le service de rendu du studio (`src/fournisseurs/rendu/client.ts:78`, simulé sans URL), pas par une API payante à l'appel ; générateur éteint ⇒ `lancerRendu` refuse avant tout rendu (`carrousels.ts:74`).

## Remarques (non bloquantes)
1. `boucle-rendu.ts:16-18` — **aucun plafond de reprises** : un rendu qui ne conclut jamais (processus tué, plantage mémoire répété) est relancé toutes les 10 minutes sans fin. Suggestion : âge maximal ou compteur de reprises, puis bascule en `echec_rendu`.
2. `boucle-rendu.ts:35` — le résultat (`repris`, `echecs`) est jeté : les échecs de reprise sont silencieux (ex. générateur éteint ⇒ un refus par visuel bloqué à chaque tour, sans trace). Suggestion : journaliser les comptes, ou vérifier `allume()` une fois avant la liste.
3. `boucle-rendu.ts:18` — un `rendu_en_cours` **sans** `renduDemandeLe` est ignoré, alors que `lancerRendu` le relancerait (`carrousels.ts:313`) : un tel visuel resterait bloqué. Cas marginal.
4. `tests/visuels/boucle-rendu.test.ts:89` — frontière exacte à 10 min non testée (`>=` → `>` survivrait). Cohérent avec `lancerRendu` ; mineur.
5. Un rendu réellement encore en cours après 10 min est relancé en parallèle (coût de calcul doublé) — même comportement que la relance manuelle existante ; acceptable.
