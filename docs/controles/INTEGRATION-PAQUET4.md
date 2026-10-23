# Intégration du paquet 4 — branche `outils/paquet4`

- **Date** : 03/10/2026.
- **Base** : `origin/master` @ `d186500` (la version en ligne). `master` n'est pas touché.
- **Branches fusionnées** (`git merge --no-ff`, dans cet ordre) :
  1. `outils/ecran-propre` ;
  2. `outils/production` ;
  3. `outils/garde-argent` ;
  4. `outils/scripts-reels` ;
  5. `outils/avatar-par-format` ;
  6. `outils/serie-depots` ;
  7. `outils/tiktok`.
- **Lus avant de fusionner** :
  - les 7 rapports des équipes (`docs/controles/`) ;
  - les audits A, B et D (branches `controles/audit-*`).
- **Après chaque fusion** :
  - `pnpm install --frozen-lockfile` ;
  - `npx next typegen` ;
  - `npx tsc --noEmit` ;
  - les tests ciblés des deux côtés, toujours avec la garde écran.

  Tout était vert avant de passer à la fusion suivante.

---

## 1. Conflits et choix

Les cinq premières branches se sont fusionnées sans conflit textuel. Les fichiers partagés ont été relus : `fabrication.ts`, `travaux.ts`, `boucle.ts`, `generation-claude.ts`, `types.ts` et `montage-avocat/index.ts`.

Les deux dernières branches ont eu des conflits. Chacun a été résolu à la main, en gardant les deux intentions :

