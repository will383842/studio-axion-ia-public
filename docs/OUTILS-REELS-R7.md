# Lot R7 — Double HeyGen (relevé)

> Branche `outils/r7` depuis `03d297b` (production). Non poussée.
> **Décisions de Will du 03/10/2026** (elles priment sur le plan `PLAN-MOTEUR-DOUBLE.md` §B.1 à §B.5) :
> 1. « Ne pas créer dans le studio ce que les outils connectés font déjà » : Will **crée et essaie son double dans
>    l'application HeyGen**.
> 2. Will **fait lui-même ses vidéos avec son double dans l'application HeyGen**. Le studio ne lance **aucun rendu
>    d'avatar** (aucune génération, rien payé sur le porte-monnaie HeyGen). Il va chercher la vidéo terminée, la range
>    sous sa version, et le moteur avocat fait la finition.
>
> Aucun appel HeyGen réel pendant le lot : aucune clé dans l'environnement du poste (vérifié sans l'afficher), tout est
> testé sur des réponses construites d'après la documentation publique relue le 03/10/2026.

## Ce qui est livré

### « Ma vidéo HeyGen » (le cœur du lot)

**Ce que ça change pour Will.** Il fait sa vidéo dans HeyGen avec son double, en lisant le texte validé de la version.
Dans le studio, sur la version (Sujets › le sujet › la version « je lis »), le bouton **« Ma vidéo HeyGen »** ouvre la
liste de ses vidéos HeyGen récentes : titre, date, durée (aperçu neutre, voir « Corrections sécurité » n° 7). Il touche **« Rattacher »** : le studio télécharge
la vidéo dans son stockage et la range comme une prise de cette version. Le bouton habituel **« Monter ma prise »**
apparaît alors et fait la finition : calage sur le texte validé, son, sous-titres, miniature (même chemin que
« Filmer ici »). Si la vidéo n'apparaît pas dans la liste : il la télécharge depuis HeyGen et la **dépose** dans la
même feuille (envoi par morceaux existant, reprise si le réseau coupe).

| Élément | Fichier |
|---|---|
| Lecture des vidéos du compte (liste, détail avec adresse fraîche, copie en flux) | `src/fournisseurs/heygen/videos-compte.ts` |
| Inscription : la clé seule suffit (lectures gratuites) | `src/fournisseurs/heygen/inscription.ts` (`videosHeygen`) |
| Service : lister, rattacher (télécharger puis ranger), secours par dépôt | `src/services/videos-heygen.ts` |
| Rangement d'une prise sous sa version, partagé avec la séance de tournage | `src/services/tournage.ts` (`rangerPriseDeVersion`) |
| Écran (feuille « Ma vidéo HeyGen », dépôt de secours) | `src/components/generateur/VideoHeygen.tsx`, `FicheSujet.tsx` |
| Actions | `src/app/(studio)/ecrire/sujets/actions.ts` |

