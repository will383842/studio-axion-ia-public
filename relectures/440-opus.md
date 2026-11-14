# Relecture Opus · PR 440 (L7-06 : Zernio outil d'envoi par défaut)

Branche `usine/L7-06`, tête `509507d2`. Diff relu : `git diff origin/master...origin/usine/L7-06` (17 fichiers, +281 / −136).
Lecture seule : rien n'a été modifié sur la PR.

## Verdict : À CORRIGER

Le code de la fiche est propre et sûr : aucun repli silencieux vers Buffer, et un « buffer » déjà enregistré reste lu.
Mais deux points bloquent la fusion :
1. **Le rouge « tests ciblés cas concret » vient de la PR, pas de master** : 24 échecs dans `tests/zernio`, et 0 sur master.
2. **Sans Buffer relié, l'envoi par défaut (Zernio) tombe dans une impasse** pour Facebook et pour tout réseau à plusieurs comptes.

---

## 1. Contrôle « tests ciblés cas concret » (rouge) : cause = la PR

Relance locale de la seule étape en échec (`pnpm exec vitest run tests/zernio`), pas de la suite complète :

| Base | Échecs / tests |
|---|---|
| `origin/usine/L7-06` (509507d2) | **24 / 3037** |
| `origin/master` (de254da0) | **0 / 3055** |

