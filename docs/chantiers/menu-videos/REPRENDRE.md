# REPRENDRE — chantier « menu + vidéos » du studio (état 08/11/2026 soir)

> Bloc du haut = à lire en premier. Le plan complet est dans `PLAN.md` (même dossier), la consigne des auteurs dans `CONSIGNE-AUTEURS.md`.

**Objectif (Williams, 08/11)** : menu latéral parfaitement compréhensible ; vidéos classées par réseau et par type, pastille du réseau ; fiche vidéo rapide et claire ; page « Vidéos validées » avec export ; Réglages rangés ; « fais tout de bout en bout ».

**Fusionné dans master** : #249 menu en sections · #247 recherche des pages · #250 « Cas concret » · #248 socle vidéos (réseaux, pastilles, BoutonValider, route `/api/telechargements/video`) · #251 Mes vidéos (filtres réseau/étape) · #252 fiche plus rapide · #253 nouvelle fiche vidéo.

**Reste (une fiche = une branche = une session cloud ; jamais deux sur le même fichier)** :
1. **G Réglages** — branche `reglages/rangement` (wip 316a414, poussé). À finir : (a) `git checkout origin/master -- tests/zernio/filet-guide/__snapshots__/02-corps-site.test.ts.snap` ; (b) rejouer `npx vitest run tests/reglages tests/relecture-script-ecran.test.ts tests/e2e1-secu-acces.test.ts tests/e2e2-console-proxy.test.ts tests/e2e-verif1-g-liens.test.ts tests/zernio/z3c-connexions.test.tsx` + eslint + tsc filtré ; (c) reformuler les textes « Zernio »/« Buffer » à l'intérieur de `BlocZernio`/`BlocBuffer` (tests qui les citent à mettre à jour) ; (d) PR `--base master` « Réglages rangés en rubriques claires, pages de maquette retirées » (lister fichiers supprimés + bloc de test retiré E2E-1 n° 10).
2. **V Vidéos validées** — branche `videos/v-validees` (wip poussé). Plan § D et « ### V ». Base master (#248 fusionnée). Touche `api/telechargements/route.ts` (aussi touché par la vieille PR #47) → **relecture sécurité séparée (Opus) obligatoire avant fusion**.
3. **I Image → vidéo** — branche `videos/i-image-video` (wip poussé). Plan § C2 et « ### I ».
4. **N menu** (après fusion de V) : `src/components/coquille/navigation.ts`, `ENTREE_A_PUBLIER` libellé « À publier » → « Vidéos validées » ; tests `tests/nav-sections.test.ts`, `tests/a-publier.test.ts`.
5. **Test manquant** (relecture #252) : `tests/perf-fiche-video.test.ts` — cas avec 2 travaux `en_cours` sur une autre vidéo + la cible `en_file` ; comparer `rang` et `debutVers` avec l'ancien calcul.
6. **Fin** : suite vitest complète sur master, comparée aux échecs préexistants (`final-b-mobile` n° 10, `facecam-animee/essai-reel` ×4, `facecam-animee/lot-i` coupes, `harmonisation/annuler-partout`, `harmonisation/image-video-adaptateurs`, `bandeau-generateur` ×2, `tableau/raccords-2`, `e2e1-restes-mineurs` « ESSAI », `r0-connexions`, `garde-ecran`, `visuels/rendu-contrat` — à confirmer). Puis mise en ligne par la session studio locale (procédure : `deploiement/`).

**Décisions de Williams (ne pas redemander)** : formats « Bientôt » sans moteur = retirés partout ; « Vidéos validées » visible par défaut ; vidéo sans réseau connu → réseaux par défaut, pastilles atténuées ; zip « Tout télécharger » = validées seulement ; « Cas concret MD » → « Cas concret » ; jamais « Zernio », « Buffer », « kit », « variante » dans un libellé ; rien ne bloque une vidéo ; aucun prix affiché ; privilégier le CLOUD pour les auteurs (ne pas saturer le PC).

**Organisation** : les sessions cloud écrivent, testent, poussent, ouvrent la PR et NE FUSIONNENT JAMAIS (`docs/REGLES-ROUTINES.md`). La session locale (orchestratrice, légère) relit, fait relire les zones sensibles, fusionne (`gh pr merge --squash`) et met en ligne. La CI GitHub ne lance vitest que sur certains dossiers : les tests du lot sont la preuve, rejoués par l'auteur.

**Pièges** : clone principal du PC partagé avec d'autres sessions → jamais de checkout dedans (worktree ou cloud) ; machine lente (vitest 80-120 s, délais de 5 s dépassés sous charge → `--testTimeout=60000`) ; le dépôt n'applique pas prettier (ne pas reformater) ; LF.