**Garde-fous.** Uniquement des lectures chez HeyGen (`GET`) ; une vidéo n'est jamais rattachée deux fois (mot-clé
`heygen:{id}` sur la prise brute ; second clic = rien de plus, aucun téléchargement) ; une vidéo pas terminée est
refusée en clair, sans téléchargement ; sans stockage relié, refus clair et rien n'est rangé ; le téléchargement se fait
hors verrou, le rangement seulement après sa réussite ; en secours, seul un fichier envoyé pour CETTE version est
accepté. Une version déjà fabriquée garde sa vidéo. Rien n'est jamais effacé, sauf la copie d'une vidéo HeyGen
refusée par les contrôles ci-dessous (elle n'a jamais été rangée). Voir aussi « Corrections sécurité ».

### Le double relié au personnage (gardé : déjà fait et simple)

Personnages › Visages › « Votre double HeyGen » : lecture gratuite des doubles du compte
(`GET /v3/avatars/looks?ownership=private&avatar_type=digital_twin`), un double terminé devient un visage « prêt » du
personnage ; « Ne plus utiliser ce double » range la liaison (rien d'effacé). Le studio ne le fait pas parler.
Fichiers : `src/fournisseurs/heygen/doubles.ts`, `src/services/doubles-heygen.ts`, `ChoixDoubleHeygen.tsx`.

## Ce qui est retiré ou éteint (historique intact, aucune réécriture, aucune donnée effacée)

| Retiré / éteint | Commit |
|---|---|
| Création du double par la console (`POST /v3/avatars`), accord filmé et code QR, suivi de l'apprentissage, travail « préparation du double » : `creerDouble` d'un fournisseur réel refuse clairement, sans appel | `aac0aef` |
| Banc d'essai, notes de Will, validation (R7c) | `aac0aef` |
| Vérification des vidéos et découpe du passage d'entraînement (R7a), texte de tournage, `HEYGEN_EXTRAIT_MAX_MO`, mesure du son | `aac0aef` |
| **Rendu du double par le studio** (R7d : piste principale, second angle par passages, garde-fous de dépense) : écrit et testé dans `51f3830`, **éteint** dans `789df95` | `789df95` |

Éteint = `RENDU_AVATAR_PAR_LE_STUDIO = false` (`src/fournisseurs/heygen/rendus.ts`). Aucune variable ne l'allume ; seuls
les tests passent une autorisation explicite. Conséquences : le fournisseur refuse `rendre` sans appel ; un montage
réel avec le double est refusé dès le lancement, avant toute réservation (« Votre double parle dans l'application
HeyGen : faites-y la vidéo, puis rattachez-la à sa version ») ; l'estimation n'annonce plus rien au nom de HeyGen.
Les garde-fous de dépense du rendu restent écrits pour le jour où il serait rallumé : confirmation toujours exigée
quand un double réel figure dans l'estimation (`src/domaine/double-reel.ts`, contrôlée dans `credits.ts`, feuille
« Votre double va parler »), montage simulé = aucun envoi, plafond de 1,5 fois les secondes annoncées.

Aucune migration de données n'avait été ajoutée par R7. Les champs facultatifs des visages (vidéos vérifiées,
accord, banc) ne sont simplement plus écrits ; l'opération `extrait` de `studio-rendu` reste (tranches d'audio).

## Réponses de la documentation HeyGen (developers.heygen.com, relue le 03/10/2026)

- **Vidéos du compte** : `GET /v3/videos` (reference/list-videos) — « Returns a paginated list of all videos in the
  account » ; `limit` 1 à 100 (défaut 10), `token` (curseur), filtres `folder_id` et `title`. Champs : `id`, `title`,
  `status` (pending · processing · completed · failed), `created_at`, `completed_at`, `duration`, `thumbnail_url`,
  `video_url`.
- **Vidéos faites dans l'application web : incluses ?** La documentation ne le dit **pas explicitement** ; « all videos
  in the account » le laisse penser. **À vérifier au premier essai** avec la clé (la liste est gratuite). D'où le
  secours par dépôt manuel, déjà en place.
- **Adresse de téléchargement** : `GET /v3/videos/{video_id}` (reference/get-video) → `video_url`, « Presigned URL to
  download the video file ». Sa durée de validité **n'est pas documentée** : le studio la relit juste avant chaque
  téléchargement.
- **Gratuit ?** La facturation de l'API est au porte-monnaie, « à la seconde produite » (génération) ; les lectures
  (`GET` de liste et de détail) ne figurent dans aucun tarif. Le téléchargement depuis l'adresse signée n'est pas un
  appel à l'API. Considérées gratuites, à confirmer sur le relevé du porte-monnaie après le premier essai.
- **Double créé dans l'application, utilisable par l'API ?** Oui : la page « generate-avatar-video » liste les doubles
  par `GET /v3/avatars/looks?avatar_type=digital_twin&ownership=private` ; « The look id is the avatar_id to pass when
  creating a video ». (Sans objet désormais : le studio ne génère plus.)
- Pour mémoire, prix Avatar V relevé : ≈ 0,0667 $ par seconde (le code arrondit à 7 centimes de dollar).

## Corrections sécurité (relecture `3042b94`, refusée — veto levé ici, nouvelle relecture à demander)

Rapport : `docs/controles/RELECTURE-R7-SECURITE-3042b94.md` (branche `relectures/r7-securite-3042b94`). Aucune relecture
d'exactitude n'était arrivée au moment de ces corrections.

