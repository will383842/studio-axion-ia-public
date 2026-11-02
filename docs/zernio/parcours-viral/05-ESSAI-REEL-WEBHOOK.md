# 05 · Essai réel du webhook Zernio (préalable à l'allumage)

Statut : **À FAIRE**. Tant que cet essai n'est pas fait et consigné ici, `PARCOURS_MOT_ENABLED` reste **éteint**.

## Pourquoi
Le format de signature des webhooks Zernio n'est documenté nulle part dans ce dépôt : l'extrait OpenAPI 1.418.1
(`docs/zernio/openapi-extrait-1.418.1.json`) ne contient ni « signature » ni « secret ». La documentation publique de Zernio n'a pas
pu être consultée lors de COR-PV2 (l'hôte n'était pas dans la liste réseau autorisée de la session). Rien n'a été inventé : les points
ci-dessous sont des **hypothèses**, marquées « À CONFIRMER PAR UN ESSAI RÉEL » dans `src/domaine/guide-reseau/crochet-zernio.ts`.

| Point | Hypothèse du code | Confirmé ? |
| --- | --- | --- |
| En-tête de signature | `x-zernio-signature` (hex 64, préfixe `sha256=` toléré) | non |
| En-tête d'horodatage | `x-zernio-timestamp` (secondes, 10 chiffres) | non |
| Algorithme et charge signée | HMAC-SHA256 hexadécimal de `<horodatage>.<octets bruts du corps>` | non |
| Fenêtre anti-rejeu | ±300 s | non (choix du Studio) |
| Charge | `{ "id": "...", "event": "run.completed", "data": { "runId": "..." } }` | non |
| Lecture d'un run (point d'accès) | absent de l'extrait OpenAPI : aucun lecteur réel branché | non |

## Procédure (action humaine, avec un webhook de TEST)
1. Dans Zernio, créer un webhook de test pointant vers un récepteur qui **journalise** sans rien vérifier (ou un service de capture de
   requêtes). Ne jamais utiliser le vrai secret de production dans un outil tiers.
2. Déclencher un événement de test (un run terminé sur un compte de test).
3. Capturer : **tous les en-têtes** (noms exacts), le **corps en octets bruts** (hex ou base64, pas un copier-coller de texte), la date d'envoi.
4. Recalculer la signature hors du Studio avec le secret de test, pour chaque variante plausible (corps seul, `horodatage.corps`, avec ou
   sans préfixe, hex ou base64). Retenir celle qui correspond.
5. Aligner `ENTETE_SIGNATURE_ZERNIO`, `ENTETE_HORODATAGE_ZERNIO`, `signatureZernio`, `lireEvenementRun` et leurs tests ; remplacer les
   mentions « À CONFIRMER » par la référence à la capture (sans secret, sans adresse e-mail, corps d'exemple FICTIF).
6. Identifier le point d'accès qui relit un run et brancher `injecterLecteurRuns` (aujourd'hui inerte).
7. Consigner ici la date, la version de l'API Zernio et le résultat ; passer les lignes du tableau à « oui ».
8. Seulement alors : `PARCOURS_MOT_ENABLED=1` (action de la session déployeuse, avec `ZERNIO_WEBHOOK_SECRET` et `SITE_GUIDES_RESEAU_SECRET`).

## Points de conduite à connaître avant l'allumage
- Le corps de l'appel au site est **reconstruit à chaque passage** à partir du run relu chez Zernio (ordre des clés fixe). Si Zernio
  modifie le run entre deux passages (accord ajouté après M2, par exemple), les octets changent et le site répond 409 `cle_reutilisee`
  (définitif). Le lecteur de runs ne doit donc relire que des **runs clos**.
- Secret de l'appel sortant : `SITE_GUIDES_RESEAU_SECRET` (= `GUIDES_RESEAU_HMAC_SECRET` côté site, ≥ 32 caractères) ; repli sur
  `SITE_VIDEOS_SECRET` seulement si le site n'a pas non plus sa variable propre.
- Plafonds par passage : 20 événements, 120 par heure glissante ; disjoncteur : 5 pannes consécutives (réseau, 429, 5xx, 401) ouvrent le
  circuit 10 minutes. Un 401 du site est définitif pour l'événement et lève une alerte au journal (sans secret).
