# Relecture PR 595 (L8-08), seconde passe après correction

**VERDICT FINAL : OK — FUSION POSSIBLE sur la tête complète `f2167f5853025a328de572c90ed4e9289120e046`**

Tête relue : `f2167f5853025a328de572c90ed4e9289120e046` (= `git rev-parse origin/usine/L8-08` = tête de la PR, en brouillon). Base `1d8d0afa`. Verdict précédent : `relecture/595-opus` (À CORRIGER, 2 points).

## Points précédents : résolus

1. **Date invalide** : résolu. `evaluerRepublication` vérifie `Number.isFinite` sur les deux dates et refuse avec le motif `date-invalide`. Sondes jetables : `datePublication` NaN, `maintenant` NaN, `-Infinity`, chaîne `"5"` → toutes `{autorise:false, motifs:["date-invalide"]}`. Un test a été ajouté (NaN des deux côtés et `+Infinity`).
2. **Réseau inconnu** : résolu. La garde `reseauConnu` utilise `typeof` et `hasOwnProperty` : elle n'accepte donc pas les clés héritées. Sondes : `"x"`, `"toString"` et `undefined` → `{autorise:false, motifs:["reseau-inconnu"]}`. `regleRepublication("hasOwnProperty")` lève `réseau inconnu : hasOwnProperty`. Un test a été ajouté (`x`, `constructor`, `__proto__`).

Les points mineurs ont aussi été traités : le test de `seuilPerformance` accepte maintenant `source`, et `REGLES_REPUBLICATION` est passé par `Object.freeze`.

## Non-régression (sondes jetables, non commitées)

- Exactement 30 j sur TikTok → autorisé. 30 j moins 1 ms → `delai-trop-court`. Date de publication dans le futur → refusée.
- Les 3 motifs se cumulent toujours (`contenu-identique`, `filigrane`, `delai-trop-court`). Le filigrane reste toléré sur Instagram.
- `vitest run tests/republication` : 10/10 verts.
- `tsc --noEmit` : 146 erreurs sur la base comme sur la tête. Toutes existaient déjà et aucune ne concerne `republication`.

## Contrôles de conformité

- Fichiers modifiés : seulement `src/domaine/republication/regles.ts` et `tests/republication/regles.test.ts`. `scripts/echecs-connus.json` est inchangé.
- Fonctions pures : pas de `Date.now`, pas d'aléa, pas d'E/S. L'entrée n'est pas modifiée (le test existant le vérifie).
- Aucun nom de personne. Aucune mention de Buffer, ni dans le code ni dans les messages de commit.
- Contrôles GitHub sur la tête `f2167f58` : 8/8 terminés, tous verts.

## Mineur (sans effet sur la fusion)

- `Object.freeze` est superficiel : `REGLES_REPUBLICATION.tiktok` n'est pas figé à l'exécution (`Object.isFrozen` → false). Le type `readonly` le protège à la compilation. On pourra le figer en profondeur plus tard.

## Limite

La fiche `fiches/L8-08.md` est absente de ce dépôt. Les critères ont été vérifiés d'après la consigne et le verdict précédent.
