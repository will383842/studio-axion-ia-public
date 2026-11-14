# Relecture PR 523 (RC-14 : registre d'alertes unique) : À CORRIGER — fusion non en l'état, possible après 2 petits correctifs

Tête relue : `05a0930f` (usine/RC-14). Lecture seule ; mutations rejouées dans une copie jetable.

**Verdict : À CORRIGER.** Deux points, chacun corrigeable en quelques lignes : un faux vert sur date illisible (point 1) et une règle recopiée qui aggrave une garde existante (point 2). Le reste est conforme. **Fusion : non en l'état ; possible dès ces deux points corrigés** (avec un test pour le point 1).

## Points à corriger
1. `src/domaine/alertes/registre.ts:85` (alerte `visuel-manquant`) : une entrée du calendrier dont la date est **illisible** est silencieusement écartée de la fenêtre J..J+7. Rejoué : calendrier `[{ jour: "13/11/2026", aVisuel: false }, …entrées valides avec visuel]` → `visuel-manquant` = **ok** (faux vert). Attendu : « non évalué » dès qu'une entrée a une date illisible (ecartJours = null), sauf si un manque certain donne déjà « alerte ». Ajouter le test correspondant.
2. `src/domaine/alertes/jours.ts:4-9` : `JOUR_MS = 86_400_000` et le calcul du jour de Paris (`Intl.DateTimeFormat` Europe/Paris) sont **recopiés** alors qu'ils existent dans `src/lib/dates.ts:7` (`JOUR_MS`) et `src/lib/dates.ts:64` (`cleJour`, jour AAAA-MM-JJ à Paris, via `formateurDate`). Effet mesuré : la garde `tests/garde-regle-unique.test.ts` (« une règle chiffrée écrite une seule fois », déjà rouge sur master) passe de 8 à **9 copies** de `JOUR_MS` (nouvelle ligne fautive `src/domaine/alertes/jours.ts:4`). Correctif : importer `JOUR_MS` et `cleJour` de `@/lib/dates` (`jourParis = cleJour`) ; garder l'horloge injectée.

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
10. `pnpm install --frozen-lockfile` ok ; `vitest run tests/alertes` : 43/43 verts ; eslint propre sur les fichiers du lot ; `tsc --noEmit` : 146 erreurs, aucune dans les fichiers du lot (aucun fichier existant modifié, donc aucune nouvelle). Tests existants : les 45 fichiers de tests qui balaient `src/` (gardes de structure) rejoués sur master et sur la branche : **19 échecs identiques des deux côtés** (préexistants, hors PR) ; seule différence de contenu : la copie supplémentaire de `JOUR_MS` (point 2). Aucun test existant ne passe du vert au rouge. La suite complète (> 20 min dans ce conteneur) n'a pas été menée à son terme ; aucun fichier existant n'étant modifié ni importé par le lot, seules ces gardes pouvaient être touchées.

## Complément d'une seconde relecture (même tête 05a0930f, faite indépendamment)

Cette seconde relecture confirme le verdict **À CORRIGER, fusion non en l'état**, et le point 1. Elle ajoute les éléments suivants.

- **Point 1 élargi, `registre.ts:87-88`** : un `aVisuel` qui n'est pas un booléen (`"oui"`) n'est compté ni comme manquant ni comme inconnu, ce qui donne aussi un faux vert (`ok`, « tous les visuels sont présents »). Sonde rejouée. Le test à ajouter doit couvrir ce cas comme celui de la date illisible.
- **À corriger, `jours.ts:12-15` : date illisible acceptée par débordement.** `Date.UTC` accepte un mois 13 ou un 30 février : `"2026-13-45"` devient le 14/02/2027 et `"2026-02-30"` le 02/03/2026, au lieu de `null`. Conséquence : une échéance d'accès mal saisie peut être jugée `ok` au lieu de « non évalué ». Correctif : contrôle d'aller-retour (la date reformatée doit être égale à l'entrée).
- **Avis divergent sur `jours.ts:26` (`dansFenetre`)** : la borne `ecart <= n`, avec `n = SEUILS.visuelManquantJours`, est un seuil réglable du registre comparé hors de `evaluerSeuil`. La première relecture y voit une simple fenêtre de dates. Je la lis comme une seconde comparaison de seuil au sens strict du critère « UNE SEULE fonction de seuil ». À trancher : soit passer par `evaluerSeuil`, soit étendre le test de source (`rc-14-registre.test.ts:52-55`, qui ne lit que `registre.ts`) à `jours.ts`, en documentant l'exception.
- **Mineur, `registre.ts:152-157`** : un âge de sauvegarde négatif (`-5`) rend `ok`. Une valeur impossible devrait rendre « non évalué ».
- **Mutation supplémentaire** : retirer l'option `{ cloche: true }` du service fait rougir 1 test.
- **Non-régression, base plus large** : 393 fichiers ciblés (gardes qui parcourent `src`, plus les tests de notifications, alertes, push et seuils) passés sur la PR puis sur master. Résultat identique : les 57 mêmes fichiers en échec, 161 tests en échec des deux côtés, tous déjà présents sur master. La suite complète a dépassé la limite de 30 minutes et n'a pas été menée à terme.
