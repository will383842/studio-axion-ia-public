# Calage des sous-titres (lot D3) — ce que disent les mesures

Mesures du 02/10 : `mesures.json` (outil `outils/alignement/mesurer_calage.py`), processeur seul, modèle wav2vec2
français de WhisperX.

## En une phrase

**Le calage marche (moins de 40 ms d'écart), mais sur la voix HeyGen il n'apporte rien : HeyGen est déjà juste à
≈ 20 ms.** Le « 190 à 270 ms » du lot M0b était une erreur de mesure, pas une erreur de HeyGen.

## Les chiffres

| Mesure | Mots | HeyGen tel quel | Calage (studio-aligneur) | WhisperX brut |
|---|---|---|---|---|
| Voix d'essai Windows, contre les débuts EXACTS des mots | 24 | — (pas de HeyGen) | **22,8 ms** | 155 ms |
| Voix HeyGen de Will (9 phrases), mots qui suivent une pause | 17 | **20,3 ms** | 39,1 ms (31,3 ms sans le recalage sur les blancs) | 99 ms (7 mots) |
| HeyGen et calage comparés sur tous les mots | 138 | débuts d'accord à 22 ms ; fins écartées de 81 ms | | |

Seuil du contrat (< 40 ms) : tenu deux fois (22,8 et 39,1 ms), de justesse sur la voix HeyGen.
La référence « reprise de la voix après une pause » a été contrôlée sur la voix d'essai : 11 ms d'erreur propre.

## Pourquoi le lot M0b avait trouvé 190-270 ms

Le lot M0b cherchait le début réel des mots avec un seuil de volume à −35 dB. Or la voix HeyGen de Will **respire fort
entre les phrases** (souffle à −17 dB) : ce seuil prenait le souffle pour le début du mot, et la fin d'un souffle pour
la fin d'un mot. L'écart venait de la règle de mesure. Mesuré proprement (reprise de la voix, son voisé), HeyGen place
ses débuts de mots à 20 ms près.

Seule vraie différence : les **fins** de mots. HeyGen les coupe ≈ 80 ms plus tôt que le calage (il s'arrête avant la
dernière consonne qui traîne). Pour des sous-titres mot à mot, c'est le début qui compte (le mot s'allume quand il est
dit) : sans effet visible.

## Ce qu'on en fait

- **Avec la voix HeyGen : laisser le calage coupé** (c'est le réglage par défaut : le conteneur n'est ni construit ni
  démarré tant que `STUDIO_ALIGNEUR_URL` n'est pas renseignée). Aucun gain, ≈ 1 Go de mémoire au repos, 2 à 5 s de
  calcul par phrase.
- **Le garder prêt** pour une voix qui arrive SANS horodatage fiable : la voix enregistrée au tournage, ou une autre
  voix de synthèse. Là, il fait 23 ms au lieu de « rien du tout ». Il s'allume en une variable, sans toucher au code.
- Coût des essais : 0,11 $ de voix HeyGen (phrases 6 à 9), relevé sur le solde (29,83 → 29,72 $). Aucune vidéo.

## Fichiers

- `mesures.json` : tous les chiffres, mot par mot.
- `6-mesure.*` à `9-mesure.*` : les 4 phrases écrites pour la mesure (son, horodatage HeyGen, coût relevé) ; les 5 du lot
  M0b sont dans `docs/captures/m0b-voix/`.
- `demo-m4-inchangee.json` : la démonstration M4 n'est pas touchée par ce lot.
