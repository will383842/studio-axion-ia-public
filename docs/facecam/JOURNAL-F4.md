# Journal du lot F4 — Multicaméra du format avocat (09/10/2026)

Branche `feat/facecam-f4`, partie de `origin/feat/facecam` (réintégrée en cours de route, sans conflit).
Référence : `PLAN-FACECAM-v4.md`, `references/CATALOGUE-PLANS-CAMERA.md` (C7), décision de Will du 09/10.
**Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché.
Aucun appel réel n'a été fait (HeyGen, Higgsfield, Claude) : tout passe par des doubles de simulation.**

## Ce qui est fait
Le principe : Will tourne **une seule prise, de face**. Le studio fabrique avec son double HeyGen deux angles de plus,
**sur le même son** (même voix, même texte, même durée) :
1. de face, la prise d'origine ;
2. un peu de côté, à environ 35° ;
3. légèrement d'en bas, en contre-plongée douce (posture d'autorité).

Le montage passe d'un angle à l'autre comme sur un plateau à trois caméras.

| Fichier (tous nouveaux) | Rôle |
|---|---|
| `src/briques/multicamera/types.ts` | Les trois angles, le plan de caméra, la piste multicaméra (couche au-dessus des plans du format). |
| `src/briques/multicamera/realisation.ts` | **Réalisateur automatique (PUR).** Coupe au début d'une phrase ou d'une idée (blanc, virgule, mot de liaison, changement de bloc), toujours dans le blanc entre deux mots, jamais au milieu d'un mot. Rythme de 3 à 6 s par angle. Le sens décide de l'angle : de côté pour les explications, contre-plongée pour les phrases fortes (mots forts, chiffres, « ! », emphases, preuve). L'accroche reste de face, sur la prise d'origine. L'appel à l'action revient de face, d'un seul tenant. Jamais deux fois le même angle de suite quand un autre est disponible (choix optimal et déterministe). Les coupes tombent de préférence aux fins des plans de l'avocat. |
| `src/briques/multicamera/coherence.ts` | **Vérification (PUR).** Durée au mot près (écart ≤ 0,08 s), synchro labiale (≤ 40 ms), visage présent sur au moins 95 % des images. Un angle qui échoue est écarté et ses passages repartent de face. La face est toujours retenue. |
| `src/briques/multicamera/consigne.ts` | Consignes pour HeyGen. Un **look par angle**, créé une seule fois par double : même personne, mêmes vêtements, même décor, même lumière, seule la caméra bouge. Puis un **rendu sur le son de la prise** (`audio_url`), avec les gestes appris sur le look filmé (`reference_look_id`) et une clé d'idempotence stable. Repère aussi la consigne **« Monteur, fais-le en 3 caméras »** et ses variantes (une négation ne la déclenche jamais). |
| `src/briques/multicamera/fabrication.ts` | Fabrique les deux angles en parallèle : rendu, suivi, récupération, mesure, verdict. Elle ne lève jamais d'erreur : au pire, la vidéo reste à une seule caméra. |
| `src/briques/multicamera/avocat.ts` | Couche multicaméra de l'avocat. Option absente ou coupée : `null`. Les plans de l'avocat (zooms, cadrages, illustrations) ne sont pas touchés. Les sous-titres ne bougent pas, puisque le son est le même. |
| `src/briques/multicamera/reglage.ts` | Réglage caché **`avocat.multicamera`**, coupé par défaut. Il porte `actif`, `reel` (faux par défaut) et les looks par double. La lecture est tolérante : au moindre doute, l'option reste coupée. |
| `src/fournisseurs/multicamera/index.ts` | Fournisseur multicaméra. La version réelle enveloppe le fournisseur de visage HeyGen existant et un analyseur. Le **double de simulation est pris par défaut**. Le réel n'est choisi que sur demande explicite (`reel: true`) et seulement si le visage réel et l'analyseur sont fournis. |
| `src/services/multicamera-avocat.ts` | Lecture et écriture du réglage, et `passeMulticameraAvocat`, le point d'insertion. Option coupée : `null` et aucun appel. En réel, **aucun look n'est créé à la volée**, car ce serait une dépense : un angle sans look est écarté. |

**Prix.** Aucun prix n'est ajouté ni affiché. Un rendu réel devra passer par le mécanisme existant de confirmation et de crédits.

**Bandeau.** Aucun bandeau « nom · Axion-IA ».

