# Les vidéos du studio sur axion-ia.com — plan complet

> Version 1 du 17/10/2026, **à valider par Will avant toute construction**.
> Il couvre **tous les générateurs** et **toutes les vidéos** du studio.
> Il dit surtout **ce qu'on centralise et ce qu'on ne centralise pas** (référencement Google, référencement IA, métadonnées, etc.).
> Rien n'est construit tant que ce plan n'est pas validé.

---

## 0. Le plan en 10 lignes

1. **Oui, il faut mettre les vidéos sur le site**, mais pas toutes : seulement celles qui **expliquent quelque chose** (tableau animé, cas concret, avocat, face caméra « conseil »). Les pubs, les doublons et les vidéos trop courtes restent sur les réseaux.
2. Chaque vidéo publiée a **sa propre page** sur le site : la vidéo, son texte complet (la transcription), ses chapitres et des liens vers le service ou la formation concernés.
3. **Tout ce qui décrit la vidéo est fabriqué une seule fois, dans le studio, pour tous les générateurs** : titre, résumé, transcription, chapitres, sous-titres, vignette, thème. C'est le « passeport de la vidéo ».
4. **Tout ce qui dépend du site est fait par le site** : données structurées pour Google, plan du site vidéo, fiche pour les IA (`llms.txt`), aperçu au partage, statistiques.
5. Dans la fiche vidéo du studio, **un seul bouton « Publier sur le site »**, le même pour tous les générateurs.
6. Avant de publier, le studio **vérifie seul** les interdits : jamais « Villeexemple », jamais « Aucun gain garanti », pas de « certifié Certifexemple », pas de logos ni d'avis clients, charte respectée.
7. Une vidéo **supprimée** dans le studio **disparaît aussi du site** (Google reçoit « page supprimée », code 410).
8. Les fichiers vidéo sont **hébergés chez nous**, sur le stockage R2 derrière Cloudflare. **Pas de YouTube intégré** au site : pas de cookies avant consentement, et c'est le site qui reçoit le crédit chez Google.
9. **YouTube reste utile** pour être découvert : on y publie aussi, via Buffer, avec un lien vers la page du site.
10. **Huit petits lots** : 4 côté studio, puis 4 côté site. Chacun est vérifiable.

---

## 1. Faut-il le faire ? Ce qu'on peut en attendre, honnêtement

**Ce que ça change pour vous :** vos vidéos travaillent pour le site au lieu de disparaître du fil des réseaux au bout de 48 h. Google et les assistants IA (ChatGPT, Perplexity, Google AI) peuvent les trouver, les montrer et vous citer. Ce n'est pas magique : le gain vient surtout du **texte autour de la vidéo** et de la régularité.

### Ce qui marche (constaté et documenté par Google)

- **Une page par vidéo.** Google ne montre une vidéo dans ses résultats que si elle a sa propre adresse, accessible sans connexion, et si la vidéo est **le contenu principal** de la page. Une vidéo glissée en bas d'un article ne suffit pas.
- **Les signaux que Google lit :**
  - le texte de la page (titre, intertitres, texte autour de la vidéo) ;
  - les liens venant d'autres sites ;
  - les données structurées (une fiche technique invisible pour le visiteur) ;
  - **le fichier vidéo lui-même**, donc Google doit pouvoir le télécharger.
- **Les « moments clés »** (chapitres cliquables dans Google) : on peut les déclarer nous-mêmes avec un balisage de chapitres (`Clip`). Google conseille cela pour des vidéos d'au moins 30 secondes environ, avec la possibilité d'ouvrir la vidéo à un instant précis.
- **Pour les IA :** les moteurs de réponse lisent surtout **le texte**. Une transcription propre, un résumé et des chapitres sont ce qui permet d'être cité. Une vidéo sans texte est presque invisible pour elles.

### Ce qui ne marche pas, ou peu

- Publier toutes les vidéos en vrac, avec des pages presque vides : Google les considère comme des pages pauvres, ce qui peut tirer le site vers le bas.
- Les vidéos de 10 à 15 secondes sans contenu (accroches, pubs) : elles n'ont pas assez de matière pour une page.
- Intégrer YouTube dans le site : c'est souvent YouTube qui récupère le crédit dans Google, pas le site, et le lecteur YouTube alourdit la page.
- Espérer un effet immédiat : il faut compter plusieurs semaines pour l'indexation, puis un effet qui grandit avec le nombre de pages vraiment utiles.

### Ordre de grandeur

Je ne donne volontairement **aucun chiffre promis**. Les études qui circulent (« +53 % de visibilité », etc.) viennent de vendeurs et ne sont pas sourcées. Ce qu'on peut dire honnêtement :
- une page vidéo bien faite peut apparaître dans **3 endroits nouveaux** : l'onglet « Vidéos » de Google, les résultats avec vignette et les réponses des IA ;
- on **mesurera** dans Google Search Console et Plausible, après 6 à 8 semaines, avant d'accélérer.

### Quelles vidéos méritent une page (par générateur)

