/**
 * REGISTRE DU BANC À L'AVEUGLE « chaîne équipe contre chaîne courte » (accord de Will, 8 $ au plus, 5 sujets). Tout
 * ce qui est ici est marqué TEST.
 *
 * Cinq sujets dans le domaine d'Axion-IA, tirés des bases de l'Usine (`le dépôt privé des bases`, `usine/bases/
 * pour-la-machine/` : 2-tailles, 1-cibles table `douleur`, 3-sujets famille A) : une taille, une cible et une douleur
 * nommée par sujet, UN réseau chacun (budget). Positionnement : NOUS le mettons en place pour le spectateur, jamais
 * « faites-le vous-même » ; aucune nouveauté (« vient de sortir ») ; aucun chiffre sans preuve.
 * Aucune preuve « cas client » réelle : matières « observation » (scénarios types, pas des clients). UN seul cas client
 * FICTIF (registre fictif des fixtures, accord écrit), sujet 3, comme le sujet 3 du banc G4.
 */
import type { Matiere, ObjectifSujet, Preuve, ReseauDeclinaison } from "@/domaine/types";
import { PREUVES_FICTIVES } from "../preuves-fictives";

export const MAINTENANT_BANC_AVEUGLE = "2026-10-17T08:00:00.000Z";
const LE = "2026-10-17T08:00:00.000Z";
const base = { saisiePar: "will" as const, statut: "validee" as const, creeLe: LE, modifieLe: LE, source: { origine: "dictee" as const, detail: "TEST · banc à l'aveugle", date: LE } };

function m(id: string, type: Matiere["type"], texte: string, pilier: string, motsCles: string[], extra: Partial<Matiere> = {}): Matiere {
  return { ...base, id, type, texte, pilier, motsCles, ...extra };
}

export interface SujetAveugle {
  code: string;
  titre: string;
  idee: string;
  /** Cible du brief : la taille (TPE, PME, ETI, grand groupe) est lue par la chaîne équipe (`cibleEquipe`). */
  cible: string;
  /** Douleur de la base 1 (table `douleur`), pour la trace. */
  douleur: string;
  pilier: { id: string; nom: string };
  reseau: ReseauDeclinaison;
  objectif: ObjectifSujet;
  matieres: Matiere[];
  preuves: Preuve[];
  /** Vrai seulement pour le sujet au cas client FICTIF. */
  casFictif?: boolean;
}

const VENTES = { id: "automatiser-ventes", nom: "Automatiser : ventes et prospection" };
const ADMIN = { id: "automatiser-administratif", nom: "Automatiser : administratif et back-office" };
const DONNEES = { id: "automatiser-donnees-pilotage", nom: "Automatiser : données et pilotage" };
const RH = { id: "automatiser-rh", nom: "Automatiser : ressources humaines" };

