# Relecture PR 580 (Opus) — STK-02 : onglet « Mes textes » et geste « Mettre en stock »

**VERDICT : À CORRIGER** — tête complète relue : `954b50617edfb0142a516c5e97e5d67163cfe9c5` (branche `usine/STK-02`, base `master` 65558620).

## À corriger

1. **Moyenne — on ne peut plus mettre en stock un texte modifié** — `src/components/ecrire/OngletIdees.tsx:162`, `src/components/ecrire/FicheScript.tsx:130`, `src/components/ecrire/BoutonMettreEnStock.tsx:14`.
   La clé de rejeu est fixe pour chaque source (`idee-<id>`, `script-<id>`). Si on met un script en stock, qu'on le corrige, puis qu'on le remet en stock, `creerEntreeStockAction` trouve l'entrée `stk-script-<id>`, constate que le texte a changé et lève une erreur. Reproduit : réponse `{ ok: false, message: "Un souci est survenu. Réessayez dans un instant." }`. Réessayer ou recharger n'y change rien : le geste reste bloqué pour toujours sur cette source.
   Correction attendue : une clé qui dépend aussi du contenu (par exemple une empreinte du texte), ou une clé propre à chaque clic.

2. **Moyenne — faux succès après archivage** — même endroit que le point 1, et `src/app/(studio)/ecrire/stock/actions.ts:30-40`.
   Si l'entrée de cette source a été archivée (ou planifiée), un nouveau « Mettre en stock » avec le même texte renvoie l'ancienne entrée archivée avec `ok: true`. Le message « Ajouté à Mes textes » s'affiche, mais rien n'apparaît dans l'onglet. Reproduit (`archiveLe` est rempli dans la réponse).
   Corriger avec le point 1 (nouvelle clé) ou signaler clairement que le texte a déjà été placé ou archivé.

3. **Faible — filtres « Planifié » et « Publié » toujours vides** — `src/app/(studio)/ecrire/page.tsx:82` et `src/components/ecrire/ListeStock.tsx:9-11`.
   La page ne charge que les entrées actives (`estActif` : ni archivées, ni planifiées, ni publiées). Pourtant, la liste propose encore les états « Planifié » et « Publié », que le test exige même de voir affichés. Si on choisit l'un d'eux, la liste est toujours vide et affiche « Aucun texte à placer pour ces critères. », ce qui est trompeur. Deux corrections possibles : charger les entrées non archivées (le filtre écarte déjà les archivées), ou retirer ces choix de l'onglet.

## Remarques (non bloquantes)

- `tests/stk-02-mes-textes.test.tsx` : le test « est branché » ne vérifie que la présence de la chaîne `BoutonMettreEnStock` dans le chemin d'import. Il ne prouve pas que le menu contient l'entrée. On peut le renforcer.
- `tests/stk-02-mes-textes.test.tsx:19` : la doublure reprend l'identifiant existant `listerTextesW…` de `src/services/voix.ts`, qui contient un prénom. Ce nom existe déjà dans `src` et la doublure en a besoin. Il n'est pas créé par la PR, mais le renommer serait à prévoir à part, pour un dépôt public.
- `page.tsx` lit le stock à chaque affichage d'Écrire, quel que soit l'onglet ouvert, et appelle `depots()` directement depuis la page. Il y a des précédents ; le coût est faible.
- Point soulevé par la PR : le libellé « Mettre en stock » contient le mot « stock ». Ce libellé est imposé par la fiche (critère 3) et l'arbitrage revient au pilotage. Je ne le bloque pas.

## Contrôles effectués

- Le geste ne publie rien et n'appelle aucun service réel. Il se limite à `creerEntreeStockAction`, qui vérifie la session, valide la saisie et enregistre dans le dépôt. Il n'y a aucun appel réseau, ni planificateur, ni service de publication.
- Aucune suppression de contenu ni de donnée de personne : la source (idée ou script) n'est ni déplacée ni archivée. Les actions existantes ne changent que la page à rafraîchir : `/ecrire/stock` (qui n'a pas de page) devient `/ecrire`.
- Périmètre : 8 fichiers, tous liés à la fiche. Le contrôle « garde de zone et de fichiers autorisés » est vert. Je n'ai pas trouvé la fiche STK-02 dans le dépôt ; j'ai donc jugé sur la cohérence (le journal RC-31 annonce bien l'onglet pour STK-02).
- `scripts/echecs-connus.json` est inchangé.
- Aucun nom de personne ajouté dans le code, à part l'identifiant existant signalé ci-dessus. Pas de mention de Buffer. Les textes à l'écran sont en français correct et sans jargon (« Mes textes », « À placer », « Ajouté à Mes textes »).
- Tests ciblés en local : `stk-02-mes-textes`, `rc-31-stock-messages`, `stock-messages`, `rc-33-planificateur-stock` (49/49), et `maj-action-introuvable`, `c3-scripts-reels`, `final-b-accessibilite` (45/45), tous verts. `tsc` ne signale aucune erreur sur les fichiers touchés. `eslint` est propre sur les fichiers touchés. Suite complète lancée localement (limite de 580 s) : 74 échecs, tous dans `tests/image-video/controles`, `tests/image-video/moteur` et `tests/e2e-verif1-ef-reessayer-redemarrage`. Ces fichiers n'importent aucun fichier touché par la PR. Lancés seuls, ils dépassent aussi 400 s sur la tête de la PR **et sur master** : ce sont des dépassements de délai propres à ce poste, pas une régression de la PR.
- Contrôles GitHub sur la tête : 8/8 verts (next build, eslint et tsc différentiels, garde de zone, tests des fichiers touchés, tests des nouveaux fichiers, règles de fer, build réel Docker, garde interne).