| Générateur | Une page sur le site ? | Pourquoi |
|---|---|---|
| **Tableau animé** | ✅ Oui, en priorité | Il explique un sujet : idéal pour Google et les IA (« comment faire X »). |
| **Cas concret MD** | ✅ Oui, en priorité | Une preuve concrète, étape par étape : riche en texte, très citable. |
| **Vidéo type avocat** | ✅ Oui, si la vidéo répond à une question | Format « question → réponse » : très bon pour les recherches. |
| **Face caméra** | 🟡 Au cas par cas | Oui pour un conseil ou une explication ; non pour une simple annonce. |
| **Face caméra animée** | 🟡 Au cas par cas | Même règle que la face caméra. |
| **Image → vidéo** | 🟡 Plutôt non, sauf exception | Souvent courte et faite pour les réseaux. Oui seulement si elle explique un sujet en plus de 30 s environ. |
| **Podcast** (à venir) | ✅ Oui | Long, riche en paroles : excellent pour les IA, avec transcription et chapitres. |
| **Écran partagé, motion design, Créateur B** (à venir) | 🟡 Selon le contenu | Démonstration ou explication : oui ; accroche : non. |
| **Avis client filmé** (à venir) | ⛔ Pas tant que les avis sont éteints | Les avis clients sont coupés (DGCCRF, 09/10). |
| **Selfie** (à venir) | ⛔ Non par défaut | Contenu d'humeur, peu de matière. |

**Règle simple proposée :** une vidéo va sur le site si elle **explique ou prouve quelque chose**, dure **au moins 30 s environ** et **n'est pas une variante** d'une vidéo déjà publiée. Les variantes par réseau (même vidéo, autre début) ne sont jamais publiées deux fois : une seule page, la meilleure version.

---

## 2. La matrice de centralisation (le cœur de la demande)

**Ce que ça change pour vous :** vous ne remplissez rien deux fois. Ce qui **décrit la vidéo** est fabriqué **une fois, dans le studio**, par un même mécanisme pour tous les générateurs. Ce qui dépend **du site** (Google, plan du site, IA) est calculé **par le site** à partir de ce passeport. Ainsi, on change une règle de référencement à un seul endroit, et toutes les vidéos en profitent.

### Le principe

- **Studio = la source.** Il connaît le script validé, la voix, le minutage des mots, les sous-titres et les images. C'est donc lui qui fabrique le **passeport de la vidéo** : titre, résumé, transcription, chapitres, sous-titres, vignette et thème.
  - Ce passeport est **commun à tous les générateurs**. Chaque générateur ne fournit que ce qui lui est propre, par exemple les chapitres naturels : les blocs « Accroche / Cœur / Preuve » de l'avocat, les « Étapes » du cas concret.
- **Site = la vitrine.** Il reçoit le passeport et fabrique tout ce qui est propre au web : la page, la fiche technique pour Google, le plan du site vidéo, `llms.txt`, l'aperçu de partage, les liens internes et les statistiques.
- **On ne copie jamais la logique de référencement dans le studio.** Le studio ne sait pas ce qu'est un `VideoObject`. Si Google change ses règles, on ne touche que le site.

### Le tableau

Légende :
- **Studio commun** : fabriqué une fois pour tous les générateurs.
- **Générateur** : chaque générateur fournit sa part.
- **Site** : calculé par axion-ia.com.