export const SUJETS_AVEUGLE: SujetAveugle[] = [
  {
    code: "tpe-electricien-devis",
    titre: "TPE · électricien à son compte : les devis tapés le soir",
    idee: "L'électricien qui tape ses devis le soir après le chantier, à partir de notes et de photos, et le client qui signe ailleurs entre-temps",
    cible: "artisan électricien de TPE, le dirigeant",
    douleur: "btp.electricien.d1 + d2",
    pilier: VENTES,
    reseau: "tiktok",
    objectif: "notoriete",
    matieres: [
      m("av1-obs", "observation", "Scénario type, pas un client réel : l'électricien finit son chantier, rentre, et tape ses devis le soir à partir de notes et de photos prises dans la journée.", VENTES.id, ["devis", "soir", "chantier", "photos"]),
      m("av1-cause", "observation", "Le devis part tard parce qu'il faut tout retaper, donc le client qui attend rappelle un concurrent et signe ailleurs.", VENTES.id, ["devis", "client", "concurrent", "retard"]),
      m("av1-idee", "idee-recue", "Les devis, ça se fait le soir, c'est le métier.", VENTES.id, ["devis", "soir"], { croyanceAttribuee: true }),
      m("av1-avis", "avis-will", "Nous mettons en place pour vous un brouillon de devis qui se prépare depuis vos notes et vos photos ; vous relisez et vous l'envoyez.", VENTES.id, ["devis", "brouillon", "notes", "photos"]),
      m("av1-limite", "limite", "Si chaque chantier est unique et que vous ne réutilisez jamais un devis, gardez votre méthode.", VENTES.id, ["devis", "chantier"]),
      m("av1-question", "question-recue", "Est-ce que je peux arrêter de passer mes soirées sur les devis ?", VENTES.id, ["devis", "soirées"]),
    ],
    preuves: [],
  },
  {
    code: "pme-industrie-commandes",
    titre: "PME · dirigeant d'un site de production : les bons de commande ressaisis",
    idee: "Les bons de commande des clients qui arrivent en PDF, en document ou dans le corps d'un e-mail, et que l'administration des ventes ressaisit à la main dans le logiciel de gestion",
    cible: "dirigeant de PME industrielle",
    douleur: "industrie.industriel-site-production (bons de commande ressaisis)",
    pilier: ADMIN,
    reseau: "instagram",
    objectif: "notoriete",
    matieres: [
      m("av2-obs", "observation", "Scénario type, pas un client réel : chaque matin, l'administration des ventes ouvre les commandes reçues en PDF, en document ou dans un e-mail, et les ressaisit une à une dans le logiciel de gestion.", ADMIN.id, ["commandes", "ressaisie", "logiciel de gestion", "e-mail"]),
      m("av2-cause", "observation", "Une référence mal recopiée passe inaperçue, donc la mauvaise pièce part en fabrication et le client appelle pour se plaindre.", ADMIN.id, ["commandes", "erreur", "référence", "fabrication"]),
      m("av2-idee", "idee-recue", "Ressaisir les commandes, c'est le travail de l'administration des ventes.", ADMIN.id, ["commandes", "ressaisie"], { croyanceAttribuee: true }),
      m("av2-avis", "avis-will", "Nous mettons en place pour votre équipe la lecture automatique des commandes : elles arrivent dans le logiciel, une personne vérifie et valide.", ADMIN.id, ["commandes", "logiciel de gestion", "vérifier"]),
      m("av2-limite", "limite", "Si vos commandes arrivent surtout par téléphone, il faut d'abord les faire écrire.", ADMIN.id, ["commandes", "téléphone"]),
      m("av2-question", "question-recue", "Par où on commence pour ne plus ressaisir les commandes ?", ADMIN.id, ["commandes", "ressaisie"]),
    ],
    preuves: [],
  },
  {
    code: "pme-daf-factures-fictif",
    titre: "PME · DAF : les factures fournisseurs saisies une à une (cas client FICTIF, récit permis)",
    idee: "Les factures fournisseurs qui arrivent par courriel, par courrier, en pièce jointe, et que l'équipe comptable saisit une à une",
    cible: "DAF de PME",
    douleur: "compta.directeur-financier-entreprise.d4",
    pilier: ADMIN,
    reseau: "facebook",
    objectif: "notoriete",
    casFictif: true,
    matieres: [
      m("mat-fictive-3", "cas-client", "Ils ont arrêté de ressaisir leurs factures.", ADMIN.id, ["factures", "saisie", "ressaisie"], { preuveId: "prv-fictive-1", accord: { requis: true, obtenu: true, forme: "ecrit" }, nomsSensibles: ["Société Fictive Alpha"] }),
      m("av3-obs", "observation", "Les factures fournisseurs arrivent par courriel, par courrier, en pièce jointe, et l'équipe les saisit une à une.", ADMIN.id, ["factures", "fournisseurs", "saisie"]),
      m("av3-cause", "observation", "Une facture ressaisie à la main, c'est une faute de frappe possible à chaque ligne, donc des écarts à la clôture et des relances fournisseurs.", ADMIN.id, ["factures", "saisie", "erreur", "clôture"]),
      m("av3-avis", "avis-will", "Nous mettons en place pour votre équipe la lecture des factures : elles arrivent pré-remplies, une personne contrôle et valide.", ADMIN.id, ["factures", "contrôle", "valider"]),
      m("av3-limite", "limite", "Si vos factures arrivent encore sur papier, il faut d'abord les numériser.", ADMIN.id, ["factures", "papier"]),
      m("av3-question", "question-recue", "On saisit encore toutes nos factures fournisseurs à la main, c'est normal ?", ADMIN.id, ["factures", "saisie"], { source: { origine: "rendez-vous", detail: "TEST · banc à l'aveugle", date: LE } }),
    ],
    preuves: PREUVES_FICTIVES.filter((p) => p.id === "prv-fictive-1").map((p) => ({ ...p, pilier: ADMIN.id, motsCles: ["factures", "saisie", "ressaisie"] })),
  },
  {
    code: "eti-drh-questions",
    titre: "ETI · DRH : les mêmes questions des salariés tous les jours",
    idee: "Le service RH qui répond tous les jours aux mêmes questions des salariés, congés, bulletin de paie, mutuelle, télétravail, au lieu de s'occuper des vrais sujets humains",
    cible: "DRH d'ETI",
    douleur: "rh.directeur-ressources-humaines.d1",
    pilier: RH,
    reseau: "youtube-shorts",
    objectif: "notoriete",
    matieres: [
      m("av4-obs", "observation", "Scénario type, pas un client réel : dans une ETI à plusieurs sites, le service RH répond chaque jour aux mêmes questions sur les congés, le bulletin de paie, la mutuelle et le télétravail.", RH.id, ["questions", "salariés", "congés", "paie", "mutuelle"]),
      m("av4-cause", "observation", "La réponse change selon la personne qui répond et le site, donc les salariés reposent la question et l'équipe RH n'a plus de temps pour les vrais sujets humains.", RH.id, ["questions", "réponse", "sites", "salariés"]),
      m("av4-idee", "idee-recue", "Répondre aux salariés, c'est le cœur du métier RH.", RH.id, ["salariés", "questions"], { croyanceAttribuee: true }),
      m("av4-avis", "avis-will", "Nous mettons en place pour votre équipe un assistant qui répond à partir de vos règles écrites ; les cas particuliers reviennent toujours à une personne des RH.", RH.id, ["assistant", "règles", "questions", "salariés"]),
      m("av4-limite", "limite", "Si vos règles internes ne sont écrites nulle part, il faut d'abord les écrire.", RH.id, ["règles", "salariés"]),
      m("av4-question", "question-recue", "Est-ce qu'on peut confier les questions des salariés à un outil sans risque sur leurs données ?", RH.id, ["questions", "salariés", "données"]),
    ],
    preuves: [],
  },
  {
    code: "ge-filiale-reporting",
    titre: "Grand groupe · directeur financier de filiale : le même reporting refait pour chacun",
    idee: "Le directeur financier d'une filiale qui refait le même reporting pour le comité de direction, pour le groupe et pour la banque, chacun dans sa forme",
    cible: "directeur financier de filiale d'un grand groupe",
    douleur: "compta.directeur-financier-entreprise.d8",
    pilier: DONNEES,
    reseau: "linkedin",
    objectif: "notoriete",
    matieres: [
      m("av5-obs", "observation", "Scénario type, pas un client réel : dans une filiale, le comité de direction veut le détail, le groupe veut sa forme, la banque veut la synthèse, et le même reporting se refait pour chacun.", DONNEES.id, ["reporting", "filiale", "comité de direction", "synthèse"]),
      m("av5-cause", "observation", "Chaque version est recopiée à la main depuis les mêmes fichiers, donc un chiffre corrigé dans l'une ne l'est pas dans les autres.", DONNEES.id, ["reporting", "chiffres", "fichiers", "erreur"]),
      m("av5-idee", "idee-recue", "Chaque destinataire veut son format, on n'y peut rien.", DONNEES.id, ["reporting", "format"], { croyanceAttribuee: true }),
      m("av5-avis", "avis-will", "Nous mettons en place, sur votre périmètre, un essai encadré : un seul jeu de chiffres, et chaque version se prépare à partir de lui ; votre équipe relit avant l'envoi.", DONNEES.id, ["reporting", "périmètre", "essai encadré", "chiffres"]),
      m("av5-limite", "limite", "Si vos chiffres viennent de systèmes que personne ne peut ouvrir, on commence par un seul reporting.", DONNEES.id, ["reporting", "chiffres"]),
      m("av5-question", "question-recue", "Comment arrêter de refaire le même reporting pour chacun sans tout changer dans le groupe ?", DONNEES.id, ["reporting", "groupe"]),
    ],
    preuves: [],
  },
];
