# Lot A — inventaire des blocages (décisions de Williams du 08/11/2026)

Relevé par grep (`throw`, statut échec, `erreur{code,messagePourWill}`, codes `SCRIPT_*`, `VOIX_*`, `BUDGET_*`, `PRIX_*`, `CONFIRMATION_*`) dans les services `boucle*`, la voix, le calage, le cas concret, la face caméra, image → vidéo, l'avocat et le tableau animé.
Décision : **levé** (remplacé par une remarque ou une réserve), **déjà levé** (avant ce lot), **gardé** (impossibilité technique, ou hors lot).

## Levés dans ce lot (cas concret, face caméra HeyGen)

| fichier:ligne | ce qui bloquait | décision appliquée |
|---|---|---|
| `src/moteurs/montage-cas-concret/script-fourni.ts:440` | script de Williams hors de 12 à 26 lignes / 3 à 7 étapes | remarque visible, le script passe |
| `src/moteurs/montage-cas-concret/script-fourni.ts` (accroche) | accroche de plus de 8 mots | remarque (de 9 mots) ; au-delà de 9 mots l'écran d'accroche ne tient plus : refus technique, dit en clair |
| `src/moteurs/montage-cas-concret/script-fourni.ts:464` + `regles.ts:1082` | durée totale, durée d'un écran, rythme, accroche, tutoiement | remarques (`REGLES_REMARQUES`) |
| idem | mots interdits (« machine », mots légaux), chiffres hors faits, faux témoignage, phrase de conformité, sigles | avertissements très visibles (`REGLES_AVERTISSEMENTS`), pas de blocage |
| `src/services/cas-concret-script-fourni.ts:54` | script plus long que celui « du prix » ; cas à script du catalogue fermé à « Mon script » | plus de refus : aucun prix dans le studio |
| `src/moteurs/montage-cas-concret/fabriquer.ts:605` | la fabrication rejouait R02 à R23 sur le script de Williams et s'arrêtait | rejeu tolérant : remarques et avertissements gardés sur la vidéo (alertes « Script : … ») |
| `src/moteurs/montage-cas-concret/script-valide.ts:87` | script « périmé » (autre version du cas) refusé ou réécrit par Claude | rejoué tel quel, écart montré en remarque |
| `src/moteurs/montage-cas-concret/index.ts:769` | contrôle final en défaut → travail en échec, vidéo jetée | vidéo livrée, terminée avec réserves : alertes « À vérifier · … » (gravité attention) |
| `src/moteurs/montage-cas-concret/voix.ts:429-460` | voix qui lit mal une phrase (hésitation, blanc, mot mal dit) → arrêt | dernière lecture gardée, phrase signalée (`corpsGardeMalgreRejet`) |
| `src/moteurs/montage-cas-concret/fabriquer.ts:804` | fin de voix coupée → arrêt « Relancez la voix » | réserve « À vérifier · Voix… », la vidéo continue |
| `src/moteurs/montage-cas-concret/fabriquer.ts:353` | part « voix » du prix dépassée → arrêt (hors mode indicatif) | plus d'arrêt ; seules les bornes de lectures (anti-boucle) restent |
| `src/services/videos-heygen.ts:91` | vidéo face caméra HeyGen « bien plus longue » que le texte → `VIDEO_TROP_LONGUE` | rattachée, remarque au journal : la durée est celle de Williams |

## Déjà levés avant ce lot (vérifiés)

| fichier | constat |
|---|---|
| `src/services/mode-budget.ts`, `credits.ts`, `budget-mensuel.ts` | mode « indicatif » par défaut : le prix du jour vaut accord, plus de `CONFIRMATION_REQUISE` ni de `BUDGET_DEPASSE` pour une commande de Williams |
| `src/briques/voix-maitre/machine.ts:273` | contrôle de ressemblance : la meilleure prise est retenue après les relances, aucun arrêt (voix épinglée non touchée) |
| `src/services/fabrication-reseaux.ts:637` | `CREDIT_INSUFFISANT` / `CLE_REFUSEE` / `BUDGET_DEPASSE` → attente (`lancementEnAttente`) puis reprise, pas un échec |

## Gardés (et pourquoi)

| point | pourquoi |
|---|---|
| Étiquette inconnue, ligne vide, ligne > 400 caractères, texte > 4000 caractères, > 26 lignes (`script-fourni.ts` lecture) | le script ne se lit pas / la fiche d'écrans a un format fixe |
| Moins de 3 étapes, accroche > 9 mots, « bascule » manquante, chiffre qui ne vient d'aucun fait du cas (écran « chiffre » sans fait) | le schéma de la fiche ne peut pas se mettre en page sans cela |
| Marque, visuels connus, ordre du fonctionnement, appel dans le corps (R04, R07 à R09, R18, R19, R23) | règles de structure, non citées par les décisions |
| Calage quand le texte lu ne correspond plus du tout au texte écrit (`fabriquer.ts` étape calage) | alignement impossible : reste à faire (calage tolérant) |
| Commandes de l'Usine (`BUDGET_USINE_ABSENT`, `BUDGET_MENSUEL_ATTEINT`) | garde de l'Usine, sécurité : hors lot |
| Mode budget « bloquant » (réglage `budget.mode`) | retiré du défaut depuis le 23/10 ; le supprimer demande de réécrire ≈ 44 tests de l'ancien mode (voir « Reste à faire ») |

## Reste à faire (hors de cette PR)

- Pose « Image → vidéo » : non trivial (service `image-video-*`, voix propre `montage-image-video/voix.ts:502,562`), non touchée.
- Boucle d'écriture (`boucle-generation.ts`), avocat, tableau animé : blocages budget/confirmation déjà neutralisés en mode indicatif ; les arrêts d'écriture et de validation (`LIMITE_A_VALIDER`, `A_VALIDER`) n'ont pas été revus.
- Retirer définitivement le mode « bloquant » (`modeBudget()` → toujours indicatif) et l'arrêt de sécurité à 5 × (`mode-budget.ts`, `comite-editorial.ts`, `image-video`).
- Retirer l'affichage des prix : 56 fichiers de l'interface en parlent encore (liste figée dans `tests/lot-a/prix-interface-restants.json`, test cliquet `tests/lot-a/aucun-prix-interface.test.ts`).
- Les avertissements et réserves sont dans `noteQualite.alertes` (fiche vidéo) ; la page « Mon script » les affiche. Aucune autre vue n'a été remaniée.
