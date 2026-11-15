# Relecture PR 558 (Opus)

**VERDICT : OBSOLÈTE : fermer**

Tête complète relue : `5a097b146fcb5099caff778f6409cd0c2c2b1a12` (branche `usine/COUL-FIX`, parent `bf274049`).

1. **Nature du changement : conforme.** Un seul fichier ajouté, `pilotage/journal/COUL-FIX.md` (+20 / −0). C'est un diagnostic (document). Aucun code ni test n'est modifié.
2. **Diagnostic : exact quand il a été écrit.** Sur la base de la PR (`bf274049`), le compte des classes orange / lueur dans `src/**/*.ts(x)`, avec l'expression `CLASSE_ORANGE` du test, donne **294**. Le plafond est `ORANGE_MAX = 293`. Les deux usages en trop se trouvent bien dans `src/components/calendrier/VueAgenda.tsx`, lignes 103 (`border-orange`) et 105 (`text-orange-vif`). Le correctif proposé (`border-accent` / `text-accent`) est le bon.
3. **La cause est déjà corrigée sur master.** La PR #508 (« CAL-12c : jetons accent du jour courant (coul-01) », commit `f4f6cff7`, fusionnée le 2026-11-14 à 12:24 UTC) a appliqué **exactement** ce correctif. Elle a été fusionnée 40 minutes après le commit de la PR 558 (11:43 UTC). Sur `origin/master` (`d19d8d2c`) :
   - `VueAgenda.tsx` ne contient plus aucune classe orange ;
   - le compte est de **285**. Le plafond a ensuite été abaissé à **285** par REF-CARR-PDF (#563) : `285 ≤ 285`, la garde passe.

   Le journal décrit donc un état qui n'existe plus. En particulier, sa phrase « la correction est laissée à validation du propriétaire » est fausse aujourd'hui. Fusionner ce journal induirait le lecteur en erreur.
4. **Noms de personne : aucun.** Le texte n'emploie que des termes génériques (« le propriétaire »).
5. **Contrôles GitHub : 7 sur 7 au vert** sur la tête (zone, règles de fer, tests, eslint/tsc, next build, garde interne, build Docker). Ce point ne change rien au fait que la PR est obsolète.

**Action proposée :** fermer la PR 558 sans la fusionner, en renvoyant à #508. Si l'on veut garder une trace, il faudrait plutôt ajouter au journal la mention « corrigé par #508 », mais cela ne justifie pas de garder la PR ouverte.

Méthode : lecture du code et du test, puis comptage en Python avec l'expression régulière exacte du test (fichiers `.ts` et `.tsx` de `src/`), sur `bf274049`, `ebe57d43` (base de la PR) et `origin/master`. Rien n'a été installé.
