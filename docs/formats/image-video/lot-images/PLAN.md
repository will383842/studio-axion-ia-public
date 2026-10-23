# Image → vidéo · LOT D'IMAGES — plan détaillé (à exécuter à la lettre)

> Plan écrit le 17/10 (conception, docs seulement). Base : `origin/master` à `7c16e799` (contient #351 variété, #359 reprise
> variété, #360 build). Exécutant prévu : Sonnet, une étape = un commit, test rouge d'abord. Rien n'est payé, rien n'est
> déployé, aucun réglage n'est allumé par ce lot.

## 0. Décisions de Will (17/10) — fixes, ne pas rediscuter

1. Déposer **N images → UNE vidéo par image**, fabriquées **l'une après l'autre**.
2. **UN SEUL accord de prix total**, **aucun arrêt** entre les vidéos (ni « Ce que j'ai compris », ni « Le script »). Will
   relit à la fin et refait ce qui ne va pas.
3. Garde-fou = **CONTRÔLE AUTOMATIQUE avant toute dépense de la suite** (carte comprise + script) : une vidéo douteuse est
   **MISE DE CÔTÉ SANS PAYER** la suite, les autres continuent ; Will ne regarde que celles mises de côté.
4. Bouton **« Lien privé »** aussi sur Image → vidéo (et Cas concret), dans « Vos vidéos ».
5. Image figée acceptée **jusqu'à 2,5 s tant que la voix parle**, pas de micro-mouvement. → **Déjà sur master**
   (`FIGE_IV` dans `commandes-ffmpeg.ts`, contrôle dans `controles.ts` l. 393-399). Ce lot n'y touche pas ; il vérifie
   seulement (étape L10) qu'une vidéo du lot refusée pour image figée est « mise de côté » et non bloquante.

Lire avant de coder : `AGENTS.md` (Next.js de ce dépôt ≠ celui de l'entraînement : lire
`node_modules/next/dist/docs/` avant toute page ou action serveur), `docs/REGLES-ROUTINES.md`, ce plan en entier.

---

## (a) Objectif, périmètre, hors-périmètre

**Objectif.** Sur `/image-video`, Will dépose plusieurs images d'un coup, confirme un seul prix « au plus », et s'en va.
Le studio fabrique les vidéos une par une, sans jamais l'attendre. À son retour, une page du lot lui montre : les vidéos
faites (à relire), celles mises de côté (avec le motif, à valider ou refaire), et un bouton « Lien privé » sur chaque
vidéo faite.

**Dans le périmètre**

- Dépôt multiple (2 à `LOT_MAX_IV` images ; 1 image = le parcours actuel, inchangé).
- Un enregistrement « lot » persistant, ses vidéos et leurs états.
- Un accord total, une réservation de crédit et un engagement de budget pour le lot, transférés vidéo par vidéo.
- Le mode « sans arrêt » de la machine (`fabrication.ts`) : contrôle automatique aux deux portes, mise de côté.
- Un séquenceur dans la boucle de fond : une seule fabrication Image → vidéo active à la fois, reprise après redémarrage.
- La page du lot (suivi, « À relire », « Refaire », « Arrêter le lot »).
- « Lien privé » dans `VosVideos` (Image → vidéo) et `VosFichiers` (Cas concret).
- Une notification à la fin du lot.

**Hors périmètre** (ne pas faire, même si c'est tentant)

- Aucun changement au parcours d'une image seule (portes carte et script inchangées, B6 inchangé hors lot).
- Aucun lien privé PAR RÉSEAU (un lien par vidéo, sur la sortie choisie, comme les autres formats) — voir décision D3.
- Pas de « tout télécharger » (zip), pas de publication, pas de Buffer.
- Pas de parallélisme (jamais deux vidéos du lot en même temps).
- Pas de lot pour le lanceur (`scripts/image-video/fabriquer.ts`) : le lot passe par le studio et sa boucle uniquement.
- Aucune nouvelle table en base : le lot vit dans `parametres` (comme les décisions `imageVideo.decisions.<vidéo>` et
  les engagements de budget).
- Ne touche ni `studio-rendu/`, ni les contrôles d'image figée, ni la variété.

---

## (b) Modèle de données

### b.1 Le lot — `src/domaine/image-video/lot.ts` (NOUVEAU, PUR, sans `server-only`)

```ts
export const LOT_MAX_IV = 10;            // décision par défaut D1, modifiable
export const PANNES_AVANT_PAUSE_IV = 2;  // pannes de suite avant la pause du lot (D4)

export type StatutVideoLotIV =
  | "en-attente"      // brouillon créé, pas encore lancé
  | "en-fabrication"  // travail lancé, la machine avance
  | "faite"           // vidéo prête
  | "mise-de-cote"    // arrêtée sans payer la suite (porte) OU arrêtée par un refus ; motif obligatoire
  | "refaite";        // Will l'a refaite : `refaiteEn` pointe la nouvelle vidéo

export type PorteMiseDeCoteIV = "carte" | "script" | "arret";

export interface VideoDuLotIV {
  rang: number;               // 1..N, ordre du dépôt (ordre de fabrication)
  videoId: string;            // brouillon créé AU DÉPÔT (voir c.4)
  fichierId: string;
  nom: string;                // nom du fichier, pour l'écran
  statut: StatutVideoLotIV;
  miseDeCote?: { porte: PorteMiseDeCoteIV; motif: string; phrases: string[] };
  refaiteEn?: string;         // videoId de la nouvelle vidéo (statut "refaite")
  lanceeLe?: string;          // ISO, posé AVANT l'appel de lancement (c.5)
}

export type StatutLotIV = "en-cours" | "en-pause" | "termine" | "arrete";

export interface LotIV {
  version: "lot-iv/1";
  id: string;                         // "lot-iv-<12 hex>"
  creeLe: string;
  cleIdempotence: string;             // sha256(fichierIds triés + réseaux + offre + accord) : double clic = même lot
  reseaux: ReseauIV[];
  offre?: Offre;
  prixParVideoCentimes: number;       // prixDuDepot(reseaux, taux) au moment de l'accord
  accordCentimes: number;             // montant confirmé par Will (>= N × prixParVideo)
  plafondCentimes: number;            // = N × prixParVideo (jamais au-delà, même si l'accord est plus haut)
  tauxUsdEur: number;
  videos: VideoDuLotIV[];
  statut: StatutLotIV;
  pause?: { raison: "credit" | "budget" | "pannes" | "format"; phrase: string };
  pannesDeSuite: number;              // remis à 0 à chaque « faite »
  journal: string[];                  // phrases simples, sans date
}
```

Fonctions PURES du même fichier (toutes testées en L1) :

- `prixDuLotIV(n, prixParVideo)` → `n × prixParVideo` ; `refusTailleLotIV(n)` → phrase si `n < 2` ou `n > LOT_MAX_IV`.
- `prochaineALancerIV(lot, autreFabricationIVActive: boolean)` → `VideoDuLotIV | null` : `null` si le lot n'est pas
  `en-cours`, si une vidéo du lot est `en-fabrication`, ou si `autreFabricationIVActive` ; sinon la première `en-attente`
  par rang.
- `statutDepuisEtatIV(etat: Pick<EtatFabricationIV, "etape" | "miseDeCote" | "refus">, travailStatut)` →
  `{ statut, miseDeCote? }` (table en b.2).
- `appliquerIssueIV(lot, rang, issue)` → nouveau lot (statut de la vidéo, `pannesDeSuite`, pause si
  `pannesDeSuite >= PANNES_AVANT_PAUSE_IV`, `termine` quand plus aucune `en-attente` ni `en-fabrication`).
- `resumeLotIV(lot)` → `{ faites, misesDeCote, enAttente, enFabrication, refaites }` (compteurs pour l'écran et la
  notification).
- `restantAReserverIV(lot)` → `prixParVideo × (nombre d'« en-attente »)` (sert à la libération, c.3).

Persistance : `parametres` clé `imageVideo.lot.<lotId>` (le `LotIV`) + index `imageVideo.lots` (`string[]`, le plus
récent d'abord, 50 au plus). Toute écriture du lot se fait **sous `sousVerrou`** (le verrou de la boucle, `_commun.ts`).

### b.2 La vidéo, côté machine (`fabrication.ts`)

Ajouts (rétrocompatibles, champs FACULTATIFS : une fabrication d'avant se lit telle quelle) :

```ts
// DemandeFabricationIV
/** Fabrication d'un LOT (décision de Will du 17/10) : aucune porte n'attend Will ; contrôle automatique à la place. */
lot?: { id: string; rang: number };

// EtatFabricationIV
/** Lot : la vidéo est mise de côté à une porte, sans rien payer de la suite (motif pour Will). */
miseDeCote?: { porte: "carte" | "script"; motif: string; phrases: string[] };
```

Correspondance état machine → statut dans le lot (`statutDepuisEtatIV`) :

| État de la machine | Travail | Statut lot |
|---|---|---|
| aucune fabrication (brouillon) | — | `en-attente` |
| `lecture`, `ecriture`, `voix` … `livraison`, `attente` posée | `en_file`/`en_cours` | `en-fabrication` |
| `carte-a-valider` **avec** `miseDeCote` | `echec` (réessayable) | `mise-de-cote` porte `carte` |
| `script-a-valider` **avec** `miseDeCote` | `echec` (réessayable) | `mise-de-cote` porte `script` |
| `refusee` (tout code) | `echec` | `mise-de-cote` porte `arret`, motif = `refus.message`, phrases = `refus.phrases` |
| `prete` | `termine` | `faite` |
| travail `annule` | `annule` | `mise-de-cote` porte `arret`, motif « Arrêtée. » |

Une vidéo mise de côté que Will valide ensuite (porte) ou relance (« Refaire cette partie ») redevient `en-fabrication`
puis `faite` : le statut est RECALCULÉ à chaque tour depuis le travail (le lot ne garde que le dernier statut vu).

---

## (c) Prix, accord, réservation, plafond, reprise

### c.1 L'estimation « au plus »

- `prixParVideo = prixDuDepot(reseaux, taux)` (même calcul que le dépôt d'une image, `image-video-ecran.ts`), donc
  `estimerImageVideo` du moteur. Aucun nouveau calcul de prix.
- `total = N × prixParVideo`. Le bouton affiche : « **Fabriquer les N vidéos · au plus X €** ».
- Phrase sous le bouton (une seule) : « Au plus ce prix pour les N vidéos. Aucun arrêt : une vidéo douteuse est mise de
  côté sans payer sa voix. »

### c.2 L'accord

- `deposerLotImageVideo` refuse (statut `accord-requis`, rien n'est créé) tant que `accord < total` — même règle que
  `deposerImageVideo` (accord = MONTANT en centimes, `true` ne suffit pas).
- Format masqué : même garde que l'image seule (`imageVideo.accordEssaiReel`, `PARAM_ACCORD_ESSAI_IV`). Le lot ne
  l'allume jamais ; sans lui, chaque lancement est refusé par le moteur (`IV_FORMAT_MASQUE`) → le lot passe `en-pause`
  raison `format` avec la phrase `PHRASE_FORMAT_MASQUE`, avant toute dépense.
- Garde commune au moment de l'accord : `verifierBudgetEtCredits({ lignes: N × lignes d'une vidéo, total }, accord,
  "Ce lot")` (budget du mois, seuil de confirmation, clés, crédits de CHAQUE fournisseur). Un refus = rien n'est créé,
  la phrase du refus est rendue telle quelle.

### c.3 Réservation de crédit et engagement de budget POUR LE LOT

But : le disponible affiché ailleurs dans le studio tient compte du lot entier dès l'accord, et une autre vidéo lancée
pendant le lot ne peut pas « manger » le crédit des vidéos suivantes.

Nouvelles fonctions dans `src/services/credits.ts` (toutes sous `sousVerrouCredits`, déjà présent) :

1. `reserverLot(lotId, lignesTotales, accord)` — au dépôt : `verifierBudgetEtCredits` puis `reserverCredits({ travailId:
   "lot:<lotId>", lignes })` puis `engagerBudget("lot:<lotId>", total)` (`couts.ts`). Idempotent (clé `lot:<lotId>`).
2. `transfererDuLot(lotId, lignesVideo)` — juste AVANT le lancement d'une vidéo : diminue la réservation `lot:<lotId>`
   de chaque fournisseur du besoin de la vidéo (`besoinsDeLEstimation`, marge comprise), plancher 0 ; diminue
   l'engagement du lot du total de la vidéo. Le lancement normal (`lancerFabricationConfirmee` → `verifierEtReserver`)
   pose ensuite la réservation propre du travail. Idempotent : la part transférée est notée
   `credits.lot.<lotId>.transfere.<videoId>` ; un second appel pour la même vidéo ne retire rien.
3. `libererLot(lotId)` — fin du lot (`termine` ou `arrete`) : réservation `lot:<lotId>` → `liberee`, engagement →
   `liberee`. Ce qui est déjà lancé garde sa propre réservation (libérée par son travail, comme aujourd'hui).

Ordre lors d'un lancement (dans le séquenceur, c.5) : `transfererDuLot` puis `lancerFabricationConfirmee`. Si le
lancement échoue AVANT d'avoir créé le travail (crédit, budget), on **rend** la part au lot
(`rendreAuLot(lotId, videoId)`, symétrique, idempotent) et le lot passe `en-pause` (raison `credit` ou `budget`).

### c.4 Plafonds (trois niveaux, aucun nouveau mécanisme de caisse)

- **Par vidéo** : inchangé. `entrees.imageVideo.plafondCentimes = prixParVideo` → la CAISSE de la machine n'engage
  jamais plus (arrêt `IV_PLAFOND` sinon, rien n'est payé au-delà).
- **Par lot** : le séquenceur ne lance une vidéo que si
  `somme(engagé des vidéos du lot, lu dans leurs caisses) + prixParVideo <= lot.plafondCentimes`. Sinon : `en-pause`
  raison `budget`, phrase « Le prix accordé pour ce lot est atteint : rien de plus n'est lancé. ».
- **Claude par vidéo** (`imageVideo.plafondClaudeUsd`, 3 $) et budget du mois : inchangés, ils s'appliquent à chaque
  vidéo comme aujourd'hui.

### c.5 Le séquenceur et la garde contre la dépense par inadvertance

`avancerLotsIV()` dans `src/services/image-video-lot.ts`, appelé **une fois par tour** de la boucle (hors du tour,
comme les tâches annexes : `lancerAnnexe("lots-image-video", avancerLotsIV, DELAI_ANNEXE_MS)` dans
`src/services/boucle.ts`, une ligne). Pour chaque lot `en-cours` de l'index :

1. Sous `sousVerrou` : relire le lot ; recalculer le statut de chaque vidéo `en-fabrication` / `mise-de-cote` depuis son
   travail (`statutDepuisEtatIV`) ; appliquer (`appliquerIssueIV`) ; écrire.
2. `prochaineALancerIV(lot, autreFabricationIVActive)` où `autreFabricationIVActive` = il existe un travail
   `en_file`/`en_cours` du moteur `montage-image-video` dont l'état n'est pas à une porte (une vidéo validée à la main
   par Will compte aussi : **jamais deux fabrications Image → vidéo en même temps**, garde mémoire, voir (h)).
3. S'il y en a une : écrire d'abord `lanceeLe` + `statut: "en-fabrication"` (sous verrou), PUIS hors verrou
   `transfererDuLot` + `lancerFabricationConfirmee(videoId, { confirme: prixParVideo })`.

Gardes (chacune a son test, L5) :

- **Pas de double lancement** : `lancerFabricationConfirmee` refuse déjà une vidéo « déjà en cours » (verrou par vidéo,
  E2E-2 argent n° 3) ; en plus, une vidéo avec `lanceeLe` dont le travail existe n'est jamais relancée.
- **Pas de double lot** : `cleIdempotence` ; un second dépôt identique rend le lot existant (`statut: "lancee"`, même
  `lotId`).
- **Une seule boucle** : déjà assuré (`demarrerBoucleUnique`, verrou consultatif Postgres).
- **Pas de session dans la boucle** : le séquenceur n'appelle JAMAIS `lancerFabrication` (qui exige une session) ni
  `nouveauBrouillonFormat` : les N brouillons sont créés AU DÉPÔT (session présente), avec leurs entrées complètes ;
  le séquenceur n'appelle que `lancerFabricationConfirmee`.
- **La voix d'une vidéo du lot** : `services/image-video.ts` (`budget.reserver`, fournisseur `heygen`) prend comme
  accord `entrees.imageVideo.lot.accordParVideoCentimes` (= `prixParVideo`) au lieu de `d.centimes` quand la commande
  porte `lot` ; sans cela, une voix au-dessus du seuil de confirmation s'arrêterait sur « Ce prix demande votre
  confirmation ». C'est le SEUL accord implicite, borné par le prix accordé de la vidéo.
- **Pause sur pannes** : `PANNES_AVANT_PAUSE_IV` (2) vidéos de suite mises de côté par un arrêt de code `IV_PANNE`,
  `IV_NON_RELIE`, `IV_RENDU`, `IV_BUDGET` ou `IV_PLAFOND` → `en-pause` raison `pannes` (la chaîne est cassée : inutile
  de payer lecture + écriture de toutes les images suivantes). Les mises de côté par contrôle automatique (portes) ne
  comptent PAS comme pannes.
- **Arrêter le lot** (Will) : `statut: "arrete"`, plus aucun lancement, `libererLot`. La vidéo `en-fabrication` va au
  bout (rien de déjà payé n'est perdu) ; décision D5 si Will préfère l'annuler aussi.
- **Reprendre le lot** (après `en-pause`) : `statut: "en-cours"`, `pannesDeSuite: 0`, la réservation du lot est
  revérifiée (`reserverLot` pour le restant) ; un refus garde la pause avec la phrase.

### c.6 Reprise après arrêt du serveur (le studio a eu des OOM)

Tout est dans la base (`parametres` + travaux) ; rien n'est en mémoire seule.

- Le lot est écrit **avant** chaque geste qui peut dépenser (`lanceeLe` avant le lancement).
- Au redémarrage, le premier tour de boucle relit les travaux en cours (déjà fait par `boucle.ts`) puis
  `avancerLotsIV` relit les lots `en-cours` :
  - vidéo `en-fabrication` avec travail → rien à faire, la boucle reprend le travail (la caisse garde les réservations
    déjà faites : un appel compté n'est jamais repayé, `fabrication.ts` « REPRISE sans repayer ») ;
  - vidéo `en-fabrication` SANS travail (arrêt entre l'écriture de `lanceeLe` et le lancement) → relancée une fois
    (`transfererDuLot` est idempotent, le lancement aussi) ;
  - vidéo `en-attente` → normal.
- Le séquenceur ne garde aucun état entre deux tours (pur relu-écrit).

---

## (d) Le contrôle automatique (le cœur)

Activé UNIQUEMENT si `demande.lot` est présent. Il **réutilise les portes** : on appelle les mêmes fonctions que Will
(`validerCarteIV`, `validerScriptIV`) avec une décision « telle que proposée » ; toute erreur de ces fonctions ou tout
critère ci-dessous = mise de côté. Rien d'autre ne change dans la machine.

### d.1 Porte « carte » (dans `pasLecture`, après la lecture)

Aujourd'hui : `if (obligatoire || validationCarte === "toujours" || doutes.length || !controle.ok) → carte-a-valider`.

En lot, la ligne devient : on calcule `motifsCarte` ; vide → la carte est validée automatiquement ; sinon → étape
`carte-a-valider` + `miseDeCote`.

| # | Critère (mise de côté si VRAI) | Source réutilisée | Motif affiché |
|---|---|---|---|
| C1 | `!controle.ok` (erreur bloquante de la carte) | `controlerCarte` / `r.controle` | « Ce que j'ai compris de l'image a un défaut. » + `controle.erreurs` |
| C2 | écarts entre les deux lectures (`carte.lecture.ecarts.length > 0`) | `doutesDeLaCarte` | « Les deux lectures de l'image ne disent pas la même chose. » |
| C3 | alertes du contrôle (`controle.alertes`) | `doutesDeLaCarte` | « Un point de l'image est incertain. » + alertes |
| C4 | chiffre lu une seule fois | `doutesDeLaCarte` | « Un chiffre n'a été lu qu'une fois : X. » |
| C5 | formule trop affirmative non tranchée dans la carte | `doutesDeLaCarte` | « Une formule trop affirmative est à trancher : « … ». » |
| C6 | `validerCarteIV(e, { proposition: empreinte, le })` lève `ErreurDecisionIV` | la porte de Will | message + phrases de l'erreur |
| C7 | type d'image inconnu (refus `IV_TYPE_A_CHOISIR` de la lecture) | `pasLecture` (refus existant) | `PHRASE_TYPE_INCONNU` (porte `arret`, sans changement de la machine) |

- `doutes` est DÉJÀ la liste C2-C5 (`doutesDeLaCarte`) : les `phrases` de la mise de côté = `doutes` (+ `controle.erreurs`
  pour C1). Le `motif` = la première phrase de la table qui s'applique.
- **B6 (10 cartes obligatoires) et le réglage `validationCarte: "toujours"` ne s'appliquent pas en lot** : c'est la
  décision (2) de Will. La carte validée automatiquement porte `par: "reglage"` (aucun changement de schéma de
  `CarteImage`) et le journal dit « Carte sans doute : validée par le contrôle automatique du lot. ». Elle **ne compte
  PAS** dans `imageVideo.cartesValidees` (ce compteur reste celui des cartes relues par Will).
- Payé à ce stade : la lecture seulement (au pire 0,36 $ → ~0,36 €).

### d.2 Porte « script » (dans `pasEcriture`, après l'écriture)

Aujourd'hui : `→ script-a-valider` (toujours). En lot : on calcule `motifsScript` ; vide → `validerScriptIV(e, {
proposition: empreinte, choixFormules: {}, ajoutsWill: [] })` et la machine passe à `voix` ; sinon → reste à
`script-a-valider` + `miseDeCote`.

| # | Critère (mise de côté si VRAI) | Source réutilisée | Motif affiché |
|---|---|---|---|
| S1 | l'écriture rend `motif: "a-trancher"` ou `aTrancher.length > 0` | `ecrireScriptIV`, `aTrancherParWill` | « Le script a une phrase à trancher. » + messages des manquements |
| S2 | une formule absolue dans le script (`formulesDuScript(fiche).length > 0`) | `formulesDuScript` (B7 : rien n'est changé sans Will) | « Une formule trop affirmative est dans le script : « … ». » |
| S3 | `validerScriptIV` lève `ErreurDecisionIV` (contrôles `verifierScript`, question de commentaire `refusQuestion`, script incomplet) | la porte de Will | message + phrases de l'erreur |
| S4 | prix de la suite inconnu (`prix.auPlusCentimes === 0` alors que la voix a un tarif) | `propositionScript` | « Le prix de la voix n'a pas pu être calculé. » |
| S5 | `engagé + prix.auPlusCentimes > caisse.plafondCentimes` | `prixSuiteIV` | « La voix dépasserait le prix accordé pour cette vidéo (X €). » |

- La variété tirée reste celle du tirage (`par: "tirage"`) : Will ne la change pas en lot.
- Payé à ce stade : lecture + écriture (au pire 0,36 $ + 0,50 $ → **~0,86 € au plus** par vidéo mise de côté).
  **Aucune voix, aucune transcription, aucune relecture.**

### d.3 Après les portes

Les arrêts habituels (voix, mise en scène, rendu, contrôles finaux, image figée > 2,5 s, plafond) restent des REFUS de
la machine : en lot ils deviennent `mise-de-cote` porte `arret` (b.2), le lot continue. Ce ne sont pas des « contrôles
avant dépense » : la dépense de la voix a eu lieu, elle est dans le prix accordé.

### d.4 Ce que Will fait d'une mise de côté

- Porte `carte` ou `script` : la page de la vidéo (`/image-video/<vidéo>`) montre l'écran EXISTANT (« Ce que j'ai
  compris » ou « Le script ») avec, en tête, la phrase « Mise de côté : <motif> ». Will valide comme d'habitude
  (`validerCarteEtReprendre` / `validerScriptEtReprendre`, prix confirmé pour le script) → la vidéo reprend.
  Il faut donc que les gestes de Will retirent `miseDeCote` (fait par `validerCarteIV` / `validerScriptIV` : ajouter
  `delete e.miseDeCote`).
- Porte `arret` : « Refaire cette partie » existant (`reessayerImageVideo`).
- Dans tous les cas : « Refaire » depuis la page du lot = nouvelle vidéo de la même image, parcours d'une image seule
  (portes, accord propre) ; l'entrée du lot passe `refaite` avec `refaiteEn`.

### d.5 Tests — un par critère (étape L2/L3, `tests/image-video/lot/controle-auto.test.ts`)

Doubles : `outilsSimules`, `carteFixe`, `demandeEssai`, `monde` (`tests/image-video/doubles-fabrication.ts`) ; `fetch`
espionné, jamais appelé. Pour chaque critère, une carte ou une fiche fabriquée à partir des fixtures A-F :

| Test | Donnée | Attendu |
|---|---|---|
| carte propre → automatique | `carteFixe("A")`, `demande.lot`, `cartesValidees` = 0 | étape `ecriture` puis `script-a-valider`→`voix` sans `decisions` ; `carte.par === "reglage"` ; `cartesValidees` non incrémenté |
| C1 | carte A avec un nœud orphelin (erreur de `controlerCarte`) | `carte-a-valider`, `miseDeCote.porte === "carte"`, phrases = erreurs |
| C2 | carte A + `lecture.ecarts = [un écart]` | idem, motif C2 |
| C3 | carte avec alerte | idem, motif C3 |
| C4 | un chiffre `lu: "une-seule"` | idem, motif C4 contient le chiffre |
| C5 | une `formulesAbsolues` sans `choixWill` | idem, motif C5 |
| C6 | double de `validerCarteIV` qui lève (empreinte changée) | idem, motif = message |
| C7 | lecture `type-inconnu` | `refusee` `IV_TYPE_A_CHOISIR` (lot : porte `arret`) |
| S1 | écriture simulée rendant un manquement `pourWill` | `script-a-valider`, `miseDeCote.porte === "script"` |
| S2 | fiche contenant « zéro erreur » | idem, motif S2 |
| S3 | question de commentaire refusée par `refusQuestion` | idem, motif S3 |
| S4 | `voix.tarifCentimesParCaractere` absent/0 | idem, motif S4 |
| S5 | `plafondCentimes` très bas (ex. 40) | idem, motif S5 |
| sans lot : rien ne change | mêmes données SANS `demande.lot` | comportement actuel exact (portes de Will, aucun `miseDeCote`) |
| aucune voix payée | chaque cas de mise de côté | `caisse.reservations` ne contient que `lecture`/`ecriture` ; jamais `voix`, `ecoute`, `relecture` |
| validation de Will efface `miseDeCote` | C2 puis `validerCarteIV` | `miseDeCote` absent, étape `ecriture` |

---

## (e) Les écrans (harmonisés `EnTetePage` / `BarreEtapes` / `BarreActionCollee`)

Vouvoiement, très peu de texte, une seule action principale par écran (`BarreActionCollee`).

### e.1 `/image-video` — dépôt multiple

- `Depot.tsx` : `ZoneDepot` passe à `multiple` (le composant le gère déjà ; **#354 modifie `ZoneDepot`** — ne pas y
  toucher, l'utiliser tel quel). Libellé : « Déposez une ou plusieurs images ».
- 1 image : écran actuel, inchangé (aperçu, réseaux, offre, `BoutonFabriquer` au prix d'une vidéo).
- ≥ 2 images : nouveau composant `DepotLot.tsx` (même dossier) :
  - grille de vignettes (2 colonnes au téléphone, 4 à l'ordinateur), sous chacune son état d'envoi (`envoi X %`,
    `prête`) ou son refus en une phrase (`refusFichier`, `refusDimensions` de `vue.ts`, déjà existants) avec « Retirer » ;
  - au-delà de `LOT_MAX_IV` : phrase « 10 images au plus par lot. » et les suivantes ne sont pas gardées ;
  - réseaux et offre en pastilles (les mêmes que l'image seule, communs à tout le lot ; « Selon l'image » = déduite par
    image) ;
  - `BoutonFabriquer` (composant commun) : `montantCentimes = N × prix`, message de c.1, désactivé tant qu'une image
    n'est pas « prête » ou qu'il y a un refus non retiré ;
  - au succès : `router.push("/image-video/lot/<lotId>")`.
- Action serveur `deposerLotImageVideoAction` dans `src/app/(studio)/image-video/actions.ts`.

### e.2 `/image-video/lot/[lotId]` — suivi du lot (NOUVELLE page)

- `EnTetePage` titre « Lot de N images », sous-titre « k faites · m mises de côté · r à venir », retour
  `{ href: "/image-video", libelle: "Image → vidéo" }`.
- `BarreEtapes` à 3 étapes : « Les images » → « Fabrication » → « À relire » (courante : Fabrication tant que le lot est
  `en-cours`/`en-pause`, À relire quand `termine`/`arrete`). Composant `EtapesLot.tsx` (patron de
  `EtapesImageVideo.tsx`).
- Bandeau de pause (si `en-pause`) : la phrase de la pause, ton ambre.
- Deux sections, dans cet ordre :
  1. **« À relire »** (masquée si vide) : les vidéos `mise-de-cote`, chacune en `Carte` : vignette de l'image, nom, pastille
     brique « Mise de côté », motif en une phrase, boutons « Voir » (→ `/image-video/<vidéo>`) et « Refaire ».
  2. **« Le lot »** : toutes les vidéos par rang, pastille d'état (`en-attente` neutre « À venir », `en-fabrication`
     ambre + étape courante via `barreDe`, `faite` sauge « Faite », `refaite` neutre « Refaite » + lien vers la
     nouvelle), lien « Voir » sur les faites.
- `BarreActionCollee` (une seule action) :
  - lot `en-cours` : « Arrêter le lot » (variante secondaire, confirmation « Les vidéos pas encore commencées ne seront
    pas fabriquées. Rien de déjà payé n'est perdu. ») ;
  - lot `en-pause` : « Reprendre le lot » ;
  - lot `termine`/`arrete` avec mises de côté : « Relire la première mise de côté » (→ sa page) ; sinon pas de barre.
- Rafraîchissement : même mécanisme que l'écran « Fabrication » d'une vidéo (lire `Fabrication.tsx` et le reprendre,
  ne rien inventer).
- Données : `vueLotImageVideo(lotId)` (service, jamais d'exception, `null` → `EtatVide` « Lot introuvable »).

### e.3 `/image-video` — accès aux lots

Sous le dépôt, la liste « dernières vidéos » existante reçoit en tête les lots récents (3 au plus) : « Lot de N images ·
k faites · m mises de côté » → page du lot. `dernieresLotsImageVideo()` dans le service du lot.

### e.4 Page d'une vidéo du lot

`/image-video/[videoId]` : si la vidéo appartient à un lot, l'`EnTetePage` a pour retour le lot (« Lot de N images ») et,
si `miseDeCote`, une phrase en tête « Mise de côté : <motif> » au-dessus de l'écran existant. Rien d'autre ne change.

### e.5 « Refaire »

`refaireVideoDuLot(lotId, rang, accord)` : crée une NOUVELLE vidéo de la même image (même `fichierId`, mêmes réseaux et
offre) par le parcours d'une image seule (`deposerImageVideo`, son prix, son accord : `BoutonFabriquer`), marque
l'entrée `refaite` + `refaiteEn`. L'ancienne vidéo n'est pas supprimée.

---

## (f) « Lien privé »

Aujourd'hui : le lien privé (`services/partages.ts`, `FeuillePartager`) n'existe que dans `BarreActionsVideo` de
`/videos/[id]`, cachée pour les formats `publication: "aucune"` (Image → vidéo ET Cas concret).

1. **Extraire sans changer le comportement** le contenu de `FeuillePartager` dans `PartagerVideo.tsx` (props :
   `videoId`, `titre`, `partages`), `FeuillePartager` l'utilise avec `useVideo()` (test : la fiche `/videos/[id]` rend
   la même chose qu'avant).
2. `BoutonLienPrive.tsx` (client, `components/partage/`) : `Bouton` icône `lien` « Lien privé » qui ouvre `FeuilleBas`
   + `PartagerVideo`. Utilise `creerPartageAction` / `revoquerPartageAction` existantes.
3. `VosVideos.tsx` (Image → vidéo) : un `BoutonLienPrive` en tête de section (un lien par vidéo, la sortie choisie).
   `VosFichiers.tsx` (Cas concret) : idem en tête.
4. Les pages passent `partages` (`listerPartages(videoId)`) : `[videoId]/page.tsx` (IV) et `/videos/[id]/page.tsx`
   (cas concret, la liste y est déjà lue pour `DonneesVideo`).
5. Vérifier (test) que `creerPartage` marche sur une vidéo IV prête : `video.statut === "prete"` et une sortie de
   `versionChoisieId` (la 9:16 de la première livraison, `resultatDe`). Si ce n'est pas le cas sur une vidéo IV prête,
   test rouge + correction minimale dans `creerPartage` (sortie par `versionId` du dernier travail terminé), rien d'autre.
6. Vidéo d'essai (simulée) : comme ailleurs, `creerPartage` reste permis (la page `/v/[code]` montre la vidéo) ; ne rien
   ajouter.

---

## (g) Étapes — une étape = un commit, test ROUGE d'abord

Pour chaque étape : 1) écrire le test, le lancer, vérifier qu'il est ROUGE pour la bonne raison, commit « EN COURS :
test rouge — … » si utile (patron des commits `5d476e4f`/`dbe1f3d5`) ; 2) le code minimal ; 3) tests ciblés verts,
`tsc --noEmit` (après `next typegen`) et `eslint` sur les fichiers touchés ; 4) commit et **push**.
Tests du lot dans `tests/image-video/lot/`. Suite Vitest complète UNE fois, à L11.

| Étape | Contenu | Fichiers | Tests (rouges d'abord) |
|---|---|---|---|
| **L1** | Domaine pur du lot (b.1) | `src/domaine/image-video/lot.ts` (nouveau) | `lot/domaine.test.ts` : prix, taille 2..10, `prochaineALancerIV` (jamais 2, respecte l'autre fabrication active, ordre des rangs, rien si pause/arrêt), `statutDepuisEtatIV` (chaque ligne de la table b.2), `appliquerIssueIV` (pause à 2 pannes, porte ≠ panne, `termine`), `restantAReserverIV` |
| **L2** | Machine : `demande.lot`, `miseDeCote`, porte carte automatique (d.1) | `fabrication.ts` | `lot/controle-auto.test.ts` : carte propre, C1-C7, sans lot inchangé, aucune voix payée, `validerCarteIV` efface `miseDeCote` |
| **L3** | Machine : porte script automatique (d.2) | `fabrication.ts` | même fichier : S1-S5, script propre → `voix` sans décision, sans lot inchangé, `validerScriptIV` efface `miseDeCote` |
| **L4** | Moteur : lire `lot` dans les entrées, message du travail à une porte en lot = « Mise de côté : motif » | `moteurs/montage-image-video/index.ts` (`EntreesImageVideo`, `lireEntreesImageVideo`, `demandeDeLaCommande`, `erreurDe`) | `lot/moteur.test.ts` : entrées lues, `messagePourWill` du motif, codes inchangés (`IV_CARTE_A_VALIDER`/`IV_SCRIPT_A_VALIDER`) |
| **L5** | Crédits du lot (c.3) | `services/credits.ts`, `services/couts.ts` (si besoin d'un `modifierEngagement`) | `lot/credits-lot.test.ts` (dépôts mémoire) : réserver, transférer (idempotent), rendre, libérer ; disponible d'un autre lancement diminué du lot ; jamais négatif |
| **L6** | Service du lot : dépôt (accord, idempotence, brouillons créés d'avance, `reserverLot`), séquenceur, arrêter, reprendre, refaire | `services/image-video-lot.ts` (nouveau), `services/boucle.ts` (1 ligne `lancerAnnexe`) | `lot/sequenceur.test.ts` : accord < total → rien créé ; double dépôt = même lot ; une seule vidéo à la fois ; attend une autre IV active ; continue après mise de côté ; pause crédit (rendu au lot) ; pause 2 pannes ; arrêt libère ; reprise relance la réservation ; **redémarrage** (`simulerRedemarragePourEssai`) entre `lanceeLe` et le lancement → lancée une seule fois |
| **L7** | Accord de la voix en lot (c.5) | `services/image-video.ts` (`budget.reserver`) | `lot/voix-accord.test.ts` : seuil de confirmation bas, vidéo du lot → voix réservée sans « Ce prix demande votre confirmation » ; vidéo seule → comportement actuel |
| **L8** | Dépôt multiple (e.1) | `components/formats/image-video/Depot.tsx`, `DepotLot.tsx` (nouveau), `app/(studio)/image-video/actions.ts`, `vue.ts` (phrases) | `lot/depot-ecran.test.ts` (rendu React, patron `interface.test.ts`) : 1 image = écran actuel ; 3 images = grille + total ; refus d'une image bloque le bouton ; 11 images → 10 gardées + phrase |
| **L9** | Page du lot (e.2-e.5) | `app/(studio)/image-video/lot/[lotId]/page.tsx` (nouveau), `components/formats/image-video/SuiviLot.tsx`, `EtapesLot.tsx` (nouveaux), `services/image-video-lot.ts` (`vueLotImageVideo`, `dernieresLotsImageVideo`), `app/(studio)/image-video/page.tsx`, `[videoId]/page.tsx` (retour au lot, phrase de mise de côté) | `lot/page-lot.test.ts` : sections et ordre, une seule action par état, pastilles, lien « Voir », refaite → lien |
| **L10** | Lien privé (f) | `components/partage/PartagerVideo.tsx`, `BoutonLienPrive.tsx` (nouveaux), `FeuillePartager.tsx`, `VosVideos.tsx`, `cas-concret/fiche-video/VosFichiers.tsx`, les deux pages | `lot/lien-prive.test.ts` : bouton présent dans VosVideos et VosFichiers ; `creerPartage` sur une IV prête ; `FeuillePartager` inchangée |
| **L11** | Notification de fin de lot + bout en bout simulé (h) + relevé | `services/image-video-lot.ts`, `domaine/notifications-textes.ts`, `docs/formats/image-video/lot-images/RELEVE.md` | `lot/bout-en-bout.test.ts` (h.3) ; puis **suite Vitest complète une fois** ; résultats exacts dans la PR |

Ordre imposé : L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8 → L9 → L10 → L11. L10 est indépendante et peut passer avant L8 si
la PR de la session 54 bloque `VosVideos` (voir (i)).

---

## (h) Risques, décisions à Will, tester de bout en bout sans appel payant

### h.1 Risques

| Risque | Parade dans ce plan |
|---|---|
| Mémoire du studio (OOM du 16-17/10, limite passée à 3 Go par #358) | Une seule fabrication IV à la fois, y compris avec les vidéos relancées à la main ; aucun fichier d'image gardé en mémoire par le lot (seulement des clés) ; reprise complète depuis la base (c.6) |
| Dépense sans Will (le lot tourne seul) | Accord total + réservation du lot + plafond par vidéo (caisse) + plafond par lot + pause à 2 pannes ; la voix n'est payée qu'après les deux portes automatiques |
| Payer lecture + écriture d'une vidéo mise de côté | Assumé : ~0,86 € au plus par vidéo, compris dans le prix accordé ; c'est le prix du contrôle |
| Contrôle automatique trop laxiste | Il ne fait que ce que Will exigeait déjà (mêmes fonctions) et ajoute S2/S5 ; Will relit toutes les vidéos faites (décision 2) |
| Contrôle trop sévère (beaucoup de mises de côté) | Visible au relevé (L11) ; seuil réglable plus tard, pas dans ce lot |
| B6 contourné en lot | Conséquence directe de la décision (2) ; le compteur des cartes validées par Will n'est pas faussé |
| Double clic, double onglet, redémarrage | `cleIdempotence`, `lanceeLe` écrit avant, verrou par vidéo existant, boucle unique |
| Conflits avec la session 54 | (i) ; L2/L3 posés derrière le seul test `demande.lot` : le parcours d'une image seule n'est pas modifié |
| Taille de `parametres` | 10 vidéos × quelques champs : négligeable ; index plafonné à 50 lots |

### h.2 Décisions à Will (par défaut appliqué, modifiable — rien ne bloque l'exécution)

- **D1** : 10 images au plus par lot.
- **D2** : une formule trop affirmative dans le script = mise de côté (S2), plutôt que prendre la version prudente
  toute seule (B7 : « rien n'est changé sans vous »).
- **D3** : un lien privé par vidéo (sa version principale 9:16), pas un par réseau.
- **D4** : le lot se met en pause après 2 vidéos de suite arrêtées par une panne (pas par le contrôle).
- **D5** : « Arrêter le lot » laisse finir la vidéo en cours (rien de payé n'est perdu) au lieu de l'annuler.

### h.3 Bout en bout SANS appel payant (L11, `tests/image-video/lot/bout-en-bout.test.ts`)

- Dépôts mémoire du studio (patron `tests/e2e2-argent-simule-et-pannes.test.ts`), `fetch` espionné → **0 appel**.
- Outils IV : `outilsSimules` + `ServeurDouble`/`outilsAvecRendu` (`tests/image-video/doubles-rendu.ts`), branchés par
  `brancherServicesImageVideo({ outils })` ; voix simulée (`TARIF_SIMULE`).
- Scénario : un lot de 5 images (fixtures A, B, C, D, E) :
  - A, C, E propres → faites ;
  - B : carte avec un écart (C2) → mise de côté porte carte ;
  - D : script avec « zéro erreur » (S2) → mise de côté porte script ;
  - **redémarrage simulé** (`simulerRedemarragePourEssai`) pendant la fabrication de C ;
  - tours de boucle (`tourDeBoucle`) jusqu'à `termine`.
- Vérifications : jamais 2 travaux IV `en_cours` ; ordre A, B, C, D, E ; aucun appel « voix » pour B et D ; somme des
  caisses ≤ accord ; réservation du lot `liberee` à la fin ; notification « Lot terminé : 3 faites, 2 mises de côté » ;
  puis validation de B par `validerCarteEtReprendre` → B devient faite ; « Lien privé » créé sur A.
- Aucun lancement du lanceur, aucun réglage allumé : `PARAM_ACCORD_ESSAI_IV` est posé seulement dans les dépôts
  mémoire du test.

---

## (i) Fichiers communs avec la session 54 (`image-video/relire-script`)

État au 17/10 (vérifié) : **la branche `image-video/relire-script` n'existe pas encore sur le dépôt et aucune PR ouverte ne
la porte** (`git ls-remote`, liste des PR ouvertes). Le modèle commun `src/domaine/relecture-script.ts` est déjà sur
master (`d22bb268`) et `src/components/script/RelireScript.tsx` aussi ; la session 54 va brancher la relecture sur le
script Image → vidéo.

Avant CHAQUE étape, l'exécutant refait : `git fetch origin` ; `git ls-remote origin 'refs/heads/image-video/relire-script'` ;
liste des PR ouvertes et `gh pr diff --name-only <n>` sur celle de 54 ; si un fichier ci-dessous y figure, le signaler
dans la PR du lot et se caler dessus (ne jamais réécrire ses lignes).

| Fichier | Ce lot y fait | Probable chez 54 | Règle |
|---|---|---|---|
| `src/moteurs/montage-image-video/fabrication.ts` | L2/L3 : champs `lot`/`miseDeCote`, deux branches dans `pasLecture`/`pasEcriture`, `delete e.miseDeCote` dans les deux portes | « script relu » (empreinte) dans `validerScriptIV` / `DecisionScriptIV` | Nos ajouts sont derrière `if (e.demande.lot)` ; si 54 exige une empreinte « relu », le lot la fournit avec la fiche proposée telle quelle (relu = non modifié) — à aligner sur sa PR |
| `src/services/image-video-scripts.ts` | aucun changement prévu | `validerScriptImageVideo` + relecture | ne pas toucher |
| `src/components/formats/image-video/ScriptEcrans.tsx` | aucun | remplacé/complété par `RelireScript` | ne pas toucher |
| `src/components/formats/image-video/VosVideos.tsx` | L10 : bouton « Lien privé » en tête | possible (« fabrication / VosVideos » annoncé) | ajout d'un seul élément en tête de `<section>` ; rebaser sur 54 si fusionnée avant |
| `src/app/(studio)/image-video/[videoId]/page.tsx` | L9 : retour au lot, phrase de mise de côté ; L10 : `partages` | probable (écran script) | changements limités à `EnTetePage` et aux props de `VosVideos` |
| `src/services/image-video-ecran.ts` | L9 : `vueImageVideo` expose `lot` et `miseDeCote` | probable (vue du script) | ajout de champs seulement |
| `src/components/formats/image-video/vue.ts` | L8 : phrases du lot | possible | ajout en fin de fichier |
| `src/app/(studio)/image-video/actions.ts` | L8/L9 : nouvelles actions | probable (action de relecture) | ajout en fin de fichier |
| `src/domaine/relecture-script.ts`, `src/components/script/RelireScript.tsx` | **aucun** | oui | ne pas toucher |

Autres PR ouvertes à surveiller : **#354** (face caméra animée) modifie `src/components/ui/ZoneDepot.tsx` et
`src/lib/envoi-multipart.ts` → ce lot les UTILISE sans les modifier ; **#341** et **#313** (Image → vidéo) touchent la
mise en scène / l'assemblage, pas les fichiers de ce plan ; **#334** (suppression définitive) touche les vidéos : vérifier
qu'une vidéo d'un lot supprimée rend l'entrée `mise-de-cote` « Supprimée. » (ajouter au test L6 si #334 est fusionnée).
