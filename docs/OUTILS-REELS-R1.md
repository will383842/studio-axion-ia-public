# Lot R1 — Publication Buffer réelle (brouillon d'abord)

> 03/10/2026 · branche `outils/r1` depuis `03d297b` (production) · plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md`, lot R1, constat C10.

## 1. Ce que ça change

- **Avant** : « Envoyer vers Buffer » était un essai. Rien ne partait.
- **Après** : avec `BUFFER_API_KEY` sur le serveur **et** Buffer choisi (Réglages, Connexions, Publication = « Buffer », ou `FOURNISSEUR_PUBLICATION=buffer`), chaque réseau coché devient **un brouillon dans Buffer**, avec la bonne vidéo, le texte du kit, ses mots-dièse et, pour YouTube, le titre. Rien ne part sur un réseau tant que Will ne l'a pas programmé dans Buffer.
- « Programmer directement » existe, mais **seulement sur le choix de Will** (bloc Buffer des Réglages). Sinon, c'est toujours le brouillon.
- Sans clé ou sans ce choix : la simulation reste (comportement inchangé, pastille « Essai »).

## 2. Schéma relevé (lecture seule, gratuit)

- `outils/buffer/introspection.mts` → `docs/buffer/schema-2026-10.json` (schéma complet, aucune donnée de compte).
- `outils/buffer/lire-compte.mts` → `tests/fixtures/r1-buffer-lectures.json` : compte, canaux, 3 publications, un état, des statistiques, une erreur « introuvable ». **Réponses réelles, anonymisées** (identifiants, noms, textes, liens remplacés ; l'outil refuse d'écrire si un identifiant réel ou la clé survit).
- `outils/buffer/lire-publication.mts <id>` / `--derniers` : état d'une publication et **hôte** de sa vidéo (pour l'essai réel, voir § 6).
- Compte relevé : 1 organisation, 5 comptes : Instagram (pro), Facebook ×2 (pages), LinkedIn ×2 (profil et page). **Pas de TikTok ni de YouTube** reliés dans Buffer à ce jour.

Formes confirmées (et écarts au plan) :

| Attendu par le plan | Relevé | Conséquence |
|---|---|---|
| `account { organizations { id } }` | identique | — |
| `channels(input:{organizationId})` | identique (+ `type`, `isLocked`, `displayName`) | genre du compte (profil / page) affiché pour choisir |
| `createPost(input:{…assets:{videos:[…]}})` | `assets: [AssetInput!]!` avec **une variante par élément** (`{ video: { url } }`), `mode: ShareMode!`, `schedulingType!`, `needsApproval!` obligatoires | entrée construite et **vérifiée champ par champ** contre le schéma (test) |
| `thumbnailUrl` pour la miniature | **refusé par Buffer** sur une vidéo (« the API rejects video assets that set this field ») | aucune miniature envoyée ; la plateforme prend une image de la vidéo. (`thumbnailOffset` n'existe que pour Instagram, TikTok, Pinterest : à brancher avec R4 quand une miniature aura un instant.) |
| — | Instagram exige `metadata.instagram { type, shouldShareToFeed }`, Facebook `metadata.facebook { type }` | envoyés en **Reel** (`reel`, partagé au fil) |
| — | YouTube exige `metadata.youtube.title` à la création | titre du kit, sinon 1re ligne du texte, 100 caractères au plus ; YouTube et YouTube Shorts → le même compte |
| `post(input:{id}) { status … error }` | `status` ∈ draft, needs_approval, scheduled, sending, sent, error ; `error { message }` | brouillon / programmée / publiée / échec |
| clé d'idempotence côté Buffer | **n'existe pas** | l'anti-double envoi est entièrement chez nous (§ 3) |
| statistiques `metrics { type value }` | identique ; `averageTimeWatched` « in seconds », `viewers` (LinkedIn) | `mesures/buffer.ts` recalé, vérifié sur une réponse réelle |

## 3. Garanties (relues en relecteur)

1. **Jamais deux messages.** Sous le verrou et **avant** l'appel : la publication est notée « envoi en cours » avec son empreinte `cleEnvoi = sha256(vidéo, réseau, date)`. Un second toucher, un second onglet ou « Programmer les N » : même empreinte déjà envoyée → la même publication ; envoi en cours → refus clair ; déjà dans Buffer à une autre date → refus clair (« changez sa date dans Buffer »).
2. **Coupure.** Délai dépassé (30 s), ligne coupée, panne 5xx, réponse illisible ou `UnexpectedError` après l'envoi → « **À vérifier** » (jamais « programmée »). Le studio **relit** Buffer (publications du compte depuis le début de l'envoi, même texte aux espaces et aux liens raccourcis près) : retrouvée → reliée ; toujours absente après 30 min → « absent » + notification, et seulement alors un nouvel envoi est possible. Jamais de renvoi à l'aveugle.
3. **Adresse 7 jours (C10).** La vidéo est donnée à Buffer par une adresse R2 signée **604 800 s** (au lieu de 15 min), en https ; sans stockage en ligne, refus clair avant tout envoi. En mode « programmer », une date au-delà de 7 jours est refusée (l'adresse aurait expiré).
4. **Tout vérifié avant le premier envoi** : compte du réseau (aucun / plusieurs / déconnecté), fichier au bon format, adresse en ligne. Rien ne part à moitié. Un compte manquant fait relire les comptes **une** fois (Will vient peut-être de le relier).
5. **`via: "buffer"` réussi seulement si Buffer a dit oui** : `etatEnvoi: "envoye"`, `idExterne` et statut viennent de la réponse. Refus net → « Échec » avec le message de Buffer.
6. **Aucune clé** dans un message, une publication, un journal, une fixture : le client masque tout (`masquerSecrets`), les erreurs nomment la variable `BUFFER_API_KEY`, jamais sa valeur. La clé ne part que dans l'en-tête `Authorization`.
7. **La page n'appelle jamais Buffer.** Kit, calendrier, fiche vidéo, bloc Buffer : lecture de la copie en base (`buffer.canaux`). Seuls « Envoyer », « Tester » et la boucle de fond appellent Buffer.
8. **Rien n'est effacé.** Une seule mutation existe (`createPost`) ; un test refuse toute apparition de `deletePost`, `editPost`, etc. Une publication supprimée par Will dans Buffer devient « Échec — introuvable dans Buffer », jamais effacée chez nous.
9. **Cases « Avant de publier »** : inchangées, contrôlées avant tout appel.
10. **Boucle** : états relus toutes les 15 min au plus (50 lectures par tour, les plus anciennes d'abord), comptes au plus une fois par heure, réseau **hors verrou**, écriture sous le verrou seulement si la publication n'a pas changé. Brouillon → programmée → publiée (+ lien, vidéo « publiée », version synchronisée) ; échec → notification « Buffer n'a pas pu publier ».

## 4. Fichiers

| Fichier | Rôle |
|---|---|
| `src/fournisseurs/publication/requetes.ts` | 4 requêtes + 1 mutation, recalées sur le schéma |
| `src/fournisseurs/publication/buffer.ts` | client GraphQL, `ErreurBuffer` (code, `incertain`), `entreeCreerPost` (pur), fournisseur `buffer` |
| `src/fournisseurs/publication/inscription.ts` | `publicationBuffer()` si `BUFFER_API_KEY` |
| `src/fournisseurs/index.ts` | 1 import + 1 ligne (`...publicationBuffer()`) |
| `src/fournisseurs/types.ts` | ajouts facultatifs : `ModeEnvoiPublication`, `CanalPublication`, `EtatPublicationExterne`, `DemandePublication`, `listerCanaux?`, `lireEtat?`, `publicationsRecentes?` |
| `src/domaine/buffer.ts` | correspondance réseau → compte, statuts, `retrouverEnvoi`, `occupeBuffer`, `libellePublication` (purs) |
| `src/domaine/types.ts` | `Publication` : `etatEnvoi?`, `canalId?`, `modeBuffer?`, `cleEnvoi?`, `envoiCommenceLe?`, `etatLuLe?` |
| `src/services/buffer.ts` | comptes en base, correspondance, mode, « Tester », `reconcilierEnvoi`, `synchroniserEtatsBuffer`, vues sans réseau |
| `src/services/publications.ts` | `envoyerVersBuffer` (chemin simulé inchangé) + `envoyerVersBufferReel`, `urlVideoPourBuffer`, `texteAEnvoyer` ; rien d'autre |
| `src/services/boucle.ts`, `src/services/mesures.ts` | synchronisation ; « Programmer les N » : mode + jamais une version déjà dans Buffer |
| `src/components/reglages/BlocBuffer.tsx`, `src/app/(studio)/reglages/actions-buffer.ts` | bloc Buffer (à intégrer, § 7) |
| `FeuilleEnvoyerBuffer.tsx`, `ContexteVideo.tsx`, `videos/[id]/page.tsx`, `videos/actions.ts` | libellé selon le mode, comptes par réseau, problèmes dits |
| `calendrier/page.tsx`, `OngletsLecture.tsx`, `FicheSujet.tsx`, `ecrire/sujets/[id]/page.tsx` | « Brouillon dans Buffer », « À vérifier », brouillons pour « Programmer les N » |

## 5. Preuves

- **Rouge sur 03d297b** (tests écrits avant le code, `src` intact) : `tests/r1-envoi-reel.test.ts` → **10 rouges / 11** pour les bonnes raisons (envoi simulé `simulation: true`, **0 mutation**, aucun « à vérifier », aucun refus). Puis vert.
- **Mutations** (code muté, échec constaté, restauré à l'identique) : sans relecture de l'envoi à vérifier → ROUGE 3 et « coupure avant » rougissent ; adresse ramenée à 900 s → ROUGE 2 rougit ; sans refus « en cours / déjà dans Buffer » → « deux touchers » et « déjà dans Buffer » rougissent.
- Tests du lot : `r1-envoi-reel` (13), `r1-buffer-schema` (15 : chaque requête et chaque entrée `createPost` × 6 réseaux contre le schéma, et le vérificateur prouvé rouge sur 5 requêtes fausses), `r1-buffer-client` (18), `r1-synchro-buffer` (5), `r1-ecrans-buffer` (4) — **55 verts**.
- `npx tsc --noEmit -p .` = 0 (après `next typegen`, qui ne fait que générer les types de routes ; aucun `next build`).
- `eslint` des fichiers touchés = 0.
- `vitest run --maxWorkers=2 --testTimeout=30000` complet (après relecture) : **150 fichiers, 2 017 tests verts**, 1 ignoré (délai porté à 30 s à cause de la charge de la machine partagée).
- Vérification réelle gratuite déjà faite : introspection, compte, comptes, publications, état, statistiques, « introuvable » ; `lire-publication.mts` éprouvé sur une vraie publication. **Aucune mutation réelle.**

## 6. Essai réel du premier brouillon (par le chef, à l'intégration)

Prérequis serveur : `BUFFER_API_KEY` posée ; R2 configuré et `FOURNISSEUR_STOCKAGE=r2` (la vidéo doit être sur R2) ; une vraie vidéo prête (sortie 9:16 sur R2).

1. Réglages › Connexions › **Publication → Buffer** (mode « Brouillon dans Buffer », le défaut).
2. Bloc Buffer › **Tester** → attendu : « Buffer répond : Instagram, Facebook ×2, LinkedIn ×2. »
3. Si on veut LinkedIn ou Facebook : choisir le compte (deux de chaque). Pour l'essai, **Instagram seul** suffit (un seul compte, choix automatique).
4. Fiche de la vidéo › cocher « Avant de publier » › Envoyer › **Instagram**, « Demain 9 h » › **Envoyer en brouillon**. Attendu : « Brouillon dans Buffer · 1 réseau ».
5. Lire (gratuit) : `BUFFER_API_KEY=… pnpm exec tsx outils/buffer/lire-publication.mts --derniers` puis `… lire-publication.mts <id>` → attendu `statut: "draft"`, `reseau: "instagram"`, et **`recopieeParBuffer`** :
   - `true` → Buffer a recopié la vidéo : l'expiration de l'adresse (7 jours) n'a plus d'effet ;
   - `false` → Buffer relira l'adresse R2 : garder la règle « moins de 7 jours » aussi pour les brouillons (à me signaler).
6. Will ouvre le brouillon dans Buffer (vidéo, texte, mots-dièse). Ne rien supprimer.
7. Points à confirmer pendant l'essai (le schéma ne les tranche pas) : Buffer accepte bien `dueAt` sur un brouillon (`customScheduled` + `saveToDraft: true`) ; s'il refuse, le message de Buffer s'affiche tel quel (sans clé), la publication passe « Échec », et « Maintenant » envoie le brouillon en file d'attente sans date. Enregistrer alors la vraie réponse `createPost` (anonymisée) à la place de la forme reconstituée de `tests/helpers/r1-buffer.ts`.

## 7. Points d'intégration

- **R0 (`Connexions.tsx`, `catalogue.ts`)** : l'implémentation s'appelle **`buffer`** (type `publication`), nom « Buffer », variable `BUFFER_API_KEY`, coût « gratuit ». Intégrer `<BlocBuffer vue={…} />` sous la carte Publication ; la page Réglages appelle `vueBuffer()` de `@/services/buffer` (**aucun appel réseau**). Les actions sont dans `reglages/actions-buffer.ts` (fichier à part, pour ne pas toucher `reglages/actions.ts`).
- **R2 (`publications.ts`)** : je n'ai modifié que le bloc `envoyerVersBuffer` et ajouté, juste dessous, `texteAEnvoyer`, `DUREE_URL_BUFFER_SEC`, `urlVideoPourBuffer`, `ProblemeEnvoi`, `envoyerVersBufferReel`, + 4 lignes d'import en tête. `genererKit` / `obtenirKit` intacts. Le texte envoyé = `texte` du kit + mots-dièse ; titre = `titre` du kit.
- **R3** : les échecs créent des notifications `type: "echec"` (« Buffer n'a pas pu publier », « Envoi vers Buffer non arrivé ») ; elles suivront les canaux de R3.
- **R4** : quand une miniature aura un instant, `thumbnailOffset` (Instagram, TikTok) pourra être ajouté dans `entreeCreerPost`.
- `fournisseurs/index.ts` : 1 import + 1 ligne. `.next/types` généré localement par `next typegen` (ignoré par git).

## 8. Ce que Will fait

1. Dans Buffer : relier TikTok et YouTube s'il veut y publier (aujourd'hui seuls Instagram, Facebook, LinkedIn y sont).
2. Regarder le premier brouillon dans Buffer, puis le programmer dans Buffer.
3. Choisir « Programmer directement » dans les Réglages seulement s'il le veut.

## 9. Relecture (exactitude, sécurité, simplicité) — corrections

Tests `tests/r1-relecture.test.ts` : **8 rouges** avant correction (commit `3e93bb9`), verts après.

| N° | Défaut | Correction |
|---|---|---|
| 1 | La relecture d'un envoi perdu lisait Buffer à partir de l'instant exact du début : une horloge de Buffer en retard le rendait introuvable (puis « absent », risque de double envoi) | la requête lit depuis le début − 60 s (`MARGE_HORLOGE_MS`, même marge que `retrouverEnvoi`) |
| 2 | Plusieurs réseaux : un refus (en cours, déjà dans Buffer, à vérifier, absent) était levé APRÈS l'envoi des réseaux précédents : résultat, journal, étape de la vidéo et version perdus | envois à vérifier relus d'abord, puis UNE réservation sous le verrou pour tous les réseaux ; chaque refus va dans `problemes` (avec son code), les autres réseaux partent ; journal, étape, version dans un `finally` ; erreur levée seulement si rien n'est parti ni en attente |
| 3 | « Programmer les N » comptait un envoi « à vérifier » comme programmé | il va dans « ignorées » avec sa raison |
| 4 | Synchronisation brouillon → programmée : l'étape de la vidéo ne bougeait pas | la vidéo passe « programmée » (jamais un retour depuis « publiée ») |
| 5 | Le texte brut de Buffer (pouvant contenir une adresse signée) allait dans la publication et la notification | phrase fixe à l'écran ; texte de Buffer **nettoyé** (`nettoyerDetail` : sans clé, sans `?X-Amz-…`, sans chaîne de requête) au journal seulement |
| 6 | « Absent » invitait à renvoyer tout de suite | « vérifiez dans Buffer avant de renvoyer » |
| 7 | Outil de lecture : JSON lu sans garde | lecture protégée, seul le code HTTP est affiché |
| 8-9 | Nom de variable, code HTTP et message anglais de Buffer pouvaient s'afficher | `PHRASES_BUFFER` : une phrase française par situation ; le détail (code, nom de la variable, texte brut) va dans `ErreurBuffer.detail` → journal (`noterErreurBuffer`) ; test : aucun mot en majuscules, code, adresse ni anglais rendu |
| 10 | Union `"brouillon" \| "programmer"` retapée | `ModeEnvoiPublication` défini une fois (domaine), importé partout |
| 11 | « Simulation » à l'écran, genre de compte anglais brut | « Essai » ; repli « Compte » |
| 12 | Transport GraphQL qui doublait `lireJsonPost` | `posterJson` commun (lectures de mesures et Buffer) ; une seule base de masquage (`masquerSecrets`) ; écart 429 documenté (indisponible pour une lecture, limite pour un envoi) |
| 13 | Correspondance et noms des réseaux en dur dans `domaine/buffer.ts` | `serviceBuffer` ajouté au registre `src/reseaux` ; `nomService` lit les noms du registre ; présence de la clé par `cleDans` |
| 14 | Mineurs | une seule règle de blocage dans la feuille ; `PastillePublication` (un seul calcul) ; `maintenant()` ; constantes regroupées |

## 10. Relecture « simplicité », second tour — corrections

Test `tests/g7b-import.test.ts` (« réponse 429 / 503 / 404 : le message affiché ne porte AUCUN code HTTP ») : prouvé par mutation (remettre `(${r.status})` ou `réponse ${r.status}` le fait rougir), puis restauré.

| N° | Défaut | Correction |
|---|---|---|
| 1 | `lireJsonPost` (`mesures/commun.ts`) mettait le code HTTP dans le message, qui s'affiche à l'écran (toast « Ce qui marche ») | phrases sans code (« Buffer est momentanément indisponible : réessayez dans un instant. », « … n'a pas pu répondre : réessayez plus tard. ») ; le code part en `console.warn` serveur. Concerne les deux lecteurs (Buffer, Plausible) |
| 2 | Règle « passer programmée, jamais en arrière depuis publiée » écrite deux fois | `passerProgrammee` exportée par `services/buffer.ts`, appelée par l'envoi (`publications.ts`) et la synchronisation |
| 3 | `noterErreurBuffer` retraduisait l'erreur à la main (repli divergent) | `versErreurStudio(e).message` |
| 4 | Statut de publication retapé dans `fournisseurs/types.ts` | `StatutPublication` importé ; `Extract<StatutPublication, "brouillon" \| "programmee">` pour l'envoi |
| 5 | Mineur : repli mort `changement.erreur ?? …` | phrase d'échec dans une constante, utilisée pour la publication, le journal et la notification |

## R1b — Le compte se choisit à chaque envoi

> 03/10/2026 · branche `outils/r1b` depuis `outils/integration` (`a59a726`).

**Besoin de Will.** Dans Buffer : 2 LinkedIn (profil « Williams Jullin », page « Axion-IA.com ») et 2 Facebook. « Ça dépend, ça peut être l'un ou l'autre. » Le studio imposait UN compte par réseau, choisi dans Réglages. Désormais le compte se choisit **à chaque envoi**.

### Ce qui change pour Will

1. **Feuille « Envoyer vers Buffer »** : un réseau à plusieurs comptes montre **une case par compte** (« LinkedIn · Williams Jullin », « LinkedIn · Axion-IA.com » ; si deux comptes portent le même nom, « (Profil) » / « (Page) » les distingue). Il coche l'un, l'autre ou les deux. Un réseau à un seul compte reste une seule case. Une vidéo écrite pour LinkedIn montre les deux comptes LinkedIn seulement.
2. **Par défaut** : le dernier choix pour ce réseau (mémorisé à chaque envoi). Sans dernier choix, **aucun compte n'est coché** et une phrase le dit (« Plusieurs comptes LinkedIn : cochez le ou les comptes où envoyer. »). Jamais d'envoi vers un compte que Will n'a pas vu.
3. **Un seul texte par réseau** : le texte LinkedIn du kit part sur les deux comptes LinkedIn.
4. **« Programmer les N »** : utilise le compte mémorisé de chaque réseau. Sans mémoire pour un réseau à plusieurs comptes, ce réseau est **mis de côté** : « Plusieurs comptes LinkedIn dans Buffer : choisissez le compte LinkedIn une première fois, en envoyant une vidéo. » Les autres réseaux partent.
5. **Réglages › Buffer** : le choix devient « Compte LinkedIn proposé par défaut » (on peut en cocher un, deux ou aucun) ; la ligne du réseau dit « 2 comptes : vous choisissez à chaque envoi ». Ce réglage et le dernier choix à l'envoi sont **la même mémoire** (le dernier geste l'emporte).
6. **Affichage** : chaque publication garde le nom du compte visé (`canalNom`) ; calendrier (« 09:00 · Axion-IA.com ») et fiche vidéo (« LinkedIn · Axion-IA.com »). Une publication d'avant R1b garde le seul nom du réseau.

### Garanties (§ 3, toujours vraies)

- **Empreinte par compte** : `cleEnvoi = sha256(vidéo, réseau, date, compte)`. Même vidéo + même réseau + deux comptes = **deux envois légitimes** ; le même compte deux fois (dans une même demande, renvoyé, ou deux onglets) = **un seul** envoi.
- « Déjà dans Buffer », « en cours », « à vérifier », « absent » se décident désormais **par compte** : la page déjà dans Buffer n'empêche pas d'envoyer au profil ; le même compte à une autre date reste refusé (« changez sa date dans Buffer »).
- Verrou, réservation unique avant tout appel, relecture de Buffer pour « à vérifier », brouillon par défaut, adresse 7 jours, vérifications avant le premier envoi : **inchangés**. Un compte coché qui n'est pas de ce réseau, ou déconnecté, arrête tout **avant** le premier envoi.

### Données existantes (ajout pur)

- `Publication.canalNom?` (facultatif). Aucune publication existante n'est modifiée.
- `buffer.correspondance` accepte l'ancienne forme (un identifiant) et la nouvelle (une liste) : `idsMemorises`.
- Une publication d'avant R1b (empreinte sans compte) est toujours reconnue comme « le même envoi » : rien n'est renvoyé (test).
- Une publication sans compte (`canalId` absent) occupe tout le réseau, par prudence.

### Fichiers

| Fichier | Rôle |
|---|---|
| `src/domaine/comptes-envoi.ts` (nouveau, pur) | cases de la feuille (`casesEnvoi`, `casesParDefaut`, `ciblesDepuisCases`), `libelleGenre`, `libelleReseauCompte` |
| `src/domaine/buffer.ts` | `comptesPourReseau` (cochés → mémorisés → seul compte ; plusieurs sans choix → jamais deviné), `idsMemorises` ; `canalPourReseau` gardé |
| `src/services/buffer.ts` | `cleEnvoiBuffer(…, compte)`, `comptesBufferPour` (remplace `canalBufferPour`), `memoriserComptesBuffer`, `choisirCanalBuffer` (compte proposé par défaut), vues `vueBuffer` / `vueEnvoiBuffer` |
| `src/services/publications.ts` | `envoyerVersBuffer(…, { comptes })` ; un envoi par compte ; occupation et empreinte par compte |
| `src/services/mesures.ts` | « Programmer les N » : toutes les publications confirmées, chaque refus dans « ignorées » |
| `FeuilleEnvoyerBuffer.tsx`, `videos/actions.ts` | cases par compte, comptes cochés envoyés |
| `BlocBuffer.tsx`, `reglages/actions-buffer.ts` | « compte proposé par défaut » |
| `calendrier/page.tsx`, `OngletsLecture.tsx` | nom du compte affiché |

### Preuves

- **Rouge d'abord** (commit `26c4118`, `src` intact) : `tests/r1b-comptes.test.ts` → **8 rouges / 10** pour les bonnes raisons (option `comptes` ignorée → « Plusieurs comptes LinkedIn… choisissez lequel dans Réglages » ; module des cases absent ; « Programmer les N » sans la phrase attendue). Les 2 verts d'origine sont des garanties à garder (refus d'un compte d'un autre réseau, publication d'avant R1b reconnue).
- **Mutations** (code muté, échec constaté, restauré) : empreinte sans compte → « deux comptes = deux envois » rougit ; occupation par réseau au lieu de par compte → « deux comptes » et « la page n'empêche pas le profil » rougissent.
- `npx tsc --noEmit` = 0 ; `npx eslint .` = 0 ; `npx vitest run` complet : **155 fichiers, 2 155 tests verts** (2 ignorés) ; `npx next build --webpack` = 0.
- Aucun appel réseau réel, aucune clé (doublure `tests/helpers/r1-buffer.ts`).

### À l'intégration

- Essai réel (§ 6) : cocher « LinkedIn · Axion-IA.com » seul, puis les deux comptes sur une autre vidéo → deux brouillons dans Buffer, un par compte.
