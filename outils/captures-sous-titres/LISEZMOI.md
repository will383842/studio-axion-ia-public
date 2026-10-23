# Captures de contrôle des sous-titres (lot M2)

Produites sur ce poste par Remotion `still`, avec le vrai moteur (`src/briques/sous-titres/`) et le vrai calque
(`studio-rendu/compositions/sous-titres/`). Aucun appel réseau vers un fournisseur.

1. `python outils/captures-sous-titres/fonds.py` — fond « illustration claire » (pire cas : ciel blanc, gilet jaune).
2. `pnpm exec tsx outils/captures-sous-titres/captures.mts` — 14 captures dans `docs/captures/sous-titres-styles/`,
   plus `melange-groupes.txt` (groupes d'un script réel, Équilibré) et `controle-largeurs.txt` (largeur rendue ≤ zone libre).
3. `python outils/captures-sous-titres/planches.py` — planches côte à côte pour Will.

`metriques.py` régénère `src/briques/sous-titres/metriques.ts` (chasse réelle des caractères) si une police change.
Polices : Poppins ExtraBold, Poppins Medium, Montserrat Black (instance 900 du Montserrat variable) — SIL OFL 1.1.
