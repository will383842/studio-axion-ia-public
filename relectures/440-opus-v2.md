# Relecture Opus v2 · PR 440 (L7-06 : Zernio outil d'envoi par défaut)

## Verdict : OK (fusion possible), avec 3 retouches non bloquantes et un geste à faire après la mise en ligne

Branche `usine/L7-06`, tête `02199353`. Diff relu : `git diff origin/master...origin/usine/L7-06` (30 fichiers, +514 / −189).
Verdict précédent : `relecture/440-opus:relectures/440-opus.md` (À CORRIGER). Lecture seule : rien n'a été modifié sur la PR.

Les deux points bloquants sont levés :
- les 24 tests rouges de `tests/zernio` sont repris sans affaiblissement ;
- l'impasse « sans Buffer relié » (4.1) est corrigée.

Les tests ciblés sont verts.

---

## 1. Conditions du parcours viral, fichier par fichier

### (1) `tests/zernio/` : seuls les 8 fichiers autorisés changent (plus `z3e-envoi`, déjà accordé)

| Fichier | Tests master → branche | Contrôle |
|---|---|---|
| `e2e-01-routage.test.ts` | 8 → 8 | Les attentes sont inversées au défaut Zernio. Le test « Zernio sans clé » garde ses 4 preuves : refus `ZERNIO_NON_RELIE` à l'envoi ET à la bascule, réseau Buffer explicite sans erreur, routage inchangé. Facebook est posé en « buffer » explicite et la bascule refusée porte sur LinkedIn : la preuve reste équivalente. |
| `e2e-04-service.test.ts` | 18 → 18 | Ajout seul, dans `beforeEach` : routage `{ instagram: "buffer" }` explicite. Aucune assertion modifiée. |
| `z2e-anti-doublon.test.ts` | 9 → 9 | Même ajout seul dans `beforeEach`. Aucune assertion modifiée. |
| `z2s-routage.test.ts` | 5 → 5 | « Défaut = Zernio » : il ajoute en plus le refus sans clé, donc l'assertion est **renforcée**. Le reste ne fait que passer de « buffer » à « zernio » pour le défaut. |
| `z3c-connexions.test.tsx` | 25 → 25 | Le bouton « Ancien outil » désactivé devient « Ancien outil » absent et « Nouvel outil » présent. « jusqu'au 20/11 » passe de présent à absent. Ce sont des attentes du défaut d'outil, et elles restent strictes. |
| `z1t-outil-publication.test.ts` | 4 → 4 | Défaut « zernio ». Le garde-fou contre la pollution de prototype est gardé : `{ constructor: "buffer" }` → « zernio ». Il prouve toujours que la clé héritée est ignorée. |
| `z3c-arret-et-comptes.test.ts` | 5 → 5 | Une attente seulement : `a1.outil` passe de « buffer » à « zernio ». `basculeLe` nul et la clé de routage unique restent vérifiés. |
| `fin-zernio-finitions.test.ts` | 12 → 12 | Ajout seul : routage « buffer » explicite dans le test « Buffer inchangé ». |
| `z3e-envoi.test.ts` | 19 → 18 | Test `FIN_BUFFER` retiré : accord écrit déjà reçu lors de la première relecture. |

- Aucun autre fichier de `tests/zernio` n'est touché.
- Aucun `.skip`, `.todo`, `.fails` ni `.only` n'est ajouté. Les `todo` comptent 8 occurrences sur master comme sur la branche.
- Master n'a pas modifié ces fichiers depuis la base de fusion (`5e8506a0`) : la comparaison test par test est donc valable.

### (2) Zones protégées
Aucun fichier n'est touché dans `src/services/parcours-*.ts`, `src/domaine/guide-reseau/**`, ni dans le port des messages privés.

### (3) `src/services/zernio-cibles.ts`
- `:48` : la phrase devient « liste des comptes de la page ». « Compte Buffer » a disparu.
- `:91-95` : une branche neuve prend telle quelle une cible déjà au format Zernio. Elle reste bornée à `disponibles`, c'est-à-dire la liste Zernio du réseau, sans compte déconnecté et sans page interdite.

Cette modification est autorisée.

---

## 2. Point 4.1 : corrigé

- `src/services/comptes-envoi-zernio.ts` (neuf) donne la liste des comptes Zernio du réseau :
  - elle vient de la base, enregistrée au « Tester » de Réglages (`actions-zernio.ts:154-159`) ;
  - l'écran ne la lit jamais chez Zernio ;
  - les comptes déconnectés et les pages interdites sont exclus ;
  - Facebook a toujours une liste ; les autres réseaux n'en ont une que s'ils ont au moins 2 comptes.
