# Plan : retrait branché, fin du brouillon orphelin, essai borné d'UN brouillon chez le diffuseur

Date : 18/11/2026. Conception seule : aucun code produit n'est modifié par ce document.
Base lue : `master` à `4256eef` ; branche `usine/CAL-23` à `a487e50` (PR #1234, pas encore fusionnée).
Ordre de fusion imposé : **CAL-23 (#1234) → PR-A → PR-B**. Rien ici ne duplique CAL-23 : on s'en sert.

---

## 0. Constats sur lesquels le plan repose

Déjà établis (master `4256eef`) :

- **(a)** La création du brouillon d'un créneau exige les trois réglages ouverts (`zernio.envoi_autorise`, `zernio.envoi_calendrier_autorise`, `publication.editoriale_active`) : `envoi-depuis-creneau.ts:150-176` (`ouverts`), porte du tour `branchement-envoi-calendrier.ts:406`, `envoi-visuel-creneau.ts:82`, `publications.ts:1275` et `:1312`, client du fournisseur `fournisseurs/publication/inscription.ts:18`. Le retrait CAL-22 ne les exige que si un post existe (`retirer-programmation.ts:142-151`).
- **(b)** Aucun écran n'appelle `retirerProgrammationAction` (`calendrier/actions/retirer.ts:59`) ni `annulerRetraitAction` (`:79`). `RetirerDuCalendrier.tsx` reste celui des carrousels (`origine === "publication"`, `ApercuPublication.tsx:87`).
- **(c)** Brouillon orphelin : un créneau « valide » dont le brouillon existe chez le diffuseur (garde L5-02d au niveau « brouillon ») **se décale** par `decalerEntree` (accepté avec `AVERTISSEMENT_DECALAGE_BROUILLON`, `garde-creneau-diffuseur.ts`) ; au tour suivant `annulerVersionsPerimees` (`branchement-envoi-calendrier.ts:317-338`) passe l'ancien envoi à « annule » **sans appel** ; le retrait CAL-22 ne regarde que les envois non annulés (`retirer-programmation.ts:135`) : le brouillon reste chez le diffuseur, plus rien ne le voit. Même chose après une dévalidation ou un refus.
- **(d)** L'image de production est `output: "standalone"` (`next.config.ts:40`) : ni sources, ni `tsx`. Aucun script TypeScript ne peut s'y lancer ; tout geste de production passe par un écran ou par la base.
- **(e)** Les paramètres sont relus de la base à chaque prise du verrou des crédits (`donnees/postgres/index.ts:186-197`, `COLLECTIONS_ARGENT` contient `parametres`) : une écriture faite en `psql` est vue à un moment imprévisible.

Lus dans CAL-23 (`usine/CAL-23`) :

- `src/services/deplacer-programmation.ts` fait déjà « retrait confirmé chez le diffuseur, puis nouvelle date et version suivante » (`deplacerProgrammation`), et la modification de texte (`modifierTexteProgramme`). Il annule les anciens envois **après** un retrait confirmé et pose `promotion:<clé>` = `retire` (`sortirDeLaGarde`) : il ne crée pas d'orphelin.
- Mais il est livré **éteint** : `depsDeplacementServeur(diffuseur = null)` ; sans port de retrait et avec un post possible, rien ne change (`PHRASES_DEPLACEMENT.sansRetrait`). Le branchement prévu tient en une ligne : `portRetraitDepuisClient(() => clientZernio())`.
- `portRetraitDepuisClient` ne lit que la **première page** (100) des brouillons et des programmés, alors que CAL-22 en lit jusqu'à 50. Au-delà de 100 : « à vérifier » (échec sûr, mais faux échec).
- `deplacerProgrammationAction` (`actions/deplacer.ts`) n'est appelée par aucun écran ; `texteProgrammeModifiable` de `FicheEntree.tsx` n'est passé par aucun hôte. CAL-23 ne touche pas `ApercuPublication.tsx`.
- `preparer()` refuse (« à vérifier ») un créneau dont la garde voit un brouillon que les envois vivants ne montrent pas (`deplacer-programmation.ts:176`). Un orphelin (envoi annulé) n'élève pas la garde (`brouillon` exige `!annule`), donc ce refus ne le couvre pas.

Remarque transversale : les actions CAL-22 et CAL-23 appellent le diffuseur **sous `sousVerrou`** (verrou global). C'est déjà le choix de ces PR ; le plan le garde tel quel et ne l'aggrave pas (aucun nouvel appel sous verrou hors de ces deux services).

---

## PR-A · « Retrait branché et fin du brouillon orphelin » (après fusion de CAL-23)

### A1. Bouton « Retirer » d'une entrée « créneau » (CAL-22 + annulation)

**Fichiers**

| Fichier | Changement |
|---|---|
| `src/components/calendrier/RetirerProgrammation.tsx` (nouveau) | Composant client en quatre temps : repos → confirmation écrite → résultat → « Annuler » pendant 10 s. |
| `src/components/calendrier/ApercuPublication.tsx` | Calcul `retirableCreneau` et rendu du nouveau composant à côté de `RetirerDuCalendrier` (qui ne change pas). |
| `src/services/calendrier.ts` (ou le module qui construit `EntreeApercu`) | Seulement si l'entrée n'a pas déjà le statut brut du créneau : ajouter `statutCreneau` (lecture, aucune écriture). |
| `tests/calendrier/cal-22b-bouton-retrait.test.tsx` (nouveau) | Tests rouges ci-dessous. |

**Fonctions**

- `retirableCreneau(entree, aujourdhui)` (pure, exportée pour le test) : vrai seulement si `lireCleFiche(entree.cle)?.origine === "creneau"`, statut brut du créneau `valide` ou `programme` (l'état affiché « brouillon » couvre aussi un créneau non validé : il ne suffit pas), jour lisible et `>= aujourdhui`.
- `RetirerProgrammation({ cle })` :
  1. bouton « Retirer du calendrier » ;
  2. confirmation **écrite** : la phrase `PHRASE_CONFIRMATION_RETRAIT_CRENEAU` (« Retirer cette publication du calendrier ? Si un brouillon ou une programmation existe chez le diffuseur, il y sera retiré, puis relu pour le confirmer. Le texte et le fichier sont gardés dans « À placer ». Pour confirmer, tapez retirer. »), un champ texte, et le bouton « Oui, retirer » **inactif tant que le champ ne vaut pas exactement `retirer`** ; la valeur tapée est celle passée à `retirerProgrammationAction(cle, saisie)` (le serveur la revérifie déjà) ;
  3. résultat : `r.message` tel quel (`role="status"` si ok, `role="alert"` sinon) ; rafraîchissement si ok ou si le refus porte des écritures (codes `RETRAIT_A_VERIFIER`, `RETRAIT_A_LA_MAIN`, retrait partiel) ;
  4. « Annuler » visible jusqu'à `annulableJusquA` (compte à rebours, horloge injectable pour le test), appelle `annulerRetraitAction(creneauId)` une seule fois (bouton désactivé pendant l'appel), affiche `message`.

**Tests rouges d'abord** (`cal-22b-bouton-retrait.test.tsx`)

1. Entrée `creneau:` validée, à venir : le bouton existe ; entrée `publication:` carrousel : seul l'ancien `RetirerDuCalendrier` apparaît (non-régression) ; entrée passée, publiée, statut `a_valider` ou `propose` : aucun bouton.
2. « Oui, retirer » est désactivé avec un champ vide, `Retirer`, ` retirer ` ; actif avec `retirer` ; l'action reçoit `(cle, "retirer")`.
3. Un double clic n'appelle l'action qu'une fois.
4. Refus `RETRAIT_RESTE_PROGRAMME` : phrase affichée, aucun « Annuler ». Refus `RETRAIT_A_VERIFIER` : phrase affichée, page rafraîchie.
5. Succès : « Annuler » visible ; après 10 s (horloge simulée) il disparaît ; un clic dans le délai appelle `annulerRetraitAction` avec le `creneauId` rendu.
6. Le composant n'importe aucun fournisseur (même garde que `cal-17-pas-de-fonction-vers-client.test.ts`).

**Ne doit pas bouger** : `RetirerDuCalendrier.tsx`, `retirerDuCalendrier` (carrousels) et leurs tests ; `retirer-programmation.ts` (pour A1) ; le texte des phrases CAL-22.

### A2. Fin du brouillon orphelin (c)

**Options pesées**

1. *Appeler le diffuseur dans `annulerVersionsPerimees`* : refusé. Cette fonction tourne sous `sousVerrou`, dans chaque lecture du dépôt du tour (proxy `lister`), et doit rester sans appel ; un DELETE à cet endroit retirerait sans relecture ni décision du fondateur.
2. *Refuser le décalage au niveau « brouillon »* : sûr mais régressif (le geste le plus courant sur un créneau validé devient impossible) et ne traite pas les orphelins déjà créés.
3. **Retenu : faire passer le décalage d'un créneau « brouillon » par CAL-23, et ajouter un filet pour les orphelins restants.** CAL-23 fait exactement « retrait confirmé puis nouvelle version » ; il suffit de le brancher et d'y router ce cas. Les autres chemins d'annulation silencieuse (dévalidation, refus, plantage) reçoivent une **marque durable** sans appel, et le retrait CAL-22 / le déplacement CAL-23 retirent aussi ce que la marque désigne.

**Fichiers et fonctions**

| Fichier | Changement |
|---|---|
| `src/services/deplacer-programmation.ts` (CAL-23) | `deplacerProgrammationServeur` et `modifierTexteProgrammeServeur` passent `portRetraitDepuisClient(() => clientZernio())` (la ligne prévue par CAL-23). `portRetraitDepuisClient` lit toutes les pages (réutiliser `listerToutesLesPagesZernio` de `services/zernio.ts`, borne 50 pages) au lieu de la seule page 1. `preparer()` ajoute aux `avecPost` les envois **annulés** marqués `orphelin:<clé>` = `a-retirer`. |
| `src/app/(studio)/calendrier/actions/decaler.ts` | Dans `decalerEntree`, sous le même `sousVerrou`, si la garde rend `brouillon` : appeler `deplacerProgrammationServeur({ creneauId, nouveauJour, cle })` et traduire son résultat en `ResultatDecalage` (ok → `{ ok: true, donnees: créneau relu }` ; refus → `{ ok: false, message }`). Niveau `libre` : chemin actuel inchangé. |
| `src/services/branchement-envoi-calendrier.ts` | `annulerVersionsPerimees` et `envoiPerimeAvantPromotion` : quand l'envoi annulé a une `cleDiffuseur` ou `creation:<clé>` = `cree`, noter `orphelin:<clé>` = `a-retirer` (même verrou, même dépôt d'états, **aucun appel**) et une notification « Un brouillon est resté chez le diffuseur : retirez la publication depuis le calendrier ou dans l'outil de publication », une seule fois par clé (`notifierUneFois`, hors verrou comme aujourd'hui). |
| `src/services/retirer-programmation.ts` | `retirerProgrammation` : les envois annulés marqués `orphelin:<clé>` = `a-retirer` rejoignent `avecPost` (ils sont déjà « annule » : seul le retrait chez le diffuseur est fait, puis `orphelin:<clé>` = `retire`). Un créneau **archivé** avec orphelins devient retirable pour ces seuls orphelins (sinon un créneau refusé garde son brouillon pour toujours). |
| `tests/calendrier/cal-22c-orphelin.test.ts`, `tests/calendrier/cal-23b-decaler-brouillon.test.ts` (nouveaux) | Tests rouges ci-dessous. |
| `tests/calendrier/decalage-avertissement.test.tsx` | Mis à jour **explicitement** : au niveau brouillon, l'avertissement n'est plus rendu, car le brouillon n'est plus laissé à l'ancienne date. |

