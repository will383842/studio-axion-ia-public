# Calibrage des contrôles de compréhension · lot F · 19/10/2026

Branche `scripts/lot-f-calibrage`. **Aucun appel payant** (ni Anthropic ni HeyGen), aucun réglage allumé, **aucun niveau changé** :
passer une alerte en bloquant est une décision de Will, ce document ne fait que la recommander. Le code des contrôles n'est pas
modifié (aucun bug prouvé par un test rouge). Rien sur l'avocat. Les chiffres viennent de l'EXÉCUTION des contrôles
(`tests/verif-finale/calibrage-comprehension-mesure.ts`), figés par `tests/verif-finale/calibrage-comprehension.test.ts`.
Suite de `CALIBRAGE-SOCLE-2026-10-18.md` et `CALIBRAGE-RESSEMBLANCE-2026-10-18.md` (lus ; leurs mesures sont rejouées en §6).

## 1. Les contrôles mesurés (codes réels)

| Famille | Code | Où | Niveau actuel (machine) |
|---|---|---|---|
| Version | **C95** positionnement (« faites-le vous-même », annonce d'outil) | `controles-script/positionnement.ts` | **bloquant** (Will : info) |
| Version | **C96** tutoriel pas à pas | `controles-script/recette.ts` | alerte (Will : info) |
| Version | **C97** question au spectateur (absente, après 40 %, plus de 2) | idem | alerte |
| Version | **C98** la dernière phrase du corps redit l'accroche (≥ 3 racines) | idem | alerte |
| Version | **C99** rupture « on s'en occupe pour vous » absente | idem | alerte |
| Tableau (lot B1) | `positionnement`, `etape-imperatif` (tutoriel), `promesse-nombre`, `question-spectateur`, `redit-accroche` | `scripts-tableau-controles.ts` | `positionnement` et `etape-imperatif` **éliminatoires** ; les 3 autres : remarque |
| Tableau (lot B2b) | `densite-scene` (> 22 mots d'une scène), `ecran-redit` (écran ≥ 80 % des mots dits) | idem | remarque |
| Ressemblance | C1 `comparerScripts` (copie, paraphrase ; le moule n'est qu'un signal) | `domaine/ecriture-commune/ressemblance.ts` | non branché (C2-C4 branchent, réglages coupés) |

## 2. Les témoins (tous déjà dans le dépôt, sauf 7 textes écrits à la main pour ce lot)

Version (71 témoins bons, en 3 groupes, car C97 et C99 EXIGENT un élément et ne se jugent que sur des textes écrits selon la recette) :

1. **Conformes à la recette (6)** : témoins A et B de `tests/domaine/controles-recette.test.ts` ; R1 à R4 écrits à la main (plombier, cabinet, boutique, transporteur) : question avant 40 %, rupture dans le dernier segment, un appel.
2. **Bons du socle et du tableau (5)** : texte dit du témoin v5 (`tests/tableau-scripts/exemples-v5.ts`), B1-B3 (`fixtures-calibrage.ts`), BON (`tests/qualite-script/aide.ts`). Bons selon Will, mais sans question (C97) ou avec la rupture ailleurs que juste avant l'appel (C99) : ces deux contrôles y lèvent **à juste titre**, donc ces cinq textes ne comptent que pour C95, C96, C98.
3. **Hors recette (60)** : `tests/ecriture-commune/corpus-60.ts` (scripts honnêtes, écrits à la main, 1re phrase = accroche, dernière = appel). Pour C95, C96, C98 seulement.

Tableau (4 bons) : le témoin v5 (déclaré conforme) + 3 scripts écrits à la main selon D1 (relance de devis, planning, factures), et 6 **anciens** (v3 ×4, v4, script du 15/10), lus mais NON comptés comme bons (ils datent d'avant D1 : tutoriel, pas de question).
Docs/formats n'apporte pas de script chiffré exploitable ici (le tableau-anime-scripts est la source des exemples ci-dessus ; les `docs/formats/*` d'image→vidéo sont des storyboards, pas des textes dits de la recette).

Légende : `✗` le contrôle se lève · `·` il ne se lève pas.

## 3. Règle × témoin : version

| Témoin | Groupe | C95 | C96 | C97 | C98 | C99 |
|---|---|:-:|:-:|:-:|:-:|:-:|
| A | 1 recette | · | · | · | · | · |
| B | 1 recette | · | · | · | · | · |
| R1-plombier | 1 recette | · | · | · | · | · |
| R2-cabinet | 1 recette | · | · | · | · | · |
| R3-boutique | 1 recette | · | · | · | · | · |
| R4-transport | 1 recette | · | · | · | · | · |
| v5-01 | 2 socle/tableau | · | · | · | · | ✗ |
| B1-devis | 2 socle/tableau | · | · | ✗ | · | ✗ |
| B2-factures | 2 socle/tableau | · | · | ✗ | · | ✗ |
| B3-recrutement | 2 socle/tableau | · | · | ✗ | · | ✗ |
| BON | 2 socle/tableau | · | · | ✗ | · | ✗ |
| 60 du corpus | 3 hors recette | 0/60 | 0/60 | 55/60 | 0/60 | 60/60 |

Lecture : sur les 6 textes conformes à la recette, **aucun** des 5 contrôles ne se lève. Sur les 71 bons, C95 / C96 / C98 : **0 déclenchement**. Sur le corpus de 60 : C97 se lève 55 fois et C99 60 fois, **ce n'est pas un faux positif** (ces textes ne posent pas de question valable et ne disent pas « on s'en occupe pour vous » juste avant l'appel : ils ne suivent pas la recette).

## 4. Règle × contre-exemple : version

Chaque contre-exemple est un témoin conforme (A ou B) abîmé d'UN seul défaut, écrit à la main.

| Contre-exemple | Défaut | Attendu | Levés | Résultat |
|---|---|:-:|---|:-:|
| c95-a | conclusion « faites-le vous-même » | C95 | C95, C99 | ✓ vu |
| c95-b | « testez-le vous-même » | C95 | C95, C99 | ✓ vu |
| c95-c | annonce d'outil (« nouvel outil ») | C95 | C95, C99 | ✓ vu |
| c96-a | deux consignes numérotées | C96 | C95, C96 | ✓ vu |
| c96-b | trois impératifs en tête de phrase | C96 | C96 | ✓ vu |
| c97-a | aucune question au spectateur | C97 | C97 | ✓ vu |
| c97-b | question posée trop tard (après 40 %) | C97 | C97, C99 | ✓ vu |
| c97-c | plus de deux questions | C97 | C97 | ✓ vu |
| c98-a | la dernière phrase du corps redit l'accroche (accroche de 3 racines ou plus) | C98 | C98, C99 | ✓ vu |
| c99-a | aucune rupture « on s'en occupe pour vous » | C99 | C99 | ✓ vu |
| c99-b | « c'est coûteux pour vous » (pas de verbe « on… ») | C99 | C99 | ✓ vu |
| c99-c | rupture dite trop tôt (milieu du corps), plus dans le dernier segment | C99 | C99 | ✓ vu |
| c98-limite | accroche à 2 racines (« Un client appelle. ») redite mot pour mot en fin de corps | C98 | C99 | ✗ raté |

- **Faux négatif constaté (limite connue) : `c98-limite`.** C98 exige 3 racines communes (mots de 4 lettres ou plus, hors mots vides). Une accroche courte comme « Un client appelle. » n'en porte que 2 : la redire mot pour mot en fin de corps ne lève rien. Ce n'est pas un bug (le seuil est voulu : trois racines évitent de signaler les reprises du mot-clé) mais une zone aveugle ; le test la fige (`LIMITES_CONNUES`).
- Un « effet de bord » à connaître : un contre-exemple de C95 ou de C97 lève aussi C99 (la rupture a été supprimée ou déplacée avec la fin) ; c'est cohérent.

## 5. Règle × témoin et contre-exemple : tableau

| Témoin | Statut | positionnement | etape-imperatif | promesse-nombre | question-spectateur | redit-accroche | densite-scene | ecran-redit |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| v5-01 | bon | · | · | · | · | · | · | · |
| main-relance | bon | · | · | · | · | · | · | · |
| main-planning | bon | · | · | · | · | · | · | · |
| main-factures | bon | · | · | · | · | · | · | · |
| v3-01-formation | ancien (avant D1) | · | · | · | ✗ | · | ✗ | ✗ |
| v3-02-audit | ancien (avant D1) | · | · | · | ✗ | · | ✗ | · |
| v3-03-automatisations | ancien (avant D1) | · | · | · | ✗ | · | ✗ | · |
| v3-04-coaching | ancien (avant D1) | · | · | · | ✗ | · | ✗ | · |
| v4-01-formation | ancien (avant D1) | · | ✗ | ✗ | ✗ | · | ✗ | ✗ |
| 1510 | ancien (avant D1) | · | · | ✗ | ✗ | · | ✗ | · |

Les anciens (v3, v4, 15/10) lèvent `densite-scene` (constats de plus de 22 mots) et `question-spectateur` : vrai, ils datent d'avant D1 (aucune question, constats longs) ; v4 lève aussi `etape-imperatif` et `promesse-nombre` (le tutoriel numéroté que D1 a supprimé). Aucun n'est compté comme faux positif.

Les trois scripts écrits à la main ont d'abord levé `ecran-redit` (j'avais écrit des écrans qui recopiaient le début de la phrase dite, par ex. « Chez vous, qui sait ? » pour « Chez vous, qui sait ce qui reste dû ? » = 4 mots uniques sur 5 retrouvés). Le contrôle avait raison : corrigés, ils sont propres. Ce n'est pas compté comme faux positif (le défaut était réel), mais cela montre que la règle des 80 % attrape aussi des écrans « tronqués », pas seulement des copies exactes.

Contre-exemples (le témoin v5 abîmé d'UN défaut) :

| Contre-exemple | Défaut | Attendu | Levés | Éliminatoire ? | Résultat |
|---|---|:-:|---|:-:|:-:|
| tp-a | la fin dit « faites-le vous-même » | positionnement | positionnement | oui | ✓ vu |
| tp-b | la fin annonce un outil (« nouvel outil ») | positionnement | positionnement | oui | ✓ vu |
| ti-a | un constat à l'impératif adressé au spectateur | etape-imperatif | etape-imperatif | oui | ✓ vu |
| ti-b | un impératif dans le commentaire du constat | etape-imperatif | etape-imperatif | oui | ✓ vu |
| tn-a | la promesse annonce un nombre d'étapes | promesse-nombre | promesse-nombre | non | ✓ vu |
| tq-a | aucune question au spectateur | question-spectateur | question-spectateur | non | ✓ vu |
| tr-a | « à retenir » redit l'accroche | redit-accroche | redit-accroche | non | ✓ vu |
| td-a | un constat de plus de 22 mots d'une traite | densite-scene | densite-scene | non | ✓ vu |
| te-a | l'écran redit la phrase dite | ecran-redit | ecran-redit | non | ✓ vu |

## 6. Ressemblance C1 et socle qualité (mesures déjà faites, rejouées)

| Mesure | Résultat |
|---|---|
| Refus à tort, corpus de 60 contre les 59 autres | **0 / 60** (borne 95 % : 5 %) |
| Refus à tort, 12 paires honnêtes (« différentes » + « moule propre ») | **0 / 12** (borne 95 % : 25 %) |
| Reprises vues (8 copies, 6 paraphrases, 4 moules) | **18 / 18** |
| Socle qualité (fixtures de calibrage) : bons non rouges / mauvais rouges | 3 / 3 et 3 / 3 |

## 7. Synthèse et RECOMMANDATIONS

**Règle de recommandation (fixée avant la mesure)** : « peut devenir bloquant » seulement si **0 faux positif** sur les témoins bons ET **0 faux négatif** sur les contre-exemples ET borne haute à 95 % du taux de faux positifs ≤ 10 % (règle des trois : 0 sur n donne 3/n ; il faut donc n ≥ 30 témoins bons) ET **au moins 5 contre-exemples** avant de proposer un passage en bloquant. Sinon « reste en alerte ». FP = faux positifs, FN = faux négatifs.

| Contrôle | Faux positifs | Faux négatifs | Recommandation |
|---|---|---|---|
| **C95** positionnement | 0 / 71 (borne 4 %) | 0 / 3 | **Déjà bloquant : à maintenir** (aucun bon refusé) |
| **C96** tutoriel | 0 / 71 (borne 4 %) | 0 / 2 | **Reste en alerte tant qu'il y a moins de 5 contre-exemples** (2 aujourd'hui) ; chiffres par ailleurs compatibles avec bloquant ; contrôle déjà en information pour un texte de Will |
| **C97** question | 0 / 6 (borne 50 %) | 0 / 3 | **Reste en alerte** : 6 témoins conformes seulement ; il en faudrait 30 |
| **C98** fin qui redit l'accroche | 0 / 71 (borne 4 %) | **1 / 2** (accroche à 2 racines non vue) | **Reste en alerte** : un faux négatif connu |
| **C99** rupture | 0 / 6 (borne 50 %) | 0 / 3 | **Reste en alerte** : 6 témoins ; et la formulation du témoin v5 (« Axion-IA met cette fiche en place pour vous », sujet nommé) n'est PAS reconnue par `ruptureDite` (motif « on… » / « nous… ») : bloquer ferait refuser à tort un script écrit comme le témoin v5 s'il passait par ce contrôle |
| `positionnement` (tableau) | 0 / 4 | 0 / 2 | **Déjà éliminatoire : à maintenir** (échantillon de 4 : à surveiller) |
| `etape-imperatif` (tableau) | 0 / 4 | 0 / 2 | **Déjà éliminatoire : à maintenir** (idem) |
| `promesse-nombre` | 0 / 4 (borne 75 %) | 0 / 1 | **Reste en alerte** (4 témoins) |
| `question-spectateur` | 0 / 4 (borne 75 %) | 0 / 1 | **Reste en alerte** (4 témoins ; les 6 anciens la lèvent, ce qui est exact) |
| `redit-accroche` | 0 / 4 (borne 75 %) | 0 / 1 | **Reste en alerte** (4 témoins) |
| `densite-scene` | 0 / 4 (borne 75 %) | 0 / 1 | **Reste en alerte** (4 témoins ; seuil 22 mots non mesuré sur de vrais scripts) |
| `ecran-redit` | 0 / 4 (borne 75 %) | 0 / 1 | **Reste en alerte** (4 témoins ; attrape aussi les écrans tronqués, voir §5) |
| Ressemblance C1 | 0 / 60 (borne 5 %) | 0 / 18 | **Chiffres compatibles avec bloquant**, mais le contrôle n'est pas branché (réglages C2-C4 coupés) et le corpus est synthétique : à décider après un banc sur de vrais scripts |

Résumé : aucun contrôle ne remplit les quatre conditions pour un nouveau passage en bloquant : **C96** n'échoue que sur le nombre de contre-exemples (2 sur 5 requis) et **C95** (déjà bloquant, à maintenir) en a 3. Les autres échouent sur la **taille de l'échantillon** (C97, C99 et les 5 contrôles du tableau en alerte : trop peu de témoins conformes, 4 à 6) ou sur un **faux négatif connu** (C98). Pour débloquer : constituer 30 scripts conformes à la recette (idéalement de vrais scripts validés par Will) et rejouer `calibrage-comprehension.test.ts`.

## 8. Limites honnêtes

- Les témoins sont des textes du dépôt ou écrits à la main : ordre de grandeur, pas une garantie. Je n'ai pas les textes du banc du 17/10 (sur le serveur).
- Les 7 textes écrits à la main pour ce lot (R1-R4, 3 scripts du tableau) ont été écrits en connaissant les règles : ils sont plus « propres » que de vrais scripts, donc les faux positifs sont plutôt sous-estimés.
- Les contre-exemples sont des défauts isolés ; en vrai les défauts se mêlent. Les faux négatifs sont donc plutôt sous-estimés eux aussi.
- Aucune autre limite de `CALIBRAGE-SOCLE` n'est levée ici (note /100, RT-01 en écart sur les 3 bons).
