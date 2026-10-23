# Calibrage de la ressemblance commune (lot C1.5, 18/10/2026)

Mesure faite sur `tests/ecriture-commune/paires.ts` : 30 paires (ancien, nouveau) étiquetées à la main, jouées par
`comparerScripts` (copie + paraphrase + moule, seuils inchangés : copie 5 mots, paraphrase Jaccard 0,6 / 4 mots pleins,
moule fenêtre 6 / 3 outils dont 2 forts / 2 trous). Test : `tests/ecriture-commune/calibrage.test.ts`.

| Groupe | Paires | Verdict « ressemble » | Lecture |
|---|---|---|---|
| Copies | 8 | 8 | rien de raté |
| Paraphrases | 6 | 6 | rien de raté |
| Moules repris (même patron, sujet changé) | 4 | 4 sur 4 (par copie, 3 à 8 charpentes en signal) | rien de raté |
| Différents, même thème | 6 | 0 | aucun faux positif |
| Charpentes courantes, sujets autres (« moule propre ») | 6 | 1 avec l'ancienne règle (`n4`), 0 depuis la correction ci-dessous | voir ci-dessous |

## Correction après relecture : le 17 % est un taux PAR PAIRE, pas le taux réel en service

- Le « 1 sur 6, soit 17 % » du moule est mesuré **par paire** (un script contre UN ancien). En service, chaque script est comparé à
  **60 anciens** : la probabilité qu'une charpente courante se retrouve quelque part est bien plus forte, donc le taux par paire ne
  dit pas le taux réel.
- Mesure en service : corpus de 60 scripts honnêtes (`tests/ecriture-commune/corpus-60.ts`, écrits à la main ; le catalogue de code
  n'en porte qu'un), chaque script retiré à son tour et comparé aux 59 autres. Avec l'ancienne règle (moule = refus) :
  **2 refus à tort sur 60 (3 %)**, tous deux dus au moule seul (0 par copie, 0 par paraphrase). Limite : corpus synthétique, ordre de grandeur.
- Décision : le **moule sort du calcul de `ressemble`** (la doc le disait déjà : « le moule est un signal, pas un refus seul »).
  `comparerScripts` rend toujours `moules`, pour l'afficher ou le journaliser, mais seuls la copie et la paraphrase font refuser.
  Après correction : **0 refus à tort sur 60** (test `calibrage.test.ts`), 0 sur les 6 paires « moule propre ».
- Le moule voit toujours les 4 patrons repris sur 4 (signal) ; les 4 paires restent refusées, car chacune contient aussi une copie
  de 5 mots (mesuré : copies 2, 2, 1, 2).

- Taux sur les 12 paires honnêtes avec l'ancienne règle : 1 sur 12 (8 %) ; avec la règle actuelle : 0 sur 12. Taux de rejet à tort hors moule : 0 sur 6.
- Le faux positif historique est `n4` : « C'est simple / rapide : vous écrivez le mot / scannez le code, et le guide / menu arrive / s'affiche… » — une
  construction d'oral très courante, que le moule prenait pour un patron repris.
- Limite : 30 paires écrites à la main, pas des scripts réels ; ordre de grandeur, pas une garantie. À réévaluer sur de vrais scripts quand C2-C4 brancheront le contrôle.
- Tout reste NON BRANCHÉ : aucun générateur n'appelle encore cette mesure.
