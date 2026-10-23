# Mémoire native du studio : cause prouvée et correctif

Constat de départ et inventaire des boucles : [CONSTAT.md](CONSTAT.md). Relevés bruts (une ligne toutes les 10 s) :
[`releves/`](releves/).

## En une phrase

**L'accueil du studio créait un `Intl.DateTimeFormat` neuf pour chaque dépense, quatre fois par affichage.**

- Le calcul passait par `resumeBudget` → `moisParis` → `cleJour`.
- L'accueil se rafraîchit toutes les 4 à 10 s.
- Chaque formateur réserve environ 16 Ko de mémoire **native**, côté ICU (malloc). V8 ne la voit pas.
- Cette mémoire n'est libérée qu'au passage du ramasse-miettes, que rien ne déclenche pour elle.
- Des centaines de milliers de formateurs morts s'entassent donc dans le tas principal de glibc (`[heap]`).
- Une fois libérée, cette mémoire n'est **jamais rendue au système** par glibc.

## Comment la cause a été trouvée et prouvée

### 1. Reproduction (`scripts/memoire-native/`)

**Base synthétique** (`semer-base-synthetique.mjs`, données inventées) :

| Collection | Contenu | Taille |
|---|---|---|
| Travaux | 66, dont `parametres.tableau` de 1 à 5,6 Mo | 29 Mo |
| Versions | 88 | 4,4 Mo |
| Sous-titres | 108 | 2 Mo |
| Plans | 1 339 | |
| Vidéos | 77 | |
| Dépenses | 1 522 | |

- Un travail est **en cours** et volumineux : il est réécrit à chaque tour, comme un tableau en pause.
- Le nombre de dépenses de la production n'est pas connu. 1 500 est une estimation (une par appel Claude, voix,
  illustration…), et l'effet est proportionnel à ce nombre.

**Serveur.** `next build`, puis `node server.js`, avec `NODE_OPTIONS=--max-old-space-size=1280` et les trois boucles
actives.

**Environnement.** Le serveur tourne dans la racine de l'image **`node:22-bookworm-slim`** :

- Node 22.23.3 et **glibc 2.36**, comme le conteneur de production ;
- couches tirées du registre, lancées par `chroot` (option `--chroot` de `mesurer.mjs`).

**Mesure.** Toutes les 10 s : `VmRSS`, Rss de `[heap]` (lue dans `/proc/PID/smaps`), et `process.memoryUsage()`. Cette
dernière vient d'une route de diagnostic locale (`diag-memoire.cjs`, chargée par `--require`, jamais en production).

**Écran de Will simulé** :

| Requête | Fréquence |
|---|---|
| `/api/travaux?id=<travail actif>` | 2 s |
| `/api/travaux` | 2 s |
| Accueil `/` | 4 s |
| Fiche vidéo | 10 s |
| Cloche | 20 s |

> Premiers essais sans gonflement : `avant-B-*` montent à environ 450 Mo de RSS, avec `[heap]` vers 30 Mo. Deux raisons :
> - la base n'avait que 22 dépenses ;
> - les requêtes RSC simulant `router.refresh()` recevaient une redirection 307 de Next 16 (empreinte `_rsc` absente) :
>   **la page n'était jamais rendue**.
>
> Le script demande désormais la page entière, ce qui fait le même rendu côté serveur.

### 2. Résultat « avant » (`releves/avant-D-reference.csv`, 5 min)

| | RSS max | RSS moyen | `[heap]` max |
|---|---|---|---|
| Avant | **1 017 Mo** | 954 Mo | **503 Mo** |

- En fin de mesure, **après un ramasse-miettes forcé** :
  - `heapUsed` 138 Mo ;
  - `external` 10 Mo ;
  - `arrayBuffers` 0 Mo ;
  - mais toujours 492 Mo dans `[heap]`.
- C'est la signature observée en production : le tas glibc est énorme alors que JavaScript et les Buffer sont petits.
- La montée est immédiate : 495 Mo de `[heap]` dès 12 s. La production avait 811 Mo au bout de 2 min.

### 3. Bissection (2 min par cas)

| Cas | `[heap]` en fin | RSS en fin |
|---|---|---|
| Boucles coupées, écran complet (`bissection-1`) | **728 Mo** | 1 359 Mo |
| Boucles seules, sans écran (`bissection-2`) | 32 Mo | 379 Mo |
| **Accueil seul**, boucles coupées (`bissection-3`) | **1 208 Mo** | **1 637 Mo** |
| Tout l'écran **sauf** l'accueil (`bissection-4`) | 31 Mo | 471 Mo |

- **Les boucles, la veille et `/api/travaux` sont hors de cause. Seul le rendu de l'accueil gonfle le tas.**
- L'accueil seul gonfle davantage : sans les autres requêtes, il y a moins de déchets JavaScript, donc moins de
  ramasse-miettes. Plus de formateurs morts restent en attente.

