# REPRENDRE — chantier « scripts bien ciblés » (studio Axion-IA)

Écrit le 09/11/2026 avant un changement de compte Claude. Tout ce qui compte est sur GitHub (dépôt will383842/studio-axion-ia-public), rien ne dépend de l'ancien compte.

## BLOC DU HAUT (lire ça d'abord)
- OBJECTIF : la cible (métier, secteur ou TPE/PME/ETI) devient OBLIGATOIRE à la création d'un sujet de script ; chaque script/vidéo reçoit un TYPE D'AUTOMATISATION (12 types) ; notation des scripts mise à jour ; anciens scripts gardés et marqués « ancien » ; doublons signalés ; plus tard, pages SEO/GEO par type.
- FAIT : lot A (socle) fusionné, master bdbf653d (PR #271). Plan écrit sur la branche `docs/ciblage-plan` : fichier `docs/chantiers/ciblage/PLAN.md` (décisions + sections LOT A2, B, C1, C2+C3, D, E, F, G, H). Huit lots lancés en cloud sur l'ancien compte, une branche chacun.
- BRANCHES DES LOTS : ciblage/a2-finitions, ciblage/b-migration, ciblage/c1-notation, ciblage/c2c3-generateur-ecran, ciblage/d-tableau, ciblage/e-cas-concret, ciblage/f-image-video, ciblage/g-rythme-avocat. Lot H (branche ciblage/h-listes) : PAS ENCORE LANCÉ, à faire APRÈS fusion de B.
- ÉTAT AU MOMENT DE LA PAUSE (09/11/2026, relevé sur GitHub) :
  A2 = PR #273 ouverte (c8a06729) · B = PR #272 ouverte (2cc75cfe) · C2+C3 = PR #274 ouverte (4492e933) · F = PR #275 ouverte (3f6bb1bc) · D = PR #276 ouverte (7bf2267b) · E = PR #277 ouverte (dc4bb83b) · G = PR #278 BROUILLON (cad62025, session coupée possible, à vérifier) · C1 = RIEN (aucune branche, à RELANCER en entier) · H = pas lancé.
  Aucune PR n'a été relue ni fusionnée. Rien d'autre n'est en cours.
- ÉTAT RÉEL à relever avec la commande ci-dessous (ne pas se fier à une liste figée).
- DÉCISIONS DE WILL (ne pas redemander) : cible obligatoire seulement à l'écran et dans l'action serveur de création (jamais ailleurs : remarque, pas blocage) ; levier « Ciblage » = 8 points ; « grand groupe » retiré (TPE/PME/ETI) ; anciens scripts gardés/marqués, jamais supprimés ; doublons signalés ; le système Zernio (commentaires, mots, guides, mot dit en fin de vidéo) est fait dans UNE AUTRE SESSION : INTERDIT d'y toucher (src/services/parcours-*, mots-*, src/domaine/guide-reseau/**, src/fournisseurs/zernio*, src/components/mots/**, src/app/(studio)/mots/**, tests/zernio/**, docs/zernio/**, champ `fin` du tableau, formats/cas-concret/mots-branches.ts).
- PROCHAINE COMMANDE (état réel) :
  `for b in a2-finitions b-migration c1-notation c2c3-generateur-ecran d-tableau e-cas-concret f-image-video g-rythme-avocat; do echo "== $b"; gh pr list -R will383842/studio-axion-ia-public --head ciblage/$b --state all --json number,state,headRefOid --jq '.[]|"#\(.number) \(.state) \(.headRefOid[0:8])"'; done`
- ATTENDU DE WILL : rien de bloquant. Après le changement de compte, lui dire « reprends le chantier ciblage » dans une session neuve.

## Comment reprendre, cas par cas
1. Lot avec PR ouverte : relecture Opus (agent `relecteur-qualite`) sur `gh pr diff N`, corrections si besoin (nouvelle routine ou à la main), CI verte, puis `gh pr merge N --squash`. Une PR à la fois, vérifier que master est vert avant chaque fusion.
2. Lot avec branche poussée mais SANS PR : la session cloud a été coupée. Regarder `git log origin/master..origin/ciblage/<lot>` ; si le travail est complet, ouvrir la PR (`gh pr create --base master`) ; sinon relancer le lot (point 3) en lui disant de reprendre la branche existante.
3. Lot sans branche ni PR : le relancer. Routines cloud de l'ancien compte PERDUES : en recréer une par lot avec l'outil RemoteTrigger (create avec cron factice `0 0 31 12 *`, `enabled:false`, `clear_mcp_connections:true`, environnement cloud du NOUVEAU compte, modèle claude-sonnet-5-5, puis `run`). Prompt court à reprendre : « Dépôt will383842/studio-axion-ia-public. Français. Lis docs/REGLES-ROUTINES.md et AGENTS.md. Lis ton plan : `git fetch origin docs/ciblage-plan && git show origin/docs/ciblage-plan:docs/chantiers/ciblage/PLAN.md` : sections « Décisions », « Règles communes » et « LOT <X> ». Fais UNIQUEMENT ce lot, sur la branche ciblage/<branche> partie de origin/master, puis ouvre la PR. » Limite de création : environ 6 par 30 secondes (erreur 429 : attendre).
4. Si les sessions cloud du nouveau compte ne voient pas le dépôt : vérifier que l'application GitHub de Claude est installée pour ce compte.
5. Ordre de fusion conseillé : A2, E, F, G (indépendants) ; B ; puis C1 ; D ; C2+C3 ; puis lancer H (après B). Si deux PR touchent le même fichier, fusionner l'une, mettre l'autre à jour sur master.
6. Après toutes les fusions : lot H, puis mise en ligne (`ssh axionia-web`, `/opt/studio-axion-ia/deploiement/mettre-a-jour.sh` avec `nohup setsid`, verrou `mise-a-jour.verrou`, contrôle `/api/sante`), puis vérification dans Chrome : l'écran « sujet » refuse sans cible, filtres par type, anciens masqués, badge « Doublon possible ». Pas de `git checkout` dans le clone local `C:\Users\Will\Documents\Projets\studio-axion-ia-public`.

## Pièges connus
- Vert de la CI ≠ suite complète : comparer les tests en local sur les fichiers touchés. Pas de jsdom (tests de rendu serveur).
- Pas de heredoc avec apostrophes dans Bash : écrire les fichiers avec l'outil Write. Pas de `sleep` long en avant-plan : veilles en arrière-plan.
- `git worktree remove` interdit si node_modules est une jonction (règle S3).
- Dépôt PUBLIC : aucune donnée réelle, aucun secret.
- Les routines de l'ancien compte `STUDIO-ciblage-*` (et les anciennes `STUDIO-*`) sont à supprimer si elles réapparaissent sur claude.ai/code/routines ; elles sont désactivées (cron factice).

## Reste à faire plus tard (hors périmètre actuel)
- Pages SEO/GEO par type d'automatisation (le site n'accepte aujourd'hui que ses pages en liste blanche).
- Mot dit en fin de vidéo branché sur la liste des mots Zernio : autre session.
- Guides PDF par type d'automatisation (Will).
