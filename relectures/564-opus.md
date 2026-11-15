# Relecture PR 564 (fiche L5-26)

## VERDICT : À CORRIGER

Tête complète examinée : `5969b4832903eeb3e73ced955a90f14f1e9233e1` (`origin/usine/L5-26-v2`, = tête de la PR 564).

1. **Majeure** — `src/domaine/publications/attribution-post.ts:36` : `RE_EMAIL` ne refuse que la forme littérale `x@y.tld`. Sont ACCEPTÉS (sonde) : `nom [at] exemple.fr`, `nom(at)exemple.fr`, `nom @ exemple.fr`, `nom@ exemple.fr`, `nom@exemple .fr`, `nom＠exemple.fr` (arobase pleine chasse), `nom%40exemple.fr`. Le critère « un corps qui contient un e-mail est refusé » n'est pas tenu pour un e-mail dissimulé. Les majuscules (`X@EXEMPLE.FR`) sont bien refusées.
2. **Majeure** — `tests/attribution/jointure-mot-publication.test.ts:49-51` : le contrat `utm_campaign` de `contrats/charge-crm-v3.json` n'est PAS vérifié égal au code du lien suivi ; seul un motif de forme est testé, sans lien avec `construireLienSuivi`. Or la valeur du contrat, `guide_reseau`, est refusée par `construireLienSuivi` (« Le code ne contient que des lettres, des chiffres et des tirets ») ; et le motif `^[a-z0-9_-]{2,60}$` refuserait un vrai code de version (`0042-TB-IG`). Le test entérine donc l'écart au lieu de le détecter (la PR le signale elle-même). Critère non rempli : décision à prendre sur le contrat (figé par empreinte, hors périmètre de la fiche) avant fusion.
3. **Mineure** — `src/domaine/publications/attribution-post.ts:27` : la clé utilise `post_ref` non normalisé : `"p1"` et `" p1 "` donnent deux publications distinctes (sonde), alors que la ligne 23 traite les espaces seuls comme vides.
4. **Mineure** — `tests/attribution/jointure-mot-publication.test.ts:12,25` : aucun cas de test pour l'e-mail dissimulé, ni pour `post_ref` fait d'espaces ou `null` (le code les traite bien en « non rattaché », mais rien ne le garde).

## Vérifications passées
- Périmètre : 2 fichiers, tous deux autorisés ; rien d'autre.
- Contact sans `post_ref` (absent, `""`, `"   "`, `"\t"`, `null`) : « non rattaché » (sonde).
- Tests : rouge sans le code (import non résolu, 0 test), vert avec (8/8).
- Mutations : retrait du refus d'e-mail → 1 test rouge ; retrait du `trim` → 1 rouge ; `utm_campaign`→`utm_content` → 2 rouges.
- tsc : 146 erreurs avant et après, sorties identiques (non régressé) ; eslint propre sur les deux fichiers.
- `scripts/echecs-connus.json` inchangé.
- Aucun nom de personne (seuls « Nom.Prenom » générique et domaines `exemple.*`).
- Branche fondée sur `98af97a` (ancien master, force-poussé depuis) ; fusion dans `origin/master` `f98e77a` sans conflit.

Sondes jetables, non poussées.
