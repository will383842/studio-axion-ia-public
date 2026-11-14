# Plan USINE-AUTONOMIE-SOUS-PLAFOND (concepteur, 14/11/2026)

## Résumé (10 lignes)
1. Décision du fondateur (14/11) : l'Usine dépense SANS confirmation, sous UN plafond mensuel qu'il règle lui-même dans Réglages.
2. Aujourd'hui, toute dépense de l'Usine passe par `verifierBudgetEtCredits` (credits.ts:317) ; elle y bute sur `CONFIRMATION_REQUISE` (seuil, l.344-347 ; double réel R7, l.348-353) et sur les budgets (`BUDGET_USINE_ABSENT`…, budget-mensuel.ts:246-273).
3. Nouveau réglage `usine.autonomie` = { actif, plafondCents } ; éteint par défaut ; absent, 0 ou illisible = mode confirmation actuel (échec fermé).
4. Allumé : accord automatique d'origine Usine si (utilisé Usine du mois de Paris + montant demandé) ≤ plafond ; sinon arrêt net `USINE_PLAFOND_ATTEINT`.
5. Le compte « utilisé » se DÉDUIT des données d'argent existantes (engagements, dépenses) : aucune écriture à la clôture, donc aucune mise à jour perdue.
6. L'accord est inscrit SOUS le verrou des crédits (file du processus + verrou consultatif Postgres, qui relit `parametres`) : deux commandes simultanées ne passent jamais ensemble au-dessus du plafond.
7. Le double réel (R7) suit la même règle pour l'Usine ; le Studio et « Reprendre » ne changent pas ; une origine autre que absente/« studio » vaut Usine.
8. Cloche à 80 % (une fois par mois) et au plafond (une fois par jour) ; journal de chaque accord (qui, quoi, combien, reste) ; aucun montant dans la cloche.
9. Cinq lots Sonnet : A (registre, nouveau fichier) → B (écran) ∥ C (garde centrale, après ARG-ORIGINE-USINE) ∥ D (frein image→vidéo) → E (coût réel Claude, facultatif).
10. L'auditeur argent/sécurité final rejoue double clic, course, contournement par un autre point d'entrée, origine falsifiée, changement de mois.

Base : `origin/master` au 69e7097f. La branche `usine/ARG-ORIGINE-USINE` n'existe pas encore sur le dépôt (vérifié par `git ls-remote` le 14/11) : ce plan part de master + son intention annoncée (l'origine « usine » transmise dans la série d'écritures, `fabriquerLesN` / `fabriquerVariante` et `manquesPour`) et ne touche AUCUN de ses fichiers probables (`src/services/fabrication-reseaux.ts`, `src/services/boucle-generation.ts`, `src/services/generateur-ecran.ts`, `src/services/generation-claude.ts`, la fonction `manquesPour` de `src/services/credits.ts`). Le lot C, qui touche `credits.ts`, part APRÈS sa fusion.

Vocabulaire : « bloquant » = régime actuel de l'Usine (non indicatif : seuil de confirmation, R7, budgets de l'Usine). « Mode confirmation » = ce même régime, retrouvé quand l'interrupteur est éteint ou le plafond absent. « Utilisé Usine » = ce que l'Usine a dépensé ou tient réservé ce mois-ci (définition au § 2.3).

---

## 1. État actuel exact (preuves fichier:ligne, master 69e7097f)

### 1.1 Le passage unique de l'argent
- Toute dépense passe par `verifierBudgetEtCredits` (`src/services/credits.ts:317-355`), appelé :
  - sous le verrou des crédits par `verifierEtReserver` (`credits.ts:405-420`, contrôle puis `reserverCredits` puis `engagerBudget`), `reserverLot` (`credits.ts:440-460`, l.446 SANS `travailId`), `reactiverSelonOrigine` (`credits.ts:560-575`, l.570) ;
  - en pré-vol (lecture seule, HORS verrou) par `fabrication-reseaux.ts:674` et `:691` (Fabriquer les N), `cas-concret-branchements.ts:439`, `image-video.ts:318` (Claude, la vraie réservation se fait plus loin dans `executerRolePourVideo`).
- L'origine « usine » est écrite en dur à un seul endroit : `reserverPourUsine` (`credits.ts:518-520`) ; `verifierEtReserverSelonOrigine` (`credits.ts:529-531`) aiguille. Le test structurel `tests/l3-0-garde-origine.test.ts` tient la liste fermée des sites de dépense.
- Verrou : `sousVerrouCredits` (`credits.ts:392-399`) = file en mémoire + `sousVerrouCreditsPartage` (`src/donnees/memoire/index.ts:177`) = `pg_advisory_lock` + relecture des collections d'argent (`src/donnees/postgres/index.ts:97` : `reservations, parametres, depenses, travaux, recharges, relevesSoldes` ; verrou l.186-207).

