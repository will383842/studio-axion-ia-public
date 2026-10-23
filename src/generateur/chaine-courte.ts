/**
 * CHAÎNE COURTE (3 appels) : la chaîne de PRODUCTION des scripts dès que le réglage `generateur.chaine` vaut « courte »
 * (décision de Will, 15/10 ; aiguillage dans `services/boucle-generation.ts`), et la chaîne courte du banc d'écriture
 * (`tests/banc-ecriture/banc-ecriture.ts`). La grande chaîne (`chaine.ts`) reste derrière le réglage et pour « je choisis ».
 *
 * Elle reçoit les MÊMES données (`DonneesGeneration`), les MÊMES blocs en cache (`blocsEnCache`, par `creerContexte`) et
 * passe par le MÊME exécutant injecté que la grande :
 *  a. Opus, effort moyen : un angle et 5 accroches, en une fois ; il en retient une ;
 *  b. Opus, effort moyen : le script entier selon la recette du format (fond, corps, accroche, appel, publication) ;
 *  c. Sonnet : relecture en spectateur pressé, puis version corrigée (corriger, couper, resserrer : rien ajouter) ;
 *  d. production seulement (`reseaux`), sans nouvel appel au-delà : une version par réseau en plus, chacune écrite par le
 *     rôle `declinaison` de la grande chaîne (Sonnet, effort bas), puis C14 entre versions.
 * Ensuite les MÊMES contrôles par code que la grande chaîne (`assemblerVersion` → `controlerVersion`, note /100,
 * voyant), sans aucune boucle en plus : ni reprise, ni juge, ni duel, ni réécriture, ni correction automatique. Ce que
 * la courte n'écrit pas est rempli par le CODE, sans appel : marqueurs manquants (`completerMarqueurs`), marqueurs de
 * l'accroche (mini-plan), intentions d'illustration, téléprompteur, trame, finalistes. L'état est sauvé après chaque
 * étape : une reprise repart de la dernière étape terminée sans rien repayer. Rien ici ne nomme un format ni un réseau.
 */
