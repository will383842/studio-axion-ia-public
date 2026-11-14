# Relecture PR 523 (RC-14 : registre d'alertes unique) : À CORRIGER (mineur), fusion possible après un petit correctif

Tête relue : `05a0930f` (usine/RC-14). Lecture seule ; mutations rejouées dans une copie jetable.

**Verdict : À CORRIGER.** Un seul point bloquant au regard du critère « jamais un faux vert » (point 1 ci-dessous), correctif de quelques lignes. Tout le reste est conforme. Fusion possible dès ce point corrigé (et un test ajouté).

## Points à corriger
1. `src/domaine/alertes/registre.ts:85` (alerte `visuel-manquant`) : une entrée du calendrier dont la date est **illisible** est silencieusement écartée de la fenêtre J..J+7. Rejoué : calendrier `[{ jour: "13/11/2026", aVisuel: false }, …entrées valides avec visuel]` → `visuel-manquant` = **ok** (faux vert). Attendu : « non évalué » dès qu'une entrée a une date illisible (ecartJours = null), sauf si un manque certain donne déjà « alerte ». Ajouter le test correspondant.

## Remarques (non bloquantes)
- `registre.ts:69` (trous J+7/J+2) : une date illisible est aussi ignorée ; ici l'effet est prudent (au pire une alerte de trou de trop, jamais un faux vert). Envisager « non évalué » si une date est illisible, par cohérence.
- `registre.ts:89` : `evaluerSeuil(sans, { seuil: 1 })` est appelé alors que `sans >= 1` est déjà acquis par le `if` : passage formel par la fonction unique, résultat toujours « alerte ». Acceptable.
- `src/services/alertes.ts:35` : `import("./notifications")` dynamique ; notifications.ts importe le module push, mais avec `{ cloche: true }` `creerNotification` ne crée aucune file d'envoi (`envoi` undefined, notifications.ts:87) : push n'est jamais appelé. Conforme.
- Le test de source (« aucune comparaison `[<>]=? chiffre` ») ne couvre que registre.ts, pas services/alertes.ts (aujourd'hui sans seuil : ok).
- Seuil d'échéance d'accès à 14 jours : choix de l'auteur, signalé « à faire valider » dans le journal. À trancher.
- Sauvegarde ≥ 36 h : identique à `deploiement/surveiller.sh:63` (`-ge 36`). Règle reprise, pas de code partagé (script shell) : acceptable.

## Vérifications
1. Fichiers : exactement les 6 attendus (seuil, jours, registre, services/alertes, test, journal) ; seuils-echelle.ts absent. OK.
2. Fonction de seuil unique : `evaluerSeuil` (seuil.ts:13) ; aucune autre comparaison de seuil dans le diff (les comparaisons de jours.ts:26 sont une fenêtre de dates, pas un seuil d'alerte). OK.
3. « Non évalué » : null / undefined / NaN / Infinity / chaîne / fonction qui lève → « non-evalue » (rejoué, y compris `quotaPourcent: () => "85"`). Exception : point 1. Limites testées : quota 79/80/81, J+7 et J+2 (J+1, J+3, J+8 ne comblent pas), échéance 14/15/−1, sauvegarde 35/36/37.
4. Horloge injectée (`Horloge`), aucun `Date.now` ni `new Date()` dans src ; jour lu à Paris (`Intl` Europe/Paris), testé à 23 h 30 UTC. OK.
5. Push : aucun import de push.ts dans le lot ; cloche seulement ; notifications.ts et ClocheNotifications.tsx non modifiés ; aucune écriture réseau. OK.
6. Jetons / quota Zernio : seulement lus via fonctions injectées, rien calculé ; aucun fichier zernio*, parcours-*, mots-* touché. OK.
7. Aucune suppression de données de personnes. OK.
8. Mutations (copie jetable) : seuil 80→81 : 1 test rouge ; « non-evalue » → « ok » dans seuil.ts : 5 rouges ; NON_EVALUE → ok dans registre.ts : 8 rouges ; import + appel de `envoyerPush` dans le service : 1 rouge. Restauré : 29/29 verts. OK.
9. Aucun `.skip` / `.only`, aucun nom de personne dans le diff. OK.
10. `pnpm install --frozen-lockfile` ok ; `vitest run tests/alertes` : 43/43 verts ; eslint propre sur les fichiers du lot ; `tsc --noEmit` : 146 erreurs, aucune dans les fichiers du lot (aucun fichier existant modifié, donc aucune nouvelle). Suite complète : voir ci-dessous.
