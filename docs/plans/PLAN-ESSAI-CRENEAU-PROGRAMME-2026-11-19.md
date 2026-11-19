# Plan — Essai d'un brouillon sur un créneau « programmé en un clic » (19/11/2026)

Rôle : conception seulement. Aucun code ici. Références prises sur `master` à `c63bf02`.

## 0. Constat (reproduit à la lecture du code)

1. Le seul geste de l'interface qui met un carrousel validé au calendrier est « Programmer » sur la fiche carrousel :
   `programmerEnUnClic` (`src/components/visuels/BoutonProgrammerVisuel.tsx:62-85`) crée le créneau (l.80), le valide
   (`validerParLeFondateur`, l.34-41 : `statut: "valide"`, `valideeLe`, `valideePar: "fondateur"`), puis appelle
   `programmerVisuel` (l.83).
2. `programmerVisuel` (`src/services/plan-vers-publication.ts:28-86`) crée une Publication par réseau
   `{ statut: "programmee", via: "manuel" }` (l.71-74), passe le **visuel** à `programme` (l.80-83) et le **créneau** à
   `programme` (l.84). C'est le seul endroit du code qui écrit le statut `programme` sur un créneau (l'usine ne peut pas l'écrire,
   `src/domaine/plan-editorial/statuts.ts:1`).
3. L'essai (#1284) n'accepte que `statut === "valide"` (`src/services/essai-zernio.ts:44`) ; l'écran filtre avec la même fonction
   (`src/app/(studio)/reglages/actions-zernio.ts:268`) et la pose la revérifie (l.320-321). Aucun créneau n'est donc jamais
   éligible.

## 1. Question 1 — Quel chemin enverrait ce carrousel à Zernio quand les portes s'ouvriront ?

**Réponse : AUCUN.** Un carrousel programmé en un clic ne partira jamais chez le diffuseur, même avec
`zernio.envoi_calendrier_autorise` et `publication.editoriale_active` ouverts. C'est un trou plus grave que l'essai : l'écran
affiche « Programmé » (pastille sauge, `statuts.ts:232`) pour un contenu que rien n'enverra.

Il n'existe qu'**un** chemin d'envoi d'un visuel du calendrier, et chacune de ses portes exige `valide` :

