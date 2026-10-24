# Ordre de lancement et dépendances (carrousel continu)
Coller À CHAQUE ROUTINE : `00-REGLES-COMMUNES.md` puis la consigne du lot. Fusion UNE à la fois, après relecture `relecteur-qualite` (Opus).
1. **P0b** (session locale, pas une routine) : publier la maquette nettoyée → fusion. Sans elle, P1 et suivants n'ont pas la source visuelle.
2. **P1** → fusion → **P2** → relecture Opus → fusion.
3. Après P2 fusionné, vague A (6 en parallèle) : **P3a, P3b, P3c, P3d, P3h, P4**.
4. Vague B (dès qu'une place se libère) : **P3e, P3f, P4b, P5, P7**.
5. **P6** après P4 + P4b + P5 + P7 fusionnés.
6. **P3g** (vagues 1, 2, 3, l'une après l'autre) après P3a…P3f fusionnés ; en parallèle de P6.
7. **P8** quand tout est fusionné ET déployé par la session de déploiement (studio-rendu D'ABORD, puis le studio) sur le « oui, déploie » écrit par le commanditaire dans SA session. Le générateur reste éteint jusqu'à l'essai.
Conflits attendus : aucun sur les registres (un fichier par famille). Seul `VERSION_TOILE_SOCLE` peut entrer en conflit (P2, P4) : on garde le cran le plus haut + 1.
Fichiers EXISTANTS touchés (à signaler à la session de déploiement, qui les compare à `/opt/studio-axion-ia/remplacement serveur-texte.liste`) :
- P1 : `charte-carrousel.ts`, `visuel.ts`.
- P2 : `studio-rendu/src/contrat.ts`, `src/fournisseurs/types.ts`, `studio-rendu/src/index.ts`, `tests-visuels.yml`.
- P5 : `interrupteur.ts`, `reglages/carrousels/{page.tsx,actions.ts}`, `vues.ts`, `tests-visuels.yml`.
- P6 : `tests/visuels/garde-acces-carrousels.test.ts`, `src/app/(studio)/carrousels/page.tsx` (lien).
