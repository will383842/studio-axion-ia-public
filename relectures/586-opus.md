# Relecture PR 586 — HSH-01a (règle pure et réglage du placement des hashtags)

**VERDICT : À CORRIGER** — tête relue `40224347bd6e91721f93bfd0a39e6f7f5ffcbe0b` (`origin/usine/HSH-01a`, tête complète attendue confirmée).

## À corriger

1. **MAJEURE** — `src/reseaux/placement-hashtags.ts:100-102` : au-delà du maximum, `placerHashtags` **supprime** les mots-dièse en trop (`mots.slice(0, max)`), y compris avec le placement par défaut « texte ». Or la fiche HSH-01c, qui fera passer `texteAEnvoyer` par `placerHashtags`, exige qu’avec le réglage par défaut le texte envoyé soit **identique octet pour octet** à celui d’aujourd’hui. `texteAEnvoyer` (`src/services/publications.ts:836`) n’écarte que les interdits et ne coupe rien, et `modifierTexteKit` (`publications.ts:510`) laisse saisir à la main plus de mots-dièse que le maximum. Sonde jetable : 72 combinaisons sur 144 diffèrent (ex. LinkedIn, 6 mots-dièse : « Texte\n\n#m0 #m1 #m2 » au lieu de « … #m3 #m4 #m5 »). Le critère 3 demande un *message* en cas de dépassement, pas une coupe silencieuse du choix de la personne. Correction attendue : garder tous les mots-dièse non interdits et se contenter du message (« … au plus pour ce réseau »). Adapter le test (cas maximum + 1 : tous gardés, message présent).
2. **MINEURE** — `src/reseaux/placement-hashtags.ts:44,48,52` : le champ `source` dit « Schéma Buffer : champ firstComment … ». HSH-01b affichera la source et la mention « hypothèse » des règles : cette chaîne ferait apparaître le nom de l’outil à l’écran. Préférer une source neutre (ex. « Schéma de l’outil de publication : premier commentaire (Instagram, Facebook, LinkedIn) »). Autre point : la date vient du schéma du 03/10/2026, pas du relevé L8-01 cité par le critère 4. À signaler, ou à marquer « hypothèse » tant que L8-01 n’est pas cité.
3. **MINEURE** — `src/reseaux/placement-hashtags.ts:97` : avec plusieurs interdits, la phrase reste au singulier (« #fyp, #viral écartés : ce mot-dièse n’aide pas… »). Il faut accorder (« ces mots-dièse n’aident pas »).

## Vérifié, conforme

- Fichiers : exactement les 3 autorisés (2 nouveaux dans `src`, 1 test). Aucune suppression. `scripts/echecs-connus.json` inchangé.
- Règle pure : aucun `fetch` à l’import ni à l’appel (sonde avec `fetch` piégé : 0 appel). Elle est déterministe, sans mutation de l’entrée gelée et sans exception pour les 6 réseaux `IdReseau`. Les fonctions `premierCommentaireTransmissible`, `premierCommentaireTransmissibleZernio`, `estInterdit`, `limiteMotsDieses` et `ecritureReseau` sont importées, pas recopiées. TikTok n’a jamais de premier commentaire. Le repli est en français et ne nomme pas l’outil (« par cet outil »).
- Réglage : valeur par défaut « texte » partout. Un ancien état sans la clé se charge, de même qu’un état abîmé (`null`, chaîne, nombre, tableau, valeurs inconnues). Sonde : tout retombe sur « texte » et une valeur valide est conservée. `definirPlacement` commence par `exigerSession()`, refuse en français, journalise. Le service porte `server-only`.
- Contrat HSH-01b : `lirePlacements`, `definirPlacement`, `REGLES_PLACEMENT` (source/hypothèse), `premierCommentairePossible` (Instagram par Zernio → repli) sont exportés. Contrat HSH-01c : la signature `placerHashtags({ reseau, outil, placement, texte, motsDiese, commentaire? })` est conforme, mais voir le point 1.
- Aucun appel réel ni publication. Aucun nom de personne dans le diff.
- Tests : `tests/reseaux/hsh-01-placement-hashtags.test.ts` passe à 56/56 sur la branche et est rouge sur master (module absent). `tests/reseaux` et `tests/zernio` passent : 3537 tests verts. `tsc` : aucune erreur dans les fichiers de la PR (les erreurs relevées en local existaient déjà, hors périmètre).
- Contrôles GitHub : 8/8 verts.