| N° | Défaut | Correction | Fichier |
|---|---|---|---|
| 1 | Téléchargement : seul `https` exigé, redirections suivies (SSRF) | Liste blanche d'hôtes HeyGen en **une** constante commentée (`HOTES_TELECHARGEMENT_HEYGEN` : `heygen.ai`, `heygen.com` et leurs sous-domaines) ; `https`, port 443, sans identifiants ; IP écrites en clair refusées ; chaque adresse DNS doit être publique (privées, boucle locale, lien local, CGNAT, multidiffusion, IPv6 locales et transposées refusées) ; `redirect: "manual"` et **chaque saut revalidé** de la même façon, 3 sauts au plus | `src/fournisseurs/heygen/telechargement.ts` |
| 2 | Taille non bornée, `arrayBuffer()` sans `content-length` | Plafond `HEYGEN_VIDEO_MAX_MO` (défaut 2 048 Mo) ; taille annoncée **exigée** et plafonnée, refus **avant** de lire le corps ; octets réellement relayés comptés (au-delà de l'annonce : arrêt) ; plus aucun `arrayBuffer()` | `telechargement.ts` (`copierEnFlux`, partagé avec `visage.ts`) |
| 3 | Type de fichier jamais lu avant FFmpeg | Avant de ranger (HeyGen **et** dépôt de secours) : lecture des 16 premiers octets de l'objet **stocké** (R2, `Range`) ; seuls ISO-BMFF (`ftyp` à l'octet 4) et Matroska/WebM (`1A 45 DF A3`) passent ; sinon refus, rien rangé, la copie HeyGen est effacée. studio-rendu (défense en profondeur) : chaque prise de l'assemblage est rouverte avec `-protocol_whitelist file` et le démultiplexeur **imposé** (`-f mov` / `-f matroska`) d'après ses premiers octets, refus sinon | `src/lib/signature-video.ts`, `src/services/videos-heygen.ts`, `src/fournisseurs/r2/stockage.ts` (`lireDebut`), `studio-rendu/src/entrees-video.ts`, `studio-rendu/src/operations/assemblage.ts` |
| 4 | Secours : fichier « en attente » accepté | Statut « prêt » exigé | `src/services/videos-heygen.ts` |
| 5 | Taille du dépôt déclarée, jamais relue | `confirmerDepot` (HEAD R2) rend la taille réelle ; comparée au descriptif et au plafond (envoi par morceaux) et à la taille relayée et au plafond (HeyGen) | `src/services/envois.ts`, `src/services/videos-heygen.ts`, `stockage.ts` |
| 6 | Double clic : deux téléchargements, deux prises ; objets orphelins | « Déjà rattachée » lu **sous le verrou**, puis **réservation** de la vidéo avant tout téléchargement (second clic : « déjà en train d'arriver » ou la même prise) ; revérifié sous le verrou dans `ranger` ; la fiche du fichier n'est écrite qu'au rangement ; tout échec après la copie **efface l'objet** (`supprimer`, DELETE R2 signé) | `src/services/videos-heygen.ts`, `stockage.ts` |
| 7 | Aperçus HeyGen bloqués par la CSP | CSP **non** ouverte ; aperçu **neutre** (icône, titre, date, durée) | `src/components/generateur/VideoHeygen.tsx` |

**À faire au premier essai réel (avec la clé) :**
- *Hôte des vidéos :* si un rattachement répond « Cette vidéo HeyGen vient d'une adresse inattendue », le journal du
  serveur contient `[heygen] téléchargement refusé : hôte hors liste « … »` : ajouter cet hôte **exact** à
  `HOTES_TELECHARGEMENT_HEYGEN` (jamais un domaine entier de CDN partagé : `cloudfront.net`, `amazonaws.com`…).
- *Aperçus (n° 7) :* relever l'hôte **exact** des `thumbnail_url` renvoyées par `GET /v3/videos` (non vu sans clé ;
  probablement un sous-domaine de `heygen.ai`/`heygen.com`, à confirmer) ; l'ajouter **seul** à `img-src` dans
  `next.config.ts`, puis remettre l'image dans `ListeVideos`. Pas de joker.
- *Plafond :* `HEYGEN_VIDEO_MAX_MO` (facultatif, défaut 2048), transmis par `deploiement/docker-compose.yml`, modèle dans
  `deploiement/env.exemple`.

