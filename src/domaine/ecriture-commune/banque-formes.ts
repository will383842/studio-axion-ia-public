/**
 * BANQUE DE FORMES (lot C1.3). PUR, non branché. Pour chaque élément de la recette commune (accroche, douleur, question,
 * promesse, mécanisme, preuve, rupture, appel), des FORMES DÉCRITES : une manière de construire la phrase, jamais une phrase
 * toute faite (une phrase toute faite se recopie, donc se répète). L'appel choisit une forme avec `tirerForme` (tirage sans
 * récents, partagé entre générateurs) au lieu de `g % n`. Au moins 5 formes par rôle, et par réseau de déclinaison.
 * Rappels de Will : on s'occupe de tout (jamais « faites-le vous-même »), pas de nom de ville de siège, pas de promesse de gain.
 */
import { tirerSansRecent } from "@/domaine/ecriture-commune/memoire";
import type { ReseauDeclinaison } from "@/domaine/types";

export const ROLES_FORME = ["accroche", "douleur", "question", "promesse", "mecanisme", "preuve", "rupture", "appel"] as const;
export type RoleForme = (typeof ROLES_FORME)[number];

export interface Forme {
  id: string;
  role: RoleForme;
  nom: string;
  /** La manière de construire la phrase (consigne pour l'écrivain). */
  description: string;
  /** Réseaux où la forme convient. */
  reseaux: readonly ReseauDeclinaison[];
}

const TOUS: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];
const SANS_LINKEDIN: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "facebook"];
const SANS_TIKTOK: readonly ReseauDeclinaison[] = ["instagram", "youtube-shorts", "linkedin", "facebook"];

const f = (role: RoleForme, id: string, nom: string, description: string, reseaux: readonly ReseauDeclinaison[] = TOUS): Forme => ({ id: `${role}-${id}`, role, nom, description, reseaux });

