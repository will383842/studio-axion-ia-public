# Calibrage du socle qualité · 18/10/2026

Branche `qualite/calibrage-socle`. Le socle (`src/domaine/qualite-script/`) reste en **mode observation** : rien ne bloque,
aucun appel à l'API Anthropic. Les interdits et les règles de positionnement de Will (PO-01, PO-02…) ne sont pas touchés.

## 1. Ce qui a été mesuré, et ses limites

- **Jeu d'essai** : `tests/qualite-script/fixtures-calibrage.ts`, 6 scripts courts **inventés** (aucun client réel ; toute ligne
  chiffrée porte le marqueur de preuve fictive `sourcee: true`). 3 bons (B1 devis, B2 factures, B3 recrutement : douleur,
  valeur, preuve, « on s'en occupe pour vous », un seul appel) et 3 mauvais (M1 tutoriel « faites-le vous-même », M2 annonce
  d'outil, M3 redites).
- Recette : « Écrire · avocat » (4,5 mots/s, durée visée 30 s), la voix de la chaîne équipe et de la chaîne courte.
- **Limite 1 : je n'ai pas les textes du banc du 17/10** (ils sont sur le serveur). Le constat porte sur mon jeu d'essai,
  pas sur les 10 scripts du banc. Les réglages ci-dessous sont à **revérifier sur les vrais textes** avant d'être tenus pour acquis.
- **Limite 2 : le « 30 à 53 sur 100 » ne vient pas du socle.** Le socle donne une note sur 10 par thème et un voyant ; il n'avait
  pas de note sur 100. La note /100 est celle de la chaîne (`noterVersion`, `notation-script.ts`), calculée sur les violations
  de `controlerVersion`. Je n'ai pas pu la reproduire sans les textes : cette note n'est pas modifiée ici. J'ai ajouté une
  note /100 du socle (`noteSur100`) pour pouvoir verrouiller la séparation.

## 2. Constat AVANT (règle × script)

Légende : ✓ ok · ✗ écart · ✗! écart d'une règle qui serait **bloquante** (rend le voyant rouge) · · non mesuré.
« Note /100 » : moyenne des 7 thèmes × 10.

| Règle | B1-devis | B2-factures | B3-recrutement | M1-tutoriel | M2-annonce-outil | M3-redites |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| AC-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-05 | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| AC-06 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| RT-01 | ✗! | ✗! | ✗! | ✗ | ✓ | ✓ |
| RT-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-06 | · | · | · | · | · | · |
| RT-07 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VA-01 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| VA-02 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| VA-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-03 | ✓ | ✓ | ✓ | · | ✗ | ✓ |
| PR-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PO-01 | ✓ | ✓ | ✓ | ✗! | ✓ | ✓ |
| PO-02 | ✓ | ✓ | ✓ | ✓ | ✗! | ✓ |
| PO-03 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| PO-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-04 | ✓ | ✓ | ✓ | · | · | · |
| DF-01 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| DF-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RP-01 | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Voyant** | rouge | rouge | rouge | rouge | rouge | ambre |
| **Note /100** | 97 | 97 | 97 | 80 | 70 | 77 |
| Durée (s) | 30.4 | 31.8 | 30.7 | 28.2 | 22.4 | 18.9 |

**Pourquoi les bons étaient rouges : une seule règle, RT-01.** Les trois bons n'ont qu'un écart : une phrase de 19 mots
(« Par exemple, dans un cabinet comptable fictif, la saisie est passée de huit heures à deux heures par semaine. »). Le refus
de RT-01 était à 18 mots et RT-01 est « bloquant » : **une seule phrase de 19 mots suffit à rendre un script par ailleurs
parfait rouge**, alors que le tutoriel M1 (cinq défauts) n'est rouge que par PO-01. Les autres pistes ne sont pas en cause
sur ce jeu :

| Hypothèse | Constat |
|---|---|
| Longueur des phrases (RT-01) | **Cause unique** des 3 bons rouges (refus à 18 mots, une phrase de 19). |
| Seuils de 1re phrase / accroche (AC-01 à AC-03) | Non en cause : 3 bons ✓ à 4,5 mots/s. À 2,9 mots/s (face caméra au téléprompteur) AC-02 échoue sur B2 et B3, mais c'est un débit plus lent, pas un seuil trop dur. |
| « Douleur dans les 3 premières secondes » trop littéral | Non en cause : AC-06 regarde les 40 % du script et accepte une douleur OU une curiosité. Défaut inverse : le tutoriel M1 passe AC-06 par un mot du lexique (faux positif à creuser, hors seuils). |
| Nombre de phrases / durée (DF-01) | Non en cause pour les bons (30 à 32 s). DF-01 attrape bien M2 (22 s) et M3 (19 s). |
| Règles qui s'annulent | Non : aucune règle contradictoire sur ce jeu. |
| Voyant trop binaire | **Oui, deuxième défaut** : M3 (redites, valeur 3/10, forme 3/10) restait « ambre », comme un script à 6/10, car seule une règle bloquante donnait rouge. |
| Note moyenne qui cache les trous | **Oui, troisième défaut** : M1 (positionnement 4/10 par PO-01) gardait 80/100 ; l'écart avec les bons n'était que de 17 points. |

## 3. Changements (tous des seuils ou des constantes de note, chacun commenté avec la valeur d'avant)

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `seuils.ts` `phraseRefusMots` | 18 | **22** | 22 mots ≈ 5 s à 4,5 mots/s, la durée d'une accroche entière. L'alerte de 14 mots est inchangée : de 15 à 22 mots la phrase reste signalée. L'image → vidéo garde 12 dans sa recette. |
| `seuils.ts` `SEUIL_THEME_AMBRE` | 7, en dur dans `rapport.ts` | 7, nommé | Aucun changement de valeur. |
| `seuils.ts` `SEUIL_THEME_ROUGE` | n'existait pas | **4** (un thème sous 4/10 = rouge) | Un script sans valeur ni preuve ou plein de redites n'est pas « ambre ». |
| `rapport.ts` `noteSur100` | n'existait pas | moyenne des thèmes et thème le plus faible, à parts égales | La moyenne seule cache un trou dans un thème. |

**À valider par Will** : le passage de 18 à 22 mots modifie un arbitrage adopté le 17/10 (audit § 2.3). Il repose ici sur un
jeu d'essai inventé. C'est une seule constante (`phraseRefusMots`) : facile à remettre à 18 si les vrais textes du banc
disent autre chose.

## 4. Constat APRÈS (même jeu, même recette)

| Règle | B1-devis | B2-factures | B3-recrutement | M1-tutoriel | M2-annonce-outil | M3-redites |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| AC-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AC-05 | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| AC-06 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| RT-01 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| RT-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RT-06 | · | · | · | · | · | · |
| RT-07 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VA-01 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| VA-02 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| VA-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-03 | ✓ | ✓ | ✓ | · | ✗ | ✓ |
| PR-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PO-01 | ✓ | ✓ | ✓ | ✗! | ✓ | ✓ |
| PO-02 | ✓ | ✓ | ✓ | ✓ | ✗! | ✓ |
| PO-03 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| PO-04 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-01 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-03 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-05 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LG-04 | ✓ | ✓ | ✓ | · | · | · |
| DF-01 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| DF-02 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RP-01 | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Voyant** | vert | vert | vert | rouge | rouge | rouge |
| **Note /100** | 89 | 89 | 89 | 60 | 50 | 54 |
| Thèmes /10 | 10·8·10·10·10·10·10 | 10·8·10·10·10·10·10 | 10·8·10·10·10·10·10 | 10·8·7·10·4·10·7 | 7·10·3·8·4·10·7 | 8·10·3·10·10·10·3 |

- Voyant : B1, B2, B3 **vert** ; M1, M2, M3 **rouge** (M1 par PO-01, M2 par PO-02, M3 par ses thèmes valeur et forme à 3/10).
- Note /100 : bons 89, 89 et 89 ; mauvais 60, 50 et 54 : **au moins 29 points d'écart** (89 contre le meilleur mauvais, 60).
- Le seul écart restant des bons est RT-01 en alerte (phrase de 15 à 19 mots), qui reste affichée comme conseil.
- Verrou : `tests/qualite-script/calibrage.test.ts` (bons jamais rouges, mauvais rouges, chaque bon au moins 20 points
  au-dessus de chaque mauvais, ordre préservé, PO-01 et PO-02 toujours bloquants, pastilles toujours « info »).

## 5. Ce qui reste ouvert

- Refaire cette mesure sur les 10 vrais scripts du banc (une fois les textes disponibles) : c'est la vraie validation.
- La note /100 de la chaîne (`noterVersion`) reste à examiner si elle est bien celle qui a donné 30 à 53.
- AC-06 laisse passer un tutoriel (lexique de douleur trop large) et RP-01 voit une « quasi-répétition » entre
  « Voici comment créer vos devis… étape par étape » et « Première étape : ouvrez… » : deux faux signaux à creuser, non traités.

## 6. Quasi-répétitions de la chaîne courte (correctif)

- **Vérifié** : le contrôle RP-01 (`repetitions.ts`, PR #368) voyait une phrase reprise à l'identique ou presque (mots pleins
  recouverts à 80 % ou plus), mais **pas** une phrase reprise en fin de script avec 2 ou 3 mots changés : son recouvrement
  tombe à 0,5 ou 0,6. Exemple : « Le délai d'envoi passe de plusieurs jours à une demi-journée. » puis, en fin de script,
  « … à quelques heures. » : aucune alerte, donc rien pour le relecteur (`CONSIGNE_COURT_RELECTURE` n'agit que sur les
  `<alertes_code>`).
- **Corrigé** : un second critère, sur l'ordre des mots (plus longue suite de mots communs ≥ 60 % de la phrase la plus longue
  et ≥ 75 % de la plus courte, plus courte d'au moins 6 mots). Les constantes sont dans `repetitions.ts` (`SEUIL_SEQUENCE`,
  `SEUIL_SEQUENCE_COURTE`, `MOTS_SEQUENCE_MIN`) ; les seuils d'avant (Jaccard 0,8, contenu 0,6) sont inchangés. Les refrains
  courts (moins de 6 mots) restent permis, et deux phrases de même gabarit mais de fond différent ne sont pas signalées.
- **Test de bout en bout** (exécuteur simulé, aucun appel) : `tests/generateur/chaine-courte-quasi-repetitions.test.ts`. La
  relecture reçoit l'alerte REPETITION, sa suppression de la redite est appliquée, la première phrase reste. Le test échoue
  sans le correctif (« - aucune » dans les alertes) et passe avec.
- **Limite constatée, non traitée** : `appliquerCorrections` (`chaine.ts`) ne supprime jamais un segment marqué `livraison`,
  `exception`, `ancrage` ou `preuve`. Si la redite tombe dans l'un d'eux, la suppression demandée par le relecteur est
  ignorée sans trace. À décider : demander au relecteur de supprimer l'autre occurrence.
