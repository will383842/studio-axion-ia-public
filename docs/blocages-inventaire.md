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

## Levés dans le lot H (08/11/2026)

| point | décision appliquée |
|---|---|
| Mode budget « bloquant » (`budget.mode`, `STUDIO_BUDGET_MODE_DEFAUT`) | supprimé : `modeBudget()` rend toujours « indicatif » ; ni réglage ni variable ne le rétablit. Les anciens tests de ce mode sont réécrits (la fabrication part sans arrêt) |
| Arrêt de sécurité à 5 × (`budget-mensuel.ts` `jugerPlafond`, `comite-editorial.ts`) | retiré : le dépassement prévient (journal, cloche), la fabrication continue |
| Confirmation de prix « Montage réel », `confirmationRequise` de l'aperçu | plus aucune confirmation : `confirmationRequise` vaut toujours faux, l'accord du prix du jour est automatique |
| Interface : prix, budget, plafond, « € » (56 fichiers de `tests/lot-a/prix-interface-restants.json`) | retirés des écrans ; la liste est vide, le test « cliquet » reste vert. Aucun fichier n'était un tarif de produit vendu à un client |
| Calage : texte lu ≠ texte écrit (`calage.ts`, `fabriquer.ts`) | la meilleure lecture est gardée (resynchronisation sur le mot suivant), les mots en cause partent en réserves « À vérifier · Calage · … » ; la vidéo n'est plus jetée |
| `LIMITE_A_VALIDER` (boucle d'écriture, séries, `generateur-ecran`) | remarque au journal, la fabrication continue |
| `A_VALIDER` (version non validée) | remarque au journal, la fabrication continue avec le texte de Williams |
| `SCRIPT_A_CORRIGER` (phrase signalée « bloquant » au relu) | remarque au journal |
| Liens `/reglages#budget` des notifications | pointent sur `/reglages` (la section budget n'existe plus) |

## Gardés (et pourquoi)

| point | pourquoi |
|---|---|
| Commandes de l'Usine (`BUDGET_USINE_ABSENT`, `BUDGET_MENSUEL_ATTEINT`, origine « usine ») | garde de l'Usine, sécurité : hors lot |
| Plafonds anti-boucle (lectures de voix, retouches), idempotence des réservations | ce ne sont pas des prix : ils évitent une boucle infinie |
| Solde réel HeyGen / ElevenLabs, crédit Claude épuisé, clé refusée | impossibilité technique ; mise en attente puis reprise automatique (`lancementEnAttente`) |
| `SCRIPT_A_RELIRE` / `SCRIPT_NON_RELU` (empreinte du script différente de celle relue) | cohérence technique : le texte a changé sous la relecture ; on ne peut pas savoir lequel fabriquer |
| `STOCKAGE_NON_RELIE` / `STOCKAGE_REFUS` (tableau animé) | fichier ou service injoignable : la vidéo ne peut pas partir |
| Étiquette inconnue, ligne vide, ligne > 400 caractères, texte > 4000 caractères, > 26 lignes (`script-fourni.ts`) | le script ne se lit pas / la fiche d'écrans a un format fixe |
| Moins de 3 étapes, accroche > 9 mots, « bascule » manquante, chiffre sans fait (écran « chiffre ») | le schéma de la fiche ne peut pas se mettre en page sans cela |
| Voix sans aucun mot entendu (calage) | rien à caler : impossibilité technique |
| Marque, visuels connus, ordre du fonctionnement, appel dans le corps (R04, R07 à R09, R18, R19, R23) | règles de structure, non citées par les décisions |

## Reste à faire

- Pose « Image → vidéo » : non trivial (service `image-video-*`, voix propre `montage-image-video/voix.ts:502,562`), non touchée par le lot H. Les écrans ont perdu leurs prix, mais ses arrêts d'écriture/validation (`IV_CARTE_A_VALIDER`, `IV_SCRIPT_A_VALIDER`, `SCRIPT_PAS_A_VALIDER`) sont des étapes de validation de son parcours, à revoir avec la mission « image-vidéo ».
- Avocat : ses arrêts budget/confirmation sont levés avec le mode indicatif ; ses codes d'écriture/validation propres n'ont pas d'arrêt supplémentaire hors `SCRIPT_A_RELIRE` (gardé ci-dessus).
- Le cliquet ne voit que les chaînes littérales : quelques montants fournis par les services (ligne « Déjà payé » du suivi du cas concret, etc.) peuvent encore s'afficher ; à traiter si Williams les voit.
- Les avertissements et réserves sont dans `noteQualite.alertes` (fiche vidéo) ; la page « Mon script » les affiche.
