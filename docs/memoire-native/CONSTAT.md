# Mémoire native du studio — étape 1 : ce que fait chaque tour

Ce document décrit la situation du 17/10 au soir, dans le conteneur `studio` de production (Node 22, glibc, limite de 2 Go,
`NODE_OPTIONS=--max-old-space-size=1280`).

## Ce qui a été mesuré en production

- **Après 5 h de marche** : RSS de 1,90 Go, dont **1,67 Go dans la zone `[heap]`**. Cette zone est le tas malloc principal de
  glibc, celui qui grandit par `brk`.
- **Après un ramasse-miettes forcé** :
  - `heapUsed` 152 Mo ;
  - `external` 4 Mo ;
  - `arrayBuffers` 0,3 Mo.
- **Conclusion** : ce n'est ni du JavaScript vivant ni des Buffer vivants. C'est de la mémoire malloc que glibc ne rend pas au
  système.
- **Au redémarrage** : 811 Mo de `[heap]` au bout de 2 min. Ensuite, le RSS oscille entre 1,10 et 1,27 Go toutes les 20 s
  environ.

## Ce qui tourne en permanence (source : `src/instrumentation.ts`)

| Boucle | Fréquence | Fichier |
|---|---|---|
| Boucle de fond (fabrications) | 5 s | `src/services/boucle.ts` (`contenuDuTour`) |
| Boucle d'écriture (générateur) | 4 s | `src/services/boucle-generation.ts` (`tourBoucleGeneration`) |
| Veille des outils et lecture du site | 30 min, avec une vraie lecture par jour | `src/services/veille.ts`, `source-axion.ts` |

Rappel sur la base (`src/donnees/postgres/index.ts`) :

- **Lecture** : toute la base vit en mémoire. Chaque `lister(filtre)` filtre d'abord, puis fait un `structuredClone`. Chaque
  `obtenir` et chaque `trouver` font aussi un `structuredClone`.
- **Écriture** : chaque `enregistrer` et chaque `modifier` font **`JSON.stringify` du document ENTIER**, puis une requête
  `pg`. `enregistrer` fait ensuite 2 `structuredClone`, `modifier` 1.

### Boucle de fond, à chaque tour (5 s)

- **`lireTravauxAAvancer`** (`travaux.ts:394`)
  - `travaux.lister(en_file | en_cours)` **sans projection**. Un travail de tableau actif est donc cloné avec ses 1 à
    5,6 Mo de `parametres.tableau`.
  - Puis `versions.obtenir`, environ 80 Ko par travail.
- **Pour CHAQUE travail actif**
  - `noterLectureEnVol`.
  - `moteur.avancer` :
    - Moteur tableau en pause : `fetch` de la fiche, `preuves.lister()` et `matieres.lister()` sans filtre, empreintes
      `JSON.stringify` et sha256 de la chaîne.
    - Moteur image→vidéo « mené par le lanceur » : renvoie le travail **inchangé**.
  - Puis **`ecrireAvancement`** (`travaux.ts:431`) :
    - `travaux.obtenir`, un 2e clone complet ;
    - **`travaux.enregistrer(travail)` sans condition** : `JSON.stringify` de plusieurs Mo, requête `pg` de plusieurs Mo,
      2 clones de plus ;
    - **même quand rien n'a changé**.
- **`surveillerCredits`** : une fois par minute au plus (petites collections).
- **`synchroniserEtatsBuffer`** : toutes les 15 min au plus.
- **`travaillerTachesTableau`**, **`travaillerComite`**, **`diffuserNotifications`** : à vide, ces lectures filtrées ne
  retiennent rien. Exception : avec le comité allumé, `ideesJugees.lister()` est fait **sans filtre**.

### Boucle d'écriture, à chaque tour (4 s)

- À vide, elle fait 4 `generations.lister` filtrés : `marquerEcrituresAnciennesEnEssai`, `solderAppelsInterrompus`,
  `en-attente-credit` et les candidates.
- Elle n'écrit rien.
- Cas limite : `solderAppelsInterrompus` retient à jamais une génération qui garde une étape sans `termineLe`.

### Veille

- Toutes les 30 min, ce n'est qu'un `lireParametre`.
- Une fois par jour : quelques `fetch` des pages publiques des outils.

### Processus fils, zlib et `fetch` atteignables depuis les moteurs

- **Processus fils** :
  - `execFile ffmpeg` dans le moteur image→vidéo (`maxBuffer` de 16 à 64 Mo) et dans la facecam (8 Mo) ;
  - `spawn` dans la facecam animée.
- **zlib** :
  - `gunzipSync` et `gzipSync` dans la facecam et l'analyseur d'angles ;
  - `deflateSync` dans la simulation image→vidéo.
- **Usage** : ces outils ne servent que pendant une vraie fabrication, pas à vide.
- **Seul module natif chargé** : argon2, appelé seulement à la connexion.

### Requêtes de l'écran de Will (pages ouvertes)

- **`useTravaux`** : `/api/travaux` toutes les **2 s** quand un travail est actif, sinon toutes les 15 s.
  - **`?id=`** : `travaux.obtenir`, soit un **clone complet**, puis `versVue` qui recopie tout le travail. Le JSON envoyé
    au navigateur **contient `parametres.tableau`**, soit plusieurs Mo toutes les 2 s, compressés par Next.
  - **`placesDansLaFile`** : `travaux.lister(en_file | en_cours)` **sans projection**, à chaque appel.
  - **`?video=`** : `travaux.lister` de toutes les fabrications de la vidéo, sans projection.
- **Cloche** (20 s) : `notifications.lister` presque sans filtre, soit toute la collection, pour garder 20 éléments.
- **Mise en page `(studio)`**, rejouée à chaque `router.refresh()` :
  - `compterVideosParFormat` clone toutes les vidéos pour les compter ;
  - `router.refresh()` tourne toutes les 4 s (écriture en cours), 5 s (fiche sujet) et 10 s (votre site).
- **`/api/image-video/[id]`** (4 s) : `versions.lister` de la vidéo et `travaux.obtenir`.

## Suspects à vérifier par la mesure (étapes 2 et 3)

1. **Réécriture inconditionnelle d'un travail actif volumineux toutes les 5 s** (`ecrireAvancement`). À chaque tour, cela
   représente :
   - environ 4 clones ;
   - un `JSON.stringify` de plusieurs Mo ;
   - un tampon `pg` de plusieurs Mo, pris par malloc puis libéré.
2. **`/api/travaux?id=` toutes les 2 s** : clone, sérialisation JSON et compression d'un document de plusieurs Mo.
3. **Mécanisme natif possible** : des tampons de plusieurs Mo pris puis libérés en boucle, mêlés à de petites allocations
   qui restent vivantes.
   - Le seuil `mmap` dynamique de glibc monte jusqu'à 32 Mo après la libération d'un gros bloc.
   - Les tampons suivants sont alors pris dans `[heap]`, par `brk`, au lieu d'un `mmap` rendu aussitôt.
   - Ils y fragmentent le tas sans que le sommet puisse redescendre.

Les essais synthétiques faits en dehors du serveur ne reproduisaient pas le phénomène. Il faut donc reproduire avec le vrai
serveur, la vraie base et les vraies requêtes : c'est l'objet de l'étape 2.
