# Journal de la mission L — Les 13 modèles d'animation par défaut dans le monteur face caméra (09/10/2026)

Branche `feat/facecam-l`, partie de `origin/feat/facecam` (04bdb76).
Point de départ : Will a validé le 09/10 la planche des animations 7 à 13 (`docs/facecam/planche-motion-7-13/`). Jusqu'ici, le vocabulaire du monteur face caméra restait à 6 modèles (JOURNAL-Z § 2 et § 5, JOURNAL-F2 « Ce qui reste », points 1 à 3).
**Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché. Aucun appel réel n'a été fait, aucune dépense.** La branche `feat/facecam-k` (lot K, effetRealisteIA) n'a pas été touchée.

## Ce qui est fait
1. **Vocabulaire** (`monteur/operations.ts`) : `MODELES_CARTE` contient les **13 modèles** (les 6 de base, puis les 7 du lot F2). Les 6 de base restent dans `MODELES_CARTE_BASE`. Une garde de types vérifie que la liste correspond exactement à `IdModeleMotionTous`. `schemaAjouterCarte`, `schemaReponseMonteur` et `lireReponseMonteur` acceptent donc les 13 modèles. Une carte « graphique » de Claude n'est plus transformée en carte sur mesure.
   - Compatibilité F2 : `MODELES_CARTE_ETENDUS` vaut `MODELES_CARTE` et `schemaAjouterCarteEtendue` vaut `schemaAjouterCarte`.
2. **Catalogue** (`monteur/catalogue.ts`) : `modelesEtendus` est **vrai par défaut**, et `{ modelesEtendus: false }` rend le texte des 6 modèles à l'identique.
   - `catalogueTexte()` ajoute la règle des modèles 7 à 13 sous `ajouterCarte`.
   - `exemplesDemandes()` (« Que puis-je demander ? ») place 3 exemples des modèles 7 à 13 juste après la carte et son style, sans retirer aucune famille. Les effets ferment toujours la liste, qui passe de 11 à 14 entrées.
   - Les 7 phrases d'aide s'ajoutent aux exemples de la carte animée.
3. **Consigne de Claude** (`monteur/role.ts`) : la convention des textes couvre les 13 modèles (`CONVENTION_TEXTES_TOUS`). La règle dit déjà « Titre plein écran : seulement si Will le demande », et le catalogue précise « JAMAIS tout seul ».
4. **Version simple** (règles fixes, `operationsParRegles`) : un modèle 7 à 13 **demandé** (`lireDemandeModele`) donne sa carte, et le texte cité est découpé selon la convention. Exemples :
   - « administratif 9 h, e-mails 6 h » → `administratif : 9 h` ;
   - « en camembert » → variante ;
   - points de check-list ;
   - « problème → solution » ;
   - lieu / date / chiffre ;
   - « le mot confiance ».

   Exceptions :
   - **titre plein écran** : la règle « titre » existante continue de s'appliquer (`pleinEcran: true`), jamais en carte automatique ;
   - **capture annotée** : elle reste à Claude, car la version simple ne connaît pas l'image.

   Les règles d'avant (comparaison, étapes, liste, chiffre, zoom, écran partagé…) ne changent pas. Résumés : « Carte « Check-list » ajoutée ».
5. **Raccords D → C** (`raccords.ts`) :
   - `CarteMonteur.modele` couvre les 13 modèles ;
   - `cartePosee` passe par `carteDepuisTextesTous`. Si les textes d'un modèle 7 à 13 ne suffisent pas, elle applique la règle de ce modèle à la description (`carteDuModeleDepuisPhrase`) ;
   - le repli d'une carte sur mesure passe par `choisirModeleTous`, qui ne choisit jamais le titre plein écran ;
   - une carte 7 à 13 qui ne tient pas dans la moitié haute (`tientEnMoitieHaute`) passe en plein écran.
