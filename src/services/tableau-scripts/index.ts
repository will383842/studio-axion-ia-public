/**
 * GÉNÉRATEUR DE SCRIPTS DU TABLEAU ANIMÉ — service propre au format, À CÔTÉ du générateur de l'avocat.
 *
 * Déroulé de `genererScriptTableau` :
 *  1. passe « angle » : cinq accroches de types différents, une retenue ;
 *  2. passe « écriture », puis les contrôles EN CODE (`scripts-tableau-controles.ts`) ; si un contrôle éliminatoire
 *     échoue : UNE relance de l'écriture avec la liste précise des défauts, jamais deux ;
 *  3. passe « relecture » (15/10) : les 3 phrases les plus faibles corrigées (jamais de réécriture totale ni d'ajout :
 *     le programme applique les corrections, `appliquerCorrections`), et la grille qui juge la VALEUR du texte corrigé ;
 *     la version corrigée est recontrôlée en code ;
 *  4. on livre la DERNIÈRE version qui passe tous les contrôles en code (`versionRetenue`) : une relecture qui dégrade
 *     ne fait jamais perdre une version valide. La note et la grille portent sur la version RÉELLEMENT retenue : si la
 *     version corrigée échoue et que la précédente est gardée, la grille de la relecture (qui jugeait un autre texte)
 *     n'est pas reprise, et le script est refusé sans note (`grilleDeLaVersion`) ; de même si une correction de la
 *     relecture est écartée (elle notait un texte qui n'existe pas). Livré seulement si la note (calculée
 *     en code : critères respectés sur 10) est ≥ 8, sans critère éliminatoire échoué ; sinon un refus expliqué, qui
 *     garde la MEILLEURE version écrite (affichée, utilisable ou corrigeable à la main : le travail payé n'est jamais
 *     jeté).
 * Le métier de l'exemple change : les métiers des 3 derniers scripts livrés (lus dans les traces) sont donnés à
 * l'écriture et contrôlés ; sans historique, le contrôle est désactivé.
 * Chaque génération laisse UNE trace (collection `tracesScriptsTableau`, jamais purgée ; effacée seulement avec sa vidéo, supprimée à la main par Will, décision du 17/10), ouverte DÈS LE DÉPART et
 * complétée après chaque appel, close même en cas d'erreur ou d'interruption ; et rien d'autre. Modèle : Opus, jamais Haiku. Coût : `estimerCoutScript` (sans appel) AVANT ; le coût réel est rendu APRÈS.
 *
 * Le client est TOUJOURS fourni par l'appelant (`options.client`). Ce service n'appelle jamais Claude lui-même : la
 * garde de structure du studio (`tests/v4-argent.test.ts`) veut que toute dépense Claude passe par les deux chemins
 * plafonnés (`generation-claude.ts`, `depense-claude-video.ts`), avec pré-vol, réservation et dépense enregistrée.
 * Le branchement réel est `clientScriptsStudio` (`client-studio.ts`) : chaque passe passe par `executerRolePourVideo`,
 * sur le plafond propre de l'écriture (par vidéo). Sans client : refus.
 *
 * `options.angle` : l'angle d'une génération précédente, avec une AUTRE accroche retenue (« relancer l'écriture ») :
 * la passe « angle » n'est pas refaite.
 */