- `src/services/a-publier.ts:185` : si l'outil effectif est Zernio, `l.compte.choix` vient de Zernio, sinon de Buffer. `avecChoix` devient vrai sans Buffer relié.
- Les identifiants cochés partent par `envoyerParOutilAction` → `traduireSelectionVersZernio`, qui les accepte tels quels (`zernio-cibles.ts:91`).
- Un identifiant périmé ne fait jamais partir l'envoi ailleurs :
  - seul, il retombe sur `CIBLE_ABSENTE` pour Facebook, ou sur le compte unique ;
  - avec d'autres, il donne `SELECTION_NON_TRADUITE`.

**Test neuf `tests/publication/a-publier-zernio-comptes.test.ts` : pertinent, pas tautologique.**
- Il passe par la vraie `vueAPublier`, sans Buffer relié.
- Contre-épreuve faite : avec `a-publier.ts:185` remis à l'ancienne ligne (`envoi?.comptes[reseau] ?? {}`), 2 tests sur 6 échouent (Facebook/Instagram, et « réseau gardé chez Buffer »).
- Les cas « un seul compte », « jamais lus » et « déconnecté » couvrent aussi les bords.

## 3. Point 4.2 : corrigé (non couvert par un test)
- `etatDe(…, compte.choix)` (`a-publier.ts:212`) compare `canalId` à la liste Zernio.
- Pour un envoi Zernio, `canalId` est l'identifiant de la cible Zernio (`publications.ts:1028`, `p.canal.id`).
- L'état se calcule donc par compte, et `dejaPris` (`LignesAPublier.tsx:330`) passe par la branche `avecChoix`.
- Aucun test ne le prouve : voir R3.

## 4. Journal
`pilotage/journal/L7-06.md` est rectifié :
- master est vert sur `tests/zernio` et les 24 échecs venaient tous de cette PR ;
- le correctif suivant liste les 8 fichiers, l'accord, le 4.1 et le 4.2.

Il dit à juste titre que les points 4.3 à 4.8 restent ouverts.

## 5. Noms de personnes
Aucun dans le diff : journal, annonce, tests et code. Les données de test sont neutres (« Compte exemple A », « Page exemple 1 »).

## 6. Tests relancés (ciblés)
`pnpm exec vitest run tests/zernio tests/publication` sur `02199353` donne **188 fichiers, 3065 passés, 0 échec**. Les 7 `todo` existaient déjà.

---

## Retouches non bloquantes (à faire dans une fiche de suite, ou avant fusion si c'est simple)

- **R1** `src/components/publication/LignesAPublier.tsx:470` : le titre au-dessus de la liste dit encore « Compte Buffer ». Il s'affiche désormais au-dessus des comptes Zernio. Il faut le remplacer par un libellé neutre (« Compte ») ou par le nom de l'outil (`nomOutil`), en accord avec la phrase de `zernio-cibles.ts:48`. Le commentaire de `src/services/a-publier.ts:94` est à aligner aussi.
- **R2** Commentaires périmés :
  - `src/services/a-publier-zernio.ts:126` dit « Les comptes que l'écran envoie sont ceux de Buffer… sans jamais les passer tels quels ». Ce n'est plus vrai.
  - `src/services/zernio-cibles.ts:72-80` dit « Aucun identifiant ne passe d'un outil à l'autre », et le paramètre s'appelle `choisisBuffer`. Il faut le dire : « les identifiants déjà Zernio passent tels quels, ceux de Buffer sont traduits par le nom ».
- **R3** Couverture :
  - aucun test n'exerce la branche neuve `zernio-cibles.ts:91-95`, c'est-à-dire un identifiant Zernio coché, accepté tel quel, et un identifiant périmé refusé ;
  - aucun test ne couvre l'envoi de bout en bout depuis la liste Zernio (Facebook, page cochée, une seule création chez le faux client) ;
  - l'état par compte (4.2) n'est pas testé non plus.
  
  Il faut ajouter ces cas dans `tests/publication/` : le pilote ne doit pas avoir à ouvrir `tests/zernio`.

## Geste à faire après la mise en ligne (à signaler au pilote)
La liste `zernio.canaux` est **vide tant que personne n'a appuyé sur « Tester »** dans Réglages > Zernio. D'ici là, Facebook reste refusé (`CIBLE_ABSENTE`), sans case à cocher, et l'écran affiche « Lu au premier envoi. » (`LignesAPublier.tsx:482`). Il faut appuyer une fois sur « Tester » juste après le déploiement. Mieux encore, la phrase de refus pourrait inviter à le faire.

## Rappel : points restés ouverts de la première relecture (non bloquants)
- 4.3 : `envoyerParOutilAction` accepte encore `outil: "buffer"` venu du client (`a-publier-zernio.ts:107`).
- 4.4 : la pastille « Ancien outil » est absente pour un compte encore routé chez Buffer.
- 4.5 : le choix « Changer d'outil » n'a qu'une seule option.
- 4.6 : le routage est lu deux fois dans `outilDeEnvoi`.