6. **Habillage 9:16 et déclinaisons 4:5 / 1:1 / 16:9** (`habillage.ts`, `declinaisons.ts`) : `CartePosee.carte` et `CartePosee.repli` acceptent les 13 modèles. Le rendu passe par `calerCarteTous` et `preparerCarteTous`, qui restent identiques à `preparerCarte` pour les 6 premiers modèles. L'opération `composition` existante est utilisée, sans nouveau contrat.
7. **Choix automatique** (`briques/habillage-facecam/ecran-partage.ts`, écrans partagés d'office) : `planifierEcransPartages` choisit parmi les 13 modèles avec `choisirModeleTous`.
   - Il ne choisit jamais le titre ni le titre plein écran.
   - Une carte 7 à 13 qui ne tient pas en moitié haute n'est pas retenue.
   - Seul le face caméra utilise cette fonction.
8. **Brique motion** (ajouts purs) :
   - `preparerCarteTous` (`demande-etendue.ts`) ;
   - `carteDepuisTextesTous` et `CONVENTION_TEXTES_TOUS` (`textes-etendus.ts`) ;
   - `carteDuModeleDepuisPhrase` (`choix-etendu.ts`).

   Tous sont exportés par `index.ts`. Rien de l'avocat n'a changé.

## Tests
- `tests/facecam-motion-7-13.test.ts` : le test « non branché » (adapté par Z) devient « **branché** ». Il vérifie :
  - les 13 modèles par défaut ;
  - le schéma, qui accepte les 13 modèles et refuse un modèle inconnu ;
  - les exemples ;
  - que `modelesEtendus: false` rend exactement le texte d'avant, auquel la règle des modèles 7 à 13 s'ajoute à la bonne place.

  Les 32 autres tests n'ont pas changé.
- `tests/facecam-effets-speciaux.test.ts` : le test sur les exemples vérifie les 3 exemples insérés aux places 2 à 4, puis les 8 exemples d'avant dans le même ordre et les effets en fin de liste (14 entrées). Sans les modèles 7 à 13, il vérifie la liste d'avant à l'identique (11 entrées).
- Nouveau fichier `tests/facecam-monteur-13-modeles.test.ts` (13 tests). Il couvre :
  - la relecture d'une réponse de Claude avec des modèles 7 à 13 ;
  - la consigne (13 conventions, titre plein écran sur demande, aucun prix) ;
  - les résumés ;
  - la version simple pour 5 modèles, avec les cartes réellement remplies ;
  - le titre plein écran jamais en carte automatique, la capture laissée à Claude, et les règles d'avant inchangées ;
  - les raccords des 7 modèles (capture seulement avec une image) ;
  - le passage en plein écran d'une carte trop longue ;
  - les compositions `Motion*` en 9:16 et dans les 3 déclinaisons ;
  - l'égalité entre `preparerCarteTous` et `preparerCarte` ;
  - les écrans partagés d'office (graphique et check-list, jamais de titre).

## Vérifications (résultats exacts)
- `tsc` racine : propre, hors les 4 erreurs connues `RouteContext` / `LayoutProps` (elles demandent `next typegen`).
- `tsc` de `studio-rendu` : propre.
- `eslint` sur les 13 fichiers modifiés : propre.
- Vitest ciblé (`facecam-*`, `h-*`, `z-integration-facecam`, et les fichiers qui touchent la brique motion, l'avocat, la brique monteur ou l'habillage face caméra) : 90 fichiers, 1 009 tests verts et 2 ignorés d'avance. Un seul échec : `garde-ecran.test.ts`, qui **dépasse son délai de 5 s**.
  - Il échoue de la même façon sur `origin/feat/facecam` sans les changements de L (contrôlé dans un worktree séparé). Il est donc préexistant et lié à la lenteur de la machine.
  - Il passe (6/6) avec un délai de 60 s.
- Vitest complet : 269 fichiers. **3 270 tests verts**, 3 ignorés d'avance et 3 échecs, tous sans lien avec L :
  - `garde-ecran.test.ts` : le dépassement de délai préexistant décrit ci-dessus ;
  - `e2e-verif1-bc-serie.test.ts` (2 tests sur l'écriture en série) : il ne touche pas au face caméra et **passe à 14/14 quand on le lance seul**. Les échecs viennent de la charge du lancement complet.

## Limites et points d'attention
- **Capture annotée** : le face caméra ne transmet pas encore l'image du passage (Mes images, B-roll) au raccord. Une carte `capture-annotee` posée par Claude retombe donc sur le modèle choisi d'après sa description, ou n'est pas posée. Il faudra passer `capture` (avec largeur et hauteur) à `carteDepuisTextesTous`, `carteDuModeleDepuisPhrase` et `choisirModeleTous` quand l'image sera connue.
- **Écrans partagés d'office** : une phrase qui porte 2 valeurs ou plus donne désormais un **graphique** (et non plus une liste ou un chiffre). C'est la priorité validée par F2 dans `choisirModeleTous`. L'avant / après garde la priorité.
- **Titre plein écran** :
  - en version simple, la règle « titre » existante reste en place (opération `titre`, `pleinEcran: true`) ;
  - Claude peut poser la carte `titre-plein-ecran` seulement si Will la demande (consigne) ;
  - aucun chemin automatique ne la choisit.
- Mise en ligne : aucune migration et aucun nouveau contrat de rendu. Les compositions des 7 modèles sont déjà inscrites dans `studio-rendu` (lot F2). Il faudra seulement redéployer `studio-rendu` avec la branche intégrée, comme le prévoit déjà la liste de JOURNAL-Z § 6.
