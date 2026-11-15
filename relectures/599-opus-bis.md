# Relecture PR 599 — fiche L8-10 (contrôle de non-copie) — relecteur opus-bis

## VERDICT FINAL : OK — FUSION POSSIBLE sur la tête complète ca9fdf48ace5f5eeab87ad702d9c143c3e8d65c9

(La PR est encore en brouillon : la sortir du brouillon avant la fusion.)

## Vérifié
- Tête de la PR = `ca9fdf48ace5f5eeab87ad702d9c143c3e8d65c9`, base `master` à jour (f7161171 ancêtre), état « clean ».
- Fichiers modifiés : seulement `src/domaine/republication/non-copie.ts` et `tests/republication/non-copie.test.ts`.
- `scripts/echecs-connus.json` : inchangé.
- Constante unique : `TAILLE_COPIE_REPUBLICATION = TAILLE_ALERTE_POST` (importée de `ecriture-commune/memoire-posts`, valeur 6), jamais recopiée.
- Seuil 0,6 défini en un seul endroit, marqué `hypothese` (`non-copie.ts:15`), comparaison `>=` (`non-copie.ts:58`).
- Fonctions pures : aucun réseau, aucune base, entrées non modifiées (test dédié).
- Aucun nom de personne dans le diff, aucune mention de Buffer.
- Contrôles CI sur la tête : 8/8 verts (eslint/tsc différentiels, next build, garde de fichiers, tests touchés, règles de fer, build Docker, nouveaux tests, garde interne).
- Local : tests `tests/republication/` verts ; eslint sur les deux fichiers : 0 erreur ; erreurs `tsc` locales uniquement dans `docs/…/prototypes` (module `remotion` absent du poste), sans lien avec la PR.

## Sondes jetables (supprimées, non poussées)
| Cas | Résultat |
|---|---|
| texte vide / blanc / origine vide | accepté, proximité 0 |
| identique sans accents / casse / ponctuation | refusé « identique » |
| 5 mots copiés d'affilée | accepté |
| 6 mots copiés d'affilée (y compris casse et accents changés) | refusé « reprise » (6) |
| 6 mots entre « », "", “” | tolérés (accepté) |
| guillemet ouvrant non fermé | refusé « reprise » (pas une citation) |
| proximité 0,59 | accepté |
| proximité 0,60 exacte | refusé « proximité » |

## Remarques non bloquantes
1. `non-copie.ts:50` — un texte composé uniquement d'une citation intégrale de l'origine est refusé « identique » (l'empreinte ignore les guillemets). Comportement défendable (republication sans contenu neuf) ; à confirmer si voulu.
2. `non-copie.ts:53` — 6 mots d'affilée composés presque uniquement de mots outils ne comptent pas (règle `PLEINS_MIN = 2` héritée de `proximite-textes.ts`), cohérent avec L3-13.
3. Texte vide accepté (aucune copie possible) ; si un texte vide doit être bloqué, c'est à un autre contrôle de le faire.