import "server-only";
import type { z } from "zod";
import {
  NOTE_MINIMALE,
  CRITERES_GRILLE,
  eliminatoiresEchoues,
  noteDeGrille,
  normaliserScript,
  partiesDuScript,
  METIER_EXEMPLE_MAX,
  QUESTIONS_IA,
  questionIaDuTexte,
  questionIaSuivante,
  QUESTIONS_IA_RECENTES,
  schemaAngle,
  schemaDemandeScript,
  schemaEcriture,
  schemaRelecture,
  type AffirmationScript,
  type AngleScript,
  type AppelTrace,
  type DemandeScriptTableau,
  type DemandeScriptTableauSaisie,
  type EcritureScript,
  type LigneGrille,
  type ResultatScriptTableau,
  type ScriptTableau,
  type TraceScriptTableau,
  type VersionTrace,
} from "@/domaine/scripts-tableau";
import {
  aDesEliminatoires,
  appliquerCorrections,
  controlerEcriture,
  dureeEstimee,
  ecritureLue,
  texteDitDe,
  versionRetenue,
  type CodeControle,
  type DefautScript,
  type OptionsControles,
  type VersionRetenue,
} from "@/domaine/scripts-tableau-controles";
import { DOULEUR_MAX_TABLEAU, nettoyerMotsDouleur, raccourcirDouleur } from "@/domaine/douleur-tableau";
import { ErreurClaude, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { masquerSecrets } from "@/fournisseurs/claude/secret";
import { coutUsd, jetonsEstimes, pireCasUsd, tarifDe } from "@/fournisseurs/claude/tarifs";
import { nouvelId } from "@/lib/ids";
import { TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import type { Montant } from "@/domaine/types";
import { depots, horodatage, maintenant } from "../_commun";
import { exigerSession } from "../auth";
import { alerteRessemblance, CARACTERES_BLOC_MAX, memoireDuTableau, memoireTableauAllumee, texteSansAppel, type MemoireTableau } from "./memoire";
import { METHODE_PAR_DEFAUT, requeteAngle, requeteEcriture, requeteRelecture, verifierModele, type MethodeTableau, type PasseScript } from "./consignes";

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ce qui envoie une requête au modèle. Les tests injectent un client simulé (aucun réseau). Un client réel doit
 * passer par un chemin plafonné du studio (pré-vol, réservation, dépense enregistrée) : c'est lui qui paie, pas ici.
 */
export interface ClientScripts {
  /** `passe` : la passe demandée (le client du studio en tire la sortie attendue). Réponse : `coutUsd` et `dureeMs` s'ils sont connus. */
  appeler(r: RequeteClaude, passe: AppelTrace["passe"]): Promise<ReponseClaude & { coutUsd?: number; dureeMs?: number }>;
  /** Vrai pour un client d'essai (rien n'est payé), noté dans la trace. */
  simule: boolean;
}

/** Où en est une génération : passé à `surEtape` après chaque appel (l'écran et la tâche de fond le gardent). */
export interface AvancementScript {
  /** Ce qui vient d'être fait. */
  etape: "accroches" | "ecriture" | "relance" | "relecture";
  angle: AngleScript | null;
  versions: VersionTrace[];
  appels: AppelTrace[];
}

export interface OptionsGeneration {
  /** Client fourni par l'appelant. Absent : refus, aucun appel. */
  client?: ClientScripts;
  /** Angle déjà écrit (cinq accroches), avec l'accroche retenue choisie : seule l'écriture est refaite. */
  angle?: AngleScript;
  /** Trace à compléter (ouverte par l'appelant, `ouvrirTraceScript`) ; absente : une trace neuve est ouverte ici. */
  traceId?: string;
  /** Vidéo et tâche de fond, notées dans la trace et dans le journal du serveur. */
  contexte?: { videoId?: string; tacheId?: string };
  /** Appelé après chaque appel (et ses contrôles) : l'état est gardé, une reprise ne repaie rien. */
  surEtape?: (a: AvancementScript) => Promise<void>;
  /** Méthode d'écriture (réglage `tableau.methode`) ; absente : le défaut (« courte »). */
  methode?: MethodeTableau;
  /** Mémoire d'écriture commune (réglage `ecriture.memoireTableau`, coupé par défaut) : forcée pour un essai ; absente : le réglage. */
  memoireCommune?: boolean;
  /** RÉSERVÉ : aucun appelant ne le passe encore. « will » : script collé par Will, pris tel quel (ni mémoire, ni ressemblance, jamais gardé comme à éviter). Absent : écrit par le générateur. */
  origine?: "will";
}

/**
 * Nature de chaque contrôle, pour la méthode courte : « forme » = ce que la relecture ne peut pas réparer (elle ne
 * remplace que 3 phrases au plus, sans rien ajouter ni toucher aux champs idée, gain, métier, mots de la douleur,
 * mention de l'exemple) : seul un défaut éliminatoire de forme déclenche la relance. « fond » = une phrase à remplacer :
 * la relecture le reçoit et le corrige, sinon le script est refusé comme avant.
 */
export const NATURE_CONTROLE: Readonly<Record<CodeControle, "forme" | "fond">> = {
  "accroche-longue": "forme",
  "accroche-question-molle": "fond",
  "accroche-salutation": "forme",
  "phrase-longue": "forme",
  "phrase-vide": "forme",
  "ecran-mots": "forme",
  "nombre-etapes": "forme",
  "etape-imperatif": "forme",
  "etape-numero-dit": "forme",
  "etape-vague": "fond",
  "etape-sans-comment": "forme",
  "etape-longue": "forme",
  "promesse-nombre": "forme",
  "passage-mots": "forme",
  "script-mots": "forme",
  "idee-absente": "forme",
  "a-retenir-liste": "fond",
  "gain-absent": "forme",
  "gain-hors-promesse": "fond",
  "gain-hors-exemple": "fond",
  "entreprise-sans-lien": "fond",
  "entreprise-incoherente": "fond",
  "repetition-mots": "fond",
  "formule-creuse": "fond",
  jargon: "fond",
  positionnement: "fond",
  "question-spectateur": "fond",
  "redit-accroche": "fond",
  "densite-scene": "fond",
  "ecran-redit": "fond",
  "metier-repete": "forme",
  "nombres-incoherents": "fond",
  "exemple-absent": "forme",
  "exemple-avant-apres": "forme",
  "partie-vide": "forme",
  "promesse-longue": "forme",
  "a-retenir-long": "forme",
  "douleur-tardive": "forme",
  repetition: "fond",
  "libelle-probleme": "fond",
  "affirmation-absolue": "fond",
  "affirmation-non-verifiee": "fond",
  "exemple-non-marque": "forme",
  "action-absente": "forme",
  "actions-multiples": "forme",
  "action-hors-demande": "forme",
  "cloture-longueur": "forme",
  "cloture-question": "forme",
  "cloture-virgule": "forme",
  "duree-reseau": "forme",
  "mot-interdit": "fond",
  "chiffre-sans-source": "fond",
  "mots-douleur": "forme",
  "entreprise-corps": "fond",
  "entreprise-fin": "forme",
  // La relecture ne peut pas ajouter la question sur l'IA : seule une relance de l'écriture la répare.
  "question-ia": "forme",
};

/** Un défaut éliminatoire de FORME (méthode courte : seul cas de relance). */
export const aDesEliminatoiresDeForme = (d: readonly DefautScript[]): boolean => d.some((x) => x.eliminatoire && NATURE_CONTROLE[x.code] === "forme");

/**
 * Arrêt du client (plafond, crédit, Claude non relié, réponse hors format) : son message est dit tel quel.
 * `definitif` : l'appel a été fait et payé, mais sa réponse est inutilisable ; refaire la même chose ne servirait à rien.
 */
export class ArretClientScripts extends Error {
  constructor(
    message: string,
    public readonly definitif: boolean = false,
  ) {
    super(message);
    this.name = "ArretClientScripts";
  }
}

/* ------------------------------------------------------------------ */
/* Estimation du coût (AVANT, sans aucun appel)                        */
/* ------------------------------------------------------------------ */

/** Taille ajoutée à l'entrée des passes suivantes par ce qu'a rendu la précédente (jetons, au pire). */
const JETONS_ANGLE = 1_200;
const JETONS_ECRITURE = 5_000;
/** Part des jetons de sortie réellement utilisée en moyenne (pensée comprise) : sert à l'estimation réaliste. */
const PART_SORTIE_REALISTE = 0.45;

export interface EstimationCoutScript {
  modele: string;
  appels: { passe: PasseScript | "relance"; estimationUsd: number; pireCasUsd: number }[];
  /** Les trois passes, sans relance. */
  estimationUsd: number;
  /** Les quatre appels possibles (relance comprise), toute la sortie permise. */
  pireCasUsd: number;
  estimationEur: Montant;
  pireCasEur: Montant;
}

function jetonsRequete(r: RequeteClaude): number {
  return jetonsEstimes([...r.systeme.map((b) => b.texte), ...r.messages.map((m) => m.contenu), r.schema ? JSON.stringify(r.schema) : ""].join("\n"));
}

/** Angle factice de la bonne taille, pour mesurer les requêtes suivantes sans appel. */
const ANGLE_FICTIF: AngleScript = {
  angle: "",
  douleur: "",
  accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "", ecran: "", pourquoi: "" })),
  retenue: 0,
  raison: "",
};
const ECRITURE_VIDE: EcritureScript = {
  idee: "",
  gain: { formule: "", unite: "" },
  metierExemple: "",
  script: { accroche: [], douleur: [], promesse: [], etapes: [], exemple: { mentionEcran: "", phrases: [] }, aRetenir: [], appel: [] },
  motsDouleur: [],
  sources: [],
  affirmations: [],
  variantes: [],
  aPreparer: [],
};

