# Contrat de synchro · champs du parcours « mot → e-mail → guide »

- Statut : brouillon (documents seulement, aucun code)
- Date : 2026-11-01
- Rôles : le **site** garde la preuve et transmet au **CRM Pro** par sa synchro habituelle. Le **Studio** ne conserve jamais l'adresse e-mail et ne reçoit du site que des compteurs et des oppositions. L'**Usine** ne voit que des chiffres.
- Les noms de champs ci-dessous sont des propositions à aligner sur la synchro existante du site, qui n'est pas dans ce dépôt.

## Champs gardés par le site et transmis au CRM Pro

| Champ | Type | Contenu | Remarque |
|---|---|---|---|
| contact_email | texte | Adresse saisie par la personne | Site et CRM Pro seulement, jamais le Studio |
| mot_origine | texte | Mot commenté (GUIDE, DEVIS, ...) | Normalisé en majuscules |
| reseau_origine | liste | instagram, facebook, linkedin_page, tiktok, page_guide | |
| date_demande | date-heure UTC | Moment de la demande | |
| guide_envoye | oui/non + date | Guide envoyé par e-mail | Toujours envoyé, accord ou non |
| accord_campagnes | liste | non_demande, oui_en_attente_de_clic, oui_confirme, non | « oui_en_attente_de_clic » ne vaut pas accord |
| date_accord | date-heure UTC | Moment du « Oui » dans la conversation | |
| date_confirmation | date-heure UTC | Moment du clic dans l'e-mail de confirmation | Vide = aucune campagne |
| preuve_accord | structure | Texte exact de la question posée (version), réponse reçue, identifiant opaque de la conversation chez Zernio, identifiant du lien de confirmation, date du clic | Pas de donnée du navigateur au-delà du strict nécessaire |
| version_texte_confidentialite | texte | Version de la page affichée ou citée | |
| statut | liste | actif, a_l_ecart | Jamais « supprimé » |
| date_mise_a_l_ecart | date-heure UTC | STOP, opposition ou échéance des 3 ans | Mise à l'écart seulement |
| motif_mise_a_l_ecart | liste | stop, opposition, echeance_3_ans | |
| dernier_echange | date-heure UTC | Sert au calcul des 3 ans (Q6) | |

## Champs transmis au Studio (sans donnée personnelle)
- Compteurs par jour, par mot et par réseau : demandes, guides envoyés, accords confirmés, oppositions.
- Liste « À traiter » : références opaques de commentaires au mot inconnu (Q7), sans adresse.

## Règles
1. Un seul enregistrement actif par adresse ; une nouvelle demande met à jour `dernier_echange` et ajoute une ligne de preuve, sans écraser l'ancienne.
2. Une personne `a_l_ecart` qui redemande un guide reçoit le guide sans campagne (Q3 bis) ; son statut d'écart reste.
3. Aucune suppression : ni côté site, ni côté CRM Pro, ni côté Studio. L'échéance des 3 ans produit une mise à l'écart.
4. La synchro est idempotente (clé : adresse normalisée + identifiant de conversation).
5. Une demande d'effacement ne supprime rien automatiquement : elle envoie une alerte à l'opérateur, qui décide. Le statut éventuel reste `actif` ou `a_l_ecart`, jamais « supprimé ».
6. Les champs `contact_email` et `preuve_accord` n'apparaissent jamais dans un journal du Studio ni dans le dépôt.

## À DÉCIDER PAR L'OPÉRATEUR
- **QE** : conservation des identifiants de commentateurs (purge interdite ou non) ; impacte `preuve_accord`.
- **Q11** : si Zernio héberge hors UE, quels champs peuvent y rester.