import { z } from "zod";
import { analyserAdresse } from "@/domaine/adresse";
import { anonymiser, citeeMotPourMot, controlerVersion } from "@/domaine/controles-script";
import { alertesRepetitions, garderSansNouvelleRepetition } from "@/domaine/qualite-script/repetitions";
import { intentionsAutomatiques } from "@/domaine/illustrations";
import { PHRASES_BANQUE_FINS } from "@/briques/fins/banque";
import { MEMOIRE_MAX_CARACTERES } from "@/domaine/ecriture-commune/memoire";
import { ajoutVariable, CONTROLE_RESSEMBLANCE, memoireDuFormat, mesurerRessemblance, type MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import type { Adresse, BlocScript, ReseauDeclinaison } from "@/domaine/types";
import { MODELE_ECRITURE, MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import {
  Attente,
  FACTEUR_SORTIE_RENVOYEE,
  JETONS_CONSIGNES_AJOUTEES,
  angleTexte,
  appelPour,
  appeler,
  appliquerCorrections,
  assemblerVersion,
  blocsDeProse,
  creerContexte,
  declinerVersion,
  entreeControle,
  famillesTexte,
  finalisteDe,
  fondTexte,
  miseEnFormePrompteur,
  miseEnFormeTrame,
  noterEtVoyant,
  ReponseCoupee,
  rendreReglesReseau,
  texteVersion,
  variableBase,
  type Contexte,
  type EtatChaine,
  type ExecuteurRoles,
  type OptionsChaine,
  type VersionEcrite,
} from "./chaine";
import { matieresEnvoyees, nomsDuSocle, rendreMatiere, type DonneesGeneration } from "./contexte";
import { REGLE_EMPHASE, REGLE_PHRASES_COURTES } from "./roles/prose";
import { EVALUATIONS_ACCROCHES, roleAccroches, schemaAccroches, type SortieAccroches } from "./roles/accroches";
import { REGLES_WILL_AVANT_LOT_A } from "@/donnees/generateur/regles-will";
import { ANTI_PATTERNS_SCRIPT, horsRecetteCommune, RECETTE_SCRIPT } from "@/donnees/generateur/recette-script";
import { appelEquipe, objectifEquipe, REGLES_WILL, type AppelEquipe } from "./roles/equipe-commun";
import { consigne, graine, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECIT, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, regleTon, schemaArret, schemaMarqueur, tutoyer } from "./roles/commun";
import { EVALUATIONS_DECLINAISON, roleDeclinaison, schemaDeclinaison, type SortieDeclinaison } from "./roles/declinaison";
import type { SortiePlan } from "./roles/plan";
import { ditNonProuve, type Evaluation } from "./roles/evaluation";
import { roleFond, schemaFond, type SortieFond } from "./roles/fond";
import { EVALUATIONS_PROSE, roleProse, schemaProse, type SortieProse } from "./roles/prose";
import { schemaReecriture } from "./roles/reecriture";
import { pireCasPrudentAppel, totaliserPireCas, type PireCasChaine } from "./roles/estimation";
import { EVALUATIONS_STRATEGE, roleStratege, schemaStratege, type SortieStratege } from "./roles/stratege";
import type { DefinitionRole, EntreeRole } from "./roles/types";

/** Les évaluations d'un rôle de la grande chaîne, appliquées à une partie de la sortie d'un rôle court (rien recopié). */
function reprendre<T, U>(evaluations: readonly Evaluation<U>[], ids: string[], partie: (s: T) => U): Evaluation<T>[] {
  return evaluations.filter((e) => ids.includes(e.id)).map((e) => ({ ...e, verifier: (s: T, c) => e.verifier(partie(s), c) }));
}

/* ------------------------------------------------------------------ */
/* a. Angle et 5 accroches (Opus, effort moyen)                         */
/* ------------------------------------------------------------------ */

export const schemaCourtAngle = z.object({
  arret: schemaArret.optional(),
  angle: schemaStratege.shape.angles.element.optional(),
  accroches: schemaAccroches.shape.accroches,
  retenue: z.number().int(),
  raison: z.string(),
});
export type SortieCourtAngle = z.infer<typeof schemaCourtAngle>;

export const EVALUATIONS_COURT_ANGLE: readonly Evaluation<SortieCourtAngle>[] = [
  { id: "CRT-01", texte: "5 accroches, la retenue existe", verifier: (s) => (s.arret ? [] : [s.accroches.length !== 5 ? `${s.accroches.length} accroches` : null, s.accroches[s.retenue] ? null : "index retenu hors liste", s.angle ? null : "angle absent"].filter((x): x is string => !!x)) },
  ...reprendre<SortieCourtAngle, SortieStratege>(EVALUATIONS_STRATEGE, ["STR-03", "STR-04", "STR-05", "STR-07"], (s) => ({ angles: s.angle ? [s.angle] : [], retenu: 0, raisonChoix: s.raison })),
  ...reprendre<SortieCourtAngle, SortieAccroches>(EVALUATIONS_ACCROCHES, ["ACR-03", "ACR-04", "ACR-05", "ACR-07"], (s) => ({ arret: s.arret, accroches: s.accroches })),
];

/**
 * Les trois consignes de la chaîne courte existent en DEUX textes : COMMUNE (recette et anti-patterns du lot A, pour tous
 * les formats) et HORS RECETTE COMMUNE (`FORMATS_HORS_RECETTE_COMMUNE` : l'avocat), qui reprend mot pour mot ce que le
 * format recevait avant le lot A (#499). `commune = true` donne le texte d'aujourd'hui, octet pour octet.
 */
const consigneAngle = (commune: boolean) => consigne(
  "Tu prépares une courte vidéo d'Axion-IA, dont le format est celui de la <recette>, en UN seul passage : d'abord l'ANGLE, puis 5 ACCROCHES, puis tu en retiens une.",
  "ANGLE : il part d'UNE des combinaisons transmises (`combinaison` = son numéro, `structure` = son identifiant). Donne le problème du spectateur, ce qu'il lui coûte, l'issue, une seule cible, le terme pivot, la pertinence de chaque matière citée (`forte`, `acceptable`, `plaquee`) et les 4 tests. Jamais un angle bâti sur une matière plaquée.",
  "ACCROCHES : exactement 5, sur 5 familles différentes prises UNIQUEMENT dans la liste fournie (<familles>, `famille` = identifiant exact). Chacune : une affirmation ou un résultat de 20 mots au plus, au plus un nombre, la cible située, le problème et son coût dits tout de suite ; un encadré (`ecrit`) de 5 mots au plus. Ni salut, ni « Stop », ni « Arrêtez. » seul.",
  "`retenue` : l'index (à partir de 0) de l'accroche la plus forte, celle qu'un dirigeant de la cible écouterait jusqu'au bout." + (commune ? " L'accroche retenue porte une TENSION (un enjeu, une contradiction, une conséquence qui arrive), jamais une simple description de situation." : "") + " `raison` : pourquoi, en une phrase.",
  commune ? REGLES_WILL : REGLES_WILL_AVANT_LOT_A,
  REGLE_PROBLEME,
  REGLE_RECIT,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  "Si rien ne tient sans inventer, remplis `arret` avec ANCRAGE_MANQUANT et la raison, sans angle et sans accroche.",
  REGLE_DONNEES,
);

export const CONSIGNE_COURT_ANGLE = consigneAngle(true);
/** Ce que l'avocat recevait avant le lot A. */
export const CONSIGNE_COURT_ANGLE_HORS_RECETTE = consigneAngle(false);

export const roleCourtAngle: DefinitionRole<typeof schemaCourtAngle> = {
  id: "court-angle",
  // 2 : l'accroche retenue porte une tension (lot A1).
  version: 2,
  consigne: CONSIGNE_COURT_ANGLE,
  schema: schemaCourtAngle,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 8000,
  simuler(entree) {
    // Simulation : les simulations du stratège et des accroches, composées (aucun appel, aucun fait inventé).
    const st = roleStratege.simuler(entree) as SortieStratege;
    if (st.arret || !st.angles.length) return { arret: st.arret ?? { code: "ANCRAGE_MANQUANT", raison: "Aucune matière vraie fournie." }, accroches: [], retenue: 0, raison: "" };
    const lot = (roleAccroches.simuler(entree) as SortieAccroches).accroches;
    const variees = lot.filter((a, i) => lot.findIndex((x) => x.famille === a.famille) === i);
    const accroches = [...variees, ...lot.filter((a) => !variees.includes(a))].slice(0, 5);
    return { angle: st.angles[st.retenu] ?? st.angles[0], accroches, retenue: Math.max(0, accroches.findIndex((a) => a.porteAngle)), raison: "Simulation : l'accroche qui porte l'angle." };
  },
};

/* ------------------------------------------------------------------ */
/* b. Le script entier (Opus, effort moyen)                             */
/* ------------------------------------------------------------------ */

/**
 * Pris dans les schémas de la grande chaîne (rien recopié), ALLÉGÉ pour tenir sous les seuils de la grammaire compilée
 * (`tests/schemas-claude-limites.test.ts`) : ni annotations de montage, ni champs que le code remplit lui-même (thème,
 * idées, critères propres, id de l'accroche, segment facultatif, variante du mot-clé dans la publication).
 */
export const schemaCourtScript = z.object({
  arret: schemaArret.optional(),
  fond: schemaFond.pick({ motCle: true, motCleVariante: true, appuiPrincipal: true, issue: true, livraison: true, envoi: true }).extend({ exception: schemaFond.shape.exception.omit({ preuveId: true }) }),
  segments: z.array(schemaProse.shape.segments.element.omit({ intentionIllustration: true, incrustation: true })),
  /** Marqueurs de l'accroche dite (`cout`, `ancrage`…) : ils passent à l'ouverture de chaque version (C78, C31). */
  marqueursAccroche: z.array(schemaMarqueur).optional(),
  limiteProposee: z.string().optional(),
  /** Relecture finale A09 : les finalistes réécrites dans l'adresse du corps, quand elle change (<finalistes_a_readresser>). */
  finalistes: z.array(z.object({ id: z.string(), dit: z.string(), ecrit: z.string() })).optional(),
  version: schemaDeclinaison.pick({ accroche: true, boucle: true, encadre: true, couverture: true }).extend({
    /** Seulement sans <appel_impose> (aucune ligne de la banque des fins pour ce réseau) : l'appel du type demandé. */
    appel: schemaDeclinaison.shape.appel.optional(),
    publication: schemaDeclinaison.shape.publication.pick({ premiereLigne: true, texte: true, motsDiese: true, titres: true, post: true, justifications: true }) }),
});
export type SortieCourtScript = z.infer<typeof schemaCourtScript>;

export const EVALUATIONS_COURT_SCRIPT: readonly Evaluation<SortieCourtScript>[] = [
  ...reprendre<SortieCourtScript, SortieProse>(EVALUATIONS_PROSE, ["PRS-01", "PRS-02", "PRS-03", "PRS-04", "PRS-05", "PRS-06"], (s) => ({ arret: s.arret, segments: s.segments, limiteProposee: s.limiteProposee })),
  ...reprendre<SortieCourtScript, SortieDeclinaison>(EVALUATIONS_DECLINAISON, ["DEC-02", "DEC-03", "DEC-04", "DEC-05"], (s) => declinaisonDe(s, "")),
];

/** La déclinaison complète (forme de la grande chaîne) : l'accroche retenue, sans segment facultatif ; l'appel imposé s'il y en a un. */
function declinaisonDe(s: SortieCourtScript, accrocheId: string, motCleVariante = s.fond.motCleVariante, impose?: AppelImpose): SortieDeclinaison {
  const appel = impose?.texte !== undefined ? { type: impose.type, texte: impose.texte } : (s.version.appel ?? { type: "aucun" as const, texte: "" });
  return { ...s.version, appel, accrocheId, segmentFacultatifRetenu: false, publication: { ...s.version.publication, motCleVariante } };
}

/** Un impératif au « vous » (« Envoyez-la », « Réservez ») : `analyserAdresse` ne le compte pas. */
const IMPERATIF_VOUS = /(?<![\p{L}])(?!(?:chez|assez|nez|rez)(?![\p{L}]))\p{L}+ez(?![\p{L}])/iu;

/** L'appel final d'un réseau : imposé (ligne de la banque des fins, `texte`) ou seulement son type (le modèle l'écrit). */
export interface AppelImpose {
  balise: string;
  type: SortieDeclinaison["appel"]["type"];
  texte?: string;
  /** Code de la ligne de la banque des fins imposée (mémoire commune : appels récents). */
  code?: string;
}

/**
 * Comme la chaîne « équipe » : l'appel final est choisi par le CODE dans la banque des fins (base 7) selon le réseau et
 * l'objectif (`appelEquipe`), avec le type du studio s'il est permis sur ce réseau. Aucune ligne pour ce réseau (ou une
 * ligne dans l'autre adresse que celle de la vidéo) : seul le type est imposé et le modèle écrit l'appel (ancien
 * comportement). Exporté : la chaîne « équipe » passe par ici.
 */
export function appelImposeDe(c: Pick<Contexte, "p" | "d">, ligne: AppelEquipe | null | undefined, reseau: ReseauDeclinaison, corps: BlocScript[]): AppelImpose {
  // Une ligne de la banque dans l'autre adresse (« vous » ou un impératif en « -ez » dans une vidéo au « tu ») n'est
  // jamais imposée : repli (les lignes validées ne sont pas converties, la conversion automatique les abîme).
  const a = ligne && !adresseFautive(ligne.texte, c.d.sujet.adresse) && !(c.d.sujet.adresse === "tu" && IMPERATIF_VOUS.test(ligne.texte)) ? ligne : null;
  const type = a?.type && c.p.reseau(reseau).appelsPermis.includes(a.type) ? a.type : appelPour(c.p, reseau, c.d.sujet.objectif, corps).type;
  return a ? { balise: `<appel_impose code="${a.code}" type="${type}">${a.texte}</appel_impose>`, type, texte: a.texte, code: a.code } : { balise: `<appel type="${type}"/>`, type };
}

/** L'appel imposé de la chaîne courte pour ce réseau (PUR : même sujet, même réseau, même ligne). */
export function appelImposeCourt(c: Pick<Contexte, "p" | "d">, reseau: ReseauDeclinaison, corps: BlocScript[], appelsRecents?: readonly string[]): AppelImpose {
  return appelImposeDe(c, appelEquipe(reseau, objectifEquipe(c.d.sujet), graine(c.d.sujet.idee, reseau), appelsRecents), reseau, corps);
}

/** Le fond complet (forme de la grande chaîne) : ce que le rôle court n'écrit pas est rempli par le code, sans rien inventer. Exporté pour la chaîne « équipe ». */
export function fondDe(s: Pick<SortieCourtScript, "fond">, d: DonneesGeneration): SortieFond {
  // Le thème repart vers Claude (relecture, déclinaisons) : l'idée y est masquée comme dans `<sujet>`.
  return { ...s.fond, theme: anonymiser(d.sujet.idee, { nomsSensibles: nomsDuSocle(d) }).texte, idees: [], niveauConscience: d.sujet.niveauConscience, criteresPropres: [] };
}

const consigneScript = (commune: boolean) => consigne(
  "Tu écris en UN passage le script ENTIER d'une courte vidéo d'Axion-IA, au format de la <recette>, pour UN réseau (<reseau>), à partir de l'angle retenu et de l'accroche retenue (<finaliste>).",
  "`fond` : le mot-clé (2 à 4 mots que la cible dit vraiment et qui se disent tels quels dans une phrase française : « devis d'électricien », pas « devis électricien ») et une variante, l'appui principal (une preuve ou une matière), l'issue, la livraison (le fait le plus net, qui récompense le spectateur), l'exception (une matière `limite` fournie, sinon une proposition marquée `proposition-machine`), le destinataire d'un envoi (`destinataireRole` : un rôle pris mot pour mot dans la liste « Rôles destinataires d'un envoi » fournie) et sa phrase, qui nomme ce rôle mot pour mot (« Envoyez-la à votre DAF. »), jamais « un collègue », ni un métier hors de cette liste, ni la personne que la vidéo met en cause.",
  commune ? "`segments` : le TEXTE DIT du corps, entre l'accroche et l'appel, en suivant la RECETTE ci-dessous ; la structure retenue habille les éléments 2 à 6 mais ne retire aucun élément obligatoire ; l'accroche reste en tête, la question avant 40 % de la durée, la rupture juste avant l'appel ; réparti dans les blocs du corps de la recette (<blocs_corps>, `bloc` = son id) ; un segment = une ou deux phrases, `planIndex` = son rang à partir de 1. Le corps enchaîne sur l'accroche sans la répéter ; chaque segment est relié au précédent par une cause ou une opposition réelle. Une matière citée l'est MOT POUR MOT (`citeMatiereId`). Tiens le plafond du corps (en secondes, au débit fourni) : plus court vaut mieux que rempli." : "`segments` : le TEXTE DIT du corps, entre l'accroche et l'appel, dans l'ordre de la structure retenue, réparti dans les blocs du corps de la recette (<blocs_corps>, `bloc` = son id) ; un segment = une ou deux phrases, `planIndex` = son rang à partir de 1. Le corps enchaîne sur l'accroche sans la répéter ; chaque segment est relié au précédent par une cause ou une opposition réelle. Une matière citée l'est MOT POUR MOT (`citeMatiereId`). Tiens le plafond du corps (en secondes, au débit fourni) : plus court vaut mieux que rempli.",
  "MOT-CLÉ : le mot-clé de `fond` est DIT mot pour mot (mêmes mots, même ordre, sans accord ni conjugaison) au moins DEUX fois, trois au plus, dans l'accroche dite et le corps : une première fois dans l'accroche dite (en y remplaçant des mots de même sens, sans l'allonger), puis une seconde fois plus loin dans le corps, dans une phrase qui apporte un fait nouveau, jamais suivi de « concrètement » ni de « donc ».",
  "`marqueurs` de chaque segment (liste fermée) : `livraison` sur LE segment qui dit la livraison du fond (un seul), `ancrage` sur chaque segment qui cite la matière d'ancrage, `cout`, `solution`, `resultat` ou `methode` selon ce qu'il dit, `exception` sur la limite (ou « [LIMITE À VALIDER] »), `relance` sur une relance. `marqueursAccroche` : ceux de l'accroche dite (`cout` si elle dit le coût du problème, `ancrage` si elle cite la matière).",
  "LIMITE : si tu n'as qu'une limite proposée, écris à sa place exactement « [LIMITE À VALIDER] » et recopie la proposition dans `limiteProposee`.",
  "ADRESSE : si <finalistes_a_readresser> est fourni, ces accroches s'adressent au spectateur dans l'autre adresse que celle de cette vidéo. Réécris CHACUNE dans l'adresse donnée (`adresse=`), mêmes faits et mêmes mots sinon, dans `finalistes` (même `id`, `dit` et `ecrit`) ; l'accroche dite de `version` part de la retenue ainsi réécrite. Jamais une accroche ni une 1re ligne dans l'autre adresse.",
  "APPEL final : il est imposé (<appel_impose>, choisi par le code) : tu ne l'écris pas, tu y amènes ; RIEN après l'appel. Sans <appel_impose>, écris `version.appel` du type demandé (<appel type=…>), 47 mots au plus, jamais de réservation directe ni de prix. Un appel d'envoi nomme le destinataire de `fond` mot pour mot.",
  "`version` : l'accroche dite (la finaliste, adaptée seulement, jamais plus longue), l'appel (seulement sans <appel_impose>), la boucle si le réseau en a une (6 mots au plus), l'encadré (5 mots au plus, qui contient le mot-clé mot pour mot et ne reprend aucun autre mot de l'accroche) et la couverture (5 mots au plus), la publication selon les règles du réseau fournies, chaque choix de plateforme justifié par l'identifiant de sa règle datée (`regleId`).",
  ...(commune ? [RECETTE_SCRIPT, ANTI_PATTERNS_SCRIPT] : []),
  REGLE_PROBLEME,
  REGLE_RECIT,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  REGLE_PHRASES_COURTES,
  `Annotation du segment : ${REGLE_EMPHASE}.`,
  "Si le script ne tient pas sans inventer, remplis `arret` (ANCRAGE_MANQUANT ou PREUVE_MANQUANTE) avec la raison.",
  commune ? REGLES_WILL : REGLES_WILL_AVANT_LOT_A,
  REGLE_DONNEES,
);

export const CONSIGNE_COURT_SCRIPT = consigneScript(true);
/** Ce que l'avocat recevait avant le lot A : ni recette commune, ni anti-patterns. */
export const CONSIGNE_COURT_SCRIPT_HORS_RECETTE = consigneScript(false);

/** Plan factice de la SIMULATION seulement : la simulation de la prose écrit un segment par fonction. */
const PLAN_SIMULE = { segments: [{ partie: "ouverture", fonction: ["accroche"] }, ...[["ancrage"], ["relance"], ["solution"], ["livraison"], ["exception"]].map((fonction) => ({ partie: "corps", fonction }))] };

export const roleCourtScript: DefinitionRole<typeof schemaCourtScript> = {
  id: "court-script",
  // 2 : relecture finale A09, les finalistes réécrites quand l'adresse change (`finalistes`).
  // 3 : mot-clé dit deux fois et dans l'encadré, envoi à un rôle de la liste (C10, C19, C64)
  // 4 : recette commune et anti-patterns (lot A1).
  version: 4,
  consigne: CONSIGNE_COURT_SCRIPT,
  schema: schemaCourtScript,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 16000,
  simuler(entree) {
    // Simulation : fond, prose et déclinaison simulés, composés (aucun appel, aucun fait inventé).
    const fond = roleFond.simuler(entree) as SortieFond;
    const prose = roleProse.simuler({ ...entree, variable: `${entree.variable}\n<plan_valide>\n${JSON.stringify(PLAN_SIMULE)}\n</plan_valide>` }) as SortieProse;
    // L'adresse change : les finalistes sont réécrites (au « tu », `tutoyer`), et la version part de la retenue réécrite.
    const { adresse } = lireVariable(entree.variable);
    const bloc = /<finalistes_a_readresser[^>]*>([\s\S]*?)<\/finalistes_a_readresser>/.exec(entree.variable)?.[1] ?? "";
    const finalistes = [...bloc.matchAll(/<accroche id="([^"]+)"><dit>([\s\S]*?)<\/dit><ecrit>([\s\S]*?)<\/ecrit><\/accroche>/g)].map((m) => ({ id: m[1], dit: tutoyer(m[2], adresse), ecrit: tutoyer(m[3], adresse) }));
    const variable = entree.variable.replace(/(<finaliste id="([^"]+)"[^>]*>)([\s\S]*?)(<\/finaliste>)/, (_tout, o: string, id: string, dit: string, f: string) => `${o}${finalistes.find((y) => y.id === id)?.dit ?? dit}${f}`);
    const version = roleDeclinaison.simuler({ ...entree, variable: `${variable}\nMot-clé : ${fond.motCle}\nDestinataire de l'envoi : ${fond.envoi.destinataireRole}` }) as SortieDeclinaison;
    const { appel, ...sansAppel } = version;
    return { fond, segments: prose.segments, marqueursAccroche: ["cout"], limiteProposee: prose.limiteProposee, ...(finalistes.length ? { finalistes } : {}), version: { ...sansAppel, ...(/<appel_impose /.test(entree.variable) ? {} : { appel }) } };
  },
};

/* ------------------------------------------------------------------ */
/* c. Relecture en spectateur pressé (Sonnet)                           */
/* ------------------------------------------------------------------ */

export const schemaCourtRelecture = z.object({
  remarques: z.array(z.object({ ou: z.string(), probleme: z.string() })),
  accroche: z.string(),
  corrections: schemaReecriture.shape.corrections,
  appel: z.string(),
  boucle: z.string(),
});
export type SortieCourtRelecture = z.infer<typeof schemaCourtRelecture>;

export const EVALUATIONS_COURT_RELECTURE: readonly Evaluation<SortieCourtRelecture>[] = [
  { id: "REL-01", texte: "5 corrections au plus", verifier: (s) => (s.corrections.length > 5 ? [`${s.corrections.length} corrections`] : []) },
  { id: "REL-02", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => [s.accroche, s.appel, s.boucle, ...s.corrections.map((x) => x.texte)].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`) },
];

const consigneRelecture = (commune: boolean) => consigne(
  "Tu es un spectateur PRESSÉ qui fait défiler son fil. Tu relis ce script de courte vidéo d'Axion-IA tel qu'il sera dit à voix haute (<accroche>, <corps>, <appel>, <boucle>) ; les <matiere> citées dans le corps te sont données pour vérifier les citations.",
  "Dans `remarques`, note chaque endroit où tu décroches (`ou` : accroche, segment n, appel, boucle) et pourquoi : phrase molle ou abstraite, trop longue, redite, jargon, promesse non tenue, enchaînement sans cause" + (commune ? ", tutoriel pas à pas, plus d'une idée, fin qui redit l'accroche, aucune question au spectateur, pas de rupture « on s'en occupe »" : "") + ".",
  "Puis rends la version corrigée : `accroche` (la même, resserrée au plus), `corrections` (les segments du corps à corriger, 5 au plus, par index ; texte vide pour supprimer), `appel` et `boucle` (vide s'il n'y en a pas). Un <appel_impose> (choisi par le code) ne se corrige pas : rends `appel` vide.",
  "<alertes_code> liste ce que le code a relevé : s'il signale une REPETITION, supprime la répétition, ne réécris pas le reste ; une correction qui ajoute une répétition est refusée par le code.",
  "Tu ne fais que corriger, couper ou resserrer : aucun fait, aucun chiffre, aucune promesse ajoutés ; une matière citée mot pour mot (comparée à sa <matiere>) reste telle quelle, et une correction qui la ferait perdre est refusée par le code ; « [LIMITE À VALIDER] » reste tel quel.",
  commune ? REGLES_WILL : REGLES_WILL_AVANT_LOT_A,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  REGLE_DONNEES,
);

export const CONSIGNE_COURT_RELECTURE = consigneRelecture(true);
/** Ce que l'avocat recevait avant le lot A. */
export const CONSIGNE_COURT_RELECTURE_HORS_RECETTE = consigneRelecture(false);

/**
 * Contrôle C31 en code : une correction de la relecture qui ferait perdre la citation d'une matière d'ancrage (mot pour
 * mot) est refusée, le segment garde son texte. Retourne les corrections gardées et les refus (à signaler).
 */
export function garderCitationsAncrage(segments: readonly { texte: string; marqueurs?: readonly string[] }[], corrections: SortieCourtRelecture["corrections"], ancrages: readonly { id: string; texte: string }[]): { gardees: SortieCourtRelecture["corrections"]; refusees: string[] } {
  const refusees: string[] = [];
  const gardees = corrections.filter((x) => {
    const s = segments[x.segmentIndex];
    if (!s) return true;
    const perdues = ancrages.filter((m) => citeeMotPourMot(s.texte, m) && !citeeMotPourMot(x.texte, m));
    if (!perdues.length) return true;
    refusees.push(`C31 : correction du segment ${x.segmentIndex} refusée (citation d'ancrage perdue : ${[...new Set(perdues.map((m) => m.id))].join(", ")})`);
    return false;
  });
  return { gardees, refusees };
}

/** Même refus C31 pour l'accroche relue : si elle perd une citation d'ancrage présente dans l'accroche d'origine, on garde l'origine. */
export function garderAccrocheAncrage(avant: string, relue: string, ancrages: readonly { id: string; texte: string }[]): { accroche: string; refus?: string } {
  const apres = relue.trim() || avant;
  const perdues = ancrages.filter((m) => citeeMotPourMot(avant, m) && !citeeMotPourMot(apres, m));
  if (!perdues.length) return { accroche: apres };
  return { accroche: avant, refus: `C31 : correction de l'accroche refusée (citation d'ancrage perdue : ${[...new Set(perdues.map((m) => m.id))].join(", ")})` };
}

const balise = (variable: string, nom: string) => new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(variable)?.[1]?.trim() ?? "";

export const roleCourtRelecture: DefinitionRole<typeof schemaCourtRelecture> = {
  id: "court-relecture",
  // 2 : décrochages de recette (lot A1).
  version: 2,
  consigne: CONSIGNE_COURT_RELECTURE,
  schema: schemaCourtRelecture,
  modele: MODELE_JUGE,
  effort: "medium",
  maxTokens: 6000,
  simuler(entree: EntreeRole) {
    // Simulation : aucune relecture réelle, le texte est rendu tel quel.
    return { remarques: [{ ou: "ensemble", probleme: "Simulation : aucune relecture réelle." }], accroche: balise(entree.variable, "accroche"), corrections: [], appel: balise(entree.variable, "appel"), boucle: balise(entree.variable, "boucle") };
  },
};

export const ROLES_CHAINE_COURTE = { angle: roleCourtAngle, script: roleCourtScript, relecture: roleCourtRelecture } as const;

/**
 * Les rôles des formats HORS RECETTE COMMUNE (l'avocat) : même identifiant, même schéma, mêmes plafonds ; la consigne et la
 * version sont celles d'AVANT le lot A (angle 1, script 3, relecture 1), donc la partie en cache est identique à celle
 * que l'avocat recevait avant #499.
 */
export const ROLES_CHAINE_COURTE_HORS_RECETTE = {
  angle: { ...roleCourtAngle, version: 1, consigne: CONSIGNE_COURT_ANGLE_HORS_RECETTE },
  script: { ...roleCourtScript, version: 3, consigne: CONSIGNE_COURT_SCRIPT_HORS_RECETTE },
  relecture: { ...roleCourtRelecture, version: 1, consigne: CONSIGNE_COURT_RELECTURE_HORS_RECETTE },
} as const;
const ROLES_HORS_RECETTE = new Map<string, DefinitionRole<never>>(Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE).map((r) => [r.id, r as unknown as DefinitionRole<never>]));

/** Le rôle à appeler pour le format de ce contexte : celui du lot A, sauf un format hors recette commune (l'avocat). */
export function roleCourtPour<S extends z.ZodType>(c: Pick<Contexte, "p">, role: DefinitionRole<S>): DefinitionRole<S> {
  return horsRecetteCommune(c.p.formatId) ? ((ROLES_HORS_RECETTE.get(role.id) as unknown as DefinitionRole<S> | undefined) ?? role) : role;
}

/* ------------------------------------------------------------------ */
/* Conduite                                                             */
/* ------------------------------------------------------------------ */

export type ResultatChaineCourte =
  | { statut: "terminee"; etat: EtatChaine; version: VersionEcrite; avantRelecture: VersionEcrite; relecture?: SortieCourtRelecture; /** Lot C3, avec la mémoire seulement : code de la ligne de fin imposée à la 1re version. */ appels?: string[] }
  | { statut: "arretee"; etat: EtatChaine }
  | { statut: "coupee"; etat: EtatChaine; message: string }
  | { statut: "attente"; etat: EtatChaine; arret: Exclude<Attente["arret"], "reponse-coupee">; message: string };

export interface OptionsChaineCourte extends Pick<OptionsChaine, "tournures" | "contexteWill" | "debit" | "hashtags"> {
  /** Réseau de l'unique version (banc ; défaut : le 1er du sujet). */
  reseau?: ReseauDeclinaison;
  /**
   * PRODUCTION : une version par réseau, dans cet ordre. La 1re est écrite par le script (b) et relue (c) ; chacune des
   * autres par le rôle `declinaison` de la grande chaîne (étape d). Absent : la seule version de `reseau`.
   */
  reseaux?: ReseauDeclinaison[];
  /**
   * Lot C3 : la mémoire commune (lue par le service, réglage `ecriture.memoireCentrale`). Absente : la chaîne est identique
   * à avant. Le bloc va dans la partie VARIABLE du script, jamais dans le cache ; la ressemblance forte avec les récents
   * ajoute une ALERTE (la chaîne courte n'a aucune relance, aucun appel de plus) ; les appels récents écartent la ligne de fin.
   */
  memoire?: MemoireCentrale;
  /**
   * Pire cas seulement (`pireCasChaineCourte`) : la mémoire centrale est allumée, l'étape 2 compte donc un bloc mémoire de
   * taille maximale. Absent ou faux : le pire cas ne change pas d'un octet. Ignoré à l'exécution.
   */
  memoireAuPire?: boolean;
}

/** Réseaux des versions : ceux demandés (production), sinon le seul du banc. */
export function reseauxDe(d: DonneesGeneration, options: Pick<OptionsChaineCourte, "reseau" | "reseaux">): ReseauDeclinaison[] {
  const liste = options.reseaux?.length ? options.reseaux : [options.reseau ?? d.sujet.reseaux[0]];
  return [...new Set(liste.filter((r): r is ReseauDeclinaison => !!r))];
}

/* ------------------------------------------------------------------ */
/* Ce que la courte n'écrit pas : rempli par le code (aucun appel)      */
/* ------------------------------------------------------------------ */

const EMPLACEMENT_LIMITE = "[LIMITE À VALIDER]";
const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const motsPleins = (t: string) => new Set(normaliser(t).split(" ").filter((m) => m.length >= 4));

/** Le segment cite-t-il cette matière (son texte entier, ou ses 8 premiers mots) ? */
function cite(texte: string, matiere: string): boolean {
  const t = normaliser(texte);
  const m = normaliser(matiere);
  if (!m) return false;
  const debut = m.split(" ").slice(0, 8).join(" ");
  return t.includes(m) || (m.split(" ").length > 8 && t.includes(debut));
}

type SegmentCourt = SortieCourtScript["segments"][number];

/**
 * Relecture finale A09 : CONTRÔLE PAR CODE de l'adresse. Le texte s'adresse-t-il au spectateur dans l'AUTRE adresse que
 * celle de la vidéo (une forme de « vous » dans une vidéo au « tu », ou de « tu » dans une vidéo au « vous ») ?
 */
export function adresseFautive(texte: string | undefined, adresse: Adresse): boolean {
  if (!texte?.trim()) return false;
  // Une parole CITÉE entre guillemets n'est pas une adresse au spectateur (« tu perds 2 h » dans une vidéo au « vous »).
  const a = analyserAdresse(texte.replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, " "));
  return adresse === "tu" ? a.vous > 0 : a.tu > 0;
}