/**
 * Jetons ajoutés à CHAQUE passe par le socle de Will (charte, style, preuves, modèles de ton : les quatre passes le
 * reçoivent en entier, `client-studio.ts`), balises comprises. Sert à `estimerCoutScript` (PUR).
 */
export function jetonsDuSocle(socle: { contexteAxion?: string; styleWill?: string; preuves?: string; gagnants?: string } | undefined): number {
  if (!socle) return 0;
  return jetonsEstimes([["contexte_axion", socle.contexteAxion], ["style_will", socle.styleWill], ["preuves", socle.preuves], ["gagnants", socle.gagnants]].filter(([, t]) => t?.trim()).map(([b, t]) => `<${b}>\n${t}\n</${b}>`).join("\n"));
}

/** Jetons des blocs du tableau mis en cache 1 h (méthode courte : la recette entière ; complète : aucun). */
function jetonsRecetteEnCache(r: RequeteClaude): number {
  const fin = r.systeme.findLastIndex((b) => b.cache === "1h");
  return fin >= 0 ? jetonsEstimes(r.systeme.slice(0, fin + 1).map((b) => b.texte).join("\n")) : 0;
}

/** Les plus longs choix des contrôles pour l'estimation : la question sur l'IA la plus longue et trois métiers de la longueur maximale (balises `<question_ia>` et `<metiers_recents>`). */
export const OPTIONS_ESTIMATION: OptionsControles = {
  questionIa: [...QUESTIONS_IA].sort((a, b) => b.length - a.length)[0],
  metiersRecents: ["a", "b", "c"].map((mot) => `${mot} `.repeat(METIER_EXEMPLE_MAX).slice(0, METIER_EXEMPLE_MAX)),
};

/**
 * Estimation du coût d'une génération, AVANT tout appel (PUR : aucun réseau, aucune base). `jetonsSocle` : la taille du
 * socle de Will donné à chaque passe (`jetonsDuSocle`), pour que le prix annoncé reste vrai. `methode` : « courte »
 * compte ses plafonds réduits et sa recette au prix de l'écriture 1 h ; la relance reste dans le pire cas (possible).
 */
export function estimerCoutScript(saisie: DemandeScriptTableauSaisie, tauxUsdEur: number = TAUX_USD_EUR_PAR_DEFAUT, jetonsSocle = 0, methode: MethodeTableau = METHODE_PAR_DEFAUT, avecMemoire = false): EstimationCoutScript {
  const d = schemaDemandeScript.parse(saisie);
  // Mémoire d'écriture commune allumée : le bloc le plus long (au pire) s'ajoute à l'écriture et à sa relance.
  const memoire = avecMemoire ? "x".repeat(CARACTERES_BLOC_MAX) : undefined;
  const requetes: { passe: PasseScript | "relance"; r: RequeteClaude; ajout: number }[] = [
    { passe: "angle", r: requeteAngle(d, methode), ajout: 0 },
    { passe: "ecriture", r: requeteEcriture(d, ANGLE_FICTIF, undefined, OPTIONS_ESTIMATION, methode, memoire), ajout: JETONS_ANGLE },
    { passe: "relance", r: requeteEcriture(d, ANGLE_FICTIF, { defauts: [], precedente: ECRITURE_VIDE }, OPTIONS_ESTIMATION, methode, memoire), ajout: JETONS_ANGLE + JETONS_ECRITURE },
    { passe: "relecture", r: requeteRelecture(d, ANGLE_FICTIF, ECRITURE_VIDE, methode), ajout: JETONS_ANGLE + JETONS_ECRITURE },
  ];
  const appels = requetes.map(({ passe, r, ajout }) => {
    const entree = jetonsRequete(r) + ajout + jetonsSocle;
    const enCache1h = jetonsSocle + jetonsRecetteEnCache(r);
    const t = tarifDe(r.modele);
    return {
      passe,
      estimationUsd: passe === "relance" ? 0 : (entree * t.entree + r.maxTokens * PART_SORTIE_REALISTE * t.sortie) / 1_000_000,
      // Le socle part avec un point de cache 1 h (`construireRequete`) : compté au prix de l'écriture 1 h (modèles de ton
      // compris, au pire), pour que le prix annoncé et le plafond par défaut ne soient jamais sous l'appel réservé.
      pireCasUsd: pireCasUsd(r.modele, entree, r.maxTokens, enCache1h),
    };
  });
  const estimationUsd = appels.reduce((s, a) => s + a.estimationUsd, 0);
  const pire = appels.reduce((s, a) => s + a.pireCasUsd, 0);
  return {
    modele: requetes[0].r.modele,
    appels,
    estimationUsd,
    pireCasUsd: pire,
    estimationEur: usdVersEur(Math.ceil(estimationUsd * 100), tauxUsdEur),
    pireCasEur: usdVersEur(Math.ceil(pire * 100), tauxUsdEur),
  };
}

/* ------------------------------------------------------------------ */
/* Texte dit, pour le découpage en scènes                              */
/* ------------------------------------------------------------------ */

/** Le texte à donner au découpage en scènes : les phrases dites, dans l'ordre, sans les mots à l'écran. */
export function versTexteDit(script: ScriptTableau): string {
  return texteDitDe(script);
}

