# Consigne de session : produire un paquet de carrousel

Mode d'emploi pour une session Claude (abonnement) qui produit un **paquet** lu par `lirePaquetSession`. Cette consigne ne décrit que le format et la structure.

## Sortie attendue

Un seul objet JSON, rien avant ni après, de taille inférieure à 64 Ko :

```json
{
  "version": "paquet-session-carrousel/1",
  "sujet": "texte, 200 signes au plus",
  "titre": "texte, 120 signes au plus",
  "pourquoi": ["une phrase par page, 10 phrases au plus, 200 signes chacune"],
  "spec": {
    "version": "carrousel/1",
    "alt": "description du carrousel, 125 signes au plus",
    "pages": []
  }
}
```

Aucune autre clé n'est admise, ni dans le paquet ni dans la spec. Aucun lien, aucune adresse, aucun caractère de contrôle dans les textes.

## Structure

- La première page est une couverture (T01, T01B ou T01C), et seule la première.
- La dernière page est T21, seule page de ce type ; elle ne porte aucun champ.
- Le nombre va de 2 à 10 pages (couverture + ... + T21).

## Types de pages et budgets (signes)

| Type | Champs | Budgets |
| --- | --- | --- |
| T01 | `titre`, `sousTitre` (facultatif) | titre 60, sous-titre 100 |
| T01B, T01C | `titre`, `sousTitre` (facultatif), `deco` (facultatif, E01 à E15) | titre 40, sous-titre 100 |
| T02 | `titre`, `cartes` (2 à 6, chacune `titre`, `corps`, `mini` facultatif parmi W01, W02, W03, W06, W07, W25) | titre de page 30 ; par carte : 2 cartes 48 / 240, 3 cartes 48 / 80, 4 cartes 32 / 80, 5 ou 6 cartes 17 / 36 (titre / corps) ; aucun mot de plus de 12 signes dans un titre de carte à 4, 5 ou 6 cartes (15 à 2 ou 3 cartes), sinon le rendu échoue |
| T06 | `titre`, `points` (3 à 4, chacun `texte`) | titre 30 ; par point : 3 points 110, 4 points 58 |
| T08 | `titre`, `avant`, `apres` | titre 30, chaque panneau 50 |
| T10 | `message`, `legende` (facultative), `deco` (facultatif) | message 50, légende 60 |
| T20 | `titre`, `etapes` (3 à 5, chacune `titre`, `corps`) | titre 30 ; par étape : 3 étapes 30 / 120, 4 étapes 30 / 80, 5 étapes 28 / 44 (titre / corps) |
| T21 | aucun | aucun |

Un texte plus long que son budget est refusé à la lecture du paquet.

## Vérification

Chaque erreur de lecture indique le chemin du champ en cause : corriger ce champ et renvoyer le paquet complet.