**Lieu exact.** La route de diagnostic compte les `Intl.DateTimeFormat` créés et la pile de chaque création
(`DIAG_INTL=1`). En 60 s du scénario complet, **289 964 formateurs** ont été créés. La quasi-totalité vient de `cleJour`
← `moisParis` ← `resumeBudget` (accueil), soit environ 19 000 par affichage avec 1 500 dépenses.

### 4. Mécanisme

**Essai isolé** dans l'image bookworm : 100 000 fois `new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" })`.

| Variante | `[heap]` |
|---|---|
| Sans ramasse-miettes | **1 624 Mo**, et toujours 1 600 Mo **après** un ramasse-miettes forcé (`heapUsed` 33 Mo, `external` 1 Mo) |
| Ramasse-miettes toutes les 1 000 créations | 29 Mo |
| Un seul formateur réutilisé | **3 Mo** |

**Sur le serveur reproduit** (accueil seul, `releves/mecanisme-*.csv`) :

- **`malloc_trim(0)`**, appelé par gdb à la fin, fait passer `[heap]` de **1 194 à 25 Mo** et le RSS de **1 623 à
  453 Mo**. La mémoire était donc libre dans glibc, mais pas rendue au système : ce n'est pas une fuite qui grandit sans
  fin. C'est une rétention glibc de mémoire native libérée trop tard.
- **jemalloc** (`LD_PRELOAD`) : le RSS monte quand même de 1 235 à 1 714 Mo. Le pic vient des formateurs morts **encore
  vivants pour malloc**, en attente du ramasse-miettes. **Un autre allocateur ne règle pas la cause.**

## Correctif (à la source)

- **`src/lib/intl.ts` (nouveau)**
  - `formateurDate`, `formateurNombre`, `formateurRelatif`, `formateurNoms` : **un formateur par réglage**, créé une fois
    puis réutilisé.
  - `format` n'a pas d'état : il est sûr d'une requête à l'autre.
  - Le nombre de réglages différents est fini, donc le cache est borné.
- **`src/lib/dates.ts`** : `cleJour`, `cleMois`, `dateCourte`, `dateLongue`, `heure` et `ilYA` utilisent les formateurs
  partagés. Les résultats sont identiques.
- **`src/services/couts.ts`** : `resumeBudget` calcule le mois de chaque dépense **une fois**. Avant, il le faisait
  4 fois par dépense.
- **Toutes les autres créations par appel** passent par `@/lib/intl` :
  - `lib/montants.ts` (`formaterMontant`), `domaine/credits.ts` (`formaterDollars`) ;
  - `domaine/suivi.ts` (`formaterHeure`, lu par `/api/travaux`), `domaine/facecam-parcours.ts` ;
  - `domaine/mesures.ts`, `services/mesures.ts`, `services/credits.ts`, `veille/regles.ts` ;
  - accueil `page.tsx`, `ecrire/sujets/[id]/page.tsx`, `EcranVeille`, `EcranSujet`, `FicheSujet`, `SaisieMesures`,
    `VideoHeygen`, `FeuilleTelecharger`, `OngletVoix`.
  - Les formateurs déjà créés une seule fois au niveau du module restent tels quels.
- **Garde-fou : `tests/memoire-intl.test.ts`**
  - Il refuse tout `new Intl.…` ailleurs que dans une constante de module (hors `src/lib/intl.ts`).
  - Il vérifie que 10 000 `cleJour`, `cleMois` et `moisParis` ne créent **qu'un** formateur.
  - Il vérifie que les résultats restent à l'heure de Paris.
  - Il **échoue sur l'ancien code** (26 lieux fautifs, 30 000 formateurs) et passe sur le nouveau.
- **Script de mesure : `scripts/memoire-native/`**
  - `scenario.sh <nom> --chroot <racine> --duree 300 --ecran` rejoue la mesure.
  - Si `[heap]` dépasse de nouveau la centaine de Mo, le problème est revenu.

**Non modifiés** (conformément à la consigne) : `domaine/relecture-script.ts`, `briques/sous-titres/*`,
`montage-tableau/*`. Le Dockerfile et le compose sont aussi inchangés (voir jemalloc ci-dessous).

## Mesure finale, même scénario (5 min, glibc 2.36)

| | RSS max | RSS moyen | RSS moyen (4e-5e min) | `[heap]` max | Après GC forcé (`[heap]` / `heapUsed`) |
|---|---|---|---|---|---|
| **Avant** (`avant-D-reference`) | 1 017 Mo | 954 Mo | 1 010 Mo | **503 Mo** | 492 / 138 Mo |
| **Après** (`apres-D-reference`) | **557 Mo** | **515 Mo** | 544 Mo | **33 Mo** | 31 / 139 Mo |
| Après + jemalloc (`apres-D-jemalloc`) | 505 Mo | 467 Mo | 490 Mo | (hors `[heap]`) | – / 139 Mo |
| Accueil seul, avant (`bissection-3`) | 1 643 Mo | 1 463 Mo | – | **1 208 Mo** | 1 208 / 123 Mo |
| Accueil seul, après (`apres-accueil-seul`) | **419 Mo** | 390 Mo | – | **28 Mo** | 28 / 123 Mo |

