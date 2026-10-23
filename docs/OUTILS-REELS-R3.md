# Lot R3 — Notifications sur le téléphone et par e-mail (relevé)

> 03/10/2026 · branche `outils/r3` depuis `03d297b` (production) · plan : `PLAN-OUTILS-REELS-2026-10-03.md`, constat C4.
> Aucun envoi réel pendant le lot (faux transports, fausses clés, aucun réseau). Aucune clé dans les processus de développement.

## 1. Ce qui change pour Will

- Réglages > Notifications : « Téléphone » et « E-mail » ne disent plus « Bientôt ». Ils s'ouvrent dès que le serveur est
  prêt et que la carte « Notifications » est reliée dans Connexions ; sinon ils disent pourquoi, en mots simples
  (« À relier dans Connexions », « Le téléphone n'est pas encore prêt : à faire régler »). Aucun nom de réglage,
  sigle ou nom de service technique à l'écran (ordre de Will) : les noms vont au journal du serveur (une ligne
  `[studio] notifications : réglage serveur à poser : …`, une fois par démarrage) et dans ce relevé.
- Bloc « Ce téléphone » : bouton « Activer sur ce téléphone », état réel de l'appareil, nombre d'appareils prévenus.
- iPhone ouvert dans Safari : l'écran explique simplement les trois gestes (Partager, « Sur l'écran d'accueil »,
  ouvrir depuis l'icône) et rappelle qu'il faut iOS 16.4 ou plus récent.
- Notifications refusées : comment les réautoriser (iPhone, Android).
- « Envoyer un essai » : « Sur le téléphone » ou « Par e-mail ». Un appui = un message.
- L'adresse qui reçoit les e-mails est affichée, pour vérification.

## 2. Règles tenues

