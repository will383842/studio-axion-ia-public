/**
 * HISTOIRE — remplacés le 15/10 par le gabarit cadré (`exemples-v4.ts`) : ils ne passent plus les règles en vigueur
 * (trop longs, sans idée ni gain déclarés, quatre étapes de trois phrases). Gardés comme données (les essais du
 * découpage « reference/3 » lisent encore le script Formation) ; leur grille est celle de la v3 (critères d'alors).
 *
 * LES QUATRE SCRIPTS EXEMPLES DE LA v3 (14/10/2026), un par série, écrits en appliquant les consignes à la lettre :
 * réseau TikTok/Reels/Shorts (« courts »), fin = appel de diagnostic. Ils sont recopiés mot pour mot dans
 * `docs/formats/tableau-anime-scripts/exemples-v3/*.md` (vérifié par `exemples-v3.test.ts`), et ils passent TOUS les
 * contrôles en code du générateur. Chacun porte sa grille notée, ses affirmations vérifiées et ce qui reste à préparer.
 * Le script « Formation » reprend le sujet de la vidéo jugée par Will le 14/10 (v-f1739d6a4f51).
 */
import type { DemandeScriptTableau, EcritureScript } from "@/domaine/scripts-tableau";

/** Une ligne de la grille v3 (ses critères ont été remplacés le 15/10). */
interface LigneGrilleV3 {
  critere: string;
  respecte: boolean;
  remarque: string;
}

export interface ExempleV3 {
  /** Nom du fichier dans `exemples-v3/` (sans « .md »). */
  fichier: string;
  titre: string;
  demande: DemandeScriptTableau;
  /** Écrite avant le gabarit cadré : ni idée, ni gain, ni métier déclarés. */
  ecriture: Omit<EcritureScript, "idee" | "gain" | "metierExemple">;
  grille: LigneGrilleV3[];
  /** « Que manque-t-il pour appliquer seul ? » : vide, sinon le script n'est pas livré. */
  manques: string[];
}

const p = (dit: string, ecran: string) => ({ dit, ecran });
const ok = (critere: string, remarque: string): LigneGrilleV3 => ({ critere, respecte: true, remarque });

/* ------------------------------------------------------------------ */
/* Formation                                                           */
/* ------------------------------------------------------------------ */

