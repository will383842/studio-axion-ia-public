# AUTO-REP-01 · Preuve de l'essai réel des réponses automatiques (Instagram et Facebook)

Note datée, écrite le 20/11/2026 à partir des traces du Studio (journal des événements du diffuseur et état des conversations). L'essai a été fait le 17/11/2026 avec le fondateur, sur ses comptes, avec un mot et un guide d'**essai** (`ESSAIGPT7`, guide « Guide d'essai ChatGPT »). Cette note ne contient aucune donnée de personne : pas de nom, pas d'adresse, pas d'identifiant d'auteur. Les identifiants de commentaires sont raccourcis ; les identifiants complets sont gardés dans le dépôt privé du pilotage.

## Facebook (page de l'entreprise) — 17/11/2026, 17 h 59 à 18 h 01, heure de Paris

| Étape | Trace |
| --- | --- |
| Commentaire avec le mot `ESSAIGPT7` sous une publication de la page | commentaire `…_898430066626362`, reçu par le diffuseur, `nature: premier` |
| **Réponse publique automatique** sous le commentaire | formulation `mp-pub-v2-1` (« pub-commentaire ») |
| Message privé automatique « bien reçu » puis demande d'adresse | formulations `mp-recu-v3-1` et `mp-m1-v6-1` |
| Envoi du guide en message privé | message `…d9474bf0bc6593d7`, conversation à l'état **`termine`** |

## Instagram (compte professionnel) — 17/11/2026, 18 h 33 à 18 h 47, heure de Paris

| Étape | Trace |
| --- | --- |
| Commentaire avec le mot `ESSAIGPT7` sous une publication du compte, depuis un second compte consentant | commentaire `…686569932`, `nature: premier` |
| **Réponse automatique en message privé** « suivez le compte puis répondez OK » | formulation `mp-ig-suivre-v1-2` ; abonnement constaté (`deja_suivi`) |
| « OK » reçu, puis demande d'adresse | `okRecus: 1`, formulation `mp-m1-v6-1` |
| Adresse lue puis refusée par le site (adresse hors de la liste d'essai, code 422) | message automatique `mp-adresse-refusee-v3-3` : le refus est expliqué à la personne, la conversation garde son état (`site_refuse`) |

Sur Instagram, la réponse automatique passe par le message privé : le parcours ne pose pas de réponse publique sous le commentaire. Le refus de l'adresse est le comportement attendu pour une adresse hors de la liste d'essai, et la chaîne est restée correcte jusqu'au bout.

## LinkedIn et TikTok : jamais de réponse automatique

Le test `tests/auto-rep-01-jamais-linkedin-tiktok.test.ts` (#1344, fusionné le 19/11/2026) prouve qu'aucune réponse automatique ne part sur LinkedIn ni sur TikTok, même interrupteur allumé. La garde est dans `parcours-conversation.ts` : seuls Facebook et Instagram répondent.

## Allumage

L'allumage des réponses automatiques reste un geste du fondateur, qui peut aussi les éteindre depuis le Studio. Témoignage, et non trace : le fondateur a jugé le parcours fonctionnel après ces deux essais (18/11/2026).