/**
 * REPLI PAR CODE des marqueurs que le script n'a pas posés (sans eux, C6, C31 et C79 voyaient rouge alors que le texte
 * dit bien la livraison et cite la matière). Rien n'est ajouté au texte ; un marqueur déjà posé n'est jamais déplacé :
 *  - `exception` : le segment « [LIMITE À VALIDER] », ou celui qui cite la limite du fond ;
 *  - `ancrage` : chaque segment qui cite une matière d'ancrage (id déclaré ou texte repris) ;
 *  - `livraison` : UN segment, celui qui reprend le plus de mots de la livraison du fond (sinon le dernier, hors limite).
 */
export function completerMarqueurs(segments: SegmentCourt[], x: { livraison?: string; ancrages: { id: string; texte: string }[]; exceptionMatiereId?: string }): SegmentCourt[] {
  const segs = segments.map((s) => ({ ...s, marqueurs: [...s.marqueurs] }));
  const parles = segs.filter((s) => s.texte.trim());
  const a = (m: SegmentCourt["marqueurs"][number]) => parles.some((s) => s.marqueurs.includes(m));
  const ajouter = (s: SegmentCourt | undefined, m: SegmentCourt["marqueurs"][number]) => {
    if (s && !s.marqueurs.includes(m)) s.marqueurs.push(m);
  };
  if (!a("exception")) {
    const id = x.exceptionMatiereId;
    ajouter(parles.find((s) => s.texte.includes(EMPLACEMENT_LIMITE)) ?? (id ? parles.find((s) => s.citeMatiereId === id || s.matiereIds.includes(id)) : undefined), "exception");
  }
  if (!a("ancrage")) {
    for (const s of parles) if (!s.marqueurs.includes("exception") && x.ancrages.some((m) => s.citeMatiereId === m.id || s.matiereIds.includes(m.id) || cite(s.texte, m.texte))) ajouter(s, "ancrage");
  }
  if (!a("livraison")) {
    const cibles = parles.filter((s) => !s.marqueurs.includes("exception"));
    const voulus = motsPleins(x.livraison ?? "");
    const score = (s: SegmentCourt) => [...motsPleins(s.texte)].filter((m) => voulus.has(m)).length;
    const meilleur = cibles.reduce<SegmentCourt | undefined>((b, s) => (!b || score(s) >= score(b) ? s : b), undefined);
    ajouter(meilleur && score(meilleur) > 0 ? meilleur : cibles.at(-1), "livraison");
  }
  return segs;
}

