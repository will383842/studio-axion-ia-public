/**
 * MESURE DU CALIBRAGE DES CONTRÔLES DE COMPRÉHENSION (lot F, 19/10/2026). Aucun appel payant : on exécute le code des
 * contrôles sur des textes déjà dans le dépôt (témoins) et sur des contre-exemples minimaux écrits à la main.
 * Utilisé par `calibrage-comprehension.test.ts` (qui fige les chiffres) et par le document
 * `docs/ecriture/CALIBRAGE-COMPREHENSION-2026-10-19.md` (les tableaux en viennent).
 *
 * Deux familles de contrôles :
 *  - VERSION (`controles-script/`) : C95 positionnement, C96 tutoriel, C97 question, C98 fin qui redit l'accroche, C99 rupture ;
 *  - TABLEAU (`scripts-tableau-controles.ts`) : positionnement, etape-imperatif (tutoriel), promesse-nombre, question-spectateur,
 *    redit-accroche, densite-scene, ecran-redit.
 */
import { codesLeves, controlerVersion, NIVEAUX, type EntreeControle } from "@/domaine/controles-script";
import { phrasesDe } from "@/domaine/lecture";
import { comparerScripts } from "@/domaine/ecriture-commune/ressemblance";
import { evaluerQualite } from "@/domaine/qualite-script";
import { RECETTE_ECRIRE_AVOCAT } from "@/domaine/qualite-script/recettes";
import type { EcritureScript } from "@/domaine/scripts-tableau";
import {
  controlerDensiteScene,
  controlerEcranRedit,
  controlerEtapes,
  controlerPositionnement,
  controlerPromesse,
  controlerQuestionSpectateur,
  controlerRediteAccroche,
  type DefautScript,
} from "@/domaine/scripts-tableau-controles";
import { CORPUS_60 } from "../ecriture-commune/corpus-60";
import { PAIRES } from "../ecriture-commune/paires";
import { bloc, seg } from "../helpers/g3";
import { versionV4 } from "../helpers/v4";
import { BON } from "../qualite-script/aide";
import { normaliser as normaliserCalibrage, SCRIPTS_CALIBRAGE } from "../qualite-script/fixtures-calibrage";
import { ecritureModele } from "../tableau-scripts/modele-valide";
import { ecritureV3, EXEMPLES_V3 } from "../tableau-scripts/exemples-v3";
import { EXEMPLES_V4 } from "../tableau-scripts/exemples-v4";
import { ecriture1510 } from "../tableau-scripts/script-15-10";

/* ------------------------------------------------------------------ */
/* Famille VERSION : C95 à C99                                         */
/* ------------------------------------------------------------------ */

export const CODES_VERSION = ["C95", "C96", "C97", "C98", "C99"] as const;
export type CodeVersion = (typeof CODES_VERSION)[number];

interface OptionsTexte {
  boucle?: boolean;
  motCle?: string;
}

/** Le texte découpé en phrases : la 1re est l'accroche, la dernière l'appel, le reste le corps (comme `controles-recette.test.ts`). */
export function entreeDeTexte(texte: string, options: OptionsTexte = {}): EntreeControle {
  return versionV4("machine", (e: EntreeControle) => {
    const ph = phrasesDe(texte);
    e.ouverture = [bloc("accroche", seg("t0", ph[0], { nature: "fait", marqueurs: [] }))];
    e.corps = [bloc("coeur", ...ph.slice(1, -1).map((t, i) => seg(`t${i + 1}`, t, { nature: "fait", marqueurs: [] })))];
    e.fin = [bloc("appel", seg("tf", ph.at(-1)!, { nature: "fait", marqueurs: [] }))];
    e.horodatageReel = undefined;
    e.debit = 2.75;
    e.boucle = options.boucle ?? false;
    e.adresse = "vous";
    if (options.motCle) e.motCle = options.motCle;
  });
}

/** Les codes de C95 à C99 levés sur ce texte, avec leur niveau côté machine. */
export function leves(texte: string, options: OptionsTexte = {}): CodeVersion[] {
  return codesLeves(controlerVersion(entreeDeTexte(texte, options))).filter((c): c is CodeVersion => (CODES_VERSION as readonly string[]).includes(c));
}
/** Parmi ceux-là, les codes dont le niveau machine est BLOQUANT aujourd'hui (C95 seulement). */
export function levesBloquants(texte: string, options: OptionsTexte = {}): CodeVersion[] {
  return leves(texte, options).filter((c) => NIVEAUX[c].machine === "bloquant");
}