const FORMATION: ExempleV3 = {
  fichier: "01-formation",
  titre: "Formation · Vos équipes utilisent déjà l'IA en cachette",
  demande: {
    serie: "formation",
    sujet: "Vos équipes utilisent déjà l'IA en cachette : formez-les avant qu'elles fassent des erreurs",
    public: "Dirigeants de TPE et PME dont les salariés utilisent ChatGPT sans cadre",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : ce que l'équipe colle aujourd'hui dans l'IA, et la règle à lui apprendre",
  },
  ecriture: {
    script: {
      accroche: [p("Un salarié colle un contrat client dans ChatGPT, sans vous le dire.", "Un contrat client dans ChatGPT")],
      douleur: [
        p("Le nom du client et ses conditions sortent de l'entreprise.", "Nom et conditions : dehors"),
        p("Selon les réglages, ils peuvent servir à entraîner l'outil.", "Peut entraîner l'outil"),
        p("Si le client l'apprend, c'est votre parole qui est en jeu.", "Votre parole en jeu"),
      ],
      promesse: [p("Voici quoi apprendre à votre équipe : une règle en trois couleurs.", "Une règle, trois couleurs")],
      etapes: [
        {
          action: p("Un. Mettez en vert les textes sans client ni salarié.", "1. Vert : personne de cité"),
          comment: [p("Une annonce d'emploi, une fiche produit, un brouillon de publication.", "Annonce, fiche produit, publication")],
          resultat: p("Ceux-là se collent tels quels.", "Collés tels quels"),
        },
        {
          action: p("Deux. Mettez en orange les textes qui citent quelqu'un.", "2. Orange : on retire"),
          comment: [p("On retire avant de coller : noms, adresses, téléphones, e-mails, numéros de compte, et tout détail qui reconnaît quelqu'un.", "Noms, adresses, numéros, détails")],
          resultat: p("L'outil travaille sur le fond, sans savoir de qui il parle.", "Le fond, sans les noms"),
        },
        {
          action: p("Trois. Mettez en rouge ce qui n'entre jamais dans l'outil.", "3. Rouge : jamais collé"),
          comment: [p("Santé, fiches de paie, mots de passe, contrats confidentiels : sensibles même sans les noms.", "Santé, paie, mots de passe")],
          resultat: p("Chacun sait où s'arrêter.", "Chacun sait où s'arrêter"),
        },
        {
          action: p("Quatre. Affichez la règle, puis coupez l'entraînement dans les paramètres.", "4. Afficher, couper l'entraînement"),
          comment: [p("Dans ChatGPT, chacun décoche « Améliorer le modèle pour tout le monde ».", "Décocher « Améliorer le modèle »")],
          resultat: p("Vos textes ne servent plus à entraîner l'outil.", "Plus d'entraînement"),
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons une agence immobilière et un compromis de vente.", "Agence : un compromis"),
          p("Avant, l'assistante collait le compromis entier.", "Avant : tout le compromis"),
          p("Maintenant, elle écrit Vendeur A, Acheteur B, et retire aussi les références du cadastre.", "Après : Vendeur A, Acheteur B"),
          p("Ces références suffisent à retrouver le bien, donc son adresse.", "Le cadastre trahit l'adresse"),
        ],
      },
      aRetenir: [p("Ce qui permet de reconnaître quelqu'un reste dans l'entreprise.", "Ce qui reconnaît reste dedans")],
      appel: [p("Axion-IA forme les équipes à l'IA sur leurs vraies tâches.", "Former sur les vraies tâches"), p("Réservez un appel de diagnostic.", "Réservez un diagnostic")],
    },
    motsDouleur: ["contrat client", "ChatGPT", "sans vous le dire"],
    sources: [],
    affirmations: [
      { extrait: "Le nom du client et ses conditions sortent de l'entreprise", nature: "fait", pourquoi: "Coller un texte dans un outil en ligne l'envoie aux serveurs de l'éditeur : il quitte le système informatique de l'entreprise." },
      {
        extrait: "Selon les réglages, ils peuvent servir à entraîner l'outil",
        nature: "fait",
        pourquoi: "Politique d'OpenAI pour les comptes ChatGPT personnels (gratuit, Plus) : les contenus peuvent servir à améliorer les modèles tant que l'option n'est pas décochée ; les offres entreprise ne s'en servent pas par défaut. D'où « selon les réglages » et « peuvent ».",
      },
      { extrait: "c'est votre parole qui est en jeu", nature: "fait", pourquoi: "Un contrat client contient souvent une clause de confidentialité ; même sans clause, le client a confié ces informations à l'entreprise. Formulé au conditionnel (« si le client l'apprend »)." },
      { extrait: "Mettez en rouge ce qui n'entre jamais dans l'outil", nature: "consigne", pourquoi: "« Jamais » est une consigne de prudence donnée à l'équipe, pas un fait : voir la phrase suivante pour le pourquoi." },
      {
        extrait: "Santé, fiches de paie, mots de passe, contrats confidentiels : sensibles même sans les noms",
        nature: "fait",
        pourquoi: "Les données de santé sont une catégorie particulière du RGPD (article 9) ; une fiche de paie garde des montants et des repères qui désignent une personne ; un mot de passe reste un secret sans nom ; une clause de confidentialité couvre le contenu, pas seulement les noms.",
      },
      { extrait: "On retire avant de coller : noms, adresses, téléphones, e-mails, numéros de compte, et tout détail qui reconnaît quelqu'un", nature: "consigne", pourquoi: "C'est la liste des éléments qui identifient une personne directement (nom, coordonnées, numéros) ou indirectement (un détail unique), au sens de la définition des données personnelles du RGPD (article 4)." },
      { extrait: "chacun décoche « Améliorer le modèle pour tout le monde »", nature: "consigne", pourquoi: "Chaque compte a son réglage : chacun le fait sur le sien. Nom de l'option dans Paramètres, Contrôles des données de ChatGPT en français (à revérifier le jour de la publication : l'éditeur peut renommer l'option)." },
      { extrait: "Vos textes ne servent plus à entraîner l'outil", nature: "fait", pourquoi: "OpenAI indique qu'une fois l'option décochée, les nouvelles conversations ne servent plus à entraîner ses modèles ; cela ne vaut pas pour le passé, d'où « ne servent plus »." },
      { extrait: "Ces références suffisent à retrouver le bien, donc son adresse", nature: "fait", pourquoi: "Les références cadastrales (section et numéro de parcelle) désignent une parcelle précise, consultable sur le cadastre public : avec elles, on retrouve le bien et son adresse." },
    ],
    variantes: [],
    aPreparer: [
      "Revérifier le nom exact de l'option « Améliorer le modèle pour tout le monde » dans ChatGPT le jour de la publication",
      "La feuille « Vert, orange, rouge » d'une page, avec un exemple par couleur",
      "Le lien de réservation de l'appel de diagnostic",
    ],
  },
  grille: [
    ok("accroche-douleur", "La douleur en une phrase (un contrat client collé en cachette), lisible sans le son : 5 mots à l'écran."),
    ok("douleur-vecue", "Trois conséquences vraies et concrètes pour le dirigeant : les données sortent, l'outil peut s'en servir, sa parole est en jeu."),
    ok("solution-annoncee", "« Quoi coller, avec une règle en trois couleurs » : une promesse claire, aucun « problème »."),
    ok("etapes-completes", "Chaque couleur dit QUOI (exemples de documents), POURQUOI (rouge) et le résultat ; l'étape 4 donne le réglage exact."),
    ok("applicable-seul", "Le soir même : la feuille de trois couleurs et un réglage à décocher. Rien d'autre à chercher."),
    ok("exemple-avant-apres", "Avant / maintenant, et un détail neuf : les références du cadastre trahissent l'adresse."),
    ok("organisation", "Accroche, douleur, solution, quatre étapes, exemple, à retenir, appel : dans l'ordre, rien de répété."),
    ok("verite", "Aucune affirmation absolue sur un fait ; neuf affirmations relevées et justifiées ; aucun chiffre ; le RGPD cité nulle part à voix haute, seulement dans les justifications."),
    ok("une-seule-demande", "Une phrase Axion de 10 mots, puis une seule demande : « Réservez un appel de diagnostic. » (5 mots)."),
    ok("phrases-claires", "Phrase la plus longue : 18 mots (la liste de ce qu'on retire). Aucun mot vague."),
  ],
  manques: [],
};

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

