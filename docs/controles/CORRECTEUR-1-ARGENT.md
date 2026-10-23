# CORRECTEUR 1 — Argent

- Branche : `outils/garde-argent`, partie de `origin/master` @ `d186500` (version EN LIGNE).
- Date : 03/10/2026.
- Source : `docs/controles/AUDIT-D-PRODUCTION.md` (branche `controles/audit-d-production`), bloquants B1 à B7 et B11,
  plus la fragilité « Écriture Claude coupée après l'envoi » (`generation-claude.ts:452`).
- Règles tenues :
  - aucun appel réseau réel, aucune clé (faux `fetch`, faux clients, faux lecteurs de solde) ;
  - textes écran simples (`tests/garde-ecran.test.ts` vert) ;
  - rien n'est effacé des données (statuts qui changent, lots gardés sous leur clé).
- Chaque correction a son test, qui ROUGIT sur `d186500` (preuve plus bas).

---

## 1. Corrections, point par point

### B1 — Retouche d'une vraie vidéo avocat : jamais une démo livrée comme réelle

- Commit `e8afbc5`. Test : `tests/c1-argent-b1-retouche-avocat.test.ts`.
- Le moteur avocat déclare `retoucheParPlan: false` : la retouche d'un passage n'existe pas encore pour lui.
- `lancerRetouche` la refuse AVANT toute réservation, avec le code `RETOUCHE_INDISPONIBLE` et la phrase :
  « La retouche d'un passage n'est pas encore disponible pour cette vidéo. Votre vidéo reste telle quelle. »
  - Aucune version créée, aucun travail, aucune réservation.
  - Les vidéos d'exemple gardent la retouche d'essai.
- Filet pour une ancienne retouche déjà partie (lancée avant la correction) :
  - si elle rend une vidéo `/demo/…` sur une vraie vidéo, `appliquerResultat` ne range rien ;
  - la version choisie reste celle d'avant, la vidéo reste « prête » ;
  - la nouvelle version et la retouche passent « échec », la réservation est libérée ;
  - Will reçoit « Retouche pas encore disponible », jamais « Votre vidéo est prête ».
- « Réessayer » une telle retouche est refusé avec la même phrase.

### B2 — Voix HeyGen jamais payée deux fois

- Commit `fc416e3`. Test : `tests/c1-argent-b2-voix-heygen.test.ts`.
- Fournisseur HeyGen (`fournisseurs/heygen/voix.ts`) :
  - en fabrication, la copie du son vers le stockage est DIFFÉRÉE (`copieDifferee`) ;
  - le son payé est rendu tout de suite avec `copieEnAttente: { adresse (audio_url), idDemande (request_id) }` ;
  - nouvelle méthode `copierSon` : range le son déjà payé, ne relit rien ;
  - hors fabrication (écoute), une copie ratée ne fait plus perdre le son payé (il est rendu, à copier plus tard).
- Moteur avocat : nouvelle phase de voix `a-copier`.
  - La voix lue est gardée dans `Travail.parametres.voix` dès la réponse (adresse et identifiant de la demande).
  - La copie se fait au tour suivant ; une copie ratée lève une panne passagère et le tour d'après refait la COPIE,
    jamais la lecture.
  - La maquette garde aussi l'information (`VoixBrutePayee.copieEnAttente`) et reprend la copie.
- `ecrireAvancement` (`services/travaux.ts`) :
  - si seuls l'horodatage, la reprise programmée ou « passer devant » ont bougé pendant le tour (cas
    `apresRecharge`), le résultat du tour est ÉCRIT au lieu d'être jeté (sinon la voix était relue, donc repayée) ;
  - si le travail a vraiment changé (arrêté, relancé), rien n'est réécrit, mais ce que le tour a payé est enregistré
    en dépense (jamais deux fois, `lignesRestantes`).