/* ------------------------------------------------------------------ */
/* Génération                                                          */
/* ------------------------------------------------------------------ */

/**
 * Issue d'une génération. Échec : `nature` dit quoi faire ensuite — « refus » (le script n'est pas assez bon, ou une
 * réponse payée est inutilisable : réécrire), « arret » (plafond, crédit, Claude indisponible : rien de payé pour cet
 * appel, on peut réessayer), « erreur » (exception imprévue : on peut réessayer, les appels faits sont gardés).
 */
export type IssueScriptTableau =
  | { ok: true; traceId: string; resultat: ResultatScriptTableau; angle: AngleScript; coutUsd: number; appels: number; simule: boolean }
  | { ok: false; traceId: string; motifs: string[]; nature: "refus" | "arret" | "erreur"; coutUsd: number; appels: number; simule: boolean; meilleure?: VersionRetenue };

class RefusScript extends Error {
  constructor(public readonly motifs: string[]) {
    super(motifs.join(" "));
  }
}

function lire<S extends z.ZodType>(schema: S, reponse: ReponseClaude, passe: string): z.infer<S> {
  if (reponse.stopReason === "max_tokens") throw new RefusScript([`La passe « ${passe} » a été coupée avant la fin (réponse trop longue).`]);
  if (reponse.stopReason === "refusal") throw new RefusScript([`Le modèle a refusé la passe « ${passe} ».`]);
  let brut: unknown;
  try {
    brut = JSON.parse(reponse.texte);
  } catch {
    throw new RefusScript([`La réponse de la passe « ${passe} » n'est pas lisible (JSON attendu).`]);
  }
  const r = schema.safeParse(brut);
  if (!r.success) throw new RefusScript([`La réponse de la passe « ${passe} » ne suit pas le format attendu : ${r.error.issues.map((i) => `${i.path.join(".") || "racine"} ${i.message}`).join(" ; ").slice(0, 300)}`]);
  return r.data;
}

/** La grille du modèle, corrigée par les contrôles en code : un défaut en code rend faux le critère qu'il couvre. */
const CRITERE_DU_DEFAUT: Partial<Record<DefautScript["code"], LigneGrille["critere"]>> = {
  "accroche-longue": "accroche-douleur",
  "accroche-question-molle": "accroche-douleur",
  "accroche-salutation": "accroche-douleur",
  "mots-douleur": "accroche-douleur",
  "douleur-tardive": "douleur-vecue",
  "idee-absente": "une-idee",
  "a-retenir-long": "une-idee",
  "a-retenir-liste": "une-idee",
  "gain-absent": "gain",
  "gain-hors-promesse": "gain",
  "gain-hors-exemple": "gain",
  "promesse-longue": "promesse-tenue",
  "promesse-nombre": "promesse-tenue",
  "exemple-absent": "promesse-tenue",
  "exemple-avant-apres": "promesse-tenue",
  "nombres-incoherents": "promesse-tenue",
  "nombre-etapes": "etapes-claires",
  "etape-imperatif": "etapes-claires",
  "etape-numero-dit": "etapes-claires",
  "question-spectateur": "douleur-vecue",
  "redit-accroche": "une-idee",
  "etape-vague": "etapes-claires",
  "etape-sans-comment": "etapes-claires",
  "etape-longue": "etapes-claires",
  "libelle-probleme": "clarte",
  "repetition": "clarte",
  "repetition-mots": "clarte",
  "formule-creuse": "clarte",
  "exemple-non-marque": "verite",
  "chiffre-sans-source": "verite",
  "affirmation-absolue": "verite",
  "affirmation-non-verifiee": "verite",
  "action-absente": "une-seule-demande",
  "actions-multiples": "une-seule-demande",
  "action-hors-demande": "une-seule-demande",
  "cloture-longueur": "une-seule-demande",
  "cloture-question": "une-seule-demande",
  "cloture-virgule": "une-seule-demande",
  "entreprise-corps": "une-seule-demande",
  "entreprise-fin": "une-seule-demande",
  "entreprise-sans-lien": "une-seule-demande",
  "entreprise-incoherente": "une-seule-demande",
  "partie-vide": "cadre",
  "passage-mots": "cadre",
  "script-mots": "cadre",
  "phrase-longue": "cadre",
  "metier-repete": "cadre",
};

/**
 * La grille de la relecture ne vaut que pour le texte qu'elle a jugé (sa version corrigée) : rendue si la version
 * retenue dit EXACTEMENT ce texte, `null` sinon (la version corrigée a échoué aux contrôles et une version précédente,
 * différente, est gardée : aucune note sur un autre texte).
 */
export function grilleDeLaVersion(grille: readonly LigneGrille[], jugee: Pick<EcritureScript, "script">, retenue: Pick<VersionRetenue, "ecriture">): LigneGrille[] | null {
  return texteDitDe(jugee.script) === texteDitDe(retenue.ecriture.script) ? [...grille] : null;
}

/** Motif d'un refus sans note : la relecture a noté un autre texte que la version gardée. */
export const MOTIF_SANS_NOTE = "La version corrigée par la relecture échoue aux contrôles : la version gardée n'a pas été notée (la grille de la relecture jugeait un autre texte). Relancez l'écriture ou corrigez à la main.";

/** Motif d'un refus sans note : des corrections de la relecture n'ont pas pu être appliquées (sa grille notait un autre texte). */
export function motifCorrectionsEcartees(ecartees: readonly { correction: { avant: string }; raison: string }[]): string {
  return `La relecture a noté son texte corrigé, mais ${ecartees.length} correction${ecartees.length > 1 ? "s n'ont" : " n'a"} pas pu être appliquée${ecartees.length > 1 ? "s" : ""} (${ecartees.map((x) => `« ${x.correction.avant.trim().slice(0, 60)} » : ${x.raison.replace(/\.$/, "").toLowerCase()}`).join(" ; ")}) : le texte gardé n'est pas celui qu'elle a noté, il n'a pas de note. Relancez l'écriture ou corrigez à la main.`;
}

