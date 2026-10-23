# Journal — coupes « reprise » en mode texte (correctif du 09/10)

Branche `fix/coupes-reprises-mode-texte`, partie de `origin/master` (0ec524b). Rien de fusionné, rien de déployé, aucun
serveur touché, aucun appel réseau (la brique est pure, le test n'utilise pas `fetch`).

## Constat en prod

Premier vrai montage face caméra (IMG_7747, travail `trav-2d323cdd6e4c`), mode « texte » (texte validé collé tel quel).
La brique `src/briques/coupes` a marqué en « reprise » 6 passages dits UNE SEULE FOIS, et a raté la vraie reprise de fin
(« Quel que soit votre taille. Si vous sentez que du temps, » abandonné vers 101,76 s, redit en entier à 111,20 s).

## Reproduction (avant correctif)

Le cas est rejoué dans `src/briques/coupes/coupes.test.ts` (« non-régression IMG_7747 ») : mots horodatés fabriqués à
partir de la transcription Whisper (fautes d'écoute, chiffres « 1, 2, 3, 45 », « ? » isolés), texte validé du 09/10.
Sur le code de `master`, la brique rend :

```
debut 0-27.36 Début à jeter (27,4 s)                       ← « Les soirées sur les deux vies… » perdu
reprise 64.52-74.36 « c'est weekend. Un premier diagnostic gratuit de… »
reprise 75.8-76.48  « ? 2 »
reprise 78.68-79.4  « ? 3 »
reprise 81.84-87.8  « ? Une formation pour vos équipes avec… »
reprise 101.76-111.4 « Quel que soit votre taille. Si vous… »  ← emporte aussi le « Quel » GARDÉ de 111,2 s
fin 118.48-120
```

`vitest run src/briques/coupes` avant correctif : `Tests  3 failed | 11 passed (14)`.

## Causes (dans `texte.ts` / `index.ts`)

1. **Tout mot non rattaché à une phrase devenait « reprise ».** Dans `calculerCoupes`, chaque mot situé entre la
   première et la dernière phrase retrouvées, hors des bornes d'une occurrence gardée, était marqué `reprise` — sans
   jamais vérifier qu'il était redit. Une fin de phrase mal entendue (« c'est weekend » pour « ses week-ends »), un
   « ? » isolé, ou une phrase entière non retrouvée partait donc à la coupe.
2. **Nombres en chiffres.** Whisper écrit « 1, », « 2, », « 3, », « 45 » ; le texte dit « Un », « Deux », « Trois »,
   « quarante-cinq ». Aucune équivalence : « 1 » restait hors de la phrase (coupe « 1 »), « 2, » / « 3, » idem
   (coupes « ? 2 », « ? 3 »), et la phrase des 45 minutes n'était plus reconnue.
3. **Alignement trop fragile.** Le déroulé mot à mot s'arrêtait au 2ᵉ raté de suite, et un recalage (mot sauté) comptait
   comme un raté : « deux vies » / « devis », « aideaux que » / « aides autant que », « à Calliopee » / « grâce à
   Certifexemple » suffisaient à « abandonner » la phrase (couverture < 50 % → phrase non retrouvée → coupée).
4. **Accords.** `memeMot` exigeait 5 lettres pour tolérer une différence : « Quel » / « Quelle », « leur » / « leurs »
   n'étaient pas le même mot. La dernière phrase (« Quelle que soit… ») démarrait donc à « que » (111,43 s) et le
   « Quel » réellement gardé de 111,2 s tombait dans la reprise.
5. **Ponctuation isolée.** Un « ? » transcrit comme mot n'a aucune forme comparable : jamais rattaché à une phrase, il
   tombait dans la zone « reprise » (et donnait son nom aux libellés « ? 2 », « ? Une formation… »).

## Correctif

- `texte.ts`
  - `tokens()` : les nombres en chiffres (jusqu'à 6 chiffres) sont ramenés en lettres (`nombreEnLettres` : 1 → « un »,
    45 → « quarante cinq », 71 → « soixante et onze », 2026 → « deux mille vingt six »), des deux côtés.
  - `memeMot()` : accord entendu ou non (même mot d'au moins 3 lettres suivi de e / s / es / le / les / x) ;
    « que » ≠ « quel » reste vrai.
  - `occurrences()` : après un raté, `recaler()` cherche le plus petit saut (3 mots au plus côté dits et côté texte)
    qui retombe sur un mot de la phrase CONFIRMÉ par le mot suivant (ou par la fin de phrase) ; sans recalage possible,
    l'occurrence s'arrête (phrase abandonnée). Les mots mal entendus ne font plus abandonner une phrase.
- `index.ts`
  - `garderCeQuiNEstPasRedit()` : un passage écarté entre deux phrases retrouvées n'est une `reprise` que s'il est
    RÉELLEMENT redit : ses premiers mots (3 au plus) reviennent dans ce qui est gardé juste après — tout de suite, ou
    dans les ~40 mots suivants pour un passage d'au moins 2 mots. Sinon il est GARDÉ (« dans le doute, garder »).
    Un passage sans mot comparable (« ? ») est toujours gardé.
- Inchangé : début / fin à jeter, consignes, hésitations, blancs, chutes, mode libre.

Limite connue (pas de régression, mais pas traitée ici) : une fin de phrase redite DANS la même phrase (« …qui arrivent
trop, les chiffres qui arrivent trop tard. ») est désormais gardée deux fois au lieu d'être coupée au mauvais endroit —
une phrase de trop plutôt qu'une phrase perdue.

## Résultat sur le cas IMG_7747 (après correctif)

```
debut 0-22.96 Début à jeter (23,0 s)          ← seulement le blanc avant le premier mot
reprise 101.76-111.12 « Quel que soit votre taille. Si vous… »   ← la vraie reprise
fin 118.48-120
```

Les 11 phrases du texte sont retrouvées (couvertures 0,73 à 1), aucune phrase manquante, aucune coupe dans un mot, la
dernière phrase est prise à 111,2 s (2 essais).

## Commandes et résultats exacts

```
$ npx vitest run src/briques/coupes/coupes.test.ts
      Tests  14 passed (14)

$ npx vitest run src/briques/coupes tests/facecam- tests/z-integration-facecam tests/v-coherence-facecam tests/h-facecam-multicamera
 Test Files  21 passed (21)
      Tests  256 passed (256)

$ npx eslint src/briques/coupes/index.ts src/briques/coupes/texte.ts src/briques/coupes/coupes.test.ts
(aucune sortie)  eslint exit=0

$ npx next typegen && npx tsc --noEmit
9 erreurs, toutes dans studio-rendu/ (modules @remotion/* absents : dépendances de ce sous-projet non installées
dans le conteneur). 0 erreur dans src/.
(sans `next typegen` : 4 erreurs de plus, RouteContext / LayoutProps non générés — sans lien avec la brique.)
```

$ npx vitest run            (suite complète du dépôt, branche corrigée)
 Test Files  5 failed | 270 passed | 1 skipped (276)
      Tests  15 failed | 3352 passed | 3 skipped (3370)
Les 15 échecs : tests/e2e-verif1-a1-eteints (2), e2e-verif1-bc-serie (3), e2e-verif1-d-interrupteurs (3),
r0-connexions (3), r6-je-lis-reel (4) — « Face caméra » apparaît désormais dans les listes de montage réel (activation
du format, 9267233) et 2 délais dépassés. PRÉEXISTANTS : mêmes 5 fichiers sur origin/master sans ce correctif :
 Test Files  5 failed (5)
      Tests  15 failed | 69 passed (84)
Aucun ne touche la brique coupes.
```