const AUDIT: ExempleV3 = {
  fichier: "02-audit",
  titre: "Audit · Trouver où part le temps, en une semaine",
  demande: {
    serie: "audit",
    sujet: "Trouver en une semaine les trois tâches qui vous coûtent le plus de temps",
    public: "Dirigeants de petites entreprises qui finissent tard",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : relire la grille ensemble et choisir la première tâche à alléger",
  },
  ecriture: {
    script: {
      accroche: [p("Vous finissez à vingt heures sans savoir où est passée la journée.", "Où est passée la journée ?")],
      douleur: [
        p("Des adresses recopiées, des factures relancées, la même question trois fois.", "Recopier, relancer, répéter"),
        p("Ce temps-là ne se voit nulle part, et c'est lui qui vous manque le soir.", "Un temps invisible"),
      ],
      promesse: [p("Voici comment trouver, en une semaine, les trois tâches qui vous coûtent le plus.", "Une semaine, trois tâches")],
      etapes: [
        {
          action: p("Un. Notez chaque tâche que vous faites plus d'une fois.", "1. Noter les tâches refaites"),
          comment: [p("Une feuille près du clavier, trois mots par tâche : relancer une facture, recopier une adresse.", "Trois mots par tâche")],
          resultat: p("Vendredi, vous avez la liste de ce qui revient.", "La liste de ce qui revient"),
        },
        {
          action: p("Deux. Tracez un bâton à côté de la tâche chaque fois qu'elle revient.", "2. Un bâton à chaque fois"),
          comment: [p("Pas de chronomètre : un trait, et vous reprenez.", "Un trait, pas de chrono")],
          resultat: p("Vous voyez combien de fois chaque tâche revient dans la semaine.", "Combien de fois"),
        },
        {
          action: p("Trois. Écrivez à côté combien de minutes prend chaque tâche, une seule fois.", "3. Les minutes, une fois"),
          comment: [p("Une estimation suffit ; vendredi, multipliez les bâtons par les minutes.", "Bâtons × minutes")],
          resultat: p("Entourez les trois plus gros totaux : c'est là que part votre temps.", "Les trois plus gros totaux"),
        },
        {
          action: p("Quatre. Pour chacune des trois, écrivez ce qui entre et ce qui sort.", "4. Entrée, sortie"),
          comment: [p("Ce qui entre : un e-mail reçu. Ce qui sort : un devis rempli.", "Entre : e-mail. Sort : devis")],
          resultat: p("Vous savez précisément quoi confier à un outil ou à quelqu'un.", "Quoi confier, et à qui"),
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons un plombier persuadé de perdre son temps au téléphone.", "Plombier : le téléphone ?"),
          p("Avant, il voulait un standard pour filtrer les appels.", "Avant : un standard"),
          p("Maintenant, sa feuille montre autre chose : il recopie les coordonnées des e-mails dans ses devis.", "Après : les e-mails recopiés"),
          p("C'est cette tâche, et pas le téléphone, qu'il confie en premier.", "Il confie celle-là d'abord"),
        ],
      },
      aRetenir: [p("Avant d'acheter un outil, comptez ce qui revient dans votre semaine.", "Compter avant d'acheter")],
      appel: [p("Axion-IA aide les dirigeants à voir où part leur temps.", "Voir où part le temps"), p("Réservez un appel de diagnostic.", "Réservez un diagnostic")],
    },
    motsDouleur: ["vingt heures", "journée"],
    sources: [],
    affirmations: [
      { extrait: "Ce temps-là ne se voit nulle part", nature: "fait", pourquoi: "Ces tâches courtes n'apparaissent dans aucun agenda ni logiciel : rien ne les compte tant qu'on ne les note pas. Formulé sans chiffre." },
      { extrait: "c'est là que part votre temps", nature: "fait", pourquoi: "Par construction : bâtons multipliés par minutes donnent le temps de la semaine par tâche ; les trois plus gros totaux sont, sur cette semaine, ceux qui en prennent le plus." },
      { extrait: "il recopie les coordonnées des e-mails dans ses devis", nature: "exemple", pourquoi: "Détail de l'exemple illustratif, signalé à l'écran ; aucun client réel n'est présenté." },
    ],
    variantes: [],
    aPreparer: ["Le lien de réservation de l'appel de diagnostic", "Une grille d'une page (tâche, bâtons, minutes, total) à montrer pendant l'appel"],
  },
  grille: [
    ok("accroche-douleur", "La douleur vécue en une phrase : 5 mots à l'écran."),
    ok("douleur-vecue", "Des gestes que tout dirigeant reconnaît, et la conséquence : le temps manque le soir."),
    ok("solution-annoncee", "En une semaine, les trois tâches qui coûtent le plus : une promesse claire."),
    ok("etapes-completes", "Chaque étape : un geste, le comment (trois mots, un trait, une estimation) et le résultat."),
    ok("applicable-seul", "Une feuille et un stylo, dès le soir : rien d'autre à chercher."),
    ok("exemple-avant-apres", "Avant (un standard) / maintenant (les e-mails recopiés) : la grille corrige une fausse piste."),
    ok("organisation", "Ordre fixe, rien de répété ; « à retenir » ne redit pas les étapes."),
    ok("verite", "Aucun chiffre statistique, aucune promesse de gain ; trois affirmations justifiées."),
    ok("une-seule-demande", "Une phrase Axion de 10 mots, puis la seule demande."),
    ok("phrases-claires", "Phrase la plus longue : 15 mots."),
  ],
  manques: [],
};