/** Affirmations de l'écriture complétées par celles de la relecture (sans doublon d'extrait). */
function fusionnerAffirmations(a: readonly AffirmationScript[] | undefined, b: readonly AffirmationScript[]): AffirmationScript[] {
  const res = [...(a ?? [])];
  for (const x of b) if (x.extrait.trim() && !res.some((y) => y.extrait.trim().toLowerCase() === x.extrait.trim().toLowerCase())) res.push(x);
  return res;
}

/**
 * Les métiers des exemples des 3 derniers scripts LIVRÉS d'AUTRES vidéos (traces, la plus récente d'abord), hors la
 * génération en cours et les écritures précédentes de la même vidéo (une autre accroche garde son exemple) ;
 * `undefined` si aucun n'est connu (traces d'avant le 15/10, base vide, lecture impossible) : le contrôle est alors
 * désactivé.
 */
export async function metiersRecents(sauf: { traceId?: string; videoId?: string; avant?: string } = {}): Promise<string[] | undefined> {
  try {
    const traces = (await depots().tracesScriptsTableau.lister())
      .filter((t) => t.issue === "livre" && t.id !== sauf.traceId && !(sauf.videoId && t.videoId === sauf.videoId) && (!sauf.avant || t.date < sauf.avant))
      .sort((a, b) => b.date.localeCompare(a.date));
    const metiers = traces
      .map((t) => [...t.versions].reverse().map((v) => v.ecriture?.metierExemple?.trim() ?? "").find(Boolean) ?? "")
      .map((m) => m.slice(0, METIER_EXEMPLE_MAX))
      .filter(Boolean)
      .slice(0, 3);
    return metiers.length ? metiers : undefined;
  } catch {
    return undefined;
  }
}

/**
 * La question sur l'IA dite dans les derniers scripts LIVRÉS d'AUTRES vidéos (traces, la plus récente d'abord ; même
 * lecture que `metiersRecents`) ; `undefined` si aucune n'est connue (traces d'avant le 18/10, base vide, lecture
 * impossible) : la première formulation est alors tirée.
 */
export async function questionsIaRecentes(sauf: { traceId?: string; videoId?: string; avant?: string } = {}): Promise<string[] | undefined> {
  try {
    const traces = (await depots().tracesScriptsTableau.lister())
      .filter((t) => t.issue === "livre" && t.id !== sauf.traceId && !(sauf.videoId && t.videoId === sauf.videoId) && (!sauf.avant || t.date < sauf.avant))
      .sort((a, b) => b.date.localeCompare(a.date));
    const questions = traces
      .map((t) => [...t.versions].reverse().map((v) => questionIaDuTexte(texteDitDe(normaliserScript(v.ecriture?.script))) ?? "").find(Boolean) ?? "")
      .filter(Boolean)
      .slice(0, QUESTIONS_IA_RECENTES);
    return questions.length ? questions : undefined;
  } catch {
    return undefined;
  }
}

export function grilleCorrigee(grille: readonly LigneGrille[], defauts: readonly DefautScript[]): LigneGrille[] {
  const faux = new Map<string, string>();
  for (const d of defauts) {
    const c = d.code === "mot-interdit" ? (/vague/.test(d.message) ? "clarte" : /prix|entreprise|adresse|formation|équipe|clients|contactez/.test(d.message) ? "une-seule-demande" : null) : CRITERE_DU_DEFAUT[d.code];
    // Une remarque (non éliminatoire, le jargon) ne rend faux aucun critère.
    if (c && d.eliminatoire && !faux.has(c)) faux.set(c, d.message);
  }
  return grille.map((l) => (faux.has(l.critere) && l.respecte ? { ...l, respecte: false, remarque: `Contrôle en code : ${faux.get(l.critere)}` } : l));
}

/** Trace d'une génération à son départ (`en-cours`), avant tout appel : une génération coupée laisse toujours sa trace. */
export async function ouvrirTraceScript(id: string, demande: DemandeScriptTableau, contexte: { videoId?: string; tacheId?: string } = {}, simule = false): Promise<void> {
  const d = depots();
  if (await d.tracesScriptsTableau.obtenir(id)) return;
  await d.tracesScriptsTableau.enregistrer({
    id,
    ...horodatage(),
    date: maintenant(),
    issue: "en-cours",
    ...(contexte.videoId ? { videoId: contexte.videoId } : {}),
    ...(contexte.tacheId ? { tacheId: contexte.tacheId } : {}),
    demande,
    accroches: [],
    retenue: null,
    raison: "",
    versions: [],
    grille: [],
    note: null,
    motifs: [],
    appels: [],
    coutUsd: 0,
    simule,
  });
}

/** Complète une trace (jamais supprimée). Une trace qui ne peut pas être écrite est dite au journal du serveur, sans bloquer. */
async function completerTrace(id: string, patch: Partial<TraceScriptTableau>, contexte: OptionsGeneration["contexte"]): Promise<void> {
  try {
    await depots().tracesScriptsTableau.modifier(id, patch);
  } catch (e) {
    console.error(`[tableau] trace du script ${id} non écrite (vidéo ${contexte?.videoId ?? "?"}) : ${e instanceof Error ? e.name : "erreur"}`);
  }
}

/** Ferme la trace d'une génération interrompue (redémarrage pendant un appel) ou en erreur hors du générateur. */
export async function fermerTraceScript(id: string, issue: "erreur" | "interrompu", erreur: string): Promise<void> {
  if (!(await depots().tracesScriptsTableau.obtenir(id))) return;
  await completerTrace(id, { issue, erreur }, undefined);
}

/**
 * Génère un script du tableau animé (trois passes, une relance au plus). Rend le script livré ou un refus expliqué ;
 * dans tous les cas, une trace est écrite dès le départ et complétée à chaque étape. Ne lève que pour une demande
 * invalide ou une session absente.
 */
export async function genererScriptTableau(saisie: DemandeScriptTableauSaisie, options: OptionsGeneration = {}): Promise<IssueScriptTableau> {
  await exigerSession();
  return deroulerScriptTableau(saisie, options);
}