**Tests rouges d'abord**

1. *Le scénario (c) d'aujourd'hui* : créneau valide, envoi avec `cleDiffuseur`, `decalerEntree` vers J+1, puis `annulerVersionsPerimees` ; attendu (rouge sur master) : soit un DELETE confirmé chez le faux diffuseur, soit `orphelin:<clé>` = `a-retirer` posé. Jamais « annule » sans l'un des deux.
2. Niveau brouillon, réglages ouverts : `decalerEntree` appelle le port de retrait **avant** toute écriture ; le créneau prend la version suivante ; l'ancien envoi est « annule » avec `promotion:<clé>` = `retire` ; une seule ligne du journal des décalages.
3. Niveau brouillon, réglages fermés : refus `PHRASES_DEPLACEMENT.eteint`, **aucune** écriture (créneau, envois, journal identiques), aucun appel.
4. Niveau brouillon, retrait « à vérifier » ou « refusé » : ancienne date gardée, marque posée, phrase de CAL-23.
5. Niveau libre : comportement actuel au caractère près (non-régression de `plan-du-jour-decaler.test.tsx`, `cal-11c-deplacer.test.tsx`).
6. Orphelin noté, puis `retirerProgrammation` du créneau (programmé, ou archivé) : DELETE de l'orphelin, marque passée à `retire`, aucun autre post touché. Rejeu : aucun second DELETE.
7. `portRetraitDepuisClient` : un brouillon en page 2 est trouvé et retiré (rouge sur CAL-23 : « à vérifier »).
8. `annulerVersionsPerimees` ne fait **aucun** appel au client (client espion : zéro requête), y compris quand il pose la marque.

