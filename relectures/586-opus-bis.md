# Relecture PR 586 — HSH-01a (seconde relecture après correction)

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `2e4ad78e4208f580e794c29289cf13b558406894`**
(`origin/usine/HSH-01a`, vérifiée par `git rev-parse` et par l'API de la PR).

Note : la PR est encore en **brouillon** (draft) ; il faut la passer « prête » avant la fusion.

## Points du premier verdict (`relecture/586-opus`) : tous résolus

1. **Aucun mot-dièse supprimé au-delà du maximum** : la coupe `slice(0, max)` a disparu (`src/reseaux/placement-hashtags.ts:107-109`). Seul un message avertit (« … au plus pour ce réseau, tous sont gardés… »).
   Sonde jetable (non poussée) : `placerHashtags(placement "texte")` comparé à une copie de `texteAEnvoyer` (`publications.ts`) sur 2 952 combinaisons (6 `IdReseau` × 2 outils × 3 textes, dont un texte vide × 0 à 40 mots-dièse × avec ou sans interdits). Résultat : **0 différence octet pour octet**, et aucun premier commentaire produit. Avec « premier-commentaire », tous les mots-dièse non interdits se retrouvent dans le texte ou dans le commentaire.
2. **Source neutre** : `SOURCE_SCHEMA` (`placement-hashtags.ts:37`) devient « Schéma de l'outil de publication, relevé du 03/10/2026 (hors relevé L8-01) … ». Aucune source affichée ne contient « Buffer ». Ce nom ne reste que dans les identifiants internes (clé `buffer`, type `OutilPlacement`, import), qui ne s'affichent pas. L'écart avec le relevé L8-01 est désormais signalé dans le texte de la source.
3. **Accord des interdits** (`placement-hashtags.ts:100-104`) : la sonde donne « #fyp, #viral écartés : ces mots-dièse n'aident pas… » et « #fyp écarté : ce mot-dièse n'aide pas… ». Un test couvre les deux cas.

## Vérifié, conforme

- Diff (base → tête) : exactement les 3 fichiers autorisés (`src/reseaux/placement-hashtags.ts`, `src/services/placement-hashtags.ts`, `tests/reseaux/hsh-01-placement-hashtags.test.ts`). Aucune suppression. `scripts/echecs-connus.json` inchangé.
- Règle pure : `fetch` piégé, 0 appel sur toute la sonde. Entrée gelée sans exception ni mutation. Aucun appel réel, aucune publication. Le service garde `server-only`, `exigerSession()` et le journal.
- Contrat HSH-01b / HSH-01c : `lirePlacements`, `definirPlacement`, `REGLES_PLACEMENT` (source/date ou « hypothèse »), `premierCommentairePossible`, `PLACEMENT_PAR_DEFAUT` (« texte » partout) et la signature `placerHashtags({ reseau, outil, placement, texte, motsDiese, commentaire? })` sont inchangés depuis la première relecture. L'exigence « octet pour octet » de HSH-01c est désormais tenue (point 1).
- La tête fusionne sans conflit avec `origin/master` actuel (`edbc2e5`). Tests sur cette fusion : `hsh-01-placement-hashtags` 59/59 verts ; `tests/reseaux` et `tests/zernio` : 228 fichiers, 3 534 tests verts, 1 ignoré, 7 « à faire », 0 échec. `tsc --noEmit` : aucune erreur dans les fichiers de la PR.
- Aucun nom de personne dans le diff.
- Contrôles GitHub sur la tête 2e4ad78 : 8/8 verts.