Formateurs créés en 60 s : **289 964 avant → 7 après** (`releves/apres-intl-compte.json` : un par réglage, au premier
usage).

## jemalloc et réglages `MALLOC_*` : non retenus

- **Ce qui est prouvé** : glibc retient de la mémoire libérée (`malloc_trim`). Mais la cause était la création massive
  de formateurs, et non la fragmentation d'allocations normales.
- **Sur le code d'avant**, jemalloc ne protégeait pas : le RSS montait encore jusqu'à 1,7 Go.
- **Sur le code corrigé**, il fait gagner environ 50 Mo de RSS moyen (515 → 467 Mo, soit 10 %) : un gain faible.
- **En face, les risques** :
  - un nouveau paquet dans l'image ;
  - un allocateur différent pour tout le processus (argon2, pg, OpenSSL), non éprouvé sur la vraie charge.
- **`MALLOC_ARENA_MAX`** : sans effet ici, puisque tout se passe dans l'arène principale (`[heap]`).
- **`MALLOC_TRIM_THRESHOLD_`** : il ne rend que le **haut** du tas, pas les trous du milieu.
- **Si on veut l'essayer plus tard** :
  - `RUN apt-get update && apt-get install -y --no-install-recommends libjemalloc2 && rm -rf /var/lib/apt/lists/*` ;
  - `ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2` dans l'étape `run` ;
  - puis comparer `[heap]` et RSS sur 24 h.
  - Dans ces essais, jemalloc venait d'Ubuntu, copié dans la racine bookworm. En production, ce serait le paquet Debian.

## Risques du correctif

- **Formateurs partagés** : `Intl.DateTimeFormat.prototype.format` et `formatToParts` ne modifient pas le formateur. Le
  partage entre requêtes concurrentes est donc sûr. Les sorties sont identiques (mêmes réglages, testés).
- **Cache** : il est indexé par `locale + JSON.stringify(options)`. Les options du code sont des littéraux, donc le nombre
  d'entrées est fixe et petit : une dizaine. Les options variables, comme `court` et `rond` de `formaterMontant`, donnent
  au plus 2 entrées.
- **Composants client** : `@/lib/intl` est pur, sans `server-only`. Le navigateur profite du même cache.
- **Tests** :
  - **Passent** : `tsc --noEmit` (aucune nouvelle erreur), et 82 fichiers de tests ciblés (budget, crédits, comité,
    mesures, veille, montants, suivi, `memoire-intl`…).
  - **Échouent, comme sur master avant le correctif** : les 6 fichiers `tests/facecam-animee/*`, qui importent `remotion`,
    absent ici.

## Une limite de 3 Go serait-elle utile ?

**Non.** Avec le correctif, le scénario le plus chargé reste vers 500-560 Mo de RSS, dont environ 300 Mo de tas V8 au plus
fort. La limite actuelle de **2 Go** laisse plus de 1,4 Go de marge. Il vaut mieux garder `--max-old-space-size=1280`,
qui borne le tas JavaScript avant la limite du conteneur.

Si `[heap]` remonte un jour, le relevé l'aura montré bien avant 2 Go.

## À vérifier en production après la mise en ligne

- **Taille du tas glibc**, au bout de 2 h, accueil ouvert :
  `awk '/\[heap\]/{f=1;next} /^[0-9a-f]+-/{f=0} f&&/^Rss:/{s+=$2} END{print s/1024 " Mo"}' /proc/1/smaps`.
  Attendu : moins de 100 Mo (811 Mo à 2 min avant le correctif).
- **Nombre de dépenses**, qui règle l'ampleur de l'ancien problème :
  `SELECT count(*) FROM documents WHERE collection = 'depenses';`

## Observations annexes (non corrigées ici, sans effet sur la mémoire native mesurée)

- **`/api/travaux?id=` renvoie `parametres.tableau` en entier.** Pour un travail actif de 5,6 Mo appelé toutes les 2 s,
  cela fait **887 Mo transférés en 5 min**. Retirer ce champ de la vue, comme `allegerTravail` le fait pour la liste,
  économiserait CPU et réseau.
- **`ecrireAvancement` réécrit un travail actif toutes les 5 s, même inchangé** : `JSON.stringify` et une requête `pg` de
  plusieurs Mo. Mesuré sans effet sur `[heap]`, puisque les gros tampons passent par `mmap`, mais c'est un coût inutile.
- **L'oscillation de 1,10 à 1,27 Go toutes les 20 s** vue en production ressemble à celle du tas V8 mesurée ici
  (`heapTotal` varie de 100 à 150 Mo au rythme des copies). Elle n'a pas été isolée davantage.