| Élément | Qui le fabrique | Où il est stocké | Pourquoi ce choix | Ce qui existe déjà |
|---|---|---|---|---|
| **Titre web** (60 caractères au plus, la question à laquelle la vidéo répond) | Studio commun : écrit par Claude depuis le script, retouchable par vous | Passeport (studio) puis copié dans la base du site | Le titre web n'est pas le titre réseau : il vise la recherche Google, pas le défilement | `Video.titre` et `TexteReseau.titre` (YouTube) dans `studio-axion-ia/src/domaine/types.ts:728, 1031` |
| **Résumé** (2-3 phrases, sert aussi de description Google) | Studio commun | Passeport, puis site | Un seul texte fiable, réutilisé partout (page, fiche Google, aperçu de partage) | Textes du kit de publication `KitPublication.textes` (`types.ts:1047`) : point de départ |
| **Transcription complète** | Studio commun, depuis le **texte validé** et le minutage des mots, pas depuis une écoute | Passeport, puis site (affichée sur la page) | C'est ce que lisent les IA ; partir du script validé évite toute faute d'écoute | Script validé, minutage des mots de la voix HeyGen, segments `SousTitres` (`types.ts:996`) |
| **Chapitres / moments clés** | **Générateur** : chacun connaît ses blocs. Le studio commun les met au même format (début, fin, libellé) | Passeport, puis site | Les blocs existent déjà dans chaque recette de format ; ne pas les deviner après coup | Blocs de recette : avocat (`formats/avocat/index.ts:178-183`), cas concret « Étape » répétable (`formats/cas-concret/index.ts:119-122`), tableau, etc. |
| **Sous-titres WebVTT** (`.vtt`) | Studio commun | Fichier dans R2, adresse dans le passeport | Obligatoire pour l'accessibilité (loi européenne sur l'accessibilité, en vigueur depuis juin 2025) ; déjà fabriqué pour YouTube | **Export `.srt`/`.vtt` existant** : `src/briques/sous-titres/export.ts` |
| **Vignette / affiche** (1280×720 ou à la forme de la vidéo, AVIF + JPEG) | Studio commun | Fichier dans R2 | Google exige une vignette ; c'est aussi l'image affichée avant la lecture | `Sortie.vignetteFichierId`, `Video.miniatureChoisieId` (`types.ts:1012-1024`) |
| **Thème, mots-clés, rubrique** | Studio commun propose ; **vous validez** | Passeport | Sert à ranger la vidéo dans la bonne rubrique et à faire les liens vers les services | Sujet, série, idée (`Video.sujet`, `serieId`, `ideeId`) |
| **Lien vers un service / une formation du site** | **Site** propose selon le thème ; vous pouvez forcer | Base du site | Seul le site connaît ses pages et ses adresses | Pages services et formations d'axionia |
| **Fiche technique Google (JSON-LD `VideoObject`)** | **Site** | Calculée à l'affichage | Règles Google = métier du site ; un seul endroit à mettre à jour | `buildVideoObjectJsonLd` dans `axionia/src/lib/seo/extended-schemas.ts:84-109` (testé, pas encore utilisé) |
| **Chapitres pour Google (`Clip`, `SeekToAction`)** | **Site**, à partir des chapitres du passeport | Calculée | Idem | À ajouter à côté de `buildVideoObjectJsonLd` |
| **Fil d'Ariane, auteur, organisation** (`BreadcrumbList`, `Person`, `Organization`) | **Site** | Calculée | Déjà fait pour tout le site, on réutilise | `buildBreadcrumbJsonLd`, `buildPersonJsonLd`, `buildOrganizationJsonLd` dans `axionia/src/lib/seo.ts` |
| **Aperçu au partage** (`og:video`, carte X/LinkedIn) | **Site** | Calculé | Dépend de l'adresse publique de la page | `axionia/src/lib/seo.ts` : à compléter, `og:video` absent aujourd'hui |
| **Plan du site vidéo** (`sitemap-videos.xml`) | **Site** | Calculé toutes les heures | Liste des pages publiées = connaissance du site | Modèle à copier : `axionia/src/app/sitemap-images-blog.xml/route.ts` + index `src/app/sitemap-index.xml/route.ts` |
| **Fiche pour les IA** (`llms.txt`, `llms-full.txt`) | **Site** | Calculée | Idem | `axionia/src/app/llms.txt/route.ts`, `llms-full.txt/route.ts` : ajouter une section « Vidéos » |
| **Prévenir les moteurs** (IndexNow) | **Site**, à la publication et à la dépublication | — | Le site connaît l'adresse finale | `axionia/src/lib/indexnow.ts` + file utilisée par la banque d'images |
| **Licence, crédit, droits** | Studio commun (droits des images, voix, polices) ; le site affiche | Passeport | Le studio tient déjà le registre des droits de chaque élément utilisé | `KitPublication.credits`, case « droits » de `avantDePublier`, registre `src/briques/droits/` |
| **Fichier vidéo** (MP4 H.264 + AAC, 1080p au plus) | Studio commun (la « sortie » choisie) | **R2 public dédié** `videos.axion-ia.com`, derrière le cache Cloudflare | Un seul fichier pour tous ; pas de stockage en double dans le site | `Sortie.fichierId` (par forme et par réseau) |
| **Version AV1 / HLS (diffusion adaptative)** | ⛔ Pas maintenant | — | Vidéos courtes (moins de 3 min) : un MP4 bien compressé suffit ; HLS ajoute de la complexité sans gain réel | — |
| **Statistiques** (lectures, clics vers RDV) | **Site** (Plausible, événement « Vidéo lue ») | Plausible | Plausible est définitif, pas de Google Analytics | `trackFunnel("Landing Video Played")` dans `axionia/src/components/lp/VslVideo.tsx` |
| **Résultats remontés au studio** (vues sur le site) | Site, puis studio (lecture seule) | Page « Mesures » du studio | Vous voyez tout au même endroit | `src/app/(studio)/mesures` existe |

### Ce qui reste **spécifique à chaque générateur**

Uniquement trois choses, chacune déclarée dans la fiche du format (`src/formats/<générateur>/index.ts`) :
1. **Comment découper les chapitres.** Par exemple :
   - avocat : « Accroche / Promesse / Cœur / Preuve / Appel » ;
   - cas concret : une entrée par « Étape » ;
   - tableau : une entrée par écran.
2. **La forme à publier par défaut.** Verticale 9:16 pour l'avocat et la face caméra ; 16:9 ou 4:5 si le générateur en produit une.
3. **Le droit d'aller sur le site** (oui / au cas par cas / non), d'après le tableau de la section 1.

Tout le reste passe par le même code.

---

## 2 bis. Vos interrupteurs : ce qui a le droit d'aller sur le site (décision de Will, 17/10)

**Ce que ça change pour vous :** **rien ne part sur le site sans vous.** Aujourd'hui, aucune vidéo n'est à publier. Vous gardez deux niveaux de contrôle.

