# Ajouter un format de vidéo

Ce guide dit comment inscrire un nouveau format dans le studio **sans toucher au reste**. Il décrit l'état du code de `master` : quand une étape est encore faite à la main (plusieurs fichiers en dur), c'est écrit.

Règle d'or : un format neuf **déclare** ce qu'il veut (des données) ; il ne réécrit rien de ce qui est commun.

## 1. Liste de contrôle, dans cet ordre

| # | Geste | Fichier | Nature |
|---|---|---|---|
| 1 | Réserver un code de 2 ou 3 lettres, jamais déjà pris (ni dans le studio, ni dans les codes de comptes de l'Usine) | `src/formats/registre-codes.ts` | 1 ligne, en ajout seul |
| 2 | Créer la fiche du format, statut `masque` | `src/formats/<id>/index.ts` | données |
| 3 | Inscrire la fiche dans la liste `FORMATS` | `src/formats/index.ts` | 1 ligne |
| 4 | Inscrire le moteur | `src/moteurs/ids.ts` (`IDS_MOTEURS`) et `src/moteurs/index.ts` | 2 lignes |
| 5 | Écrire le moteur mince, qui orchestre les briques communes | `src/moteurs/montage-<id>/` | dossier neuf |
| 6 | Écrire les compositions propres, si besoin | `studio-rendu/compositions/<id>/`, plus une ligne dans `studio-rendu/compositions/Racine.tsx` | dossier neuf + 1 ligne |
| 7 | Inscrire l'agent monteur, si le format en a un | `src/moteurs/monteurs.ts` | 1 ligne |
| 8 | Brancher le test de contrat | `tests/<id>/contrat.test.ts` appelant `testerMoteurVideo` | test |
| 9 | Écrire la page du format | `docs/formats/<id>.md` | doc |
| 10 | Passer le statut à `actif` | la fiche (un mot) | **par Will seul** |

Aujourd'hui ces raccordements sont faits **à la main, un fichier à la fois** : il n'existe pas encore de registre unique qui les rende automatiques. Ne pas oublier une ligne : rien ne le signale encore (voir § 2).

Le format peut aussi déclarer, dans sa fiche, les champs facultatifs `pieces` (les pièces communes qu'il demande : habillage, stylo, dessins, sons, fin, voix, rendu, contrôle de l'image) et `ecranVideo` (ce que l'écran de la vidéo affiche ou masque). Voir `src/formats/types.ts`, interfaces `PiecesFormat` et `EcranVideoFormat`.

## 2. Tests à passer

| Test | Où | Ce qu'il garantit | État |
|---|---|---|---|
| Contrat des moteurs : `testerMoteurVideo(moteur, …)` | `src/moteurs/contrat.ts` | Le moteur respecte le contrat commun | Existe |
| Registre des formats (identifiants uniques, cohérence des fiches, pièces déclarées bien formées) | `src/formats/registre.test.ts` | La fiche est cohérente | Existe |
| Test propre au format | `src/formats/<id>/<id>.test.ts` (exemple : `src/formats/tableau-anime/tableau-anime.test.ts`) | La fiche dit ce qu'elle doit dire | À écrire par le format |
| Rien en dur dans le générateur de scripts | `tests/g1a-format-test.test.ts` | Le générateur reste intact | Existe |
| Mise en ligne : la fabrication reste `en_cours` du premier appel payant à la fin (§ 5) | `tests/fabrications-en-cours-tous-formats.test.ts` | Une mise en ligne n'interrompt jamais la vidéo | Existe, parcourt le registre |
| Mise en ligne : après un redémarrage, la fabrication repart seule (§ 5) | `tests/fabrications-redemarrage-tous-formats.test.ts` | Rien n'attend un geste de Will | Existe, parcourt le registre |
| « Inscrit partout » (code, moteur, monteur, stylo, habillage) | — | Plus d'oubli silencieux | **Pas encore écrit** |
| « Aucun import croisé » entre formats | — | Plus de couplage caché | **Pas encore écrit** (aucune règle ESLint de ce genre dans `eslint.config.mjs`) |
| « Aucune couleur ni police en dur » dans les compositions | — | La marque reste une | **Pas encore écrit** |
| Vidéos témoins (3 fiches de référence par format) | — | Une pièce commune ne casse pas un format | **Pas encore écrit** |

Avant d'ouvrir la PR : tests ciblés, puis la suite Vitest complète, `tsc --noEmit` (après `next typegen`) et `eslint` sur vos fichiers.

## 2 bis. Règle d'entrée d'écriture (lot C1.6, 18/10/2026)

Un nouveau générateur de scripts **ne peut pas être `actif`** sans ces quatre pièces communes :

1. la **recette commune** d'écriture ;
2. la **mémoire anti-copie commune** (`src/services/memoire-ecriture.ts`, une fenêtre de 60 versions partagée) ;
3. les **contrôles communs** (dont la ressemblance, `src/domaine/ecriture-commune/ressemblance.ts`) ;
4. un **débit mesuré** (scripts par heure, relevé sur de vrais essais).

Le test `tests/formats/contrat-ecriture.test.ts` (fonction pure `verifierContratEcriture`, `src/domaine/ecriture-commune/contrat-format.ts`) échoue si un format `actif` (ou masqué mais ouvert dans la navigation) n'a ni contrat complet (`CONTRATS_ECRITURE`) ni exception datée (`EXCEPTIONS_ECRITURE`).

Lot G4 (19/10/2026) : les contrats sont **réels**. `CONTRATS_ECRITURE` déclare les pièces de `facecam`, `tableau-anime` et `cas-concret` ; chaque pièce à `true` pointe dans `PREUVES_CONTRAT` un module et une constante qui existent (`verifierPreuvesContrat` échoue sur un module ou une constante absents). Un format sous contrat partiel n'est excepté que pour ce qui lui manque (`pieces`). Chaque preuve nomme aussi le module écrivain du format (`utilisePar`) : le test vérifie par lecture de fichier que ce module importe NOMMÉMENT ce symbole depuis le module de la preuve (instruction `import { … }` ou `import()` dynamique destructuré) ; un autre symbole du même module, ou un homonyme venu d'ailleurs, ne suffit pas. Le repli « import du module » ne vaut que pour une preuve sans symbole.

**Face caméra : contrat valable pour la CHAÎNE COURTE SEULEMENT.** Recette, mémoire et contrôle de ressemblance ne sont branchés que dans `chaine-courte.ts` / `boucle-generation.ts`. La grande chaîne et `equipe` n'ont rien de tout cela (verrouillées depuis le 23/10/2026 : plus aucune nouvelle écriture n'y passe, seules les écritures déjà lancées y reprennent) : exception datée à périmètre (`perimetre`, jusqu'au 31/12/2026), levée = brancher recette, mémoire et ressemblance sur la grande chaîne et sur `equipe`, ou retirer ces deux chaînes.

**Mémoire et contrôle de ressemblance : branchés mais réglage COUPÉ PAR DÉFAUT** (`ecriture.memoireCentrale`, `ecriture.memoireTableau`, `ecriture.memoireCasConcret`). En production, aucune mémoire anti-copie n'est active tant que Will n'a pas allumé les interrupteurs (Réglages › Écriture des scripts). « `memoire: true` » signifie « branché », pas « actif ». Le tableau n'utilise qu'une partie de la recette commune (éléments 3 à 7, `RECETTE_SANS_DEBIT`).

Exceptions **datées**, chacune avec une **fin de validité** (`jusquAu`, 31/12/2026) et une **condition de levage** (`levee`). Le test reçoit la date en paramètre (jamais l'horloge). Une exception dont `depuis` est dans le futur ou postérieur à `jusquAu` est refusée par la fonction elle-même ; un contrat déclaré pour un format absent du registre aussi. **Attention : la CI ne rougira pas toute seule le 31/12/2026** (le test utilise une date fixe) ; un rappel daté est nécessaire à cette date pour lever ou prolonger (avec l'accord de Will) les exceptions :
- `facecam` : débit mesuré, plus (exception à périmètre) recette/mémoire/ressemblance sur la grande chaîne et `equipe` ;
- `tableau-anime` : seul le **débit mesuré** manque (aucun relevé de scripts par heure n'existe) ;
- `cas-concret` : recette commune (il écrit avec sa propre recette R01…) et débit mesuré ;
- `facecam-animee`, `image-video` : aucune pièce (n'importent ni mémoire ni ressemblance communes ; image → vidéo est masqué mais ouvert dans la navigation, donc traité comme actif).

Toute nouvelle exception exige l'accord de Will. L'avocat est hors contrat (ni exigé, ni excepté).

## 3. Les 10 interdits

Un format n'a **pas** le droit de :

1. écrire sa phrase d'appel ou sa fin (elle vient de la bibliothèque « Appels ») ;
2. définir des couleurs, des polices, des zones sûres ou des dimensions (elles viennent de l'habillage et de `src/reseaux`) ;
3. appeler lui-même un fournisseur de voix, de rendu ou d'IA (il passe par les services communs : voix, rendu, budget) ;
4. avoir sa propre file de rendu, son propre stockage ou son propre budget ;
5. construire son propre chat ou son propre écran d'attente (il déclare `ecranVideo`) ;
6. toucher au générateur de scripts, ni à la recette d'une famille dont d'autres formats héritent ;
7. numéroter des épisodes (une série se reconnaît à son nom et à sa forme) ;
8. importer le code d'un autre format ;
9. publier ou programmer lui-même (l'envoi est un service commun) ;
10. modifier un fichier d'un autre format ou d'une pièce commune dans la même PR que son propre code.

## 4. Conventions de nommage

| Quoi | Où | Exemple |
|---|---|---|
| Fiche du format | `src/formats/<id>/` | `src/formats/tableau-anime/` |
| Moteur | `src/moteurs/montage-<id>/` | `src/moteurs/montage-facecam/` |
| Compositions de rendu | `studio-rendu/compositions/<id>/` | `studio-rendu/compositions/avocat/` |
| Composants d'écran | `src/components/formats/<id>/` | — |
| Tests d'un format | `tests/<id>/` | — |
| Tests d'une pièce commune | `tests/briques/<brique>/` | `tests/briques/variete/` |
| Page du format | `docs/formats/<id>.md` | `docs/formats/tableau-anime.md` |

- **Jamais** le nom d'un format dans un dossier de `src/briques/` : une brique est commune.
- **Règle du deuxième utilisateur** : une pièce propre à un format ne devient commune que lorsqu'un deuxième format en a besoin, par extraction (jamais par copie).
- Un code de format est rattaché à l'identifiant du format, pas à son nom ; il n'est jamais réattribué.
- Un format neuf naît `masque` et ne passe `actif` que sur décision de Will.
- Les anciens dossiers (`montage-avocat`, `habillage-facecam`, `formats-facecam`, tests `g1a-…`) gardent leur nom ; on ne les déplace pas.
- Les briques lues par `studio-rendu` doivent être copiées dans l'image de rendu : le `Dockerfile` (`deploiement/studio-rendu/Dockerfile`) les liste **chemin par chemin** ; ajoutez la vôtre si une composition la lit, sans alias `@/`.

## 5. Mise en ligne : ne jamais être coupé (règle « en_cours », Will, 18/10)

`deploiement/mettre-a-jour.sh` redémarre le studio seulement quand **aucun document `travaux` n'est au statut `en_cours`**
(exemples exclus). Il attend 120 min au plus, puis s'arrête sans rien redémarrer (code 3). C'est la seule chose qu'il
regarde. Juste avant le redémarrage, il met la boucle de fond en pause (bail `mise-en-ligne` : plus aucun travail ne
sort de la file) et relit une dernière fois. Un travail « en attente de crédit » reste `en_cours` (il ne fabrique pas,
il attend une recharge) : la mise en ligne l'attend aussi, et le dit à part (« dont N en attente de crédit »). Pour
débloquer : recharger le fournisseur, ou « Arrêter » la vidéo. D'où la règle, pour tout générateur, existant ou à venir :

1. **Toute dépense d'une fabrication passe par un travail mené par la boucle de fond.** Le format fabrique avec un moteur
   inscrit (`IDS_MOTEURS`), lancé par `creerFabrication` ou `lancerAvecAccord`. Pas de fabrication payante dans une action
   serveur, ni dans une collection à part avec son propre statut : la mise en ligne ne la verrait pas.
2. **Le statut, c'est la boucle qui le tient, pas le moteur.** Elle passe le travail `en_cours` AVANT le premier appel
   (`sortirDeLaFile`, `src/services/travaux.ts`), et un travail sorti de la file ne redevient jamais `en_file`. Un moteur
   n'a donc rien à faire pour ça. En revanche :
   - pendant une attente chez un fournisseur (rendu HeyGen, voix, studio-rendu), le moteur renvoie le travail **tel quel,
     `en_cours`**, avec ses étapes en cours ; jamais `echec`, `termine` ou un statut inventé tant qu'un travail payé tourne
     encore chez le fournisseur ;
   - une panne passagère ou un crédit épuisé : le moteur **lance une erreur** (`reessayable: true`, ou code `quota`). La
     boucle garde le travail `en_cours` et le reprend seule ;
   - `echec` est réservé à ce qui ne coûte plus rien en attendant : un refus définitif, ou une porte de validation de Will
     (carte, script) quand plus aucun appel payant n'est en vol.
3. **Reprendre sans rien repayer après un redémarrage.** Garder dans le travail ce qui a été payé (identifiants externes,
   fichiers) : la boucle réinterroge le fournisseur au premier tour du nouveau processus. Aucun geste de Will.

Les deux tests du § 2 font tourner **chaque format du registre** dans la vraie boucle, avec un moteur **double** (le même
pour tous les formats ; aucune dépense). Un format ajouté y passe automatiquement. Il échoue s'il fabrique avec un moteur
non inscrit.

**Ce que ces tests prouvent** : pour chaque format, c'est la boucle qui tient le statut (`en_cours` avant le premier
appel, jamais redevenu `en_file`), un travail en file repart seul après un redémarrage, un appel en vol perdu est refait,
une attente de crédit reprend seule. **Ce qu'ils ne prouvent pas** : que le VRAI moteur de chaque format respecte les
points 2 et 3 (renvoyer `en_cours` pendant une attente chez le fournisseur, reprendre un rendu par son identifiant sans
le repayer). Le moteur double remplace le vrai : les N cas ne diffèrent que par l'identifiant du format. Ces points
reposent sur les tests propres à chaque moteur, quand ils existent, et sur la relecture du moteur à son ajout.

### Ce qui repart seul après un redémarrage, et ce qui ne repart pas (état au 18/10)

| Activité | Après un redémarrage |
|---|---|
| Travaux `en_file` et `en_cours`, tous formats : fabrication, retouche, format ajouté, versions par réseau | **Repartent seuls** au premier tour (prouvé pour chaque format, avec un moteur double). Un appel en vol perdu est refait. La reprise d'un rendu HeyGen, studio-rendu ou studio-aligneur par son identifiant, sans le repayer, dépend du vrai moteur : **non prouvée par ces tests**. |
| Lecture de voix en vol (`fabrication.lectureVoixEnVol`) | Repart, mais la voix est **relue, donc repayée**. La lecture perdue est comptée en dépense probable. N'arrive que sur un redémarrage forcé (`STUDIO_MAJ_FORCER=1`). |
| Finitions d'une vidéo terminée : miniatures, kit, publication sur le site | **Rejouées** au démarrage (`rattraperFinitions`). Un texte de kit coupé peut être payé deux fois (Claude, quelques centimes). |
| Lots image→vidéo | **Repartent seuls** (`avancerLotsIV`). Entre deux vidéos d'un lot, rien n'est payé. |
| Écriture de scripts du générateur (`generations`) | **Repart seule**. Les appels interrompus sont soldés. |
| Tâches du tableau animé (écriture, découpage : Claude) | **Ne repartent pas seules** : la tâche passe « interrompue » et Will clique « Reprendre ». Les appels déjà faits sont gardés. Ces tâches ne sont pas des travaux : la mise en ligne ne les attend pas. |
| Lots de décors (fal.ai) | Le suivi reprend à l'ouverture de « Mes décors » ou à la demande suivante. |
| Actions immédiates (maquette, essai d'un personnage, monteur facecam, kit à la demande) | **Aucune reprise** : l'action en cours échoue, Will la relance. |

