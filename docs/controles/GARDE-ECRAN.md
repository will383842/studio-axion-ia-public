# Garde automatique « rien de technique à l'écran »

Will lit le studio sans être technicien. Rien de technique ne doit apparaître à l'écran ni dans le Journal des
Réglages (qui est un écran) : pas de nom de variable d'environnement, pas de code HTTP ou d'erreur, pas d'anglais,
pas de « Simulation », pas d'identifiant interne. Le détail technique va **seulement** en console serveur
(`console.warn`).

Les relectures refusaient souvent pour ce motif : la vérification est maintenant automatique, dans `npx vitest run`.

## 1. Ce que fait la garde — `tests/garde-ecran.test.ts`

Analyse statique avec le compilateur TypeScript (`typescript`, déjà en dépendance), sans exécuter le code.

### Textes analysés

| Où | Quels textes |
|---|---|
| Fichiers d'écran : `src/components/**`, `src/assistant/**`, `src/app/**/page.tsx` (et `layout`, `not-found`, `error`, `loading`, `global-error`) | textes JSX ; attributs lisibles (`title`, `placeholder`, `aria-label`, `alt`, `label`, `description`, `message`…) ; chaînes affichées dans une expression JSX `{…}` ; toute chaîne qui ressemble à une phrase (une espace, ou une majuscule suivie de minuscules) |
| Tout `src/` | arguments de `notifier.*()` (bulles) ; `notifier({ titre, message })` et `notifications.enregistrer(…)` (cloche) ; 2e argument de `journaliser()` (`src/services/_commun.ts`, Journal des Réglages) ; message des erreurs `new Erreur*(code, message)` (ErreurStudio, ErreurHeygen, ErreurIllustration, ErreurRendu, ErreurLecture… : leur message remonte au Journal ou à l'écran) ; objets `{ ok: false, message }` renvoyés aux actions ; toute propriété `messagePourWill` ; (audit C) `creerNotification({ titre, message })` (cloche, téléphone, e-mail), `evenements.enregistrer({ message })` (lignes du Journal écrites directement), `NextResponse.json({ erreur })` (lu par l'écran) |

Ignorés (jamais affichés) : `console.*`, imports, types, comparaisons (`r.code === "CONFIRMATION_REQUISE"`), `case`,
clés d'objet, attributs non lisibles (`className`, `href`, `data-*`…), le code d'une erreur (1er argument) et le
détail technique d'`ErreurBuffer` (4e argument, qui part en console).

Gabarits `` `…${x}…` `` : le texte fixe est contrôlé, et l'expression interpolée aussi.

### Ce qui est refusé

| Règle | Motif |
|---|---|
| variable d'environnement | `/\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/` |
| code d'erreur interne | `/\b[A-Z]{2,5}-\d{1,3}\b/` (PUB-12…) |
| code HTTP écrit en clair | `(429)`, `HTTP`, `réponse 503`, `code 404`… |
| code HTTP interpolé | `${r.status}`, `${res.status}`, `${statusCode}`, `${statut}` dans un message |
| message technique brut | `${(e as Error).message}`, `${e.message}`, `${(await r.text())…}` dans un message |
| identifiant interne interpolé (audit C) | `${type}`, `${x.id}`, `${role}`, `${modele}`, `${mode}`, `${fournisseur}`, `${formatId}`, `${propre}`, `${etape}`, `${motif}`… dans un message |
| message technique brut recopié (audit C) | `e instanceof Error ? e.message : "…"` ou `(e as Error).message` passé tel quel à un message (« Failed to fetch »…) : n'afficher que le message d'une `ErreurStudio` ou d'une `ErreurLisible` (`src/lib/erreur-lisible.ts`) |
| mot « Simulation » | `simulation` (toutes casses) : à l'écran on dit « Essai » / « mode essai » |
| anglais technique | error, failed, timeout, token, API key, undefined, null (mot entier) |

Exceptions (courtes, commentées dans le test) : les marques (Buffer, HeyGen, Claude, LinkedIn, ElevenLabs, fal.ai,
Pexels, Pixabay, YouTube, TikTok, Instagram, Facebook, Coolify) sont retirées du texte avant contrôle. La liste
`EXCEPTIONS` (fichier + extrait + raison) compte 2 entrées (audit C, voir `AUDIT-C-ECRAN.md`).

### En cas d'échec

Le test liste chaque faute : `fichier:ligne [règle]`, le texte fautif, et la phrase de correction. Exemple :

```
src/fournisseurs/illustration/pexels.ts:96  [code HTTP interpolé]
    texte : `Pexels : réponse ${r.status}.`
    à faire : N'affichez pas le code HTTP : phrase simple pour Will, et console.warn(`… ${r.status}`) côté serveur.
```

### Preuve qu'elle rougit

- Permanente : deux tests de la garde analysent des extraits fautifs écrits en dur (chaque règle doit se déclencher)
  et un extrait sain (console, comparaison, classes CSS : aucun constat).
- Faite à la main : `Pexels : réponse ${r.status}.` remis dans `pexels.ts` et `Simulation PEXELS_API_KEY` dans une
  pastille de `Connexions.tsx` → la garde échoue avec 3 constats (variable, Simulation, code HTTP) ; fautes retirées
  → verte.

### Limites connues

Analyse statique : un texte construit ailleurs puis passé par variable (`notifier.erreur(msg)`) n'est contrôlé
qu'à l'endroit où la chaîne est écrite, et seulement si cet endroit est dans un des contextes ci-dessus. Les
données (catalogues, registres) ne sont pas toutes analysées : l'option « Simulation » de `src/fournisseurs/index.ts`
a été trouvée à la main.