| Fusion | Fichier | Côté déjà intégré | Côté entrant | Résolution |
|---|---|---|---|---|
| serie-depots | `app/(studio)/ecrire/atelier/page.tsx` | retour à la vidéo (`retourValide`, scripts) et prix calculé | prix calculé (même idée), sans retour | version avec retour gardée ; les imports en double sont retirés |
| serie-depots | `app/(studio)/nouvelle/[format]/actions.ts` | `noterScriptEssai` (scripts : note refusée avec Claude) et `deposerFichierSimule` | `fichierEnvoye` (vrais dépôts) et ancien nom `noterScript` | `fichierEnvoye` (le dépôt simulé n'est plus utilisé) **et** `noterScriptEssai` |
| serie-depots | `app/(studio)/personnages/actions.ts` | actions « Visage par défaut » et « avatar par format » (équipe avatar) | document d'accord en `FichierEnvoye` | les deux actions sont gardées ; l'accord passe en `FichierEnvoye` |
| serie-depots | `services/C-videos-publication-complements.ts` | `phraseChoixService` (journal lisible) et `cleMois` | budget au mois de Paris (`moisParis`), `cleMois` retiré | `phraseChoixService` gardé ; `cleMois` n'est plus utilisé, donc retiré |
| serie-depots | `components/generateur/EcranSujet.tsx` | `lienSujet(…, retour)`, signature `prix` + `retour` | réglages extraits dans `ReglagesSujet`, mode « Plusieurs » et `FeuilleSerie` | réglages partagés, mode « Plusieurs », retour vers la vidéo sur les liens et la signature, double bouton (série ou « Écrire · au plus … ») |
| tiktok | `ecrire/atelier/page.tsx` | retour et prix | séries proposées (`listerSeries`) | les trois propriétés sont passées |
| tiktok | `ecrire/page.tsx` | `formatsEcrivables` (série d'idées) | bandeau « Séries » | les deux sont gardés |
| tiktok | `EcranSujet.tsx` | réglages partagés, « Je choisis » masqué en mode « Plusieurs » | `ChoixSerie` (série du sujet) | `ChoixSerie` est affiché dans les deux modes, et la série suit aussi l'écriture en série (jonction 2) |

**Lockfile** : `mammoth` et `unpdf` (scripts-reels) sont dans `package.json` et dans `pnpm-lock.yaml`. Après chaque fusion, `pnpm install --frozen-lockfile` passe.

---

## 2. Jonctions entre équipes : corrigées et testées

### 2.1 Garde argent (B6, total confirmé) × écriture en série — **corrigée**

- **Défaut :**
  - « Écrire ces N idées » ne demandait aucune confirmation, alors qu'une série peut aller jusqu'à 20 × 1,35 € = 27 €, au-delà du seuil de 20 €.
  - La garde B6 ne couvrait donc pas ce nouveau chemin payant.
- **Correction (`services/serie-ecriture.ts`) :**
  - `lancerSerie(…, totalConfirme)` exige, au-delà de `budget.seuilConfirmation`, un total confirmé au moins égal au prix maximum du jour de ce qui partirait.
  - Sinon, l'erreur est `CONFIRMATION_REQUISE` et rien n'est créé.
  - Il n'y a jamais de confirmation d'office. En essai, rien n'est payé, donc rien n'est demandé.
- **Côté écran :**
  - `FeuilleSerie` envoie le total qu'elle affiche (`plan.totalPartant`).
  - Si le prix a changé entre-temps, la feuille se recalcule et Will reconfirme d'un toucher.
- **Côté action :** `lancerSerieAction(…, totalConfirme)`.

### 2.2 Séries TikTok × écriture en série — **corrigée**

- **Défaut :** la série choisie dans l'atelier (`ChoixSerie`) n'était transmise qu'au sujet seul. En mode « Plusieurs », elle était perdue.
- **Correction :**
  - `ReglagesSerie.serieId` est passé à chaque `lancerGeneration`.
  - Les épisodes sont numérotés dans l'ordre des idées.

### 2.3 Garde « maillon d'essai » (B11) × garde « voix d'essai » de l'avatar (B4) — **corrigée**

- **Défaut :**
  - Prenons un montage réel en production, avec la voix HeyGen reliée dans Réglages > Connexions, mais une voix d'essai sur le personnage.
  - Au lancement, B4 répondait la bonne chose : « Reliez d'abord votre voix HeyGen dans Personnages. »
  - Mais sur les chemins couverts par B11 seul (format ajouté, retouche d'une vidéo d'exemple), B11 disait « la voix est encore en essai… Reliez cet outil dans Réglages > Connexions ».
  - Will recevait donc deux consignes contraires, et Connexions affichait pourtant la voix « Reliée ».
- **Correction (`services/fabrication.ts`, `refusSimulationEnProduction`) :**
  - Une ligne de voix simulée alors que la voix est reliée vient de la voix du personnage. B11 dit alors la même phrase que B4.
  - Si la voix n'est vraiment pas reliée, B11 renvoie toujours vers Réglages > Connexions.
- **Déplacement de la phrase :**
  - La phrase partagée est maintenant dans `src/domaine/voix-essai.ts`, un module neutre.
  - La règle existante « la fabrication ne lit pas le moteur avocat » (`e2e1-moteur-10`) reste vraie.
  - Le moteur avocat réexporte `MESSAGE_VOIX_ESSAI` : rien n'est cassé pour lui.
- **Ordre des gardes au lancement, inchangé :**
  1. double ;
  2. voix d'essai (B4) ;
  3. maillon d'essai (B11) ;
  4. confirmation ;
  5. réservation.

  Aucune garde ne réserve quoi que ce soit avant de refuser.

### 2.4 Garde écran (équipe 1) × textes des équipes 3 à 7 — **garde étendue**

- **Défaut de couverture :**
  - Les phrases rangées dans une constante n'étaient pas lues par la garde : la garde ne voyait que l'identifiant passé au message.
  - C'est le cas de `PHOTOS_EN_PREPARATION` (décors, équipe 3), `RETOUCHE_PAS_DISPONIBLE` (équipe 3), `MESSAGE_ILLISIBLE` (import, équipe 4) ou `RAPPEL_VOTRE_MARQUE` (équipe 7).
- **Extension (`tests/garde-ecran.test.ts`) :** une constante texte passée à un message est maintenant contrôlée là où elle part. Cela vaut pour :
  - une constante du même fichier ;
  - un `export const` d'un module `@/…` importé.
- **Seul nouveau constat :** le message d'`ErreurClaude` contient la réponse brute de l'API.
  - C'est un faux constat : ce message n'est lu que par `traiterEchec`, qui l'envoie en `console.warn` et montre une phrase fixe à Will.
  - Il est ajouté aux `EXCEPTIONS`, avec sa raison. Il y a maintenant 3 exceptions.
- **Test de jonction :**
  - Pour 11 textes réels des équipes 2 à 7, plus le nouveau texte de confirmation, une faute (« Simulation HTTP 503 ») est injectée dans le vrai fichier. La garde doit la voir.
  - Rouge prouvé : sans le suivi des constantes, la garde ne voit pas les fautes des décors et de la retouche.
- **Limite restante :** un texte renvoyé par une fonction puis mis dans une variable n'est pas suivi. Par exemple, `refusSimulationEnProduction` renvoie une phrase, mise dans `refusEssai`, puis passée à `ErreurStudio`. Ces phrases ont été relues à la main.

### 2.5 Notifications persistées (équipe 2) × rappel « Votre marque » (équipe 7) — **vérifiée, aucun correctif**

Le rappel passe par `creerNotification`. Il est donc :
- écrit en base, à l'état « à envoyer » ;
- réessayé avec une attente croissante ;
- jamais renvoyé une fois parti.

Chaque envoi (e-mail ou téléphone) porte « Dans TikTok : Divulgation du contenu → Votre marque ». Un test d'intégration le garde.

### 2.6 « Vos hashtags » (équipe 7) × écriture en série (équipe 6) — **vérifiée, aucun correctif**

La série passe par `lancerGeneration`, puis par la boucle d'écriture, qui lit `lireFamilles()`. Les versions TikTok écrites en série ne portent donc que des mots-dièse de la famille (3 à 5), jamais #fyp. Un test d'intégration le garde.

### Tests d'intégration ajoutés

| Fichier | Tests | Rouge sans les corrections |
|---|---|---|
| `tests/paquet4-jonctions.test.ts` | 9 : série × B6 (4), série × séries (2), série × hashtags (1), « Votre marque » × notifications (1), etc. | 4 rouges (B6 × 3, épisodes × 1) |
| `tests/paquet4-jonction-voix.test.ts` | 4 : B11 × B4 | 1 rouge (consigne contradictoire) |
| `tests/garde-ecran.test.ts` | +2 : constantes suivies, jonction des textes | 2 rouges sans le suivi des constantes |

Les tests verts dès le départ (hashtags, « Votre marque », « sous le seuil », « tout relié ») sont des garde-fous : ils rougissent si la jonction casse plus tard.

---

## 3. Contrôles finaux (sur `outils/paquet4`)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | 0 erreur |
| `npx tsc --noEmit` (`studio-rendu`, après `npm ci --ignore-scripts`) | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (complet) | **203 fichiers passés, 1 ignoré ; 2 600 tests passés, 2 ignorés, 0 échec** |
| `npx next build --webpack` | réussi (code 0) |
| `python -m unittest discover -s tests -t .` (`studio-aligneur`, numpy installé) | **21 tests OK** |
| `bash -n deploiement/*.sh` (4 scripts) | OK |
| `shellcheck -x deploiement/*.sh` (0.11.0, lancé depuis la racine) | 0 avertissement |
| `docker compose --profile calage config -q` | OK, avec un `.env` factice qui remplit les 3 variables obligatoires |
| Clés dans `git diff origin/master..HEAD` | aucune (recherche des motifs `sk-ant-`, `AKIA`, clés privées, `ghp_`, `xox`, `sk_live`, `AIza`, et des longues valeurs de secret) |
| Suppression de données | aucune |

Précisions sur les suppressions :
- **Fichier supprimé :** `src/components/ecrire/Atelier.tsx`. C'est du code mort (B16, scripts-reels), pas une donnée.
- **Effacements prévus et bornés, propres à l'équipe production :**
  - une sauvegarde locale de plus de 14 jours, et seulement si sa copie R2 est confirmée ;
  - les dossiers temporaires `studio-rendu-*` laissés par un processus tué.
- **Jamais :** aucun DELETE dans R2, aucun effacement en base.

**Premier passage de la suite complète :** 1 rouge, `e2e1-moteur-10-briques-neutres`. Ma première correction 2.3 importait le moteur avocat dans `fabrication.ts`. J'ai déplacé la phrase dans `domaine/voix-essai.ts`, et la suite est repassée entièrement verte.

---

## 4. Gestes SERVEUR à la mise en ligne (axionia-web, en root)

Ces gestes sont repris et regroupés depuis les rapports des équipes 2, 3 et 4.

1. **Mettre en ligne**, une fois `outils/paquet4` fusionnée dans `master` :
   ```bash
   bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh
   ```
   - L'image se reconstruit, avec `pnpm install --frozen-lockfile`, qui installe `mammoth` et `unpdf`.
   - Le compose change : la base est recréée une fois, et Postgres redémarre quelques secondes. Les données restent dans le volume.
   - Ce lancement tourne encore avec l'**ancien** script. L'attente de santé et les images `:precedente` ne jouent qu'à la mise à jour suivante.
2. **Vérifier la santé à la main** (3 premières minutes : `demarrage`, c'est normal) :
   ```bash
   cd /opt/studio-axion-ia/source/deploiement && docker compose --env-file /opt/studio-axion-ia/.env exec -T studio node -e "fetch('http://127.0.0.1:3000/api/sante').then(async r=>console.log(r.status, await r.text()))"
   ```
   Réponse attendue : `200 {"ok":true,"base":"ok","boucle":"ok"…}`.
3. **Sauvegardes planifiées** :
   ```bash
   crontab -l | grep -n sauvegarder || true          # ancienne ligne ? la retirer (crontab -e)
   install -m 0644 /opt/studio-axion-ia/source/deploiement/crontab /etc/cron.d/studio-axion-ia
   bash /opt/studio-axion-ia/source/deploiement/sauvegarder.sh
   tail -n 20 /opt/studio-axion-ia/sauvegardes/sauvegardes.log
   ```
   Le premier passage copie toutes les anciennes sauvegardes vers R2 (`studio/sauvegardes/`).
4. **Variables du `.env`**, sans les afficher :
   ```bash
   grep -cE '^(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET)=.+' /opt/studio-axion-ia/.env   # attendu : 4
   grep -cE '^(EMAIL_SECOURS_CLE|EMAIL_SECOURS_EXPEDITEUR|EMAIL_SECOURS_DESTINATAIRE)=.+' /opt/studio-axion-ia/.env   # attendu : 3
   grep -E '^FOURNISSEUR_NOTIFICATION=' /opt/studio-axion-ia/.env   # attendu : web-push-email
   grep -E '^STUDIO_RENDU_URL=.+' /opt/studio-axion-ia/.env >/dev/null && echo "rendu relié"   # sinon B11 refuse tout montage réel payant
   ```
5. **Avant la première fabrication payante** (garde B11 active en production) :
   - ouvrir Réglages > Connexions ;
   - vérifier que montage, stockage, voix et double sont « Reliés ».
   - Un maillon encore en essai fait refuser la fabrication, avec une phrase claire. Rien n'est payé.
6. **Cloudflare R2**, dans le tableau de bord. Ce n'est pas faisable depuis le code :
   - la clé R2 doit pouvoir écrire sous `studio/sauvegardes/` ;
   - si une règle de cycle de vie existe, elle ne doit **pas** expirer ce préfixe ;
   - activer « abandon des envois multipart incomplets ».
7. **En cas de mise à jour ratée** :
   ```bash
   bash /opt/studio-axion-ia/source/deploiement/revenir.sh
   ```
8. **Une fois par mois** : faire l'essai de restauration, dans une base à part (`deploiement/README.md`).

**À savoir :** `FAL_PLAFOND_USD` devient un plafond **par mois**, calculé à partir de la base (équipe 3). Il n'était avant qu'un plafond par processus.

---

## 5. Ce qui reste à Will

1. **Personnages › Williams › Voix › « Relier ma voix HeyGen ».**
   - Sans cela, les deux gardes refusent le montage réel avec la même phrase : « Reliez d'abord votre voix HeyGen dans Personnages. »
2. **Recette à la main sur le studio en ligne :**
   - un avatar par format (Personnages › Visages › « Par format ») ;
   - une vidéo Avocat avec modèle, puis en mode rapide.
3. **TikTok :**
   - pour chaque brouillon « Votre marque », dans l'application TikTok : Divulgation du contenu → Votre marque ;
   - ajuster « Vos hashtags » si besoin ;
   - créer ses séries.
4. **Décisions en attente :**
   - **Prix d'une retouche** (scripts-reels) : l'écran affiche le plafond réel (≈ 0,65 €). Pour annoncer moins, il faut d'abord baisser le plafond dans `boucle-generation.ts`.
   - **C10 quater** (TikTok) : faut-il rendre bloquant « un terme d'IA dit avant 5 s » ? C'est une ligne dans `niveaux.ts`, mais il faudra alors que le texte témoin dise « IA ».
   - **Dépenses « exemple »** (serie-depots, 4.5) : une dépense n'est retirée du budget que si aucun travail ne lui est lié. La règle est à valider.
   - **Résumé de la veille par Claude** (B7, option 2) : il n'est pas écrit. L'écran dit aujourd'hui « fait par le studio ».
5. **Écriture en série au-delà du seuil :** la feuille « Écrire ces N idées » vaut confirmation du total affiché. Si le prix change entre l'ouverture et le toucher, la feuille se recalcule et demande un nouveau toucher.
6. **Suites conseillées, non faites :**
   - une sonde externe sur `https://studio.axion-ia.com/api/sante` (UptimeRobot ou Healthchecks.io) ;
   - la liste des fournisseurs encore en essai dans `/api/sante`.

---

## 6. Corrections après relecture (04/10/2026)

- **Relectures traitées :**
  - `RELECTURE-PAQUET4-EXACTITUDE.md` (verdict REFUS) ;
  - `RELECTURE-PAQUET4-SECURITE.md` (verdict VETO).
- **Base :** `outils/paquet4` @ `81d1bba`.
- **Règles tenues :** aucun appel réseau réel, aucune clé (faux `fetch` qui interdit tout, valeurs factices), aucune donnée effacée.

### 6.1 Vrais défauts

| Défaut | Correction |
|---|---|
| **Exactitude D1** — la boucle d'écriture Claude tournait aussi sur l'instance sans le verrou | `_boucle-etat` garde « ce processus tient le verrou » (`verrouTenu`). `assurerBoucleGeneration()` ne fait rien sans lui : ni le lancement d'une écriture, ni l'ouverture d'une fiche sujet ne la démarrent ailleurs. La minuterie se coupe d'elle-même si le verrou tombe entre deux tours. `perdu()` appelle `surPerte` (arrêt de la boucle d'écriture et de la veille, branché dans `instrumentation.ts`) et remet `autresLances` à faux : à la reprise du verrou, `avecLeVerrou` relance tout. Couvre aussi **sécurité P3**. |
| **Exactitude D2** — confirmation au-delà du seuil sans voir le prix | Chaque `CONFIRMATION_REQUISE` du seuil porte le montant : dans la phrase (« coûte au plus 3,51 € ») et dans le résultat de l'action (`montant`, en centimes). L'écran renvoie le montant confirmé (`AccordPrix` : un nombre). Le serveur refuse si le prix du jour est plus haut (« Le prix a changé : … »). Les 12 `window.confirm` sont remplacés par la feuille **« Confirmer ce prix »** du studio (`ConfirmationPrix.tsx` : gros montant, une ligne, « Confirmer 3,51 € » / « Annuler »). Les feuilles qui affichaient déjà leur prix (Aperçu, Express, modification, « Refaire la phrase ») renvoient désormais ce montant, et affichent le prix du serveur s'il est plus haut. |
| **Exactitude D3** — série lancée en essai, puis Claude relié | Le mode est figé au lancement : `GenerationScript.essai`. `executerRoleFacture` ne passe jamais en réel une écriture lancée en essai. Elle finit en essai, marquée `simulee`, avec une pastille « Essai » sur l'écran d'attente. Pour les écritures d'avant ce champ, une écriture déjà simulée reste en essai. Relancer en réel crée une **nouvelle** écriture, au prix affiché ; une écriture d'essai n'en est jamais le doublon. Le plan de série ne compte plus les écritures d'essai dans « ce qui reste à payer ». |
| **Sécurité D1 (VETO)** — bombe .docx / .pdf | Voir le détail ci-dessous. |

**Détail de la correction sécurité D1** (`src/services/import-texte.ts`) :
1. **Signature du contenu** contrôlée avant toute bibliothèque : « PK » pour un .docx, « %PDF- » pour un .pdf. Couvre **P2**.
2. **Fil séparé** (`worker_threads`) :
   - `resourceLimits` : 256 Mo de tas ;
   - délai de 15 s, puis `terminate()` ;
   - un seul fichier lu à la fois (3 en attente au plus) ;
   - mammoth, jszip et unpdf sont chargés **dans** le fil.
   - Si `NODE_OPTIONS` fixe `--max-old-space-size`, ce réglage global l'emporterait sur `resourceLimits`. Il est donc ramené à 256 Mo le temps de créer le fil, puis rétabli.
3. **.docx, avant mammoth :**
   - au plus 500 entrées dans le zip, et 20 Mo annoncés une fois ouvert ;
   - puis **chaque entrée est décompressée en flux, octets comptés**, avec arrêt au-delà de 20 Mo. Le répertoire central peut mentir.
4. **.pdf, avant pdf.js :**
   - les flux `FlateDecode` (hors images) sont décompressés avec une sortie bornée : `maxOutputLength`, 50 Mo au total ;
   - un PDF chiffré n'est pas lu (phrase « illisible »).
5. **Texte borné à 200 000 caractères**, avec un refus clair : « Ce texte est trop long pour un script (200 000 caractères au plus). » La même borne vaut pour :
   - les .txt et .md, dans le navigateur et sur le serveur ;
   - le texte collé ;
   - le découpage sur le serveur (`decouperTexteColle`).
6. **Refus d'une bombe :** « Ce fichier est trop lourd une fois ouvert. Ouvrez-le, copiez le texte et collez-le. » (phrase remplacée au § 7.1)

**Réserve, à connaître :** Node arrête encore tout le processus si une allocation **unique** du fil dépasse de très loin sa borne (limite connue de `worker_threads`). Les bornes de décompression (20 Mo / 50 Mo), posées **avant** la bibliothèque, empêchent ce cas en pratique : les bombes des relectures et un document d'un million de paragraphes sont refusés proprement, sans arrêt. Pour une isolation totale, il faudrait passer par un processus enfant (piste d'un prochain paquet).

### 6.2 Petits défauts

| Défaut | Correction |
|---|---|
| Exactitude 1 — fal.ai : 3 soumissions sur la place d'une | Contrôle du plafond **et** réservation du prix d'un seul tenant, avant l'envoi (`reservees`, file `sousControle`). La place est rendue au retour (réussi : elle passe en dépense ; refusé net : libérée). |
| Exactitude 2 — décors : lot écrit après les soumissions | Le lot est écrit en base **avant** les soumissions (toutes « à soumettre »), puis après chacune (écritures en file). La réservation n'est libérée qu'une fois la dépense écrite. À la reprise, un lot coupé par un arrêt est soldé (`solderLotInterrompu`) : une demande restée « à soumettre » compte comme payée, jamais refaite ; la dépense manquante est écrite ; la réservation est soldée. Un lot en cours de soumission dans ce processus n'est jamais touché par une reprise. |
| Exactitude 3 — `CONFIRMATION_REQUISE` dans `executerRoleFacture` | L'écriture **attend** (motif « seuil ») au lieu de finir en « panne ». La fiche dit : « Une étape de cette écriture coûte plus que votre seuil de confirmation. Relevez-le dans Réglages : l'écriture reprendra toute seule. » Elle reprend dès que le seuil couvre l'étape. |
| Exactitude 4 — voix « en vol » | La marque ne tombe qu'**après** l'écriture de l'avancement (ou sur un appel en échec). Un arrêt entre le retour de HeyGen et l'écriture la laisse en place : la voix est comptée en dépense probable au redémarrage. |
| Exactitude 5 — taille du plan de série | L'écran envoie la taille du plan vu (`plan.partiront`) avec son total. Un total venu d'un plan d'une autre taille est refusé (`CONFIRMATION_REQUISE`, nouveau prix). |
| Sécurité P1 — 6 Mo pour toutes les actions | L'import passe par **`/api/import`**, qui exige la session **avant** de lire le corps, lit en flux et coupe au-delà de 5 Mo (413). `bodySizeLimit` est retiré : les actions reviennent à 1 Mo. `importerFichierAction` est retirée. |
| Sécurité P2 — type déduit de l'extension | Signature du contenu contrôlée (voir D1). |
| Sécurité P3 — verrou perdu, boucles qui continuent | Voir exactitude D1. `arreterVeille()` est ajouté. |
| Sécurité P4 — copie R2 vers un domaine personnalisé | La copie vise toujours `{compte}.r2.cloudflarestorage.com`. Un `R2_PUBLIC_HOST` n'est gardé que s'il est lui-même un point d'accès S3 de Cloudflare (seau européen). |
| Sécurité P6 — retour arrière perdu en relançant la mise à jour | Après un contrôle de santé réussi, les images sont taguées `:bonne` (`mettre-a-jour.sh` et `revenir.sh`). La mise à jour suivante copie `:bonne` (et non `:local`) vers `:precedente`. Rien n'est effacé. |
| Sécurité P5 — sauvegardes en clair, même clé R2 | **Non corrigé dans le code** : il faut une clé R2 dédiée (écriture seule sur `studio/sauvegardes/`) ou une règle de rétention, plus une clé publique de chiffrement. Ce sont des gestes de compte Cloudflare (voir § 6.5). |
| Sécurité P7 — un fichier envoyé rattachable deux fois | Laissé tel quel (facultatif selon la relecture : simple doublon, ni écrasement ni fuite). |

### 6.3 Tests d'attaque rejoués, ajoutés au dépôt

Chaque test a été lancé sur `81d1bba` (copie de travail à part, mêmes fichiers de test), puis sur la branche corrigée.

| Fichier | Tests | Sur 81d1bba | Après correction |
|---|---|---|---|
| `tests/paquet4-relecture-exactitude.test.ts` | A1 (×2), A2 (×2), A3 (×3), A4 (×2), petit défaut 3, petit défaut 5 | **10 rouges sur 11**. Exemples : minuterie posée sans le verrou ; 6 appels vers Claude après la bascule ; message sans « €» ; 3 POST au lieu d'1 ; écriture laissée « en-cours » au lieu d'attendre ; plan de taille différente accepté. Le 11e (« un refus net rend sa place ») est un garde-fou. | 11 verts |
| `tests/paquet4-relecture-decors.test.ts` | lot en base pendant les soumissions ; reprise après un arrêt | 2 rouges (aucun lot en base) | 2 verts |
| `tests/paquet4-relecture-voix.test.ts` | marque présente au moment d'écrire l'avancement | 1 rouge (marque déjà retirée) | 1 vert |
| `tests/paquet4-relecture-securite.test.ts` | bombe .docx de 100 Mo (≈ 100 Ko envoyés) ; .docx au répertoire central menteur ; bombe .pdf (flux Flate de 80 Mo) ; délai ; mémoire du fil ; texte > 200 000 caractères (.docx, .txt, .md, collé, découpage) ; P1 (401 sans lire le corps, 413, 1 Mo) ; P2 ; P3 ; P4 ; P6 | **14 rouges sur 14**. Les bombes étaient lues en entier (bombe .pdf : 29 s, texte rendu) ; texte trop long accepté ; route absente, etc. | 14 verts : bombes refusées en quelques secondes, moins de 300 Mo de plus pour le processus |

Tests existants ajustés (le comportement voulu change, rien n'est affaibli) :
- `c3-import-fichier` : le bouton passe par `/api/import` ;
- `paquet4-jonctions` : la taille du plan part avec le total ;
- `e2e1-secu-variables` : `NODE_OPTIONS`, variable de Node, est ajoutée aux variables système lues.

### 6.4 Contrôles (après corrections)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | 0 erreur |
| `npx tsc --noEmit` (`studio-rendu`) | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (complet) | **207 fichiers passés, 1 ignoré ; 2 628 tests passés, 2 ignorés, 0 échec** |
| `npx next build --webpack` | réussi (code 0). mammoth, unpdf et jszip sont présents dans `.next/standalone`, et le fil les charge depuis ce dossier (vérifié). |
| `python3 -m unittest discover -s tests -t .` (`studio-aligneur`) | 21 tests OK |
| `bash -n` et `shellcheck -x deploiement/*.sh` (0.11.0) | 0 avertissement |

### 6.5 Ce qui reste à Will

1. **Sauvegardes (P5)**, dans Cloudflare :
   - une clé R2 réservée aux sauvegardes, en écriture seule sur `studio/sauvegardes/`, ou une règle de rétention (verrou de seau) sur ce préfixe ;
   - une clé publique `age` pour chiffrer avant l'envoi.
   
   Le script pourra ensuite s'en servir.
2. **Recette de la feuille « Confirmer ce prix »** : une relance au-delà du seuil, une retouche, un réexport.

## 7. Corrections après 2e relecture (04/10/2026)

- **Relecture traitée :** `RERELECTURE-PAQUET4.md` (branche `relectures/paquet4-bis`) : EXACTITUDE acceptée avec 4 restes (R1 à R4), SÉCURITÉ en **veto** sur la bombe .pdf (§ 2.1 et 2.3).
- **Base :** `outils/paquet4` @ `36a80df`.
- **Règles tenues :** aucun appel réseau réel, aucune clé (faux `fetch`, valeurs factices), aucune donnée effacée.

### 7.1 Veto .pdf levé : lecture dans un processus enfant, mémoire réelle bornée

`src/services/import-texte.ts` :

1. **Processus enfant** (`child_process.spawn` de `node`, `--max-old-space-size=256`), à la place du fil (`worker_threads`) :
   - le code de l'enfant est fixe (`node -e`) ; le fichier passe par son entrée standard, la réponse (JSON) par sa sortie standard. Les avertissements des bibliothèques vont sur sa sortie d'erreur, jamais mêlés à la réponse ;
   - **aucune variable d'environnement** du studio n'est transmise (ni secret, ni `NODE_OPTIONS` qui relèverait le tas) ;
   - **mémoire réelle surveillée** : le pic de RSS de l'enfant (`VmHWM` de `/proc/<pid>/status`, tas V8 **et** tampons hors du tas de pdf.js) est relevé toutes les 50 ms. Au-delà de **250 Mo**, ou de **15 s**, l'enfant est tué (`SIGKILL`) ;
   - refus : « Ce fichier est trop complexe. Ouvrez-le, copiez le texte et collez-le. » (`MESSAGE_FICHIER_TROP_COMPLEXE`, nouvelle phrase) ;
   - un seul fichier lu à la fois, 3 en attente au plus (file déjà en place) ;
   - au pire, le noyau tue l'enfant, jamais le studio. La « réserve » du § 6.1 (allocation unique d'un fil) n'a plus lieu d'être.
2. **Contrôle préalable indépendant du dictionnaire** (`controlerPdf`, exécuté dans l'enfant, donc sous la même surveillance) :
   - noms échappés (`/Fl#61teDecode`) ramenés à leur forme lue par pdf.js ;
   - **tout `/Filter`** doit être un nom direct, ou un tableau de noms directs (4 au plus), parmi `FlateDecode`/`Fl`, `DCTDecode`/`DCT`, `JPXDecode`. Refus : filtre **indirect** (`6 0 R`, y compris dans un tableau), LZW, RunLength, ASCII85, ASCIIHex, CCITT, JBIG2, `null`… ;
   - **chaque flux qui commence par un en-tête zlib** est décompressé, quel que soit son dictionnaire (long, faux `/Subtype /Image`, sans `/Filter`), sortie bornée à **50 Mo au total** ;
   - la décompression va jusqu'à la fin réelle des données zlib : un faux « endstream » placé dans les données ne l'arrête pas (pdf.js, lui, suit `/Length`) ;
   - **Flate dans Flate** : le second étage compte aussi (3 niveaux au plus) ;
   - données zlib invalides : refus (prudent) ; PDF chiffré : illisible.
3. **Build autonome et image Docker :**
   - `npx next build --webpack` : le code de l'enfant est dans `.next/standalone/.next/server/app/api/import/route.js` ; mammoth, jszip et unpdf (avec `dist/pdfjs.mjs`) sont dans `.next/standalone/node_modules`. Le `Dockerfile` copie ce dossier tel quel : rien à y changer ;
   - copie de `.next/standalone` **hors du dépôt** (aucun `node_modules` parent) : un .pdf et un .docx sont lus par l'enfant depuis cette copie. Contre-épreuve : depuis un dossier vide, la lecture échoue ;
   - **étape `run` du `Dockerfile` reproduite à l'identique** (`node:22-bookworm-slim`, utilisateur `studio`, `docker run --memory=1g`) avec ce dossier autonome, et l'enfant lancé avec les arguments exacts du studio (`lancementEnfant`) : voir les mesures ci-dessous. L'image complète n'a pas pu être construite ici : l'étape `deps` télécharge pnpm, et le conteneur de construction ne connaît pas l'autorité de certification du proxy de cet environnement (sans lien avec le code).

**Mesures de mémoire** (RSS ; « studio » = processus qui appelle `extraireTexteFichier`, relevé toutes les 10 ms) :

| Fichier forgé (< 1,1 Mo envoyé) | Une fois ouvert | Sur `36a80df` | Après correction |
|---|---|---|---|
| `/Filter 6 0 R` (filtre indirect) | 1 000 Mo | arrêté au délai, **15,07 s, studio +2 042 Mo** | refusé en **0,09 s**, studio +4 Mo |
| dictionnaire de 3 Ko avant `stream` | 1 000 Mo | arrêté au délai, **15,00 s, studio +2 028 Mo** | refusé en **0,11 s**, studio +0 Mo |
| faux `/Subtype /Image` sur le contenu | 1 000 Mo | arrêté au délai, **15,01 s, studio +2 006 Mo** | refusé en **0,13 s**, studio +0 Mo |
| contrôle préalable **coupé** (essai de la borne seule), Flate direct | 1 000 Mo | — | enfant **tué à 265 Mo** de RSS après 0,82 s, studio +0 Mo |

Dans l'étape `run` de l'image (`--memory=1g`, node 22.23.3, utilisateur `studio`) :

| Fichier | Issue | Durée | Pic de l'enfant | Processus appelant |
|---|---|---|---|---|
| PDF honnête | texte lu | 158 ms | 60 Mo | 45 Mo |
| filtre indirect, 1 000 Mo | refusé (« complexe ») | 71 ms | 46 Mo | 46 Mo |
| Flate direct, 1 000 Mo | refusé par le contrôle préalable | 267 ms | 107 Mo | 47 Mo |
| Flate direct, 1 000 Mo, contrôle coupé | **tué (`SIGKILL`) à 250 Mo** | 1,07 s | 250 Mo | 48 Mo |

Le relevé toutes les 50 ms laisse l'enfant dépasser la borne de ce qu'il alloue en 50 ms (265 Mo au pire mesuré ici) : avec le studio, on reste loin du `mem_limit: 1g` du conteneur.

### 7.2 Restes R1 à R4

| Reste | Correction |
|---|---|
| **R1** — un tour d'écriture déjà en vol continuait après la perte du verrou | `executerRoleFacture` refuse (`arret: "verrou-perdu"`, rien n'est réservé ni payé) quand ce processus a un verrou de boucle et ne le tient pas ; le verrou est relu au début **et** juste avant de réserver et d'appeler. La chaîne s'arrête net, l'écriture reste « en-cours », l'instance qui tient le verrou la reprend. `demarrerBoucleUnique` pose `verrouTenu = false` tant que le verrou n'est pas pris. Une retouche (demandée par Will sur l'instance qui sert sa page, hors boucle) n'est pas concernée. |
| **R2** — `true` couvrait n'importe quel prix | `accordCouvre(accord, centimes, seuil)` : au-delà du seuil de confirmation, **seul un montant** couvre un prix ; `true` reste la réponse des questions sans prix (et des prix sous le seuil). Branché dans la garde commune (`verifierBudgetEtCredits`), le double réel et le montage réel. Les chemins serveur qui ramenaient le montant à un booléen le gardent désormais : « Fabriquer les N » (le montant du total suit la mère et chaque version, `prixConfirme` des déclinaisons) et « Fabriquer cette version » (`fabriquerVariante` → `lancerVideoDeVersion`). |
| **R3** — écriture d'avant le champ `essai`, sans étape | `marquerEcrituresAnciennesEnEssai()` (au début de chaque tour de boucle, donc dès la reprise) : une écriture « en-cours », « en-pause » ou « en attente » sans `essai` et sans étape est marquée `essai: true` si Claude n'est pas branché (migration non destructive : seul ce champ est posé). `executerRoleFacture` fait de même s'il la rencontre en simulation. Les nouvelles écritures portent toujours `essai` (vrai **ou faux**) : débrancher Claude ne change pas une écriture lancée en réel. |
| **R4** — taille du plan absente = « même taille » | `partirontConfirme` est exigé dès qu'il y a une confirmation de série : absent, la confirmation ne vaut pas (`CONFIRMATION_REQUISE`, nouveau prix). L'écran l'envoie déjà. |

### 7.3 Tests ajoutés (rouges sur `36a80df`)

| Fichier | Tests | Sur 36a80df | Après correction |
|---|---|---|---|
| `tests/paquet4-rerelecture-securite.test.ts` | les 3 contournements de l'annexe (1 000 Mo) ; filtres refusés (LZW, RunLength, ASCII85 en tableau, noms échappés, `null`) ; filtre indirect dans un tableau ; flux zlib sans `/Filter` ; faux « endstream » ; Flate dans Flate ; PDF chiffré ; enfant tué au-delà de 250 Mo ; enfant tué au délai ; enfant sans variable d'environnement ; un fichier à la fois | **12 rouges sur 14** (les 3 contournements : 15 s et +2 Go chacun ; filtres lus ; fonctions absentes). Les 2 verts : PDF honnête, trois lectures en file. | 14 verts |
| `tests/paquet4-rerelecture-exactitude.test.ts` | R1 (×2 rouges : 2e rôle payé ; tour réel : 2 appels au lieu d'1), R2 (×2), R3 (×2), R4 ; plus 2 garde-fous (retouche hors boucle, `true` sous le seuil) | **7 rouges sur 9** | 9 verts |

Tests existants ajustés (comportement voulu, rien n'est affaibli) :
- `paquet4-relecture-securite` : `extraireDansUnFil` devient `extraireDansUnProcessus` (mêmes bornes, mêmes attentes) ;
- `paquet4-relecture-exactitude` : une écriture réelle porte `essai: false` (et non plus « absent ») ; après chaque test, le processus revient « sans verrou » (`verrouTenu` absent) ;
- `paquet4-jonctions` : la taille du plan part avec le total ;
- `services`, `c1-argent-b5-reessayer`, `c1-argent-b6-confirmation` : au-delà du seuil, la confirmation est le montant renvoyé par le refus ; `true` est **refusé** (assertion ajoutée) ;
- `e2e1-moteur-02-variante-attend-credit`, `e2e2-argent-fabriquer-n` : l'accord gardé pour « dès que possible » est le montant confirmé.

### 7.4 Contrôles (après corrections, sur `outils/paquet4`)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | 0 erreur |
| `npx tsc --noEmit` (`studio-rendu`, après `npm ci --ignore-scripts`) | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (complet) | **209 fichiers passés, 1 ignoré ; 2 651 tests passés, 2 ignorés, 0 échec** |
| `npx next build --webpack` | réussi (code 0) ; enfant et bibliothèques présents dans `.next/standalone` (voir § 7.1) |
| `shellcheck` 0.11.0 sur les scripts `*.sh` du dépôt | 0 avertissement |

### 7.5 Ce qui reste à Will

Inchangé (§ 6.5) : sauvegardes chiffrées (P5) et recette de la feuille « Confirmer ce prix ». À la mise en ligne, rien de nouveau : l'image se construit comme avant.
