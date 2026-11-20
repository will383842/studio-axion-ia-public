# Essai réel du pilote 05 Stocks : la procédure (pour Williams)

**Cette fiche ne dépense rien et n'allume rien.** Elle décrit comment, quand vous le déciderez, lancer UNE vidéo réelle
(pilote Stocks), puis comparer ce qui était annoncé et ce qui a été dépensé. Aucune vidéo n'est publiée par cette
procédure. L'essai réel n'a lieu qu'après la fusion de la fiche, quand vous le décidez.

## 1. Avant de commencer (le pilote vérifie, vous n'avez rien à faire)
- L'essai automatique à 0 € (`tests/tutoriel-outil/essai-complet.test.ts`) est vert sur master.
- L'audit argent est signé.
- Le plafond par vidéo est chiffré par l'auditeur argent, puis **montré** : vous le voyez avant de répondre.

## 2. Une seule question, posée par le pilote
> « J'allume le tutoriel pour UNE vidéo, le pilote Stocks, avec un plafond de **<montant>** ; vous confirmez ? »

Votre réponse écrite est gardée au journal. Sans « oui » écrit, rien n'est allumé et on s'arrête là.

## 3. Vous allumez vous-même, dans la console
Rien n'est allumé à votre place. Dans la console du tutoriel, vous allumez, un par un : le formulaire, l'envoi d'un
dossier, l'assistant d'écriture du tutoriel, le devis avant dépense, le son et la vignette, le choix de la fin.
La mention « fait avec l'IA » reste éteinte, sauf si vous décidez autrement.

## 4. Vous déposez le dossier du pilote 05
Dans le formulaire, vous envoyez le dossier du pilote 05 Stocks (maquette, données, scénario, script court) et vous
choisissez la fin **« Prendre rendez-vous »**.

## 5. Vous suivez, vous choisissez, vous acceptez
Dans l'écran de suivi, vous voyez chaque étape. À l'écran de validation :
1. vous choisissez votre script entre les **2 versions** ;
2. vous validez le parcours ;
3. vous donnez votre accord sur le **devis en quantités** (appels à l'assistant, caractères de voix, rendus vidéo).

**Rien n'a été dépensé avant cet accord.** Si le script ou les formats changent, le devis change : il faut un nouvel accord.

## 6. Vous voyez la vidéo finie, avant toute publication
La vidéo finie vous est montrée dans les trois formats (4:5, 9:16, 1:1). **Rien n'est publié** par cette procédure :
la publication reste votre décision, plus tard.

## 7. Le relevé, puis votre choix
Le pilote lance le relevé (`releve.ts`) avec les chiffres de la vidéo : devis, quantités consommées, dépenses réelles,
plafond de l'assistant d'écriture, durée, formats, grille de qualité. Le relevé répond :
- **conforme** : tout est dans le devis, le plafond, les formats (4:5, 9:16, 1:1), la durée (40 à 55 s) et la grille ;
- **à revoir** : il liste, en phrases simples, chaque écart (une quantité au-dessus du devis, le plafond dépassé, un
  format manquant, une durée hors cadre, une grille qui ne propose pas la vidéo).

Le relevé est rangé au journal. Ensuite, **vous éteignez les interrupteurs, ou vous les laissez allumés, à votre choix.**

## Rappels
- Un devis est un **plafond en quantités** : consommer moins est normal, consommer plus est un écart.
- Aucun montant d'argent n'apparaît dans la vidéo ; les données de la maquette sont marquées « exemple ».
- Le dossier du pilote (`05-stocks/commande-pilote.json`) reste `lancer: false` : l'essai réel passe par le formulaire.
