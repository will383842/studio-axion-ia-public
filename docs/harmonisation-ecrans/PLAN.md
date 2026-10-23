# Plan d'harmonisation des écrans de création

> **Statut** : plan seulement (conçu le 18/10/2026, à exécuter par Sonnet, lot par lot). Aucun code dans cette branche.
> **Décision de Will (17/10)** : même mise en page pour tous les écrans de création, sur `EnTetePage`, `BarreEtapes` et `BarreActionCollee`, avec un suivi et des « récents » communs, **en gardant les spécificités de chaque générateur**. Les formats pas faits restent grisés (« Bientôt », déjà en ligne).
> Relevé de départ : [AUDIT.md](AUDIT.md). Règles : `docs/REGLES-ROUTINES.md` (tests ciblés, rouge d'abord, aucun appel réel, rien fusionné ni déployé par la routine).

---

## (a) La cible

### a.1 Un gabarit d'écran de création

Tous les écrans de création suivent le même squelette, de haut en bas :

```
┌───────────────────────────────────────────────┐
│ EnTetePage  (retour? · surTitre? · titre · 1 ligne d'aide · actions?) │
│ BarreEtapes (si l'écran a plus d'une étape)    │
│ ── zone SPÉCIFIQUE du générateur ──            │  ← children, inchangés
│ SuiviFabrication (si un travail est en cours)  │
│ RecentsGenerateur (ou EtatVide si aucun)       │
│ BarreActionCollee  (UNE action principale)     │  ← collée en bas sur mobile, à droite sur bureau
└───────────────────────────────────────────────┘
```

Nouveau composant **`src/components/creation/GabaritCreation.tsx`** (dossier déjà dédié à la création ; serveur, sans état) :

```ts
interface ProprietesGabaritCreation {
  entete: Parameters<typeof EnTetePage>[0];               // obligatoire
  etapes?: { etapes: EtapeBarre[]; courante: number; onAller?: (i: number) => void }; // absent = écran à une étape
  suivi?: ReactNode;      // un <SuiviFabrication …/> ; absent si rien en cours
  recents?: ReactNode;    // un <RecentsGenerateur …/> ; absent si le générateur n'en a pas (cas concret : catalogue)
  action?: ReactNode;     // contenu de la BarreActionCollee ; ABSENT quand l'enfant porte déjà la sienne (RelireScript, feuille du cas concret)
  actionSecondaire?: ReactNode;
  largeur?: "etroite" | "large";  // max-w-2xl (défaut, dépôts) | pleine largeur (assistant, tableau)
  children: ReactNode;    // la zone spécifique
}
```

Règles du gabarit (vérifiées par le test de contrat, §f) :
- un seul `<h1>`, porté par `EnTetePage` ; plus d'en-tête maison ;
- au plus **une** `BarreActionCollee` rendue par écran (gabarit OU enfant, jamais les deux) ;
- aucun `fixed bottom-0` dans les composants de création hors `BarreActionCollee` (la barre de fabrication de l'assistant la rejoint, avec `auDessusDesOnglets={false}` si elle doit couvrir les onglets) ;
- attribut `data-gabarit="creation"` sur la racine, `data-zone="entete|etapes|specifique|suivi|recents|action"` sur chaque zone (sert aux tests et aux captures, invisible) ;
- marges : `space-y-6`, rien d'autre ; le gabarit ne touche pas aux couleurs ni aux textes du générateur.

`BarreEtapes` n'est **pas** modifiée. Les enveloppes existantes (`EtapesImageVideo`, `EtapesLot`) restent comme *fournisseurs de la liste d'étapes* : elles exportent leurs `EtapeBarre[]` et l'indice courant, et le gabarit les affiche.

### a.2 `SuiviFabrication` (à créer, présentation seule)

Les quatre mécaniques de sondage actuelles (`useTravaux` 2 s, server action 3 s du tableau, routes API 4 s d'image → vidéo, relectures programmées du cas concret) **ne sont pas fusionnées dans ce plan** : trop de risques sur la chaîne d'argent. On harmonise **l'affichage**, pas la source.

**`src/components/creation/SuiviFabrication.tsx`** (client) :

```ts
type EtatSuivi = "en-cours" | "prete" | "a-relire" | "arretee" | "coincee";
interface VueSuiviFabrication {
  etat: EtatSuivi;
  etapes: { cle: string; libelle: string; etat: "faite" | "en-cours" | "a-venir" | "arretee" }[];
  resteSec?: number;
  message?: string;                 // phrase lisible (ErreurLisible / ErreurStudio seulement, cf. GARDE-ECRAN)
  lien?: { href: string; libelle: string };   // « Voir la vidéo », « Voir le lot »
}
function SuiviFabrication(p: { vue: VueSuiviFabrication; actions?: ReactNode; compacte?: boolean }): JSX.Element
```

- Rendu fondé sur **`ProgressionEtapes`** (déjà testé : `final-b-accessibilite`, `suivi/boutons-apres-mise-en-ligne`) ; `SuiviFabrication` n'en est qu'une enveloppe à vue normalisée.
- Chaque générateur fournit un **adaptateur pur** `vers­SuiviFabrication(…)` testé seul :
  - assistant / avocat / face caméra : depuis `VueTravail` (`useTravaux`) ;
  - tableau : depuis l'état de `SuiviTacheTableau` / `EtapesTableau` (les actions « Corriger la fiche », « Relancer » passent par `actions`) ;
  - image → vidéo : depuis `vue.ts` (`Fabrication`, `SuiviLot`) — le plafond relevable passe par `actions` ;
  - cas concret : depuis `SuiviCasConcret` (relance POST conservée).
- Les composants actuels (`Fabrication`, `SuiviLot`, `SuiviTableau`, `SuiviCasConcret`, `AttenteFacecam`) **gardent leur sondage** et délèguent leur rendu à `SuiviFabrication`.

### a.3 `RecentsGenerateur` (à créer en généralisant `BrouillonsRecentsTableau`)

**`src/components/creation/RecentsGenerateur.tsx`** (serveur) :

```ts
interface RecentGenerateur {
  id: string;
  href: string;                // /videos/<id>, /image-video/<id>, /image-video/lot/<id>, /tableau/nouvelle?brouillon=<id>
  titre: string;
  etat: string;                // phrase lisible (« écriture en cours », « prête »)
  date?: string;               // ISO ; affichée « 18 oct., 14:05 » (fr-FR)
  detail?: string;             // ligne en plus : « payé 1,20 € » (FCA), « 3 vidéos » (lot)
  icone?: NomIcone;
}
function RecentsGenerateur(p: {
  titre?: string;              // défaut « Vos vidéos récentes » ; tableau : « Vos brouillons »
  groupes?: { titre: string; elements: RecentGenerateur[] }[];   // image → vidéo : « Vos lots » puis « Vos vidéos »
  elements?: RecentGenerateur[];
  courant?: string;
  vide?: { titre: string; phrase?: string } | null;  // null = rien si vide (défaut : EtatVide compact)
}): JSX.Element | null
```

- Rendu = celui de `BrouillonsRecentsTableau` (liste verticale, état + date à droite, `aria-current` sur le courant), une ligne `detail` en plus, grille `sm:grid-cols-2` en option si le générateur en avait une.
- `BrouillonsRecentsTableau` devient une enveloppe d'une ligne autour de `RecentsGenerateur` (pas de suppression brutale : ses tests restent verts).
- Chaque service garde sa requête (`brouillonsRecentsTableau`, `dernieresFacecamAnimee`, `dernieresImageVideo`, `dernieresLotsImageVideo`) ; un **adaptateur pur** `versRecents…` par générateur, testé.
- Nouveau (aujourd'hui absent) : récents pour l'**assistant face caméra / avocat** (dernières vidéos du format, requête existante de `/videos` filtrée par format) et pour le **cas concret** (sous le catalogue). Si la requête n'existe pas sans nouveau SQL, le lot s'arrête et le signale (pas de nouvelle requête sans accord).

### a.4 Chargement et vide
- `loading.tsx` ajouté là où il manque (`face-camera-animee`, `tableau/nouvelle`, `tableau/traces/[id]`, `image-video/[videoId]`, `image-video/lot/[lotId]`), construit sur un **`SqueletteCreation`** (même squelette que le gabarit : en-tête, barre, deux blocs) dans `src/components/creation/`.
- `EtatVide` compact quand un générateur n'a encore aucune vidéo (FCA, dépôt image → vidéo).

---

## (b) Ce qui reste spécifique (ne pas toucher)

| Générateur | Reste dans la zone spécifique / ne change pas |
|---|---|
| **Face caméra** | chemin « J'ai déjà filmé » (`DejaFilme` → `/envoyer/<varianteId>`) ; **aucun prix** (`sansPrix`) ; feuilles Script / Plateau / Voix / Style de l'express ; « Prête vers… » ; notification téléphone une seule fois ; `AttenteFacecam` sans montant. Étapes affichées : « Votre vidéo » → « Fabrication » (2). |
| **Avocat** | même assistant ; voix + avatar du format (`distributionParDefaut`) ; coût affiché (feuille Coût). |
| **Face caméra animée** | réservée à Will ; case « J'accepte l'essai réel » ; plusieurs prises à la fois ; texte dit facultatif ; bouton **« Reprendre un script validé »** et `FeuilleScriptsValides` ; `EstimationCout` ; phrase « payé » sur chaque récent (→ `detail`). Pas de `BarreEtapes` (une seule étape à l'écran ; le suivi vit sur `/videos/[id]`). |
| **Tableau animé** | écriture et découpage en tâches de fond ; `RelireScript` **porte sa propre `BarreActionCollee`** (le gabarit n'en ajoute pas) ; prix confirmé avant relance ; repère « script relu » ; « Corriger la fiche » / « Relancer » avec fichiers partiels ; page des traces en lecture seule (hors gabarit, voir risques). |
| **Cas concret** | catalogue des cas (validés / à valider en essai) ; refus annoncé avant le prix ; `FeuilleVotreVideo` **garde `BoutonFabriquer` dans la feuille** (pas d'action dans le gabarit) ; `RelireAvantLancement`. |
| **Image → vidéo** | prix selon le nombre de réseaux (`ChoixReseaux`, `BoutonFabriquer`) ; plafond relevable ; relecture derrière `imageVideo.relireScript` (éteint — **on n'allume rien**) ; `RecetteVariete`, `ScriptEcrans`, `VosVideos` (« Lien privé ») ; lot : vidéos « mises de côté ». |
| **Bientôt** (podcast, createur-b, écran partagé, motion, ugc/avis client) | **aucun écran de création à faire** : cartes grisées non cliquables (`CarteFormat`, `tests/generateurs-grises.test.ts`) ; page `/formats/<id>` avec « Me prévenir ». Seul écart à corriger : le titre « Mes vidéos » de `/formats/[id]` pour un format Bientôt (→ nom du format). |
| **Masqués** (selfie ; image-video dans les listes) | rien à faire ; restent invisibles. |

---

## (c) Les lots (1 générateur par lot, petits)

Chaque lot = **une branche + une PR**, vers master, depuis `origin/master` à jour. Dans chaque lot :
1. **Commit 1 — test rouge** : le test de contrat (§f) passe l'écran de la liste « à faire » à la liste « conformes » → il échoue. Plus les tests de l'adaptateur (rouges).
2. **Commit 2..n — une étape par commit** (en-tête, étapes, action, suivi, récents, chargement/vide), chacune avec ses tests ciblés verts.
3. **Dernier commit — captures** 390×844 et 1440×900 avant/après dans `docs/captures/harmonisation/<lot>/` (scène ajoutée à `scripts/captures.mjs`, données d'exemple, mode essai).
4. Avant de pousser : `next typegen && tsc --noEmit`, `eslint` sur les fichiers touchés, tests ciblés ; la suite Vitest complète **une seule fois**, à la fin du lot. Résultats exacts dans la PR.

| Lot | Contenu | Fichiers principaux | Dépend de |
|---|---|---|---|
| **H0 · Socle** | `GabaritCreation`, `SuiviFabrication`, `RecentsGenerateur`, `SqueletteCreation` + leurs tests (rendu `renderToStaticMarkup`, comme `tests/final-b-ecrans-vides.test.ts`) ; **test de contrat** `tests/harmonisation/gabarit-creation.test.ts` avec le registre des écrans, tous en « à faire » ; aucune page modifiée. | `src/components/creation/*` (nouveaux), `tests/harmonisation/*` | — |
| **H1 · Tableau animé** | (le plus proche de la cible) page `/tableau/nouvelle` dans le gabarit ; `BrouillonsRecentsTableau` → enveloppe de `RecentsGenerateur` ; `loading.tsx` ; adaptateur suivi pour `SuiviTacheTableau`. Pas d'action dans le gabarit (celle de `RelireScript`). | `app/(studio)/tableau/nouvelle/page.tsx`, `formats/tableau-anime/BrouillonsRecents.tsx`, `SuiviTacheTableau.tsx` | H0 |
| **H2 · Bientôt** | `/formats/[id]` : titre = nom du format pour un format non actif (test rouge d'abord). Très petit. | `app/(studio)/formats/[id]/page.tsx` | H0 |
| **H3 · Face caméra animée** | gabarit ; « Animer » dans la `BarreActionCollee` (la case d'accord reste au-dessus, le bouton reste désactivé sans accord) ; récents → `RecentsGenerateur` (`detail` = `phrasePaye`) ; `EtatVide` ; `loading.tsx`. « Reprendre un script validé » reste à sa place dans `DepotPrise`. | `app/(studio)/face-camera-animee/page.tsx`, `formats/facecam-animee/DepotPrise.tsx` | H0 ; **session a0 terminée** (§d) |
| **H4 · Image → vidéo, dépôt** | gabarit ; `EtapesImageVideo` fournit `etapes/courante` ; `BoutonFabriquer` dans la `BarreActionCollee` ; récents en deux groupes (lots, vidéos) ; `EtatVide`. | `app/(studio)/image-video/page.tsx`, `formats/image-video/Depot.tsx`, `EtapesImageVideo.tsx` | H0 ; sessions **54 et 7e terminées** ; **#313 fusionnée ou fermée** |
| **H5 · Image → vidéo, une vidéo** | `/image-video/[videoId]` dans le gabarit ; `Fabrication` rend via `SuiviFabrication` (sondage 4 s inchangé) ; `loading.tsx`. Écran de relecture : action portée par `RelireScript`, pas par le gabarit. | `app/(studio)/image-video/[videoId]/page.tsx`, `formats/image-video/Fabrication.tsx` | H4 ; **#313** |
| **H6 · Image → vidéo, lot** | `/image-video/lot/[lotId]` : gabarit ; `SuiviLot` garde sa `BarreActionCollee` mais rend son suivi via `SuiviFabrication` ; `loading.tsx`. | `app/(studio)/image-video/lot/[lotId]/page.tsx`, `formats/image-video/SuiviLot.tsx`, `EtapesLot.tsx` | H5 |
| **H7 · Cas concret** | gabarit autour de `EntreeCasConcret` ; pas d'action dans le gabarit (feuille) ; récents sous le catalogue ; adaptateur `SuiviCasConcret` → `SuiviFabrication` (sur `/videos/[id]`, sondage inchangé). | `app/(studio)/cas-concret/page.tsx`, `formats/cas-concret/entree/EntreeCasConcret.tsx` | H0 ; **décision sur #167** (§d) |
| **H8a · Assistant : en-tête et étapes** | `EnTeteAssistant` + `<h1>` d'`Express` → `EnTetePage` ; `BarreEtapes` à 2 étapes (« Votre vidéo », « Fabrication ») en express ; chemin pas à pas inchangé. Face caméra **et** avocat (même code) : captures des deux. | `assistant/Assistant.tsx`, `assistant/etapes/Express.tsx`, `app/(studio)/nouvelle/[format]/page.tsx` | H0, H3 (rodage du gabarit sur un petit écran) |
| **H8b · Assistant : fabrication** | barre `fixed bottom-0` de `etapes/Fabrication.tsx` → `BarreActionCollee` ; rendu via `SuiviFabrication` (adaptateur `VueTravail`) ; `AttenteFacecam`/`SuiviTravail` rendus via `SuiviFabrication` sur `/videos/[id]` (aucun montant pour la face caméra). | `assistant/etapes/Fabrication.tsx`, `components/facecam/AttenteFacecam.tsx` | H8a |
| **H8c · Assistant : récents** | récents du format sous l'express (masqués quand `?brouillon=`). Arrêt et signalement si une nouvelle requête SQL est nécessaire. | `app/(studio)/nouvelle/[format]/page.tsx` | H8b |

Ordre conseillé : **H0 → H1 → H2 → H3 → H8a → H8b → H8c → H4 → H5 → H6 → H7**. Image → vidéo et cas concret passent en dernier parce que ce sont les écrans où d'autres sessions travaillent encore (§d) ; l'assistant passe après un premier rodage du gabarit sur des écrans à faible enjeu.

Modèle : Sonnet pour H0–H7 ; **H8a/H8b sur le parcours de production principal → relecture Opus** de la PR avant que la session studio fusionne.

---

## (d) Fichiers communs avec les sessions en cours, PR ouvertes

### Sessions signalées
| Session | Objet | Fichiers | Règle pour l'harmonisation |
|---|---|---|---|
| **54** · image-video / relire-script | relecture du script | `components/script/RelireScript.tsx`, `domaine/relecture-script.ts` (+ `ScriptRelireIV.tsx`) | **Aucun lot ne modifie ces deux fichiers.** Le gabarit ne rend pas d'action quand `RelireScript` est à l'écran (il a la sienne, `RelireScript.tsx:348`). H4/H5 attendent la fin de 54. |
| **a0** · face-camera-animee | bouton « Reprendre un script validé » | `formats/facecam-animee/DepotPrise.tsx`, `FeuilleScriptsValides.tsx`, `scripts-valides.ts`, `app/(studio)/face-camera-animee/actions.ts`, `services/facecam-animee.ts` | H3 touche `DepotPrise.tsx` (déplacement du bouton « Animer » seulement) et la page ; **ne touche ni `FeuilleScriptsValides` ni `actions.ts` ni le service**. H3 ne part qu'après la fin de a0. |
| **7e** · image-video | moteur, dépôt, lot | `components/formats/image-video/*`, `app/(studio)/image-video/**`, `services/image-video*.ts` | H4–H6 après la fin de 7e ; aucun service touché par l'harmonisation. |

État constaté le 18/10 sur `origin` : les travaux visibles de ces sessions sont **déjà fusionnés** (#366 relire-script image → vidéo, #375 « Reprendre un script validé », lots d'images L8–L10) ; aucune branche distante non fusionnée ne touche ces fichiers. **Au départ de chaque lot**, refaire le relevé (branches + PR) — une session locale peut ne pas encore avoir poussé.

### PR ouvertes (relevé du 18/10, `gh api …/pulls` + fichiers de chaque PR)
| PR | Titre | Touche un écran de création ? | Effet sur l'ordre |
|---|---|---|---|
| **#313** | Image → vidéo · variété : assemblage et répétition générale | **oui** : `app/(studio)/image-video/[videoId]/page.tsx`, `image-video/actions.ts`, `formats/image-video/RecetteVariete.tsx`, `ScriptEcrans.tsx`, `VosVideos.tsx`, `vue.ts` (+ moteur, services) | H4/H5/H6 **après** son sort (fusion ou fermeture) |
| **#167** | Cas concret · phase 2 | **oui** : `app/(studio)/cas-concret/actions.ts`, `cas-concret/document|ecran-fourni/**`, `formats/cas-concret/entree/{CaseDuCas,EntreeCasConcret,FeuilleVotreVideo,vue}.tsx`, `videos/[id]/page.tsx`, `fiche-video/*` | H7 **après** sa fusion ou fermeture (question à Will : PR ancienne, encore d'actualité ?) |
| #370 | Voix maître épinglée (tableau) | non (`services/tableau-outils.ts`, `briques/voix-maitre/*`) | aucun |
| #363 | Contrôle des posts Buffer | non (docs) | aucun |
| #341 | Image → vidéo : rythme e-mail et alerte | non (moteur, compositions, test) | aucun |
| #318, #317 | Audit / recherche écriture | non (docs) | aucun |
| #316 | Tableau : banc relecture | non (`tests/tableau/banc/*`) | aucun |
| #280, #260, #241 | Maquettes tableau | non (docs/maquettes) | aucun ; si une maquette est retenue pour l'écran tableau, H1 se fait **avant** pour qu'elle s'y insère |

Fichier partagé par plusieurs lots : `app/(studio)/videos/[id]/page.tsx` (suivis tableau, cas concret, facecam). Règle : **un seul lot à la fois** dans ce fichier (H8b puis H7) ; ne toucher que l'appel du composant de suivi.

---

## (e) Risques

| Risque | Parade |
|---|---|
| Casser le parcours de production principal (assistant face caméra / avocat) | H8 coupé en trois, après rodage ; captures avant/après ; relecture Opus ; le chemin pas à pas et `DejaFilme` couverts par des tests existants à garder verts. |
| Afficher un prix là où il ne faut pas (face caméra) ou en perdre un (avocat, IV) | test d'adaptateur : `SuiviFabrication` n'a **pas** de champ montant ; les montants restent dans les composants spécifiques ; test rouge « aucun montant sur la face caméra » dans H8b. |
| Deux `BarreActionCollee` à l'écran (gabarit + `RelireScript` / `SuiviLot`) | règle « au plus une » dans le test de contrat ; prop `action` absente pour ces écrans. |
| Barre collée qui masque du contenu à 390 px (case d'accord FCA, choix réseaux IV) | cale `h-24` de `BarreActionCollee` ; captures 390 px obligatoires, en bas de page ; bouton désactivé + raison sous le bouton (comme `Express.tsx:451`). |
| Changer le sondage casse la reprise des travaux | **interdit dans ce plan** : on ne change que le rendu ; adaptateurs purs testés. |
| Texte technique qui fuit dans `SuiviFabrication.message` | `message` uniquement depuis `ErreurLisible`/`ErreurStudio` ; `src/components/creation/**` déjà dans le périmètre de `tests/garde-ecran.test.ts` (vérifier dans H0). |
| Constante dupliquée (durées, libellés d'état) | `tests/garde-regle-unique.test.ts` ; libellés d'état des récents définis dans un seul fichier par générateur. |
| Collision avec 54 / a0 / 7e / #313 / #167 | ordre §c, relevé au départ de chaque lot, signalement dans la PR. |
| Réglage `imageVideo.relireScript` | aucun lot ne l'allume ; les deux branches (allumé/éteint) testées dans H5. |
| Page des traces du tableau (`$` affichés) | hors gabarit (écran d'inspection, pas de création) ; **question à Will** : passer en € ou laisser (non inclus). |

---

## (f) Vérifier de bout en bout

1. **Test de contrat de gabarit** `tests/harmonisation/gabarit-creation.test.ts` (créé en H0) :
   - un registre `ECRANS_CREATION` (chemin de page + composant racine) et une liste `A_FAIRE` qui **ne peut que rétrécir** (le test échoue si un écran conforme y figure encore, ou si un écran y est ajouté) ;
   - pour chaque écran conforme, lecture du source (comme `tests/final-b-mobile.test.ts`) : utilise `GabaritCreation` ; pas d'`EnTeteAssistant` ni de `<h1>` hors `EnTetePage` ; pas de `fixed bottom-0` hors `BarreActionCollee` ; au plus une `BarreActionCollee` sur le chemin de rendu ; un `loading.tsx` dans le dossier de route ;
   - rendu `renderToStaticMarkup` de `GabaritCreation` avec chaque combinaison (étapes ou non, action ou non, récents vides) : ordre des `data-zone`, un seul `h1`, `EtatVide` quand vide.
2. **Tests d'adaptateurs** (`versSuiviFabrication…`, `versRecents…`) par générateur, purs, avec les doubles existants ; **aucun `fetch`**.
3. **Non-régression** : tests existants des écrans touchés verts sans modification de leurs attentes (sauf l'en-tête de l'assistant, à ajuster explicitement dans H8a, annoncé dans la PR) ; `tests/generateurs-grises.test.ts`, `tests/garde-ecran.test.ts`, `tests/garde-regle-unique.test.ts`, `tests/c-ecran-journal.test.ts` verts.
4. **Captures** : `scripts/captures.mjs` (390×844 et 1440×900), une scène par écran et par état (vide, rempli, en cours, arrêté), dans `docs/captures/harmonisation/`, avant et après. Contrôle visuel : en-tête au même endroit, barre d'étapes au même endroit, action collée en bas à 390 px et à droite au bureau, pas de défilement horizontal.
5. **Aucun écran passé en erreur** : en fin de chaque lot, parcours Playwright (mode essai, données d'exemple) de **tous** les écrans du registre — y compris ceux des lots précédents — : statut HTTP 200, pas de texte de `app/(studio)/error.tsx`, pas d'erreur console ; les formats Bientôt restent non cliquables.
6. **Fin du chantier** : liste `A_FAIRE` vide ; un relevé `docs/harmonisation-ecrans/RELEVE-FINAL.md` avec le tableau de l'audit mis à jour (toutes les cases ✅ ou « spécifique, voulu »).

---

## Questions pour Will (n'empêchent pas H0–H3)
1. #167 (cas concret phase 2) : encore d'actualité ? H7 l'attend.
2. Récents de l'assistant face caméra / avocat : sous l'écran « Votre vidéo » (proposé), ou seulement dans « Mes vidéos » ?
3. Traces du tableau en `$` : passer en € ?