/** Mini-plan de l'ouverture : seul le segment 0 compte (`ouvertureDe` y lit les marqueurs de l'accroche). */
export function planOuverture(marqueurs: SortiePlan["segments"][number]["fonction"]): SortiePlan {
  return { segments: [{ partie: "accroche", fonction: [...new Set(marqueurs)], nature: "fait", resume: "Accroche retenue", preuveIds: [], matiereIds: [] }], exceptionIndex: -1, ancrageIndex: [], appuiPrincipalIndex: -1, livraisonIndex: -1 };
}

/** Marqueurs de l'accroche : ceux du script, sinon le coût (exigé de chaque accroche) et l'ancrage si elle cite la matière. */
function marqueursAccroche(c: Contexte, sb: SortieCourtScript | undefined, accroche: { dit: string; matiereIds?: string[] }): SortiePlan["segments"][number]["fonction"] {
  const donnes = (sb?.marqueursAccroche ?? []).filter((m) => m !== "cta" && m !== "livraison");
  if (donnes.length) return donnes;
  const ancrages = c.d.choix.ancrages.map((x) => c.d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m);
  return ["cout", ...(ancrages.some((m) => accroche.matiereIds?.includes(m.id) && cite(accroche.dit, m.texte)) ? (["ancrage"] as const) : [])];
}

