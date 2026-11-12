# ADR-0003 · Zernio Z3 · PUT de promotion, seule modification autorisée chez Zernio

- Statut : acceptée
- Date : 2026-11-01
- Chantier : Zernio, décision D5
- Nature : **point de sécurité**
- Liens : ADR-0002, ADR-0004

## Contexte

Principe de sécurité du chantier : **le Studio ne modifie jamais rien chez Zernio**. Il crée des posts, il lit, il ne réécrit pas.

Ce principe se heurte à un besoin réel : les posts sont d'abord déposés en brouillon (création du Studio, ou import depuis Buffer), puis doivent passer en « programmé » à la date du journal. L'API Zernio ne permet cette promotion que par un `PUT /v1/posts/{id}`. Or ce `PUT` est dangereux :

- un champ `<plateforme>Settings` envoyé **remplace** l'ancien au lieu de le compléter ;
- avec `scheduledFor` seul, le brouillon **reste** brouillon, et la réponse 200 laisse croire le contraire ;
- Zernio ne contrôle pas la date minimale : une date passée publie **tout de suite** ;
- un média téléversé vit 7 jours dans le stockage temporaire de Zernio, au-delà la requête échoue en 400.

**Cette ADR amende le principe** : « le Studio ne modifie jamais rien chez Zernio, **sauf cette forme unique** » — la promotion décrite ci-dessous, et sa forme annexe de remplacement des médias, sous la même garde. Toute autre écriture de modification reste interdite (voir la liste fermée de ADR-0004, D6).

## Décision

D5 · PUT de promotion (seule écriture de modification autorisée chez Zernio) :

1. Corps unique { "isDraft": false, "scheduledFor": "<ISO avec Z>" } — aucun autre champ (un <plateforme>Settings envoyé remplacerait l'ancien) ; avec scheduledFor seul le brouillon reste brouillon (réponse 200 trompeuse).
2. GET avant : status === "draft" ; metadata.origine ∈ { "studio", "import-buffer" } ; metadata.studioCle égale à la clé du journal ; le contenu relu repasse le filtre des mots interdits.
3. Date : celle du journal, à la seconde ; au moins 30 min dans le futur au moment du PUT (Zernio ne contrôle pas la date minimale et une date passée publie tout de suite) ; sinon pas de PUT, le post va dans « À reprogrammer par vous ».
4. Média : téléversé depuis plus de 6 jours (stockage temporaire Zernio 7 jours, sinon 400) → nouveau téléversement, PUT { mediaItems } de remplacement (seconde forme, même garde) puis promotion.
5. GET après : status === "scheduled" et scheduledFor identique, sinon état « À vérifier », alerte, aucun nouvel essai automatique.
6. Pour l'import : promotion seulement après le passage en brouillon du jumeau Buffer, vérifié par une lecture Buffer.
7. Voie requiresApproval évaluée et écartée (Will devrait approuver chaque post dans Zernio).

## Conséquences

- Positives
  - Le principe « aucune modification chez Zernio » reste vrai à deux formes près, exactement nommées, testées et gardées : la surface d'écriture est minimale et auditable.
  - Le client ne peut toucher qu'un post qu'il a lui-même créé ou importé (`metadata.origine`, `metadata.studioCle`) et qui est encore brouillon.
  - Une date trop proche ou passée ne publie jamais par surprise : elle remonte à l'humain.
  - Un échec de vérification ne déclenche aucune boucle : état « À vérifier », alerte, arrêt.
  - À l'import, il n'existe jamais deux posts programmés en même temps chez Buffer et chez Zernio.
- Négatives
  - Deux lectures (avant, après) par promotion : coût en appels et en latence, assumé.
  - Un média de plus de 6 jours impose un nouveau téléversement, donc une seconde écriture (forme `mediaItems`).
  - Les posts tombés dans « À reprogrammer par vous » demandent une action humaine.
- Règle d'évolution
  - Ajouter un champ au corps du `PUT`, ou une troisième forme, exige une nouvelle ADR qui amende celle-ci.

## Alternatives écartées

- **Créer directement en « programmé » sans brouillon** : supprime la relecture avant départ et rend l'import non synchronisable avec la mise en brouillon du jumeau Buffer ; écartée.
- **`PUT` avec le post complet** : remplacerait les `<plateforme>Settings` et pourrait écraser un réglage ; écartée.
- **`PUT` avec `scheduledFor` seul** : le brouillon reste brouillon malgré une réponse 200 ; écartée.
- **Supprimer puis recréer le post** : `DELETE` interdit (ADR-0004, D6) et perte de l'historique ; écartée.
- **Voie `requiresApproval`** : Will devrait approuver chaque post dans Zernio, ce qui déplace le contrôle hors du Studio ; évaluée et écartée.
- **Nouvel essai automatique après un GET après non conforme** : risque de publication non voulue ; écartée.

## Tests qui la prouvent

- Le corps envoyé est strictement égal à `{ "isDraft": false, "scheduledFor": "<…Z>" }` : toute clé en plus fait échouer le test ; `scheduledFor` se termine par `Z`.
- Forme `mediaItems` : le corps ne contient que `mediaItems`, et elle n'est émise que si le média a plus de 6 jours.
- GET avant non conforme (statut autre que `draft`, `origine` inconnue, `studioCle` différente, contenu relu contenant un mot interdit en jetons concaténés) : aucun `PUT` émis.
- Date à moins de 30 min, ou passée : aucun `PUT`, état « À reprogrammer par vous ».
- Date du journal reprise à la seconde, sans arrondi.
- GET après avec `status` différent de `scheduled`, ou `scheduledFor` différent : état « À vérifier », alerte émise, aucun second `PUT`.
- Réponse 200 au `PUT` mais GET après encore `draft` : détecté comme échec (cas de la réponse trompeuse).
- Import : jumeau Buffer non relu en brouillon → aucune promotion ; relu en brouillon → promotion.
- Tout `PUT /v1/posts/{id}` d'une autre forme est refusé avant le réseau par la liste fermée (ADR-0004).