const TEMOIN_A =
  "Un client appelle. Le seul qui connaît son dossier est en congé. Alors on fouille sa boîte mail. On rappelle le client pour lui reposer ses questions. Et il le sent. " +
  "Chez vous, qui saurait reprendre ce dossier sans appeler un collègue en vacances ? Un dossier peut se reprendre sans personne pour l'expliquer. " +
  "À chaque mail, à chaque appel, une automatisation écrit trois lignes dans la fiche du client. Où en est le dossier. Ce qui a été promis. La prochaine étape. " +
  "Prenons un cabinet comptable. Avant, le remplaçant cherchait partout. Maintenant, il lit trois lignes et rappelle le client, sans lui reposer de question. " +
  "Ces fiches, on les met en place pour vous, de bout en bout. Réservez un appel de diagnostic.";

const TEMOIN_B =
  "Le classeur le plus précieux de votre entreprise, c'est la tête de votre assistante. Le jour où elle tombe malade, vous ne savez plus quel devis attend une réponse. Les clients relancent. Vous improvisez. " +
  "Combien de vos clients dépendent d'une seule mémoire ? Ce qu'elle sait peut rester dans l'entreprise, même quand elle s'absente. " +
  "Chaque devis, chaque relance, chaque promesse faite au téléphone est noté automatiquement dans un tableau partagé. Qui, quoi, pour quand. Elle n'a rien à écrire en plus. " +
  "Prenons un artisan. Son assistante s'absente une semaine. Il ouvre le tableau, voit les devis en attente et rappelle les bons clients. " +
  "Ce tableau, on l'installe et on le fait tourner pour vous. Écrivez DOSSIER en commentaire.";

/** Le texte dit d'un script du tableau, dans l'ordre (accroche, douleur, promesse, constats, exemple, à retenir, appel). */
export function texteDitTableau(e: EcritureScript): string {
  const s = e.script;
  const dit = (ps: { dit: string }[]) => ps.map((p) => p.dit.trim());
  return [...dit(s.accroche), ...dit(s.douleur), ...dit(s.promesse), ...s.etapes.flatMap((x) => dit([x.action, ...x.comment])), ...dit(s.exemple.phrases), ...dit(s.aRetenir), ...dit(s.appel)].join(" ");
}

/** Le texte dit d'une fixture du socle qualité (lignes dans l'ordre). */
const texteCalibrage = (id: string) => SCRIPTS_CALIBRAGE.find((s) => s.id === id)!.lignes.map(([, t]) => t).join(" ");

export interface Temoin {
  id: string;
  source: string;
  texte: string;
}

/**
 * GROUPE 1 · TÉMOINS CONFORMES À LA RECETTE (question avant 40 %, rupture « on s'en occupe pour vous » dans le dernier
 * segment du corps, un seul appel, aucun tutoriel) : seuls juges de C97 et C99, qui EXIGENT un élément. A et B viennent de
 * `controles-recette.test.ts` ; R1 à R4 sont écrits à la main pour ce lot (métiers variés).
 */
