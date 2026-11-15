# Relecture PR 562 (lot AUT-G) — Opus

VERDICT PROVISOIRE : en cours

Tête relue : origin/usine/AUT-G = e1f6822f54d2dbb2dcd72b855a2093b1a9d0e444
Base : origin/master = 98af97a52d48927986b01dcd886b3a4e13caa8f5

## Avancement (provisoire)

- Diff : exactement les 9 fichiers attendus, aucun autre.
- (a) sonde de l'audit, forme des 4 sites (`cleUsine = travailId#voix_…`) : la commande de 18 € est REFUSÉE `USINE_PLAFOND_ATTEINT` (master : acceptée). OK.
- (b) FAILLE HAUTE trouvée : 16 min après les lectures de voix, travail toujours en cours, la part des voix SORT du registre
  (usage 1900 → 1500) alors que l'engagement reste 1900 ; une commande de 5 € passe → 24 € engagés pour 20 €. Détail au verdict.
