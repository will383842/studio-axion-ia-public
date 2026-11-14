# Seconde relecture Opus — PR 511 (L7-06-4-3 : le serveur route Buffer, le client ne le choisit plus)

**Verdict : OK — fusion possible.** Un point de suivi non bloquant (cas limite de migration, voir « Suivi »).

Tête relue : `68f5b267` (branche `usine/L7-06-4-3`), diff `origin/master...origin/usine/L7-06-4-3`.
Première relecture : `relecture/511-opus:relectures/511-opus.md` (À CORRIGER, tête `66cd25e0`).

## (1) Les 6 points de la première relecture

| # | Point | État |
|---|---|---|
| 1 | Régression écran pour un compte routé chez Buffer | **Traité** : `src/services/a-publier-zernio.ts:114-122` accepte « buffer » si `outilDeEnvoi(reseau)` (configuration lue côté serveur) vaut `buffer`. Prouvé par un test temporaire sur le banc réel (voir 3). |
| 2 | Assertions retirées/inversées dans `tests/zernio/e2e-04-service.test.ts` | **Traité** : fichier identique à master (même blob `fe9213d1` sur master, la tête et la base de fusion). Aucune assertion retirée. |
| 3 | Branche Buffer de `essayer` morte, commentaire faux | **Traité** : la branche (`:126`) sert de nouveau (chemin Buffer accepté) ; commentaire de tête corrigé (`:102-105`). |
| 4 | Valeur inconnue partant silencieusement chez Zernio | **Traité** : `:113` — seuls l'absence, `"zernio"` et `"buffer"` passent ; tout le reste → `OUTIL_REFUSE`. |
| 5 | Autres entrées vers Buffer | **Sans changement nécessaire**, revérifié : `envoyerVersBufferAction` (`src/app/(studio)/videos/actions.ts:376`) route par `outilDeEnvoi` ; sur un réseau routé chez Zernio elle ne fait aucune mutation Buffer (test temporaire). |
| 6 | `null` et `""` non testés | **Traité** : `tests/publication/l7-06-4-3-refus-buffer.test.ts:76` couvre `"Buffer"`, `" buffer"`, `"buffer "`, `"BUFFER"`, `"inconnu"`, `""`, `null`, `0`. |

## (2) `tests/zernio/**` non modifié — pourquoi les anciens appels `{ outil: "buffer" }` passent

Le diff ne touche aucun fichier de `tests/zernio`. Le `beforeEach` de `e2e-04-service.test.ts:97` écrit le routage
`{ instagram: "buffer" }` : tous les appels `{ outil: "buffer" }` du fichier (`:148`, `:160`, `:175`, `:213`, `:247`, `:327`) visent
Instagram, réseau que la configuration serveur place chez Buffer ; la nouvelle règle les accepte et le chemin Buffer d'origine s'exécute.
Les phrases « Déjà envoyée par Buffer pour ce réseau. » / « Déjà envoyée par Zernio pour ce réseau. », les compteurs de mutations,
`ok: false` / `posts 0` après changement de date et la relecture d'un vrai post Buffer sont donc de nouveau exercés tels quels.
C'est cohérent avec l'accord écrit du parcours viral (« aucune autre assertion retirée ») : rien n'est retiré, rien n'est changé.

## (3) Écran « À publier », compte routé chez Buffer — prouvé (test temporaire, supprimé, non poussé)