export const BANQUE_FORMES: readonly Forme[] = [
  // ACCROCHE (6 à 11 mots, tension, enjeu qui arrive)
  f("accroche", "chiffre", "Le chiffre qui pique", "Ouvre sur un chiffre concret du quotidien de l'entreprise (heures, euros, relances) puis la conséquence qui arrive, en une phrase."),
  f("accroche", "contradiction", "La contradiction", "Oppose deux faits qui ne vont pas ensemble dans le métier du spectateur, sans les expliquer : la tension reste ouverte."),
  f("accroche", "scene", "La scène coupée", "Commence au milieu d'un geste vécu (un lundi, un mail, un appel) au présent, sans salut, et laisse entendre ce qui va mal tourner."),
  f("accroche", "habitude", "L'habitude gardée", "Annonce une habitude que tout le monde garde dans l'entreprise et qui coûte, sans la juger tout de suite.", SANS_LINKEDIN),
  f("accroche", "decision", "La décision qui attend", "Pose la décision de dirigeant qu'on repousse et ce qu'elle coûte chaque semaine de retard.", SANS_TIKTOK),
  f("accroche", "ecart", "L'écart", "Annonce en une phrase l'écart entre une tâche qui prenait une demi-journée et la même tâche aujourd'hui, sans dire encore comment."),
  // DOULEUR (14 à 20 mots, geste du quotidien et son coût, mots du spectateur)
  f("douleur", "geste", "Le geste répété", "Décris le geste exact, répété chaque jour, avec l'outil ou le papier qu'on a sous la main, puis son coût en temps."),
  f("douleur", "reproche", "Le reproche d'un client", "Raconte le moment où un client ou un collègue relève l'oubli ou le retard, avec ce que cela coûte à l'entreprise."),
  f("douleur", "fin-journee", "La fin de journée", "Place la douleur en fin de journée : ce qui reste à faire quand tout le monde est parti, et pourquoi cela revient chaque soir."),
  f("douleur", "double-saisie", "La double saisie", "Montre la même information recopiée à deux endroits et l'erreur qui finit par s'y glisser."),
  f("douleur", "attente", "L'attente", "Décris ce qui attend sur un bureau ou dans une boîte mail pendant plusieurs jours, et la personne qui s'impatiente."),
  f("douleur", "echeance", "La course contre la montre", "Décris l'échéance qu'on court après chaque mois et le temps passé à rassembler ce qu'il faut avant elle.", SANS_TIKTOK),
  // QUESTION (6 à 12 mots, dans l'adresse de la vidéo, finie par « ? »)
  f("question", "directe", "La question directe", "Pose au spectateur la question que son quotidien lui pose déjà, dans l'adresse de la vidéo, avec un verbe d'action."),
  f("question", "combien", "Combien", "Demande combien de temps ou d'argent part dans ce geste chaque semaine, sans donner le chiffre."),
  f("question", "qui", "Qui s'en charge", "Demande qui, dans l'entreprise, s'en occupe aujourd'hui et ce qu'il ne fait pas pendant ce temps."),
  f("question", "quand", "Quand", "Demande à quand remonte la dernière fois où cela s'est fait sans accroc, pour ouvrir le doute."),
  f("question", "et-si", "Et si cela changeait", "Demande ce que le spectateur ferait de la journée gagnée, en restant concret sur un usage de ce temps.", SANS_LINKEDIN),
  f("question", "pourquoi", "Pourquoi encore", "Demande pourquoi ce geste se fait encore à la main alors que le reste de l'entreprise a avancé.", SANS_TIKTOK),
  // PROMESSE (8 à 12 mots, ce qui change, sans annoncer un nombre d'étapes)
  f("promesse", "temps", "Le temps rendu", "Dis le temps rendu au spectateur, avec son unité, et ce que cela laisse libre pour son métier."),
  f("promesse", "zero-oubli", "Plus d'oubli", "Promets qu'un oubli précis n'arrive plus, en nommant l'oubli et pas seulement le principe."),
  f("promesse", "tout-seul", "Ça tourne seul", "Promets qu'une tâche nommée se fait sans personne à partir de maintenant, et qui l'a mise en place."),
  f("promesse", "client", "Le client prévenu", "Promets que le client est informé à temps, sans que l'entreprise ait à relancer."),
  f("promesse", "demain", "Dès demain", "Place la promesse dans un lendemain concret du spectateur, avec ce qu'il trouvera en arrivant."),
  f("promesse", "voir", "Ce que vous allez voir", "Annonce ce qui va être montré et ce que cela change pour l'entreprise, sans compter d'étapes.", SANS_LINKEDIN),
  // MÉCANISME (une seule idée montrée, à l'indicatif, avec l'outil ou « on » comme sujet)
  f("mecanisme", "declencheur", "Le déclencheur", "Décris le fait qui lance tout (un mail reçu, un formulaire rempli) puis ce qui se passe seul, dans l'ordre, sans impératif."),
  f("mecanisme", "tri", "Le tri", "Montre un tri fait seul : ce qui arrive, comment c'est rangé, ce qui revient à une personne."),
  f("mecanisme", "recopie", "La recopie supprimée", "Montre une information saisie une fois et reprise partout où elle sert, avec l'outil qui le fait."),
  f("mecanisme", "rappel", "Le rappel automatique", "Montre un rappel qui part au bon moment vers la bonne personne, et ce qui est noté après."),
  f("mecanisme", "resume", "Le résumé prêt", "Montre un document ou un compte rendu qui arrive déjà préparé, avec ce qu'on y trouve."),
  f("mecanisme", "verification", "La vérification", "Montre une vérification faite avant l'envoi, et le cas où elle arrête quelque chose pour éviter une erreur."),
  // PREUVE (14 à 22 mots, avant et après, vraie preuve ou exemple illustratif signalé)
  f("preuve", "avant-apres", "Avant puis maintenant", "Donne l'avant et le maintenant d'un cas, chacun avec son unité, dans deux phrases courtes."),
  f("preuve", "metier", "Prenons un métier", "Prends un métier précis et un geste précis de ce métier, avec la mention d'exemple illustratif si le cas n'est pas réel."),
  f("preuve", "mesure", "La mesure relevée", "Cite une mesure réellement relevée, avec la période et la source, sans arrondir en faveur de l'entreprise."),
  f("preuve", "temoin", "La phrase d'un client", "Rapporte ce qu'un client réel a dit, avec son accord, sans le citer nommément."),
  f("preuve", "journee", "Une journée type", "Décris une journée type avant et après, en deux ou trois repères d'horloge."),
  f("preuve", "ecran", "Ce qu'on voit à l'écran", "Appuie la preuve sur ce que l'écran montre, en disant ce qu'on regarde et ce qu'il faut y lire.", SANS_LINKEDIN),
  // RUPTURE (8 à 14 mots, c'est NOUS qui mettons en place)
  f("rupture", "on-installe", "On installe tout", "Dis que nous mettons tout en place de bout en bout, avec le verbe d'action à la forme « on »."),
  f("rupture", "vous-gardez", "Vous gardez l'essentiel", "Dis ce que le spectateur garde pour son métier pendant que nous nous occupons du reste."),
  f("rupture", "reglage", "Réglé une fois", "Dis que nous réglons une fois, avec lui, puis que cela tient seul ; nous restons responsables du suivi."),
  f("rupture", "notre-metier", "C'est notre métier", "Dis que c'est notre travail de tous les jours, sans en faire une démonstration de force."),
  f("rupture", "sans-effort", "Sans y toucher", "Dis que le spectateur n'a rien à installer ni à apprendre : nous le faisons pour lui."),
  f("rupture", "a-votre-place", "À votre place", "Dis que nous prenons cette tâche en charge à sa place, de la mise en route au suivi.", SANS_TIKTOK),
  // APPEL (3 à 6 mots, une seule demande, phrase affirmative, sans virgule)
  f("appel", "commentaire", "Un mot en commentaire", "Demande un mot précis en commentaire, lié à l'idée de la vidéo."),
  f("appel", "message", "Un message privé", "Invite à écrire en message privé pour en parler, en une phrase affirmative."),
  f("appel", "diagnostic", "Un point rapide", "Propose un court échange pour regarder ensemble la situation, en une phrase."),
  f("appel", "enregistrer", "Garder la vidéo", "Invite à garder la vidéo pour la montrer à quelqu'un de l'équipe.", SANS_LINKEDIN),
  f("appel", "lien", "Le lien", "Renvoie vers le lien de prise de contact, sans le répéter dans le texte."),
  f("appel", "equipe", "Partager à l'équipe", "Invite à envoyer la vidéo à la personne de l'équipe concernée.", SANS_TIKTOK),
];

/** Les formes d'un rôle, éventuellement limitées à un réseau. */
export function formesDuRole(role: RoleForme, reseau?: ReseauDeclinaison): Forme[] {
  return BANQUE_FORMES.filter((x) => x.role === role && (!reseau || x.reseaux.includes(reseau)));
}

/** Tire une forme du rôle pour ce réseau, hors des `recents` (identifiants de forme). Déterministe pour une graine. */
export function tirerForme(role: RoleForme, reseau: ReseauDeclinaison, recents: readonly string[], graine: string): Forme {
  const formes = formesDuRole(role, reseau);
  const id = tirerSansRecent(formes.map((x) => x.id), recents, `${role}|${reseau}|${graine}`);
  return formes.find((x) => x.id === id) as Forme;
}