**Limites connues.** Entre la vérification DNS et la connexion, un DNS hostile pourrait répondre autrement
(« rebinding ») : la liste blanche d'hôtes HeyGen reste la garde principale. Les opérations `extrait` (vidéo) et
`analyse-media` de studio-rendu lisent une adresse signée R2 (https) et ne sont pas appelées sur les prises
aujourd'hui ; elles n'ont pas reçu le format imposé.

**Preuves.** `tests/r7-securite-telechargement.test.ts` (15 tests) et 7 tests ajoutés à `tests/r7-videos-heygen.test.ts`.
Chaque garde a été cassée temporairement, le test correspondant est devenu ROUGE, puis la garde a été restaurée
(15 mutations, voir ci-dessous) : hôte hors liste → aucun appel ; 302 vers IP privée → refus ; taille absente ou
excessive → refus sans dépôt ; `#EXTM3U` déclaré `video/mp4` → refus (studio et studio-rendu) ; double clic → une
seule prise. Contrôles : `npx tsc --noEmit` propre (racine et studio-rendu), eslint propre sur les fichiers touchés,
`npx vitest run` complet vert (149 fichiers).

## Corrections exactitude (relecture `3042b94`, refusée — nouvelle relecture à demander)

Rapport : `docs/controles/RELECTURE-R7-EXACTITUDE-3042b94.md` (branche `relectures/r7-exactitude-3042b94`).

**Vrai défaut n° 1 — double rattachement hors verrou : déjà corrigé par `fc2a69f`, désormais PROUVÉ.** La réservation
sous le verrou avant le téléchargement et le recontrôle dans `ranger` tiennent. Trois tests ajoutés à
`tests/r7-videos-heygen.test.ts`, avec un téléchargement (ou une relecture du fichier stocké) RALENTI de 60 ms et deux
appels lancés ensemble : même version → un téléchargement, une prise brute, une prise ; même vidéo sur deux versions →
rangée sous une seule ; secours (fichier déposé) → une prise brute, une prise. Les trois sont ROUGES avec le service
de `3042b94` remis en place (2 téléchargements, 2 prises brutes, 2 prises), verts sur la tête.

**Vrai défaut n° 2 — écriture payante chez HeyGen via les décors « look HeyGen » : corrigé.**
- `creerLook` du fournisseur HeyGen (`fournisseurs/heygen/visage.ts`) refuse SANS APPEL tant que
  `RENDU_AVATAR_PAR_LE_STUDIO` est faux (même garde que `rendre`) : plus aucun `POST /v3/avatars` possible ;
- `doublesDeBasePourLooks` (`services/personnages.ts`) n'accepte plus un visage HeyGen comme base de décor tant que
  le rendu est éteint ;
- `estimerLookDecor` répond, pour HeyGen : 0 €, aucun angle, phrase « Les décors réalistes se font dans
  l'application HeyGen. Le studio ne fabrique rien chez HeyGen. » (affichée dans la feuille du décor, bouton
  « Fabriquer » masqué) ; `preparerLookDecor` refuse avec la même phrase (`DECOR_DANS_HEYGEN`), avant le budget.
- Tests ROUGES (`tests/r7-double-heygen.test.ts`) : double HeyGen choisi + décor réaliste confirmé → aucun `POST`
  vers `api.heygen.com`, rien rangé, rien payé (sans correction : estimation 0,90 € puis `POST /v3/avatars` observé) ;
  visage HeyGen jamais une base, `creerLook` refuse sans appel. Chaque garde cassée seule → test rouge (3 mutations,
  restaurées). `tests/b1-decors.test.ts` : le `creerLook` réel n'est essayé qu'avec le rendu autorisé (tests), et le
  refus par défaut sans appel y est vérifié.

**Petits défauts.**
- n° 3 et 4 : « déjà rattachée » est décidé sur la version RELUE sous le verrou ; si la prise brute `heygen:{id}`
  existe sans sa prise dans la vidéo (arrêt du serveur entre deux écritures), le rangement est COMPLÉTÉ
  (`ajouterPriseAVideo`, `services/tournage.ts`) — sans retélécharger ni doubler (HeyGen et secours). Tests rouges.