export const TEMOINS_RECETTE: Temoin[] = [
  { id: "A", source: "tests/domaine/controles-recette.test.ts (témoin A)", texte: TEMOIN_A },
  { id: "B", source: "tests/domaine/controles-recette.test.ts (témoin B)", texte: TEMOIN_B },
  {
    id: "R1-plombier",
    source: "écrit à la main (lot F)",
    texte:
      "Le dimanche soir, le plombier recopie ses interventions de la semaine. Il oublie une facture sur trois. " +
      "Chez vous, combien de factures partent avec une semaine de retard ? Une intervention peut se facturer depuis le téléphone, sur place. " +
      "Le technicien note l'heure et les pièces, et la facture se prépare toute seule. Prenons un chauffagiste. Avant, il facturait le dimanche. Maintenant, la facture part le soir même. " +
      "Cette facturation, on la met en place pour vous, branchée sur votre agenda. Réservez un appel de diagnostic.",
  },
  {
    id: "R2-cabinet",
    source: "écrit à la main (lot F)",
    texte:
      "Un nouveau client signe, et personne ne sait qui le contacte en premier. Le dossier traîne trois jours. " +
      "Chez vous, qui accueille un nouveau client le jour de sa signature ? Un accueil peut démarrer dès la signature, sans réunion. " +
      "Un message de bienvenue part tout seul, avec la liste des pièces à envoyer. Prenons un cabinet de conseil. Avant, l'associé écrivait à chacun. Maintenant, le client reçoit sa liste en dix minutes. " +
      "Ce parcours d'accueil, on l'installe et on le fait vivre pour vous. Écrivez ACCUEIL en commentaire.",
  },
  {
    id: "R3-boutique",
    source: "écrit à la main (lot F)",
    texte:
      "Les avis clients arrivent par mail, par téléphone et sur les réseaux. La gérante n'en lit que la moitié. " +
      "Chez vous, où atterrissent les réclamations ? Les avis peuvent tous arriver au même endroit, triés par sujet. " +
      "Chaque message est classé automatiquement, et l'urgent monte en haut de la liste. Prenons une boutique de sport. Avant, un client mécontent attendait une semaine. Maintenant, la réponse part le jour même. " +
      "Ce tri, on le met en place pour vous, avec vos propres catégories. Réservez un appel de diagnostic.",
  },
  {
    id: "R4-transport",
    source: "écrit à la main (lot F)",
    texte:
      "Le chauffeur appelle le bureau pour demander l'adresse. Le bureau cherche dans un classeur. Le client attend devant sa porte. " +
      "Chez vous, combien d'appels servent juste à retrouver une adresse ? Une tournée peut s'envoyer sur le téléphone du chauffeur chaque matin. " +
      "L'itinéraire, les horaires et les consignes arrivent dans une seule fenêtre. Prenons un transporteur local. Avant, le bureau passait la matinée au téléphone. Maintenant, il suit les tournées sur un écran. " +
      "Cette tournée numérique, on la prépare et on la branche pour vous. Réservez un appel de diagnostic.",
  },
];

/**
 * GROUPE 2 · TÉMOINS BONS DU SOCLE ET DU TABLEAU, hors positions de la recette : le témoin v5 du tableau, B1-B3 et BON du socle
 * qualité. Ils sont bons selon les règles de Will mais ne posent pas de question ou disent la rupture ailleurs que dans le dernier
 * segment : C97 et C99 y lèvent À JUSTE TITRE ; ils ne comptent donc que pour C95, C96 et C98.
 */
export const TEMOINS_SOCLE: Temoin[] = [
  { id: "v5-01", source: "tests/tableau-scripts/exemples-v5.ts (texte dit, 01-continuité)", texte: texteDitTableau(ecritureModele()) },
  ...["B1-devis", "B2-factures", "B3-recrutement"].map((id) => ({ id, source: "tests/qualite-script/fixtures-calibrage.ts", texte: texteCalibrage(id) })),
  { id: "BON", source: "tests/qualite-script/aide.ts (BON)", texte: BON.map(([, t]) => t).join(" ") },
];

/** GROUPE 3 · TÉMOINS HORS RECETTE : 60 scripts honnêtes écrits à la main, sans l'obligation de poser une question ni de dire la rupture. Pour C95, C96, C98 seulement. */
export const TEMOINS_CORPUS: Temoin[] = CORPUS_60.map((texte, i) => ({ id: `c${String(i + 1).padStart(2, "0")}`, source: "tests/ecriture-commune/corpus-60.ts", texte }));