1. **Par type de vidéo (générateur)** : dans le studio, **Réglages → Sur le site**, un interrupteur par générateur (Tableau animé, Cas concret, Avocat, Face caméra…), **tous éteints au départ**. Le tableau de la section 1 n'est qu'un **conseil** affiché à côté de chaque interrupteur, jamais une décision automatique.
2. **Par vidéo** : même si un générateur est allumé, **chaque vidéo** a sa case « Sur le site » dans sa fiche. Elle est décochée par défaut : vous choisissez une à une les vidéos publiées. Un mode « publier automatiquement les nouvelles vidéos de ce générateur » existe, **éteint par défaut**.
3. **Éteindre un générateur** retire du site toutes ses vidéos d'un coup (page « supprimée » 410, sortie du plan du site et de `llms.txt`), sans rien effacer dans le studio. Le rallumer les republie.
4. Une page **« Sur le site »** dans le studio liste ce qui est en ligne, par générateur, avec les vues remontées du site.

Côté code : les champs `site` et `chapitresWeb` de la fiche format deviennent un **conseil par défaut**. La vraie décision est un réglage stocké (`siteGenerateurs.<id>` = allumé/éteint, `siteAuto.<id>`), lu par le bouton et par l'envoi. Ajouté au lot S1 (réglages) et S3 (case par vidéo, page « Sur le site »).

---

## 2 ter. Les vignettes : un système à part entière (demande de Will, 17/10)

**Ce que ça change pour vous :** chaque vidéo aura une vignette **reconnaissable au premier coup d'œil comme Axion IA** (un socle commun : couleurs, typographie, logo, placement), **mais propre à chaque générateur** (un tableau animé ne ressemble pas à un cas concret). Vignettes pensées pour chaque endroit : YouTube 16:9, couvertures Reels/TikTok/Shorts 9:16, LinkedIn 4:5, affiche du site.

État actuel (constaté dans le code) : `src/domaine/miniatures.ts` + `src/fournisseurs/rendu/miniature.ts` prennent l'image la plus nette de la vidéo et posent un titre de 5 mots au plus, **identique pour tous les générateurs**, sans charte. C'est une base technique, pas un système de marque.

Le chantier « vignettes » a **son propre plan et ses maquettes**, conçus par une équipe d'agents (directeur artistique, designers par générateur, critique), à valider par vous **avant** toute construction : `<dossier-de-plan-prive>/`. Il couvre aussi les générateurs à venir (chaque nouveau générateur hérite du socle et déclare sa variante). La vignette publiée sur le site est la vignette 16:9 (ou à la forme de la vidéo) issue de ce système.

---

## 2 quater. Un site parfaitement organisé (demande de Will, 17/10)

**Ce que ça change pour vous :** les vidéos ne sont pas une pile en vrac. Le visiteur, Google et les IA trouvent tout de suite la bonne vidéo, rangée au bon endroit.