Tous les échecs viennent du nouveau défaut (`outilPour` → « zernio », option Buffer retirée, « jusqu'au 20/11 » retiré) :

- `tests/zernio/e2e-01-routage.test.ts` : 7 tests (« défaut {} : Buffer partout… », bascule, retour à Buffer, valeur illisible, Zernio sans clé).
- `tests/zernio/e2e-04-service.test.ts` : 5 tests (anti-doublon Buffer↔Zernio, arrêt sans effet sur Buffer).
- `tests/zernio/z2e-anti-doublon.test.ts` : 5 tests (on reçoit `ZERNIO_NON_RELIE` au lieu de `DEJA_CHEZ_UN_AUTRE_OUTIL`).
- `tests/zernio/z2s-routage.test.ts` : 2 tests (« défaut {} = Buffer partout », retour à Buffer).
- `tests/zernio/z3c-connexions.test.tsx` : 2 tests (option « Ancien outil » désactivée, phrase « jusqu'au 20/11 »).
- `tests/zernio/z1t-outil-publication.test.ts`, `z3c-arret-et-comptes.test.ts`, `fin-zernio-finitions.test.ts` : 1 test chacun.

Le journal `pilotage/journal/L7-06.md` dit « 24 échecs restants, tous préexistants ou dus au défaut Zernio » et « 43 échecs déjà présents sur la base L7-08 ». **C'est inexact pour master** : master est vert sur `tests/zernio`, donc les 24 échecs sont tous causés par cette PR.

**À corriger** : remettre ces attentes au défaut Zernio. Les tests restent des tests : aucun retrait, aucun saut. Pour les tests anti-doublon et routage, il faut poser une clé ou un faux client Zernio, ou bien un routage « buffer » explicite là où le test vise Buffer. Cela se fait par la session propriétaire de `tests/zernio` (zone interdite) ou avec son accord écrit, comme pour `z3e-envoi.test.ts`. Ne pas fusionner avant le vert.

## 2. Garde de zone et de fichiers autorisés (rouge) : attendue

Le seul fichier hors zone touché est `tests/zernio/z3e-envoi.test.ts:162` : le test `FIN_BUFFER` est retiré, avec l'accord écrit noté au journal. La règle des fichiers ajoutés est respectée via `pilotage/annonces/ANNONCE-L7-06-fichiers-ajoutes.md`. Ce rouge est accepté sous réserve de l'accord du parcours viral, comme prévu.

## 3. Commentaire orphelin « Aucun orange dans « À publier »… »

**Corrigé** : la PR supprime la ligne (ancienne ligne 24 de `src/components/publication/LignesAPublier.tsx`). Elle est absente de la tête 509507d2. Rien à faire.

---

## 4. Points de code

### Bloquant

**4.1 Sans Buffer relié, envoi Zernio impossible pour Facebook et les réseaux à plusieurs comptes**
- `src/services/a-publier.ts` (via `vueEnvoiBuffer`) : la liste « comptes à cocher » (`l.compte.choix`) vient **de Buffer seulement**. Sans Buffer relié, elle est absente et `avecChoix` est faux (`LignesAPublier.tsx:328`).
- `envoyerParOutilAction` (`src/services/a-publier-zernio.ts`) envoie alors `comptes` vide. `ciblesZernioPour` (`src/services/zernio-cibles.ts:45-52`) refuse alors :
  - pour Facebook, toujours (`CIBLE_ABSENTE`), avec la phrase « Cochez la page ou le profil de destination (liste « Compte Buffer » de la page) » (`zernio-cibles.ts:48`). Cette liste n'existe pas à l'écran, et elle parle de Buffer, qui n'est plus l'outil ;
  - pour un réseau à plusieurs comptes Zernio, `CIBLE_AMBIGUE` « choisissez-en un », sans aucun moyen de choisir.
- Le refus est sûr (rien ne part au mauvais endroit), mais c'est désormais **le chemin par défaut**. Le journal le signale lui-même comme « hors fiche, non corrigé ».
- **À corriger** (ici ou par une fiche liée bloquante avant la fusion) : alimenter `l.compte.choix` avec les comptes Zernio quand l'outil effectif est Zernio, et retirer « Compte Buffer » de la phrase de `zernio-cibles.ts:48`.

**4.2 Ligne « envoyée » pour tout le réseau côté écran**
Également noté au journal. Après un envoi Zernio vers un compte, sans `choix`, `dejaPris` (`LignesAPublier.tsx:330`) prend `l.etat.envoye` pour tout le réseau. Les autres comptes apparaissent alors comme déjà pris. Ce point est lié au 4.1 et se corrige avec lui.

### À corriger (non bloquant seul)

**4.3 Le serveur accepte encore `outil: "buffer"` venu du client**
`src/services/a-publier-zernio.ts:107` : `envoyerParOutilAction` suit `options.outil === "buffer"` sans vérifier le routage. L'écran ne propose plus Buffer, mais une action serveur peut toujours être appelée avec « buffer ». Ce comportement existait déjà ; la PR le rend incohérent avec l'interface.
**À corriger** : n'accepter « buffer » que si `outilPour(lireRoutage(), reseau) === "buffer"` (choix déjà enregistré). Sinon, refus clair.

**4.4 Réglages : un compte encore routé sur Buffer n'a plus de pastille sélectionnée**
`src/components/reglages/BlocZernio.tsx:66-70` : `SelecteurPastilles` ne propose plus que « Nouvel outil ». Si `compte.outil === "buffer"` (donnée existante), aucune pastille n'est active et l'état réel n'est pas lisible sur la carte. Seule la `CarteBascule` (`BlocZernio.tsx:97`, « publie encore par l'ancien outil ») le dit.
**À corriger** : afficher l'état « Ancien outil » en lecture seule (désactivé, sans retour possible), ou ne garder qu'un texte à la place d'un sélecteur à une seule option.

**4.5 « Changer d'outil » à une seule option**
`src/components/publication/LignesAPublier.tsx:679-688` : le fieldset ne s'ouvre que si `bufferDisponible` est vrai (Buffer choisi et relié), et ne propose plus que Zernio. Quand l'outil courant est Buffer, aucun bouton radio n'est coché au départ. C'est acceptable comme « sortie de Buffer », mais le libellé `pourCeContenu` et la légende « Envoi par » laissent croire à un choix.
Le commentaire `a-publier-zernio.ts:39` (« Buffer reste un choix possible ») est périmé. **À corriger** : le libellé et le commentaire.

### Mineur

**4.6 Double lecture du routage**
`src/services/routage-publication.ts:69-78` : `outilPour` ne renvoie « buffer » que si une clé vaut « buffer ». `explicite` est donc toujours vrai sur cette branche, et la seconde `lireRoutage()` (`:75`) est redondante (une lecture en base de plus). Il suffit de lire le routage une fois et de faire `if (!bufferRelie()) throw refusOutil("buffer")`.

**4.7 Constante homonyme avec une AUTRE valeur (à corriger)**
`src/domaine/outil-publication.ts:44` exporte `REGLAGE_ENVOI_CALENDRIER = "publication.editoriale_active"`. Or le même nom existe déjà avec la valeur `"zernio.envoi_calendrier_autorise"` dans `src/services/promotion-envois.ts:22` et `src/services/surveillance-heure-h.ts:17`.
Deux constantes portent donc le même nom pour deux réglages différents : un mauvais import ouvrirait ou lirait le mauvais interrupteur. La nouvelle n'est utilisée nulle part dans `src/` (seulement par le test), et elle double `PARAM_EDITORIALE_ACTIVE`.
**À corriger** : la retirer et faire lire `PARAM_EDITORIALE_ACTIVE` au test, ou au minimum la renommer (par exemple `REGLAGE_PUBLICATION_EDITORIALE`).

**4.8 Phrase de la CarteBascule**
`BlocZernio.tsx:99` : le retrait de « Vous pourrez revenir à l'ancien outil… jusqu'au 20/11 » est cohérent. Par contre, le bouton « Passer … sur le nouvel outil » reste sans retour possible, ce qu'aucun texte ne dit plus. C'est acceptable ; une phrase « sans retour » serait plus honnête.

---

## 5. Ce qui est juste

- `outilPour` : défaut « zernio », une valeur inconnue est ignorée, un « buffer » explicite reste lu (`outil-publication.ts:25-33`).
- `outilDeEnvoi` : sans clé Zernio, refus `ZERNIO_NON_RELIE`, jamais de repli vers Buffer. Avec « buffer » explicite et Buffer non relié, refus `BUFFER_NON_RELIE`.
- `FIN_BUFFER` / `FIN_BUFFER_ISO` retirés partout, ainsi que la condition `avantFin`. Les deux exceptions « date-buffer » de `outils/gardes/regles-de-fer.mjs` sont retirées (garde resserrée, jamais relâchée).
- Envoi groupé : `?? "zernio"` (`LignesAPublier.tsx:61`) ; TikTok reste exclu du groupé.
- Tests de la fiche (`tests/routage-publication-defaut.test.ts`) : faux client seulement, aucun réseau.
- Tests `a-publier*` et `r1-ecrans-buffer` : adaptés sans retrait ni saut ; les preuves de sécurité (mot interdit, vidéo non vérifiée, rejeu sans doublon) sont conservées.
- Sécurité : aucun secret, aucun identifiant réel, aucun nom de personne dans le diff.

## 6. Ce qu'il faut pour passer à OK

1. `tests/zernio` vert (24 attentes à remettre au défaut Zernio, par la session propriétaire ou avec son accord).
2. Le point 4.1 traité : comptes Zernio à cocher quand Buffer n'est pas relié, et phrase `zernio-cibles.ts:48` sans « Compte Buffer ». À défaut, une fiche bloquante liée, acceptée par le pilote.
3. Le point 4.3 traité : refus serveur de « buffer » non enregistré.
4. Le point 4.7 traité (constante homonyme).
5. Recommandé : les points 4.4 à 4.6.
