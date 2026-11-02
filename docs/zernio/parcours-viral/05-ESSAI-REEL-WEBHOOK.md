# 05 · Webhook Zernio : format documenté et essai réel (préalable à l'allumage)

Statut : **format du crochet aligné sur la documentation publique** (docs.zernio.com/webhooks et /webhooks/automations, COR-PV2-T2) ;
**relecture d'un run non branchée** (aucun point d'accès documenté). `PARCOURS_MOT_ENABLED` reste **éteint** (absent par défaut) tant que
les captures ci-dessous ne sont pas consignées.

## Format implémenté (`src/domaine/guide-reseau/crochet-zernio.ts`, `src/services/parcours-mot.ts`, route `src/app/api/crochets/zernio/route.ts`)
| Point | Valeur |
| --- | --- |
| En-têtes | `X-Zernio-Signature`, `X-Zernio-Event`, `X-Zernio-Event-Id` ; alias hérités `X-Late-Signature`, `X-Late-Event-Id` acceptés. **Aucun en-tête d'horodatage.** |
| Signature | HMAC-SHA256 en hexadécimal minuscule du **corps brut seul** (pas `horodatage.corps`), comparaison à temps constant, vérifiée **avant** `JSON.parse`, octets bruts plafonnés (16 Ko). |
| Charge (racine) | `{ id, event, timestamp, ... }` |
| `workflow.run.completed` | `workflow:{id,name}`, `execution:{id,status: completed\|exited}`, `conversation`, `contact:{id}`, `trigger:{type,text}`. **L'identifiant du run est `execution.id`.** Seul événement qui dépose dans l'outbox. |
| `workflow.run.failed` | champ `error` ; accusé 200, sans effet. |
| `message.sent` | `executionId`, `workflowId`, `sequenceId`, `automationId` ; accusé 200, sans effet. |
| `comment.received` | `account.accountId` ; accusé 200, sans effet. |
| Autres (dont `webhook.test`) | accusé 200, sans effet (si la signature et la fenêtre sont bonnes). |
| Anti-rejeu | fenêtre ±300 s (choix du Studio) sur le champ `timestamp` du **corps** + déduplication par `X-Zernio-Event-Id` (repli : `id` du corps), sous verrou. |

Ordre des contrôles : interrupteur et secret → taille → signature (401) → JSON/enveloppe (422) → fenêtre (401) → type d'événement → doublon.

## Relecture du run : point d'accès
Recherche faite dans `docs/zernio/` et dans `docs/zernio/openapi-extrait-1.418.1.json` (mots : workflow, execution, run) : **aucun point
d'accès de lecture d'un run ou d'une exécution**. Rien n'a été inventé ; `injecterLecteurRuns` reste inerte (aucun lecteur réel).
Le crochet conserve seulement, dans l'outbox : `execution.id` (clé d'idempotence), `contact.id` (opaque) et `trigger.text` (le mot saisi),
transmis au lecteur comme repères. Aucune adresse e-mail n'est lue dans le crochet ni stockée.

### À capturer à l'essai réel (webhook de TEST, secret de test, corps FICTIFS dans le dépôt)
1. Les **en-têtes exacts** reçus et le **corps en octets bruts** (hex/base64) d'un `workflow.run.completed` et du `message.sent` associé
   (même `execution.id` = `executionId`) ; confirmer la signature (corps seul, hex minuscule) et la forme de `timestamp` (texte ISO 8601 ou
   nombre ; le code accepte les deux, secondes ou millisecondes).
2. **Où se trouve l'adresse e-mail** donnée par la personne et **l'accord** (« oui »/« non ») avec sa version de texte (M1, M2) : dans la
   charge du webhook (alors à lire du corps, jamais stocké), dans un champ du contact, ou lisible via une API documentée. À défaut de
   point d'accès de lecture, la demande au site doit être construite à partir de `contact.id`, `trigger.text`, `execution.id` et du
   `message.sent` associé : consigner quels champs contiennent réellement ces valeurs.
3. Si Zernio propose une lecture d'exécution/contact : noter la méthode, le chemin, l'authentification et un exemple FICTIF, puis brancher
   `injecterLecteurRuns` (en lecture seule, runs clos uniquement).
4. Le comportement de `exited` (sortie anticipée du parcours) : l'accord a-t-il bien été recueilli ? Sinon, ne traiter que `completed`.
5. Consigner ici la date, la version de l'API et le résultat. Seulement alors : `PARCOURS_MOT_ENABLED=1` (action de la session déployeuse).

## Pose du secret du webhook chez Zernio : geste réservé à l'opérateur
Le secret est posé chez Zernio par `POST /v1/webhooks/settings`. C'est un **geste à autoriser explicitement par l'opérateur** :
jamais fait par du code du Studio, jamais fait par défaut, jamais à l'allumage automatique. La clé d'API Zernio reste côté serveur.
La même valeur est fournie au Studio par l'environnement (`ZERNIO_WEBHOOK_SECRET`, jamais en base ni dans le dépôt). Rotation : même geste,
puis mise à jour de l'environnement.

## Points de conduite à connaître avant l'allumage
- Le corps de l'appel au site est **reconstruit à chaque passage** à partir du run relu (ordre des clés fixe). Si le run change entre deux
  passages, les octets changent et le site répond 409 `cle_reutilisee` (définitif) : ne relire que des **runs clos**.
- Secret de l'appel sortant : `SITE_GUIDES_RESEAU_SECRET` (= `GUIDES_RESEAU_HMAC_SECRET` côté site, ≥ 32 caractères) ; repli sur
  `SITE_VIDEOS_SECRET` seulement si le site n'a pas non plus sa variable propre.
- Plafonds par passage : 20 événements, 120 par heure glissante ; disjoncteur : 5 pannes consécutives ouvrent le circuit 10 minutes.
  Un 401 du site est définitif pour l'événement et lève une alerte au journal (sans secret).