/** Contre-exemples minimaux (écrits à la main) : ce qu'ils doivent lever, par contrôle. Chacun est TEMOIN_A abîmé d'UN défaut. */
export interface ContreExemple {
  id: string;
  code: CodeVersion;
  defaut: string;
  texte: string;
  options?: OptionsTexte;
}
const sans = (de: string, vers: string) => {
  if (!TEMOIN_A.includes(de)) throw new Error(`témoin A ne contient pas « ${de} »`);
  return TEMOIN_A.replace(de, vers);
};
const FIN_A = "Ces fiches, on les met en place pour vous, de bout en bout. Réservez un appel de diagnostic.";
const QUESTION_A = "Chez vous, qui saurait reprendre ce dossier sans appeler un collègue en vacances ?";
export const CONTRE_EXEMPLES: ContreExemple[] = [
  { id: "c95-a", code: "C95", defaut: "conclusion « faites-le vous-même »", texte: sans(FIN_A, "Faites-le vous-même dès ce soir.") },
  { id: "c95-b", code: "C95", defaut: "« testez-le vous-même »", texte: sans(FIN_A, "Lancez-vous, testez-le vous-même ce soir.") },
  { id: "c95-c", code: "C95", defaut: "annonce d'outil (« nouvel outil »)", texte: sans(FIN_A, "Découvrez le nouvel outil qui vient de sortir.") },
  { id: "c96-a", code: "C96", defaut: "deux consignes numérotées", texte: sans("Où en est le dossier. Ce qui a été promis. La prochaine étape.", "Un. Listez les dossiers de chaque collaborateur. Deux. Cochez ceux sans remplaçant.") },
  { id: "c96-b", code: "C96", defaut: "trois impératifs en tête de phrase", texte: sans("Où en est le dossier. Ce qui a été promis. La prochaine étape.", "Ouvrez la fiche. Copiez le texte. Collez-le dans le mail.") },
  { id: "c97-a", code: "C97", defaut: "aucune question au spectateur", texte: sans(QUESTION_A, "Ce dossier peut se reprendre sans appeler un collègue en vacances.") },
  { id: "c97-b", code: "C97", defaut: "question posée trop tard (après 40 %)", texte: sans(QUESTION_A, "Ce dossier peut se reprendre sans appeler un collègue en vacances.").replace("Réservez un appel de diagnostic.", "Et chez vous, qui saurait reprendre ce dossier ? Réservez un appel de diagnostic.") },
  { id: "c97-c", code: "C97", defaut: "plus de deux questions", texte: sans("Et il le sent.", "Et il le sent ? Vraiment ? Vous le savez ?") },
  {
    id: "c98-a",
    code: "C98",
    defaut: "la dernière phrase du corps redit l'accroche (accroche de 3 racines ou plus)",
    texte: TEMOIN_B.replace("Ce tableau, on l'installe et on le fait tourner pour vous.", "Le classeur le plus précieux de votre entreprise, c'est la tête de votre assistante."),
  },
  { id: "c99-a", code: "C99", defaut: "aucune rupture « on s'en occupe pour vous »", texte: sans(FIN_A, "Les fiches sont simples à lire. Réservez un appel de diagnostic.") },
  { id: "c99-b", code: "C99", defaut: "« c'est coûteux pour vous » (pas de verbe « on… »)", texte: sans(FIN_A, "C'est coûteux pour vous. Réservez un appel de diagnostic.") },
  { id: "c99-c", code: "C99", defaut: "rupture dite trop tôt (milieu du corps), plus dans le dernier segment", texte: sans("Prenons un cabinet comptable.", "On s'en occupe pour vous, de bout en bout. Prenons un cabinet comptable.").replace(FIN_A, "Les fiches sont simples à lire. Réservez un appel de diagnostic.") },
];

/**
 * LIMITES CONNUES (faux négatifs constatés, figés tels quels) : ce que le contrôle ne voit pas aujourd'hui.
 *  - C98 ne lève que si l'accroche porte 3 racines (mots de 4 lettres ou plus, hors mots vides) : un accroche courte (« Un client
 *    appelle. » = 2 racines) ne peut jamais être redite au sens du contrôle.
 */
export const LIMITES_CONNUES: ContreExemple[] = [
  { id: "c98-limite", code: "C98", defaut: "accroche à 2 racines (« Un client appelle. ») redite mot pour mot en fin de corps", texte: sans("Ces fiches, on les met en place pour vous, de bout en bout.", "Un client appelle.") },
];

/** Presque-fautes BONNES (le contrôle ne doit PAS lever) : l'ordre ou le mot ressemble à un défaut sans en être un. */
export const PRESQUE_BONS: ContreExemple[] = [
  { id: "p95-a", code: "C95", defaut: "dispense : « vous n'avez plus à le faire vous-même, on s'en occupe »", texte: sans(FIN_A, "Vous n'avez plus à le faire vous-même, on s'en occupe pour vous. Réservez un appel de diagnostic.") },
  { id: "p96-a", code: "C96", defaut: "un seul impératif (l'appel)", texte: TEMOIN_A },
  { id: "p98-a", code: "C98", defaut: "boucle sur l'accroche (C98 ignoré)", texte: TEMOIN_B.replace("Ce tableau, on l'installe et on le fait tourner pour vous.", "Le classeur le plus précieux de votre entreprise, c'est la tête de votre assistante."), options: { boucle: true } },
  { id: "p99-a", code: "C99", defaut: "rupture dite dans l'appel", texte: sans("Ces fiches, on les met en place pour vous, de bout en bout. Réservez un appel de diagnostic.", "Les fiches sont simples à lire. On s'en occupe pour vous, écrivez DOSSIER.") },
];

