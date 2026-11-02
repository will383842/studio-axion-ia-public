# Contrat de synchro · champs du parcours « mot → e-mail → guide »

- Statut : brouillon ; section « Route du site » alignée sur le vérificateur réel du site (PV-2). Rien n'est branché : le Studio n'appelle pas la route tant que le drapeau du site est éteint.
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
| accord_campagnes | liste | non_demande, non, oui_en_attente_de_clic, oui_deja_confirme, ecarte | « oui_en_attente_de_clic » ne vaut pas accord |
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
4. La synchro est idempotente (clé : adresse normalisée + identifiant de conversation) ; l'appel du Studio vers le site a sa propre clé, voir la section suivante.
5. Une demande d'effacement ne supprime rien automatiquement : elle envoie une alerte à l'opérateur, qui décide. Le statut éventuel reste `actif` ou `a_l_ecart`, jamais « supprimé ».
6. Les champs `contact_email` et `preuve_accord` n'apparaissent jamais dans un journal du Studio ni dans le dépôt.

## Route du site : `POST /api/interne/demandes-guide-reseau`

### Signature (forme « v1 » du site)
- Chaîne signée : `v1`, saut de ligne, horodatage, nonce, MÉTHODE, chemin, sha256 hex du corps brut (chaque élément séparé par un saut de ligne).
- HMAC-SHA256 ; en-tête `x-axion-signature: v1=<64 hex minuscules>` ; `x-axion-nonce` : 32 hex minuscules ; `x-axion-horodatage` : secondes, 10 chiffres ; fenêtre 300 s.
- Le corps est signé octet pour octet : ne jamais le re-sérialiser entre la signature et l'envoi.
- Vecteur commun (secret FICTIF de test), vérifié par `tests/site-videos/s4-signature.test.ts` :
  - secret : `secret-fictif-de-test-pv2`
  - horodatage : `1760781600`
  - nonce : `00112233445566778899aabbccddeeff`
  - méthode : `POST`
  - chemin : `/api/interne/demandes-guide-reseau`
  - corps : `{"mot":"GUIDE","reseau":"instagram","accord":"non_demande","idRun":"run_exemple_0001"}`
  - sha256 du corps : `7fa43e9ae5d7c0a854f7d46e6b2be9cd7f0341916a708eaf3c06c9259a9f2722`
  - signature attendue : `v1=e9876c7e1b20ac0862c564b4a02acca0ce3a336f2c1c64b2111d4950b5bafab9`

### Clé d'idempotence
- La clé est l'identifiant du run Zernio et doit respecter `^[A-Za-z0-9_-]{8,80}$`.
- Si l'identifiant brut a d'autres caractères (ou une autre longueur), on envoie son sha256 hexadécimal (64 caractères minuscules), déterministe : même identifiant brut, même clé (`cleIdempotence` dans `src/domaine/guide-reseau/cle-idempotence.ts`).
- La clé est figée au premier essai, et les réessais renvoient exactement les mêmes octets de corps.

### Valeurs et formes
- Accord envoyé par le Studio : `oui`, `non` ou `non_demande`.
- Accord renvoyé par le site : `non_demande`, `non`, `oui_en_attente_de_clic`, `oui_deja_confirme`, `ecarte`.
- Mot : lettres et chiffres, accentués compris, 2 à 30 caractères.

### Codes de réponse à traiter
| Code | Sens | Conduite du Studio |
|---|---|---|
| 200 | Demande traitée (ou rejouée avec la même clé et le même corps) | Terminé ; lire l'accord renvoyé |
| 409 `en_cours` | Même clé en cours de traitement | Réessayer avec la même clé et les mêmes octets, après une attente nettement supérieure à 2 minutes (par exemple 5 minutes) |
| 409 `cle_reutilisee` | Même clé avec un corps différent | Ne pas réessayer ; anomalie à traiter (bogue : corps non figé) |
| 409 `nonce_reutilise` | Nonce déjà vu | Réessayer avec un nouveau nonce et une nouvelle signature, même clé, même corps |
| 422 | Corps refusé (mot, réseau, accord ou forme invalide) | Ne pas réessayer ; corriger la demande |
| 401 | Signature, horodatage ou secret refusé | Ne pas réessayer en boucle ; vérifier horloge et secret |
| 429 | Trop de demandes | Réessayer plus tard, même clé, mêmes octets |
| 503 | Site indisponible ou drapeau éteint | Réessayer plus tard, même clé, mêmes octets |
| 500 | Erreur du site | Réessayer plus tard, même clé, mêmes octets ; alerter si cela dure |

## À DÉCIDER PAR L'OPÉRATEUR
- **QE** : conservation des identifiants de commentateurs (purge interdite ou non) ; impacte `preuve_accord`.
- **Q11** : si Zernio héberge hors UE, quels champs peuvent y rester.