/**
 * Le déroulé, SANS session : la tâche de fond du studio l'appelle (hors de toute requête). Chaque appel est suivi de
 * `surEtape` et de la trace complétée ; toute erreur est rendue en refus expliqué, écrite au journal du serveur avec la
 * vidéo et l'étape (jamais de clé ni de texte de la demande).
 */
export async function deroulerScriptTableau(saisie: DemandeScriptTableauSaisie, options: OptionsGeneration = {}): Promise<IssueScriptTableau> {
  const demande = schemaDemandeScript.parse(saisie);
  const methode = options.methode ?? METHODE_PAR_DEFAUT;
  const client = options.client ?? null;
  const contexte = options.contexte;
  const appels: AppelTrace[] = [];
  const versions: VersionTrace[] = [];
  let angle: AngleScript | null = null;
  let grille: LigneGrille[] = [];
  let note: number | null = null;
  let etape: AvancementScript["etape"] = options.angle ? "ecriture" : "accroches";
  const simule = client?.simule ?? true;
  const traceId = options.traceId ?? nouvelId("tst");
  await ouvrirTraceScript(traceId, demande, contexte ?? {}, simule);

  const cout = () => appels.reduce((s, a) => s + a.coutUsd, 0);
  const etapeFaite = async (faite: AvancementScript["etape"]) => {
    await completerTrace(traceId, { etape: faite, accroches: angle?.accroches ?? [], retenue: angle?.retenue ?? null, raison: angle?.raison ?? "", versions, appels, coutUsd: cout(), simule }, contexte);
    await options.surEtape?.({ etape: faite, angle, versions: [...versions], appels: [...appels] });
  };
  const appeler = async (passe: AppelTrace["passe"], r: RequeteClaude): Promise<ReponseClaude> => {
    verifierModele(r.modele);
    etape = passe === "angle" ? "accroches" : passe;
    const debut = Date.now();
    const reponse = await client!.appeler(r, passe);
    verifierModele(reponse.modele);
    appels.push({ passe, modele: reponse.modele, jetons: reponse.jetons, coutUsd: reponse.coutUsd ?? coutUsd(reponse.jetons, reponse.modele), dureeMs: reponse.dureeMs ?? Date.now() - debut });
    return reponse;
  };

  // Les options des contrôles (métiers et question sur l'IA récents) : lues dans le `try`, reprises pour la meilleure version si l'écriture est refusée.
  let optionsControles: OptionsControles = {};
  let memoire: MemoireTableau | null = null;
  const alertes: string[] = [];
  let issue: { ok: true; resultat: ResultatScriptTableau; angle: AngleScript } | { ok: false; motifs: string[]; nature: "refus" | "arret" | "erreur"; meilleure?: VersionRetenue };
  try {
    if (!client) throw new RefusScript(["Claude n'est pas encore relié au générateur de scripts du tableau animé : aucun script n'a été écrit."]);

    // 1. L'angle (repris tel quel quand une autre accroche est choisie : seule l'écriture est refaite).
    if (options.angle) {
      const repris = schemaAngle.safeParse(options.angle);
      if (!repris.success) throw new RefusScript(["L'accroche choisie n'est pas lisible : relancez l'écriture depuis le début."]);
      angle = angleBorne(repris.data);
    } else {
      angle = angleBorne(lire(schemaAngle, await appeler("angle", requeteAngle(demande, methode)), "angle"));
      await etapeFaite("accroches");
    }

    // 2. L'écriture, contrôlée en code ; une seule relance. Le métier de l'exemple change (3 derniers scripts livrés).
    // Méthode courte : relance seulement sur un défaut éliminatoire de FORME ; les défauts de fond vont à la relecture.
    const courte = methode === "courte";
    const echoue = courte ? aDesEliminatoiresDeForme : aDesEliminatoires;
    // La question sur l'IA tourne d'une vidéo à l'autre (jamais une des 3 dernières livrées).
    const sauf = { traceId, videoId: contexte?.videoId };
    optionsControles = { metiersRecents: await metiersRecents(sauf), questionIa: questionIaSuivante(await questionsIaRecentes(sauf)) };
    // Mémoire commune (lot C2) : réglage coupé = rien ; script de Will = rien ; base muette = rien (l'écriture continue).
    if (options.origine === "will") await completerTrace(traceId, { origine: "will" }, contexte);
    else if (options.memoireCommune ?? (await memoireTableauAllumee())) memoire = await memoireDuTableau(contexte?.videoId);
    let ecriture = lire(schemaEcriture, await appeler("ecriture", requeteEcriture(demande, angle, undefined, optionsControles, methode, memoire?.bloc)), "écriture");
    ecriture.metierExemple = ecriture.metierExemple.slice(0, METIER_EXEMPLE_MAX);
    let defauts = controlerEcriture(ecriture, demande, optionsControles);
    versions.push({ passe: "ecriture", ecriture, defauts });
    await etapeFaite("ecriture");
    if (echoue(defauts)) {
      const relance = lire(schemaEcriture, await appeler("relance", requeteEcriture(demande, angle, { defauts: defauts.filter((x) => x.eliminatoire), precedente: ecriture }, optionsControles, methode, memoire?.bloc)), "relance de l'écriture");
      ecriture = relance;
      ecriture.metierExemple = ecriture.metierExemple.slice(0, METIER_EXEMPLE_MAX);
      defauts = controlerEcriture(ecriture, demande, optionsControles);
      versions.push({ passe: "relance", ecriture, defauts });
      await etapeFaite("relance");
      if (echoue(defauts)) throw new RefusScript(["Après une relance, le script échoue encore aux contrôles :", ...messages(defauts)]);
    }

    // 3. La relecture : au plus 3 phrases corrigées (appliquées par le programme), et la grille du texte corrigé.
    const aCorriger = courte ? defauts.filter((x) => x.eliminatoire) : [];
    const relu = lire(schemaRelecture, await appeler("relecture", requeteRelecture(demande, angle, ecriture, methode, aCorriger)), "relecture");
    const { ecriture: corrigee, ecartees } = appliquerCorrections(ecriture, relu.corrections);
    const relue: EcritureScript = { ...corrigee, affirmations: fusionnerAffirmations(corrigee.affirmations, relu.affirmations) };
    versions.push({ passe: "relecture", ecriture: relue, defauts: controlerEcriture(relue, demande, optionsControles) });
    // La dernière version qui passe tous les contrôles en code (la relue, sinon la précédente).
    const retenue = versionRetenue(versions, demande, optionsControles)!;
    const finale = retenue.ecriture;
    const defautsFinaux = retenue.defauts;
    // La note porte sur la version RÉELLEMENT retenue : jamais la grille d'un autre texte. Une correction écartée (phrase
    // mal recopiée, ajout, quatrième correction) : la relecture a noté un texte qui n'existe pas, sa grille ne vaut rien.
    const grilleJugee = ecartees.length ? null : grilleDeLaVersion(ordonnerGrille(relu.grille), relue, retenue);
    grille = grilleJugee ? grilleCorrigee(grilleJugee, defautsFinaux) : [];
    note = grilleJugee ? noteDeGrille(grille) : null;
    await etapeFaite("relecture");
    const motifs: string[] = [];
    if (aDesEliminatoires(defautsFinaux)) motifs.push("La version relue échoue aux contrôles :", ...messages(defautsFinaux));
    if (ecartees.length) motifs.push(motifCorrectionsEcartees(ecartees));
    else if (!grilleJugee) motifs.push(MOTIF_SANS_NOTE);
    const elimines = eliminatoiresEchoues(grille);
    if (elimines.length) motifs.push(`Critère${elimines.length > 1 ? "s" : ""} éliminatoire${elimines.length > 1 ? "s" : ""} non respecté${elimines.length > 1 ? "s" : ""} : ${elimines.map(libelleCritere).join(" ; ")}.`);
    if (note !== null && note < NOTE_MINIMALE) motifs.push(`Note ${note} sur 10 : il faut au moins ${NOTE_MINIMALE}.`);
    // Complétude (REGLES § 6, passe 3) : ce qui manque encore pour comprendre le réflexe refuse le script.
    const manques = relu.manques.map((m) => m.trim()).filter(Boolean);
    if (manques.length) motifs.push(`Il manque encore, pour comprendre le réflexe : ${manques.join(" ; ")}.`);
    if (motifs.length) throw new RefusScript(motifs);

    // Ressemblance avec les récents : ALERTE seulement (aucune relance payée, le script est livré).
    const alerte = memoire ? alerteRessemblance(texteSansAppel(finale.script), memoire.scripts) : null;
    if (alerte) {
      alertes.push(alerte);
      console.warn(`[tableau] vidéo ${contexte?.videoId ?? "?"} : ${alerte}`);
    }

    const r = angle;
    issue = {
      ok: true,
      angle: r,
      resultat: {
        accroches: r.accroches,
        retenue: r.retenue,
        raison: r.raison,
        angle: r.angle,
        script: finale.script,
        sources: finale.sources,
        grille,
        note: note ?? 0,
        variantes: finale.variantes,
        aPreparer: aPreparer(finale, demande),
        motsDouleur: nettoyerMotsDouleur(finale.motsDouleur),
        affirmations: finale.affirmations ?? [],
        idee: finale.idee,
        gain: finale.gain,
        metierExemple: finale.metierExemple,
        parties: partiesDuScript(finale.script),
        dureeEstimeeSecondes: dureeEstimee(texteDitDe(finale.script)),
      },
    };
  } catch (err) {
    if (err instanceof RefusScript) issue = { ok: false, motifs: err.motifs, nature: "refus" };
    else if (err instanceof ArretClientScripts) issue = { ok: false, motifs: [err.message], nature: err.definitif ? "refus" : "arret" };
    else if (err instanceof ErreurClaude) issue = { ok: false, motifs: [`Claude n'a pas pu répondre : ${err.message}`], nature: "arret" };
    else {
      const message = masquerSecrets(err instanceof Error ? err.message : String(err), []).slice(0, 300);
      issue = { ok: false, motifs: [`Génération interrompue : ${message}`], nature: "erreur" };
    }
    // Refus : la meilleure version écrite est gardée (affichée, utilisable ou corrigeable), jamais jetée.
    const meilleure = issue.nature === "refus" ? versionRetenue(versions, demande, optionsControles) : null;
    if (meilleure) issue = { ...issue, meilleure };
    if (!(err instanceof RefusScript)) {
      // Journal du serveur : la vidéo, l'étape et la nature de l'erreur ; jamais la demande ni une clé.
      console.error(`[tableau] écriture du script : vidéo ${contexte?.videoId ?? "?"}, étape « ${etape} », ${err instanceof Error ? err.name : "erreur"} : ${issue.motifs[0].slice(0, 200)}`);
    }
  }

  await completerTrace(
    traceId,
    {
      date: maintenant(),
      issue: issue.ok ? "livre" : issue.nature === "erreur" ? "erreur" : "refuse",
      etape,
      accroches: angle?.accroches ?? [],
      retenue: angle?.retenue ?? null,
      raison: angle?.raison ?? "",
      versions,
      grille,
      note,
      motifs: issue.ok ? [] : issue.motifs,
      ...(!issue.ok && issue.nature !== "refus" ? { erreur: issue.motifs.join(" ") } : {}),
      ...(alertes.length ? { alertes } : {}),
      appels,
      coutUsd: cout(),
      simule,
    },
    contexte,
  );

  return issue.ok
    ? { ok: true, traceId, resultat: issue.resultat, angle: issue.angle, coutUsd: cout(), appels: appels.length, simule }
    : { ok: false, traceId, motifs: issue.motifs, nature: issue.nature, coutUsd: cout(), appels: appels.length, simule, ...(issue.meilleure ? { meilleure: issue.meilleure } : {}) };
}

