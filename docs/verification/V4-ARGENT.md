# Vérification V4 — Argent (10/10/2026)

- Branche `verif/v4-argent`, partie de `origin/master` @ `85655d2`.
- **Rien n'a été fusionné, rien n'a été déployé, aucun appel réel n'a été fait.** Tous les tests utilisent des
  doubles et des dépôts en mémoire, et `fetch` y est interdit.
- Les règles de Will vérifiées :
  - aucune dépense sans sa confirmation explicite, à chaque fois ;
  - le **Décor IA ne part jamais** ;
  - le face caméra n'affiche aucun prix, sauf la carte « Option payante — environ X € [Confirmer] [Annuler] » ;
  - « Annuler » garde la version gratuite, sans aucune dépense ;
  - plafonds de Claude (écriture d'un sujet ≤ 1,50 $ ≈ 1,35 €, monteur plafonné par version).
- Les preuves :
  - `tests/v4-argent.test.ts` (**19 tests**) ;
  - les tests J, K et C1 déjà présents ;
  - le relevé ROUGE sur master, plus bas.

## 1. Trous trouvés et corrigés

Chaque trou a d'abord été montré par un test rouge sur master.

| # | Trou | Risque | Correction |
|---|---|---|---|
| T1 | Décor IA encore confirmable. Une carte « Décor IA » déjà affichée sur une ancienne vidéo (demande `en-attente` gardée dans `optionsPayantes.demandes`) lançait une version avec le décor au clic sur « Confirmer ». Un accord déjà donné mais pas encore utilisé dépensait au passage suivant. | ~12 € par vidéo, au premier clic de travers | Le Décor IA est **retiré** (`OPTIONS_RETIREES` dans `briques/options-payantes/registre.ts`) : <ul><li>aucune carte n'est proposée (fabrication, monteur, Réglages) ;</li><li>les anciennes cartes ne sont plus montrées ;</li><li>« Confirmer » vaut « Annuler » : la demande est annulée, aucune version n'est créée, et Will lit pourquoi ;</li><li>un ancien accord est refusé par la garde (`raison: "retiree"`) ;</li><li>Réglages › Décor IA ne s'allume plus. Il peut seulement s'éteindre s'il était allumé.</li></ul> |
| T2 | Pas d'interrupteur global. | — | **« Couper toutes les options payantes »** dans Réglages › Budget (paramètre `optionsPayantes.coupees`, éteint par défaut). Coupé : <ul><li>aucune carte n'est proposée ;</li><li>les cartes ouvertes disparaissent et ne se confirment plus ;</li><li>la garde refuse, **même après « Confirmer »** ;</li><li>le monteur répond « … je garde la version gratuite, rien n'est dépensé ».</li></ul> |
| T3 | Un jeton confirmé mais **pas encore utilisé**, recopié dans une autre version (retouche du monteur, geste du fil), pouvait être dépensé par cette autre version. | Une dépense sur une version que Will n'a pas confirmée | La demande garde `versionCibleId`, la version lancée par « Confirmer ». La garde refuse toute autre version (`raison: "autre-version"`). |
| T4 | Des cartes étaient recréées en douce par la fabrication (`preparerOptionPayante`) dans trois cas : <ul><li>sur chaque version qui hérite de l'option (`demandees`) ;</li><li>après un redémarrage, une fois la dépense faite ;</li><li>pour le 2ᵉ effet réaliste d'une même version.</li></ul> | Un « Confirmer » de plus **repayait le même travail** | Si la version porte déjà l'option (accord ou demande), aucune carte n'est créée : la version gratuite sort (`non-confirmee`). La carte n'est proposée que pour une option allumée par un réglage sur une version qui ne l'a pas encore. |
| T5 | Les rendus multicaméra HeyGen n'étaient **jamais notés dans les dépenses**. | Total du mois et plafond faux | `services/multicamera.ts` : chaque rendu réel accepté par HeyGen ajoute une ligne « Multicaméra · angles » (heygen, à la seconde, au tarif du double, nature `estime`) à la vidéo et au travail. |
| T6 | La relecture Claude de la vignette (vidéo finie) partait sans `depuis`. Elle n'était donc pas comptée dans le plafond **par version** du monteur : seul le plafond du mois jouait. | Dépassement du 1,50 $ par version | `ContexteRelecture.travailId`. La relecture compte depuis le début du travail, comme les autres appels du monteur. |

## 2. Tableau des chemins qui peuvent dépenser

« Garde » : ce qui empêche l'appel sans accord. « Trace » : où la dépense est notée.

### Options payantes (cartes de confirmation, lot J / K)

| Chemin | Qui l'appelle | Garde (au moment de l'appel fournisseur) | Plafond | Trace | Test qui le prouve |
|---|---|---|---|---|---|
| **Décor IA** (Higgsfield `lancer`, `briques/decor/passe.ts`) | Chaîne face caméra, étape 5 bis → `passeDecorFacecam` | **Retiré** : la garde refuse toujours. Le client réel est enveloppé par `garderHiggsfield`, qui refuse sans garde. | — | `decor-ia.ts` (lignes Higgsfield) | `v4-argent` › Décor IA retiré (3 tests) ; `j-options-payantes` › Décor IA réel allumé |
| Effets main **ultra réalistes** (I2) | `higgsfieldUltraRealisteMain` (pas encore branché à la chaîne : rien ne part) | Jeton de la version (`gardePourTravail`), à usage unique, lié à la version | Plafond du mois revérifié au moment de dépenser | — (passe non branchée) | `v4-argent` › ultra réaliste et effet réaliste sans accord ; `j-options-payantes` › option Higgsfield confirmée |
| **Effet réaliste par IA** (K, Higgsfield `lancer`) | Monteur → carte → Confirmer → chaîne, étape 5 ter → `passeEffetsRealistesFacecam` | `optionDemandeePourTravail` + `higgsfieldPourOption` + garde. Un effet déjà payé (même empreinte) est repris sans repayer, et aucune carte n'est recréée (T4). | Plafond du mois | `effet-realiste-ia.ts` → `depenses` | `k-effet-realiste` (aucune fabrication sans accord, reprise sans repayer) ; `v4-argent` |
| **Multicaméra** avocat et face caméra (HeyGen `creerLook` / `rendre`) | Chaîne → `fabriquerSourcesMulticamera` | `gardeMulticamera` → `garderMulticamera` : sans accord, `gardeRefus`. Aucun look n'est créé en réel. | Plafond du mois revérifié | **Nouveau (T5)** : ligne « Multicaméra · angles » | `v4-argent` › coupé après Confirmer, autre version, reprise, trace dans les dépenses ; `j-options-payantes` |
| **Carte** « Confirmer » | `confirmerOptionPayanteAction` (session exigée) | Une seule réponse, 24 h. Option retirée ou options coupées : vaut « Annuler » (T1, T2). | Plafond d'abord : pas de carte si le plafond ne couvre pas | Journal « dépenses » | `j-options-payantes` › usage unique, 24 h, sans session ; `v4-argent` |
| **Interrupteur** « Couper toutes les options payantes » | Réglages › Budget | Refus partout : demande, carte, confirmation, garde | — | Journal « réglages » | `v4-argent` › interrupteur (3 tests) |

