# ADR-0005 · Parcours viral « mot → e-mail → guide »

- Statut : proposée (documents seulement, lot PV-0 ; aucune ligne de code)
- Date : 2026-11-01
- Chantier : Zernio, parcours viral
- Liens : ADR-0004 et son amendement (document 02), registre RGPD (document 03), contrat de synchro (document 04), page confidentialité (document 05)
- Limite : le fichier de conception source (§8, §10, §11) n'est pas dans le dépôt cloné. Cet ADR s'appuie sur le prompt du lot et sur les réponses déjà données par l'opérateur. Toute divergence avec la conception d'origine est à relire.

## Contexte

Le Studio publie sur plusieurs réseaux. Une personne qui commente un mot-clé (par exemple GUIDE ou DEVIS) sous une publication doit pouvoir recevoir un guide gratuit par e-mail, et, si elle le souhaite, des conseils par e-mail ensuite. Le parcours est « viral » parce que le commentaire public est visible des autres abonnés.

Contraintes de fond : consentement explicite et prouvable (double accord), aucune adresse e-mail stockée dans le Studio, aucune suppression de données de personnes, aucun envoi sans disjoncteur, aucune parole de la part de l'Usine (qui ne voit que des chiffres).

## Décision

### P1 · Qui fait quoi
- **Zernio** (sous-traitant) mène la conversation : détection du commentaire, réponse publique, message privé, collecte de l'adresse.
- **Le Studio** écoute (réception des événements Zernio), relit tout ce qui est consigné chez Zernio, et transmet au site. Le Studio ne conserve jamais l'adresse e-mail d'une personne.
- **Le site** envoie le guide par e-mail, envoie l'e-mail de confirmation du double accord, garde la preuve d'accord, et prévient le CRM Pro par la synchro habituelle (document 04).
- **L'Usine** ne voit que des chiffres agrégés et des oppositions. Elle ne parle jamais à Zernio.

### P2 · Réseaux
- Instagram et Facebook : parcours entièrement automatique.
- LinkedIn page et TikTok : réponse publique seule ; le reste passe par la page du guide du site.
- LinkedIn profil : à la main (aucune automatisation).
- YouTube : plus tard.

### P3 · Déroulé (textes = BROUILLONS à valider par l'opérateur)
1. La personne commente **le mot seul** (Q9 : un commentaire qui contient autre chose que le mot seul ne déclenche rien).
2. Réponse publique brève (brouillon, document 05 en annexe) et message privé portant la mention « Message automatique » (Q4, sans mention « IA ») qui demande l'adresse e-mail.
3. Si l'adresse est mal écrite : **une seule** correction demandée. Le bouton « Recevoir ici » n'apparaît qu'à ce moment (Q2). Jamais de relance ensuite.
4. Question séparée : accord explicite Oui / Non pour recevoir des conseils par e-mail (campagnes) (Q3). La question est posée dans le message privé.
5. Le guide part **par e-mail**, dans tous les cas, accord ou refus (Q1 : pas de lien dans le message privé).
6. Un « Oui » est confirmé par un clic dans un e-mail de confirmation (double accord). Sans ce clic : aucune campagne.
7. Une personne opposée (Non) qui redemande un guide plus tard reçoit le guide sans campagne (Q3 bis).

### P4 · Mot inconnu et mots connus
- Q7 : pas de mot de repli automatique en V1. Un mot inconnu va dans la liste « À traiter » ; personne n'est contacté automatiquement.
- Q12 (défaut A) : le mot DEVIS mène à un guide envoyé par e-mail, comme les autres mots.

### P5 · STOP et opposition
- STOP met la personne à l'écart **partout** (Studio, site, CRM Pro). Rien n'est supprimé : mise à l'écart seulement.
- Q5 : après STOP, silence total si Zernio le permet ; sinon seule la première réponse automatique part (point à vérifier chez Zernio, voir D-Q11).

### P6 · Durée de vie des données
- Q6 : durée annoncée de **3 ans depuis le dernier échange**, puis **mise à l'écart sans suppression**. Le texte public dit exactement cela, sans promettre d'effacement.

### P7 · Garde-fous techniques (à implémenter plus tard, hors PV-0)
- Plafonds journaliers et horaires d'envoi ; disjoncteur automatique ; bouton « Tout arrêter » avec confirmation ; **un seul envoi par commentaire et par personne**.
- Interrupteur existant `zernio.envoi_autorise` conservé (ADR-0004 D6) ; le parcours en ajoute un propre, vérifié en premier.

### P8 · Essai sans code
- Q10 : après le 08/11, essai sans code avec le mot GUIDE, qui mène au formulaire du site. Aucun message automatique n'est branché pendant cet essai.

## À DÉCIDER PAR L'OPÉRATEUR (non tranché, aucune réponse inventée)
- **Q8** : fréquence des campagnes annoncée dans le message de confirmation (M3).
- **Q11** : lecture du contrat de traitement de Zernio et du pays d'hébergement (sous-traitant). À faire par l'opérateur avant tout lancement réel.
- **QE** : durée de conservation des identifiants de commentateurs chez le Studio ou Zernio : est-ce une purge interdite par la règle « rien n'est supprimé » ? À trancher.
- **QG** : plafond de fabrication, 80 € ou 150 €.

## Conséquences

- Positives : consentement prouvable ; aucune adresse dans le Studio ; une seule porte d'entrée de données (le site) ; arrêt d'urgence clair.
- Négatives : dépendance à un sous-traitant (Zernio) ; la mise à l'écart sans suppression garde des données plus longtemps (justifier côté confidentialité) ; certains réseaux ne permettent que la réponse publique.
- Neutres : le CRM Pro reste la seule base de contacts.

## Alternatives écartées
- Lien du guide dans le message privé : écarté (Q1), le guide part par e-mail pour vérifier l'adresse.
- Mot de repli automatique pour un mot inconnu : écarté en V1 (Q7).
- Case d'accord pré-cochée ou accord implicite : écarté, accord explicite Oui / Non (Q3).
- Relances automatiques : écartées, jamais.
- Stockage de l'adresse dans le Studio : écarté.
- Suppression des données à l'expiration : écartée, mise à l'écart seulement (Q6, sous réserve de QE).

## Tests à prévoir (lots suivants)
- Commentaire autre que le mot seul : aucun déclenchement.
- Un seul envoi par commentaire et par personne.
- Sans clic de confirmation : aucune inscription aux campagnes.
- STOP : personne à l'écart dans tous les systèmes, aucune suppression.
- Aucune adresse e-mail dans les documents du Studio (garde de dépôt).
- Disjoncteur et « Tout arrêter » coupent les envois.
