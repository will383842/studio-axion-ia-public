# Relecture PR 566 — fiche RC-34

VERDICT PROVISOIRE : en cours

Tête examinée : 4421eee8ba400d31c4cac281048848924b54bb3b

## Vérifications (en cours)
- Diff PR (trois points) : 2 fichiers autorisés seulement ; memoire-centrale.ts / memoire-ecriture.ts non touchés. Fusion avec master f98e77a5 sans conflit.
- Tests RC-34 sur l'arbre fusionné : 6/6 verts.
- tsc : 146 erreurs sur master, 146 identiques sur la fusion (0 nouvelle). eslint sur les 2 fichiers : propre.
- Sondes jetables (non poussées) : stockage inspecté = {id, axes[64 hex], signature[64 hex], etat, date}, aucun mot en clair ; 61 messages (le plus ancien reste écarté), mémoire centrale coupée puis allumée : écart maintenu ; fetch jamais appelé ; lignes étrangères d'une liste conservées ; « publié » jamais rétrogradé.
- Sonde : une valeur NON-liste rangée à la clé (ex. un objet) est écrasée à la première écriture (perte de cette valeur).