**Ne doit pas bouger** : la garde `niveauDiffuseurDuCreneau` (lecture seule, aucun réglage lu) ; `promotion-envois.ts` ; `import-buffer/promotion.ts` ; les trois réglages et leur défaut ; l'absence de tout appel au diffuseur dans `annulerVersionsPerimees` ; la clé d'envoi = créneau + version ; `RetirerDuCalendrier`.

**Taille PR-A** : environ 8 à 10 fichiers, +500 / −40 lignes dont ~60 % de tests. Si la relecture la trouve trop grosse, couper A1 (écran seul) et A2 (services) en deux commits relisibles séparément, pas en deux PR.

---

## PR-B · Mode d'essai borné : UN créneau, UN compte, brouillon seulement

### Jugement

Faisable sans ouvrir les portes générales, **à condition** de ne jamais simuler un réglage ouvert : chaque porte reçoit une seconde condition explicite, nommée « essai », qui ne vaut que pour l'identifiant du créneau d'essai et pour trois gestes (créer le brouillon, déplacer, retirer). Le risque principal est une fuite de contexte (un autre créneau profitant de l'ouverture) ; il est fermé par trois verrous indépendants : le filtre du tour (un seul créneau traité), la vérification de l'identifiant à chaque porte, et la vérification de la forme de la requête au niveau du client (`isDraft: true` seul, aucune promotion). Je recommande donc de le faire. L'alternative, si la relecture le juge malgré tout trop risqué, est en fin de section.

### Le réglage

`zernio.essai_brouillon` (collection `parametres`, même dépôt que les autres réglages) :

```json
{ "version": 1, "creneauId": "…", "compte": "…", "reseau": "linkedin", "poseLe": "2026-…Z", "expireLe": "2026-…Z" }
```

`lireEssai(maintenant)` (nouveau, `src/services/essai-zernio.ts`, `import "server-only"`) rend `EssaiLu | null`. **Toute** anomalie rend `null` (fermé), sans lever :

- valeur absente, `null`, non objet, `version` ≠ 1, champ manquant ou non chaîne ;
- `poseLe` ou `expireLe` illisible, `expireLe <= poseLe`, durée `> 24 h`, `poseLe` dans le futur ;
- créneau introuvable ; créneau sans visuel ou avec vidéo (v1 : visuels seulement, voir plus bas) ; `compteCible` ≠ `compte` ; `heuresParReseau` portant autre chose qu'**un seul** réseau, égal à `reseau` ;
- `zernio.envoi_autorise` vaut `false` (« Tout arrêter » l'emporte toujours) ; clé du diffuseur absente.

`essaiCouvre(creneauId, geste, maintenant)` : vrai seulement si `lireEssai` rend un essai **et** `creneauId === essai.creneauId` (égalité stricte : le créneau `…-reprise` recréé par « Annuler » n'est **pas** couvert) **et** :

- `geste` = `brouillon` ou `deplacement` : `maintenant < expireLe` ;
- `geste` = `retrait` : `maintenant < expireLe + 24 h` (fenêtre de nettoyage : un brouillon d'essai oublié peut encore être retiré depuis l'écran, jamais recréé).

Contexte d'exécution : `dansEssai(creneauId, f)` et `essaiEnCours()` sur un `AsyncLocalStorage` (précédent : `services/autonomie-usine.ts:156`). Le contexte ne porte que l'identifiant ; **chaque** lecture revérifie `essaiCouvre` (expiration et réglage relus), donc un contexte hérité par une tâche détachée n'ouvre rien après l'expiration ou le retrait du réglage, et jamais pour un autre créneau.

Pourquoi les visuels seulement en v1 : le chemin visuel est celui des portes listées en (a) (`envoi-visuel-creneau.ts:82`, `publications.ts:1275/1312`) ; ouvrir aussi le chemin vidéo doublerait les portes à toucher pour un essai qui n'en a pas besoin. Un créneau vidéo désigné = essai illisible = fermé (test).

### Fichiers et fonctions (chaque porte : la condition générale **ou** l'essai, jamais un réglage simulé)

| Fichier | Changement |
|---|---|
| `src/services/essai-zernio.ts` (nouveau) | `PARAM_ESSAI_BROUILLON`, `lireEssai`, `essaiCouvre`, `dansEssai`, `essaiEnCours`, `DUREE_MAX_ESSAI_MS = 24 h`, `FENETRE_NETTOYAGE_MS = 24 h`. |
| `src/services/branchement-envoi-calendrier.ts` | `tourEnvoisCalendrierServeur` : porte générale fermée → si `lireEssai()` rend un essai couvrant `brouillon`, faire un **tour d'essai** : mêmes drapeaux `etatTour` (un tour à la fois, débit 5 min), `marquerPromotionsOrphelines`, `annulerVersionsPerimees` (local), puis `dansEssai(id, () => envoyerDepuisCreneau(deps, id))` — un seul créneau, **jamais** `tourEnvoisCalendrier` (qui promeut). Résultat `{ essai: ligne }`. Le proxy `promouvoir` du client refuse si `essaiEnCours()` (défense en profondeur). Porte générale ouverte : tour actuel inchangé. |
| `src/services/envoi-depuis-creneau.ts` | `DepsEnvoiCreneau.porteEssai?(creneauId)` ; dans `traiter`, `ouverts(deps.reglages) || (deps.porteEssai && await deps.porteEssai(c.id))`. Rien d'autre (fenêtre de 6 jours, marge de 30 min, TikTok, essais : inchangés). |
| `src/services/envoi-visuel-creneau.ts:82` et `src/services/publications.ts:1275`, `:1312` | `publicationEditorialeAutorisee()` devient `porteCalendrierPour(creneauId)` = générale **ou** (`essaiEnCours() === creneauId` et `essaiCouvre(creneauId, "brouillon")`). `envoyerVisuelValide` reçoit le `creneauId` par ses options ; sans lui (appelants hors calendrier), porte générale seule. |
| `src/fournisseurs/publication/inscription.ts:18` | `envoiAutoriseCalendrierClient` = générale **ou** essai en cours couvrant `brouillon`. |
| `src/fournisseurs/publication/zernio.ts` (création) | Si `essaiEnCours()` : refus avant appel si `corps.isDraft !== true` ou si le compte du corps ≠ `essai.compte`. |
| `src/services/retirer-programmation.ts` | `ouverts(d.reglages) || await d.essai?.(c.id, "retrait")` ; câblage serveur : `essai: essaiCouvre`. |
| `src/services/deplacer-programmation.ts` (CAL-23) | `reglagesOuverts()` reçoit l'identifiant : `reglagesOuverts(creneauId)` = générale ou `essaiCouvre(creneauId, "deplacement")`. Le chemin de PR-A (`decalerEntree` → CAL-23) en hérite. |
| `src/app/(studio)/reglages/actions-zernio.ts` | `poserEssaiZernioAction({ creneauId, dureeHeures })` et `retirerEssaiZernioAction()` : `exigerSession`, `sousVerrou`, validation serveur (mêmes règles que `lireEssai`, plus : aucun autre essai actif, durée 1 à 24 h, compte et réseau **lus du créneau**, jamais saisis), `ecrireParametre`, `journaliser("reglages", …)`. Retirer écrit `null`. |
| Écran Réglages › Zernio (composant de la section existante) | Bloc « Essai d'un brouillon » : liste des créneaux éligibles (validés, visuel, un seul réseau, date entre J+1 et J+6), durée, boutons « Poser l'essai » / « Retirer l'essai », état lu (« Essai actif sur … jusqu'à HH:MM, heure de Paris » ou « Aucun essai »). |
| Calendrier (aperçu de l'entrée) | Pastille « Essai » sur la seule entrée couverte (lecture de `lireEssai`). |
| `tests/zernio/essai-brouillon.test.ts` (nouveau) | Tests rouges ci-dessous. |

### Tests rouges d'abord

Lecture du réglage (chacun → fermé, zéro requête au faux client) : absent ; `null` ; chaîne ; `version: 2` ; `expireLe` illisible ; expiré d'une seconde ; durée 24 h + 1 s ; `poseLe` futur ; créneau inexistant ; créneau vidéo ; compte différent ; deux réseaux ; `zernio.envoi_autorise = false` ; lecture du dépôt qui lève.

Portée :
1. Réglage valide sur A, portes générales fermées, créneaux A et B validés et dans la fenêtre : un tour crée **un** brouillon, pour A, avec `isDraft: true` ; B : aucune requête.
2. Même situation : aucun appel à `promouvoir`, aucun PUT, même si le brouillon de A existe déjà (« deja-cree ») ; `promouvoirEnvoisPlanifies` n'est pas appelé.
3. `import-buffer/promotion.ts` et `promotion-envois.ts` restent fermés avec un essai valide (leur porte rend « fermé »).
4. Corps de création avec `isDraft: false` sous essai : refus avant appel. Compte du corps ≠ compte de l'essai : refus avant appel.
5. `envoyerVisuel` pour B pendant que le contexte d'essai porte A : refus `ENVOI_CALENDRIER_FERME`.
6. Retrait de A sous essai : permis jusqu'à `expireLe + 24 h`, refusé ensuite ; retrait de B : `eteint`. Déplacement de A : permis jusqu'à `expireLe`, refusé ensuite (`eteint`, aucune écriture) ; déplacement de B : refusé.
7. « Annuler » un retrait de A : créneau `A-reprise` recréé localement ; le tour d'essai suivant ne crée **aucun** brouillon (non couvert).
8. Contexte hérité : une tâche lancée dans `dansEssai` puis exécutée après expiration ne passe aucune porte.
9. Portes générales ouvertes : comportement actuel identique, réglage d'essai présent ou non.
10. Actions d'écran : sans session, refus ; second essai pendant un essai actif, refus ; créneau non éligible, refus avec phrase ; `retirerEssaiZernioAction` écrit `null` et l'essai devient fermé au tour suivant.

**Ne doit pas bouger** : les trois réglages, leurs défauts et leurs fonctions (`envoiZernioAutorise`, `envoiCalendrierAutorise`, `editorialeActive`, `publicationEditorialeAutorisee`) ; `promotion-envois.ts` ; `import-buffer/promotion.ts` ; la garde PUT de `zernio-client.ts` (`promouvoir` seul, `isDraft: false` seul pour la promotion) ; la garde L5-02d ; le chemin vidéo.

**Taille PR-B** : environ 12 fichiers, +650 / −30 lignes, dont ~55 % de tests. C'est la plus délicate : relecture adversariale demandée sur les portes (« un autre créneau peut-il passer ? »).

### Alternative si (3) est jugé trop risqué

Ne rien ouvrir côté Studio pour un seul créneau. Tester le retrait et le déplacement contre un **faux diffuseur** (`injecterClientZernio`, tests et préproduction), puis faire la première création réelle en ouvrant les trois réglages pendant une fenêtre courte, avec **un seul** créneau validé dans les 6 jours. (Créer le brouillon à la main dans l'outil de publication ne teste rien : le Studio ne le retrouverait pas, faute de la clé `studioCle` qu'il calcule lui-même.) Inconvénient : pendant cette fenêtre, toute validation d'un autre créneau partirait aussi, et la promotion est ouverte. C'est précisément ce que (3) évite ; c'est pourquoi (3) est recommandé.

---

## Protocole d'essai, après fusion et mise en ligne de CAL-23, PR-A et PR-B

**Avant de commencer** (Réglages › Zernio) : « Tout arrêter » **non** actif ; envoi du calendrier **fermé** ; publication éditoriale **éteinte**. Choisir un créneau carrousel validé, **un seul réseau**, sur le compte voulu, daté entre J+2 et J+5. Dans l'outil de publication, noter le nombre de brouillons du compte.

**Critère d'arrêt global, à tout moment** : un post « programmé » ou « publié » apparaît chez le diffuseur, un post apparaît pour un autre créneau ou un autre compte, ou deux brouillons du créneau coexistent plus de 10 minutes → cliquer **« Tout arrêter »** (Réglages › Zernio), puis « Retirer l'essai », puis supprimer à la main le post en trop dans l'outil de publication, et noter l'heure et l'écran.

| # | Écran et geste | Attendu | Arrêt si |
|---|---|---|---|
| 1 | Réglages › Zernio › Essai : choisir le créneau, durée 4 h, « Poser l'essai ». | « Essai actif sur … jusqu'à HH:MM » ; ligne au journal des réglages ; pastille « Essai » sur la seule entrée choisie. | Une autre entrée porte la pastille, ou l'écran accepte un créneau non éligible. |
| 2 | Attendre au plus 10 min (tour toutes les 5 min). Calendrier, aperçu de l'entrée. | L'entrée dit « brouillon préparé » ; chez le diffuseur : **un** brouillon de plus, bon compte, bonne date, statut brouillon. | Statut « programmé », mauvais compte, plus d'un post, ou rien après 15 min (lire alors la santé de la boucle avant de recommencer). |
| 3 | Aperçu de l'entrée : changer la date d'un jour. | « Déplacée au JJ/MM… » ; l'ancien brouillon disparaît chez le diffuseur ; dans les 10 min, un seul nouveau brouillon à la nouvelle date ; une ligne au journal des décalages. | L'ancien brouillon reste, ou « à vérifier » : vérifier à la main chez le diffuseur avant tout autre geste. |
| 4 | Aperçu : « Retirer du calendrier », taper `retirer`, « Oui, retirer ». | « Retirée du calendrier… » ; l'entrée est dans « À placer » ; chez le diffuseur, le brouillon n'existe plus. | « à vérifier » ou « à retirer à la main » : retirer à la main, puis « Retirer l'essai ». |
| 5 | (Facultatif) refaire 1 à 2 sur un créneau neuf, puis « Annuler » dans les 10 s après un retrait. | L'entrée revient à sa date ; **aucun** brouillon recréé (le créneau `…-reprise` n'est pas couvert). | Un brouillon réapparaît. |
| 6 | Réglages › Zernio › « Retirer l'essai ». | « Aucun essai » ; pastille disparue ; le tour suivant rend « porte fermée ». | L'état reste « actif » après rechargement. |
| 7 | Contrôle final chez le diffuseur. | Le nombre de brouillons du compte est revenu à celui noté au départ. | Écart : retirer le reste à la main. |

L'expiration (4 h ici, 24 h au plus) ferme d'elle-même la création et le déplacement ; le retrait depuis l'écran reste possible 24 h de plus.

---

## Poser et retirer le réglage d'essai en production

**Par l'écran (seule voie recommandée)** : Réglages › Zernio › « Essai d'un brouillon ». L'écriture est faite par le processus du Studio lui-même : elle est vue tout de suite, sans dépendre de la relecture des paramètres (e). Le compte et le réseau sont lus du créneau, jamais tapés.

**Par la base, en secours seulement** (écran indisponible) : l'image `standalone` n'a ni sources ni `tsx` (d), donc aucun script. Comme une écriture `psql` est vue à un moment imprévisible (e), elle doit être suivie du redémarrage du **seul** conteneur `studio` :

1. Lire la forme d'une ligne existante : `SELECT data FROM documents WHERE collection = 'parametres' AND id = 'publication.editoriale_active';` et recopier exactement cette forme (champs `id`, `valeur`, `creeLe`, `modifieLe`).
2. Poser : `INSERT INTO documents (collection, id, data, modifie_le) VALUES ('parametres', 'zernio.essai_brouillon', '{"id":"zernio.essai_brouillon","valeur":{"version":1,"creneauId":"…","compte":"…","reseau":"…","poseLe":"…Z","expireLe":"…Z"},"creeLe":"…Z","modifieLe":"…Z"}', now()) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now();` — `poseLe` = maintenant, `expireLe` ≤ `poseLe` + 24 h.
3. Redémarrer le seul conteneur : `docker compose restart studio` (depuis le dossier `deploiement/`) ; ne toucher ni `base`, ni `studio-rendu`, ni `studio-aligneur`.
4. Retirer : même requête avec `"valeur": null`, puis le même redémarrage. Un réglage mal écrit est lu « fermé » : l'erreur de saisie est sûre, elle n'ouvre rien.

---

## Retour arrière

- **Arrêt immédiat, sans mise en ligne** : « Tout arrêter » (coupe toute écriture vers le diffuseur, essai compris, car `lireEssai` l'exige) ; puis « Retirer l'essai ». L'expiration ferme de toute façon l'essai en 24 h au plus.
- **PR-B** : revenir sur le commit de fusion de PR-B et remettre en ligne (`deploiement/revenir.sh`). Le réglage `zernio.essai_brouillon` restant en base n'est plus lu par personne ; l'effacer ensuite par l'écran (si encore là) ou le laisser (inerte).
- **PR-A** : revenir sur sa fusion. Le décalage au niveau brouillon retrouve l'avertissement d'avant (et donc le risque d'orphelin) ; les marques `orphelin:<clé>` déjà posées restent inertes. Le bouton disparaît ; `retirerProgrammationAction` redevient sans écran.
- **Données** : aucune des deux PR ne supprime rien ; les envois passent à « annule », les créneaux à « archive », comme aujourd'hui. Un brouillon d'essai resté chez le diffuseur après un retour arrière se retire à la main dans l'outil de publication (compter : au plus un par créneau d'essai).
