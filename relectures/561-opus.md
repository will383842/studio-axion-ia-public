# VERDICT : OK — FUSION POSSIBLE sur la tête complète 6152ca9a7c3a652ddafb85b323467049dcf58e72

Relecture Opus de la PR 561 (lot A1, branche `chore/geler-buffer`) : gel de l'ancien outil Buffer en lecture seule.
Lecture seule : sondes jetables, non poussées et supprimées. Base de comparaison : merge-base 9da1eed.

## Points vérifiés

- **(a) Réglage `buffer.gele` : OK.** `src/services/buffer-gel.ts:13-18` : seul le booléen `false` dégèle, et `true` gèle.
  Toute autre valeur gèle. Sonde : absent, `""`, `"false"`, `"FALSE"`, `" false"`, `"true"`, `{}`, `[]`, `1`, `0` et `null` donnent tous « gelé ».
  Gelé aussi avec `NODE_ENV` vide. Le défaut de test `STUDIO_BUFFER_GEL_DEFAUT=degele` est ignoré en production (test PR et sonde).
- **(b) Aucun appel réseau Buffer quand gelé : OK.**
  - Synchro 15 min : `buffer.ts:400`. Ni comptes ni états ; seule la relecture des envois incertains reste, et un envoi Buffer y est sauté.
  - Relecture des comptes : `buffer.ts:92`. Elle couvre aussi `comptesBufferPour` sans comptes en base, vérifié par sonde (`BUFFER_GELE`, 0 appel).
  - « Tester » : bouton coupé dans `BlocBuffer.tsx:129`, et refus **côté serveur** (`testerBufferAction`, sonde : `ok:false`, 0 appel).
  - Relecture d'un envoi Buffer : `buffer.ts:302`.
  - Chiffres : `mesures-completes.ts:209`, y compris avec un lecteur injecté.
  - Envoi : `routage-publication.ts:80`. Il couvre aussi « Programmer les N » et `envoyerParOutilAction`. Choix de Buffer refusé à la ligne 46.
  - CLI d'import : `lire-buffer.ts:54` (sonde : clé présente sans `STUDIO_BUFFER_DEGELE=oui`, ou avec `true` → refus).
  - Toutes les sondes ont 0 appel vers le faux Buffer.
- **(c) Zernio non affecté : OK.** Le routage Zernio passe avant le contrôle de gel (`routage-publication.ts:74-78`). `reconcilierEnvoi` ne saute que `outil === "buffer"`.
  La synchro gelée relit toujours les envois Zernio. Zernio ne lit de Buffer que la liste figée `buffer.canaux`, en base locale. Le test PR `a1-zernio-reconciliation-gelee` est vert.
- **(d) Lectures locales, aucune perte : OK.** `vueBuffer` et `canauxEnregistres` lisent la base. Un envoi Buffer « à vérifier » reste tel quel.
  `marquerEnvoiVerifie` le sort à la main (sonde OK). Aucune publication n'est supprimée. Les relevés déjà gardés restent.
  `exporter.mts --archive` retombe sur les publications du Studio quand le client CLI est gelé.
- **(e) Diff : OK.** 17 fichiers, exactement les fichiers attendus et `tests/buffer-gel/a1-*`. Aucun test existant n'est modifié.
  `vitest.config.mts` ajoute seulement `STUDIO_BUFFER_GEL_DEFAUT=degele` : les anciens tests Buffer gardent leur comportement d'avant, et aucune assertion n'est retirée ni affaiblie. Les tests A1 vident la variable eux-mêmes.
- **(f) Tests, tsc, eslint : OK.**
  - `tests/buffer-gel` : 47/47 verts.
  - Suite complète à la tête : 273 échecs (135 fichiers). Mêmes fichiers relancés sur la base : 273 échecs. Ensembles identiques : 0 nouveau, 0 disparu. Ce sont des échecs d'environnement (`remotion` absent, FFmpeg) ou des échecs anciens, sans lien avec le lot.
  - `scripts/echecs-connus.json` n'est pas touché.
  - tsc : 146 erreurs, identiques à celles de la base. eslint : 0 sur les fichiers touchés.
- **(g) Aucun nom de personne : OK** dans le diff et les messages de commit. Le compte de test s'appelle « Exemple IG ».

## Remarques non bloquantes

1. Le CLI (`lire-buffer.ts:54`) ne lit pas `buffer.gele` : il se dégèle seulement par `STUDIO_BUFFER_DEGELE=oui`. C'est documenté et plus prudent que le réglage.
2. Un envoi Buffer « à vérifier » n'est plus relu : il reste bloqué jusqu'à « Marquer comme vérifié ». C'est voulu et documenté (`buffer.ts:301`).