/* ------------------------------------------------------------------ */
/* Automatisations                                                     */
/* ------------------------------------------------------------------ */

const AUTOMATISATIONS: ExempleV3 = {
  fichier: "03-automatisations",
  titre: "Automatisations · La relance de devis qui part toute seule",
  demande: {
    serie: "automatisations",
    sujet: "La relance des devis sans réponse, qui part toute seule",
    public: "Artisans et petites entreprises qui envoient des devis",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : brancher la relance sur l'outil de devis déjà utilisé",
  },
  ecriture: {
    script: {
      accroche: [p("Votre devis est parti il y a dix jours, et personne ne l'a relancé.", "Devis envoyé, jamais relancé")],
      douleur: [
        p("Le client hésitait, il a reçu un autre devis, il a signé ailleurs.", "Il a signé ailleurs"),
        p("Vous l'apprenez trop tard, avec un chantier en moins.", "Un chantier en moins"),
      ],
      promesse: [p("Voici comment faire partir cette relance toute seule.", "La relance part seule")],
      etapes: [
        {
          action: p("Un. Fixez le déclencheur : un devis sans réponse depuis sept jours.", "1. Sept jours sans réponse"),
          comment: [p("Chaque devis a une date d'envoi et un statut, dans votre logiciel ou un tableau.", "Date d'envoi, statut")],
          resultat: p("L'outil sait exactement quand relancer.", "Il sait quand relancer"),
        },
        {
          action: p("Deux. Écrivez le message de relance une fois pour toutes.", "2. Écrire le message une fois"),
          comment: [p("Le prénom du client, le devis concerné, une seule question : avez-vous besoin d'un détail ?", "Prénom, devis, une question")],
          resultat: p("Chaque relance sonne comme vous, sans la réécrire.", "Votre ton, sans réécrire"),
        },
        {
          action: p("Trois. Branchez la relance dans votre logiciel de devis, ou avec Zapier ou Make.", "3. Brancher : logiciel, Zapier, Make"),
          comment: [p("Chaque matin, l'outil cherche les devis « envoyé » depuis sept jours, envoie le message, puis note « relancé ».", "Chaque matin : chercher, envoyer, noter")],
          resultat: p("La relance part même les jours où vous êtes sur un chantier.", "Elle part sans vous"),
        },
        {
          action: p("Quatre. Arrêtez la relance dès que le client répond, puis testez-la sur vous.", "4. Stop dès la réponse"),
          comment: [p("Condition d'arrêt : statut accepté ou refusé ; le test part vers votre adresse.", "Accepté ou refusé : stop")],
          resultat: p("Le client reçoit une seule relance, utile, pas un harcèlement.", "Une seule relance utile"),
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons un menuisier qui envoie ses devis de cuisine.", "Menuisier : devis de cuisine"),
          p("Avant, il relançait quand il y pensait, souvent un mois plus tard.", "Avant : un mois plus tard"),
          p("Maintenant, la relance part au septième jour avec une photo d'une cuisine posée.", "Après : septième jour, une photo"),
          p("Le client a une raison concrète de rouvrir le devis.", "Une raison de répondre"),
        ],
      },
      aRetenir: [p("Une relance part sur une date et s'arrête sur une réponse.", "Partir sur une date")],
      appel: [p("Axion-IA installe ces relances dans les outils que vous avez déjà.", "Dans vos outils actuels"), p("Réservez un appel de diagnostic.", "Réservez un diagnostic")],
    },
    motsDouleur: ["devis", "dix jours", "relancé"],
    sources: [],
    affirmations: [
      { extrait: "personne ne l'a relancé", nature: "exemple", pourquoi: "Situation décrite au spectateur (« votre devis »), pas un fait général : c'est la scène de l'accroche." },
      { extrait: "Branchez la relance dans votre logiciel de devis, ou avec Zapier ou Make", nature: "consigne", pourquoi: "Zapier et Make sont des outils d'automatisation existants qui savent lire un tableau ou un logiciel et envoyer un e-mail à une condition ; certains logiciels de devis le font déjà, d'où « ou »." },
    ],
    variantes: [],
    aPreparer: ["Le lien de réservation de l'appel de diagnostic", "Vérifier que Zapier et Make proposent toujours la lecture d'un tableau et l'envoi d'e-mail en offre de départ"],
  },
  grille: [
    ok("accroche-douleur", "La douleur dite dès la première phrase : un devis jamais relancé."),
    ok("douleur-vecue", "La conséquence vraie : un client qui signe ailleurs, un chantier perdu."),
    ok("solution-annoncee", "« Faire partir cette relance toute seule »."),
    ok("etapes-completes", "Déclencheur, message, branchement (avec la marque « relancé »), arrêt : chaque étape a son comment et son résultat."),
    ok("applicable-seul", "Avec un tableau et un outil gratuit ou le logiciel de devis, sans aide."),
    ok("exemple-avant-apres", "Avant (un mois) / maintenant (septième jour), et un détail neuf : la photo d'une cuisine posée."),
    ok("organisation", "Ordre fixe, rien de répété."),
    ok("verite", "Aucun taux de réponse promis ; la relance est marquée « relancé » pour ne partir qu'une fois ; deux affirmations justifiées."),
    ok("une-seule-demande", "Une phrase Axion de 11 mots, puis la seule demande."),
    ok("phrases-claires", "Phrase la plus longue : 16 mots."),
  ],
  manques: [],
};