/* ------------------------------------------------------------------ */
/* Famille TABLEAU                                                     */
/* ------------------------------------------------------------------ */

export const CODES_TABLEAU = ["positionnement", "etape-imperatif", "promesse-nombre", "question-spectateur", "redit-accroche", "densite-scene", "ecran-redit"] as const;
export type CodeTableau = (typeof CODES_TABLEAU)[number];

/** Les défauts de ces 7 contrôles sur un script (même appel que `controlerEcriture`, restreint à ces contrôles). */
export function defautsTableau(e: EcritureScript): DefautScript[] {
  const s = e.script;
  return [
    ...controlerPositionnement(s),
    ...controlerEtapes(s, { duree: 60 }).filter((d) => d.code === "etape-imperatif"),
    ...controlerPromesse(s),
    ...controlerQuestionSpectateur(s),
    ...controlerRediteAccroche(s),
    ...controlerDensiteScene(s),
    ...controlerEcranRedit(s),
  ];
}
export const codesTableau = (e: EcritureScript): CodeTableau[] => [...new Set(defautsTableau(e).map((d) => d.code as CodeTableau))].filter((c) => (CODES_TABLEAU as readonly string[]).includes(c)).sort() as CodeTableau[];
/** Vrai si le contrôle est éliminatoire (bloquant) AUJOURD'HUI sur ce script. */
export const tableauBloque = (e: EcritureScript, code: CodeTableau) => defautsTableau(e).some((d) => d.code === code && d.eliminatoire);

const p = (dit: string, ecran: string) => ({ dit, ecran });
const QUESTION_IA = "En quoi l'IA peut-elle vous aider ?";
type Etape = { action: ReturnType<typeof p>; comment: ReturnType<typeof p>[] };
function tableau(titre: string, s: { accroche: [string, string]; douleur: [string, string][]; promesse: [string, string][]; etapes: [[string, string], [string, string]][]; exemple: [string, string][]; retenir: [string, string]; entreprise: [string, string]; fin: [string, string] }): EcritureScript {
  const base = ecritureModele();
  return {
    ...base,
    idee: titre,
    script: {
      accroche: [p(...s.accroche)],
      douleur: s.douleur.map((x) => p(...x)),
      promesse: s.promesse.map((x) => p(...x)),
      etapes: s.etapes.map(([a, c]): Etape => ({ action: p(...a), comment: [p(...c)] })),
      exemple: { mentionEcran: "Exemple illustratif", phrases: s.exemple.map((x) => p(...x)) },
      aRetenir: [p(...s.retenir)],
      appel: [p(QUESTION_IA, ""), p(...s.entreprise), p(...s.fin)],
    },
  };
}

