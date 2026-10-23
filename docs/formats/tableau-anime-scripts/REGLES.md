# Scripts du tableau animé · règles du générateur (version publique, jeu générique réduit)

Ce document est une version GÉNÉRIQUE et courte. Le jeu de règles complet du studio n'est pas publié ; le code
(`src/services/tableau-scripts/consignes.ts`, `src/domaine/scripts-tableau-controles.ts`) reste la référence.

## 1. Règle d'or
Une idée, un gain (avec son unité), une preuve.

## 2. Gabarit : six passages, toujours dans cet ordre
1. Accroche
2. Douleur
3. Promesse
4. Ce qui change (quelques constats, à l'indicatif)
5. Exemple
6. À retenir et demande

## 3. Style
- Phrases courtes, mots simples, une image concrète par phrase.
- Aucun chiffre sans source, aucune promesse absolue.
- Pas de tutoriel numéroté à l'impératif.

## 4. Durées
Le script suit la durée visée (30 ou 60 secondes) : les repères de mots par passage sont dans le code.

## 5. Contrat avec le découpage
Le script rend des parties nommées (`partie`, `libelle`, `texte`, `ecran`) que le découpage reprend telles quelles.

## 6. Relecture
La relecture corrige quelques phrases faibles au plus ; jamais de réécriture totale.