## Fichiers communs touchés
**Aucun.** Le format avocat, son moteur, `fournisseurs/heygen`, les types du domaine et `studio-rendu` sont inchangés. Seuls des fichiers nouveaux ont été ajoutés.

## Tests (Vitest, simulation seulement)
- **`src/briques/multicamera/multicamera.test.ts`, 22 tests.**
  - Règles de coupe :
    - aucune coupe dans un mot ;
    - jamais le même angle deux fois de suite ;
    - rythme de 3 à 6 s ;
    - coupe au début d'une phrase ou d'une idée ;
    - accroche et appel de face, explications de côté, phrase forte en contre-plongée ;
    - résultat déterministe ;
    - coupes alignées sur les plans ;
    - texte sans ponctuation.
  - Repli :
    - avec un seul angle fabriqué ;
    - sans aucun angle ;
    - cohérence ;
    - les 5 types d'échec simulés (rendu, durée, synchro, visage, panne) ;
    - look absent ;
    - rendu sans fin.
  - Consignes HeyGen, « 3 caméras », réglage caché, couche avocat.
- **`tests/f4-multicamera-avocat.test.ts`, 7 tests.**
  - Option coupée : `null`.
  - La consigne Monteur donne 3 angles.
  - Un angle raté passe en repli ; deux angles ratés donnent la face seule.
  - Le réel n'est jamais choisi par défaut et aucun look n'est créé en réel.
  - L'avocat est inchangé : mêmes réglages visibles, même schéma.
- **Non-régression de l'avocat** : `src/moteurs/montage-avocat`, `src/briques`, `src/formats` et les tests avocat ou montage de `tests/`, tous verts (332 tests avant la fusion, 198 sur la sélection relancée après).
- **`tsc`** : aucune erreur dans les fichiers du lot. Les 13 erreurs déjà présentes ailleurs restent.
- **`eslint`** : propre sur les fichiers du lot.

## Ce qui reste
1. **Brancher la passe dans le moteur avocat** (session d'intégration). Le branchement passe par un paramètre facultatif ; sans lui, rien ne change :
   - pour une vidéo faite de prises filmées (`estPrisesFilmees`), appeler `passeMulticameraAvocat` après `decouper()` ;
   - ranger la piste dans `projetMontage.multicamera`.
2. **Composition (`studio-rendu`)** : lire `PisteMulticamera` et changer la source du visage aux instants des plans de caméra. Les zooms de chaque plan s'appliquent sur l'angle montré.
3. **Analyseur réel** (`AnalyseurAngle`) : une opération `studio-rendu` qui mesure, pour chaque angle :
   - la durée (ffprobe) ;
   - la synchro labiale (corrélation entre le son et l'ouverture de la bouche) ;
   - la présence du visage, sur environ 1 image par seconde.
4. **Monteur** : quand la phrase « Monteur, … » d'une prise avocat est reconnue par `estConsigneTroisCameras`, passer sa consigne à `consignes`.
5. **Préparation des looks**, une seule fois et avec l'accord de Will :
   - appeler `preparerLook` pour chaque angle à partir d'une image de la prise ;
   - ranger les identifiants dans `avocat.multicamera.looks[visageId]`.
6. **Coût réel** : faire passer les deux rendus par la ligne de coût et la confirmation déjà en place (`prix-reel.ts`, crédits).

## Ce que Will doit faire
1. **Créer son double HeyGen**, dans l'application HeyGen, avec le compte du studio :
   - un avatar filmé de face, dans la tenue et le décor de ses vidéos avocat ;
   - puis le relier dans le studio (Réglages › Doubles).
2. **Préparer les deux angles une fois.** À partir de ce double, créer un look « de côté (~35°) » et un look « légèrement d'en bas ». Il y a deux façons de le faire :
   - laisser le studio les demander, quand le branchement réel sera ouvert ;
   - ou les faire lui-même dans HeyGen avec les consignes de `CONSIGNE_LOOK_ANGLE`.

   Dans les deux cas : **mêmes vêtements, même décor**.
3. **Essai réel de 15 s par angle**, une fois ces looks prêts :
   - une phrase de 15 s rendue sur le même son ;
   - vérifier que les lèvres collent, que la durée est identique, que le visage est net et que la tenue et le décor sont les mêmes ;
   - puis seulement, mettre `reel: true` dans le réglage `avocat.multicamera`.