- **Rangement par thème, pas par générateur.** Le visiteur cherche « automatiser mes devis », pas « tableau animé ». Rubriques calées sur les thèmes déjà présents sur le site (services, métiers, formations) : `/fr/videos` (toutes) → `/fr/videos/<thème>` (une page par thème, avec texte d'introduction) → `/fr/videos/<thème>/<vidéo>`. Le générateur reste un simple filtre.
- **Séries** : les vidéos d'une même série du studio (`serieId`) sont reliées entre elles (« Épisode 2 sur 5 », suivante / précédente).
- **Maillage** : chaque page de visionnage renvoie vers 1 service ou 1 formation et 3 vidéos du même thème ; chaque page service / formation / métier / ville du même thème affiche l'encart « En vidéo » (lot W4).
- **Adresses** stables et lisibles (titre court sans date), fil d'Ariane partout, une seule page « maître » par vidéo.
- **Galerie** : filtres thème / durée / type, tri récentes ; pages de thème de 24 vidéos, pagination propre (pages indexables, pas de défilement infini).
- **Pages vides interdites** : une page de thème n'apparaît (menu, plan du site) qu'à partir de 3 vidéos publiées, pour ne jamais montrer de page pauvre à Google.
- Ajouté aux lots W3 (thèmes, séries, pagination) et W4 (maillage).

---

## 3. Le parcours : du studio au site

**Ce que ça change pour vous :** dans la fiche d'une vidéo terminée, un bouton **« Publier sur le site »**. Vous relisez le titre, le résumé et les chapitres proposés, vous cochez, c'est en ligne en quelques minutes. Un bouton **« Retirer du site »** fait l'inverse. Si vous supprimez la vidéo, elle disparaît aussi du site.

### 3.1 Le bouton (studio, commun à tous les générateurs)

- **Où :** fiche vidéo `/videos/[id]`, à côté de « Lien privé » et « Publier » (Buffer). C'est le même écran pour tous les générateurs.
  - Pour Image → vidéo et Cas concret, qui ont aujourd'hui leur propre écran sans publication : le bouton apparaît dès que leur fiche rejoint l'écran commun. Ce travail est déjà prévu par le chantier « harmonisation ».
- **Visible seulement si :**
  - la vidéo est prête ;
  - son générateur a le droit d'aller sur le site (section 2) ;
  - elle n'est pas une variante d'une vidéo déjà publiée.
- **Écran de relecture (une feuille) :**
  - titre web, résumé, chapitres et rubrique, tous retouchables ;
  - choix de la version à publier : par défaut la plus grande, à la forme d'origine ;
  - aperçu de la page.

### 3.2 Les vérifications automatiques avant publication

La publication est **bloquée** (message clair, sans jargon) si l'un de ces points échoue :

| Vérification | Comment |
|---|---|
| « Villeexemple » dans le titre, le résumé, la transcription ou les chapitres | Recherche de texte (ordre permanent : « partout en France ») |
| « Aucun gain garanti » | Recherche de texte (remplacer par « Sans exclusivité ») |
| « certifié Certifexemple », « certification Certifexemple » (revendication) | Recherche de texte (coupé jusqu'au certificat) |
| Logo ou nom de client, avis client | Liste des clients éteints (DGCCRF, 09/10) + case de relecture |
| Droits des images, polices et voix | Registre des droits du studio (déjà utilisé par le kit) |
| Sous-titres présents et `.vtt` fabriqué | Obligatoire (accessibilité) |
| Vignette présente | Obligatoire (Google) |
| Durée de 30 s ou plus | Avertissement, pas un blocage (vous décidez) |
| Les 5 cases « Avant de publier » du kit | Réutilisées telles quelles (`KitPublication.avantDePublier`) |

### 3.3 L'échange studio → site (technique)

- **Sens :** le studio **envoie** au site. Le site n'appelle jamais le studio, qui reste privé.
- **Moyen :** une adresse privée du site, `POST /api/interne/videos`, protégée par une **signature** (secret partagé + horodatage, refus après 5 minutes, rejeu impossible). C'est le même principe que les branchements déjà faits entre le site et Partners.
- **Contenu envoyé (le passeport) :**
  - identifiant studio, version du passeport ;
  - titre web, résumé, transcription, chapitres (début, fin, libellé), rubrique, mots-clés ;
  - générateur, langue (fr), durée, forme (largeur × hauteur) ;
  - date de publication ;
  - adresses publiques R2 : vidéo MP4, vignette AVIF + JPEG, sous-titres `.vtt` ;
  - crédits / licence ;
  - lien conseillé vers un service ou une formation.
- **Fichiers :** au moment de publier, le studio **copie** la sortie choisie, sa vignette et son `.vtt` vers le stockage public `videos.axion-ia.com`. Le stockage privé du studio reste privé : on ne rend jamais public le stockage du studio entier.
- **Réponse du site :** l'adresse de la page (`/fr/videos/<titre-court>`), gardée par le studio et affichée dans la fiche (« En ligne sur le site ↗ »).
- **Rejeu sans risque :** renvoyer le même passeport met la page à jour, sans doublon.

### 3.4 Retirer du site, supprimer

- **« Retirer du site »** (studio) : appel signé de dépublication. Le site renvoie alors **410 « page supprimée »** sur l'adresse, retire la vidéo du plan du site et de `llms.txt`, prévient IndexNow, et efface les 3 fichiers publics.
- **Suppression définitive dans le studio** (lot « suppression » en cours) : elle **appelle d'abord la dépublication**. Si le site ne répond pas, la suppression attend et réessaie : on ne laisse jamais une page orpheline sur le site.
- **Modifier** une vidéo publiée (nouvelle version) : vous republiez. La même adresse est mise à jour et la date de modification change.

---

## 4. Côté site (dépôt axionia)

**Ce que ça change pour vous :**
- une rubrique **« Vidéos »** sur axion-ia.com, avec une page par vidéo ;
- les vidéos apparaissent aussi **dans les pages services, formations et articles** qui parlent du même sujet ;
- le site reste aussi rapide qu'aujourd'hui : la vidéo ne se charge qu'au clic.

### 4.1 Les données

- Nouvelle table `SiteVideo` (base du site). Elle contient :
  - `idStudio` (unique), `slug`, `titre`, `resume`, `transcription` ;
  - `chapitres` (JSON), `rubrique`, `motsCles[]`, `generateur` ;
  - `dureeSec`, `largeur`, `hauteur` ;
  - `urlVideo`, `urlVignetteAvif`, `urlVignetteJpg`, `urlVtt` ;
  - `credits`, `lienService` ;
  - `publieLe`, `modifieLe`, `statut` (publiee / retiree), `versionPasseport`.
- Les vidéos **retirées** ne sont pas effacées de la table : on garde la ligne avec `statut = retiree` pour répondre 410 durablement, conformément à l'ordre « on garde ». Seuls les fichiers publics disparaissent.
- Garde de construction : au build, la base est une base factice (`stub.invalid`, contrat ADR 0026). Les pages vidéo et le plan du site vidéo doivent rendre une liste vide sans planter. Les pages se remplissent ensuite toutes les heures.

### 4.2 Les pages

| Page | Contenu | Données structurées |
|---|---|---|
| `/fr/videos` (galerie) | Vignettes par rubrique, filtres simples, 24 par page | `CollectionPage` + `BreadcrumbList` |
| `/fr/videos/[slug]` (**page de visionnage**) | La vidéo en tête (contenu principal) ; titre (h1) ; résumé ; chapitres cliquables (`?t=42` ouvre à 42 s) ; **transcription complète** dépliable mais présente dans le HTML ; « Pour aller plus loin » vers le service / la formation ; appel « Réserver un appel » | `VideoObject` (nom, description, vignette, date, durée, `contentUrl`, `embedUrl`, `transcript`) + `Clip` par chapitre + `SeekToAction` + `BreadcrumbList` + `Person` (Williams) / `Organization` |
| Pages services, formations, articles, villes | Encart « En vidéo » (1 à 3 vignettes du même thème) qui **renvoie vers la page de visionnage** | Rien de plus : la fiche technique vit sur la page de visionnage, pour ne pas disperser le signal |

Un seul endroit « maître » par vidéo, la page de visionnage. Ailleurs, ce sont des renvois. Cela évite que Google hésite entre plusieurs pages pour la même vidéo.

### 4.3 Le lecteur

- On réutilise le principe de `axionia/src/components/lp/VslVideo.tsx` :
  - affiche (`next/image`, AVIF) dans un cadre aux bonnes proportions, donc **aucun saut de mise en page** ;
  - `<video preload="none">` chargée au clic seulement ;
  - sous-titres `.vtt` en `<track kind="captions" srclang="fr" default>`.
- La vidéo en tête de page = l'image la plus grande, donc c'est l'affiche qui compte pour la vitesse : préchargée, petite (moins de 60 Ko en AVIF).
- Aucune bibliothèque de lecteur externe : le lecteur natif suffit, et ça ne pèse rien en JavaScript.
- Accessibilité :
  - sous-titres activés par défaut ;
  - transcription sur la page (aussi utile aux personnes sourdes et aux IA) ;
  - commandes au clavier, pas de lecture automatique avec le son.

### 4.4 Budgets de vitesse (AGENTS.md)

| Mesure | Seuil interne | Comment on le tient |
|---|---|---|
| Affichage du plus grand élément (LCP) | ≤ 1 800 ms | Affiche AVIF préchargée, page rendue côté serveur |
| Saut de mise en page (CLS) | 0 | Cadre aux proportions fixes (`aspect-ratio`) |
| JavaScript au premier chargement | ≤ 75 Ko compressés | Lecteur = petit composant client ; galerie et page de visionnage sans autre script |
| Réactivité (INP) | ≤ 100 ms | Rien de lourd au clic |

Rappel d'AGENTS.md : **aucune barrière automatique ne bloque une page trop lourde avant la mise en ligne**. On mesure donc à la main, avant / après, sur `/fr/videos` et une page de visionnage, et on note les chiffres dans la PR.

### 4.5 Ce qu'il faut ouvrir ou ajouter dans le site

- **Règles de sécurité (CSP)** : ajouter `media-src 'self' https://videos.axion-ia.com` dans `axionia/src/lib/csp.ts` (aujourd'hui aucune vidéo externe ne peut être lue).
- **Plan du site vidéo** `src/app/sitemap-videos.xml/route.ts`, copié de `sitemap-images-blog.xml` (XML brut, garde `stub.invalid`, rafraîchi toutes les heures, plafond 1 000). Il contient des balises `<video:video>` avec vignette, titre, description, adresse du fichier, durée et date. On l'ajoute à `CUSTOM_SITEMAPS` dans `sitemap-index.xml/route.ts`, puis on le soumet une fois dans Google Search Console.
- **`llms.txt` / `llms-full.txt`** : section « Vidéos ». Pour chaque vidéo : titre, adresse, résumé (une ligne) dans `llms.txt`, et transcription complète dans `llms-full.txt`.
- **Aperçu au partage** : `openGraph.videos` (adresse MP4, type, largeur, hauteur) + vignette dans les métadonnées de la page de visionnage (`src/lib/seo.ts`).
- **IndexNow** à la publication, à la mise à jour et au retrait, par la même file que la banque d'images.
- **Site en français seulement** : l'anglais reste coupé (301 vers FR). Aucune version anglaise des pages vidéo pour l'instant.

---

## 5. YouTube, LinkedIn et les autres

**Ce que ça change pour vous :** on ne choisit pas entre le site et YouTube. **Le site est la maison** : c'est là que Google doit créditer la vidéo, et là que le visiteur peut réserver un appel. **YouTube et les réseaux sont des vitrines** qui renvoient vers la maison.

- **Sur le site :** fichier hébergé chez nous, pas d'intégration YouTube. On évite ainsi :
  - les cookies avant consentement (déjà refusés dans l'ADR 0034 du site) ;
  - le lecteur lourd ;
  - le crédit qui part vers YouTube.
- **Sur YouTube (via Buffer, déjà branché) :**
  - les mêmes vidéos, avec le **même titre** et la **même transcription en sous-titres** (le `.vtt` existe déjà) ;
  - dans la description, **le lien vers la page du site** et les chapitres en horodatage.
  - YouTube est le 2ᵉ moteur de recherche et une source très lue par les IA : ne pas s'en priver.
- **LinkedIn, Instagram, TikTok, Facebook :** inchangé, ce sont les versions par réseau du studio. Dans le premier commentaire ou la description : lien vers la page du site quand le réseau le permet.
- **Cohérence avec Buffer :** le kit de publication du studio reste la seule source des textes réseaux. Le passeport web est une **nouvelle colonne** du même kit, pas un outil à part.
- **Ordre conseillé :** page du site d'abord, puis réseaux le même jour. Google voit ainsi le site comme la source d'origine.

---

## 6. Les lots, dans l'ordre

**Ce que ça change pour vous :** 8 petits lots. Les 4 premiers se font dans le studio et préparent le passeport. Les 4 suivants construisent le site. Vous pourrez tester le bouton dès le lot S4, avec une vraie page.

> Prérequis côté studio : les lots en cours (générateurs grisés, suppression définitive, harmonisation des écrans) atterrissent d'abord, parce que le bouton « Publier sur le site » vit dans la fiche vidéo commune.

### Studio

| Lot | Contenu | Fini quand… |
|---|---|---|
| **S1 — Passeport de la vidéo** | Type `PasseportWeb` dans le kit de publication : titre web, résumé, transcription (depuis le texte validé + minutage), chapitres (déclarés par chaque format : nouveau champ `chapitresWeb` dans la fiche format), rubrique, mots-clés, crédits. Écrit par Claude **une fois** par vidéo (comme les textes du kit), retouchable. Champ `site: "oui" \| "au-cas-par-cas" \| "non"` par générateur | Pour une vidéo de chaque générateur actif, le passeport est rempli et les chapitres tombent sur les bons blocs (tests sur avocat, facecam, tableau, cas concret, image→vidéo) |
| **S2 — Contrôles avant publication** | Les vérifications de la section 3.2 (mots interdits, droits, sous-titres, vignette, durée) | Test : un passeport contenant « Villeexemple » ou « Aucun gain garanti » est refusé avec un message clair |
| **S3 — Bouton et feuille « Publier sur le site »** | Dans la fiche vidéo commune ; relecture ; choix de la version ; état « En ligne sur le site ↗ » ; « Retirer du site » | Parcours testé de bout en bout avec un site factice |
| **S4 — Envoi signé + copie des fichiers publics** | Copie MP4 + vignette + `.vtt` vers `videos.axion-ia.com` ; appel signé ; rejeu sans doublon ; dépublication appelée par la suppression définitive | Une vraie vidéo publiée sur l'environnement de test du site ; suppression → 410 constaté |

### Site (axionia)

| Lot | Contenu | Fini quand… |
|---|---|---|
| **W1 — Réception** | Table `SiteVideo` (migration), adresse signée `POST/DELETE /api/interne/videos`, garde `stub.invalid`, CSP `media-src`, stockage public | Tests : signature fausse refusée, rejeu idempotent, retrait → statut `retiree` |
| **W2 — Page de visionnage** | `/fr/videos/[slug]` : lecteur façade, chapitres `?t=`, transcription, renvoi service, JSON-LD `VideoObject` + `Clip` + `SeekToAction` + fil d'Ariane, `og:video`, 410 si retirée | Test des résultats enrichis Google vert ; LCP ≤ 1 800 ms, CLS 0, JS ≤ 75 Ko mesurés à la main et notés dans la PR |
| **W3 — Galerie + plan du site + IA** | `/fr/videos`, `sitemap-videos.xml` dans l'index, section « Vidéos » de `llms.txt` / `llms-full.txt`, IndexNow | Plan du site valide, soumis dans Search Console ; `llms.txt` liste les vidéos |
| **W4 — Encarts « En vidéo »** | Dans les pages services, formations, articles et villes du même thème | Encart visible sur 3 pages tests, sans perte de vitesse mesurée |

Puis, **6 à 8 semaines après** : relevé Search Console (pages vidéo indexées, apparitions, clics) et Plausible (lectures, réservations depuis une page vidéo). On décide alors d'accélérer ou de corriger.

---

## Corrections après l'audit A4 (17/10/2026)

Source : `<dossier-de-plan-prive>\A4-SEO-GEO-METADONNEES.md` (audit en lecture seule, sources Google citées). Ces corrections **priment** sur les sections ci-dessus.

1. **Pas d'`embedUrl`** pour un MP4 hébergé chez nous : `contentUrl` suffit. Ajouter dans `VideoObject` : `inLanguage: "fr"`, `publisher` = l'organisation, `thumbnailUrl` en tableau (16:9, 4:3, 1:1), `hasPart` (chapitres).
2. **Créateur = l'organisation Axion-IA**, pas Williams, sauf s'il est réellement à l'image ; **mention IA affichée** quand la vidéo utilise un double ou une voix générée (AI Act art. 50, comme pour la persona Manon). Cette mention est propre au **site** et ne change rien à la règle du studio (mention facultative dans les vidéos elles-mêmes).
3. **Le lecteur reste dans la page** : `<video src poster preload="none">` présent dans le HTML dès le départ (comme `VslVideo`), jamais une image remplacée au clic.
4. **Chapitres** : seulement pour les vidéos de 30 s ou plus ; jamais `?t=` dans l'adresse canonique ; deux chapitres jamais au même début ; même découpage repris dans la description YouTube.
5. **Hébergement : même domaine, recommandé.** Servir les fichiers sous `axion-ia.com/medias/...` (règle Cloudflare vers un R2 public dédié) plutôt qu'un sous-domaine `videos.axion-ia.com` : pas de règle d'accès entre domaines à régler pour les sous-titres, pas de `robots.txt` à part, un seul domaine pour Google. **Conséquence : plus besoin que Will crée de sous-domaine.** Ajouter `media-src 'self'` dans la CSP.
6. **Fichier MP4** : préparé pour la lecture immédiate (`-movflags +faststart`), noms de fichiers versionnés (cache permanent, pas de purge), **la même adresse de vignette partout** (affiche, JSON-LD, plan du site, `og:image`), vignette de 1200 px de large au moins.
7. **IndexNow ne prévient pas Google** (seulement Bing, Yandex, Naver) et il est resté muet des semaines (erreur 403) : il reste en bonus, avec une alerte s'il échoue. Pour Google : plan du site vidéo avec `lastmod`, maillage interne, soumission unique dans Search Console.
8. **410 = 404 pour Google** : le retrait est progressif, sans délai garanti. Pour un retrait urgent : outil de suppression de Search Console. Le retrait d'une vidéo enlève **dans la même opération** : plan du site vidéo, `llms.txt`, encarts « En vidéo ».
9. **Pas de page pauvre** : une vidéo de 30-60 s, c'est 80-150 mots de transcription. Chaque page de visionnage a donc **au minimum** : un résumé, 3 points « À retenir », 2 ou 3 questions-réponses visibles, le lien vers le service ou la formation, et les vidéos liées.
10. **Sous-titres `.vtt`** : aujourd'hui fabriqués à la demande, pas stockés. Ils sont **enregistrés comme fichier** au moment de publier (lots S1/S4).
11. **Contrôles avant publication** : pour Certifexemple et les avis, lire les **vrais réglages** (`CERTIFEXEMPLE_CERTIFICATION_OBTENUE`, `avisPublies`) en plus de la recherche de mots ; les mots interdits viennent de la **liste unique** tenue par la session scripts (`studio-axion-ia/src/domaine/qualite-script/`, `docs/ecriture/(document interne non publié)), jamais d'une copie.
12. **Priorités revues** : `og:video` et `llms.txt` passent en priorité basse. Google dit ne pas avoir besoin de fichiers spéciaux pour les fonctions IA, mais 330 visites en 30 jours viennent de ChatGPT : la transcription visible et les questions-réponses restent le vrai levier GEO.

## Décisions de Will (17/10/2026)

- ✅ Plan validé : règle de sélection et matrice de centralisation.
- ✅ YouTube : oui, via Buffer, avec le lien vers la page du site.
- ✅ **Aucune vidéo à publier pour l'instant.** Interrupteurs par générateur + choix vidéo par vidéo (section 2 bis), tout éteint au départ.
- ✅ Site parfaitement organisé (section 2 quater).
- ✅ Vignettes : système de marque commun + variante par générateur, conçu par une équipe d'agents (section 2 ter, plan séparé).
- ~~Créer le sous-domaine `videos.axion-ia.com`~~ : plus nécessaire si l'hébergement se fait sous `axion-ia.com/medias/` (recommandation après audit A4).

## Ce que j'attendais de vous (questions d'origine, réglées ci-dessus)

1. **Valider la règle de sélection** : « explique ou prouve quelque chose, 30 s ou plus, pas une variante ». Et valider le tableau par générateur de la section 1, en particulier image → vidéo « plutôt non » et face caméra « au cas par cas ».
2. **Valider la matrice** de la section 2 : le passeport fabriqué dans le studio, tout le référencement dans le site.
3. **Créer le sous-domaine** `videos.axion-ia.com` (DNS chez Cloudflare, proxifié, comme pour `studio`). Le connecteur n'a pas le droit d'écrire les DNS : c'est à vous de le faire, en 2 minutes, au moment du lot S4.
4. **YouTube** : confirmer qu'on publie aussi sur la chaîne « Axion-IA · Williams Jullin » via Buffer, avec le lien vers la page du site.
5. Me dire **quelles vidéos existantes** publier en premier, ou me laisser proposer une première liste de 5 à 10 vidéos parmi les tableaux animés et cas concrets terminés.

---

### Sources consultées (17/10/2026)

- Google Search Central, données structurées vidéo (`VideoObject`, `Clip`, `SeekToAction`, moments clés) : https://developers.google.com/search/docs/appearance/structured-data/video
- Search Engine Journal, « Google's 5 video SEO best practices » (page publique, données structurées, fichier accessible) : https://www.searchenginejournal.com/googles-5-video-seo-best-practices/399477/
- Search Engine Journal, lancement du balisage des moments clés (30 s minimum, accès à un instant précis) : https://www.searchenginejournal.com/google-launches-new-way-to-optimize-videos-for-search/413877/
- W3era, guide d'optimisation vidéo (page indexable : pas de noindex, pas de connexion requise) : https://www.w3era.com/blog/seo/video-seo-optimization-guide/
- Webtures, « What is YouTube GEO » (importance de la transcription pour les IA, chiffres non sourcés à prendre avec prudence) : https://www.webtures.com/insights/what-is-youtube-geo/
- Goldcast, « Make videos more discoverable using video GEO » : https://www.goldcast.io/updates/make-videos-more-discoverable-using-video-geo