- n° 5 : plafond de taille et contrôle du contenu déjà faits par `fc2a69f` ; ajouté : une vidéo de plus de
  max(3 min, 3 × la durée estimée de la version) est refusée AVANT tout téléchargement (« Cette vidéo est bien plus
  longue que le texte de cette version. Vérifiez que c'est la bonne. »). Test rouge.
- n° 6 et 7 : déjà corrigés par `fc2a69f` (messages propres au téléchargement, fichier « prêt » exigé).
- n° 8 : seule une version « Je lis » reçoit une vidéo HeyGen (refus côté serveur, HeyGen et secours). Test rouge.
- n° 9 : « Une vidéo de 2 minutes suffit pour un premier double. » remplacé par « Votre double se crée dans
  l'application HeyGen, puis se relie ici. » Test rouge (`tests/r7-ecrans.test.ts`).
- n° 10 : § « Comment l'activer » précisé (rôle de `FOURNISSEUR_VISAGE`).

Contrôles (tête de cette correction) : `npx tsc --noEmit` propre ; `npx eslint .` propre ; `npx vitest run` complet
vert — 148 fichiers réussis, 1 sauté (149) ; 2008 tests réussis, 2 sautés.

## Comment l'activer en ligne

1. Coolify (studio) : `HEYGEN_API_KEY` = la clé API du compte HeyGen de Will (déjà utilisée par la voix si elle est
   reliée). `FOURNISSEUR_VISAGE` n'est pas nécessaire pour « Ma vidéo HeyGen ». Il ne sert qu'à l'écran
   Personnages › « Votre double HeyGen » (relier le double au personnage). Avec `FOURNISSEUR_VISAGE=heygen`, les décors
   réalistes ne sont PAS fabriqués par le studio : l'écran Décors dit « Les décors réalistes se font dans l'application
   HeyGen. Le studio ne fabrique rien chez HeyGen. » et aucun appel payant ne part (voir « Corrections exactitude »).
2. Stockage R2 relié (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
   `FOURNISSEUR_STOCKAGE=r2`) : sans lui, le rattachement refuse clairement.
3. Redémarrer le conteneur (prévenir d'abord la session qui gère le studio).
4. Premier essai : ouvrir « Ma vidéo HeyGen » sur une version validée. Si la vidéo faite dans l'application n'est pas
   dans la liste, noter ici que l'API ne les montre pas, et utiliser le dépôt.

**Coût : 0 €** côté HeyGen pour le studio (lectures et téléchargement). Les vidéos sont payées par Will dans
l'application HeyGen (son forfait). La finition (« Monter ma prise ») coûte ce qu'elle coûtait déjà (prix affiché sur le
bouton).

## Preuves

- `tests/r7-videos-heygen.test.ts` (14 tests, dont 7 des corrections sécurité) : vidéos en mots simples, liste = une seule lecture, sans clé aucun appel ;
  ROUGES prouvés par mutation puis restaurés : « jamais rattachée deux fois », « pas terminée → aucun
  téléchargement », « fichier d'une autre version refusé » ; écran sans nom technique.
- `tests/r7-double-heygen.test.ts` (13 tests) : ROUGE « éteint par défaut » (constante passée à vrai → rouge ; refus du
  fournisseur retiré → rouge) ; garde-fous du rendu conservé, chacun prouvé par mutation : confirmation, montage
  simulé, plafond, refus du double d'essai (moteur).
- `tests/r7-ecrans.test.ts`, `tests/b1-decors.test.ts` (création et rendu refusés sans appel).
- `tests/montage-avocat.contrat.test.ts` : le test du stockage non relié prend la même vidéo sans double (le montage
  réel avec double est désormais refusé au lancement).
- Contrôles : `npx tsc --noEmit` propre, eslint propre sur tous les fichiers touchés, `npx vitest run` complet vert.

## R7e — « Votre avatar parle dans le studio » (réglage, éteint par défaut)

> Branche `outils/r7e` depuis `outils/r7` (`091da34`). **Décision explicite de Will du 03/10 (~19 h 40, « oui pour le
> A »)** : il crée son avatar dans l'APPLICATION HeyGen à partir d'une vidéo filmée ; sa voix est déjà clonée dans
> HeyGen. Le studio, à partir d'un texte validé, fait parler l'avatar avec la voix clonée par l'API HeyGen (porte-monnaie
> API, ≈ 0,067 $/s Avatar V), puis monte la vidéo avocat. Le studio NE CRÉE PAS l'avatar (création, accord, banc :
> toujours retirés). Lot de code et de tests seulement : **aucun appel réseau réel, aucune clé, aucune dépense**.
> Le rendu reste **ÉTEINT** : c'est Will qui l'allume dans l'écran.

