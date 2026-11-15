# Audit argent et sécurité — Usine autonome sous plafond (lots AUT-A à AUT-F)

**VERDICT FINAL : À CORRIGER — ne pas allumer `usine.autonomie`, même après inscription du plafond, avant le lot AUT-G.**

Base auditée : origin/master `98af97a5` (AUT-D, PR 559). Lecture seule ; seul ce fichier est écrit. Sondes jetables non poussées
(vrais appels à `src/services/credits.ts`, dépôts en mémoire, aucun réseau, 0 €).

## Corrections, par gravité

1. **HAUTE — FAILLE 1 : le plafond est dépassable.** Une 2e réservation sur le même `travailId` (lecture de voix après le lancement)
   écrase l'engagement (`src/services/couts.ts:94-95`) puis l'usage du registre (`src/services/autonomie-usine.ts:204`, `:229`).
   Sonde : 15 € lancés + 2 lectures de voix à 2 € → usage affiché 2 € ; une autre commande de 18 € passe → **37 € engagés pour 20 €**.
   Sites : `image-video.ts:322`, `tableau-branchements.ts:128`, `cas-concret-branchements.ts:686`, `tutoriel-branchements.ts:41`.
2. **MOYENNE — sentinelle aveuglée** : la liste fermée des sites de dépense (`tests/l3-0-garde-origine.test.ts`, cas 3) est rouge et
   tolérée par `scripts/echecs-connus.json` : un futur site non gardé ne ferait plus rougir la CI. Même cause, non tolérée :
   `tests/l3-0-relecture-argent.test.ts` « le littéral « usine » comme origine… » est rouge sur master (absente d'echecs-connus).
3. **MOYENNE (en sommeil)** — `src/services/depense-claude-video.ts:290` : en `quotaSeul`, l'origine est forcée à « studio » ; une
   origine Usine passant par `executerRolePourContenu` (`depense-claude-contenu.ts:82`) sauterait le plafond. Aucun appelant
   aujourd'hui (vérifié) ; à verrouiller avant tout branchement.
4. **FAIBLE** — `depense-claude-video.ts:342` et `comite-editorial.ts:257` n'attrapent pas `USINE_PLAFOND_ATTEINT` (relancé en
   erreur au lieu de l'arrêt propre « budget-usine ») : rien n'est payé (échec fermé), mais l'arrêt n'est pas net.
5. **FAIBLE** — `depenserSelonOrigine` ×2 simultanés sur la même clé paie deux fois (comptées ensuite) ; la garde ne déduplique pas,
   seule l'idempotence des appelants (`nouvelId`) le fait. Pendant le vol, l'usage sous-compte (sonde : 3e clé de 10 € acceptée,
   final 24 € pour 20 €). Aujourd'hui non atteignable (clés neuves), mais même racine que la faille 1.
6. **FAIBLE (g)** — un prénom de personne ajouté dans un commentaire (`src/services/credits.ts:548`, lot AUT-F).
7. **INFO** — `tutoriel-branchements.ts:41` et `tableau-branchements.ts:128` passent le prix lui-même comme accord (le seuil de
   confirmation ne joue jamais pour ces voix) ; borné par le plafond une fois la faille 1 corrigée.

## Lots correctifs proposés

- **AUT-G (bloquant, argent)** : une clé de registre PAR dépense (`cleUsine = travailId#appel`, comme `appelId` pour Claude) aux
  4 sites de voix ; `engagerBudget` cumulatif sur une clé déjà active (ou `ajusterEngagement`) ; `jugerSousPlafondUsine` ajoute au
  lieu de remplacer. Tests : la sonde « 15 € + 2 voix + 18 € » doit refuser ; deux `depenserSelonOrigine` même clé en vol comptés 2×.
- **AUT-H (structure)** : ajouter `tutoriel-branchements.ts` à `SITES` ; restreindre la regex `origine: "usine"` aux dépenses
  (exclure `creerCreneau`) dans les deux tests ; retirer les 2 entrées d'`echecs-connus.json` ; garde structurelle : `quotaSeul`
  interdit avec une origine ≠ studio (ou passer l'origine réelle) ; attraper `USINE_PLAFOND_ATTEINT` aux 2 sites ; retirer le prénom.

## Tableau des points

| Point | Résultat |
|---|---|
| (a) double clic | OK (même clé : un seul accord) — mais voir faille 1 / R5 pour les ré-réservations légitimes |
| (b) course à 1 c | OK (`Promise.all` : un seul passe, jamais > 2000) ; multi-processus Postgres NON VÉRIFIABLE ici |
| (c) contournement | OK aujourd'hui (aucun chemin Usine ne paie hors aiguillage) ; 1 site absent de la liste (gardé) ; 1 contournement en sommeil (point 3) |
| (d) origine falsifiée | OK |
| (e) changement de mois | OK ; plafond absent/0/illisible = `BUDGET_USINE_ABSENT` |
| (f) interrupteur éteint | OK — Studio identique avant AUT-A (`ecc48a96`) et après |
| (g) secrets / montants / noms | OK sauf un prénom en commentaire (point 6) ; seuls montants : borne de saisie 100 000 € et alerte 80 % |
| (h) échecs connus l3-0 | causes sans effet direct sur l'argent ; affaiblissement indirect OUI (sentinelle aveuglée) |

## (c) Contournement — liste des points d'entrée payants

Balayage des clients payants (HeyGen voix/vidéo/look, fal, Claude, Higgsfield, transcription) et de leurs appelants :
- **Gardés, origine transmise** : `generation-claude.ts:674`, `depense-claude-video.ts:339`, `comite-editorial.ts:254`,
  `fabrication.ts:875/983/1133/1190`, `travaux.ts:1037` (Réessayer), `image-video.ts:322` (+ pré-vol `:323`, transcription incluse
  dans l'estimation de lancement), `tableau-branchements.ts:128`, `cas-concret-branchements.ts:686`, `tutoriel-branchements.ts:41`,
  `publications.ts` (via `depense-claude-video`).
- **Studio seulement (session exigée, aucune origine du navigateur)** : `decors.ts:460/686`, `prononciations.ts:236`,
  `personnages.ts` (écoute), `site-videos.ts`, `tableau-creation.ts`, `tableau-scripts/client-studio.ts`, `monteur-facecam.ts`.
- **Hors porte par conception** : options payantes Higgsfield / multicaméra / décor IA (jeton de confirmation à usage unique,
  `briques/options-payantes/garde.ts`, session vérifiée) ; `scripts/banc-aveugle.ts`, `scripts/approvisionner-fenetres.ts` (Claude
  direct, lancés à la main, plafond local en dollars, non gardés — outils locaux).
- **Non payants** : `api/voix/ecoute/route.ts`, `videos-heygen.ts`, `rendu-double.ts`, `retouche-chat/*` (non branché).
- La porte `src/app/api/usine/**` ne déclenche aucune dépense (créneaux, programmations, budget de l'Usine).
- Remarque : `boucle.ts:310` lance `travaillerComite()` sans origine → compté Studio (automatique, antérieur à AUT, hors plafond Usine).

## (f) Interrupteur éteint / absent / illisible — OK

Même sonde rejouée sur `ecc48a96` (parent d'AUT-A) et sur master : Studio sans origine ou « studio », sous seuil / au-dessus du seuil
sans accord / avec accord → `ok / ok / ok` dans les deux cas (mode indicatif), registre Usine vide, pour réglage absent, éteint,
illisible et même allumé. Suites Studio rejouées : `r7-double-heygen`, `budget-indicatif-*`, `garde-fous-budget*`, `autonomie-usine-*`,
`l3-0*`, `l3-01*` : 314 réussis ; 4 rouges = les 2 connus l3-0, le cas l3-0-relecture-argent (point 2) et
`garde-fous-budget` « ne promet plus de reprise toute seule » (Claude indisponible levé au lieu d'être rendu ; sans lien avec l'argent).

## (g) Secrets, montants, noms — OK sauf point 6

Lignes ajoutées par AUT-A..F (504) : aucune clé, aucun jeton, aucun défaut chiffré du plafond (absent = confirmation). Constantes :
borne de saisie 10 000 000 c (= celle de `definirBudgetAction`), alerte 80 %, délai 15 min. Un prénom en commentaire (`credits.ts:548`).

## (h) Échecs connus de `tests/l3-0-garde-origine.test.ts` (cas 2 et 3) — vérifié

Rejoué : `npx vitest run tests/l3-0-garde-origine.test.ts` → 2 échecs, 17 réussis.

- **Cas 2** (« aucun fichier hors credits.ts ne fixe `origine: "usine"` ») : faux positif de l'expression régulière. Les deux fichiers
  trouvés sont `src/app/api/usine/commandes/route.ts:79` et `src/services/porte-programmations.ts:43` (STU-PORTE-PROG, PR 492) :
  ils écrivent `origine: "usine"` sur un **créneau du calendrier** (`creerCreneau`), pas sur une dépense. Aucun argent ne passe
  par là ; et le sens est l'échec fermé (marquer Usine, jamais Studio). → n'affaiblit pas la garde de l'argent.
- **Cas 3** (liste fermée des sites de dépense) : un seul site manquant, `src/services/tutoriel-branchements.ts`
  · `verifierEtReserverSelonOrigine × 1` (lot I, PR 447). Ce site **est gardé** (aiguillage normalisé, origine `c.origine` de la commande).
  → la cause n'affaiblit pas la garde.
- **MAIS** : tant que ce cas est toléré par `scripts/echecs-connus.json` (correspondance par NOM du test), la sentinelle « liste fermée »
  est aveugle : un futur site de dépense non gardé ajouté n'importe où ne ferait plus rougir la CI. **Affaiblissement indirect : OUI**
  (la garde de structure est neutralisée, pas la garde d'exécution). Gravité : moyenne. Correctif trivial : ajouter le site du tutoriel
  à `SITES` et restreindre la regex du cas 2 aux dépenses (ou exclure `creerCreneau`), puis retirer les 2 entrées d'`echecs-connus.json`.

## Sondes rejouées (tous les points ci-dessous)

Fichier jetable `tests/zz-sonde-audit-argent.test.ts` (NON poussé) : vrais appels à `src/services/credits.ts`, dépôts en mémoire
(`reinitialiserDepots`), lecteurs de solde vides, aucun réseau, 0 €. Plafond 20 € = 2000 centimes écrit directement dans le dépôt
mémoire (`usine.autonomie = { actif: true, plafondCents: 2000 }`), seuil de confirmation 5 €.

## (a) Double clic / même travail déclenché deux fois — OK (avec une réserve, point 5)

- `verifierEtReserverSelonOrigine("usine", 7 €, travailId t1)` ×3 en série puis ×3 en `Promise.all` : index du mois = `["t1"]`,
  usage du mois = 700, engagement `budget.engage.t1` = 700 (un seul). → une seule réservation comptée.
- Après consommation (`libererReservation(t2,"consommee")`), rejeu de la même clé : usage reste 1500, pas de double comptage.
- Réserve (point 5, gravité faible) : `depenserSelonOrigine` ×2 simultanés sur la MÊME clé → les deux `payer()` partent (2 paiements),
  usage final 1400 = les deux sont comptés. Le plafond n'est pas trompé une fois les dépenses enregistrées, mais la garde
  d'argent ne déduplique pas elle-même un double clic : c'est l'idempotence de l'appelant qui le fait (les appelants utilisent
  `nouvelId(...)`, donc deux clics = deux travaux = deux accords jugés chacun, conforme au plan § 5.1). Voir aussi la faille 1.

## (b) Course à 1 centime du plafond — OK

- 1999 utilisés, deux `reserverPourUsine(1 c)` en `Promise.all` → `[ok, USINE_PLAFOND_ATTEINT]`, usage = 2000 exactement.
- Mélange simultané lot (`reserverLot` origine usine) + vidéo + relance (`reactiverSelonOrigine`) + `depenserSelonOrigine`
  + origine « Usine » (casse) à 6 € chacun, 10 € déjà libérés : `[ok, ok, ok, PLAFOND, PLAFOND]`, usage 1800 ≤ 2000.
- 1998 utilisés, cinq demandes de 0,4 c simultanées : arrondi au centime supérieur, 2 passent, usage = 2000, jamais plus.
- Jugement + écriture du registre dans la même section `sousVerrouCredits` (`credits.ts:414-420` et `428-445`, `autonomie-usine.ts:208`
  refuse `VERROU_REQUIS` hors verrou). Cas multi-processus Postgres : NON VÉRIFIABLE ici (pas de base) ; le code passe par
  `sousVerrouCreditsPartage` (verrou consultatif), non rejoué.

## (d) Origine falsifiée — OK

`normaliserOrigine` : « Usine », « USINE », null, "", {}, 42, ["studio"], " studio", new String("studio"), "usine" → **usine** ;
seuls `undefined` et "studio" → studio.
- Interrupteur éteint : toutes les valeurs falsifiées → `BUDGET_USINE_ABSENT` (jamais traitées comme Studio).
- Allumé, plafond 5 c, demande 10 c : toutes → `USINE_PLAFOND_ATTEINT` via `verifierEtReserverSelonOrigine`, `reserverLot`,
  `verifierEtReserver(...,{origine})` et `reactiverSelonOrigine`.
- Client HTTP : aucune action serveur ne transmet une origine venue du navigateur aux services payants
  (`src/app/(studio)/ecrire/sujets/actions.ts:51-53` supprime `origine` et `origineUsine` ; `nouvelle/[format]/actions.ts:125,180`
  n'en passent pas). La porte `src/app/api/usine/**` n'écrit `origine: "usine"` que sur des créneaux de calendrier
  (`commandes/route.ts:79`, `porte-programmations.ts:43`), jamais « studio ». Inverse (forcer « usine » pour sauter l'accord
  humain du Studio) : une action du navigateur ne peut pas poser `origine`, donc non atteignable ; et même posée, elle reste bornée
  par le plafond.

## (e) Changement de mois, fuseau Europe/Paris — OK

- `moisParis` : 31/10 22:30 UTC → 2026-10 ; 31/10 23:30 UTC (00:30 Paris) → 2026-11 ; 30/11 23:30 UTC → 2026-12 ; changement d'heure
  du 29/03 correct.
- Accord de 15 € le 31/10 à 23:30 Paris : octobre = 1500, novembre = 0 après minuit (le compteur repart). Nouveau 15 € en novembre :
  accepté. Reprise du travail d'octobre en novembre (reste 5 €) : acceptée, novembre = 2000, octobre = 0 → la clé est déplacée,
  jamais comptée deux fois, rien n'est perdu pour le mois courant.
- Plafond absent, 0, texte, `actif:"true"`, négatif, flottant, > 100 000 €, éteint, valeur non-objet : `lireAutonomieUsine` =
  confirmation et `reserverPourUsine` → `BUDGET_USINE_ABSENT` (aucun budget de l'Usine reçu). Jamais « sans limite ».
- Remarque (faible) : après une reprise, l'accord inscrit vaut le RESTE (5 €) mais `reactiverReservations` réactive l'engagement
  d'origine (15 €) ; une seconde reprise est alors jugée sur 15 € et refusée (prudent : échec fermé, pas une faille).

## FAILLE 1 (HAUTE) — une ré-réservation sur le même travail ÉCRASE l'usage du plafond (lectures de voix)

Sonde rejouée (`tests/zz-sonde-audit-argent-3`, jetable) — plafond 20 € :
1. lancement d'une vidéo d'origine Usine, 15 €, `verifierEtReserverSelonOrigine("usine", 15 €, {travailId:"T"})` → usage 1500, engagé 1500 ;
2. lecture de voix n° 1, 2 €, MÊME `travailId` (c'est ce que font `avantLecture` / `budget.reserver`) → usage 1500, **engagé 200** ;
3. lecture de voix n° 2, 2 €, même `travailId` → **usage 200**, engagé 200 ;
4. une autre commande Usine de 18 € → **acceptée** (usage affiché 2000). Engagement réel : 15 + 2 + 2 + 18 = **37 € pour un plafond de 20 €**.

Cause :
- `src/services/couts.ts:94-95` (`engagerBudget`) **remplace** l'engagement du travail par le dernier montant au lieu de l'ajouter ;
- `src/services/autonomie-usine.ts:204` : `effectif = max(pire, engagement actif) + payé` relit cet engagement écrasé, et la dépense
  réelle n'est enregistrée qu'à la FIN du travail (`travaux.ts:98`, `travaux.ts:209`) : `payé = 0` pendant toute la fabrication ;
- `autonomie-usine.ts:229` réécrit l'accord avec ce montant réduit.
Sites concernés (même `travailId` que le lancement, une réservation par lecture payée) : `src/services/image-video.ts:322`
(voix HeyGen, `dep.travailId`), `src/services/tableau-branchements.ts:128`, `src/services/cas-concret-branchements.ts:686`,
`src/services/tutoriel-branchements.ts:41`. Les appels Claude (AUT-E, clé `appelId` distincte) ne sont pas touchés.
Effet : tant qu'une vidéo de l'Usine est en fabrication, sa part du plafond fond à la dernière lecture de voix ; d'autres commandes
passent ; à la fin, tout est payé : le plafond est dépassé pour de vrai. Le registre se recale à la fin (usage = payé), trop tard.
Le même écrasement touche l'engagement du budget du mois du Studio (défaut antérieur, hors AUT, mais c'est lui qui casse le plafond).

Correctif proposé (lot AUT-G) : une clé de registre PAR dépense (clé `travailId#appel`, comme `appelId` pour Claude), passée en
`cleUsine` par les quatre sites ; ou, à défaut, sur une clé déjà active, `effectif = accord précédent + besoin` et
`engagerBudget` cumulatif (`ajusterEngagement`). Test de non-régression : la sonde ci-dessus doit refuser l'étape 4.