- Non traité ici : la relecture « probable » au redémarrage (`boucle.ts:105-120`) quand la réponse HeyGen n'est
  jamais arrivée. Sans réponse, le studio n'a ni adresse ni identifiant à garder ; la dépense probable reste enregistrée
  comme avant.

### B3 — fal.ai : pas de resoumission aveugle, plafond calculé en base

- Commit `3ab23f3`. Test : `tests/c1-argent-b3-fal.test.ts`.
- `fournisseurs/illustration/fal.ts` : une coupure, un délai dépassé, une réponse 5xx ou illisible APRÈS l'envoi du
  `POST queue.fal.run` lève une erreur marquée `soumissionIncertaine` (fal a pu mettre la demande en file). Un refus
  net (401, 402, 422) ne l'est pas.
- Moteur (`fabrication-illustrations.ts`) : une soumission incertaine n'est JAMAIS resoumise.
  - fal.ai ne permet pas de retrouver une demande par notre clé (aucune recherche dans son API de file) :
    la « vérification » ne peut pas aboutir ;
  - le plan garde donc le double (« fal.ai n'a pas confirmé la demande : votre double garde ce plan. ») ;
  - son prix est compté comme payé (`incertaine` dans l'état, repris par `coutReelCentimes` et la dépense).
  - Les autres pannes (avant l'envoi, réponse sans demande) gardent leurs 3 essais.
- Plafond `FAL_PLAFOND_USD` : il se compare désormais à la dépense fal.ai lue EN BASE.
  - `services/illustrations.ts` › `depenseFalEnBase()` : dépenses fal du mois de Paris, plus ce que les travaux en
    cours ont engagé et pas encore enregistré (illustrations faites, demandes soumises, soumissions incertaines).
  - Il tient après un redémarrage. Le plafond devient un plafond par mois (avant : par processus).

### B4 — Décors : une photo payée n'est plus abandonnée puis repayée

- Commit `131ebca`. Test : `tests/c1-argent-b4-decors.test.ts`.
- `demanderDecor` (`services/decors.ts`) travaille avec un LOT gardé en base (`decors.lot.<id>`, index `decors.lots`) :
  - chaque demande garde son `idDemande` dès la soumission ;
  - la dépense est comptée DÈS la soumission (une soumission incertaine compte aussi) ;
  - le suivi est borné (180 s) ; ce qui n'est pas arrivé reste « soumise » dans le lot ;
  - Will lit : « Les photos sont encore en préparation. Rouvrez « Mes décors » dans un instant : elles arriveront
    sans nouveau paiement. »
- Reprise sans repayer (`reprendreLotsDecors`) : appelée par l'écran « Mes décors » et avant toute nouvelle demande.
  La même phrase redemandée pendant qu'un lot attend reprend ce lot, aucune nouvelle demande payante.
- Contrôle du budget : `verifierEtReserver` (budget, crédits, réservation sous le verrou des crédits). Deux demandes
  simultanées ne passent plus sur le même restant. La réservation est libérée dès que la dépense est comptée.
- Un lot fini reste lisible sous sa clé (rien n'est effacé).

### B5 — « Réessayer » revérifie budget et crédits sur le coût restant

- Commit `b78eb57`. Test : `tests/c1-argent-b5-reessayer.test.ts`.
- `reessayerTravail` calcule le coût RESTANT : estimation du moteur selon le type (fabrication, retouche, format
  ajouté) moins les dépenses déjà enregistrées pour ce travail. Une ligne à 0 € (voix HeyGen comptée en caractères)
  reste due tant que son étape n'est pas terminée.
- Puis `verifierBudgetEtCredits` : `BUDGET_DEPASSE`, `CONFIRMATION_REQUISE` au-delà du seuil, `CREDIT_INSUFFISANT`.
  - Rien n'est réactivé en cas de refus.
  - Le prix du double, confirmé au lancement, n'est pas redemandé (`doubleDejaConfirme`).
- La confirmation vient de l'écran : `reessayerTravailAction(id, confirme)`, avec une fenêtre de confirmation sur
  `CONFIRMATION_REQUISE` (accueil, fiche vidéo, assistant).
- Un travail relancé ailleurs entre le contrôle et l'écriture est refusé (« Ce travail a changé… »).

### B6 — Plus aucune confirmation de dépense écrite en dur

- Commit `58fb750`. Test : `tests/c1-argent-b6-confirmation.test.ts`.
- « Fabriquer les N » : l'écran envoie le TOTAL affiché sur la feuille (`totalConfirme`, en centimes, lot compris).
  - Le serveur refuse `CONFIRMATION_REQUISE` au-delà du seuil (20 € par défaut) si ce total manque ou s'il est plus
    bas que le prix du jour.
  - La mère, les versions complètes et les versions qui suivent leur mère partent avec CET accord. Il est gardé sur
    la déclinaison (`prixConfirme`) ; une ancienne déclinaison est tenue pour confirmée si `moteurConfirme` est posé
    (il ne l'était qu'après la feuille).
- Reçoivent la confirmation de l'écran (fenêtre de confirmation sur `CONFIRMATION_REQUISE`) :
  - « Fabriquer cette version » ;
  - « 2e ouverture » ;
  - « Fabriquer en entier » ;
  - « Monter ma prise » ;
  - la maquette.
- Décors et écoutes : la confirmation vient du bouton qui affiche le prix.
- Les appels Claude (bornés par leurs propres plafonds) ne sont jamais confirmés d'office : au-delà du seuil, ils
  seraient refusés.
- L'option « préparer ou lancer » de `fabriquerLesN`, `fabriquerVariante` et `fabriquerSecondeOuverture` s'appelle
  désormais `lancer` : elle ne se confond plus avec une confirmation de prix.
- Garde : le test échoue s'il trouve un `confirme: true` ou un `verifierBudgetEtCredits(…, true, …)` dans `src`.
- Deux anciens tests appelaient « Fabriquer les N » sans total. Ils envoient désormais le total, comme l'écran :
  - `e2e2-argent-fabriquer-n` ;
  - `e2e1-moteur-02`.

### B7 — Veille : un résumé à règles fixes n'est plus présenté comme venant de Claude

- Commits `d679d8a` et `fe4e4b5`. Test : `tests/c1-argent-b7-veille-resume.test.ts`.
- Option 2 de l'audit : `creerFournisseurScriptClaude` n'hérite plus de `resumerNouveaute` simulé sous l'étiquette
  « réel ». Aucune dépense nouvelle : implémenter le résumé par Claude reste à faire.
- `resumerAvec` / `resumerParDefaut` (`services/veille.ts`) marquent `simule` ; chaque nouveauté porte `simule`
  (absent sur les anciennes : elles l'étaient aussi).
- Écran : « Résumés simplifiés, faits par le studio (pas par Claude). Une lecture par jour. » ; dans le détail d'une
  nouveauté : « Résumé simplifié, fait par le studio (pas par Claude). »
- Le test G0 qui exigeait l'héritage de toutes les méthodes simulées est ajusté pour ce seul cas.

### B11 — En production, aucune fabrication payante avec un maillon en essai

- Commit `6339857`. Test : `tests/c1-argent-b11-simulation-production.test.ts`.
- `refusSimulationEnProduction` (`services/fabrication.ts`) s'applique au lancement, à la retouche et au format
  ajouté, AVANT toute réservation. En `NODE_ENV=production`, si l'estimation paie un vrai fournisseur et qu'un maillon
  nécessaire est encore en essai, la fabrication est refusée. Maillons vérifiés :
  - le montage : moteur d'essai, ou moteur avocat sans `STUDIO_RENDU_URL` ;
  - le stockage ;
  - la voix ;
  - le double ;
  - les illustrations payantes.
- Code `SIMULATION_EN_PRODUCTION`, phrase : « Cette vidéo ne peut pas partir : le montage de la vidéo est encore en
  essai. Rien n'a été payé. Reliez cet outil dans Réglages > Connexions. »
- Hors production, rien ne change (essais) ; un essai entièrement simulé n'est pas bloqué.
- Non fait : la liste des fournisseurs en simulation au démarrage et dans `/api/sante` (hors du périmètre argent).

### Écriture Claude coupée après l'envoi (`generation-claude.ts:452`)

- Commit `d2a8b3f`. Test : `tests/c1-argent-claude-coupure.test.ts`.
- Même règle que `depense-claude-video.ts` :
  - un refus net de l'API (facturation, modèle introuvable, clé refusée, surcharge, requête, illisible) rend la
    réservation ;
  - une coupure réseau ou un délai APRÈS l'envoi la garde comptée, car l'appel a pu être facturé.

---

## 2. Preuve rouge (avant correction)

Les 9 fichiers de test ont été copiés dans une copie de travail de `d186500` (version en ligne, sans aucune
correction), puis lancés : **29 tests rouges sur 33**.

Les 4 verts sur `d186500` sont des garde-fous de non-régression, qui doivent rester verts :
- B5 : « seul le coût RESTANT compte » ;
- B11 : « hors production » ;
- B11 : « rien de payé » ;
- Claude : « refus net ».

| Point | Test(s) rouge(s) sur `d186500` | Échec constaté |
|---|---|---|
| B1 | refus avant tout paiement ; démo jamais choisie | la retouche part (`{ retoucheId, travailId }`) ; `versionChoisieId` devient la version de démo |
| B2 | 5 tests (copie en panne, copie différée, copie refaite, reprise seule, arrêté) | `Error: coupure` (voix perdue) ; copie jamais refaite ; avancement jeté (`ecrit: false`) ; aucune dépense |
| B3 | 4 tests | `soumissionIncertaine` absent ; 3 soumissions au lieu d'une ; plafond ignoré (`{ idDemande }`) |
| B4 | 3 tests | « Aucune photo n'a pu être fabriquée » (photos payées perdues) ; aucune reprise ; 2 demandes passent sur le même restant |
| B5 | budget, crédit, seuil | la relance repart (statut `en_cours`) |
| B6 | 5 tests | « Fabriquer les N » et la version partent sans total confirmé ; la garde trouve 9 confirmations en dur |
| B7 | 4 tests | `resumerNouveaute` hérité ; `resumerAvec` absent ; « tant que Claude n'est pas relié » à l'écran |
| B11 | 2 tests | la fabrication part (`{ travailId, versionId }`) |
| Claude coupé | coupure réseau | réservation `liberee` au lieu de rester comptée |

Chaque test a aussi été vu rouge pendant le travail, avant d'écrire sa correction.

---

## 3. Contrôles (après correction, sur la branche)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | 0 erreur |
| `npx tsc --noEmit` (`studio-rendu`) | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (complet) | 2448 verts, 0 rouge (voir ci-dessous) |
| `npx next build --webpack` | construit sans erreur |

`npx vitest run` complet sur la branche :
- **185 fichiers verts, 1 sauté ; 2448 tests verts, 2 sautés, 0 rouge** ;
- au départ (`d186500`) : 176 fichiers, 2415 tests, tous verts ;
- les 33 tests en plus sont ceux de ce correcteur.

---

## 4. À savoir

- fal.ai ne permet pas de retrouver une demande par notre clé. Une soumission incertaine fait garder le double à ce
  plan, et son prix est compté. Un fal.ai qui répond souvent en 5xx coûtera donc des plans « double » plutôt que des
  paiements en double ; c'est voulu.
- `FAL_PLAFOND_USD` devient un plafond PAR MOIS, calculé en base.
- Le résumé de la veille par Claude n'est pas écrit (option 2 de l'audit). Il pourra passer par `executerRoleFacture`
  avec un rôle dédié ; l'écran dit aujourd'hui la vérité.
