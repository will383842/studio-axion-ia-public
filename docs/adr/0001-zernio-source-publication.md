# ADR-0001 · Zernio Z1 · Source d'une publication : vidéo ou visuel

- Statut : acceptée
- Date : 2026-11-01
- Chantier : Zernio, décision D1
- Liens : ADR-0002, ADR-0003, ADR-0004

> Note de numérotation : `docs/adr` n'existait pas sur `master` au moment de la rédaction. Ces quatre ADR ouvrent donc la série à 0001 ; les suivants prendront les numéros libres à partir de 0005.

## Contexte

Une `Publication` du Studio porte aujourd'hui un `videoId` obligatoire. L'arrivée de Zernio comme second outil de publication s'accompagne de posts sans vidéo (visuels, carrousels, documents). Deux voies s'offraient : une seconde entité « publication de visuel » avec sa propre chaîne d'états, ou une seule entité dont la source varie. Doubler l'entité doublerait aussi la page À publier, l'anti-doublon et la synchro, avec un risque fort de divergence entre les deux chaînes.

## Décision

D1 · videoId optionnel + visuelId optionnel : Publication.videoId devient videoId?: Id et on ajoute visuelId?: Id. Invariant : exactement un des deux. Fonction pure sourceDe(p) rend { famille: "video", videoId } ou { famille: "visuel", visuelId }. Tous les lecteurs passent par elle. Pourquoi : une seule chaîne d'états, une seule page À publier, un seul anti-doublon, une seule synchro. Coût : la compilation casse chez tous les lecteurs de videoId ; une seule PR (P3-A) les corrige. Aucune migration (collection documents en jsonb). Hors chemin critique : les posts importés ne sont PAS des Publication, ils vivent dans le journal d'import ; P3-A part le 09/11.

## Conséquences

- Positives
  - Une seule chaîne d'états, une seule page À publier, un seul anti-doublon, une seule synchro pour les deux familles de contenu.
  - `sourceDe(p)` est le point unique de lecture de la source : tout nouveau type de source passera par elle.
  - Aucune migration de base : les documents restent en jsonb, les anciens documents ont un `videoId` et respectent déjà l'invariant.
- Négatives
  - La compilation casse chez tous les lecteurs directs de `videoId` ; la PR P3-A les corrige en une fois (aucune correction partielle étalée).
  - Un document qui porterait les deux champs, ou aucun, est invalide : il doit être refusé à l'écriture et signalé à la lecture.
- Neutres
  - Les posts importés depuis Buffer ne sont pas des `Publication` : ils vivent dans le journal d'import (voir ADR-0004, D9) et ne sont pas concernés par ce changement.

## Alternatives écartées

- **Entité séparée `PublicationVisuel`** : deux chaînes d'états, deux pages, deux anti-doublons ; écartée pour le risque de divergence.
- **Champ générique `sourceId` + `type`** : renomme un champ historique, impose une migration des documents existants ; écartée.
- **Garder `videoId` obligatoire et y ranger l'identifiant du visuel** : mensonge de modèle, lecteurs incapables de distinguer les familles ; écartée.
- **Transformer les posts importés en `Publication`** : mélangerait l'historique Buffer et la production du Studio ; écartée, le journal d'import suffit.

## Tests qui la prouvent

- `sourceDe` rend `{ famille: "video", videoId }` pour une publication à vidéo seule.
- `sourceDe` rend `{ famille: "visuel", visuelId }` pour une publication à visuel seul.
- `sourceDe` lève une erreur claire si les deux champs sont présents, et si aucun ne l'est.
- Lecture d'un ancien document jsonb (avec `videoId`, sans `visuelId`) : accepté sans migration.
- Anti-doublon : une vidéo et un visuel de même identifiant brut ne se bloquent pas l'un l'autre (la famille fait partie de la clé).
- Garde de compilation : aucun lecteur hors `sourceDe` n'accède directement à `p.videoId` (recherche dans `src/` dans la suite de tests).