### 1.2 Comment l'Usine obtient son accord aujourd'hui
- `accordAutomatique` (`src/services/mode-budget.ts:121-136`) rend l'accord INCHANGÉ pour l'Usine, car `budgetIndicatifPour` (`mode-budget.ts:34-36`) vaut `false` pour `origine === "usine"`. Le Studio, lui, reçoit « prix du jour = accord » (décision du 08/11).
- `avecAccordAutomatique` (`mode-budget.ts:143-149`) ne relance donc jamais pour l'Usine.
- Dans `verifierBudgetEtCredits` :
  - l.334 : `confirme = accordAutomatique(...)` → pour l'Usine, l'accord reçu (souvent `false` ou absent) ;
  - l.343 : `seuilIndicatif` exclut l'Usine ;
  - l.344-347 : au-dessus de `budget.seuilConfirmation` (20 € par défaut, `couts.ts:170`) sans accord qui couvre → `CONFIRMATION_REQUISE` ;
  - l.348-353 : **garde R7** : une ligne de double réel (`partDoubleReel`) sans accord → `CONFIRMATION_REQUISE` (« Votre avatar parle… à confirmer »), QUEL QUE SOIT le seuil.
- Preuve par test : `tests/r7-double-heygen.test.ts:389-406` : Studio passe (journal « accepté sans confirmation ») ; Usine avec budget de 10 € : `CONFIRMATION_REQUISE` avec `undefined` et avec `false`.