/** Intentions d'illustration choisies par le code (aucun appel), si la recette les accepte ; jamais d'incrustation. */
export function avecIntentions(c: Contexte, corps: BlocScript[]): BlocScript[] {
  if (!c.p.recette.annotationsAcceptees.includes("intentionIllustration")) return corps;
  const choix = intentionsAutomatiques(corps);
  return corps.map((b) => ({ ...b, segments: b.segments.map((s) => (choix.has(s.id) ? { ...s, intentionIllustration: choix.get(s.id) } : s)) }));
}

/** Contrôle affiché sur une version gardée sans relecture (relecture inutilisable). Il ne retire aucun point. */
export const CONTROLE_NON_RELUE = "NON-RELUE";

/**
 * Fin des versions (comme la fin de l'étape 12 de la grande chaîne, sans rejugement) : C14 entre versions, puis la mise en
 * forme du mode (téléprompteur, trame) et la note.
 */
export function finirVersions(c: Contexte, versions: VersionEcrite[]): void {
  const k = c.etat.corps![c.etat.gagnant ?? 0];
  for (const v of versions) {
    const corpsReseau = (k.blocs ?? []).map((b) => ({ ...b, segments: b.segments.filter((x) => !x.facultatif || (x.facultatif === v.reseau && v.segmentFacultatifRetenu)) })).filter((b) => b.segments.length);
    const autres = versions.filter((x) => x !== v).map((x) => ({ reseau: x.reseau, accrocheDite: x.declinaison.accroche, appelTexte: x.appel.texte, premiereLigne: x.declinaison.publication.premiereLigne }));
    v.violations = controlerVersion(entreeControle(c, { ouverture: v.ouverture, corps: corpsReseau, fin: v.fin, reseau: v.reseau, version: v, autres })).violations;
    // Relecture finale A09 : la version relue (la 1re) dont la relecture a échoué le montre, sans être bloquée.
    if (c.etat.nonRelue && v === versions[0]) v.violations.push({ controle: CONTROLE_NON_RELUE, niveau: "alerte", bloquant: false, message: `Non relue : ${c.etat.nonRelue}` });
    if (c.d.sujet.mode === "teleprompteur") v.prompteur = miseEnFormePrompteur([...v.ouverture, ...(k.blocs ?? []), ...v.fin]);
    if (c.d.sujet.mode === "trame") v.trame = miseEnFormeTrame({ matieres: c.d.matieres, exception: c.etat.fond?.exception }, k.blocs ?? [], v.declinaison.accroche, v.appel.texte);
    noterEtVoyant(v);
  }
}