| Étape | Fichier:ligne | Garde qui écarte le créneau / visuel `programme` |
|---|---|---|
| Lancement | `src/services/boucle.ts:310` | `tourEnvoisCalendrierServeur()` (seule boucle) |
| Lignes du tour | `src/services/branchement-envoi-calendrier.ts:113-114` (`valideEnvoyable`), appliqué l.176 | `c.statut === "valide"` → le créneau `programme` n'a **aucune ligne** |
| Versions périmées | `branchement-envoi-calendrier.ts:321-322` (`estPerime`) | `c.statut !== "valide"` → tout envoi planifié d'un créneau `programme` est **annulé** à chaque tour (et juste avant la promotion, l.367) |
| Traitement | `src/services/envoi-depuis-creneau.ts:182` (`traiter`) | `c.statut !== "valide"` → `non-valide` |
| Envoi visuel | `src/services/envoi-visuel-creneau.ts:85` | `c.statut !== "valide"` → `CRENEAU_NON_VALIDE` |
| Envoi visuel (cœur) | `src/services/publications.ts:1279` (`envoyerVisuel`) | `c.statut !== "valide"` → `CRENEAU_NON_VALIDE` |
| Envoi visuel (cœur) | `src/services/publications.ts:1328` (`envoyerVisuelValide`) | **visuel** `v.statut !== "valide"` → `VISUEL_NON_VALIDE` (or `programmerVisuel` l'a mis à `programme`) |

Les autres appelants (`a-publier-zernio.ts:181` `envoyerVisuelAction`, `reprise-envois.ts:69`) passent par `envoyerVisuel` :
mêmes refus.

Les Publications `programmee` / `via: "manuel"` ne sont consommées par **aucun** moteur d'envoi :
- la synchro Zernio ne suit que `via === "zernio"` avec `idExterne` (`src/services/zernio.ts:394`) ; la synchro Buffer que
  `via === "buffer"` (`src/services/buffer.ts:424`) ;
- `occupeBuffer` les ignore (`src/domaine/buffer.ts:167-168` → `estChezUnOutil`, `src/domaine/outil-publication.ts:42`) ;
- `grep "via === \"manuel\""` dans `src/` : seul `retirerVisuel` les lit (`plan-vers-publication.ts:120`), pour les effacer.

Ce sont des lignes d'affichage du Studio, rien d'autre (le commentaire d'en-tête le dit : `plan-vers-publication.ts:3-4`,
« l'envoi reste décidé ailleurs »). Or « ailleurs » refuse ce créneau.

Indice que le chemin prévu est bien « créneau `valide` → brouillon → promotion → le visuel suit » : la synchro fait elle-même passer
le visuel à `programme` quand le diffuseur confirme (`zernio.ts:290-302`, `visuelSuitDiffuseur`). Le bouton « Programmer » saute
cette étape et met le créneau dans un état que le tour ne lit pas.

## 2. Question 2 — Correction minimale et sûre

### 2.1 Principe retenu

Un essai ne prouve quelque chose que s'il emprunte le chemin réel. Le chemin réel refusant `programme`, la correction minimale
**ouvre le chemin réel** au créneau programmé en un clic, avec **un seul prédicat partagé** utilisé à la fois par l'essai et par le
tour. Pas de second chemin, pas de cas particulier « essai ».

Écarté : faire s'arrêter « Programmer » à `valide` (sans `programmerVisuel`). Cela changerait l'écran (« Retirer du calendrier »
exige `programme`, `plan-vers-publication.ts:125-126`), le calendrier et les carrousels déjà programmés en production resteraient
bloqués (il faudrait migrer). Trop large.

### 2.2 Pourquoi accepter `programme` est sûr

- `programme` sur un créneau ne vient que de la passerelle en un clic (point 0.2) : il veut dire « placé par le Studio, rien chez
  le diffuseur ». Ce n'est pas un état « déjà envoyé ».
- L'anti-double envoi ne repose pas sur le statut du créneau : il repose sur les envois planifiés par version
  (`branchement-envoi-calendrier.ts:189` exclut une version déjà `programme/confirme/a-envoyer/envoye`), sur l'état
  `creation:<clé>` (`envoi-depuis-creneau.ts:241-259`), sur `occupantsDuCompte` (l.128-135) et sur la réservation sous verrou
  d'`envoyerVisuelValide` (`publications.ts:1362-1372`). Tous restent en place.
- Les Publications `manuel` ne comptent pas comme « chez un outil » : elles ne bloquent ni `occupantsDuCompte` ni
  `DEJA_DANS_OUTIL` (vérifié : `occupeBuffer` → `estChezUnOutil`).
- Le retrait et le déplacement côté diffuseur acceptent déjà `programme`
  (`src/services/retirer-programmation.ts:137,200,214` ; `src/services/deplacer-programmation.ts:158,266,274`).
- Les portes ne changent pas : fermées en production, le tour général ne fait rien (`branchement-envoi-calendrier.ts:406-420`).

### 2.3 Fichiers et fonctions

**Nouveau — `src/domaine/plan-editorial/envoyable.ts`** (pur, sans `server-only`) :
- `STATUTS_CRENEAU_ENVOYABLES = ["valide", "programme"] as const`
- `creneauEnvoyable(c, maintenantMs?)` : statut ∈ liste, `valideeLe` lisible (et ≤ maintenant si fourni), ni `refuseLe`, ni
  `retireLe`, ni `aRenvoyer`. Rend `boolean`.
- `visuelEnvoyable(v)` : `v.statut ∈ { "valide", "programme" }`.
- En-tête : « `programme` = placé en un clic par le Studio (`plan-vers-publication.ts`), jamais une preuve d'envoi ».

**Remplacements (une ligne chacun, rien d'autre) :**

| Fichier:ligne | Avant | Après |
|---|---|---|
| `src/services/branchement-envoi-calendrier.ts:113-114` | `valideEnvoyable` codé en dur | `valideEnvoyable = (c) => creneauEnvoyable(c)` |
| `branchement-envoi-calendrier.ts:321-322` (`estPerime`) | `c.statut !== "valide"` | `!creneauEnvoyable(c)` (garder `e.versionCreneau < c.decalages`) |
| `src/services/envoi-depuis-creneau.ts:182` | `c.statut !== "valide"` | `!STATUTS_CRENEAU_ENVOYABLES.includes(c.statut)` (la date de validation reste vérifiée par `valideeLisible`) |
| `src/services/envoi-visuel-creneau.ts:85` | `c.statut !== "valide"` | `!creneauEnvoyable(c)` |
| `src/services/publications.ts:1279` | `c.statut !== "valide"` | `!creneauEnvoyable(c)` (la ligne 1281 garde la date) |
| `src/services/publications.ts:1328` | `v.statut !== "valide"` | `!visuelEnvoyable(v)` (corbeille, démo, simulation inchangés) |
| `src/services/essai-zernio.ts:44` (`raisonNonEligible`) | `c.statut !== "valide"` | `!creneauEnvoyable(c)` + ajout de `aRenvoyer` au type d'entrée ; phrase : « Ce créneau n'est ni validé ni programmé… » |

Le champ `statut` de `CreneauCalendrier` (`envoi-depuis-creneau.ts:42`) reste `string` ; aucun type public ne change.

**Aucun changement** : `programmerEnUnClic`, `programmerVisuel`, les trois réglages, `lireEssai`, `essaiCouvre`, `dansEssai`,
`verifierCorpsSousEssai`, le proxy `promouvoir` (`branchement-envoi-calendrier.ts:275`), le tour d'essai (l.438-451).

### 2.4 Garanties de #1284 : où elles restent tenues

| Garantie | Tenue par (inchangé) |
|---|---|
| Jamais `programmé`/`publié` chez le diffuseur | `verifierCorpsSousEssai` exige `isDraft === true` (`essai-zernio.ts:131`) ; le tour d'essai n'appelle jamais `tourEnvoisCalendrier` (`branchement-envoi-calendrier.ts:439`) ; le proxy refuse `promouvoir` sous essai (l.275) ; marque `essai:<clé>` (l.445) écartant toute promotion générale ultérieure |
| Un seul brouillon | un créneau, un réseau (`raisonNonEligible`, l.46-47 ; `lireEssai`, l.67-68) ; égalité stricte de l'identifiant (`essaiCouvre`, l.82) ; `creation:<clé>` + réservation sous verrou |
| Retrait possible | `retirer-programmation.ts` accepte `programme` (l.137, l.200) et l'essai `retrait` (l.320, fenêtre `expireLe + 24 h`) |
| « Tout arrêter » | `lireEssai` → `envoiZernioAutorise() === false` → `null` (`essai-zernio.ts:69`) ; pose refusée (`actions-zernio.ts:311-313`) |
| Expiration | `lireEssai` l.62-64, `essaiCouvre` l.84 ; relu à chaque porte |

### 2.5 Tests rouges à écrire D'ABORD (doivent échouer sur `master`)

Dans `tests/zernio/essai-brouillon.test.ts` (doublures déjà en place, l.100-160) :
1. **Éligibilité** : un créneau construit par `programmerEnUnClic` (vrai code, dépôts mémoire) avec `v.reseaux = ["linkedin"]` et un
   jour à J+2 → `raisonNonEligible(...) === null` ; il apparaît dans `lireEssaiZernioAction().eligibles`. Contre-cas toujours
   refusés : `programme` sans `valideeLe`, `programme` + `retireLe`, `programme` + `aRenvoyer`, deux réseaux, vidéo.
2. **Bout en bout de l'essai** : même créneau ; `poserEssaiZernioAction({ creneauId, dureeHeures: 2 })` réussit ;
   `tourEnvoisCalendrierServeur` (portes générales fermées) → exactement **un** `service.envoyer` en `mode: "brouillon"`, corps
   `isDraft: true` sur le compte de l'essai ; **zéro** `promouvoir` ; l'envoi planifié n'est pas `annule` ; second tour (après
   5 min) → `deja-cree`, aucun nouvel appel.
3. **Garanties** sur ce même créneau `programme` : « Tout arrêter » (`zernio.envoi_autorise = false`) → `porte-fermee`, zéro appel ;
   après `expireLe` → zéro appel ; retrait du brouillon par `retirer-programmation` sous essai → créneau `archive` + `retireLe`,
   visuel `valide`.

Dans `tests/branchement-envoi-calendrier.test.ts` (le trou de la question 1) :
4. Portes générales ouvertes (injections `porte`, `reglages` à `true`), créneau programmé en un clic J+2 → une ligne, un brouillon
   créé via `envoyerVisuelDuCreneau`. (Rouge aujourd'hui : aucune ligne.)
5. `annulerVersionsPerimees` : un envoi `valide` d'un créneau `programme` n'est **pas** annulé ; il l'est toujours si le créneau a
   `retireLe`, `refuseLe` ou une version plus récente.
6. Non-régression : créneau `programme` avec `videoId` → exclu « vidéo » ; `valideePar: "usine:…"` → ignoré sans bruit.

Dans `tests/envoi/visuel-creneau.test.ts` :
7. `envoyerVisuel` avec visuel `programme` et une Publication `manuel/programmee` du même visuel et réseau → passe (pas de
   `DEJA_DANS_OUTIL`) ; avec une Publication `via: "zernio"` active → `DEJA_DANS_OUTIL` (inchangé) ; visuel `a_valider` ou en
   corbeille → `VISUEL_NON_VALIDE` (inchangé).

Nouveau `tests/domaine/plan-editorial-envoyable.test.ts` : table de vérité de `creneauEnvoyable` / `visuelEnvoyable`.

### 2.6 Risques

- **R1 — décision à confirmer (fondateur)** : une fois les portes ouvertes, tout carrousel programmé en un clic dans la fenêtre
  J+0,5 h…J+6 deviendra brouillon puis sera promu (programmé chez le diffuseur). C'est le sens attendu de « Programmer », mais
  c'est un changement de comportement du chemin général. Tant que les portes restent fermées, seul l'essai est concerné.
- **R2 — double ligne d'affichage** : après le brouillon, le visuel a sa Publication `manuel/programmee` ET une Publication
  `zernio/brouillon` pour le même réseau. Rien ne part deux fois (la `manuel` n'est consommée par personne), mais le calendrier et
  « À publier » peuvent afficher deux lignes. Suite à prévoir (hors de ce lot) : effacer la ligne `manuel` du même visuel et réseau
  quand la Publication `zernio` est créée.
- **R3 — ligne `manuel` orpheline après un retrait CAL-22** (préexistant) : `retirer-programmation.ts` ne touche pas aux
  Publications ; une seconde programmation du même carrousel à une autre date est alors refusée par `programmerVisuel` (l.64-66).
  À noter dans le même ticket que R2.
- **R4 — fenêtre de l'essai et jour par défaut** : « Programmer » propose demain (`jourParDefautParis`) à 08:30 / 12:30 / 17:30,
  souvent à moins de 24 h ; `raisonNonEligible` exige au moins `maintenant + 24 h` (`essai-zernio.ts:49`). Pour l'essai, choisir
  J+2. Ne pas changer la borne dans ce lot.
- **R5 — visuel `programme` accepté par `envoyerVisuelValide`** : élargit aussi `envoyerVisuelAction` et `reprise-envois` ; ils
  restent derrière la même porte et la même réservation. Couvert par le test 7.

### 2.7 Retour arrière

1. Si un brouillon d'essai existe : le retirer depuis le calendrier (retrait CAL-22, couvert 24 h après `expireLe`), puis
   « Retirer l'essai » dans Réglages.
2. Revenir sur le commit (un seul commit de code + ses tests). Aucune migration, aucun réglage nouveau, aucune valeur par défaut
   changée : rien à défaire en base.
3. Après retour arrière, un envoi planifié resté `valide` sur un créneau `programme` sera annulé au tour suivant par `estPerime`
   (annulé, jamais effacé) ; un brouillon resté chez le diffuseur se retire à la main.

## 3. Question 3 — Cases réseaux de la fiche carrousel

Constat : `src/app/(studio)/carrousels/[id]/page.tsx:75-77` coche LinkedIn et Instagram en dur ; `VueCarrouselFiche`
(`src/domaine/visuels/contrats.ts:72-89`) ne porte pas `reseaux` ; `ficheCarrousel` (`src/visuels/services/vues.ts:74-100`) ne le
lit pas, alors que `preparerPourReseaux` l'enregistre (`src/visuels/services/carrousels.ts:276`).

Correctif :
- `contrats.ts` : ajouter `reseaux?: Reseau[]` à `VueCarrouselFiche`.
- `vues.ts` (retour de `ficheCarrousel`) : `...(v.reseaux?.length ? { reseaux: v.reseaux } : {})`.
- `page.tsx:75-77` : `defaultChecked={coche("linkedin")}` etc., avec
  `const coche = (r) => fiche.reseaux ? fiche.reseaux.includes(r) : r !== "facebook";` (sans `reseaux` : comportement actuel).

Test rouge : `ficheCarrousel` rend `reseaux: ["facebook"]` quand le visuel l'a, rien sinon ; rendu de la page (modèle :
`tests/visuels/inf-01-ecran-infographie.test.tsx`) : seule la case Facebook est cochée pour `["facebook"]`, LinkedIn + Instagram
sans `reseaux`. Risque nul (affichage seulement). Retour arrière : revenir sur le commit.

## 4. Découpage et ordre

1. **PR A (indépendante, petite)** : question 3.
2. **PR B** : prédicat partagé + sept remplacements + tests 1 à 7 (essai et chemin réel ensemble : un seul prédicat, sinon l'essai
   ne prouve rien). Relecture attentive de `estPerime` (annulation) et de `publications.ts:1328`.
3. **Ticket de suite** : R2 et R3 (ligne `manuel` remplacée par la Publication du diffuseur ; nettoyage au retrait).

Rien n'est fusionné par ce plan.