/* ------------------------------------------------------------------ */
/* Coaching 1 to 1                                                     */
/* ------------------------------------------------------------------ */

const COACHING: ExempleV3 = {
  fichier: "04-coaching",
  titre: "Coaching 1 to 1 · Trancher une décision repoussée",
  demande: {
    serie: "coaching",
    sujet: "Trancher une décision qu'on repousse depuis des semaines",
    public: "Dirigeants qui hésitent sur une embauche, un investissement, un prix",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : poser la décision en cours sur la feuille, ensemble",
  },
  ecriture: {
    script: {
      accroche: [p("Vous repoussez la même décision depuis des semaines.", "La décision repoussée")],
      douleur: [
        p("Embaucher ou attendre, vous y pensez le soir, et rien n'avance.", "Le soir, rien n'avance"),
        p("Pendant ce temps, l'occasion passe, ou l'équipe s'épuise.", "L'occasion passe"),
      ],
      promesse: [p("Voici comment trancher en une soirée, avec une feuille et quatre questions.", "Une soirée, quatre questions")],
      etapes: [
        {
          action: p("Un. Écrivez la décision en une phrase, avec deux options seulement.", "1. Une phrase, deux options"),
          comment: [p("Par exemple : embaucher un vendeur en mars, ou attendre septembre.", "Mars, ou septembre")],
          resultat: p("Vous savez enfin ce que vous comparez.", "Ce que vous comparez"),
        },
        {
          action: p("Deux. Pour chaque option, écrivez le pire scénario réaliste et comment le rattraper.", "2. Le pire, et le rattrapage"),
          comment: [p("Une embauche ratée se rattrape pendant la période d'essai ; une occasion perdue, rarement.", "Ce qui se rattrape")],
          resultat: p("Vous voyez quelle erreur coûte le moins cher.", "L'erreur la moins chère"),
        },
        {
          action: p("Trois. Choisissez le signe qui vous ferait dire oui.", "3. Le signe du oui"),
          comment: [p("Un fait que vous pouvez vérifier : le carnet de commandes rempli à trois mois.", "Un fait vérifiable")],
          resultat: p("La décision dépend d'un fait, plus de votre humeur du soir.", "Un fait, pas l'humeur"),
        },
        {
          action: p("Quatre. Fixez une date, et dites-la à une personne de confiance.", "4. Une date, dite à quelqu'un"),
          comment: [p("Ce jour-là, vous regardez le signe, et vous suivez ce qu'il dit.", "Ce jour-là, on suit le signe")],
          resultat: p("La décision a une échéance, et quelqu'un vous la rappellera.", "Une échéance tenue"),
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons une boulangère qui hésite à embaucher une vendeuse.", "Boulangère : embaucher ?"),
          p("Avant, elle remettait la question à chaque fin de mois.", "Avant : chaque fin de mois"),
          p("Maintenant, son signe est écrit : trois samedis de suite avec la file sur le trottoir.", "Après : trois samedis de file"),
          p("Le troisième samedi arrive en avril, et elle publie l'annonce le lundi.", "Annonce publiée le lundi"),
        ],
      },
      aRetenir: [p("Une décision se tranche sur un fait choisi d'avance, à une date fixée.", "Un fait, une date")],
      appel: [p("Axion-IA accompagne les dirigeants sur ces décisions, en tête-à-tête.", "En tête-à-tête"), p("Réservez un appel de diagnostic.", "Réservez un diagnostic")],
    },
    motsDouleur: ["repoussez", "décision", "des semaines"],
    sources: [],
    affirmations: [
      { extrait: "rien n'avance", nature: "exemple", pourquoi: "Ressenti du spectateur dans la situation décrite (« vous y pensez le soir »), pas un fait général." },
      { extrait: "Une embauche ratée se rattrape pendant la période d'essai", nature: "fait", pourquoi: "Code du travail, articles L1221-19 et suivants : un CDI peut comporter une période d'essai pendant laquelle chaque partie peut rompre plus simplement. « Se rattrape » reste prudent : la rupture a des règles (délai de prévenance)." },
      { extrait: "une occasion perdue, rarement", nature: "fait", pourquoi: "Formulé « rarement », pas « jamais » : une occasion (un marché, un local, un candidat) ne revient pas toujours." },
    ],
    variantes: [],
    aPreparer: ["Le lien de réservation de l'appel de diagnostic", "Une feuille « une décision, quatre questions » à montrer pendant l'appel"],
  },
  grille: [
    ok("accroche-douleur", "La douleur en une phrase courte : 3 mots à l'écran."),
    ok("douleur-vecue", "Le soir, l'hésitation ; la conséquence : l'occasion passe ou l'équipe s'épuise."),
    ok("solution-annoncee", "« Trancher en une soirée, avec une feuille et quatre questions »."),
    ok("etapes-completes", "Chaque étape : une action, un exemple de contenu, ce que l'on y gagne."),
    ok("applicable-seul", "Une feuille et une personne de confiance : rien d'autre."),
    ok("exemple-avant-apres", "Avant / maintenant, et un détail neuf : un signe observable (la file sur le trottoir)."),
    ok("organisation", "Ordre fixe, rien de répété."),
    ok("verite", "Le seul fait juridique (période d'essai) est formulé avec prudence et justifié."),
    ok("une-seule-demande", "Une phrase Axion de 10 mots, puis la seule demande."),
    ok("phrases-claires", "Phrase la plus longue : 15 mots."),
  ],
  manques: [],
};

export const EXEMPLES_V3: readonly ExempleV3[] = [FORMATION, AUDIT, AUTOMATISATIONS, COACHING];

/** Copie neuve d'un exemple (les tests peuvent la modifier sans toucher aux autres). */
export function exempleV3(fichier: string): ExempleV3 {
  const e = EXEMPLES_V3.find((x) => x.fichier === fichier);
  if (!e) throw new Error(`Exemple v3 inconnu : ${fichier}`);
  return structuredClone(e);
}

/** L'écriture d'un exemple v3, complétée des champs du gabarit cadré, vides (comme une trace d'avant le 15/10). */
export function ecritureV3(e: ExempleV3): EcritureScript {
  return { idee: "", gain: { formule: "", unite: "" }, metierExemple: "", ...structuredClone(e.ecriture) };
}
