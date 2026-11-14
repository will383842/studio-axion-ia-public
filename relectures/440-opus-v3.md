# Relecture PR 440 (L7-06) — v3, delta 02199353 → 76cc9d7f

**Verdict : OK**

Périmètre : `git diff 02199353 origin/usine/L7-06`. Le merge de master (46f5fa17 : CAL-13b, calendrier, final-b-mobile, rc-36) est ignoré. Le seul commit propre à la PR est 76cc9d7f (5 fichiers).

## R1 — libellé « Compte Buffer »
- `src/components/publication/LignesAPublier.tsx:470` : le libellé en dur a disparu. Il affiche maintenant « Compte » suivi du nom de l'outil (`nomOutil`, tiré du catalogue). « Buffer » ne reste qu'en repli quand aucun outil n'est connu. Corrigé.
- Remarque mineure, non bloquante : le repli est un littéral `"Buffer"` et non le nom tiré du catalogue (`NOMS_OUTILS_PUBLICATION.buffer`). Autre détail : avec un `complement` sans `outil`, `nomOutil(undefined)` affiche « Zernio ». C'est cohérent avec le reste de l'écran.

## R2 — commentaires
- `src/services/a-publier.ts:94`, `src/services/a-publier-zernio.ts:126`, `src/services/zernio-cibles.ts:73-82` : les commentaires correspondent maintenant au code. Les identifiants Zernio listés, ni déconnectés ni interdits, passent tels quels. Ceux de Buffer sont traduits par le nom. Un identifiant inconnu n'est jamais deviné. Le paramètre `choisisBuffer` devient `choisis` (local, sans effet ailleurs). Corrigé.

## R3 — tests `tests/publication/a-publier-zernio-envoi-comptes.test.ts` (nouveau, 145 lignes)
- (a) l.84-109 : un identifiant Zernio est accepté tel quel, sans doublon. Un identifiant périmé seul donne `undefined`, ce qui ramène au choix habituel. Un identifiant périmé mêlé à un bon donne `SELECTION_NON_TRADUITE`. Un compte déconnecté est refusé. Un envoi avec un identifiant périmé est refusé, sans aucune création. Les tests portent sur la vraie fonction et ne sont pas tautologiques.
- (b) l.113-127 : test de bout en bout sur Facebook, sans Buffer (`BUFFER_API_KEY` supprimée). La ligne propose les deux pages Zernio. Une fois P2 cochée, il y a **une seule** `envoyer` chez le faux client, avec `cible === P2`, et une seule publication `via: zernio` en base. Sans page cochée, l'envoi est refusé et rien n'est créé.
- (c) l.131-144 : état par compte. Après une page envoyée, `comptesPris = [P1]` et `envoye = false`. Après les deux, `envoye = true`.
- L'isolation est correcte : `fetch` est interdit, la clé est fictive, le faux fournisseur est injecté par `fournisseurParId`.

## Garde-fous
- `tests/zernio/` : aucun fichier modifié dans le delta (hors master). La liste déjà acceptée reste la même.
- Aucun test retiré ni affaibli : 76cc9d7f ne fait qu'ajouter des lignes de test.
- `boucle.ts` : non touché.
- Aucun nom de personne dans le delta (données d'exemple : « Page exemple 1/2 », identifiants `exemple-…`).

## Tests relancés
`npx vitest run tests/publication` → 2 fichiers, **16/16 réussis**.
