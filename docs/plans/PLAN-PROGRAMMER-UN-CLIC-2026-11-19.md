# Plan : programmer un carrousel en un clic jusqu'au brouillon (2026-11-19)

Plan d'exécution pour le développeur. **Documentation seule** : aucun code produit n'est modifié par ce document.
Périmètre strict : (1) le compte cible « compte-studio », (2) la légende d'un carrousel programmé en un clic,
(3) la mémoire et l'affichage de la dernière raison de refus. **Portes d'envoi réelles inchangées (fermées)** :
aucun réglage écrit, aucune valeur par défaut changée, aucune porte contournée, aucune migration.

---

## 0. Constat (relu dans le code, 19/11)

| # | Fait | Où |
|---|------|----|
| C1 | `programmerEnUnClic` crée le créneau avec `compteCible: "compte-studio"` (constante) et **sans `textes`**. | `src/components/visuels/BoutonProgrammerVisuel.tsx:18`, `:80` |
| C2 | `envoyerVisuel` lève `CRENEAU_INCOMPLET` si `c.textes[reseau].texte` est vide (avant tout appel). | `src/services/publications.ts:1287-1289` |
| C3 | Même avec un texte, `envoyerVisuelValide` passe `[options.cible]` à `ciblesZernioPour` : « compte-studio » n'est pas dans la liste de Zernio → `CIBLE_INCONNUE`. Puis la clé d'envoi, `canalId` et `cible` seraient « compte-studio ». | `src/services/publications.ts:1362`, `:1364`, `:1369`, `:1384`, `:1403-1404` ; `src/services/zernio-cibles.ts:31-37` |
| C4 | La règle « rien de choisi » existe déjà : LinkedIn → l'organisation **seulement s'il n'y en a qu'une**, jamais le profil ; Facebook → **jamais** de page par défaut ; autres réseaux → le compte unique. | `src/services/zernio-cibles.ts:39-52` |
| C5 | `comptesCibles` (chemin « + Ajouter ») ne résout que s'il y a **exactement un** compte relié, lu dans l'instantané du dernier « Tester ». LinkedIn a deux comptes (page + profil) → il rend « compte-studio ». | `src/app/(studio)/calendrier/charger-comptes.ts:15-33` |
| C6 | « compte-studio » est recopié en 4 constantes locales. | `BoutonProgrammerVisuel.tsx:18`, `AjouterDuJour.tsx:9`, `charger-comptes.ts:8`, `calendrier/actions/dupliquer.ts:58` |
| C7 | **Une légende par réseau existe déjà sur le visuel** (L4-13) : `visuels.legende.<id>.<reseau>` = `{ texte, le }` (relue et enregistrée par la personne) ou `{ texte, le, simulation: true }` (« Réécrire », texte automatique). Les actions `enregistrerLegendeAction` / `reecrireLegendeAction` existent mais **aucun écran ne les montre**. | `src/app/(studio)/carrousels/[id]/actions.ts:122-197` ; `src/components/visuels-texte/compteur.ts:19-49` |
| C8 | `programmerVisuel` crée la Publication « manuel » avec `texte: v.titre` : le calendrier montre le **titre** comme si c'était la légende. | `src/services/plan-vers-publication.ts:70-74` |
| C9 | La fiche d'un créneau « programme » est verrouillée (« son texte ne se modifie plus ici ») ; le geste CAL-23 `modifierTexteProgramme` (écrit `c.textes`, version +1, dévalide) existe mais `texteProgrammeModifiable` n'est passé par personne. | `src/components/calendrier/FicheEntree.tsx:126`, `:333` ; `src/services/deplacer-programmation.ts:369-411` ; `src/app/(studio)/calendrier/actions/deplacer.ts:57-86` |
| C10 | Le tour pousse une ligne avec `texte: ""` ; `traiter` appelle l'envoi, qui refuse ; le refus consomme un essai (2 → « à corriger » à vie pour cette clé). La raison n'est que dans `ligne.raison`, jamais gardée. | `src/services/branchement-envoi-calendrier.ts:222` ; `src/services/envoi-depuis-creneau.ts:264-316` |
| C11 | L'écran d'essai ne lit que l'essai et les créneaux éligibles : aucune raison. L'aperçu du calendrier sait déjà afficher `entree.message`. | `src/app/(studio)/reglages/actions-zernio.ts:242-276` ; `src/components/reglages/EssaiBrouillon.tsx:73-79` ; `src/components/calendrier/ApercuPublication.tsx:157` |
| C12 | La semaine et l'agenda sont bâtis depuis les **Publications** (`listerCalendrier`), pas depuis les créneaux : l'entrée d'un carrousel programmé en un clic est `publication:pub_<…>|<reseau>`. | `src/services/publications.ts:1449` ; `src/app/(studio)/calendrier/charger-medias.ts:48-75` |

