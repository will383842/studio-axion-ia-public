/**
 * C1.5 : 30 paires (script ancien, script nouveau) étiquetées à la main, pour mesurer la ressemblance commune.
 * `attendu` : "ressemble" = un humain dirait que le nouveau script redit l'ancien ; "different" = deux scripts honnêtes du même
 * type (même métier, même format, même ton) qui ne se copient pas. Les paires « moule-propre » sont le piège : même
 * charpente de phrase, sujet différent, qu'un lecteur ne prendrait pas pour une copie.
 */
export type Attendu = "ressemble" | "different";
export interface Paire {
  id: string;
  groupe: "copie" | "paraphrase" | "moule" | "different" | "moule-propre";
  attendu: Attendu;
  ancien: string;
  nouveau: string;
}

export const PAIRES: Paire[] = [
  // --- Copies (8) ---
  { id: "c1", groupe: "copie", attendu: "ressemble", ancien: "Chaque lundi, vous triez trente mails à la main. Alors on a branché un robot qui classe tout seul.", nouveau: "Pourtant on a branché un robot qui classe tout seul chez un notaire de Lyon." },
  { id: "c2", groupe: "copie", attendu: "ressemble", ancien: "Votre devis part en deux minutes depuis le téléphone, sans rien recopier.", nouveau: "Résultat : un devis part en deux minutes depuis le téléphone, sans rien recopier le soir." },
  { id: "c3", groupe: "copie", attendu: "ressemble", ancien: "Le planning se range seul chaque soir et personne n'y touche.", nouveau: "Ici le planning se range seul chaque soir et personne n'y touche jamais." },
  { id: "c4", groupe: "copie", attendu: "ressemble", ancien: "Avant, on relançait les impayés un par un, à la main, le vendredi après-midi.", nouveau: "Avant, on relançait les impayés un par un, à la main, tous les mois." },
  { id: "c5", groupe: "copie", attendu: "ressemble", ancien: "Dix minutes suffisent pour envoyer toutes les factures du mois.", nouveau: "Dix minutes suffisent pour envoyer toutes les factures du trimestre." },
  { id: "c6", groupe: "copie", attendu: "ressemble", ancien: "Le client reçoit un rappel automatique la veille du rendez-vous.", nouveau: "Le client reçoit un rappel automatique la veille du rendez-vous, par SMS." },
  { id: "c7", groupe: "copie", attendu: "ressemble", ancien: "Vous cliquez une fois et le tableau de bord se remplit tout seul.", nouveau: "Vous cliquez une fois et le tableau de bord se remplit tout seul, sans export." },
  { id: "c8", groupe: "copie", attendu: "ressemble", ancien: "On a gagné six heures par semaine sur la saisie des commandes.", nouveau: "On a gagné six heures par semaine sur la saisie des commandes fournisseurs." },
  // --- Paraphrases (6) ---
  { id: "p1", groupe: "paraphrase", attendu: "ressemble", ancien: "Chaque lundi, vous triez trente mails à la main. Alors on a branché un robot qui classe tout seul.", nouveau: "Tout seul, le robot branché classe alors vos mails." },
  { id: "p2", groupe: "paraphrase", attendu: "ressemble", ancien: "Les factures impayées sont relancées automatiquement chaque vendredi matin.", nouveau: "Chaque vendredi matin, les impayées sont automatiquement relancées par les factures." },
  { id: "p3", groupe: "paraphrase", attendu: "ressemble", ancien: "Le robot classe vos courriels entrants par client et par urgence.", nouveau: "Par urgence et par client, le robot classe vos courriels entrants." },
  { id: "p4", groupe: "paraphrase", attendu: "ressemble", ancien: "Un rappel automatique prévient chaque patient la veille de son rendez-vous.", nouveau: "La veille de son rendez-vous, chaque patient est prévenu par un rappel automatique." },
  { id: "p5", groupe: "paraphrase", attendu: "ressemble", ancien: "Votre stock se met à jour dès qu'une commande est expédiée.", nouveau: "Dès qu'une commande est expédiée, votre stock se met à jour." },
  { id: "p6", groupe: "paraphrase", attendu: "ressemble", ancien: "Les devis signés arrivent directement dans votre comptabilité.", nouveau: "Directement dans votre comptabilité arrivent les devis signés." },
  // --- Moules (4) : même charpente, mots pleins changés, un lecteur reconnaît le patron ---
  { id: "m1", groupe: "moule", attendu: "ressemble", ancien: "Ce que personne ne vous dit sur la compta, c'est que le tableur ment à chaque fin de mois.", nouveau: "Ce que personne ne vous dit sur le recrutement, c'est que le dossier ment à chaque fin de semaine." },
  { id: "m2", groupe: "moule", attendu: "ressemble", ancien: "Si vous faites encore vos relances à la main, vous perdez de l'argent sans le savoir.", nouveau: "Si vous faites encore vos plannings à la main, vous perdez du temps sans le savoir." },
  { id: "m3", groupe: "moule", attendu: "ressemble", ancien: "Pendant que vous dormez, le robot trie vos mails et prépare votre journée du lendemain.", nouveau: "Pendant que vous dormez, le robot range vos devis et prépare votre semaine du lundi." },
  { id: "m4", groupe: "moule", attendu: "ressemble", ancien: "Il y a trois erreurs que tous les artisans font avec leurs devis, et la première coûte cher.", nouveau: "Il y a trois erreurs que tous les coiffeurs font avec leurs rendez-vous, et la première coûte cher." },
  // --- Différents, même thème (6) ---
  { id: "d1", groupe: "different", attendu: "different", ancien: "Chaque lundi, vous triez trente mails à la main. Alors on a branché un robot qui classe tout seul.", nouveau: "Un plombier envoie son devis depuis le chantier. Le client signe avant le café." },
  { id: "d2", groupe: "different", attendu: "different", ancien: "Le planning se range seul chaque soir et personne n'y touche.", nouveau: "Votre agenda affiche les créneaux libres des trois équipes en un coup d'œil." },
  { id: "d3", groupe: "different", attendu: "different", ancien: "Avant, on relançait les impayés un par un, à la main, le vendredi après-midi.", nouveau: "Maintenant, chaque retard de paiement déclenche un message poli, puis un appel." },
  { id: "d4", groupe: "different", attendu: "different", ancien: "Dix minutes suffisent pour envoyer toutes les factures du mois.", nouveau: "Le comptable ouvre le dossier, tout est déjà classé, il signe et il part." },
  { id: "d5", groupe: "different", attendu: "different", ancien: "Le client reçoit un rappel automatique la veille du rendez-vous.", nouveau: "Les absences ont fondu depuis que le cabinet prévient ses patients par message." },
  { id: "d6", groupe: "different", attendu: "different", ancien: "On a gagné six heures par semaine sur la saisie des commandes.", nouveau: "La boutique prépare ses colis le matin, et l'après-midi elle répond aux clients." },
  // --- Moule propre (6) : charpentes courantes du français, sujets autres ; ne doivent PAS être refusées ---
  { id: "n1", groupe: "moule-propre", attendu: "different", ancien: "Voici comment un boulanger de quartier a doublé ses commandes en ligne.", nouveau: "Voici comment une kiné de village a rempli son agenda sans publicité." },
  { id: "n2", groupe: "moule-propre", attendu: "different", ancien: "Vous avez déjà perdu une journée entière à cause d'un fichier mal nommé ?", nouveau: "Vous avez déjà cherché un contrat pendant une heure dans votre boîte mail ?" },
  { id: "n3", groupe: "moule-propre", attendu: "different", ancien: "Regardez ce tableau : chaque ligne est une commande, chaque colonne une étape.", nouveau: "Regardez cet écran : en haut les urgences, en bas ce qui peut attendre." },
  { id: "n4", groupe: "moule-propre", attendu: "different", ancien: "C'est simple : vous écrivez le mot, et le guide arrive dans votre messagerie.", nouveau: "C'est rapide : vous scannez le code, et le menu s'affiche sur votre téléphone." },
  { id: "n5", groupe: "moule-propre", attendu: "different", ancien: "Au début, je pensais que c'était trop compliqué pour une petite équipe.", nouveau: "Au départ, je croyais que ça coûtait trop cher pour un indépendant." },
  { id: "n6", groupe: "moule-propre", attendu: "different", ancien: "Pour le prix d'un café par jour, votre comptabilité se fait toute seule.", nouveau: "Pour dix euros par mois, votre site répond aux questions des visiteurs." },
];
