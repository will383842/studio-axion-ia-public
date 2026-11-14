# Relecture PR 501 (ATR-01) : À CORRIGER

Branche `usine/ATR-01`, tête `01565bbf`, relue le 14/11/2026 en lecture seule.

**Verdict : À CORRIGER.** Le cœur tient : carte complète, rejeu dédoublonné, registre d'opposition consulté avant toute écriture, aucune suppression, aucun appel réseau, périmètre respecté. Mais le critère 3 (« ayant dit stop : AUCUNE carte ») n'est pas tenu dans deux cas réels, et le test « stop » laisse survivre les deux mutations qui le visent. Le journal dit le contraire.

## Ce qui a été vérifié
- Périmètre : 3 fichiers seulement (`src/services/a-traiter-entree.ts`, `tests/a-traiter/atr-01-entree.test.ts`, `pilotage/journal/ATR-01.md`). Aucun fichier zernio* ni mots-* modifié. Seul import : `@/domaine/guide-reseau/opposition` (fonction pure, lue sans être modifiée).
- Garde `outils/gardes/zone-interdite.mjs` lancée depuis la tête contre `origin/master` : **verte**, avec un avertissement : `pilotage/autorises/ATR-01.json` est absent de master, donc le contrôle de liste est manuel (fait : conforme).
- `vitest` : 11/11 verts. `eslint` sur les 2 fichiers : propre. `tsc` : aucune erreur sur ces fichiers.
- Aucun nom de personne, seulement des adresses `@exemple.fr`, aucun prix.
- Aucune écriture vers un réseau : le module ne reçoit ni n'importe aucun client réseau. `PortsEntree` n'expose que `file.existe/ajouter` et `oppositions.estOpposee`, rien pour effacer ou supprimer. Aucune donnée de personne n'est effacée.
- Ordre (critère 3) : le filtre « stop » (l.85) et le registre (l.89-95) passent **avant** `file.existe` / `file.ajouter` (l.96-97). Si le registre est illisible, la fonction renvoie `reessai` sans rien écrire (l.92-94). Correct.

## Points bloquants
1. **`src/services/a-traiter-entree.ts:85` : un « stop » mêlé au mot crée une carte.** `estMotOpposition` ne renvoie vrai que pour une opposition *claire*. Un texte qui contient un mot d'opposition **et** un mot non neutre est classé « doute », et donc ici « pas d'opposition ». Sondes (registre qui répond `false`, cas d'un premier message pas encore enregistré dans RC-40) :
   - `"GUIDE stop"` → `carte_creee`
   - `"stop GUIDE merci"` → `carte_creee`
   - `"ne m'écrivez plus GUIDE"` → `carte_creee`

   Le domaine dit lui-même qu'un doute veut dire « rien ne part, l'opérateur est alerté ». Correction attendue : utiliser `classerOpposition(...) !== "non"` sur `c.texte` (et sur `c.mot`) pour ne créer **aucune** carte, avec une raison distincte (par ex. `opposition_douteuse`) pour que l'appelant puisse alerter. Ajouter un test pour chacun des trois textes ci-dessus.
2. **`src/services/a-traiter-entree.ts:89` : si `idContact` manque, le registre n'est pas consulté (on laisse passer en cas de doute).** Une personne déjà en opposition dans RC-40 obtient une carte si le webhook ne fournit pas d'identifiant (sonde : `idContact: null` + registre qui répond `true` → `carte_creee`, registre jamais lu). Ce choix contredit le cas « registre illisible », qui, lui, bloque en cas de doute. Correction attendue : sans `idContact`, renvoyer `ignore`/`reessai` (raison `contact_inconnu`), ou bien rendre `idContact` obligatoire dans `CommentaireRecu`. Ajouter un test.
3. **`tests/a-traiter/atr-01-entree.test.ts:94-99` : le test « stop » ne tue aucune des deux mutations qui le visent.** Il met `mot: "STOP"` **et** `texte: "stop"` en même temps. Résultat : retirer `estMotOpposition(c.texte)` (M1) **survit**, et retirer `estMotOpposition(c.mot)` (M2) **survit** aussi. Il faut deux tests séparés : texte « stop » avec un mot `GUIDE`, puis mot `STOP` avec un texte neutre.
4. **`pilotage/journal/ATR-01.md:7` est inexact.** Il affirme que « chaque mutation fait échouer un test (… stop, … mot) ». C'est faux pour « stop » (M1, M2) et pour « mot » (M11, ci-dessous). À corriger après les tests.

## Mutations rejouées (16)
Tuées : registre ignoré (M3), écriture avant le filtre (M4), dédoublonnage retiré (M5), registre illisible qui crée quand même une carte (M6), e-mail conservé (M7), pseudo conservé (M8), lien non https accepté (M9), réseau non filtré (M10), contrôle du contact toujours sauté (M15), identifiant de personne copié dans la carte (M16).
**Survivantes** : M1 et M2 (point 3), M11 (contrôle `RE_MOT` l.88 retiré), M12 (échappement l.65 retiré), M13 (troncature `EXTRAIT_MAX` l.66 retirée), M14 (contrôle `RE_ID` de `idEvenement` l.83 retiré). M11 à M14 ne bloquent pas, mais chacune mérite un test court.

## Points non bloquants
- `tests/...:114-120` : le test « lecture seule » ne prouve rien par lui-même, parce que le service ne prend jamais `clientReseau`. La garantie réelle vient de la structure (aucun import réseau, aucun port d'écriture). Pour la rendre testable : vérifier les imports de `a-traiter-entree.ts` (un seul import autorisé), ou ajouter le faux client à un port réellement passé. `tests/...:55` (`"exemple.fr/contact"`) est une assertion sans objet.
- `a-traiter-entree.ts:96-97` : entre `existe` et `ajouter`, deux livraisons simultanées peuvent passer toutes les deux le contrôle et créer deux cartes. Le contrat de `PortsEntree.file.ajouter` doit dire qu'il est **idempotent sur `idEvenement`** (contrainte unique dans L7-26). À écrire dans le commentaire de l'interface.
- `a-traiter-entree.ts:52-69` : l'extrait est stocké déjà échappé en HTML. Si l'écran l'affiche avec React, il sera échappé une seconde fois (`&amp;` visible). Mieux vaut stocker le texte brut nettoyé et échapper à l'affichage.
- `a-traiter-entree.ts:72-79` : `lienSur` accepte n'importe quel domaine en https. Il faudrait limiter aux hôtes du réseau (`linkedin.com`, `tiktok.com` et leurs sous-domaines).

## Dépendances et accord
- **L7-26 (file durable)** : absente de master (aucun module ni fiche). **RC-40** : sur master, c'est seulement l'accord écrit de la garde pour les fichiers zernio, ce qui ne concerne pas cette PR (aucun fichier zernio touché), et aucun registre d'opposition exportable n'existe hors `parcours-conversation.ts` (zone interdite).
- L'interface injectée est **sûre et sans effet** tant que rien n'est branché : la fonction n'est appelée nulle part, elle n'a pas de port par défaut, et elle n'écrit que par `ports.file.ajouter`. Une fois les points 1 et 2 corrigés, elle peut être fusionnée sans les dépendances.
- **Ce qui bloque la fusion** : les points 1 à 4. Ensuite, au branchement par la session parcours viral, il faudra (a) une file L7-26 dont `ajouter` est idempotent et (b) un adaptateur RC-40 qui fournit toujours `idContact`. Aucun accord RC-40 n'est requis pour cette PR. Il faut publier `pilotage/autorises/ATR-01.json` sur master pour que la garde contrôle la liste, sinon elle reste en simple avertissement.