| Règle | Comment |
|---|---|
| Écrit et éteint | `notification/inscription.ts` inscrit `web-push-email` seulement si le téléphone (3 variables VAPID) OU l'e-mail (3 variables ZeptoMail) est configuré. Il ne s'active que par Connexions (`fournisseur.notification`) ou `FOURNISSEUR_NOTIFICATION=web-push-email`. |
| Carte en simulation → rien ne part | `diffuserNotifications` lit la carte : simulation → la file est vidée, ni téléphone ni e-mail (plus d'e-mail « simulé » non plus). La cloche reçoit toujours tout. La veille (`veille.ts`) passe par la même carte (`emailActif()`). La clé publique n'est donnée au téléphone que carte reliée. |
| Un essai = un message | `envoyerEssai(canal)` : un seul envoi sur le canal demandé (pas d'e-mail de secours pour un essai téléphone), date réservée SOUS VERROU avant l'envoi (deux appuis simultanés : un seul message, testé avec une base lente), second essai refusé pendant 30 s. L'envoi se fait hors verrou. Refusé en simulation, sans appareil, ou canal non configuré. |
| Rien n'est effacé | Abonnement refusé par le navigateur (404/410), y compris pendant un essai : marqué `expireLe`, gardé, et jamais ranimé si le navigateur le renvoie. « Activer sur ce téléphone » demande alors un abonnement neuf. L'état « Activées » est jugé pour CET appareil : son navigateur donne son adresse d'abonnement, le studio répond oui/non (sous session, aucune autre adresse renvoyée) ; un téléphone expiré revoit « Activer » même si un autre reste actif. |
| Abonnements sûrs | Seuls les services de notification des navigateurs sont acceptés (`fcm.googleapis.com`, `web.push.apple.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`, https sans port) ; 20 appareils actifs au plus (au-delà : refusé, rien d'effacé). Écritures de la liste sous verrou. |
| Aucun secret | La vue de l'écran ne porte que des oui/non, un nombre et l'adresse de Will. Journal du studio (affiché dans Réglages) : phrases simples, nombre d'appareils ; le code HTTP d'un refus ZeptoMail ne va qu'au journal du serveur. Le jeton ZeptoMail ne va que dans l'en-tête `Authorization`, jamais dans le corps. Testé. |
| Liens absolus | E-mail : lien absolu vers `STUDIO_ADRESSE` (défaut `https://studio.axion-ia.com`) ; un lien vers un autre site est remplacé par l'accueil du studio. Service de cache : un clic sur la notification n'ouvre qu'une page du studio. |
| E-mail aligné sur le site | ZeptoMail (API HTTP UE), `reply_to` = `contact@axion-ia.com` (comme le site), expéditeur `noreply@` ou mal formé refusé (DMARC `p=reject` : mieux vaut « non relié » qu'un e-mail rejeté en silence), suivi des clics et ouvertures coupé (liens intacts). Gabarit terracotta. |
| Choix du canal | `definirNotifications` refuse de PASSER à « Téléphone » / « E-mail » s'il ne peut pas partir ; un canal déjà choisi reste modifiable. |

## 3. Fichiers

- `src/fournisseurs/notification/inscription.ts` (nouveau) : `notificationsReelles()`, `canauxDe()`, `variablesManquantes()`, id `web-push-email`.
- `src/fournisseurs/index.ts` : la ligne `notification: { simulation: …, ...notificationsReelles() }` (+ son import).
- `src/fournisseurs/notification/email.ts` : liens absolus, `reply_to`, adresses validées, statut HTTP rendu, gabarit.
- `src/services/notifications.ts` : `canauxActifs()`, `emailActif()`, carte respectée, `vueNotifications()`, `envoyerEssai()`, 20 appareils au plus ; `clePubliquePush()` devient asynchrone.
- `src/domaine/notifications-textes.ts` (nouveau, pur) : les phrases simples partagées par l'écran et le service.
- `src/fournisseurs/notification/push.ts` : `abonnementValide` n'accepte que les services connus.
- `src/services/reglages.ts` : `notificationsServeur` dans `lireReglages()`, contrôle du canal.
- `src/services/veille.ts` : e-mails de veille par la carte.
- `src/app/(studio)/reglages/actions.ts` : `envoyerEssaiNotificationAction` (ajoutée en fin de fichier).
- `src/app/(studio)/reglages/page.tsx` : une ligne (`serveur={reglages.notificationsServeur}`).
- `src/app/api/notifications/abonnement/route.ts` : `await clePubliquePush()`.
- `src/components/coquille/EnregistrementPwa.tsx` : `etatTelephone()` (pur), états `ecran-accueil`, `navigateur`, `serveur`, premier affichage « verification ».
- `src/components/reglages/NotificationsTelephone.tsx` (nouveau) : `VueCeTelephone`, `CeTelephone`, `BoutonsEssai`.
- `src/components/reglages/Preferences.tsx` : `ReglagesNotifications({ initiales, serveur })`.
- `public/sw.js` : clic limité aux pages du studio.
- `deploiement/docker-compose.yml`, `deploiement/env.exemple` : `FOURNISSEUR_NOTIFICATION` transmis et documenté.
- Tests : `tests/r3-notifications.test.ts` (31, dont 9 de la relecture) ; `tests/m1b.test.ts` et `tests/d2-credits.test.ts` reçoivent une FAUSSE configuration e-mail (sans configuration, plus rien ne part : c'est voulu).

## 4. Preuves

- ROUGES prouvés sur les sources de `03d297b` (test du lot inchangé) :
  - « carte en simulation → aucun envoi » : `expected "vi.fn()" to not be called at all, but actually been called 2 times` ;
  - « options actives quand configurées » : `expected '<div class="space-y-1">…' not to contain 'Bientôt'`.
  Puis verts avec le lot.
- Relecture (03/10), rouges prouvés avant correction : aucun nom technique à l'écran (3 tests), deux essais
  simultanés = deux messages (`expected 1 times, but got 2 times`), « Activées » malgré 0 appareil actif, abonnement
  expiré ranimé, adresse quelconque acceptée, 21e appareil accepté, téléphone B expiré resté « Activées » parce que
  A était actif. Tous verts ensuite.
- GARDE-FOU (vert dès le départ sur la branche, pas un rouge) : « veille, carte en simulation, clés posées : ZeptoMail
  jamais appelé ». Il ne rougit que sur `veille.ts` de 03d297b (`called 1 times`), corrigé dès le premier commit du lot.
- `npx tsc --noEmit -p .` = 0 (après `npx next typegen`, qui ne fait que générer les types de routes dans `.next/`, ignoré par git).
- eslint des fichiers touchés = 0.
- `npx vitest run --maxWorkers=2` complet : voir le rapport du lot.
- Écrans vérifiés par rendu (`renderToStaticMarkup`) : options ouvertes / fermées avec raison, « 1 appareil prévenu », « Envoyer un essai », guide iPhone, bouton « Activer sur ce téléphone ». Pas de `next dev` / `next build` (disque).

## 5. Mise en service (opérateur, sur le serveur)

Clés VAPID, générées UNE fois sur le poste de Will (le paquet `web-push` 3.6.7 est déjà dans `node_modules`, rien à installer) :

```
cd <dossier utilisateur>\Documents\Projets\studio-axion-ia
npx web-push generate-vapid-keys --json
```

`publicKey` → `VAPID_PUBLIQUE`, `privateKey` → `VAPID_PRIVEE`. Ne jamais les régénérer ensuite : de nouvelles clés
désabonnent tous les téléphones (il faudrait refaire « Activer sur ce téléphone » partout).

Variables du `.env` du serveur (puis `deploiement/mettre-a-jour.sh`, un seul conteneur studio) :

```
FOURNISSEUR_NOTIFICATION=web-push-email
VAPID_PUBLIQUE=<publicKey>
VAPID_PRIVEE=<privateKey>
VAPID_SUJET=mailto:contact@axion-ia.com
EMAIL_SECOURS_CLE=<jeton « Send Mail » de l'agent ZeptoMail « Studio »>
EMAIL_SECOURS_EXPEDITEUR=studio@axion-ia.com
EMAIL_SECOURS_DESTINATAIRE=<adresse qui reçoit les alertes>
```

Facultatives (défauts du code) : `STUDIO_ADRESSE` (https://studio.axion-ia.com), `EMAIL_SECOURS_ADRESSE`
(https://api.zeptomail.eu/v1.1/email). `FOURNISSEUR_NOTIFICATION` peut rester vide si Will choisit le service dans
Réglages > Connexions (le réglage de l'écran l'emporte).

## 6. Ce que Will fait sur son téléphone

1. iPhone : ouvrir studio.axion-ia.com dans Safari, Partager, « Sur l'écran d'accueil », « Ajouter ». (Android : menu ⋮, « Ajouter à l'écran d'accueil » — facultatif sur Android.)
2. Ouvrir le studio depuis l'icône, Réglages > Notifications, « Activer sur ce téléphone », puis « Autoriser ».
3. « Envoyer un essai » > « Sur le téléphone » : la notification arrive en quelques secondes. Puis « Par e-mail ».
4. Choisir « Par où » : Téléphone (l'e-mail part en secours si aucun téléphone ne reçoit) ou E-mail.

## 7. Points d'intégration

- R0 (`Connexions.tsx`, `catalogue.ts`) : l'implémentation inscrite du type `notification` a l'id exact
  `web-push-email`, nom « Notifications (téléphone, e-mail) ». Variables (NOMS) : `VAPID_PUBLIQUE`, `VAPID_PRIVEE`,
  `VAPID_SUJET` (téléphone) ; `EMAIL_SECOURS_CLE`, `EMAIL_SECOURS_EXPEDITEUR`, `EMAIL_SECOURS_DESTINATAIRE` (e-mail) ;
  une seule des deux familles suffit à l'inscrire ; coût « gratuit » (Web Push) / « inclus ZeptoMail ». Les listes
  sont exportées : `VARIABLES_TELEPHONE`, `VARIABLES_EMAIL` (`notification/inscription.ts`).
- `fournisseurs/index.ts` : une ligne d'implémentation + une ligne d'import (après `aligneurReel`) ; conflit trivial possible avec R1.
- `reglages/actions.ts` : action ajoutée en fin de fichier + un import ; `reglages/page.tsx` : une ligne.
- `diffuserNotifications(dependances)` : passer `push` ou `email` (même `null`) remplace la carte — réservé aux tests.
  R1 (échec Buffer → notification) n'a rien à faire : `creerNotification` suffit, la carte décide.
- `clePubliquePush()` est désormais asynchrone (seul appelant : la route d'abonnement).