/**
 * Lot C3 : la 1re version, écrite puis relue, ressemble-t-elle à un script récent (copie ou paraphrase) ? La chaîne courte n'a
 * aucune relance (« aucune reprise ») : ajouter un appel serait un coût de plus. L'ALERTE est donc posée sur la version
 * (jamais bloquante, ne retire aucun point). Un échec de la mesure est silencieux : l'écriture continue.
 */
export function alerterRessemblance(c: Contexte, v: VersionEcrite | undefined, memoire: MemoireCentrale | undefined): void {
  if (!v || !memoire?.anciens.length) return;
  try {
    const texte = anonymiser(texteVersion(c.etat, v), { nomsSensibles: nomsDuSocle(c.d) }).texte;
    const m = mesurerRessemblance(texte, memoire, [...PHRASES_BANQUE_FINS, v.appel.texte]);
    if (!m.forte) return;
    v.violations.push({ controle: CONTROLE_RESSEMBLANCE, niveau: "alerte", bloquant: false, message: m.message });
    noterEtVoyant(v);
  } catch {
    // la mémoire ne bloque jamais l'écriture
  }
}

/**
 * GARDE-FOUS BUDGET (correctif après relecture, 15/10) : PIRE CAS PRUDENT de la chaîne courte (PUR), même règle que la
 * grande (`pireCasGrandeChaine`) : 3 appels (aucune reprise), plus une déclinaison par réseau en plus (parties ensemble),
 * chacun au pire prudent (entrée au prix normal, `maxTokens` en sortie, le socle écrit en cache une fois par rôle).
 * L'entrée de b compte la sortie de a, celle de c et des déclinaisons la sortie de b (`maxTokens` × 1,5 chacune), plus
 * 3 000 jetons de consignes. `etatDepart` : seules les étapes après la sienne sont comptées.
 */
export function pireCasChaineCourte(d: DonneesGeneration, options: OptionsChaineCourte = {}, etatDepart?: EtatChaine): PireCasChaine {
  const c = creerContexte(d, { executer: async () => ({ ok: false, arret: "verrou-perdu", message: "" }) }, { ...options, reprises: false }, etatDepart, async () => {});
  const reseaux = reseauxDe(d, options);
  const reseau = reseaux[0];
  const sortie = (r: DefinitionRole) => r.maxTokens * FACTEUR_SORTIE_RENVOYEE;
  const appel = (role: DefinitionRole, variable: string, jetonsEnPlus: number) => pireCasPrudentAppel(role, { contexte: c.cache, variable }, jetonsEnPlus + JETONS_CONSIGNES_AJOUTEES);
  const blocs = c.blocsCorps.map((b) => `<bloc id="${b.id}">${b.consigne}</bloc>`).join("\n");
  // Mémoire centrale allumée : le bloc le plus long (jamais pour l'avocat ni un script de Will) s'ajoute à l'écriture.
  const memoireAuPire = options.memoireAuPire ? ajoutVariable(memoireDuFormat({ bloc: "x".repeat(MEMOIRE_MAX_CARACTERES), anciens: [] }, d.sujet.formatId)) : "";
  const regles = (r: ReseauDeclinaison | undefined) => (r ? rendreReglesReseau(c, r).join("\n") : "");
  const reglesAutres = reseaux.slice(1).map(regles).sort((a, b) => b.length - a.length)[0] ?? "";
  const prevus = [
    { etape: 1, n: 1, appel: appel(roleCourtPour(c, roleCourtAngle), [variableBase(c), c.etat.stratege ? angleTexte(c) : "", famillesTexte(c)].join("\n"), 0) },
    { etape: 2, n: 1, appel: appel(roleCourtPour(c, roleCourtScript), [variableBase(c), blocs, regles(reseau), ...(memoireAuPire ? [memoireAuPire] : [])].join("\n"), sortie(roleCourtAngle)) },
    { etape: 3, n: 1, appel: appel(roleCourtPour(c, roleCourtRelecture), "", sortie(roleCourtScript)) },
    { etape: 4, n: reseaux.length - 1, parallele: reseaux.length - 1, appel: appel(roleDeclinaison, [variableBase(c), reglesAutres].join("\n"), sortie(roleCourtAngle) + sortie(roleCourtScript)) },
  ];
  return totaliserPireCas(prevus.filter((x) => x.etape > c.etat.etape && x.n > 0));
}

/**
 * Déroule les 3 appels (et, en production, une déclinaison par réseau en plus), puis les contrôles par code, depuis la
 * dernière étape terminée (`etatDepart` ; `sauver` après chaque étape : rien n'est repayé). « arretee » : un rôle a
 * répondu ANCRAGE_MANQUANT ou PREUVE_MANQUANTE, ou une sortie est inutilisable (`SORTIE_INVALIDE`, échec technique) ;
 * « coupee » : réponse coupée (`max_tokens`), rien n'est relancé ; « attente » : crédit, plafond ou modèle.
 * Supplément (état de départ à l'étape 1 avec le fond d'une écriture précédente) : l'angle, les accroches et le fond
 * sont repris tels quels, seul le script est écrit.
 */
