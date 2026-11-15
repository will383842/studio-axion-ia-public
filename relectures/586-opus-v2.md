# Seconde relecture PR 586 — HSH-01a (placement des hashtags), après correction

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `2e4ad78e4208f580e794c29289cf13b558406894`** (`git rev-parse origin/usine/HSH-01a` confirmé).

## Points du premier verdict (`relectures/586-opus.md`, tête 40224347)

1. **MAJEURE, aucun mot-dièse supprimé au-delà du maximum : RÉSOLU.** `src/reseaux/placement-hashtags.ts:107-110` : plus de `slice`. Tous les mots-dièse non interdits sont gardés et le message avertit (« 7 mots-dièse : 3 au plus pour ce réseau, tous sont gardés, à vous de les réduire. »). Une sonde jetable, non poussée, a comparé `placerHashtags` (placement « texte ») à `texteAEnvoyer` (`src/services/publications.ts:836`) : 6 réseaux `IdReseau` × 2 outils × 3 textes (y compris vide) × 0 à 40 mots-dièse × avec ou sans interdits, soit **2 952 combinaisons, 0 écart octet pour octet**, et jamais de premier commentaire. En placement « premier commentaire », aucun mot-dièse non interdit n'est perdu (0 écart). Le contrat de HSH-01c (même texte avec le réglage par défaut) est donc tenu.
2. **MINEURE, source sans mention de Buffer : RÉSOLU.** `:37` : la source neutre est « Schéma de l'outil de publication, relevé du 03/10/2026 (hors relevé L8-01) … ». La sonde ne trouve ni `buffer` ni `firstComment` dans aucune `source`. Le fait que la source ne soit pas le relevé L8-01 est désormais écrit en toutes lettres. Le mot « buffer » ne subsiste que comme clé de code et chemin d'import, jamais affiché.
3. **MINEURE, accord du message des interdits : RÉSOLU.** `:100-104` : « #fyp écarté : ce mot-dièse n'aide pas… » au singulier, « #fyp, #viral écartés : ces mots-dièse n'aident pas… » au pluriel (vérifié par la sonde et par un nouveau test).

## Non-régression et cadre

- Diff contre master : exactement 3 fichiers ajoutés (`src/reseaux/placement-hashtags.ts`, `src/services/placement-hashtags.ts`, `tests/reseaux/hsh-01-placement-hashtags.test.ts`). Aucune ligne supprimée, aucune suppression de fichier. Le correctif ne touche que la règle et le test. `scripts/echecs-connus.json` est inchangé.
- La règle reste pure : `fetch` piégé dans la sonde, 0 appel. Les entrées gelées ne lèvent aucune exception (pas de mutation). Les fonctions de transmission du premier commentaire sont toujours importées, pas recopiées. TikTok n'a jamais de premier commentaire. Instagram par Zernio passe par le repli.
- Contrat HSH-01b (`lirePlacements`, `definirPlacement`, `REGLES_PLACEMENT` avec source et date ou « hypothèse », `premierCommentairePossible`) : inchangé par le correctif. Contrat HSH-01c (`placerHashtags({ reseau, outil, placement, texte, motsDiese, commentaire? })`) : signature inchangée, et le point 1 lève l'obstacle.
- Aucun appel réel, aucune publication. Aucun nom de personne dans le diff ni dans les messages de commit.
- Tests : `tests/reseaux/hsh-01-placement-hashtags.test.ts` est vert. Il couvre maintenant « maximum + 1 », tous les mots gardés, l'accord des interdits et la source neutre. `tests/reseaux` : 25 fichiers, 293 réussis, 1 ignoré. `tests/zernio` : 185 fichiers sur 186 verts. `tests/zernio/imp1-exporter.test.ts` dépasse 120 s en local **aussi sur master** : le défaut existait avant la PR, il est hors périmètre, et ce fichier n'importe pas le module.
- Contrôles GitHub sur `2e4ad78e` : **8/8 terminés et verts** (règles de fer, garde de zone et de fichiers autorisés, garde interne, eslint et tsc différentiels, tests des fichiers touchés, tests des nouveaux fichiers de test, next build, build réel en contexte Docker).
