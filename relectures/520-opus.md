# Relecture Opus : PR 520 (ARG-ORIGINE-USINE)

Branche `usine/ARG-ORIGINE-USINE`, tête `6144eeeb`, relue contre `origin/master`.

## Verdict : À CORRIGER. Fusion déconseillée en l'état.

Fusionner ne casserait rien : aucun nouveau rouge, Studio inchangé, « Reprendre » intact. Mais le but de la fiche n'est pas
atteint. L'origine « usine » est maintenant contrôlée **au moment du geste** (confirmation du total de la série, pré-vols de
`fabriquerLesN` / `fabriquerVariante`, `manquesPour` dans la garde commune). En revanche, elle **se perd encore dans les
dépenses qui suivent ce geste** :

- les écritures de la série ;
- les versions lancées après la mère ;
- les relances après une attente de crédit.

Ces dépenses-là passent par la garde comme si elles venaient du Studio, donc le prix du jour vaut accord. Il faut corriger
les points A1 à A3 avant de fusionner. Aujourd'hui aucun appelant de l'Usine ne passe encore `origine`, donc ces trous ne
coûtent rien pour l'instant. Ils coûteront dès le branchement côté Usine.

## Points à corriger

**A1. Série : chaque écriture part sans origine** (`src/services/serie-ecriture.ts:189`)
`lancerSerie` reçoit bien `origine` et l'oppose au total (l.170, l.218, l.226). Mais l'appel
`lancerGeneration({ idee, reseaux, … })` de chaque élément ne transmet pas `origine`. Or `OptionsGeneration.origine`
(`boucle-generation.ts:70`) est justement ce qui est « FIGÉ au lancement ». C'est lui que relisent :

- `executeurFacture` (l.405 et l.438) ;
- la réserve de la chaîne (l.885, `budgetIndicatifPour(o.origine)`) ;
- `devisReprise` (l.704) ;
- `indicatifDeLEcriture` (`generation-claude.ts`).

Résultat : une série de l'Usine confirme son total, puis chacune de ses écritures est payée comme le Studio.
Correctif : passer `...(origine ? { origine } : {})` à `lancerGeneration`.
Test à ajouter dans `r7-origine-usine-serie` : après une série « usine », vérifier que
`lireParametre(cleOptions(g.id)).origine === "usine"` pour chaque génération créée, et que rien ne l'écrit côté Studio.

**A2. `fabriquerLesN` : les N−1 versions perdent l'origine** (`src/services/fabrication-reseaux.ts:887`)
Seules la mère (l.788) et les versions « complètes » (l.796) reçoivent `origine`. Les versions qui attendent leur mère partent
plus tard, par `lancerVariantesEnAttente` → `lancerFabricationConfirmee(video.id, { confirme, confirmationDifferee })`, sans
`origine`. Le repli `origineDeLaVideo` ne les rattrape pas : il lit la dernière version de la vidéo, et une vidéo neuve
n'en a aucune avant ce lancement. Le résultat vaut donc « studio ».
Correctif possible : garder l'origine dans la déclinaison (`decl`, au même endroit que `prixConfirme`), ou la relire sur
la commande de la mère (`origineDeLaVideo(mereVideoId)`, puisque `fabrication.ts:874` la fige), puis la passer à
`lancerFabricationConfirmee`.

**A3. Relance après une attente de crédit : l'origine est perdue** (`fabrication-reseaux.ts:719` et `credits.ts:766`)
Si le lancement est refusé faute de crédit ou de budget, la vidéo passe en attente via `lancerVideoDeVersion` →
`mettreEnAttenteDeCredit`. L'objet `attente` (l.719) ne garde que `confirme` et `moteurId`. La relance par
`lancerVideosEnAttente` (`credits.ts:766`) appelle donc `lancerFabrication` sans origine. Même effet qu'en A2 : la vidéo
n'a pas de version, donc elle est traitée comme le Studio. Ce chemin concerne `fabriquerLesN` (mère et versions) et
`fabriquerVariante`.
Correctif : ajouter `origine` à `lancementEnAttente` et la retransmettre à la relance.

## Points mineurs (à décider, non bloquants)

- **M1. Transmission au lancement non couverte par les tests.** Enlever `origine` de `lancerVideoDeVersion → lancerFabrication`
  (`fabrication-reseaux.ts:705`) laisse `r7-origine-usine-fabrication` vert (2/2, mutation rejouée). Le pré-vol refuse
  toujours avant ce lancement. Il faudrait ajouter une assertion « Usine confirmée : la version créée a `commande.origine === "usine"` ».
- **M2. `planSerie` ne tient pas compte de l'origine** (`serie-ecriture.ts:107`, `indicatif: await budgetIndicatif()`). Le
  journal le signale déjà. Une série de l'Usine n'est pas bornée par le budget dans son plan. La garde du mois (avec l'origine,
  une fois A1 corrigé) bornerait chaque écriture. C'est au fondateur de trancher.
