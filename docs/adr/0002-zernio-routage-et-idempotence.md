# ADR-0002 · Zernio Z2 · Routage par fournisseur, `via` élargi, clé d'idempotence

- Statut : acceptée
- Date : 2026-11-01
- Chantier : Zernio, décisions D2, D3 et D4
- Liens : ADR-0001, ADR-0003, ADR-0004

## Contexte

Le registre des fournisseurs ne sait aujourd'hui rendre qu'un seul fournisseur par rôle : `fournisseur("publication")` rend Buffer. Le passage à Zernio doit se faire réseau par réseau, et parfois compte par compte, avec un retour possible à Buffer tant que Buffer n'est pas résilié. Le code compare `p.via === "buffer"` à plusieurs endroits pour savoir si une publication est partie chez un outil. La clé d'envoi actuelle est liée à Buffer. Zernio offre un en-tête `Idempotency-Key`, mais ne conserve la clé que 24 h. Pendant la transition, un même contenu peut être tenté par les deux outils : il faut l'empêcher.

## Décision

D2 · Routage par identifiant de fournisseur : le registre gagne fournisseurParId("publication", "zernio" | "buffer"). fournisseur("publication") reste inchangé. Réglage publication.routage : { "<reseau>": outil, "<reseau>:<compteCode>": outil }. La clé la plus précise gagne. Défaut {} = Buffer partout. Sans clé du fournisseur choisi : refus clair, jamais de repli silencieux. Bascule réseau par réseau dans Connexions ; retour à Buffer en un geste tant que Buffer n'est pas résilié.

D3 · via élargi : ViaPublication = "buffer" | "zernio" | "manuel" | "simulation" ; retour de envoyer : via: "buffer" | "zernio" | "simulation" ; releves[].source gagne "zernio". Fichier neuf src/domaine/outil-publication.ts : OUTILS, outilDe(p), estChezUnOutil(p) (via ∈ {buffer, zernio}), outilPour(routage, reseau, compte). Chaque p.via === "buffer" du dépôt est remplacé par ces fonctions (services/buffer.ts, domaine/buffer.ts, mesures-completes.ts, corbeille.ts). Les noms de champs historiques (modeBuffer, etatEnvoi, cleEnvoi) restent, documentés.

D4 · Clé d'idempotence : clé neutre cleEnvoiPublication(sourceId, reseau, dateIso, compteCode) = sha256, sans le nom du fournisseur ; envoyée en Idempotency-Key: studio-<hex> (≤ 255 signes). Import : Idempotency-Key: imp-<sha256(bufferId:accountId:pageId|organizationUrn)>. Zernio ne garde la clé que 24 h (un rejeu renvoie 200 avec le post d'origine même si le corps diffère ; 409 idempotency_conflict tant que le premier appel tourne ; le doublon de contenu 409 dure aussi 24 h et ignore les brouillons). Au-delà, le journal du Studio fait foi. Après une erreur 5xx ou un délai dépassé : lecture GET avant tout nouvel envoi, jamais un renvoi à l'aveugle. Anti-doublon entre outils : occupees regarde estChezUnOutil ; un envoi Zernio d'un contenu déjà parti par Buffer sur ce réseau et ce compte est refusé : « Déjà envoyée par Buffer pour ce réseau. »

## Conséquences

- Positives
  - Bascule progressive et réversible, réseau par réseau ou compte par compte, sans redéploiement : un réglage suffit.
  - Défaut `{}` = comportement actuel (Buffer partout) : la fusion de ce chantier ne change rien tant que personne ne bascule.
  - Plus aucune comparaison littérale à `"buffer"` dispersée : `outilDe`, `estChezUnOutil` et `outilPour` sont les seules portes.
  - La clé d'envoi ne dépend plus du fournisseur : un même contenu a la même clé chez les deux outils, ce qui rend l'anti-doublon entre outils possible.
  - Aucun renvoi à l'aveugle : un délai dépassé ou une 5xx déclenche une lecture avant toute nouvelle écriture.
- Négatives
  - Les noms historiques (`modeBuffer`, `etatEnvoi`, `cleEnvoi`) restent alors qu'ils servent aussi à Zernio : ils sont documentés dans `outil-publication.ts` pour éviter la confusion.
  - Au-delà de 24 h, Zernio ne protège plus contre le rejeu : le journal du Studio devient la seule source de vérité, il doit être écrit avant l'appel réseau et relu avant tout nouvel essai.
  - Le refus sans repli peut bloquer un envoi si la clé Zernio manque : c'est voulu, le message le dit clairement.

## Alternatives écartées

- **Faire rendre Zernio par `fournisseur("publication")` selon un drapeau global** : bascule tout ou rien, pas de retour fin ; écartée.
- **Repli automatique sur Buffer si Zernio échoue ou n'a pas de clé** : risque de double publication et perte de traçabilité ; écartée (« jamais de repli silencieux »).
- **Renommer `modeBuffer`, `etatEnvoi`, `cleEnvoi`** : migration des documents jsonb et diff massif sans gain fonctionnel ; écartée.
- **Clé d'idempotence incluant le nom du fournisseur** : rend l'anti-doublon entre outils impossible ; écartée.
- **Se fier uniquement à l'idempotence de Zernio** : 24 h seulement, et le doublon de contenu ignore les brouillons ; écartée au profit du journal.
- **Renvoyer automatiquement après une 5xx** : peut créer un doublon si le premier appel a abouti ; écartée.

## Tests qui la prouvent

- `outilPour` : `{}` rend Buffer ; `{ "instagram": "zernio" }` rend Zernio pour tout compte Instagram ; `{ "instagram": "zernio", "instagram:<compteCode>": "buffer" }` rend Buffer pour ce compte (la clé la plus précise gagne).
- `fournisseurParId("publication", "zernio")` sans clé configurée : refus avec message explicite, aucun appel à Buffer.
- `fournisseur("publication")` rend toujours le même fournisseur qu'avant (non-régression).
- `estChezUnOutil` vrai pour `buffer` et `zernio`, faux pour `manuel` et `simulation`.
- Garde de dépôt : aucune occurrence de `via === "buffer"` hors `src/domaine/outil-publication.ts`.
- `cleEnvoiPublication` : déterministe, identique quel que soit l'outil, différente si un seul des quatre paramètres change ; l'en-tête `studio-<hex>` fait au plus 255 signes.
- Clé d'import `imp-<…>` : stable pour un même triplet, différente entre `pageId` et `organizationUrn`.
- Client simulé : réponse 5xx puis nouvel essai → un GET est émis avant tout POST ; délai dépassé → même comportement.
- Réponse 409 `idempotency_conflict` : aucune nouvelle écriture, état d'attente.
- Anti-doublon : contenu déjà parti par Buffer sur ce réseau et ce compte → envoi Zernio refusé avec « Déjà envoyée par Buffer pour ce réseau. » ; même contenu sur un autre compte → accepté.