/** Trois scripts du tableau de plus, écrits à la main selon la décision D1 (indicatif, question en « vous », rien de redit). Jugés bons À LA MAIN. */
const T_RELANCE = tableau("La relance d'un devis part sans que personne y pense.", {
  accroche: ["Un devis envoyé il y a dix jours dort toujours dans la boîte mail.", "Un devis qui dort"],
  douleur: [
    ["Le client a oublié.", "Oubli du client"],
    ["L'artisan n'ose pas relancer.", "Il n'ose pas relancer"],
    ["Le chantier part chez un concurrent.", "Chantier perdu"],
    ["Chez vous, combien de devis dorment ainsi ?", "Chez vous, combien ?"],
  ],
  promesse: [["Un devis peut se relancer sans que personne y pense.", "Relance sans y penser"], ["Reste à savoir qui s'en charge.", "Qui s'en charge ?"]],
  etapes: [
    [["Une relance part toute seule au bout de cinq jours.", "Relance au bout de cinq jours"], ["Le message reprend le nom du client et le chantier.", "Nom et chantier repris"]],
    [["L'artisan voit qui a répondu.", "Il voit les réponses"], ["Les réponses s'affichent dans un seul tableau.", "Un seul tableau"]],
    [["Le devis signé sort de la liste.", "Signé, il sort"], ["Plus aucune relance ne part par erreur.", "Aucune erreur d'envoi"]],
  ],
  exemple: [["Prenons un plombier.", "Un plombier"], ["Avant, il relançait le dimanche soir, quand il y pensait.", "Avant : le dimanche soir"], ["Maintenant, le tableau relance pour lui et il appelle seulement ceux qui répondent.", "Maintenant : il appelle les réponses"]],
  retenir: ["La relance part seule, l'artisan garde l'appel qui compte.", "L'appel qui compte"],
  entreprise: ["Axion-IA met cette relance en place pour vous.", "Axion-IA la met en place"],
  fin: ["Réservez un appel de diagnostic.", "Réservez un diagnostic"],
});
const T_PLANNING = tableau("Un seul planning partagé garde l'équipe prévenue.", {
  accroche: ["Le planning change trois fois avant le service.", "Planning changé trois fois"],
  douleur: [
    ["Le cuisinier apprend son horaire par SMS.", "Horaire par SMS"],
    ["Le serveur ne l'a pas vu.", "Le serveur n'a rien vu"],
    ["Le samedi, il manque quelqu'un.", "Samedi : un absent"],
    ["Chez vous, qui connaît le vrai planning ?", "Chez vous, qui sait ?"],
  ],
  promesse: [["Un planning peut rester juste pour toute l'équipe.", "Juste pour tous"], ["Reste à savoir où il vit.", "Où vit-il ?"]],
  etapes: [
    [["Le planning vit dans un seul tableau partagé.", "Un tableau partagé"], ["Chacun l'ouvre sur son téléphone.", "Ouvert sur téléphone"]],
    [["Un changement prévient les personnes concernées.", "Les concernés sont prévenus"], ["Le message part dès que le patron modifie une case.", "Message dès la modification"]],
    [["Le samedi se remplit avant la veille.", "Samedi rempli à l'avance"], ["Les volontaires s'inscrivent sur le créneau vide.", "Inscription sur le créneau"]],
  ],
  exemple: [["Prenons un restaurant.", "Un restaurant"], ["Avant, le patron appelait chacun à tour de rôle.", "Avant : appels un à un"], ["Maintenant, il change une case et l'équipe est prévenue.", "Maintenant : une case"]],
  retenir: ["Un seul tableau remplace tous les SMS.", "Un tableau, zéro SMS"],
  entreprise: ["Axion-IA met ce tableau en place pour vous.", "Axion-IA l'installe"],
  fin: ["Réservez un appel de diagnostic.", "Réservez un diagnostic"],
});
const T_FACTURES = tableau("Une liste du matin montre les factures échues et relance seule.", {
  accroche: ["Les factures impayées s'accumulent en silence.", "Factures en silence"],
  douleur: [
    ["Personne ne les regarde le lundi.", "Personne ne regarde"],
    ["Le fournisseur attend son tour.", "Le fournisseur attend"],
    ["La trésorerie se tend sans prévenir.", "Trésorerie tendue"],
    ["Chez vous, qui sait ce qui reste dû ?", "Ce qui reste dû"],
  ],
  promesse: [["Une facture en retard peut se signaler seule.", "Signalée seule"], ["Reste à savoir qui le dit.", "Qui le dit ?"]],
  etapes: [
    [["Chaque matin, le tableau liste les factures échues.", "Liste du matin"], ["Elles apparaissent triées par ancienneté.", "Triées par ancienneté"]],
    [["Un rappel poli part au client concerné.", "Rappel poli envoyé"], ["Le ton reste courtois, le montant est rappelé.", "Ton courtois, montant"]],
    [["Le paiement reçu efface la ligne.", "Payé, la ligne disparaît"], ["Le tableau reste à jour sans saisie.", "À jour sans saisie"]],
  ],
  exemple: [["Prenons une entreprise de menuiserie.", "Une menuiserie"], ["Avant, la gérante vérifiait à la main chaque fin de mois.", "Avant : vérification manuelle"], ["Maintenant, elle lit la liste du matin et décroche pour les gros montants.", "Maintenant : la liste du matin"]],
  retenir: ["Le retard se voit tout de suite, la relance part seule.", "Le retard se voit"],
  entreprise: ["Axion-IA met cette liste en place pour vous.", "Axion-IA la met en place"],
  fin: ["Réservez un appel de diagnostic.", "Réservez un diagnostic"],
});