export async function executerChaineCourte(d: DonneesGeneration, executeur: ExecuteurRoles, options: OptionsChaineCourte = {}, etatDepart?: EtatChaine, sauver: (e: EtatChaine) => Promise<void> = async () => {}): Promise<ResultatChaineCourte> {
  // Aucune reprise : un appel de chaque rôle, quoi qu'il arrive (un appel invalide arrête la chaîne).
  const c = creerContexte(d, executeur, { ...options, reprises: false }, etatDepart, sauver);
  const reseaux = reseauxDe(d, options);
  const reseau = reseaux[0];
  // Lot C3 : ni avocat ni script de Will ne passent par la mémoire commune.
  const memoire = memoireDuFormat(options.memoire, d.sujet.formatId);
  const imposer = (r: ReseauDeclinaison, corps: BlocScript[]) => appelImposeCourt(c, r, corps, memoire?.appelsRecents);
  const arreter = async (etape: number, type: NonNullable<EtatChaine["arret"]>["type"], message: string): Promise<ResultatChaineCourte> => {
    c.etat.arret = { type, etape, message };
    await sauver(c.etat);
    return { statut: "arretee", etat: c.etat };
  };
  const terminer = async (n: number) => {
    c.etat.etape = n;
    await sauver(c.etat);
  };
  if (c.etat.arret) return { statut: "arretee", etat: c.etat };
  let avantRelecture = c.etat.versions?.[0];
  let relecture: SortieCourtRelecture | undefined;
  try {
    // a. Angle et accroches ; les 5 accroches deviennent les finalistes, la retenue en premier.
    if (c.etat.etape < 1) {
      // Supplément qui change d'adresse vers le « vous » : l'angle d'origine est GARDÉ (donné à Claude), seules les
      // accroches sont réécrites dans la bonne adresse.
      const angleGarde = c.etat.stratege?.angles[c.etat.angleRetenu ?? 0];
      const a = await appeler(c, 1, roleCourtPour(c, roleCourtAngle), [variableBase(c), angleGarde ? angleTexte(c) : "", famillesTexte(c)].filter(Boolean).join("\n"), EVALUATIONS_COURT_ANGLE);
      const sa = a.donnees;
      if (a.marqueur || sa?.arret) return arreter(1, a.marqueur ?? sa!.arret!.code, sa?.arret?.raison ?? "Aucun angle ne tient sans inventer.");
      if (!sa || (!sa.angle && !angleGarde) || !sa.accroches.length) return arreter(1, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (angle et accroches) : ${a.echecs.join(" ; ") || "sortie vide"}.`);
      if (!angleGarde) {
        c.etat.stratege = { angles: [sa.angle!], retenu: 0, raisonChoix: sa.raison };
        c.etat.angleRetenu = 0;
      }
      c.etat.accroches = sa.accroches.map((x, i) => ({ ...x, id: `acc-${i + 1}` }));
      const retenue = c.etat.accroches[sa.retenue] ?? c.etat.accroches[0];
      c.etat.finalistes = [retenue, ...c.etat.accroches.filter((x) => x !== retenue)].slice(0, 5).map((x) => finalisteDe(c, x));
      await terminer(1);
    }

    // b. Le script entier, pour le 1er réseau.
    if (c.etat.etape < 2) {
      const angle = c.etat.stratege?.angles[c.etat.angleRetenu ?? 0];
      const retenue = c.etat.finalistes?.[0];
      if (!angle || !retenue) return arreter(2, "SORTIE_INVALIDE", "L'angle ou l'accroche retenue manque : le script ne peut pas être écrit.");
      const blocs = `<blocs_corps>\n${c.blocsCorps.map((b) => `<bloc id="${b.id}">${b.consigne}</bloc>`).join("\n")}\n</blocs_corps>`;
      // L'appel final est imposé par le code (banque des fins), sinon seul son type l'est.
      const impose = imposer(reseau, []);
      // Mémoire commune : le code imposé ici est celui enregistré à la fin (après pause/reprise, la mémoire relue peut tirer une autre ligne).
      if (memoire && impose.code) c.etat.codeFinImpose = impose.code;
      // Relecture finale A09 : un supplément qui CHANGE d'adresse (« + Tu ») reprend des finalistes dans l'autre adresse :
      // le script les réécrit (aucun appel en plus), et les déclinaisons reçoivent ces finalistes réécrites.
      const adresse = d.sujet.adresse;
      const aReadresser = (c.etat.finalistes ?? []).filter((f) => adresseFautive(f.dit, adresse) || adresseFautive(f.ecrit, adresse));
      const readresser = aReadresser.length ? `<finalistes_a_readresser adresse="${adresse}">\n${aReadresser.map((f) => `<accroche id="${f.id}"><dit>${f.dit}</dit><ecrit>${f.ecrit}</ecrit></accroche>`).join("\n")}\n</finalistes_a_readresser>` : "";
      const variableB = [variableBase(c), angleTexte(c), c.etat.fond ? fondTexte(c) : "", `<structure_retenue>${angle.structure}</structure_retenue>`, `<finaliste id="${retenue.id}" famille="${retenue.famille}">${retenue.dit}</finaliste>`, readresser, blocs, ...rendreReglesReseau(c, reseau), impose.balise, ajoutVariable(memoire)].filter(Boolean).join("\n");
      const ctxB = { ...c.evalCtx, blocsCorps: c.blocsCorps.map((x) => x.id), finalistes: [retenue.id], appelsPermis: c.p.reseau(reseau).appelsPermis };
      const b = await appeler(c, 2, roleCourtPour(c, roleCourtScript), variableB, EVALUATIONS_COURT_SCRIPT, ctxB);
      const sb = b.donnees;
      if (b.marqueur || sb?.arret) return arreter(2, b.marqueur ?? sb!.arret!.code, sb?.arret?.raison ?? "Le script ne tient pas sans inventer.");
      if (!sb) return arreter(2, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (script) : ${b.echecs.join(" ; ") || "sortie vide"}.`);
      // Repli (aucun appel imposé) : l'appel reste exigé, comme avant que le schéma ne le rende facultatif.
      if (impose.texte === undefined && !sb.version.appel) return arreter(2, "SORTIE_INVALIDE", "Réponse de Claude inutilisable (script) : l'appel demandé (<appel type=…>) manque.");
      // Contrôle par code de l'adresse : finalistes réécrites, accroche dite et 1re ligne dans l'adresse de la vidéo.
      const refaites = new Map((sb.finalistes ?? []).map((x) => [x.id, x]));
      const restees = aReadresser.filter((f) => {
        const x = refaites.get(f.id);
        return !x?.dit.trim() || adresseFautive(x.dit, adresse) || adresseFautive(x.ecrit, adresse);
      });
      const mauvaiseAdresse = [restees.length ? `${restees.length} accroche(s) finaliste(s) pas réécrite(s)` : "", adresseFautive(sb.version.accroche, adresse) ? `accroche « ${sb.version.accroche} »` : "", adresseFautive(sb.version.publication.premiereLigne, adresse) ? `1re ligne « ${sb.version.publication.premiereLigne} »` : ""].filter(Boolean);
      if (mauvaiseAdresse.length) return arreter(2, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (script) : pas au « ${adresse} » (${mauvaiseAdresse.join(" ; ")}).`);
      if (aReadresser.length) {
        const readressee = <T extends { id: string; dit: string; ecrit: string }>(a: T): T => {
          const x = refaites.get(a.id);
          return x && aReadresser.some((f) => f.id === a.id) ? { ...a, dit: x.dit.trim(), ecrit: x.ecrit.trim() || a.ecrit } : a;
        };
        c.etat.accroches = c.etat.accroches?.map(readressee);
        c.etat.finalistes = c.etat.finalistes!.map((f) => {
          const x = readressee(f);
          return x === f ? f : { ...x, dureeDiteSec: +(x.dit.split(/\s+/).filter(Boolean).length / c.debit).toFixed(1) };
        });
      }
      // Supplément : le fond de l'écriture d'origine (limite validée comprise) est gardé, jamais réécrit.
      const fond = c.etat.fond ?? fondDe(sb, d);
      // Une limite « matière » doit être une matière fournie : sinon elle n'est qu'une proposition (même règle qu'à l'étape 2).
      if (!c.etat.fond && fond.exception.source === "matiere" && !c.evalCtx.matiereIds.has(fond.exception.matiereId ?? "")) fond.exception = { ...fond.exception, source: "proposition-machine", matiereId: undefined };
      c.etat.fond = fond;
      const ancrages = d.choix.ancrages.map((x) => d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, texte: m.texte }));
      const segments = completerMarqueurs(sb.segments, { livraison: fond.livraison, ancrages, exceptionMatiereId: fond.exception.matiereId });
      const prose: SortieProse = { segments, limiteProposee: sb.limiteProposee };
      const corps = avecIntentions(c, blocsDeProse(c, prose));
      if (!corps.length) return arreter(2, "SORTIE_INVALIDE", "Réponse de Claude inutilisable (script) : aucun segment de corps.");
      c.etat.corps = [{ combinaison: angle.combinaison, structure: angle.structure, accrocheId: retenue.id, plan: planOuverture(marqueursAccroche(c, sb, retenue)), prose, blocs: corps, limiteProposee: sb.limiteProposee ?? (fond.exception.source === "proposition-machine" ? fond.exception.texte : undefined) }];
      c.etat.gagnant = 0;
      avantRelecture = assemblerVersion(c, reseau, declinaisonDe(sb, retenue.id, fond.motCleVariante, imposer(reseau, corps)));
      noterEtVoyant(avantRelecture);
      c.etat.versions = [avantRelecture];
      await terminer(2);
    }

    // c. Relecture en spectateur pressé, puis version corrigée (sans nouvel appel ensuite).
    if (c.etat.etape < 3) {
      const avant = c.etat.versions![0];
      const corps = c.etat.corps![0].blocs ?? [];
      const segs = corps.flatMap((x) => x.segments);
      // Les matières citées (ancrages, et toute matière reprise mot pour mot dans le corps) : la relecture peut vérifier les citations.
      const ancrages = d.choix.ancrages.map((x) => d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m);
      const citees = matieresEnvoyees(d).filter((m) => ancrages.some((a) => a.id === m.id) || segs.some((s) => citeeMotPourMot(s.texte, m)));
      const variableC = [
        fondTexte(c),
        ...citees.map((m) => rendreMatiere(m, d)),
        `<accroche>${avant.declinaison.accroche}</accroche>`,
        `<corps>\n${segs.map((s, i) => `<segment index="${i}" marqueurs="${(s.marqueurs ?? []).join(",")}">${s.texte}</segment>`).join("\n")}\n</corps>`,
        imposer(avant.reseau, corps).texte !== undefined ? `<appel_impose>${avant.appel.texte}</appel_impose>` : `<appel>${avant.appel.texte}</appel>`,
        `<boucle>${avant.boucle ? avant.declinaison.boucle : ""}</boucle>`,
        `<alertes_code>\n${alertesRepetitions([avant.declinaison.accroche, ...segs.map((s) => s.texte)], avant.appel.texte).map((x) => `- ${x}`).join("\n") || "- aucune"}\n</alertes_code>`,
      ].join("\n");
      const r = await appeler(c, 3, roleCourtPour(c, roleCourtRelecture), variableC, EVALUATIONS_COURT_RELECTURE);
      let version = avant;
      // Relecture finale A09 : une relecture inutilisable n'est plus avalée en silence. La version d'avant reste
      // utilisable, mais elle est marquée « non relue » (journal de l'écriture, contrôles de la version).
      const motif = !r.donnees ? r.echecs.join(" ; ") || "sortie vide" : r.echecs.some((x) => x.startsWith("REL-02")) ? r.echecs.filter((x) => x.startsWith("REL-02")).join(" ; ") : adresseFautive(r.donnees.accroche, d.sujet.adresse) ? `accroche pas au « ${d.sujet.adresse} »` : "";
      const j = [...c.etat.journal].reverse().find((x) => x.role === roleCourtRelecture.id);
      if (motif) {
        c.etat.nonRelue = `Relecture inutilisable (${motif}) : la version gardée n'est pas relue.`;
        if (j) Object.assign(j, { resultat: "invalide", echecs: [...new Set([...(j.echecs ?? []), motif])] });
      } else delete c.etat.nonRelue;
      if (r.donnees && !motif) {
        relecture = r.donnees;
        // Le script et la relecture ont reçu le texte anonymisé : on compare aussi à cette version des ancrages.
        const textesAncrage = ancrages.flatMap((m) => {
          const anonyme = anonymiser(m.texte, { nomsSensibles: nomsDuSocle(d) }).texte;
          return anonyme === m.texte ? [{ id: m.id, texte: m.texte }] : [{ id: m.id, texte: m.texte }, { id: m.id, texte: anonyme }];
        });
        const ancrees = garderCitationsAncrage(segs, relecture.corrections, textesAncrage);
        // Répétitions : une correction qui AJOUTE une répétition est refusée (le socle ne bloque rien, mais la relecture n'en crée pas).
        const sansRedite = garderSansNouvelleRepetition(avant.declinaison.accroche, segs, ancrees.gardees, avant.appel.texte);
        const gardees = sansRedite.gardees;
        const refusees = [...ancrees.refusees, ...sansRedite.refusees];
        const acc = garderAccrocheAncrage(avant.declinaison.accroche, relecture.accroche, textesAncrage);
        if (acc.refus) refusees.push(acc.refus);
        if (refusees.length && j) Object.assign(j, { echecs: [...new Set([...(j.echecs ?? []), ...refusees])] });
        c.etat.corps![0].blocs = appliquerCorrections(corps, gardees);
        c.etat.reecritures = gardees.length ? 1 : 0;
        const dec = avant.declinaison;
        // Un appel imposé par le code n'est jamais réécrit par la relecture.
        const appelGarde = imposer(avant.reseau, corps).texte !== undefined;
        version = assemblerVersion(c, avant.reseau, { ...dec, accroche: acc.accroche, appel: { ...dec.appel, texte: (!appelGarde && relecture.appel.trim()) || dec.appel.texte }, boucle: relecture.boucle.trim() });
        noterEtVoyant(version);
      }
      c.etat.versions = [version];
      await terminer(3);
    }

    // d. Production : une version par réseau en plus (rôle `declinaison`, en parallèle), puis C14 entre versions.
    if (c.etat.etape < 4) {
      const premiere = c.etat.versions![0];
      const autres = reseaux.filter((x) => x !== premiere.reseau);
      const differente = `Accroche et 1re ligne de publication DIFFÉRENTES de celles de la version ${premiere.reseau} (« ${premiere.declinaison.accroche} » ; « ${premiere.declinaison.publication.premiereLigne} »).`;
      const corpsGagnant = c.etat.corps![c.etat.gagnant ?? 0].blocs ?? [];
      // L'appel de chaque réseau est imposé par le code (banque des fins) quand elle en fournit un : il remplace celui écrit.
      const nouvelles = (await Promise.all(autres.map((x) => declinerVersion(c, x, differente)))).map((v) => {
        const impose = v ? imposer(v.reseau, corpsGagnant) : undefined;
        return v && impose?.texte !== undefined ? assemblerVersion(c, v.reseau, { ...v.declinaison, appel: { type: impose.type, texte: impose.texte } }) : v;
      });
      // Contrôle par code de l'adresse : une déclinaison dont l'accroche ou la 1re ligne est dans l'autre adresse est
      // écartée, comme une déclinaison invalide, et notée au journal.
      const adresse = d.sujet.adresse;
      for (const v of nouvelles) {
        if (v && (adresseFautive(v.declinaison.accroche, adresse) || adresseFautive(v.declinaison.publication.premiereLigne, adresse))) {
          c.etat.journal.push({ etape: 4, role: roleDeclinaison.id, dureeMs: 0, coutUsd: 0, modele: "-", resultat: "invalide", echecs: [`${v.reseau} : accroche ou 1re ligne pas au « ${adresse} », version écartée`] });
        }
      }
      const versions = [premiere, ...nouvelles.filter((v): v is VersionEcrite => !!v && !adresseFautive(v.declinaison.accroche, adresse) && !adresseFautive(v.declinaison.publication.premiereLigne, adresse))];
      finirVersions(c, versions);
      alerterRessemblance(c, versions[0], memoire);
      c.etat.versions = versions;
      await terminer(4);
    }
    const version = c.etat.versions![0];
    // Seul le code du réseau de la 1re version (le script gardé) est enregistré ; les autres réseaux ne le sont pas.
    const code = memoire ? (c.etat.codeFinImpose ?? imposer(version.reseau, c.etat.corps?.[c.etat.gagnant ?? 0]?.blocs ?? []).code) : undefined;
    return { statut: "terminee", etat: c.etat, version, avantRelecture: avantRelecture ?? version, relecture, ...(code ? { appels: [code] } : {}) };
  } catch (e) {
    if (e instanceof ReponseCoupee) {
      c.etat.reponseCoupee = e.brut;
      await sauver(c.etat);
      return { statut: "coupee", etat: c.etat, message: e.message };
    }
    if (e instanceof Attente && e.arret !== "reponse-coupee") {
      await sauver(c.etat);
      return { statut: "attente", etat: c.etat, arret: e.arret, message: e.message };
    }
    throw e;
  }
}