Banc de `e2e-04` (routage `instagram: "buffer"`). Pour chaque ligne Instagram de `vueAPublier()` : `complementsAPublier()` donne
`outil = "buffer"`, `bufferDisponible = true` ; appel exact de `LignesAPublier.tsx:62` (`outil: complements[cle].outil`) puis de `:361`
(`outil = complement.outil`). Résultat : jamais `OUTIL_REFUSE` ; v-11, v-01, v-02 → `{ ok: true, nombre: 1 }`, +1 mutation Buffer,
+1 publication, 0 post Zernio ; v-04 et v-14 → refus `AVANT_DE_PUBLIER` (licence du jeu d'exemple). **Résultats identiques sur master**
(même test lancé avec le `a-publier-zernio.ts` de master) : aucune régression pour un compte routé chez Buffer.

## (4) Refus avant tout effet de bord — prouvé sur le banc réel (test temporaire)

Pour `"Buffer"`, `" buffer"`, `"buffer "`, `"BUFFER"`, `""`, `null`, `"inconnu"`, sous routage Instagram `buffer` ET `zernio`, puis
`"buffer"` sous routage `zernio` : `{ ok: false, code: "OUTIL_REFUSE" }`, 0 mutation Buffer, 0 appel Zernio, nombre de publications
inchangé, aucune ligne `studio_envoi` pour `envoyerParOutilAction`. Le refus est à `:113` / `:121`, juste après `exigerSession()`,
avant `essayer` ; seule une lecture du routage précède `:121` (pas d'écriture). Une configuration illisible (`outilDeEnvoi` lève) → refus
(`:115-121`, couvert par le test neuf `:61`). Contournement : `envoyerParOutilAction` n'a qu'un appelant (`LignesAPublier.tsx`) ;
`envoyerVersBufferAction` et `mesures.ts` passent par `envoyerVersBuffer`, routé par la configuration — aucune mutation Buffer sur un réseau
routé chez Zernio.

## (5) Compte routé chez Buffer et gardes anti-doublon

- Routé Buffer + `"buffer"` : 1 publication, 1 mutation Buffer (banc réel, test temporaire ; et test neuf `:67`).
- Buffer → Zernio : refus avec « Déjà envoyée par Buffer pour ce réseau. » (`e2e-04:147`, inchangé, vert ; et test temporaire).
- Zernio → Buffer : refus avec « Déjà envoyée par Zernio pour ce réseau. », 0 mutation (`e2e-04:158`, inchangé, vert).

## (6) Fichiers et noms

Diff à trois points : exactement `src/services/a-publier-zernio.ts`, `tests/publication/l7-06-4-3-refus-buffer.test.ts`,
`pilotage/journal/L7-06-4-3.md` (le commit de fusion de master n'ajoute rien d'autre). Aucun nom de personne.

## (7) Mutations et suites

- M1, validation de valeur retirée (`:113`) : 22 rouges (8 du test neuf + 14 du test temporaire). Tuée.
- M2, contrôle de configuration retiré (`:121`) : 3 rouges (test neuf `:54` et `:61`, test temporaire « buffer sur Zernio »). Tuée.
- `e2e-04` reste vert sous M1 et M2 (attendu : il n'emploie que des « buffer » légitimes).
- Fichier restauré après chaque mutation, arbre propre.
- `tests/publication` + `tests/zernio` sur la tête `68f5b267` : **198 fichiers, 3133 réussis, 7 todo, 0 échec**.

## Suivi (non bloquant, ticket recommandé)

Cas limite de migration Buffer → Zernio, prouvé par test temporaire : une ligne dont la **dernière publication est passée par Buffer**,
alors que le routage du réseau est **désormais Zernio**. `complementsAPublier` (`src/services/a-publier-zernio.ts:72`) prend
`outilDe(derniere)` = `"buffer"`, l'écran envoie `"buffer"`, le serveur refuse (`:121`).
- Dernière publication **en échec** : sur master, le renvoi partait chez Zernio (via le routage de `envoyerVersBuffer`, avec un
  « Envoyé par Buffer » trompeur à l'écran) ; sur la branche → `OUTIL_REFUSE`, rien ne part, et « Changer » n'est pas proposé
  (`bufferDisponible = false`). L'opérateur ne peut plus renvoyer cette ligne depuis « À publier » (la page vidéo, routée par configuration,
  reste possible).
- Dernière publication **active** : refus dans les deux cas, mais la phrase passe de « Déjà envoyée par Buffer pour ce réseau. » à
  « Cet outil n'est pas disponible pour cet envoi ».
Le comportement est sûr (rien ne part) et conforme à la décision d'architecture ; correction suggérée dans le même fichier :
à `:72`, prendre l'outil du routage quand `etat === "echec"` (un renvoi suit le routage). Ce n'est pas le cas visé par la fiche
(compte routé chez Buffer) : n'empêche pas la fusion.

## Fusion

**Oui, fusion possible.** Les 6 points sont traités, `tests/zernio/**` est intact et vert, aucune régression pour un compte routé
chez Buffer, refus avant tout effet confirmé, mutations tuées. Ouvrir un ticket pour le cas limite ci-dessus.