/** Les traces des générations, la plus récente d'abord (lecture seule). */
export async function listerTracesScriptsTableau(): Promise<TraceScriptTableau[]> {
  await exigerSession();
  return (await depots().tracesScriptsTableau.lister()).sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/**
 * Contrôle en code de la douleur rendue par la passe « angle » : la borne de la fiche (140 caractères) n'est pas imposée
 * à la lecture (une douleur un peu longue ne jette pas un appel payé) ; elle est raccourcie à la première phrase
 * entière qui tient.
 */
export function angleBorne(a: AngleScript): AngleScript {
  return a.douleur.length > DOULEUR_MAX_TABLEAU ? { ...a, douleur: raccourcirDouleur(a.douleur) } : a;
}

function messages(d: readonly DefautScript[]): string[] {
  return d.filter((x) => x.eliminatoire).map((x) => x.message);
}

function libelleCritere(id: LigneGrille["critere"]): string {
  return CRITERES_GRILLE.find((c) => c.id === id)?.libelle ?? id;
}

function ordonnerGrille(g: readonly LigneGrille[]): LigneGrille[] {
  return CRITERES_GRILLE.map((c) => g.find((l) => l.critere === c.id)!).filter(Boolean);
}

/** Ce qui doit exister avant publication : la liste du modèle, plus ce que la demande impose (sans doublon). */
function aPreparer(e: EcritureScript, d: DemandeScriptTableau): string[] {
  const liste = e.aPreparer.map((x) => x.trim()).filter(Boolean);
  const imposes = [
    d.fin.type === "commentaire" ? `Le document envoyé à ceux qui commentent « ${d.fin.mot} » : ${d.envoi}` : `Le lien de réservation de l'appel de diagnostic (${d.envoi})`,
    ...e.sources.filter((s) => s.source.trim()).map((s) => `La source vérifiée du chiffre « ${s.extrait} » : ${s.source}`),
  ];
  for (const x of imposes) if (!liste.some((l) => l.toLowerCase() === x.toLowerCase())) liste.push(x);
  return liste;
}

/**
 * Les options des contrôles d'une trace déjà écrite (« Reprendre la meilleure version ») : la question sur l'IA est celle
 * que la version écrite dit (aucun nouveau tirage : il changerait si une autre vidéo a été livrée depuis), et les métiers
 * récents sont ceux des scripts livrés AVANT cette écriture.
 */
export async function optionsControlesDeLaTrace(trace: Pick<TraceScriptTableau, "id" | "videoId" | "date" | "versions">): Promise<OptionsControles> {
  const questionIa = [...trace.versions].reverse().map((v) => questionIaDuTexte(texteDitDe(normaliserScript(v.ecriture?.script)))).find(Boolean);
  return { metiersRecents: await metiersRecents({ traceId: trace.id, videoId: trace.videoId, avant: trace.date }), ...(questionIa ? { questionIa } : {}) };
}

/**
 * Reprend la MEILLEURE version d'une trace existante, SANS aucun appel (PUR) : chaque version est recontrôlée avec les
 * règles en vigueur ; la dernière valide est livrée si la grille de la relecture (corrigée par les contrôles en code)
 * donne au moins ${NOTE_MINIMALE} sans critère éliminatoire échoué ; sinon un refus qui garde la meilleure version.
 */
export function livrerDepuisTrace(trace: Pick<TraceScriptTableau, "demande" | "versions" | "grille" | "accroches" | "retenue" | "raison">, options: OptionsControles = {}):
  | { ok: true; resultat: ResultatScriptTableau; angle: AngleScript }
  | { ok: false; motifs: string[]; meilleure: VersionRetenue | null } {
  const retenue = versionRetenue(trace.versions, trace.demande, options);
  if (!retenue) return { ok: false, motifs: ["Cette écriture n'a laissé aucune version du script."], meilleure: null };
  if (!retenue.valide) return { ok: false, motifs: ["Aucune version écrite ne passe tous les contrôles :", ...messages(retenue.defauts)], meilleure: retenue };
  if (!trace.grille.length) return { ok: false, motifs: ["Cette écriture n'a pas été relue : la version gardée passe les contrôles en code, sans note."], meilleure: retenue };
  // La grille de la trace est celle de la version relue : elle ne note pas une autre version.
  const relue = [...trace.versions].reverse().find((v) => v.passe === "relecture");
  const jugee = relue ? grilleDeLaVersion(ordonnerGrille(trace.grille), ecritureLue(relue.ecriture), retenue) : null;
  if (!jugee) return { ok: false, motifs: [MOTIF_SANS_NOTE], meilleure: retenue };
  const grille = grilleCorrigee(jugee, retenue.defauts);
  const note = noteDeGrille(grille);
  const elimines = eliminatoiresEchoues(grille);
  const motifs = [
    ...(elimines.length ? [`Critère${elimines.length > 1 ? "s" : ""} éliminatoire${elimines.length > 1 ? "s" : ""} non respecté${elimines.length > 1 ? "s" : ""} : ${elimines.map(libelleCritere).join(" ; ")}.`] : []),
    ...(note < NOTE_MINIMALE ? [`Note ${note} sur 10 : il faut au moins ${NOTE_MINIMALE}.`] : []),
  ];
  if (motifs.length) return { ok: false, motifs, meilleure: retenue };
  const angle: AngleScript = { angle: "", douleur: "", accroches: trace.accroches, retenue: trace.retenue ?? 0, raison: trace.raison };
  const e = retenue.ecriture;
  return {
    ok: true,
    angle,
    resultat: {
      accroches: trace.accroches,
      retenue: angle.retenue,
      raison: trace.raison,
      angle: "",
      script: e.script,
      sources: e.sources,
      grille,
      note,
      variantes: e.variantes,
      aPreparer: aPreparer(e, trace.demande),
      motsDouleur: nettoyerMotsDouleur(e.motsDouleur),
      affirmations: e.affirmations ?? [],
      idee: e.idee,
      gain: e.gain,
      metierExemple: e.metierExemple,
      parties: partiesDuScript(e.script),
      dureeEstimeeSecondes: dureeEstimee(texteDitDe(e.script)),
    },
  };
}

/** Une trace de génération (lecture seule) ; `null` si elle n'existe pas. */
export async function lireTraceScriptTableau(id: string): Promise<TraceScriptTableau | null> {
  await exigerSession();
  return (await depots().tracesScriptsTableau.obtenir(id)) ?? null;
}
