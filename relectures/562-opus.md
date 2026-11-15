# Relecture PR 562 (lot AUT-G) — Opus

VERDICT PROVISOIRE : en cours

Tête relue : origin/usine/AUT-G = e1f6822f54d2dbb2dcd72b855a2093b1a9d0e444
Base : origin/master = 98af97a52d48927986b01dcd886b3a4e13caa8f5

## Avancement (provisoire)

- Diff : exactement les 9 fichiers attendus, aucun autre.
- (a) sonde de l'audit, forme des 4 sites (`cleUsine = travailId#voix_…`) : la commande de 18 € est REFUSÉE `USINE_PLAFOND_ATTEINT` (master : acceptée). OK.
- (b) FAILLE HAUTE trouvée : 16 min après les lectures de voix, travail toujours en cours, la part des voix SORT du registre
  (usage 1900 → 1500) alors que l'engagement reste 1900 ; une commande de 5 € passe → 24 € engagés pour 20 €. Détail au verdict.
- (c)(d)(e) rejoués master vs PR : Studio strictement identique (6 combinaisons, mêmes résultats, 163 lectures des deux côtés) ;
  changement de mois et `BUDGET_USINE_ABSENT` identiques ; simultanées à 1 centime : jamais de dépassement.
- (f) mutations : couts « remplacer » → rouge ; autonomie-usine « ajouter » ignoré → rouge ; credits clé = travailId → rouge ;
  MAIS clé = travailId (ou clé retirée) AUX 4 SITES → nouveau test VERT (non détecté). Suites voisines en cours.
- (g) tsc 146 = 146 (aucune nouvelle), eslint des fichiers touchés propre ; aucun nom de personne, aucun montant codé en dur ajouté.