### Étendre la garde

- Nouveau motif interdit : ajouter une entrée à `REGLES` (nom, motif, phrase de correction).
- Nouvel attribut JSX lu par Will : l'ajouter à `ATTRIBUTS_LISIBLES`.
- Nouvelle fonction qui écrit à l'écran : l'ajouter dans `argumentsMessage` (indices des arguments à contrôler).
- Nouvelle propriété « message » : `PROPRIETES_MESSAGE`.
- Nouveau dossier d'écran : `estFichierEcran`.
- Exception justifiée : `EXCEPTIONS` (avec la raison), ou `MARQUES` pour un nom de marque.

## 2. Ce qui a été corrigé

Règle suivie partout : phrase simple en français pour Will ; code HTTP, texte brut du fournisseur ou message
d'exception en `console.warn` côté serveur.

| Fichier | Avant | Après | Atteint l'écran par |
|---|---|---|---|
| `src/fournisseurs/credits/commun.ts:45-46` | « … momentanément indisponible (503) », « HeyGen : réponse 418. » | « … momentanément indisponible. », « … a répondu de façon inattendue. Réessayez plus tard. » | test de clé (Réglages) : `messageErreur` renvoie le message pour le cas « inconnu » |
| `src/fournisseurs/heygen/client.ts:51,60,64` | « (429) », « (${statut}) », texte brut de HeyGen | phrases sans code ; « HeyGen a refusé la demande. » | Journal (échec d'étape) |
| `src/fournisseurs/heygen/voix.ts:123` | « Le stockage a refusé le son (403). » | « … : nouvel essai dans un instant. » | Journal |
| `src/fournisseurs/illustration/fal.ts:69,73,74,88` | message d'exception, corps brut, « réponse 500 », `FAL_PLAFOND_USD` | « fal.ai ne répond pas. », « fal.ai refuse la demande. », « (réglé sur le serveur) » | Journal |
| `src/fournisseurs/illustration/pexels.ts:89,93`, `pixabay.ts:63,64`, `depot.ts:37,39,52` | codes HTTP, message d'exception | phrases simples | Journal |
| `src/fournisseurs/rendu/client.ts:34,41,42,49` | codes HTTP, message d'exception | phrases simples | Journal |
| `src/services/travaux.ts:431` | Journal : « Outil indisponible : » + message brut du fournisseur | Journal : la phrase pour Will (`messagePourWill`) ; message brut en console | **source** du chemin fournisseur → Journal |
| `src/services/boucle-generation.ts:321` | Journal : message d'exception brut | « Tour de boucle interrompu : l'écriture reprendra toute seule. » | Journal |
| `src/components/reglages/Connexions.tsx`, `src/fournisseurs/index.ts` | « Simulation », « en simulation », « Simulation choisie » | « Essai », « en mode essai », « Mode essai choisi » | Réglages > Connexions |
| `src/components/personnages/OngletVisages.tsx` | « Essai : le double est préparé en simulation » | « Essai : le double est préparé, rien n'a été envoyé » | bulle |
| `src/services/notifications.ts:271`, `C-videos-publication-complements.ts:73` | « en simulation » | « en mode essai » | bulle d'erreur, Journal |

`src/fournisseurs/publication/buffer.ts` (HTTP 429…) : faux constat écarté — ce texte est le **détail technique**
(4e argument d'`ErreurBuffer`), envoyé seulement en console par `noterErreurBuffer` ; la garde ne le contrôle plus.

Test adapté : `tests/r0-connexions.test.ts` attend « Essai » et vérifie qu'aucun texte affiché ne contient
« simulation ».

Défaut attrapé en route : la première version du `console.warn` HeyGen recopiait le texte brut de HeyGen, qui
contient parfois la clé reçue ; `tests/d2-credits.test.ts` (« une clé n'apparaît dans aucune sortie console ») l'a
refusé. Le journal serveur ne garde plus que le code HTTP et le code d'erreur de HeyGen.

## 3. Garde « une règle écrite une seule fois » — `tests/garde-regle-unique.test.ts`

Refuse une constante numérique de premier niveau définie avec le **même nom et la même valeur** dans deux fichiers
de `src/`.

Fiabilité : sur tout `src/`, seules trois collisions de nom existaient :
- `JOUR_MS = 86 400 000` dans 3 fichiers → vraie recopie : regroupée dans `src/lib/dates.ts`, importée ailleurs ;
- `TAILLE_MAX` (25 Mo pour une voix, 4 Go pour un envoi) et `LARGEUR` (1080 / 360) → règles locales distinctes.

Refuser le seul nom donnerait donc des faux positifs ; « même nom ET même valeur » n'en donne aucun aujourd'hui.
Limite : une même règle recopiée sous deux noms différents, ou une constante locale à une fonction, n'est pas vue.

## 4. Résultats des contrôles (03/10/2026, branche `outils/garde-ecran`)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur, une fois installées les dépendances de `studio-rendu/` (`npm ci --ignore-scripts`) et les types de Next générés par le build. Sans cela : 12 erreurs, identiques sur la branche de départ (modules Remotion absents, `RouteContext`/`LayoutProps`) |
| `npx eslint .` | propre |
| `npx vitest run` (complet) | 154 fichiers passés, 1 ignoré ; 2081 tests passés, 2 ignorés |
| `npx next build --webpack` | réussi, sans aucune variable d'environnement |

Aucun appel réseau payant ; aucune vraie clé.
