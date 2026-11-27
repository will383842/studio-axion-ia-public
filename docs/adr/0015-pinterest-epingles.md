# ADR-0015 · Pinterest : épingles du calendrier envoyées par Zernio

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-26
- Chantier : Pinterest dans le Studio, PR 0 (décisions écrites, aucun code)
- Liens : ADR-0004 (amendée), ADR-0010, ADR-0012

## Contexte

Le Studio envoie aujourd'hui LinkedIn, Instagram, Facebook et TikTok par Zernio. Pinterest est ajouté : une **épingle** = une image, un titre, une description, un lien vers le site, un tableau. Plusieurs décisions de l'ADR-0004 (acceptée) la contredisent ou ne la prévoient pas. Une ADR acceptée ne se contourne pas dans le code : cette ADR l'amende par écrit, avant la première ligne de code (PR 1 à 7).

Cette PR ne contient que des documents. Aucun interrupteur n'est allumé, aucun appel réel n'est fait, aucune route n'est ouverte dans le client.

## Décision

**Amendement D6 (liste fermée de chemins).** Ajout de `GET /v1/accounts/{id}/pinterest-boards` (lecture des tableaux). Restent refusés : `PUT` et `POST` sur cette même route, `POST /v1/posts/{id}/edit`, `GET` et `POST /v1/connect/pinterest/*`. Le test de la liste fermée est étendu dans la PR 3, pas avant.

**Amendement D8 (étiquette IA).** Pinterest : `platformSpecificData.isAiGenerated: true` si et seulement si `epingle.contenuIA === true` ; rien n'est transmis sinon (Pinterest n'offre pas de valeur « non IA »). Le champ vit dans l'épingle (le visuel n'a pas de `contenuIA`), il est obligatoire au format du lot importé.

**Amendement D9 (cibles).** Cible Pinterest : `"<accountId>:pin:<boardId>"`. Jamais le premier tableau : un envoi sans tableau est refusé avant le réseau. Seuls les tableaux publics (`privacy === "PUBLIC"`) sont proposés. Les identifiants vivent en base, jamais dans le dépôt.

**Amendement D10 (médias et formats).** Pinterest : exactement une image (JPEG, PNG ou WebP), 20 Mo au plus (marge sous les 32 Mo de Zernio), rapport 2:3 à ± 1 %, largeur d'au moins 1 000 px ; ni vidéo, ni document, ni deux images. Texte alternatif de **1 à 500 signes pour Pinterest seulement** (les autres réseaux restent à 125). Titre de 1 à 100 signes, description de 800 signes au plus. Lien obligatoire, en https, sans identifiants ni port, dont l'hôte est **égal** au domaine du site (réglage `site.domaine`, créé en PR 3, défaut = hôte de `BASE_PUBLIQUE`) : ni sous-domaine, ni autre domaine. La garde réutilise `lienDeChezNous` (`fournisseurs/publication/zernio-inbox-corps.ts`) avec égalité stricte d'hôte, plutôt qu'une garde neuve.

**ADR-0010 (validation).** Un lot importé naît « à valider ». Le geste « Valider ce lot » vaut validation datée du fondateur, créneau par créneau ; rien ne part avant le tour d'envoi.

**ADR-0012 (anti-répétition).** L'import d'épingles signale un doublon et le fondateur tranche, comme le pose l'ADR-0012 : même empreinte d'image, ou même couple lien + tableau. La comparaison porte sur les contenus déjà publiés ou programmés, pas seulement sur le lot importé. Aucun amendement de l'ADR-0012.

**Créneaux.** 08:30, 12:30, 17:30 et 21:00, heure de Paris, soit 4 épingles par jour au plus, avec 210 minutes d'écart : c'est le plus petit écart entre deux créneaux décidés (17:30 → 21:00), appliqué comme écart conseillé de la cadence (message, pas refus). Les quatre heures vivent dans `REGLAGES_CADENCE_DEFAUT.reseaux.pinterest`, lues par l'import, jamais codées dans la page. Un seul compte Pinterest est prévu (le code en tolère plusieurs).

**Limites écrites.**

- Aucune modification d'une épingle déjà envoyée : seule la description serait modifiable chez Zernio, par une route en bêta fermée chez Pinterest. Avant l'envoi, la règle CAL-23 existante s'applique (une modification renvoie l'entrée « à valider »).
- Une épingle publiée hors du Studio n'est pas rapatriée, comme pour les autres réseaux.
- Pinterest n'a pas de premier commentaire, ni de boîte de réception côté Zernio (doc `reference.mdx`, hors extrait).

## Conséquences

- Positives
  - Les deux plafonds de texte alternatif (125 et 500) sont écrits et justifiés avant le code ; le relevé `docs/reseaux/regles-officielles.json` porte la section Pinterest et les constantes `IMAGES_MAX.pinterest` et `ALT_MAX_PINTEREST`.
  - Pas de publication sur un tableau par défaut ni sur un tableau secret.
  - Le lien ne peut pointer que vers le site : pas d'épingle qui détourne vers un tiers.
- Négatives
  - Le plafond d'alt par plateforme complique `texteAlt` (PR 3).
  - Un seul domaine de lien : un second site demanderait un amendement.
  - Le Studio ne pourra pas corriger une épingle partie.

## Alternatives écartées

- **Premier tableau par défaut** : épingle sur le mauvais tableau possible ; écartée.
- **Sous-domaines du site acceptés** : élargit la surface de lien sans besoin ; écartée.
- **Mention IA déduite du visuel** : le visuel n'a pas ce champ ; écartée.
- **Texte alternatif à 125 pour tous** : Pinterest accepte 500 ; écartée.
- **Éditer une épingle envoyée** : route en bêta fermée ; écartée.

## Tests qui la prouvent

Dans cette PR : `tests/reseaux/regles-officielles.test.ts` (section `pinterest` du relevé, constantes confrontées). Dans les PR suivantes (3 à 7), chaque décision ci-dessus a son test : route des tableaux acceptée et `PUT`/`POST`/`edit` refusés sans appel réseau ; `isAiGenerated` présent seulement si `contenuIA` ; cible sans tableau refusée ; lien hors domaine refusé ; alt 500 accepté sur Pinterest et 126 refusé sur Instagram.

## Points laissés ouverts

- L'extrait `docs/zernio/openapi-extrait-1.418.1.json` ne contient pas encore la route des tableaux : il doit être régénéré par une session qui joint zernio.com (il ne se modifie pas à la main). Cette PR ne le touche pas. Cette régénération est un préalable de la PR 3 (avant la PR 3), car la route des tableaux de D6 en dépend ; d'ici là, 1 média, description de 800 et 32 Mo restent « inconnu ».
- Confirmation hors dépôt, avant les PR 1 à 7 : qu'aucun fichier qu'elles visent n'est patché sur le serveur.