### Fabrication et fournisseurs (hors cartes)

| Chemin | Qui l'appelle | Garde | Plafond | Trace | Test qui le prouve |
|---|---|---|---|---|---|
| **Claude, écriture des sujets** (`executerRoleFacture`) | Boucle d'écriture (4 s) : « Écrire », séries (≤ 20 idées, total confirmé), déclinaisons, retouches de texte (≤ 5 par version) | Le mode essai est fixé au lancement. Plafond du sujet, plafond du mois et crédits, sous verrou. Réservation avant l'appel. | **1,50 $ par sujet (≈ 1,35 €)**, 0,70 $ par complément, 100 $ par mois | `DepenseEnregistree` (anthropic, réel) | `e2e1-secu-plafonds`, `e2e2-gen-argent`, `g1a-service`, `c1-argent-claude-coupure`, `c5-serie-ecriture` |
| Relances de la boucle d'écriture | Panne réseau : 3 essais (0 s, puis 60 s), puis arrêt | Le pire cas d'un appel interrompu reste compté dans le plafond du sujet. Un nouveau mois ne relance rien sans geste de Will. | Plafond du sujet | Réservation soldée | `e2e1-secu-plafonds` › « la limite du mois n'a pas bougé : l'écriture NE repart PAS seule » ; `e2e2-gen-argent` › « au 3e échec, elle s'arrête » |
| **Claude, monteur** (fil, fabrication, relecture) | « Discuter avec mon monteur », chaîne face caméra | `executerRolePourVideo` : plafond par version, plafond du mois, crédits. Les options payantes et les déplacements d'effet ne font **aucun** appel Claude. | **1,50 $ par version** (`facecam.plafondVersionUsd`) ; la relecture est comptée depuis le début du travail (T6) | « Monteur · … » | `facecam-plafond-monteur` ; `v4-argent` › relecture comptée dans le plafond |
| Claude, textes de publication | Fin de fabrication (une fois par kit), « Réécrire » | Même chemin | 0,30 $ par vidéo | « Texte de publication · … » | `r2-textes-publication` |
| **HeyGen, double avocat** (`POST /v3/videos`) | Fabrication avocat (boucle) | `double.rendu.allume`, `verifierEtReserver` (budget, seuil, confirmation du double, crédits). Clé stable et `retrouverRendu` avant tout renvoi. Envoi plafonné à 1,5 × la durée annoncée. | Budget du mois | Lignes du moteur | `c1-argent-b5-reessayer`, `c1-argent-b6-confirmation`, `e2e1-moteur-09-quota-et-plafond` |
| HeyGen, voix (`/v3/voices/speech`) | Fabrication avocat, maquette, écoute de prononciation | `verifierEtReserver` ou `verifierBudgetEtCredits`. Copie différée : la voix n'est jamais relue. | Budget du mois | Lignes du moteur ou « prononciation » | `c1-argent-b2-voix-heygen`, `a1-voix-heygen` |
| HeyGen, look de décor | « Mes décors » | `accordDonne(confirme)` + `verifierBudgetEtCredits` + `double.looks` allumé | Budget | `decors.ts` | `c1-argent-b4-decors`, `b1-decors-reel` |
| **fal.ai** (`POST queue.fal.run`) | Illustrations du moteur avocat ; « Un décor en une phrase » | Un seul point d'envoi (`fal.ts`). Une demande déjà envoyée n'est jamais renvoyée, une soumission incertaine n'est jamais resoumise. `FAL_PLAFOND_USD` lu en base. | `FAL_PLAFOND_USD` par mois, plus le budget | Dès la soumission | `c1-argent-b3-fal`, `c1-argent-b4-decors` ; `v4-argent` › un seul POST fal |
| Pexels / Pixabay | Cascade d'illustrations (≤ 2 recherches par plan) | Gratuit (quota) ; un 429 est ignoré | — | — | `a2-illustrations` |
| ElevenLabs | **Aucune synthèse codée** : seulement la lecture gratuite de l'abonnement | — | — | — | `v4-argent` › Tester |
| **Buffer** (`createPost`) | « Envoyer » ; « Programmer les N » | Session, liste « Avant de publier », vidéos d'exemple refusées. Clé d'idempotence sous verrou ; une réponse perdue est relue, jamais renvoyée. **Brouillon par défaut.** | — (Buffer ne facture pas à l'envoi) | Publication | `r1-buffer-client` › « brouillon par défaut » ; `v4-argent` › une seule écriture |
| **« Tester » de Réglages** | Connexions › Tester | Uniquement des **GET** : `/v1/models`, `/v3/users/me`, `/v1/user/subscription`, `/v1/models/pricing`. Buffer : lectures `Compte` et `Canaux`. | Gratuit | Journal « crédits » | `v4-argent` › Tester (méthode GET vérifiée, aucune adresse qui fabrique) |
| **Veille** | Boucle quotidienne | `GET /v1/models` (Claude), catalogue fal public. Résumés faits par le studio, sans Claude. | Gratuit | — | `v4-argent` › veille ; `c1-argent-b7-veille-resume` |
| Formats ajoutés (`reexporter`) | « Ajouter un format » | Même version : seule l'étape « export » tourne, aucune passe payante. `verifierEtReserver`. | Budget | Lignes du moteur | `c1-argent-b11-simulation-production` |
| Garde-fou de structure | — | Un seul appelant pour chaque point payant : `envoyerMessage` (Claude), `queue.fal.run`, `creerHiggsfieldHttp`, la mutation Buffer | — | — | `v4-argent` › points d'appel payants (5 tests) |

## 3. Preuve rouge sur master

`tests/v4-argent.test.ts` a été lancé sur `origin/master` (worktree temporaire, `fetch` interdit). L'action de
l'interrupteur, absente sur master, y est remplacée par un bouchon.

**11 en échec et 8 réussis sur 19.**

Les 11 échecs :
- Décor IA retiré : 3 sur 3 ;
- interrupteur : 3 sur 3 ;
- autre version qui recopie le jeton : 1 ;
- trace multicaméra : 1 ;
- reprise sans nouvelle carte : 1 ;
- relecture dans le plafond par version : 1 ;
- garde Buffer : 1. Le motif du test était trop large (il lisait les commentaires) ; il a été corrigé, et ce test passe aussi sur master.

Les 8 réussis prouvent des gardes qui existaient déjà : les Tester ne font que des GET, la veille ne dépense rien, et
il n'y a qu'un seul point d'appel pour Claude, fal et Higgsfield.

Sur la branche : **19/19 verts**.

## 3 bis. Vérifications complètes

- `tsc --noEmit` : 0 erreur dans `src` et `tests`. Les erreurs de `studio-rendu/` sont déjà connues : les dépendances Remotion ne sont pas installées.
- `eslint` : 0 problème.
- **Vitest complet : 3 459 réussis, 2 en échec, 3 sautés (3 464 tests, 282 fichiers, 629 s).**
  - Les 2 échecs sont des **délais de 5 s dépassés** sous la charge de la suite complète, déjà connus (journaux J et K) :
    `e2e-verif1-bc-serie` (6,1 s) et `garde-ecran` (5,1 s).
  - Relancés seuls : **20/20 verts**. `garde-ecran` ne relève aucun jargon dans les nouveaux textes.

## 4. Tests adaptés (changement de règle, pas de régression)

- `src/briques/options-payantes/options-payantes.test.ts` :
  - l'option Higgsfield de référence devient « effets main ultra réalistes » (même devis) ;
  - +2 tests : la version liée, le Décor IA retiré.
- `tests/j-options-payantes.test.ts` :
  - « Décor IA réel allumé » attend désormais **aucune carte** ;
  - « Décor IA confirmé » devient « option Higgsfield confirmée (ultra réaliste) : une fois, puis plus rien » ;
  - le test « Annuler » du fil prend « 3 caméras » au lieu du décor.

## 5. Reste à décider ou à surveiller (non corrigé ici)

1. **Ultra réaliste (I2) confirmable mais pas branché.** « C'est confirmé » est dit, puis rien n'est fabriqué ni dépensé. C'est sans risque d'argent, mais trompeur : brancher la passe, ou retirer l'option comme le décor.
2. **Jeton consommé au premier `lancer`, même si l'appel échoue.** Il n'y a pas de double dépense, mais l'option est perdue pour cette version. Will la redemande au monteur, ce qui fait une nouvelle carte.
3. **Le plafond Claude du fil du monteur repart à chaque message** (`depuis: will.le`). Le seul cumul est le plafond du mois (100 $). Proposition : compter depuis la création de la version choisie.
4. **`FAL_PLAFOND_USD` est facultatif.** S'il n'est pas posé, il n'y a pas de plafond propre à fal : seuls le budget et les crédits jouent. Proposition : le poser en production. Les illustrations ont jusqu'à 3 essais par plan, bornés par ce plafond.
5. **La voix HeyGen n'a pas de clé d'idempotence.** Après une réponse perdue, la boucle peut la relire. Ce cas est connu depuis CORRECTEUR 1, et la dépense probable est enregistrée.
6. **Buffer en mode « programmer » :** une date à moins de 60 s publie tout de suite (`shareNow`). Le mode par défaut reste le brouillon.
7. **Plusieurs serveurs :** la consommation du jeton est protégée par une file dans le processus (limite déjà notée au lot J).
8. Les scripts `outils/` (`essai-claude.mts`, `banc-g4.mts`, `decors-b1/photos-reelles.mts`) appellent Claude ou fal hors des gardes du studio, avec leur propre petit budget. Ils ne se lancent qu'à la main.
