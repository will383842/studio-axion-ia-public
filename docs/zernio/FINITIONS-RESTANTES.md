# Finitions Zernio restantes

> **FIN-ZERNIO (traité)** : les trois lignes du tableau ci-dessous sont faites (présélection traduite par outil, message de doublon sans détail technique, sortie « Marquer comme vérifié »). Tests : `tests/zernio/fin-zernio-finitions.test.ts`.

Points relevés par les relectures (#154 à #162) et les restes Z2-S / Z4 qui exigent de toucher à un fichier réservé à une autre PR : `src/services/publications.ts` et `src/services/buffer.ts` (PR #163, P3-A), ou les fichiers de la PR #164 (Z3-E). Chacun est à traiter dans un tour ultérieur, une fois ces PR fusionnées. Numéros de ligne relevés sur `master` au moment de la finition.

| Fichier | Ligne | Ce qui est à faire | PR d'origine |
|---|---|---|---|
| `src/services/publications.ts` | ~l. 652 | Le groupe Zernio de la façade reçoit `options.comptes`, qui sont des canaux Buffer : refus `CIBLE_INCONNUE` dès qu'un compte est présélectionné. Refus sûr, à traiter en traduisant la présélection par outil. | Z2-E (#159), mineur 7 |
| `src/services/publications.ts` | ~l. 975 | Le message de refus net pour un doublon (`incertain: true`) reste générique ; vérifier à l'écran que `detailTechnique` (déjà passé par `masquerSecret`) ne devient jamais visible. | Z2-E (#159), 2e tour, mineur 4 |
| `src/services/buffer.ts` | ~l. 313-318 | Plusieurs pages du même compte : l'envoi reste « à vérifier » sans fin. Le journal l'annonce ; prévoir une notification ou une sortie manuelle (« Marquer comme vérifié ») pour ne pas laisser l'envoi bloqué. | Z2-E (#159), 2e tour, mineur 3 |
| `src/components/publication/LignesAPublier.tsx`, `src/app/(studio)/a-publier/**`, `src/services/a-publier-zernio.ts` (PR #164) | — | Rien relevé par les relectures traitées ici ; aucun fichier de la PR #164 n'a été touché. | — |

## Points relevés mais non retenus

- #154, 2e tour : lier l'hôte des `mediaItems[].url` à celui du `publicUrl` de presign. À décider avec Z1-P ; le risque est faible, l'adresse est déjà en https sans identifiants.
- #158, 5 : la lecture des brouillons est déjà paginée (`listerTousLesPosts`) dans `master`. Rien à faire.
