# Inventaire de centralisation des briques (mission H, 09/10/2026)

Exigence de Will : **tout ce qui est construit est centralisé et réutilisable par tous les types de vidéos** (avocat,
face caméra, et formats futurs). Ce document dit, pour chaque brique, qui l'utilise aujourd'hui, ce qui reste propre à
un format et pourquoi, et ce que la mission H a corrigé.

Formats et moteurs aujourd'hui : **avocat** (moteur `montage-avocat`, réel pour le double, les prises filmées « je lis »
et le montage `studio-rendu`), **face caméra** (moteur `montage-facecam`, chaîne `studio-aligneur` + habillage
`studio-rendu`), **podcast et familles** (conversation, écran partagé, motion, témoignage, UGC… : moteur `simulation`,
aucun montage réel encore). Un format futur reçoit un moteur ; il ORCHESTRE les briques ci-dessous et ne réécrit aucun
savoir-faire.

Légende : ✅ utilisée · ⚙️ branchée par un réglage caché, coupé par défaut · ➖ pas utilisée.

## Tableau

| Brique (dossier) | Face caméra | Avocat | Autres formats | Ce qui reste propre à un format, et pourquoi | Mission H |
|---|---|---|---|---|---|
| **Sous-titres** (`briques/sous-titres`) | ✅ (styles, ligne 55-72 %, jonction de l'écran partagé) | ✅ (karaoké, mélange, report) | ➖ (simulation) | Rien : les réglages propres (position face caméra) sont des paramètres facultatifs. | — |
| **Composition** (`briques/composition` + `studio-rendu`) | ✅ (pré-cadré, 10 bits, écrans partagés, cartes) | ✅ (double, décor, encadré, incrustations) | ➖ | La **recette** de chaque format (`recette-composition.ts`, `RECETTE_COMPOSITION_FACECAM`) : données, pas du code. | ✅ ajouts facultatifs : `multicamera` (source du visage par plan), `supplementsParRatio` (cartes par format d'image). |
| **Motion design** (`briques/motion`) | ✅ (cartes du monteur, écrans partagés, cartes plein écran) | ⚙️ `avocat.motionCommune` | Prêt : **API unique** `cartesPourFormat` | Rien. Le catalogue passe par `CATALOGUE_ACTIF` (6 modèles ; 13 avec le lot F2 sans toucher aux formats). | ✅ `pourFormat.ts` (API unique), `rendu-cartes.ts` (rendu commun des cartes) ; avocat branché aux places de ses illustrations, titres et emphases. |
| **Monteur** (`briques/monteur`) | ✅ (agent du lot D, inchangé, via `adaptateur.ts`) | ⚙️ `avocat.monteur` | Prêt : registre `moteurs/monteurs.ts` | Le **vocabulaire** et l'**application** des opérations (le face caméra sait masquer la personne, l'avocat non). Rôle Claude et relecture d'images : face caméra seulement (l'avocat a la version simple, sans appel). | ✅ brique créée : consignes « Monteur, … », ancrage sur un mot (réexporté par le face caméra), relecture tolérante, schémas communs, familles de demandes, réponse claire au refus, adaptateurs facecam et avocat. |
| **Multicaméra** (`briques/multicamera`) | ⚙️ `facecam.multicamera` (face = la vidéo de Will, angles 2-3 = double HeyGen sur le même son) | ⚙️ `avocat.multicamera` (prises filmées) | Prêt (même service) | Le **choix des coupes préférées** (fins de plans pour l'avocat, bornes des passages pour le face caméra) : chaque format sait où une coupe d'angle est bienvenue. | ✅ branchée dans les deux moteurs, la composition commune et `studio-rendu` ; service commun `services/multicamera.ts` ; analyseur réel des angles ; consigne « 3 caméras » reliée au monteur commun. |
| **Coupes** (`briques/coupes`) | ✅ (reprises, début/fin à jeter, consignes) | ➖ | ➖ | L'avocat lit un texte validé par prises assemblées (`declinaison`) : ses prises sont déjà coupées par le calage. | ✅ repérage des consignes réutilisé par la brique monteur ; dépendance vers le moteur avocat retirée (`normaliser` vient de `briques/calage`). |
| **Calage** (`briques/calage`) — *nouvelle* | ✅ (texte validé calé sur le son monté) | ✅ (voix, prises « je lis ») | Prêt | Rien. | ✅ **corrigé** : `report.ts` et `alignement.ts` étaient dans le moteur avocat et importés par la chaîne face caméra et la brique coupes ; déplacés sans changement de code, réexportés par l'avocat. |
| **Réalisation** (`briques/realisation`) | ✅ (plans de caméra virtuels sur la prise 4K) | ➖ | ➖ | L'avocat a son **découpage** (`decoupage.ts`) : il découpe un texte en plans d'un double (angles, illustrations) ; la réalisation face caméra recadre une vraie prise. Deux métiers différents. | — (à rapprocher plus tard : la grammaire commune des zooms) |
| **Décor IA** (`briques/decor` + `services/decor-ia.ts`) | ⚙️ `facecam.decorIa` | ➖ | ➖ | L'avocat a déjà un **décor composé** (fond + double détouré) : le décor IA sert à une vraie prise filmée. Réutilisable pour les prises filmées de l'avocat (même extraction de passage) quand les routes d'extraction existeront. | — |
| **Habillage** (`briques/habillage-facecam`) | ✅ | ➖ (mais la composition commune importe `ecran-partage`, `broll`, `sous-titres` d'ici) | ➖ | Cadrage par calque d'une vraie prise (yeux à 37,5 %) : face caméra. **L'écran partagé, le Look des B-roll et la ligne de jonction sont génériques** malgré le nom du dossier. | Noté (non déplacé : le lot F1 modifie ces fichiers ; à renommer `briques/habillage` après l'intégration de F1/G). |
| **Déclinaison / formats** (`briques/declinaison`, `briques/formats-facecam`) | ✅ (4:5, 1:1, 16:9, lot F1) | ✅ (versions par réseau, prises assemblées) | Prêt (`declinaison`) | `formats-facecam` : cadrage d'une prise 4K par format et zones sûres du face caméra ; l'avocat compose ses formats dans la composition (double réduit et ancré en bas). | — |
| **Intensité** (`briques/intensite`) | ⚙️ (choix du style des cartes Sobre / Spectaculaire) | ✅ (courbe unique, bruitages) | ➖ | Rien. | ✅ l'intensité choisit le style motion pour tous les formats (`cartesPourFormat`). |
| **Son** | Route `/son` de `studio-aligneur` (débruitage DeepFilterNet, −14 LUFS) | Composition commune (chaîne voix, ton de pièce, LUFS, crête) | ➖ | Deux chaînes : la voix de synthèse est propre, une prise filmée doit être débruitée. **Les prises filmées de l'avocat pourraient passer par `/son`** (même conteneur). | Noté (reste). |
| **Image / Look** | Passe `/image` (Look Will, 10 bits) + `lookBroll` | LUT par plan dans la composition commune (`plagesDesLuts`) | ➖ | Le Look Will retouche une vraie prise (lumière, peau, dents) ; l'avocat applique une LUT sur un double déjà propre. La LUT et le grain restent communs (composition). | — |
| **Effets spéciaux** (`briques/effets-speciaux`, lot F3) | ✅ à la demande | ➖ | ➖ | Suivi de la main d'une vraie prise. | ✅ intégration réparée : le Dockerfile de `studio-rendu` copie la brique (garde-fou `final-b`). |

## Corrections faites par la mission H (simples, sans changer de comportement)

1. **`briques/calage`** : le report des horodatages et le calage des mots sur le son quittent le moteur avocat (la
   chaîne face caméra et la brique coupes les importaient depuis `moteurs/montage-avocat`). Code inchangé ; l'avocat les
   réexporte (tous ses tests et ceux qui l'importent restent verts).
2. **Ancrage d'une consigne** (`instantDans`, `motCite`, `ancreConsigne`) : du rôle du monteur face caméra vers
   `briques/monteur/ancrage.ts` ; le face caméra les réexporte (même fonction, vérifié par un test).
3. **Fabrication des angles** : la passe multicaméra de l'avocat et celle du face caméra partagent
   `services/multicamera.ts` (réglage par format, simulation par défaut, aucun look créé à la volée en réel).
4. **Dockerfile `studio-rendu`** : la brique `effets-speciaux` (lot F3) est copiée ; sans elle l'image ne trouvait pas
   les fichiers lus par Remotion. *Rien n'est déployé.*

## Ce qui reste à centraliser (après l'intégration de F1, F2, G)

- **Vocabulaire du monteur face caméra** : ses schémas (`zoom`, `titre`, `retirer`…) sont identiques à ceux de la brique
  (test `h-briques-communes`) mais encore définis dans `montage-facecam/monteur/operations.ts`, que F3/G modifient : y
  remplacer les définitions par celles de la brique, et `lireReponseMonteur` par `lireReponseOperations(brut, schéma,
  [réparateur des effets, carte sur mesure])` (même algorithme, même résultat, vérifié par un test).
- **Modèles 7 à 13 (F2)** : remplacer les fonctions de `CATALOGUE_ACTIF` (`pourFormat.ts`) par celles du catalogue
  étendu ; aucun format n'a rien d'autre à changer.
- **`briques/habillage-facecam`** → `briques/habillage` (écran partagé, Look des B-roll, ligne de jonction sont communs).
- **Son des prises filmées de l'avocat** par la route `/son` du face caméra.
- **Multicaméra dans les déclinaisons F1** (4:5, 1:1, 16:9 du face caméra) : la piste est dans l'état de la chaîne ; la
  passer aussi aux compositions par format.