### Ce que ça change pour Will

- **Réglages › Connexions › Double** : interrupteur « Votre avatar parle dans le studio » (éteint), prix d'une minute
  (« Environ 3,78 € par minute de vidéo. » au taux du studio), choix du fond (« Sans fond, posé sur vos décors » ou
  « Fond uni ») et la consigne ci-dessous. Chaque changement est noté au journal.
- **Personnages › Visages › « Choisir mon double HeyGen »** : UN ou DEUX avatars du compte — « Angle principal, trois
  quarts » et « Second angle, presque de face ». L'avatar de l'angle principal devient le visage par défaut du
  personnage ; sans tenue indiquée, le second reprend celle du premier (sinon les deux angles ne sont jamais réunis).
  Pour le second angle, un avatar du même service est préféré à un ancien visage d'essai (`domaine/distribution.ts`).
- **Avant chaque vidéo** où l'avatar parle : feuille « Votre avatar parle » — « Votre avatar parle dans cette vidéo :
  environ 3,20 €, à confirmer. » (même phrase côté serveur si la confirmation manque). Le bouton n'a plus la pastille
  d'essai dans ce cas (vraie dépense).
- Éteint : rien ne change (« Votre avatar ne parle pas dans le studio : allumez-le dans Réglages, Connexions, Double,
  ou faites la vidéo dans l'application HeyGen et rattachez-la à sa version »). **« Ma vidéo HeyGen » reste en secours.**

### Comment c'est fait

| Élément | Fichier |
|---|---|
| Réglage `double.rendu` = { allume, fond }, éteint par défaut, session exigée, journal ; lecture pour le fournisseur | `src/services/rendu-double.ts` |
| Plus de constante `RENDU_AVATAR_PAR_LE_STUDIO` ; `ReglageRenduDouble`, `FOND_UNI_AVATAR` ; recherche par titre `GET /v3/videos?title=` | `src/fournisseurs/heygen/rendus.ts` |
| **Décors « look HeyGen » : constante SÉPARÉE `LOOKS_HEYGEN_PAR_LE_STUDIO = false`, inchangée par le réglage** | `rendus.ts`, `visage.ts` (`creerLook`), `services/decors.ts`, `services/personnages.ts` |
| Réglage figé dans la commande au lancement (`CommandeFabrication.renduDouble`) | `src/services/fabrication.ts`, `src/domaine/types.ts` |
| Estimation au nom de HeyGen seulement si allumé | `src/briques/index.ts` |
| Moteur : réglage de la commande (`renduAllumeDans`) ; refus clair sinon, avant toute réservation | `src/moteurs/montage-avocat/double.ts`, `index.ts` |
| Fournisseur : réglage RELU avant chaque envoi payant (`renduAllume`, branché à l'inscription) | `src/fournisseurs/heygen/visage.ts`, `inscription.ts` |
| Écran | `src/components/reglages/Double.tsx`, `src/app/(studio)/reglages/page.tsx`, `actions.ts` |
| Phrase de confirmation | `src/domaine/double-reel.ts` (`phraseAvatarParle`), `services/credits.ts`, `assistant/etapes/Apercu.tsx` |

### Garde-fous (tous actifs)

1. **Éteint par défaut**, double garde : réglage figé dans la commande (rien d'annoncé, montage réel refusé avant
   réservation) ET relu par le fournisseur juste avant chaque envoi (l'éteindre pendant une vidéo arrête l'envoi suivant).
2. **Prix annoncé et confirmation toujours exigée** quand l'avatar parle, quel que soit le seuil (`credits.ts`).
3. **Budget du mois** : contrôlé et réservé avant tout appel (`verifierEtReserver`, inchangé).
4. **Plafond** : jamais plus de 1,5 × les secondes annoncées envoyées (`plafondSec`).
5. **Jamais d'envoi en simulation** : sans montage réel relié, l'avatar n'est jamais envoyé.
6. **Pas de dépense en double à la reprise** : l'envoi se fait en DEUX tours. Tour 1 : la décision est gardée (titre
   unique = titre · angle · empreinte de la clé d'idempotence, secondes comptées) sans appel. Tour 2 : recherche GRATUITE
   d'un rendu de même titre (la demande était peut-être arrivée avant une panne) ; trouvé → repris SANS second envoi ;
   sinon envoi avec la même clé. Recherche impossible : envoi avec la MÊME clé (HeyGen ne facture pas deux fois).
7. **Idempotence** : clé stable `rendu:{travail}:{angle}:{n}:e{essai}` (R7d), « Réessayer » garde les passages faits.

### La voix d'abord, chaque angle sur le même son (vérifié dans R7d, testé ici)

R7d fait bien « le son d'abord » : la voix clonée produit l'audio maître UNE fois ; l'angle principal est rendu en une
piste sur cet audio entier (`audio_url`, jamais `script` ni `voice_id`) ; le second angle seulement sur ses passages
± 1 s, chacun sur une tranche découpée DANS ce même audio maître (`extrait`). Les lèvres sont pilotées par l'audio.
Ajout R7e : le second angle attend que l'angle principal soit accepté par HeyGen.

### Fond : ce que dit la documentation HeyGen

Le site developers.heygen.com est bloqué par le proxy de ce poste ; lu par le moteur de recherche (page
« transparent-background-videos », 03/10/2026) : *« Transparent output requires an avatar trained with matting
(background separation) — the default for recently-created avatars, so most Digital Twins and Studio Avatars
qualify. »* ; sinon la demande webm est REFUSÉE : *« This video avatar does not support webm output. The avatar must be
trained with matting enabled. »* ; `output_format: "webm"` marche avec `engine: { type: "avatar_v" }`. Aucun champ de
la liste des avatars ne dit d'avance si le détourage est là (non documenté).

**Conclusion : oui pour la plupart des avatars créés dans l'application, pas garanti.** Donc :
- par défaut, « sans fond » : webm transparent posé sur nos décors ;
- **repli automatique** : si HeyGen refuse « sans fond » ET que rien n'est encore parti, toute la vidéo passe en fond
  uni (mp4 sur `#202326`, `background: { type: "color" }`, pistes opaques, sans liseré) ; si l'angle principal est
  déjà parti, arrêt clair (« Votre avatar n'a pas été créé sans fond dans HeyGen. Choisissez « fond uni » dans
  Réglages, Connexions, Double, ou refaites l'avatar dans HeyGen. »), rien n'est payé deux fois ;
- Will peut choisir « Fond uni » d'avance.

**Consigne pour Will** : en créant l'avatar dans HeyGen, garder le fond détouré (réglage par défaut des avatars
récents) ; au premier essai, regarder si la vidéo arrive « sans fond ». **À vérifier au premier essai réel** : le champ
`background` couleur en mp4 sur `POST /v3/videos` (v3 non relu en entier faute d'accès) et le filtre `title` de
`GET /v3/videos` (le studio compare le titre exact lui-même).

### Comment l'allumer (Will)

Pré-requis inchangés (§ « Comment l'activer en ligne ») + `FOURNISSEUR_VISAGE=heygen` (inscrit le fournisseur de
l'avatar) et `STUDIO_RENDU_URL` (montage réel). Puis : Personnages › relier l'avatar (un ou deux angles) ; Réglages ›
Connexions › Double › allumer ; lancer une vidéo, lire le prix, confirmer.

### Preuves

`tests/r7e-avatar-parle.test.ts` (19 tests). Chaque garde cassée seule → test ROUGE, puis restaurée :

| Mutation | Test devenu rouge |
|---|---|
| Réglage allumé par défaut (`lireRenduDouble`) | réglage éteint → aucun appel |
| Fournisseur ne relit plus le réglage | réglage éteint PENDANT la vidéo |
| Confirmation de l'avatar retirée (`credits.ts`) | sans confirmation → aucun appel |
| Recherche à la reprise retirée | panne juste après l'envoi → aucun second envoi |
| Envoi dans le même tour que la décision | panne juste après l'envoi |
| Plafond retiré | plafond dépassé → refus (R7e et R7d) |
| `LOOKS_HEYGEN_PAR_LE_STUDIO = true` | décors « look » → aucun appel (R7e et R7, 3 tests) |
| Tranche découpée dans un autre son | deux angles sur le même son |
| Second angle rendu sur l'audio entier au lieu de sa tranche | deux angles sur le même son |
| Repli « fond uni » retiré | repli automatique |
| Second angle n'attend plus le principal | le second angle attend |

Mis à jour : `tests/r7-double-heygen.test.ts` (envoi en deux tours, nouvelle phrase), `tests/b1-decors.test.ts`
(`looksAutorises` séparé de `renduAvatarAutorise`).

Contrôles (tête de R7e) : `npx tsc --noEmit` propre (racine et studio-rendu) ; `npx eslint .` propre ; `npx vitest run`
complet vert — 149 fichiers réussis, 1 sauté (150) ; 2027 tests réussis, 2 sautés ; `npx next build --webpack` réussi.
Aucun appel réseau réel, aucune clé, aucune dépense pendant le lot.

## R7e — corrections après relecture (`docs/controles/RELECTURE-R7E-a18f218.md`, EXACTITUDE refusée)

Nouvelle relecture à demander sur la tête de `outils/r7e`. Chaque test ci-dessous a été vu ROUGE avant sa correction
(correction retirée ou pas encore écrite), puis vert.

### Les 2 vrais défauts

| N° | Défaut | Correction | Test (rouge avant) |
|---|---|---|---|
| 1 | Secondes comptées au tour 1 et jamais rendues quand l'envoi est refusé AVANT acceptation (réglage éteint, crédits épuisés, refus HeyGen) : « Réessayer » butait sur un plafond faussement atteint | `moteurs/montage-avocat/double.ts` : toute erreur non réessayable pendant l'envoi rend la durée de la pièce au compteur (une fois ; le repli « sans fond » ne la rend plus en double) | `r7e-avatar-parle` « éteint au tour 2 puis rallumé » : 0 envoi au refus, compteur à 0, puis « Réessayer » → 1 envoi, 30 s ≤ 45 s |
| 2 | Fond uni + deux angles : décodeur vp9 forcé sur les passages mp4 → composition en échec après paiement | `studio-rendu/src/composition/image-ffmpeg.ts` : `decodeurDouble` (vp9 seulement pour un `.webm`), même règle pour la piste principale et chaque passage | `r7e-correctifs` : arguments FFmpeg avec passages `.mp4`, et VRAI passage FFmpeg (piste et passage mp4 H.264 → master de 50 images). Avant : « Bitstream not supported by this decoder » |

### Les petits défauts

| N° | Correction | Test (rouge avant) |
|---|---|---|
| 3 | « Fabriquer les N », « Fabriquer cette version », « Fabriquer en entier », « 2e ouverture » partent confirmés d'office : chaque feuille affiche maintenant « Votre avatar parle dans ces vidéos (cette vidéo) : environ … €, à confirmer. » (part calculée par `partDoubleReel` sur les lignes estimées, aussi quand des formats sont cochés). Les lancements en attente viennent de ces feuilles | `r7e-avatar-parle` (le plan donne la part ; rien si éteint) ; `r7e-correctifs` (la phrase est sur les feuilles) |
| 4 | Fond uni : le décor devient la même couleur unie (`FOND_UNI_AVATAR`), sans image ; plus de rectangle gris en 4:5 et 1:1 | `r7e-avatar-parle` « fond uni en 4:5 et 1:1 » |
| 5 | Un avatar relié devient le visage par défaut SEULEMENT si le défaut actuel manque ou n'est pas un avatar HeyGen prêt ; sinon le défaut est gardé et le journal le dit | `r7e-avatar-parle` « visage par défaut du personnage » |
| 6 | Recherche de reprise : `GET /v3/videos` suit les pages (`has_more`, `next_token`, 100 par page, 10 pages au plus) jusqu'aux vidéos plus anciennes que la décision d'envoi (`decideLe`, gardée sur la pièce, marge 10 min). Le filtre `title` reste à vérifier au premier essai réel ; il n'est plus indispensable | `r7e-correctifs` « le rendu n'est pas dans les 20 derniers » (+ arrêt à la date de la décision) |

Non traités ici (hors demande) : n° 7 (signature des fichiers téléchargés, rappel R7) et n° 8 (deux retouches de texte).

Contrôles (après corrections) : `npx tsc --noEmit` propre (racine et studio-rendu) ; `npx eslint .` propre ;
`npx vitest run` complet vert — 150 fichiers réussis, 1 sauté (151) ; 2037 tests réussis, 2 sautés ;
`npx next build --webpack` réussi. Aucun appel réseau réel, aucune clé, aucune dépense.