/** TÉMOINS BONS du tableau : le témoin v5 déclaré conforme + trois scripts écrits à la main selon D1. */
export const TEMOINS_TABLEAU: { id: string; source: string; ecriture: () => EcritureScript }[] = [
  { id: "v5-01", source: "tests/tableau-scripts/exemples-v5.ts", ecriture: () => ecritureModele() },
  { id: "main-relance", source: "écrit à la main (lot F)", ecriture: () => structuredClone(T_RELANCE) },
  { id: "main-planning", source: "écrit à la main (lot F)", ecriture: () => structuredClone(T_PLANNING) },
  { id: "main-factures", source: "écrit à la main (lot F)", ecriture: () => structuredClone(T_FACTURES) },
];

/** TÉMOINS ANCIENS (avant la décision D1) : lus tels quels, NON comptés comme « bons » (ils portent l'ancien tutoriel). */
export const TEMOINS_ANCIENS_TABLEAU: { id: string; source: string; ecriture: () => EcritureScript }[] = [
  ...EXEMPLES_V3.map((x) => ({ id: `v3-${x.fichier}`, source: "tests/tableau-scripts/exemples-v3.ts", ecriture: () => ecritureV3(x) })),
  ...EXEMPLES_V4.map((x) => ({ id: `v4-${x.fichier}`, source: "tests/tableau-scripts/exemples-v4.ts", ecriture: () => structuredClone(x.ecriture) })),
  { id: "1510", source: "tests/tableau/temoins (script du 15/10)", ecriture: () => ecriture1510() },
];

export interface ContreExempleTableau {
  id: string;
  code: CodeTableau;
  defaut: string;
  fabriquer: (e: EcritureScript) => void;
}
export const CONTRE_EXEMPLES_TABLEAU: ContreExempleTableau[] = [
  { id: "tp-a", code: "positionnement", defaut: "la fin dit « faites-le vous-même »", fabriquer: (e) => void (e.script.appel[2].dit = "Faites-le vous-même dès ce soir.") },
  { id: "tp-b", code: "positionnement", defaut: "la fin annonce un outil (« nouvel outil »)", fabriquer: (e) => void (e.script.appel[2].dit = "Découvrez le nouvel outil qui vient de sortir.") },
  { id: "ti-a", code: "etape-imperatif", defaut: "un constat à l'impératif adressé au spectateur", fabriquer: (e) => void (e.script.etapes[0].action.dit = "Listez les dossiers de chaque collaborateur.") },
  { id: "ti-b", code: "etape-imperatif", defaut: "un impératif dans le commentaire du constat", fabriquer: (e) => void (e.script.etapes[1].comment[0].dit = "Cochez les dossiers sans remplaçant.") },
  { id: "tn-a", code: "promesse-nombre", defaut: "la promesse annonce un nombre d'étapes", fabriquer: (e) => void (e.script.promesse[0].dit = "En trois étapes, un dossier se reprend sans personne.") },
  { id: "tq-a", code: "question-spectateur", defaut: "aucune question au spectateur", fabriquer: (e) => void (e.script.douleur[e.script.douleur.length - 1].dit = "Ce dossier ne se reprend pas sans le collègue absent.") },
  { id: "tr-a", code: "redit-accroche", defaut: "« à retenir » redit l'accroche", fabriquer: (e) => void (e.script.aRetenir[0].dit = e.script.accroche[0].dit) },
  { id: "td-a", code: "densite-scene", defaut: "un constat de plus de 22 mots d'une traite", fabriquer: (e) => void (e.script.etapes[0].comment[0].dit = "Où en est le dossier, ce qui est promis, la suite, la date du prochain contact et le nom de la personne à joindre.") },
  { id: "te-a", code: "ecran-redit", defaut: "l'écran redit la phrase dite", fabriquer: (e) => void (e.script.douleur[0].ecran = e.script.douleur[0].dit) },
];