---

## 1. Décision (1) : « compte-studio » = « rien de choisi », traduit au moment de l'envoi

**Choix : traduire le marqueur en « rien de choisi » juste avant l'appel, contre la liste VIVANTE de Zernio.**
On ne résout pas le compte à la programmation.

Justification :
1. **La résolution à la programmation ne règle pas LinkedIn** : `comptesCibles` exige un compte unique (C5) ; avec page + profil, il rend « compte-studio ». Il faudrait recopier la règle « organisation unique » ailleurs : deux règles qui divergeront.
2. **Une seule règle, un seul endroit** : `ciblesZernioPour` (C4) garde déjà les interdits (profil personnel jamais par défaut, Facebook jamais par défaut, pages interdites, comptes déconnectés).
3. **Liste vivante, pas un instantané** : la programmation lirait l'instantané du dernier « Tester » ; l'envoi lit la liste réelle juste avant l'appel.
4. **Répare l'existant sans migration** : le créneau observé en production, et ceux nés par « + Ajouter » ou « Dupliquer » avec le marqueur, partent sans réécriture en base.
5. Coût : la cible n'est pas visible à la programmation. Compensé par (3) : un refus « Cochez la page… » est désormais gardé et affiché.

Règles d'exécution :
- Le marqueur ne doit **jamais** arriver comme cible choisie à `ciblesZernioPour` (défense à deux niveaux : l'appelant et la fonction).
- La cible **résolue** (`canaux[0].id`) remplace le marqueur partout en aval : clé d'envoi, recherche anti-double envoi, `canalId`, `cible`. Plus d'un canal rendu = refus `CIBLE_AMBIGUE` (ne doit pas arriver avec la règle actuelle, mais jamais d'envoi multiple implicite).
- Côté exclusion « occupe » du tour, un créneau au marqueur compte **toute** publication du média sur ce réseau, quel que soit son `canalId` (prudent : plus d'exclusions, jamais un double).

---

## 2. Décision (2) : la légende vient de la légende du visuel, relue par la personne

D'où vient la légende ? **De la légende par réseau déjà stockée sur le visuel (C7)**, et seulement quand elle a été
**enregistrée par la personne** (pas de drapeau `simulation`). Un texte automatique (« Réécrire ») n'est jamais
copié : il doit d'abord être relu et enregistré. Rien n'est inventé ni envoyé sans geste humain.

Geste minimal, sur la fiche carrousel (`/carrousels/[id]`) :
- **Bloc « Légende »** : une zone de texte par réseau préparé (`v.reseaux`), préremplie avec la légende enregistrée,
  compteur (`compterLegende`) ; si le texte stocké porte `simulation: true`, la mention « Texte automatique : relisez-le,
  puis enregistrez » ; bouton « Enregistrer la légende » → `enregistrerLegendeAction` (existante, inchangée sur la
  validation du texte).
- **« Programmer »** (visuel « valide ») : copie dans `creneau.textes` les légendes enregistrées par la personne. Le clic
  sur « Programmer » valide déjà le créneau au nom du fondateur (code actuel) : la validation couvre donc le texte que la
  personne a écrit. Un réseau **sans** légende enregistrée n'est pas refusé : le créneau est créé, ce réseau est
  **« à compléter »** et la page le dit tout de suite (« LinkedIn : légende à écrire avant tout envoi »).
- **Visuel déjà « programme »** (cas du créneau observé) : « Enregistrer la légende » range le texte puis le reporte
  sur le créneau par les pièces existantes, dans le même clic :
  1. `modifierTexteProgrammeServeur({ creneauId, reseau, texte, auteur, cle })` (auteur = la valeur « fondateur » déjà utilisée par `modifierTexteProgrammeAction`) : garde L5-02d relue, retrait
     chez le diffuseur seulement s'il y a un post (il n'y en a pas : tout a été refusé avant le réseau), `c.textes`
     écrit, **version +1** (clé d'envoi neuve, donc compteur d'essais neuf), créneau « à valider » ;
  2. `programmerEnUnClic(...)` : le créneau existant repasse « valide » avec la trace du fondateur puis « programme ».
  Le bouton dit alors « Enregistrer la légende et la valider pour l'envoi ». Garde refusée (brouillon déjà chez le
  diffuseur, à vérifier, en cours, parti) : rien n'est changé sur le créneau, la phrase de la garde est montrée.
- La Publication « manuel » prend la légende du créneau quand elle existe, sinon le titre comme aujourd'hui (C8).

« À compléter », jamais en silence :
- `traiter` reconnaît un texte vide **avant** tout envoi planifié et tout essai : état `a-completer`, raison
  « Légende à écrire : ouvrez le carrousel et écrivez sa légende. Rien n'est envoyé sans elle. », une notification
  une seule fois par clé, **aucun essai consommé**, aucun appel.
- Calendrier : l'entrée montre « Texte à écrire. » (et non le titre) et le message ci-dessus (voir 3).

Hors périmètre, à noter (ne pas corriger ici) : le texte saisi dans la fiche d'un **créneau** du calendrier est rangé
dans `calendrier.fiche.<clé>` (`src/services/calendrier-fiche.ts:43-49`), jamais dans `c.textes` que lit l'envoi.
Ce chemin n'est pas celui du clic « Programmer » ; il mérite son propre ticket.

---

## 3. Décision (3) : dernière raison de refus par clé d'envoi

Stockage : les états durables existants (`etats`, préfixe `envoi-calendrier:`, collection `parametres`), aucune table.
- `dernier-refus-le:<clé>` = instant ISO, écrit **avant** `dernier-refus:<clé>` = raison (300 signes au plus).
- Écrit par `traiter` pour : `a-completer`, refus avant le réseau (`catch`), heure absente, date illisible.
  **Pas** pour `envoi-eteint` (porte fermée : état normal), ni `a-corriger` (garde la vraie raison précédente).
- Remis à `""` quand l'état passe `brouillon-cree` ou `deja-cree`. Rien n'est supprimé.
- Jamais écrit au journal : la raison peut nommer des pages reliées (message de `ciblesZernioPour`), elle reste en base.
- `<clé>` = `cleEnvoi(visuelId, reseau, c.decalages)` : après une version +1, l'ancienne raison n'est plus montrée.

Affichage :
- **Calendrier** (aperçu semaine et agenda) : `entreesAvecMedias`, pour une entrée de visuel, retrouve le créneau du
  visuel (même `visuelId`, statut `valide` ou `programme`, ni retiré ni refusé, heure sur ce réseau) et pose
  `entree.message` : d'abord « à compléter » si pas de texte, sinon « Dernier envoi refusé le JJ/MM à HH:MM : <raison> ».
  L'aperçu l'affiche déjà (C11).
- **Écran d'essai** : `lireEssaiZernioAction` rend `dernierRefus?: { raison, le }` et `aCompleter?: string` pour le
  créneau de l'essai, et `aCompleter?` pour chaque éligible ; `EssaiBrouillon` les affiche sous la ligne d'état
  (`role="status"`).

---

## 4. Fichiers et lignes à toucher

| Étape | Fichier:lignes | Changement |
|---|---|---|
| E1 | **nouveau** `src/domaine/plan-editorial/compte-par-defaut.ts` | `export const COMPTE_PAR_DEFAUT = "compte-studio"` ; `estCompteParDefaut(v: unknown): boolean`. Pur, importable des deux côtés. |
| E1 | `BoutonProgrammerVisuel.tsx:18`, `AjouterDuJour.tsx:9`, `charger-comptes.ts:8`, `calendrier/actions/dupliquer.ts:58` | Remplacer la constante locale par l'import (même valeur). **Ne pas toucher** `reglages/actions-zernio.ts:81` (autre usage, empreinte). |
| E2 | `src/services/zernio-cibles.ts:30` | `demandees` exclut `estCompteParDefaut(c)` → retombe sur la règle « rien de choisi » (lignes 39-52 inchangées). |
| E3 | `src/services/publications.ts:1362-1404` | `ciblesZernioPour(service, reseau, estCompteParDefaut(options.cible) ? undefined : [options.cible])` ; exiger `canaux.length === 1` sinon `CIBLE_AMBIGUE` ; `const cible = cibles.canaux[0].id` utilisée en 1364, 1369, 1384, 1403, 1404 à la place de `options.cible`. Ligne 1358 (`CIBLE_ZERNIO` si vide) inchangée. |
| E4 | `src/services/branchement-envoi-calendrier.ts:128` | `(estCompteParDefaut(c.compteCible) \|\| !p.canalId \|\| p.canalId === c.compteCible)`. |
| E5 | `src/services/envoi-depuis-creneau.ts:71` | Ajouter `"a-completer"` à `EtatLigneCreneau`. |
| E5 | `src/services/envoi-depuis-creneau.ts:198` (avant `if (!c.heure)`) | `if (!c.texte?.trim())` → `a-completer`, raison, notification unique (`a-completer-notifie:<clé>`), retour sans `creerEnvoi`. |
| E6 | `src/services/envoi-depuis-creneau.ts:129-134`, `:198-206`, `:296-316` | Clés `dernier-refus:` / `dernier-refus-le:` ; helper `noterDernierRefus(deps, cle, raison)` ; export pur `lireDernierRefus(etats, cle)`. Remise à `""` après `brouillon-cree` (l. 297) et `deja-cree` (l. 243, 252). |
| E7 | `src/services/branchement-envoi-calendrier.ts` (après `etatsParametres`, l. 86-94) | Export serveur `etatEnvoiDuCreneau(c: CreneauEditorial, reseau)` → `{ aCompleter?: string; dernierRefus?: { raison; le } }` (lecture seule, ne lève jamais). |
| E8 | `src/components/visuels/BoutonProgrammerVisuel.tsx:62-81` | Paramètre `textes?: Partial<Record<IdReseau, { texte: string; premierCommentaire: string }>>` ; à la création (l. 80), ne garder que les réseaux de `v.reseaux` à texte non vide. Créneau existant : `textes` ignoré (le report passe par E10). Rend `{ creneauId, aCompleter: IdReseau[] }`. |
| E9 | `src/app/(studio)/carrousels/[id]/actions.ts:101-119` | `programmerAction` lit `visuels.legende.<id>.<r>` pour chaque réseau préparé, écarte `simulation: true` et le vide, passe `textes`. |
| E10 | `src/app/(studio)/carrousels/[id]/actions.ts:144-169` | `enregistrerLegendeAction` : si le visuel est « programme » et que son créneau vivant n'a pas ce texte, après l'écriture : `modifierTexteProgrammeServeur` puis `programmerEnUnClic` (voir §2). Refus → `?erreur=` avec la phrase. Rejeu même texte : rien. |
| E11 | `src/services/plan-vers-publication.ts:70-77` | `texte: c.textes?.[reseau]?.texte?.trim() \|\| v.titre` ; Publication existante à la même date dont le texte diffère de la légende du créneau : `modifier({ texte })`. |
| E12 | **nouveau** `src/components/visuels/LegendeReseaux.tsx` ; `src/app/(studio)/carrousels/[id]/page.tsx:73-95` | Bloc « Légende » (statut `valide` ou `programme`, une zone par réseau préparé, mention « texte automatique », « à compléter ») branché sur `enregistrerLegendeAction`. Pas de bouton « Réécrire » ajouté (hors périmètre). |
| E13 | `src/app/(studio)/calendrier/charger-medias.ts:54-75` | Entrée de visuel : `etatEnvoiDuCreneau` → `message` ; si `aCompleter`, `texte: ""`. Une seule lecture du plan par appel (mémo par `visuelId`). |
| E14 | `src/app/(studio)/reglages/actions-zernio.ts:242-276` ; `src/components/reglages/EssaiBrouillon.tsx:73-79` | `EssaiVue.dernierRefus?`, `EssaiVue.aCompleter?`, `EligibleEssai.aCompleter?` ; affichage sous l'état. |

Aucun changement à : `porteCalendrierPour`, `ouverts()`, `essaiCouvre`, `lireEssai` (il compare `compteCible` au
compte posé : inchangé puisque le créneau garde le marqueur), réglages, `CODES_REFUS_STUDIO_AVANT_RESEAU`.

---

## 5. Tests rouges d'abord (écrits et vus échouer avant chaque étape)

| Test (fichier) | Attendu |
|---|---|
| `tests/zernio/cible-compte-par-defaut.test.ts` (nouveau) | `ciblesZernioPour(svc, "linkedin", ["compte-studio"])` avec page + profil → la page seule. Deux pages LinkedIn → `CIBLE_ABSENTE`, jamais le profil. Facebook + marqueur → `CIBLE_ABSENTE`. Instagram un compte → ce compte. Marqueur + id réel → l'id réel seul. |
| `tests/services/envoyer-visuel.test.ts` (ajouts) | Créneau `compteCible: "compte-studio"` + texte, LinkedIn page + profil, porte d'essai ouverte par doublure : la Publication a `canalId` = id de la page, la clé d'envoi contient l'id de la page, jamais « compte-studio ». Porte fermée : `ENVOI_CALENDRIER_FERME`, aucun appel (inchangé). |
| `tests/branchement-envoi-calendrier.test.ts` (ajouts) | Créneau au marqueur + publication du même visuel sous `canalId` réel occupant le compte → exclu « occupe ». Créneau sans texte → ligne `a-completer`, `envoyerReel` jamais appelé, `essais:<clé>` non écrit, une seule notification sur deux tours. |
| `tests/envoi-depuis-creneau-dernier-refus.test.ts` (nouveau, doublures pures) | Refus `CIBLE_ABSENTE` → `dernier-refus:<clé>` = message, `dernier-refus-le:` écrit avant. `envoi-eteint` → rien d'écrit. Puis `brouillon-cree` → `""`. `a-corriger` ne remplace pas la raison précédente. |
| `tests/visuels/programmer.test.ts` (ajouts) | `programmerEnUnClic` avec `textes` LinkedIn → `c.textes.linkedin.texte` écrit, créneau `programme`, validation datée. Sans texte → créneau créé, `aCompleter: ["linkedin"]`. Texte d'un réseau non préparé → ignoré. Publication « manuel » : `texte` = légende ; sans légende = titre. |
| `tests/visuels/legende-vers-creneau.test.ts` (nouveau, doublures) | Légende `simulation: true` → jamais copiée. Visuel « programme », créneau sans texte, aucun envoi chez le diffuseur → texte écrit, `decalages` +1, statut `programme`, `valideeLe` nouveau. Garde « brouillon préparé » → rien changé, phrase de la garde. Rejeu même texte → aucune écriture. |
| `tests/calendrier/message-envoi-entree.test.ts` (nouveau) | Entrée de visuel dont le créneau n'a pas de texte → `message` « Légende à écrire… », `texte` vide. Avec un dernier refus → « Dernier envoi refusé le JJ/MM à HH:MM : … ». Créneau retiré → aucun message. |
| `tests/zernio/essai-brouillon.test.ts` (ajouts) | `lireEssaiZernioAction` rend `dernierRefus` et `aCompleter` pour le créneau de l'essai ; `EssaiBrouillon` les affiche (rendu). |
| Non-régression | Suites existantes vertes : `tests/zernio/fix-linkedin-organisation.test.ts`, `fix-page-interdite-id.test.ts`, `fix-page-doublon.test.ts`, `journal-envoi.test.ts`, `tests/envoi-planifie-vers-envoyerreel.test.ts`, `tests/g7a-programmer.test.ts`, `tests/garde-creneau-diffuseur.test.ts`, `tests/visuels/retirer.test.ts`. Puis `npm run verifier`. |

---

## 6. Ordre des étapes (une PR par lot, chaque lot vert seul)

1. **Lot A — cible** : E1 → E2 → E3 → E4 (tests cible, envoyer-visuel, occupe). Débloque `CIBLE_INCONNUE`.
2. **Lot B — à compléter + raison** : E5 → E6 → E7 (tests branchement, dernier-refus). Plus de refus muet, plus d'essai consommé par un texte manquant.
3. **Lot C — légende** : E8 → E9 → E11 → E10 → E12 (tests programmer, légende vers créneau). La personne écrit ou relit la légende avant l'envoi.
4. **Lot D — affichage** : E13 → E14 (tests calendrier, essai).
5. Vérification manuelle (portes fermées) : écrire la légende du carrousel du créneau observé → créneau version +1, « programme », texte présent ; l'écran d'essai ne montre plus « à compléter ». L'essai réel d'un brouillon reste une décision du fondateur, hors de ce plan.

---

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Le marqueur ciblerait un compte non voulu. | Règle existante seule : page LinkedIn **unique**, jamais le profil, jamais Facebook par défaut ; tests dédiés (§5). |
| Clé d'envoi ou `canalId` encore au marqueur → anti-double envoi aveugle. | Tout l'aval prend l'id résolu (E3) ; test sur la clé. |
| Exclusion « occupe » ratée (publication au `canalId` réel, créneau au marqueur). | E4 : prudent, toute publication du média sur ce réseau compte. |
| « Enregistrer la légende » valide le créneau (visuel déjà programmé). | Libellé explicite du bouton ; même sémantique que « Programmer » qui valide déjà en un clic ; garde L5-02d relue avant ; texte automatique jamais copié. |
| Version +1 : anciens envois planifiés annulés. | Voulu : rien n'est chez le diffuseur (refus avant le réseau) ; `annulerVersionsPerimees` existant, rien supprimé. |
| Texte de la Publication « manuel » changé (E11) : listes « À publier » touchées. | Seulement quand la légende existe ; test ; aucun envoi lié à `via: "manuel"`. |
| La raison stockée contient des noms de pages reliées. | En base seulement (déjà montrés à l'écran) ; jamais au journal ni dans le dépôt. |
| Lecture du plan à chaque affichage du calendrier. | Une lecture par appel, mémo par visuel ; erreur = pas de message (affichage jamais bloqué). |
| Essai posé sur le créneau observé. | `lireEssai` compare `compteCible` au compte posé : le créneau garde le marqueur, donc inchangé ; l'essai couvre le créneau, pas la version. |
| Pastille « Essai » jamais posée sur une entrée de Publication (`charger-medias.ts:56-57` ne regarde que les clés `creneau:`). | Constaté, hors périmètre : à signaler, ne pas corriger dans ce plan. |
