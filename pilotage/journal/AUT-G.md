# AUT-G — une clé de registre par dépense (plafond de l'Usine non dépassable)

Corrige la FAILLE 1 et le point 5 de `relectures/audit-usine-argent.md`.

- `cleUsine = travailId#appel` (`nouvelId("voix")`) aux 4 sites de voix : `image-video.ts`, `tableau-branchements.ts`, `cas-concret-branchements.ts`, `tutoriel-branchements.ts`. Chaque lecture occupe sa propre part du plafond.
- `engagerBudget(…, { cumuler })` : sur un engagement actif, l'Usine AJOUTE (jamais écrase). Sans `cumuler` : remplace, comme avant.
- `jugerSousPlafondUsine` / `inscrireAccordUsine` : option `ajouter` (ce que la clé occupe déjà + le besoin). Sans elle : inchangé (le double clic reste un seul accord).
- `depenserSelonOrigine` (Usine) : deux dépenses simultanées sur la même clé s'additionnent (usage et engagement). La garde NE déduplique PAS : l'idempotence reste aux appelants (un `nouvelId` par dépense).
- Studio (origine « studio » ou absente) : `cleUsine` et `ajouter` ignorés, mêmes lectures, mêmes résultats.
- Tests : `tests/autonomie-usine-cle-depense.test.ts` (vrai `credits.ts`, dépôts en mémoire, 0 €). Mutations vérifiées rouges : engagement « remplace », jugement sans « ajouter ». Aucun test existant modifié, `echecs-connus.json` intact.

Limites connues (hors lot) : une clé `travailId#appel` sans engagement propre ne compte que pendant le délai « en vol » (15 min), puis ce qui est payé sous le travail ; `libererReservation(travailId)` d'une dépense libère l'engagement du travail entier.
Vérifs : lint propre ; tsc 146 (aucune nouvelle) ; suites autonomie-usine, l3-0*, l3-01*, r7, budget-indicatif, garde-fous : seuls les 4 rouges déjà connus de l'audit.

Correctif (relecture Opus) : la clé `travailId#appel` n'a pas d'engagement propre (il est écrit sous `travailId`) ; après 15 min, `usageDeLaCle` la ramenait à ce qui est payé (0) et la part des voix sortait du registre. Désormais, sans engagement propre, une clé `…#…` reste comptée (accord, ou payé s'il est plus haut) TANT QUE l'engagement de son travail est actif. Tests ajoutés : `tests/autonomie-usine-cle-depense-temps.test.ts` (horloge +16 et +60 min : 5 € et 18 € refusées ; forme de la clé aux 4 sites de voix, rouge si clé = travailId). Rouge sans le correctif, rouge sous mutation d'un site.