/* ------------------------------------------------------------------ */
/* Mesures                                                             */
/* ------------------------------------------------------------------ */

export interface Taux {
  declenche: number;
  sur: number;
  /** Borne haute à 95 % du taux vrai quand 0 déclenche : règle des trois, 3/n (plafonnée à 1). */
  bornePoint95: number;
}
const taux = (declenche: number, sur: number): Taux => ({ declenche, sur, bornePoint95: declenche === 0 ? Math.min(1, 3 / sur) : declenche / sur });

/** Faux positifs d'un contrôle de version : parmi les témoins, ceux où il se lève. */
export function fauxPositifsVersion(code: CodeVersion, temoins: Temoin[]): { taux: Taux; ids: string[] } {
  const ids = temoins.filter((t) => leves(t.texte).includes(code)).map((t) => t.id);
  return { taux: taux(ids.length, temoins.length), ids };
}
/** Faux négatifs d'un contrôle de version : parmi les contre-exemples de ce code, ceux où il ne se lève pas. */
export function fauxNegatifsVersion(code: CodeVersion): { taux: Taux; ids: string[] } {
  const cs = [...CONTRE_EXEMPLES, ...LIMITES_CONNUES].filter((c) => c.code === code);
  const ids = cs.filter((c) => !leves(c.texte, c.options).includes(code)).map((c) => c.id);
  return { taux: taux(ids.length, cs.length), ids };
}
export function fauxPositifsTableau(code: CodeTableau): { taux: Taux; ids: string[] } {
  const ids = TEMOINS_TABLEAU.filter((t) => codesTableau(t.ecriture()).includes(code)).map((t) => t.id);
  return { taux: taux(ids.length, TEMOINS_TABLEAU.length), ids };
}
export function fauxNegatifsTableau(code: CodeTableau): { taux: Taux; ids: string[] } {
  const cs = CONTRE_EXEMPLES_TABLEAU.filter((c) => c.code === code);
  const ids = cs
    .filter((c) => {
      const e = TEMOINS_TABLEAU[0].ecriture();
      c.fabriquer(e);
      return !codesTableau(e).includes(code);
    })
    .map((c) => c.id);
  return { taux: taux(ids.length, cs.length), ids };
}

/** Ressemblance C1 : refus à tort sur les 60 du corpus (contre les 59 autres) et sur les paires « différentes » ; copies et paraphrases ratées. */
export function mesureRessemblance() {
  const corpus = CORPUS_60.map((s, i) => comparerScripts(s, CORPUS_60.filter((_, j) => j !== i)).ressemble).filter(Boolean).length;
  const differentes = PAIRES.filter((q) => q.groupe === "different" || q.groupe === "moule-propre");
  const faux = differentes.filter((q) => comparerScripts(q.nouveau, [q.ancien]).ressemble).length;
  const reprises = PAIRES.filter((q) => ["copie", "paraphrase", "moule"].includes(q.groupe));
  const ratees = reprises.filter((q) => !comparerScripts(q.nouveau, [q.ancien]).ressemble).length;
  return { corpus: taux(corpus, CORPUS_60.length), paires: taux(faux, differentes.length), reprises: taux(reprises.length - ratees, reprises.length) };
}

/** Le socle qualité (PO-01…) sur les fixtures de calibrage : bons jamais rouges, mauvais rouges. */
export function mesureSocle() {
  const r = SCRIPTS_CALIBRAGE.map((s) => ({ id: s.id, nature: s.nature, voyant: evaluerQualite(normaliserCalibrage(s), RECETTE_ECRIRE_AVOCAT).voyant }));
  return r;
}

/** Recommandation : « peut devenir bloquant » seulement si 0 faux positif, 0 faux négatif, borne haute à 95 % ≤ 10 % et au moins 5 contre-exemples ; sinon « reste en alerte ». */
export const SEUIL_BORNE = 0.1;
export const MIN_CONTRE_EXEMPLES = 5;
export function recommandation(fp: { taux: Taux }, fn: { taux: Taux }): "peut devenir bloquant" | "reste en alerte" {
  return fp.taux.declenche === 0 && fn.taux.declenche === 0 && fp.taux.bornePoint95 <= SEUIL_BORNE && fn.taux.sur >= MIN_CONTRE_EXEMPLES ? "peut devenir bloquant" : "reste en alerte";
}