### 1.3 Où l'Usine se bloque aujourd'hui (budget)
`controlerBudgetDuMois` (`src/services/budget-mensuel.ts:221-276`), appelé en l.336 de credits.ts :
- l.238-245 : plafond du Studio `budget.mensuel` (s'il est réglé) dépassé par le total GLOBAL (dépensé + engagé, studio et Usine confondus) → `BUDGET_DEPASSE` (l'Usine n'est jamais indicative, l.223).
- l.246 : la suite ne concerne que l'Usine.
- l.247-251 : aucun budget reçu de l'Usine pour le mois (`budget.usine.<AAAA-MM>`, écrit par `reglerBudgetUsine` l.101-127 via la porte `src/app/api/usine/reglages/budget/route.ts`) → `BUDGET_USINE_ABSENT`.
- l.252-255 : budget de l'Usine dépassé (comparé au total global) → `BUDGET_MENSUEL_ATTEINT`.
- l.262-266 : aucune borne → `BUDGET_USINE_SANS_BORNE`. l.267-273 : quota de quantité → `QUOTA_USINE_ATTEINT`.

### 1.4 Autres freins propres à l'Usine (hors credits.ts)
- `src/services/image-video.ts:292` + `:301` : voix HeyGen d'une vidéo image→vidéo sans accord de script → refus `PHRASE_ACCORD_ABSENT_IV` si non indicatif (donc toujours pour l'Usine). **Frein de consentement** : à lever sous plafond (lot D).
- `src/services/decors.ts:419`, `:651` : `CONFIRMATION` si non indicatif ; mais `demanderDecor` / la création de looks exigent la session du fondateur (`exigerSession`, l.418) : jamais joignable par l'Usine. **Inchangé** (l'auditeur vérifie l'injoignabilité).
- Plafonds de PRIX réglés par le fondateur, durs pour l'Usine : plafond Claude du mois (`plafond-claude.ts:12-18`, `generation-claude.ts:654-662`), plafond d'un sujet (`generation-claude.ts:645`), plafond par vidéo (`jugerPlafond`, `budget-mensuel.ts:190-197`). Ce ne sont pas des demandes de confirmation mais des plafonds, et ce sont eux qui empêchent le coût réel de dépasser la réservation : **inchangés** (§ 2.9).
- Gardes techniques (nombre d'appels, 1,5 × les secondes annoncées du double `PLAFOND_DEPASSEMENT`, solde réel HeyGen/ElevenLabs, idempotence) : **inchangées**.

### 1.5 Ce qui n'existe pas encore
- Aucun plafond « autonomie » ; aucun écran de budget branché : `definirBudgetAction` (`src/app/(studio)/reglages/actions.ts:71-81`) n'est appelé par aucun composant ; la page `src/app/(studio)/reglages/page.tsx` n'a pas de carte Budget.
- Aujourd'hui aucune commande de l'Usine n'atteint encore une dépense réelle (seuls des créneaux sont créés : `api/usine/commandes/route.ts:77-81`, `porte-programmations.ts:38-49`) ; les premiers chemins payants d'origine Usine arrivent avec ARG-ORIGINE-USINE.
- Le compteur global `resumeBudget` (`couts.ts:168-198`) mélange Studio et Usine et lit `budget.mensuel` avec un défaut d'affichage de 150 € (l.169) : il ne peut pas servir de plafond de l'Usine.

---

## 2. Conception (tranchée)

### 2.1 Le réglage
- Clé `usine.autonomie` dans `parametres` : `{ actif: boolean, plafondCents: number, le: ISO, version: 1 }`.
- Écrit en UN SEUL endroit : `reglerAutonomieUsine({ actif, plafondCents })` dans le nouveau `src/services/autonomie-usine.ts`, qui appelle `exigerSession()` (le fondateur connecté). Jamais par la porte de l'Usine, jamais par un secret.
- Validation : `plafondCents` entier sûr, 0 ≤ p ≤ 10 000 000 (100 000 €, même borne que `definirBudgetAction`) ; `actif: true` exige `plafondCents > 0` (sinon `CHAMP_INVALIDE`, rien n'est écrit). Rejeu identique → rien n'est réécrit.
- Lecture `lireAutonomieUsine()` → `{ etat: "active", plafondCents }` ou `{ etat: "confirmation", raison: "eteint" | "absent" | "zero" | "illisible" }`. Toute forme imprévue (texte, flottant, négatif, `actif` non booléen) = `"confirmation"`. **Aucun défaut chiffré dans le code.**
- Défaut : éteint (règle de fer n° 7 : interrupteur éteint, seul un geste daté du fondateur l'allume ; `le` date ce geste).
- Journal à chaque changement : `journaliser("budget", "Usine en automatique : allumée, plafond <X> € par mois" | "éteinte (retour au mode confirmation)")`.

### 2.2 Normalisation de l'origine
`normaliserOrigine(v: unknown): "studio" | "usine"` dans `autonomie-usine.ts` : `undefined` → `"studio"` (contrat historique : sans origine, la commande du fondateur) ; `"studio"` → `"studio"` ; **toute autre valeur** (`"usine"`, `null`, `""`, `"Usine"`, objet, nombre) → `"usine"`. Appliquée à l'entrée de `verifierBudgetEtCredits` ; `origineDeLaVideo` (`mode-budget.ts:42-51`) garde déjà « illisible = Usine ».

### 2.3 Compter « utilisé Usine » du mois (fiable, sans écriture à la clôture)
Registre, écrit UNIQUEMENT sous le verrou des crédits :
- `usine.autonomie.index.<AAAA-MM>` : liste des clés d'accord du mois (mois de Paris, `moisParis()` de `couts.ts:22-24`).
- `usine.autonomie.accord.<cle>` : `{ cle, mois, centimes, quoi, videoId?, le, n }` (`centimes` = montant accordé au DERNIER accord, au centime supérieur ; `n` = nombre d'accords pour cette clé).

`cle` = `travailId` (fabrication, retouche, format, appel Claude `appel-…`, écoute, look) ou `lot:<id>` (lot d'images). Le statut n'est PAS écrit dans le registre : il se lit dans l'engagement existant `budget.engage.<cle>` (`couts.ts:75-110`), que `libererReservation` (`credits.ts:608-614`) passe à « consommee » / « liberee ». Ainsi aucune clôture n'écrit le registre (une clôture hors verrou ne peut pas écraser une réservation : pas de mise à jour perdue).

Usage d'une clé (`usageDeLaCle`), avec `paye` = somme `montantPaye` des dépenses comptées (`depenseComptee`) dont `travailId === cle` (et `appelId === cle` après le lot E) :
| État de l'engagement `budget.engage.<cle>` | Usage compté |
|---|---|
| clé `lot:` active | `e.centimes` (déjà diminué par `transfererDuLot` / remonté par `rendreAuLot`) |
| clé `lot:` consommée ou libérée | 0 (chaque vidéo du lot a sa propre clé) |
| active | `max(accord.centimes, paye)` |
| consommée | `paye` s'il existe au moins une dépense rattachée, sinon `accord.centimes` (prudence : un appel Claude consommé n'a pas encore de dépense rattachée, voir lot E) |
| libérée (échec, arrêt, refus après inscription) | `paye` |
| absent (engagement jamais écrit) | `accord.centimes` si `accord.le` < 15 min (lancement en vol, même délai que `ORPHELIN_MS`, `couts.ts:84`), sinon `paye` |

`usageDuMoisUsine(mois)` = somme des usages des clés de `index.<mois>` dont `accord.mois === mois` (une clé ré-accordée un autre mois ne compte plus que dans le mois de son dernier accord : jamais deux fois).

Règle d'or : **en cas de doute, on compte le plus haut** (réservé plutôt que réel inconnu).

### 2.4 Décision et réservation atomique
Deux fonctions dans `autonomie-usine.ts` :
- `jugerSousPlafondUsine({ cle?, besoin })` — LECTURE SEULE : `utiliseHors = usageDuMoisUsine(mois) − (cle ? usageDeLaCle(cle) si accord.mois === mois : 0)` ; `apres = utiliseHors + besoinEffectif` où `besoinEffectif = cle existante ? max(besoin, engagementActuel) + paye : besoin` (une reprise recompte ce qui est déjà payé + le reste) ; rend `{ ok: apres ≤ plafond, utilise, apres, plafond, mois }`. **Égalité acceptée** (≤).
- `inscrireAccordUsine({ cle, besoin, quoi, videoId })` — refuse `VERROU_REQUIS` si l'appel n'est pas sous `sousVerrouCredits` (marqueur `AsyncLocalStorage` exporté par `autonomie-usine.ts` : `dansVerrouCredits(f)` ; credits.ts enveloppe `f` avec, lot C). Rejuge (`jugerSousPlafondUsine`) PUIS écrit `accord.<cle>` puis ajoute `cle` à `index.<mois>` (idempotent), puis journalise et sonne (§ 2.6). Le jugement et l'écriture sont dans la même section critique : c'est la réservation atomique.

Intégration dans `verifierBudgetEtCredits` (lot C), pour `normaliserOrigine(options.origine) === "usine"` et `lireAutonomieUsine().etat === "active"` uniquement :
1. `bloquant` calculé comme aujourd'hui (l.324). `cle = options.cleUsine ?? options.travailId`.
2. `jugerSousPlafondUsine({ cle, besoin: bloquant })` ; refus → alerte plafond (§ 2.6) + `throw new ErreurStudio("USINE_PLAFOND_ATTEINT", "Plafond du mois de l'Usine atteint : cette commande le dépasserait, rien n'est parti. Relevez le plafond dans Réglages.")`. Rien n'est réservé.
3. `confirme = max(bloquant, accordReçu s'il est un nombre)` : l'accord automatique couvre le seuil (l.344) ET le double réel R7 (l.350). Le message R7 n'est plus levé pour l'Usine sous plafond.
4. `controlerBudgetDuMois(bloquant, { origine: "usine", travailId, sousPlafondUsine: true })` : le plafond du Studio (s'il est réglé) et le budget/quota que l'Usine s'est donnés restent appliqués (ils ne peuvent que restreindre) ; `BUDGET_USINE_ABSENT` et `BUDGET_USINE_SANS_BORNE` ne refusent plus (le plafond du fondateur EST la borne).
5. `controlerCredits` (l.354) inchangé : solde réel HeyGen/ElevenLabs toujours opposé.
6. EN DERNIER, seulement si `cle` est connue : `inscrireAccordUsine(...)`. Un refus aux étapes 4-5 ne consomme donc rien. Sans `cle` (pré-vol hors verrou) : décision seule, aucune écriture ; la réservation se fera au vrai lancement, sous verrou.
7. Un échec APRÈS l'inscription (dans `verifierEtReserver` : `reserverCredits`/`engagerBudget`) : l'appelant appelle déjà `libererReservation(travailId, "liberee")` ; sinon la règle « engagement absent > 15 min → payé » libère seule.

Origine Usine et interrupteur éteint / plafond absent / 0 / illisible : **code actuel inchangé** (mode confirmation : seuil, R7, budgets de l'Usine). Origine Studio : **inchangé** (aucun appel à `autonomie-usine.ts` hormis `normaliserOrigine`).

`reserverLot` (`credits.ts:446`) passe `cleUsine: "lot:<lotId>"` (et non `travailId`, pour ne pas changer le calcul `propre` de `controlerBudgetDuMois`).

### 2.5 Arrêt net au plafond
- Un seul gros achat qui dépasse le reste : refusé EN ENTIER (jamais de « partiel »).
- Fabriquer les N (pré-vol sur le total, `fabrication-reseaux.ts:691`) : refusé d'un bloc si le total ne tient pas ; si une course fait refuser une vidéo plus loin, les vidéos déjà accordées continuent, les suivantes sont refusées `USINE_PLAFOND_ATTEINT`.
- `USINE_PLAFOND_ATTEINT` n'est PAS une attente de crédit : il ne doit pas entrer dans `lancementEnAttente` (qui n'attrape que `BUDGET_DEPASSE` / `CREDIT_INSUFFISANT`) ; rien ne repart seul au mois suivant : l'Usine recommande (ses commandes sont idempotentes par `cle`).
- Une écriture Claude refusée : `generation-claude.ts:678` traite déjà `BUDGET_USINE_ABSENT`/`BUDGET_MENSUEL_ATTEINT` comme arrêt net `budget-usine` ; `USINE_PLAFOND_ATTEINT` tombera dans `throw e` → échec propre « rien n'est payé ». Ajouter le code à cette liste relève du fichier de ARG-ORIGINE-USINE : à faire dans le lot E (après sa fusion).
- Plafond baissé sous l'utilisé, ou interrupteur éteint en cours de mois : les travaux déjà accordés vont au bout (ils ont leur accord) ; tout NOUVEL accord suit la nouvelle règle.

### 2.6 Alertes (cloche) et journal
- Journal de CHAQUE accord automatique : `journaliser("budget", "Accord automatique de l'Usine (sous plafond) : <quoi> — <montant> ; utilisé <X> sur <plafond> ce mois, reste <R>.", { type: "video", id: videoId } | { type: "travail", id: cle })`. Qui = « l'Usine (accord automatique sous plafond) ». Le journal est en base, jamais dans le dépôt.
- Journal de chaque refus `USINE_PLAFOND_ATTEINT` avec les mêmes chiffres.
- Cloche 80 % : quand `apres ≥ 80 % du plafond`, une fois par mois (`usine.autonomie.alerte80.<mois>`, marque posée APRÈS l'envoi réussi, comme `couts.ts:348-356`) : type `budget`, titre « Usine : 80 % du plafond du mois utilisé », message « Elle s'arrêtera net au plafond. Réglages pour le relever. », lien `/reglages#usine-automatique`.
- Cloche plafond : au premier refus du jour (`budget.refus.<jour>.usine-plafond`, même mécanique que `alerterUneFoisParJour`, budget-mensuel.ts:200-211) : « Usine arrêtée : plafond du mois atteint » / « Rien n'est parti. Réglages pour relever le plafond. »
- **Aucun montant dans la cloche** (règle de fer « aucun prix affiché ») ; les montants sont dans le journal et dans la carte Réglages, où le fondateur règle lui-même le plafond (décision du 14/11, plus récente, qui demande « combien, solde restant »).
- Une panne d'alerte ne change jamais la décision (try/catch, comme l'existant).

### 2.7 Écran Réglages
Carte « L'Usine en automatique » (ancre `usine-automatique`) dans la rubrique « Services reliés » de `src/app/(studio)/reglages/page.tsx` :
- interrupteur (éteint par défaut) ; champ « Plafond du mois (€) » ; bouton Enregistrer ; refus clair si interrupteur allumé avec 0 €.
- état du mois : « Utilisé : X € sur Y € (Z %) · mois de novembre (heure de Paris) » ; si éteint : « Éteinte : chaque dépense de l'Usine demande votre confirmation. »
- phrase fixe : « Au plafond, l'Usine s'arrête net. Vos fabrications dans le Studio ne sont pas concernées. »
- Action serveur `reglerAutonomieUsineAction(actif, plafondEuros)` (`exigerSession`, euros → centimes `Math.round(x*100)`, borne 0-100 000 €), `revalidatePath("/reglages")`.

### 2.8 Ce qui ne change pas
Studio (prix du jour = accord) ; « Reprendre » une écriture (code de `repriseDeWill` / `automatique` intact — une écriture d'origine Usine reprise reste d'origine Usine et passe donc sous le plafond, sans nouveau clic) ; `mode-budget.ts` (logique intacte : `budgetIndicatifPour` reste `false` pour l'Usine, les plafonds de prix restent durs ; seul son docblock est mis à jour) ; la porte de l'Usine et `reglerBudgetUsine` ; les quotas ; les soldes réels ; les gardes anti-boucle.

### 2.9 Pourquoi les plafonds de prix restent durs pour l'Usine
Le plafond mensuel ne tient que si le réel ne dépasse pas ce qui est réservé. Les plafonds par sujet, par vidéo, Claude du mois et le 1,5 × du double sont précisément ce qui borne le réel. Ce sont des plafonds réglés par le fondateur, pas des demandes de confirmation : « le plafond est le seul frein » vise les confirmations. Ils restent donc durs.

---

## 3. Cas limites et risques (tranchés)

| Cas | Règle |
|---|---|
| Mois qui change | Mois = mois de Paris au moment de l'accord (`moisParis()` sous verrou). Un travail accordé le 31 à 23 h 59 compte en entier sur ce mois, même payé le 1er. Une reprise le mois suivant ré-accorde la clé sur le nouveau mois et la sort de l'ancien (`accord.mois`). Deux plafonds pleins à deux minutes d'écart (fin/début de mois) : accepté, c'est un plafond MENSUEL. |
| Fuseau | Toujours `cleJour`/`moisParis` (Paris) ; jamais `toISOString().slice(0,7)`. Test à 23 h 30 UTC le dernier jour du mois (déjà le mois suivant à Paris). |
| Annulation / échec / « Arrêter » | `libererReservation(…, "liberee")` → l'usage retombe au payé : la place revient seule, sans écriture du registre. |
| Remboursement d'un fournisseur | Non déduit (aucune donnée fiable) : prudence, le payé reste compté. |
| Reprise après échec (`reactiverSelonOrigine`) | Même clé : `utiliseHors` exclut l'usage actuel de la clé, `besoinEffectif = payé + max(restant, engagement réactivé − payé)`. Pas de double compte. |
| Double clic / rejeu même `travailId` | Même clé : usage remplacé, jamais additionné ; `reserverCredits` et `index` idempotents. |
| Deux lancements différents (deux `travailId`) | Deux accords : légitime ; l'idempotence en amont est celle des commandes (`cle` de la porte). |
| Course entre commandes simultanées | Jugement + écriture dans `sousVerrouCredits` ; multi-processus : verrou consultatif Postgres + relecture de `parametres` avant `f`. |
| Appel hors verrou qui voudrait écrire | `inscrireAccordUsine` lève `VERROU_REQUIS` (échec fermé). |
| Montant estimé vs réel | Réservé = pire cas (`centimesBloquants`, au centime supérieur). Réel supérieur : compté dès qu'une dépense est rattachée (`max`), borné par les plafonds de prix (§ 2.9). Dépassement résiduel possible du plafond = dépassement des travaux en vol, jamais un nouvel accord. |
| Appel Claude consommé sans dépense rattachée | Compté au montant accordé (prudent) jusqu'au lot E. |
| Lot d'images | Clé `lot:<id>` = reste du lot ; chaque vidéo a sa clé ; transfert = baisse de l'engagement du lot : jamais deux fois. |
| Engagement à 0 € (lignes simulées) | `engagerBudget` n'écrit rien : usage = payé (0). |
| Plafond illisible pendant un mois actif | Retour au mode confirmation (jamais « sans plafond »). |
| Montant demandé NaN | `BUDGET_ILLISIBLE` comme aujourd'hui (budget-mensuel.ts:233), avant tout. |
| Interrupteur éteint en cours de mois | Les accords passés restent dans le registre ; rallumé, le compte du mois reprend où il en était. |
| Taille du registre | Une clé par paiement d'origine Usine (quelques centaines par mois) : acceptable ; `index` par mois, jamais purgé (rien n'est supprimé, on archive). |

---

## 4. Découpage en lots (auteurs Sonnet)

Règles communes : une fiche = une branche `usine/AUT-<x>` = une PR ; test rouge d'abord ; dépôts en mémoire, aucun réseau, 0 € ; journal `pilotage/journal/AUT-<x>.md` (10 lignes) ; mutations rejouées et notées dans le journal (garde retirée → rouge, restaurée → vert).

### Lot AUT-A — Registre et réglage (aucune dépendance ; lançable maintenant)
Fichiers (NOUVEAUX uniquement) :
- `src/services/autonomie-usine.ts` : `lireAutonomieUsine`, `reglerAutonomieUsine`, `normaliserOrigine`, `dansVerrouCredits` / `estDansVerrouCredits` (AsyncLocalStorage), `usageDeLaCle`, `usageDuMoisUsine`, `jugerSousPlafondUsine`, `inscrireAccordUsine`, `alerterPlafondUsine` (80 % mensuel + plafond journalier), `accordSansClicPour(origine, videoId?)` (indicatif OU origine Usine avec autonomie allumée ; utilisée par le lot D), `vueAutonomieUsine()` (pour l'écran : état, plafond, utilisé, pourcentage, mois).
- `tests/autonomie-usine-registre.test.ts` :
  - réglage : éteint par défaut ; allumé avec 0 → `CHAMP_INVALIDE` ; illisible (texte, -1, 1.5, `actif: "oui"`) → `confirmation` ; sans session → refus ;
  - origine : `undefined`/`"studio"` → studio ; `null`, `""`, `"Usine"`, `{}` → usine ;
  - usage : chaque ligne du tableau § 2.3 (active, consommée avec/sans dépense, libérée, absent < / > 15 min, `lot:`) ;
  - jugement : égalité au plafond acceptée ; +1 centime refusé ; ré-accord de la même clé non additionné ; changement de mois (horloge simulée 23 h 30 UTC le 30/11 = décembre à Paris) ;
  - `inscrireAccordUsine` hors `dansVerrouCredits` → `VERROU_REQUIS` ;
  - journal : accord journalisé avec reste ; cloche 80 % une seule fois par mois, cloche plafond une fois par jour, sans montant dans le texte de la cloche ; panne de notification → décision inchangée.
- `tests/autonomie-usine-structure.test.ts` : la chaîne `usine.autonomie` n'est écrite (`ecrireParametre`) que dans `autonomie-usine.ts` ; `reglerAutonomieUsine` n'est importé par aucun fichier de `src/app/api/**` ni de `src/usine/**` ; `reglerAutonomieUsine` appelle `exigerSession`.
Mutations : `≤` → `<` ; retirer le `− usage de la clé` (double compte) ; « consommée sans dépense » → 0 ; « absent » → 0 ; `normaliserOrigine(null)` → studio ; retirer la garde `VERROU_REQUIS` ; poser la marque 80 % avant l'envoi.

### Lot AUT-B — Écran Réglages (après fusion de A ; parallèle à C et D)
Fichiers :
- `src/app/(studio)/reglages/actions-autonomie-usine.ts` (nouveau) ;
- `src/components/reglages/AutonomieUsine.tsx` (nouveau) ;
- `src/app/(studio)/reglages/page.tsx` (ajout d'une `CartePliante` dans « Services reliés », lecture `vueAutonomieUsine()`).
Tests : `tests/autonomie-usine-ecran.test.ts` : action sans session refusée ; 0-100 000 € ; allumer avec 0 € refusé avec phrase claire ; rendu (état éteint / allumé, pourcentage, mois de Paris) ; aucune autre action de Réglages ne touche `usine.autonomie`.
Mutations : retirer `exigerSession` de l'action ; accepter 0 € allumé ; arrondi `Math.floor` au lieu de `Math.round`.

### Lot AUT-C — Garde centrale (après A ET après fusion de ARG-ORIGINE-USINE ; parallèle à B et D)
Fichiers :
- `src/services/credits.ts` : `sousVerrouCredits` enveloppe `f` dans `dansVerrouCredits` ; `verifierBudgetEtCredits` (options `cleUsine?`, normalisation de l'origine, branche § 2.4 étapes 1-6) ; `reserverLot` passe `cleUsine: travailDuLot(lotId)` ; docblocks de `reserverPourUsine` / `verifierBudgetEtCredits`. **Ne pas toucher `manquesPour`** (fiche ARG-ORIGINE-USINE).
- `src/services/budget-mensuel.ts` : option `sousPlafondUsine` de `controlerBudgetDuMois` (saute `BUDGET_USINE_ABSENT` et `BUDGET_USINE_SANS_BORNE`, garde plafond du Studio, budget et quotas de l'Usine).
- `src/services/mode-budget.ts` : docblock seulement (« l'Usine : accord automatique sous plafond si `usine.autonomie` est allumée ; sinon bloquante »).
- `tests/r7-double-heygen.test.ts` : cas l.389-406 réécrit en trois : (a) interrupteur éteint → Usine `CONFIRMATION_REQUISE` (inchangé) ; (b) allumé, plafond 10 € → double réel à 1,50 € accordé, journal « Accord automatique de l'Usine », registre inscrit ; (c) allumé, plafond 1 € → `USINE_PLAFOND_ATTEINT`, aucune réservation, aucun POST HeyGen. Studio inchangé.
- `tests/autonomie-usine-garde.test.ts` (nouveau) : seuil franchi sous plafond → passe sans accord ; Studio ne lit jamais le registre ; pré-vol sans clé → rien n'est écrit ; `CREDIT_INSUFFISANT` après jugement → registre vide ; `BUDGET_DEPASSE` du plafond Studio toujours opposé ; budget de l'Usine plus bas que le plafond → `BUDGET_MENSUEL_ATTEINT` ; budget de l'Usine absent + plafond allumé → passe ; quota atteint → `QUOTA_USINE_ATTEINT` ; origine `null` traitée Usine ; reprise (`reactiverSelonOrigine`) sans double compte ; lot : `reserverLot` + `transfererDuLot` + lancement de la vidéo = pas de double compte ; échec puis `libererReservation` → place rendue.
- `tests/autonomie-usine-course.test.ts` (nouveau) : `Promise.all` de deux `reserverPourUsine` à 60 % du plafond → exactement un passe ; dix lancements de 15 % → six passent au plus (≤ 100 %) ; même `travailId` deux fois → un seul accord compté.
- Vérifier que `tests/l3-0-garde-origine.test.ts`, `tests/l1-09-budget-mensuel.test.ts`, `tests/new-arg-04-mode-budget.test.ts`, `tests/porte-usine-garde-budget.test.ts`, `tests/r7-origine-illisible.test.ts` restent verts sans modification (interrupteur éteint par défaut).
Mutations : supprimer la branche autonomie (b rouge) ; inscrire AVANT `controlerCredits` (test crédit insuffisant rouge) ; retirer l'enveloppe `dansVerrouCredits` (`VERROU_REQUIS` partout → rouge) ; ne pas exclure `sousPlafondUsine` du refus `BUDGET_USINE_ABSENT` ; `confirme` laissé à l'accord reçu (R7 rouge) ; normalisation retirée (`null` → studio, rouge) ; `reserverLot` sans `cleUsine` (rouge : pas d'inscription du lot).

### Lot AUT-D — Frein image→vidéo (après A ; parallèle à B et C)
Fichiers : `src/services/image-video.ts` (l.292-301 : l'accord absent ne refuse plus si `accordSansClicPour(dep.origine)` — nouvelle fonction de A : indicatif OU (origine Usine ET autonomie allumée) ; la réservation qui suit, `verifierEtReserverSelonOrigine`, applique le plafond).
Tests : `tests/autonomie-usine-image-video.test.ts` : Usine, autonomie éteinte → `PHRASE_ACCORD_ABSENT_IV` (inchangé) ; allumée sous plafond → réservée et journalisée ; au plafond → refus ; Studio inchangé.
Mutation : remplacer `accordSansClicPour` par `budgetIndicatifPourVideo` (rouge).
NB : `accordSansClicPour` est livrée par le lot A : aucun fichier partagé entre B, C et D.

### Lot AUT-E — Coût réel des appels Claude et arrêt net de l'écriture (facultatif ; après A, C et ARG-ORIGINE-USINE)
Fichiers : `src/domaine/types.ts` (`DepenseEnregistree.appelId?: Id`, champ neutre : ne change pas `depenseComptee`) ; `src/services/generation-claude.ts:724` et `src/services/depense-claude-video.ts:230`, `:373` (remplir `appelId`) ; `generation-claude.ts:678` (ajouter `USINE_PLAFOND_ATTEINT` à l'arrêt net `budget-usine`) ; `src/services/autonomie-usine.ts` (`paye` lit aussi `appelId`).
Tests : `tests/autonomie-usine-claude.test.ts` : appel consommé compté au réel (et non plus au réservé) ; écriture d'origine Usine au plafond → arrêt net « budget-usine », rien n'est payé, la génération n'attend pas.
Mutation : ne pas lire `appelId` (rouge : compté au réservé).

### Ordre des PR
1. **AUT-A** (maintenant).
2. En parallèle après A : **AUT-B** (Réglages), **AUT-D** (image-video) ; **AUT-C** dès que ARG-ORIGINE-USINE est fusionnée (credits.ts). B, C, D n'ont aucun fichier commun.
3. **AUT-E** en dernier (touche `autonomie-usine.ts` de A et des fichiers de ARG-ORIGINE-USINE).
L'interrupteur reste éteint à chaque fusion : aucune PR ne change le comportement réel tant que le fondateur ne l'allume pas.

---

## 5. Ce que l'auditeur argent/sécurité final doit vérifier
1. **Double clic** : deux appels identiques (même `travailId`) → un seul accord compté ; deux clics créant deux travaux → deux accords, chacun jugé contre le plafond.
2. **Course** : N lancements simultanés (même processus ET deux processus sur Postgres) ne dépassent jamais le plafond ; le jugement et l'écriture du registre sont dans la même section `sousVerrouCredits` ; `parametres` est bien dans `COLLECTIONS_ARGENT` (relu sous verrou).
3. **Écriture hors verrou** : aucun chemin n'écrit `usine.autonomie.*` hors `inscrireAccordUsine` / `reglerAutonomieUsine` ; `libererReservation` n'écrit jamais le registre.
4. **Contournement par un autre point d'entrée** : relancer la liste fermée de `l3-0-garde-origine` ; chaque site « pré-vol » est suivi d'une réservation sous verrou avec la même origine ; aucun chemin d'origine Usine ne paie sans passer par `verifierEtReserver` / `reserverLot` / `reactiverSelonOrigine` ; `lancerVideosEnAttente` (relance de fond) garde l'origine ; un travail d'origine Usine repris par le fondateur reste Usine.
5. **Origine falsifiée** : la porte (`src/app/api/usine/**`, secret seulement) ne peut ni écrire `origine: "studio"`, ni appeler `reglerAutonomieUsine`, ni toucher `usine.autonomie` ; les actions serveur qui reçoivent une origine exigent la session du fondateur ; une origine inattendue (`null`, casse, objet) vaut Usine ; `origineDeLaVideo` illisible vaut Usine.
6. **Plafond contourné par le réglage** : `budget.usine.<mois>` envoyé par l'Usine ne relève jamais le plafond du fondateur (il ne peut que restreindre) ; le plafond illisible/0/absent = mode confirmation, jamais « sans limite » ; aucun défaut chiffré dans le code.
7. **R7** : le double réel d'origine Usine ne part QUE sous plafond allumé ou avec confirmation ; le 1,5 × des secondes et le solde réel HeyGen tiennent toujours.
8. **Mois et fuseau** : accord à 23 h 30 UTC le dernier jour du mois rangé au mois suivant (Paris) ; reprise à cheval sur deux mois non comptée deux fois.
9. **Estimé vs réel** : un réel supérieur au réservé est compté dès sa dépense ; les plafonds de prix (sujet, vidéo, Claude du mois) restent durs pour l'Usine.
10. **Libération** : échec, arrêt, refus après inscription rendent la place ; un lancement interrompu (engagement absent) ne bloque plus après 15 min, mais ce qui a été payé reste compté.
11. **Alertes** : cloche 80 % une fois par mois, plafond une fois par jour, sans montant ; panne d'alerte sans effet sur la décision ; chaque accord automatique est au journal avec quoi, combien, reste.
12. **Studio et « Reprendre »** : aucun comportement modifié (tests budget-indicatif-* et r7 Studio verts, sans modification).