- **M3. `empechementLeve`** (`generation-claude.ts:871`) appelle `manquesPour(a.lignes)` sans origine. Une écriture de l'Usine
  en attente peut donc être jugée débloquée sur un solde seulement « suivi ». C'est sans danger si la relance repasse par
  la garde avec l'origine. Il suffirait de passer l'origine (déjà lue par `indicatifDeLEcriture`, l.876).
- Les appels à `manquesPour` sans origine dans `credits.ts:699`, `credits.ts:701` (`detailCreditVideo`) et `credits.ts:1104`
  (`surveillerCredits`) servent à l'affichage ou à la surveillance. Rester sur le Studio y est acceptable, comme le journal le dit.

## Vérifications demandées

1. **« Reprendre » : inchangé.** Le diff de `boucle-generation.ts` ne touche que `fabriquerVariante` : la signature (l.1420),
   le pré-vol (l.1434) et le lancement (l.1463). `reprendreEcriture` (l.772, `accordAutomatique` sans origine),
   `reprendreEcritureArretee` (l.592–597) et `devisReprise` (l.704) sont identiques à master, ligne à ligne. Ils ne dépendent
   d'aucun symbole modifié : `manquesPour` n'est pas appelé dans ce chemin. `tests/garde-fous-reprise-sujet.test.ts` est vert
   sur la branche comme sur master.
2. **Les trous signalés : partiellement fermés.** Les gardes du geste sont branchées :
   - `exigerTotalConfirme` : `budgetIndicatifPour(origine)` puis `accordAutomatique({ origine })` ;
   - `verifierAvantDeCreer` et `verifierAvantDeFabriquerLesN` : `verifierBudgetEtCredits({ origine })` ;
   - `controlerCredits → manquesPour(lignes, origine)`.

   Les chemins oubliés sont A1, A2 et A3 (grep de `lancerGeneration`, `lancerFabrication*`, `manquesPour`, `accordAutomatique`).
3. **Studio : aucun changement.** J'ai lancé les 22 fichiers `r7-*`, `paquet4-*`, `c1-argent-b6-confirmation`, `garde-fous-*`
   et `c5-serie-ecriture`. Master : 5 rouges sur 185. Branche : les mêmes 5 rouges sur 191 (les 6 tests neufs sont verts).
   Ces rouges existaient déjà sur master :
   - `c1-argent-b6` : garde « confirme: true » ;
   - `c5-serie-ecriture` : 2 tests ;
   - `garde-fous-budget` : message d'attente ;
   - `paquet4-jonctions` : jonction 4.

   Aucun nouveau rouge. Sans origine, tout se résout comme sur master (`budgetIndicatifPour(undefined)` vaut
   `budgetIndicatif()`).
4. **Tests discriminants : oui pour les 3 mutations demandées.** Chaque mutation a été rejouée puis annulée par `git checkout -- src` :
   - série (origine retirée de `exigerTotalConfirme`) : 1 rouge, `r7-origine-usine-serie` ;
   - `manquesPour` (retour à `budgetIndicatif()`) : 2 rouges, `r7-origine-usine-manques` ;
   - `fabriquerLesN` et `fabriquerVariante` (origine retirée des deux pré-vols) : 2 rouges, `r7-origine-usine-fabrication`.

   Limite : voir M1, et A1, A2, A3 ne sont pas testés.
5. **Falsification par le client : impossible.** La seule action serveur exposée, `lancerSerieAction`
   (`src/app/(studio)/ecrire/serie/actions.ts:18`), appelle `lancerSerie` avec 5 arguments, donc sans origine.
   `generateur-ecran.ts:334` et `generateur-ecran.ts:338` appellent `fabriquerVariante` et `fabriquerLesN` sans origine. Aucun
   des fichiers de service touchés n'est en `"use server"`. De toute façon, « usine » est le cas le plus strict : un client
   qui l'enverrait ne ferait que se bloquer lui-même.
6. **Hygiène : rien à signaler.** Aucun nom de personne ajouté. Aucun `.skip`, `.only` ou `todo`. Tous les fichiers sont dans le
   périmètre : rien dans `tests/zernio`, `mots-*`, `.github`, `vitest.config.mts` ou `echecs-connus.json`.
7. **Outils : rien de nouveau.** `pnpm install --frozen-lockfile` passe. tsc : 146 erreurs sur la branche comme sur master, les mêmes
   (seul l'ordre des unions affichées change), aucune dans les fichiers touchés. ESLint sur les fichiers touchés : 0 erreur et
   3 avertissements, tous déjà présents et hors des lignes du diff.

## Pour fusionner

Corriger A1, A2 et A3 avec un test pour chacun : l'origine doit se retrouver sur la génération ou sur la commande créée.
Ajouter M1 de préférence. M2 et M3 sont à trancher ou à noter dans le journal de la fiche.
