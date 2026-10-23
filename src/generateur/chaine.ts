/**
 * LA CHAÎNE DE GÉNÉRATION, ÉTAPES 1 À 12 (plan v5 B.3.5 ; lot G4). PUR quant aux données : les appels passent par un
 * EXÉCUTEUR injecté (simulation, Claude facturé par la brique Crédits, ou banc), l'état est rendu après chaque étape
 * par `sauver` pour que la chaîne reparte de la dernière étape terminée sans rien repayer (B.3.4 n° 5).
 *
 *  1 stratège (angles) → 2 fond → 3 accroches → 4 filtre (code, puis juge) → 5 plan(s) → 6 contrôle du plan (code)
 *  → 7 prose → 8 contrôles du corps (code) → 9 juges + duel PREF-01 → 10 réécriture ciblée → 11 déclinaisons par
 *  réseau → 12 contrôles des versions assemblées, corrections automatiques (raccourcir seulement), rejugement de
 *  l'accroche adaptée et de la boucle, mise en forme du mode. L'étape 0 (choix conjoint) et l'étape 13 (rangement) sont
 *  faites par le service.
 * Aucune prose avant un plan validé par le code. Rien ici ne nomme un format, un bloc, une structure ni un réseau.
 */
import type { z } from "zod";
import {
  compterTournures,
  controlerFinalistes,
  controlerPlan,
  controlerVersion,
  dureeBlocs,
  noterVersion,
  rendreConsignesDiversite,
  utilisable,
  voyant,
  type ContexteWill,
  type EntreeControle,
  type TournureControle,
  type ViolationControle,
} from "@/domaine/controles-script";
import { nombresAffirmes } from "@/domaine/nombres-fr";
import type { AccrocheFinaliste, BlocScript, PlanScript, ReseauDeclinaison, ScriptMaitre, SegmentScript, TypeAccroche, TypeAppel, VarianteReseau } from "@/domaine/types";
import { parametresGenerateur, type ParametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { CHAMPS_PUBLICATION } from "@/donnees/generateur/publication-reseaux";
import { formatGenerateur } from "@/formats";
import { ecritureReseau } from "@/reseaux/ecriture";
import { choisirDansFamille, famillePour, type FamillesHashtags } from "@/reseaux/hashtags";
import { blocsEnCache, chiffresNonProuves, matieresEnvoyees, rendreChoix, rendreMatiere, rendreRecette, rendreReseau, rendreSujet, type DonneesGeneration } from "./contexte";
import { evaluer, type ContexteEvaluation, type Evaluation } from "./roles/evaluation";
import { EVALUATIONS_DES_ROLES, ROLES_ECRITURE } from "./roles";
import { gagnantDuel, variablePreference } from "./roles/preference";
import { ouiAttendus, questionsDeLEtape, type QuestionJuge } from "./roles/questions";
import { variableJuge, type SortieJuge } from "./roles/juge";
import type { SortieAccroches } from "./roles/accroches";
import type { SortieDeclinaison } from "./roles/declinaison";
import type { SortieFond } from "./roles/fond";
import type { SortiePlan } from "./roles/plan";
import type { SortieProse } from "./roles/prose";
import type { SortieReecriture } from "./roles/reecriture";
import type { SortieStratege } from "./roles/stratege";
import { pireCasPrudentAppel, totaliserPireCas, type LignePireCas, type PireCasChaine } from "./roles/estimation";
import type { DefinitionRole, EntreeRole, MarqueurArret } from "./roles/types";

/* ------------------------------------------------------------------ */
/* Contrat avec l'exécutant et état persistant                          */
/* ------------------------------------------------------------------ */

export type SortieExecution<T> =
  | { ok: true; simule?: boolean; donnees?: T; texte?: string; invalide?: string; marqueur?: MarqueurArret; coutUsd: number; modele: string; stopReason: string | null }
  | { ok: false; arret: "en-attente-credit" | "plafond-atteint" | "bloquee-modele" | "verrou-perdu" | "budget-usine"; message: string };

export interface ExecuteurRoles {
  executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>>;
}

export interface OptionsChaine {
  /**
   * v5 n° 69 : deux corps et le duel PREF-01. Garde-fous budget (15/10) : NON par défaut (le pire cas de la chaîne
   * passait du simple au double) ; l'option reste.
   */
  deuxCorps?: boolean;
  /** Tirages des juges (B.7.4 : 3 ; G0 a mesuré une variance NULLE sur Sonnet 5.5 : 1 tirage par défaut). */
  tiragesJuges?: number;
  /** « Je choisis » : pause après les angles et après les accroches. */
  modeChoix?: "rapide" | "je-choisis";
  /** Banc à budget borné seulement : sauter la réécriture ciblée (étape 10) ou le rejugement des versions (étape 12). */
  reecriture?: boolean;
  rejuge?: boolean;
  /** Tours de correction automatique des versions (étape 12, B.3.5 : 2 au plus). */
  toursCorrection?: number;
  /** Évaluations ratées → une reprise ciblée (jamais un appel identique). Garde-fous budget (15/10) : non par défaut. */
  reprises?: boolean;
  tournures?: TournureControle[];
  contexteWill?: ContexteWill;
  /** G6 : débit RECALÉ sur les vidéos mères fabriquées (`debit.<format>.avatar`, B.4.2) ; absent : celui de la recette. */
  debit?: number;
  /** Équipe 7 : « Vos hashtags » par réseau ; les mots-dièse des versions y sont ramenés par le code, après Claude. */
  hashtags?: FamillesHashtags;
}

export interface JournalEtape {
  etape: number;
  role: string;
  dureeMs: number;
  coutUsd: number;
  modele: string;
  resultat: "ok" | "reprise" | "invalide" | "arret" | "credit" | "coupe";
  echecs?: string[];
}

export interface CorpsEcrit {
  combinaison: number;
  structure: string;
  accrocheId: string;
  plan?: SortiePlan;
  planScript?: PlanScript;
  violationsPlan?: ViolationControle[];
  prose?: SortieProse;
  blocs?: BlocScript[];
  limiteProposee?: string;
  violations?: ViolationControle[];
  verdicts?: SortieJuge;
  ouiJuges?: { obtenus: number; total: number; echecs: string[] };
}

export interface VersionEcrite {
  reseau: ReseauDeclinaison;
  declinaison: SortieDeclinaison;
  appel: VarianteReseau["appel"];
  ouverture: BlocScript[];
  fin: BlocScript[];
  boucle: boolean;
  segmentFacultatifRetenu: boolean;
  dureeSec: number;
  violations: ViolationControle[];
  note: { globale: number; criteres: Record<string, number>; voyant: "vert" | "ambre" | "rouge" };
  verdicts?: SortieJuge["elements"][number];
  prompteur?: string;
  trame?: VarianteReseau["trame"];
  tours: number;
}

export interface EtatChaine {
  version: 1;
  /** Dernière étape terminée (0 : rien). */
  etape: number;
  coutUsd: number;
  journal: JournalEtape[];
  stratege?: SortieStratege;
  angleRetenu?: number;
  fond?: SortieFond;
  accroches?: (SortieAccroches["accroches"][number] & { id: string })[];
  exclues?: { id: string; raisons: string[] }[];
  finalistes?: AccrocheFinaliste[];
  /** « Je choisis » : choix de Will. */
  choixWill?: { angle?: number; accrocheIds?: string[] };
  corps?: CorpsEcrit[];
  gagnant?: number;
  preference?: { ordreAB: "A" | "B" | "egal"; ordreBA: "A" | "B" | "egal"; gagnant: "A" | "B" | "egal" };
  reecritures?: number;
  versions?: VersionEcrite[];
  /** `SORTIE_INVALIDE` (chaîne courte) : réponse de Claude inutilisable, un échec technique, pas une matière manquante. */
  arret?: { type: "ANCRAGE_MANQUANT" | "PREUVE_MANQUANTE" | "PLAN_REFUSE" | "PROBLEME_ABSENT" | "SORTIE_INVALIDE"; etape: number; message: string };
  pause?: { raison: "choisir-angle" | "choisir-accroches" };
  /** Garde-fous budget (15/10) : réponse coupée par Claude (`max_tokens`) ; le texte brut est gardé, rien n'est relancé. */
  reponseCoupee?: { etape: number; role: string; texte: string };
  /** Chaîne courte (relecture finale A09) : la relecture a échoué, la version gardée n'est PAS relue (pourquoi). */
  nonRelue?: string;
  /** Chaîne courte, mémoire commune : code de la fin imposée à l'étape 2 (réutilisé à l'enregistrement, même après pause/reprise). */
  codeFinImpose?: string;
}

export type ResultatChaine =
  | { statut: "terminee"; etat: EtatChaine }
  | { statut: "arretee"; etat: EtatChaine }
  | { statut: "pause"; etat: EtatChaine }
  | { statut: "coupee"; etat: EtatChaine; message: string }
  | { statut: "attente"; etat: EtatChaine; arret: "en-attente-credit" | "plafond-atteint" | "bloquee-modele" | "verrou-perdu" | "budget-usine"; message: string };

export function etatInitial(): EtatChaine {
  return { version: 1, etape: 0, coutUsd: 0, journal: [] };
}

/* ------------------------------------------------------------------ */
/* Outils                                                               */
/* ------------------------------------------------------------------ */

/** Arrêt de crédit, de plafond ou de modèle levé par `appeler` (exporté pour la chaîne courte du banc). */
export class Attente extends Error {
  constructor(
    public readonly arret: "en-attente-credit" | "plafond-atteint" | "bloquee-modele" | "verrou-perdu" | "budget-usine" | "reponse-coupee",
    message: string,
  ) {
    super(message);
  }
}

/** Phrase d'une réponse coupée par Claude (trop longue). */
export const MESSAGE_REPONSE_COUPEE = "La réponse de Claude a été coupée avant la fin (trop longue) : l'écriture s'arrête là, rien n'est relancé.";

/**
 * Garde-fous budget (15/10) : réponse coupée (`max_tokens`). La relancer à l'identique serait payer deux fois pour la
 * même coupure : la chaîne s'arrête, garde le texte brut, et attend Will.
 */
export class ReponseCoupee extends Attente {
  constructor(public readonly brut: { etape: number; role: string; texte: string }) {
    super("reponse-coupee", MESSAGE_REPONSE_COUPEE);
  }
}

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;
let compteurId = 0;
const nouvelIdLocal = (p: string) => `${p}-${Date.now().toString(36)}-${(compteurId++).toString(36)}`;

/** Contexte d'exécution d'une chaîne (exporté pour la chaîne courte du banc, `chaine-courte.ts`). */
export interface Contexte {
  d: DonneesGeneration;
  p: ParametresGenerateur;
  debit: number;
  blocsCorps: { id: string; consigne: string }[];
  cache: EntreeRole["contexte"];
  evalCtx: ContexteEvaluation;
  options: Required<Pick<OptionsChaine, "tiragesJuges" | "reprises" | "modeChoix">> & OptionsChaine;
  executeur: ExecuteurRoles;
  etat: EtatChaine;
  sauver: (e: EtatChaine) => Promise<void>;
}

/** Un appel de rôle, évalué ; une reprise ciblée avec les motifs si la sortie est invalide ou rate ses évaluations. */
export async function appeler<S extends z.ZodType>(
  c: Contexte,
  etape: number,
  role: DefinitionRole<S>,
  variable: string,
  evaluations: readonly Evaluation<z.infer<S>>[] = [],
  evalCtx: ContexteEvaluation = c.evalCtx,
): Promise<{ donnees?: z.infer<S>; echecs: string[]; marqueur?: MarqueurArret }> {
  let v = variable;
  for (let essai = 0; essai < (c.options.reprises ? 2 : 1); essai++) {
    const debut = Date.now();
    const r = await c.executeur.executer(role, { contexte: c.cache, variable: v });
    if (!r.ok) {
      c.etat.journal.push({ etape, role: role.id, dureeMs: Date.now() - debut, coutUsd: 0, modele: "-", resultat: "credit" });
      throw new Attente(r.arret, r.message);
    }
    c.etat.coutUsd += r.coutUsd;
    if (r.stopReason === "max_tokens") {
      c.etat.journal.push({ etape, role: role.id, dureeMs: Date.now() - debut, coutUsd: r.coutUsd, modele: r.modele, resultat: "coupe" });
      throw new ReponseCoupee({ etape, role: role.id, texte: r.texte ?? "" });
    }
    const echecs = r.donnees ? evaluer(evaluations, r.donnees, evalCtx) : [r.invalide ?? "sortie vide"];
    const critiques = r.donnees ? evaluer(evaluations.filter((x) => x.critique), r.donnees, evalCtx) : echecs;
    const arretDonne = (r.donnees as { arret?: { code: MarqueurArret } } | undefined)?.arret?.code;
    const marqueur = arretDonne ?? (r.donnees ? undefined : r.marqueur);
    c.etat.journal.push({ etape, role: role.id, dureeMs: Date.now() - debut, coutUsd: r.coutUsd, modele: r.modele, resultat: marqueur ? "arret" : critiques.length ? (essai ? "invalide" : "reprise") : "ok", echecs: echecs.length ? echecs : undefined });
    if (marqueur) return { donnees: r.donnees, echecs: [], marqueur };
    if (!critiques.length || !c.options.reprises || essai === 1 || r.stopReason === "refusal") return { donnees: r.donnees, echecs };
    // Reprise ciblée sur les évaluations CRITIQUES : jamais un appel identique (B.3.4 n° 6).
    v = `${variable}\n<corrections_demandees>\nTa réponse précédente ne respecte pas ces points, corrige-les sans rien inventer :\n${critiques.map((x) => `- ${x}`).join("\n")}\n</corrections_demandees>`;
  }
  return { echecs: ["aucune sortie"] };
}

function bloc(blocRecette: string, segments: SegmentScript[]): BlocScript {
  return { id: nouvelIdLocal(`b-${blocRecette}`), blocRecette, segments };
}

export function texteBlocs(blocs: BlocScript[]): string {
  return blocs.flatMap((b) => b.segments.map((s) => s.texte)).filter((t) => t.trim()).join(" ");
}

/** Le brief au format du sujet (pour les contrôles). */
function briefDe(d: DonneesGeneration): ScriptMaitre["brief"] {
  const s = d.sujet;
  return { idee: s.idee, phraseWill: s.phraseWill, objectif: s.objectif, niveauConscience: s.niveauConscience, reseaux: s.reseaux, formatId: s.formatId, formatsDemandes: [s.formatId], adresseParDefaut: s.adresse, modeParDefaut: s.mode, cible: s.cible, pilier: s.pilier?.id, modeChoix: "rapide", mentionIA: false, sujetSensible: s.sujetSensible };
}

/**
 * Point de vue réellement tenable : « je » exige une matière de Will citée (C50, K6) ; sans elle, le double parle au
 * spectateur (« vous »). Le choix de l'étape 0 reste dans la série ; la version porte ce qu'elle dit vraiment.
 */
function pointDeVueEffectif(c: Contexte): NonNullable<EntreeControle["maitre"]>["pointDeVue"] {
  const pdv = c.d.choix.pointDeVue;
  if (pdv !== "je") return pdv;
  const deWill = c.d.matieres.some((m) => ["anecdote-will", "avis-will", "limite"].includes(m.type) && c.d.choix.ancrages.some((a) => a.matiereId === m.id));
  return deWill || c.d.sujet.mode !== "avatar" ? "je" : "vous";
}

/** Le « maître » vu par les contrôles (angle, fond, exception, envoi). */
function maitreDe(c: Contexte): EntreeControle["maitre"] {
  const e = c.etat;
  const a = e.stratege?.angles[e.angleRetenu ?? 0];
  const f = e.fond;
  return {
    brief: briefDe(c.d),
    ancrages: c.d.choix.ancrages,
    pointDeVue: pointDeVueEffectif(c),
    emotion: c.d.choix.emotion,
    appuiPrincipal: f?.appuiPrincipal,
    exception:
      f && f.exception.source !== "aucune"
        ? { texte: f.exception.texte, source: f.exception.source, matiereId: f.exception.matiereId, preuveId: f.exception.preuveId, valideeParWill: f.exception.source !== "proposition-machine", place: f.exception.place }
        : undefined,
    envoi: f ? { destinataire: f.envoi.destinataireRole, phrase: f.envoi.phrase, preuveIds: [], destinataireRole: f.envoi.destinataireRole } : undefined,
    angle: a
      ? { titre: a.titre, promesse: a.promesse, structure: a.structure, sourceAngle: a.sourceAngle, risqueBanal: a.risqueBanal === "faible" ? 0.2 : a.risqueBanal === "moyen" ? 0.5 : 0.8, contrePied: a.contrePied, quiParleConseille: a.quiParleConseille, typeAngle: a.typeAngle, termePivot: a.termePivot, probleme: a.probleme, cout: a.cout, issue: a.issue, intensite: a.intensite }
      : undefined,
  };
}

export function entreeControle(c: Contexte, o: { ouverture: BlocScript[]; corps: BlocScript[]; fin: BlocScript[]; reseau?: ReseauDeclinaison; version?: VersionEcrite; autres?: EntreeControle["autresVersions"] }): EntreeControle {
  const structure = c.p.recette.structures.find((s) => s.id === (c.etat.stratege?.angles[c.etat.angleRetenu ?? 0]?.structure ?? c.d.choix.structure));
  const v = o.version;
  return {
    auteur: "machine",
    mode: c.d.sujet.mode,
    adresse: c.d.sujet.adresse,
    debit: c.debit,
    ouverture: o.ouverture,
    corps: o.corps,
    fin: o.fin,
    recette: c.p.recette,
    reseau: o.reseau ? c.p.reseau(o.reseau) : undefined,
    structure,
    objectif: c.d.sujet.objectif,
    appel: v?.appel,
    boucle: v?.boucle,
    motCle: c.etat.fond?.motCle,
    motCleSource: "hypothese",
    encadre: v ? { texte: v.declinaison.encadre } : undefined,
    couverture: v ? { texte: v.declinaison.couverture } : undefined,
    publication: v ? publicationDe(v.declinaison, c.d.sujet.objectif) : undefined,
    familleAccroche: c.etat.finalistes?.find((f) => f.id === v?.declinaison.accrocheId)?.famille,
    maitre: maitreDe(c),
    preuves: c.d.preuves,
    matieres: c.d.matieres,
    contexte: c.options.contexteWill,
    tournures: c.options.tournures,
    maintenant: c.d.maintenant,
    finalistes: c.etat.finalistes,
    accrocheId: v?.declinaison.accrocheId,
    autresVersions: o.autres,
  };
}

function publicationDe(s: SortieDeclinaison, objectif: string): VarianteReseau["publication"] {
  const p = s.publication;
  return {
    texte: p.texte,
    motsDiese: p.motsDiese,
    premiereLigne: p.premiereLigne,
    sources: [],
    commentaireEpingle: p.commentaireEpingle,
    titres: p.titres && p.titres.length >= 2 ? [p.titres[0], p.titres[1]] : undefined,
    motsClesDeclares: p.motsClesDeclares,
    motsClesBloques: p.motsClesBloques,
    post: p.post ? { texte: p.post.texte, detailAncrage: p.post.detailAncrage, forme: "texte" } : undefined,
    rappels: {},
    etiquetteIAPlateforme: false,
    justifications: p.justifications,
    typePublication: p.post ? "video-native" : undefined,
    motCleVariante: p.motCleVariante,
    lienSuivi: objectif === "rendez-vous" ? undefined : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Étapes                                                               */
/* ------------------------------------------------------------------ */

export function variableBase(c: Contexte): string {
  return [rendreSujet(c.d), rendreChoix(c.d), ...matieresEnvoyees(c.d).map((m) => rendreMatiere(m, c.d)), `<recette>\n${rendreRecette(c.p, c.d, c.debit)}\n</recette>`, c.d.intensitesRecentes?.length ? `<intensites_recentes>${c.d.intensitesRecentes.join(", ")}</intensites_recentes>` : "", c.d.expressionsRecentes?.length ? `<expressions_recentes>${c.d.expressionsRecentes.join(" · ")}</expressions_recentes>` : "", c.d.diversite ? rendreConsignesDiversite(c.d.diversite) : ""]
    .filter(Boolean)
    .join("\n");
}

export function angleTexte(c: Contexte): string {
  const a = c.etat.stratege?.angles[c.etat.angleRetenu ?? 0];
  return a ? `<angle_retenu>\n${JSON.stringify(a, null, 1)}\n</angle_retenu>` : "";
}

export function fondTexte(c: Contexte): string {
  return c.etat.fond ? `<fond>\n${JSON.stringify({ ...c.etat.fond, arret: undefined }, null, 1)}\n</fond>\n<point_de_vue_a_tenir>${pointDeVueEffectif(c)}</point_de_vue_a_tenir>` : "";
}

/** Étape 1 : angles ; l'angle retenu doit porter un problème concret et son coût (§2 bis). */
async function etape1(c: Contexte): Promise<boolean> {
  const r = await appeler(c, 1, ROLES_ECRITURE.stratege, variableBase(c), EVALUATIONS_DES_ROLES.stratege);
  if (r.marqueur || !r.donnees || r.donnees.arret) {
    c.etat.arret = { type: r.marqueur ?? "ANCRAGE_MANQUANT", etape: 1, message: r.donnees?.arret?.raison ?? "Aucune matière ne porte vraiment ce sujet." };
    return false;
  }
  const s = r.donnees;
  const valide = (i: number) => {
    const a = s.angles[i];
    if (!a) return false;
    const plaquee = a.pertinences.some((p) => p.pertinence === "plaquee" && a.matiereIds.includes(p.matiereId));
    return !plaquee && evaluer(EVALUATIONS_DES_ROLES.stratege.filter((e) => e.id === "STR-05"), { ...s, angles: [a] }, c.evalCtx).length === 0 && c.evalCtx.structures.includes(a.structure);
  };
  const retenu = c.etat.choixWill?.angle ?? (valide(s.retenu) ? s.retenu : s.angles.findIndex((_, i) => valide(i)));
  c.etat.stratege = s;
  if (retenu < 0) {
    c.etat.arret = { type: "PROBLEME_ABSENT", etape: 1, message: "Aucun angle ne part d'un problème concret du spectateur et de ce qu'il lui coûte." };
    return false;
  }
  c.etat.angleRetenu = retenu;
  return true;
}

async function etape2(c: Contexte): Promise<boolean> {
  const r = await appeler(c, 2, ROLES_ECRITURE.fond, [variableBase(c), angleTexte(c)].join("\n"), EVALUATIONS_DES_ROLES.fond);
  if (r.marqueur || !r.donnees || r.donnees.arret) {
    c.etat.arret = { type: r.marqueur ?? "PREUVE_MANQUANTE", etape: 2, message: r.donnees?.arret?.raison ?? "Une affirmation n'a pas de preuve." };
    return false;
  }
  // Une limite « matière » doit être une matière fournie : sinon elle n'est qu'une proposition (K19, C30 bis).
  const f = r.donnees;
  if (f.exception.source === "matiere" && !c.evalCtx.matiereIds.has(f.exception.matiereId ?? "")) f.exception = { ...f.exception, source: "proposition-machine", matiereId: undefined };
  c.etat.fond = f;
  return true;
}

export function famillesRealisables(c: Contexte): { id: string; nom: string; modele: string; exige?: string }[] {
  const types = new Set(matieresEnvoyees(c.d).map((m) => m.type));
  const preuves = c.d.preuves.filter((p) => utilisable(p, c.d.maintenant));
  return c.p.accroches
    .filter((a) => c.p.recette.famillesAccrochePermises.includes(a.id))
    .filter((a) => {
      const ex = a.exige;
      if (!ex) return true;
      if (ex.matiere && !ex.matiere.some((t) => types.has(t))) return false;
      if (ex.preuveChiffree && !preuves.some((p) => p.nature === "chiffree")) return false;
      if (ex.accordAvantApres && !preuves.some((p) => p.client?.accordAvantApres)) return false;
      if (ex.scene && !matieresEnvoyees(c.d).some((m) => !!m.scene)) return false;
      return true;
    })
    .map((a) => ({ id: a.id, nom: a.nom, modele: a.modele, exige: a.exige ? JSON.stringify(a.exige) : undefined }));
}

/** Les familles d'accroche réalisables, en données (avec le poids de l'étape 0). */
export function famillesTexte(c: Contexte): string {
  const poids = c.d.choix.poidsFamilles as Record<string, number | undefined>;
  return `<familles>\n${famillesRealisables(c).map((f) => `<famille id="${f.id}" poids="${poids[f.id] ?? 1}">${f.nom} · modèle : ${f.modele}</famille>`).join("\n")}\n</familles>`;
}

async function etape3(c: Contexte): Promise<boolean> {
  const familles = famillesRealisables(c);
  const variable = [variableBase(c), angleTexte(c), fondTexte(c), famillesTexte(c)].join("\n");
  const ctx = { ...c.evalCtx, famillesPermises: familles.map((f) => f.id) };
  const r = await appeler(c, 3, ROLES_ECRITURE.accroches, variable, EVALUATIONS_DES_ROLES.accroches, ctx);
  if (r.marqueur || !r.donnees || r.donnees.arret || !r.donnees.accroches.length) {
    c.etat.arret = { type: r.marqueur ?? "ANCRAGE_MANQUANT", etape: 3, message: r.donnees?.arret?.raison ?? "Aucune accroche possible sans inventer." };
    return false;
  }
  c.etat.accroches = r.donnees.accroches.map((a, i) => ({ ...a, id: `acc-${i + 1}` }));
  return true;
}

/** Étape 4 : élimination par le code (rejets comptés, C69), puis par le juge ; 3 finalistes, familles variées. */
async function etape4(c: Contexte): Promise<boolean> {
  const lot = c.etat.accroches ?? [];
  const familles = famillesRealisables(c).map((f) => f.id);
  const disponibles = {
    types: matieresEnvoyees(c.d).map((m) => m.type),
    preuveChiffree: c.d.preuves.some((p) => p.nature === "chiffree" && p.statut === "validee"),
    accordAvantApres: c.d.preuves.some((p) => !!p.client?.accordAvantApres),
    scene: matieresEnvoyees(c.d).some((m) => !!m.scene),
  };
  const { exclues } = controlerFinalistes(
    lot.map((a) => ({ id: a.id, famille: a.famille, dit: a.dit, preuveIds: a.preuveIds, porteAngle: a.porteAngle })),
    { preuves: c.d.preuves, recette: c.p.recette, disponibles },
  );
  const raisons = new Map(exclues.map((x) => [x.id, [...x.raisons]]));
  for (const a of lot) {
    const r = raisons.get(a.id) ?? [];
    if (!familles.includes(a.famille)) r.push("C41 : famille non réalisable");
    if (mots(a.dit) > c.p.recette.accrocheMaxMots) r.push(`C8 : ${mots(a.dit)} mots`);
    if (/^\s*(stop|arr[êe]tez)\s*[.!]/i.test(a.dit)) r.push("C3 bis : « Stop » ou « Arrêtez. » seul");
    if (chiffresNonProuves(a.dit, c.d.preuves).length) r.push("C1 : nombre sans preuve");
    const t = compterTournures([{ texte: a.dit, accroche: true }], c.options.tournures ?? []);
    if (t.bloquantes.length) r.push(`C5 : « ${t.bloquantes[0].extrait} »`);
    if (r.length) raisons.set(a.id, r);
  }
  c.etat.exclues = [...raisons.entries()].map(([id, rs]) => ({ id, raisons: rs }));
  const restantes = lot.filter((a) => !raisons.has(a.id));
  if (!restantes.length) {
    c.etat.arret = { type: "ANCRAGE_MANQUANT", etape: 4, message: "Toutes les accroches ont été éliminées par les contrôles." };
    return false;
  }
  const questions = questionsDeLEtape(4);
  // « Je choisis » : Will a ordonné ses accroches, le juge n'est pas rappelé (rien n'est repayé).
  const verdicts = c.etat.choixWill?.accrocheIds?.length ? [] : await juger(c, 4, restantes.map((a) => ({ id: a.id, texte: `${a.dit}\n(encadré : ${a.ecrit} ; famille : ${a.famille})` })), questions, angleTexte(c));
  const score = (id: string) => ouiAttendus(verdicts.find((e) => e.id === id)?.reponses ?? []).obtenus;
  const tries = [...restantes].sort((a, b) => score(b.id) - score(a.id));
  const choisies: typeof restantes = [];
  if (c.etat.choixWill?.accrocheIds?.length) {
    for (const id of c.etat.choixWill.accrocheIds) {
      const a = lot.find((x) => x.id === id);
      if (a) choisies.push(a);
    }
  } else {
    const porte = tries.find((a) => a.porteAngle || verdicts.find((e) => e.id === a.id)?.reponses.some((r) => r.id === "ACC-05" && r.reponse === "oui"));
    if (porte) choisies.push(porte);
    for (const a of tries) {
      if (choisies.length >= 3) break;
      if (choisies.includes(a)) continue;
      if (choisies.some((x) => x.famille === a.famille) && tries.some((y) => !choisies.includes(y) && y !== a && !choisies.some((x) => x.famille === y.famille))) continue;
      choisies.push(a);
    }
    for (const a of tries) if (choisies.length < 3 && !choisies.includes(a)) choisies.push(a);
  }
  c.etat.finalistes = choisies.slice(0, 3).map((a) => finalisteDe(c, a, verdicts.find((e) => e.id === a.id)?.reponses, score(a.id)));
  return true;
}

/** Une accroche écrite devenue finaliste (verdicts du juge et note s'il y en a). Exporté pour la chaîne courte. */
export function finalisteDe(c: Contexte, a: NonNullable<EtatChaine["accroches"]>[number], reponses?: SortieJuge["elements"][number]["reponses"], score = 0): AccrocheFinaliste {
  return {
    id: a.id,
    famille: a.famille as TypeAccroche,
    objectif: a.objectif,
    dit: a.dit,
    ecrit: a.ecrit,
    vu: a.vu,
    boucleOuverte: a.boucleOuverte,
    preuveIds: a.preuveIds,
    matiereIds: a.matiereIds,
    anomalie: a.anomalie,
    eliminations: reponses?.map((r) => ({ questionId: r.id, reponse: r.reponse === "oui" })),
    noteCode: score,
    dureeDiteSec: +(mots(a.dit) / c.debit).toFixed(1),
    typeAngle: c.etat.stratege?.angles[c.etat.angleRetenu ?? 0]?.typeAngle,
    porteAngle: a.porteAngle,
    ouiJuge: score,
    source: "opus",
  };
}

/** Juges : une sortie structurée par tirage ; majorité par question. */
async function juger(c: Contexte, etape: number, elements: { id: string; texte: string }[], questions: readonly QuestionJuge[], contexte = ""): Promise<SortieJuge["elements"]> {
  const tirages = await Promise.all(Array.from({ length: Math.max(1, c.options.tiragesJuges) }, () => appeler(c, etape, ROLES_ECRITURE.juge, variableJuge(elements, questions, contexte), EVALUATIONS_DES_ROLES.juge)));
  return elements.map((e) => ({
    id: e.id,
    reponses: questions.map((q) => {
      const votes = tirages.map((t) => t.donnees?.elements.find((x) => x.id === e.id)?.reponses.find((r) => r.id === q.id)).filter((x): x is NonNullable<typeof x> => !!x);
      const compte = (v: string) => votes.filter((x) => x.reponse === v).length;
      const reponse = (["oui", "non", "sans-objet"] as const).reduce((a, b) => (compte(b) > compte(a) ? b : a), "sans-objet" as "oui" | "non" | "sans-objet");
      return { id: q.id, reponse: votes.length ? reponse : ("sans-objet" as const), motif: votes.find((x) => x.reponse === reponse)?.motif ?? "" };
    }),
  }));
}

function planScriptDe(c: Contexte, plan: SortiePlan, structure: string): PlanScript {
  return {
    structure,
    mode: c.d.sujet.mode,
    debit: c.debit,
    segments: plan.segments.map((s) => ({
      fonction: s.fonction,
      nature: s.nature,
      intervenant: "principal",
      preuveIds: s.preuveIds,
      matiereIds: s.matiereIds,
      secondes: +(Math.max(4, mots(s.resume)) / c.debit).toFixed(2),
      resume: s.resume,
      sourceTexte: s.citeMatiereId ? { matiereId: s.citeMatiereId } : undefined,
      ouvre: s.ouvre,
      ferme: s.ferme,
      lien: s.lien,
      promesseId: s.promesseId,
      situation: s.situation,
    })),
    exceptionIndex: plan.exceptionIndex,
    ancrageIndex: plan.ancrageIndex,
    appuiPrincipalIndex: plan.appuiPrincipalIndex,
    livraisonIndex: plan.livraisonIndex,
  };
}

/**
 * Réparations SANS APPEL d'un plan (étape 6, avant le retour au modèle) : identifiants de questions incohérents et index
 * déclarés absents. Rien n'est inventé : on ne fait que recoller ce que le plan contient déjà.
 *  - une question fermée qui n'a jamais été ouverte perd son `ferme` ;
 *  - la question principale (la 1re ouverte) jamais fermée est fermée par la livraison qui la suit ;
 *  - une autre question jamais fermée perd son `ouvre` ;
 *  - `livraisonIndex` et `appuiPrincipalIndex` retrouvés depuis les fonctions des segments (jamais `exceptionIndex` : une
 *    limite proposée par la machine reste hors du texte dit, C30 bis) ;
 *  - une promesse portée ailleurs que par la livraison est rattachée à l'unique livraison.
 */
export function reparerPlan(plan: SortiePlan | undefined): SortiePlan | undefined {
  if (!plan) return plan;
  const segs = plan.segments.map((s) => ({ ...s }));
  const ouverts = new Set(segs.flatMap((s) => (s.ouvre ? [s.ouvre.id] : [])));
  for (const s of segs) if (s.ferme && !ouverts.has(s.ferme)) delete s.ferme;
  const livraison = segs.findIndex((s) => s.fonction.includes("livraison"));
  segs.forEach((s, i) => {
    if (!s.ouvre) return;
    const id = s.ouvre.id;
    if (segs.some((x, j) => j > i && x.ferme === id)) return;
    const principale = segs.findIndex((x) => !!x.ouvre) === i;
    if (principale && livraison > i && !segs[livraison].ferme) segs[livraison].ferme = id;
    else delete s.ouvre;
  });
  const promesses = [...new Set(segs.filter((s, i) => s.promesseId && i !== livraison).map((s) => s.promesseId!))];
  if (livraison >= 0 && promesses.length === 1 && !segs[livraison].promesseId) segs[livraison].promesseId = promesses[0];
  const indexDe = (f: SortiePlan["segments"][number]["fonction"][number]) => segs.findIndex((s) => s.fonction.includes(f));
  return {
    ...plan,
    segments: segs,
    livraisonIndex: plan.livraisonIndex >= 0 && segs[plan.livraisonIndex]?.fonction.includes("livraison") ? plan.livraisonIndex : livraison,
    exceptionIndex: plan.exceptionIndex,
    appuiPrincipalIndex: plan.appuiPrincipalIndex >= 0 ? plan.appuiPrincipalIndex : Math.max(0, indexDe("preuve")),
  };
}

/** Étapes 5 et 6 : un plan par corps, contrôlé par le code ; un retour avec les motifs ; aucune prose sans feu vert. */
async function etapes5et6(c: Contexte): Promise<boolean> {
  const angle = c.etat.stratege!.angles[c.etat.angleRetenu ?? 0];
  const fins = c.etat.finalistes ?? [];
  const autreCombinaison = c.d.combinaisons.findIndex((x, i) => i !== angle.combinaison - 1 && x.structure !== angle.structure);
  const veutDeux = (c.options.deuxCorps ?? false) && fins.length > 1;
  const corps: CorpsEcrit[] = [{ combinaison: angle.combinaison, structure: angle.structure, accrocheId: fins[0]?.id ?? "" }];
  if (veutDeux) corps.push(autreCombinaison >= 0 ? { combinaison: autreCombinaison + 1, structure: c.d.combinaisons[autreCombinaison].structure, accrocheId: fins[1].id } : { combinaison: angle.combinaison, structure: angle.structure, accrocheId: fins[1].id });
  const exceptionProposee = c.etat.fond?.exception.source === "proposition-machine";
  const prets: CorpsEcrit[] = [];
  for (const k of corps) {
    const accroche = fins.find((f) => f.id === k.accrocheId);
    const base = [variableBase(c), angleTexte(c), fondTexte(c), `<structure_retenue>${k.structure}</structure_retenue>`, `<accroche_finaliste id="${accroche?.id}">${accroche?.dit ?? ""}</accroche_finaliste>`].join("\n");
    let r = await appeler(c, 5, ROLES_ECRITURE.plan, base, EVALUATIONS_DES_ROLES.plan);
    if (r.marqueur || !r.donnees || r.donnees.arret) {
      if (k === corps[0]) {
        c.etat.arret = { type: r.marqueur ?? "ANCRAGE_MANQUANT", etape: 5, message: r.donnees?.arret?.raison ?? "Le plan ne tient pas sans inventer." };
        return false;
      }
      continue;
    }
    r = { ...r, donnees: reparerPlan(r.donnees) };
    let ps = planScriptDe(c, r.donnees!, k.structure);
    let v = controlerPlan(ps, { exceptionProposee, exceptionValidee: !exceptionProposee });
    if (v.some((x) => x.bloquant)) {
      // Retour à 5 avec les motifs ET le plan refusé : le modèle le corrige au lieu d'en refaire un autre.
      const refuse = JSON.stringify(r.donnees, null, 1);
      r = await appeler(c, 5, ROLES_ECRITURE.plan, `${base}\n<plan_refuse>\n${refuse}\n</plan_refuse>\n<corrections_demandees>\nLe code refuse ce plan. Renvoie le MÊME plan complet, corrigé seulement sur ces points :\n${v.map((x) => `- ${x.controle} : ${x.message}`).join("\n")}\n</corrections_demandees>`, EVALUATIONS_DES_ROLES.plan);
      if (r.donnees && !r.donnees.arret) {
        r = { ...r, donnees: reparerPlan(r.donnees) };
        ps = planScriptDe(c, r.donnees!, k.structure);
        v = controlerPlan(ps, { exceptionProposee, exceptionValidee: !exceptionProposee });
      }
    }
    if (!r.donnees || v.some((x) => x.bloquant)) {
      if (k === corps[0]) {
        c.etat.arret = { type: "PLAN_REFUSE", etape: 6, message: `Plan refusé par le code : ${v.map((x) => `${x.controle} (${x.message})`).join(" ; ")}` };
        c.etat.corps = [{ ...k, plan: r.donnees, planScript: ps, violationsPlan: v }];
        return false;
      }
      continue;
    }
    prets.push({ ...k, plan: r.donnees, planScript: ps, violationsPlan: v });
  }
  c.etat.corps = prets;
  return prets.length > 0;
}

export function blocsDeProse(c: Contexte, prose: SortieProse): BlocScript[] {
  const reseauLong = c.d.sujet.reseaux.find((r) => ecritureReseau(r).segmentFacultatif.valeur);
  const permis = new Set(c.blocsCorps.map((b) => b.id));
  const parBloc = new Map<string, SegmentScript[]>();
  for (const s of prose.segments) {
    if (!s.texte.trim()) continue;
    const id = permis.has(s.bloc) ? s.bloc : c.blocsCorps[c.blocsCorps.length - 1]?.id ?? s.bloc;
    const seg: SegmentScript = {
      id: nouvelIdLocal("s"),
      texte: s.texte.trim(),
      nature: s.nature,
      marqueurs: s.marqueurs,
      preuveIds: s.preuveIds,
      matiereIds: s.matiereIds,
      sourceTexte: s.citeMatiereId ? { matiereId: s.citeMatiereId } : undefined,
      emphase: s.emphase.length ? s.emphase : undefined,
      intentionIllustration: c.p.recette.annotationsAcceptees.includes("intentionIllustration") ? s.intentionIllustration : undefined,
      incrustation: s.incrustation && c.p.recette.annotationsAcceptees.includes("incrustation") ? { type: s.incrustation.type, texte: s.incrustation.texte, sens: s.incrustation.sens } : undefined,
      facultatif: s.facultatif && reseauLong && c.p.recette.annotationsAcceptees.length >= 0 ? reseauLong : undefined,
    };
    parBloc.set(id, [...(parBloc.get(id) ?? []), seg]);
  }
  return c.blocsCorps.filter((b) => parBloc.has(b.id)).map((b) => bloc(b.id, parBloc.get(b.id)!));
}

function ouvertureDe(c: Contexte, texte: string, plan?: SortiePlan, promesse?: string, accrocheId?: string): BlocScript[] {
  const roles = c.p.recette.roles;
  const marqueurs = plan?.segments[0]?.fonction.filter((f) => f !== "cta") ?? [];
  // L'accroche garde les preuves et matières de sa finaliste (C1 bis : un absolu d'une matière citée n'est pas un ajout).
  const f = c.etat.finalistes?.find((x) => x.id === accrocheId) ?? c.etat.finalistes?.find((x) => x.dit === texte);
  const ouverture = [bloc(roles.accroche, [{ id: nouvelIdLocal("s"), texte, nature: "fait", marqueurs: [...new Set([...marqueurs, "mot-cle" as const])], preuveIds: f?.preuveIds, matiereIds: f?.matiereIds }])];
  if (promesse?.trim() && roles.promesse) ouverture.push(bloc(roles.promesse, [{ id: nouvelIdLocal("s"), texte: promesse.trim(), nature: "fait", marqueurs: [] }]));
  return ouverture;
}

/** Étapes 7 et 8 : la prose de chaque corps, contrôlée ; trop long → un retour pour raccourcir (jamais allonger). */
async function etapes7et8(c: Contexte): Promise<boolean> {
  const blocs = `<blocs_corps>\n${c.blocsCorps.map((b) => `<bloc id="${b.id}">${b.consigne}</bloc>`).join("\n")}\n</blocs_corps>`;
  const ctxBase = { ...c.evalCtx, blocsCorps: c.blocsCorps.map((b) => b.id) };
  for (const k of c.etat.corps ?? []) {
    const accroche = c.etat.finalistes?.find((f) => f.id === k.accrocheId);
    const base = [variableBase(c), angleTexte(c), fondTexte(c), blocs, `<accroche_finaliste id="${accroche?.id}">${accroche?.dit ?? ""}</accroche_finaliste>`, `<plan_valide>\n${JSON.stringify(k.plan, null, 1)}\n</plan_valide>`].join("\n");
    const ctx = { ...ctxBase, planCorps: (k.plan?.segments ?? []).flatMap((x, i) => (x.partie === "corps" ? [i] : [])) };
    let r = await appeler(c, 7, ROLES_ECRITURE.prose, base, EVALUATIONS_DES_ROLES.prose, ctx);
    if (!r.donnees || r.marqueur || r.donnees.arret) {
      if (k === c.etat.corps![0]) {
        c.etat.arret = { type: r.marqueur ?? "PREUVE_MANQUANTE", etape: 7, message: r.donnees?.arret?.raison ?? "La prose ne tient pas sans inventer." };
        return false;
      }
      continue;
    }
    let blocsCorps = blocsDeProse(c, r.donnees);
    const duree = dureeBlocs(blocsCorps, c.debit);
    if (duree > c.p.recette.corpsMaxSec) {
      const retour = await appeler(c, 8, ROLES_ECRITURE.prose, `${base}\n<corrections_demandees>\nLe corps dure ${duree.toFixed(1)} s pour un plafond de ${c.p.recette.corpsMaxSec} s : raccourcis d'au moins ${Math.ceil(duree - c.p.recette.corpsMaxSec)} s. Coupe d'abord la promesse portée ailleurs, puis les répétitions de preuve, puis les détails de solution ; ne coupe jamais l'appui principal, la livraison, l'exception ni l'ancrage. N'allonge rien.\n</corrections_demandees>`, EVALUATIONS_DES_ROLES.prose, ctx);
      if (retour.donnees && !retour.donnees.arret) {
        r = retour;
        blocsCorps = blocsDeProse(c, retour.donnees);
      }
    }
    const prose = r.donnees!;
    k.prose = prose;
    k.blocs = blocsCorps;
    k.limiteProposee = prose.limiteProposee ?? (c.etat.fond?.exception.source === "proposition-machine" ? c.etat.fond.exception.texte : undefined);
    const ouverture = ouvertureDe(c, accroche?.dit ?? "", k.plan, undefined, accroche?.id);
    k.violations = controlerVersion(entreeControle(c, { ouverture, corps: blocsCorps, fin: [] }), {}).violations.filter((x) => !["C21", "C34", "C36", "C10", "C13", "C14", "C70", "C72"].includes(x.controle));
  }
  c.etat.corps = (c.etat.corps ?? []).filter((k) => k.blocs?.length);
  return !!c.etat.corps.length;
}

/** Étape 9 : juges (indicatifs) sur chaque corps, puis PREF-01 lu dans les deux ordres ; seul le gagnant continue. */
async function etape9(c: Contexte): Promise<void> {
  const corps = c.etat.corps ?? [];
  const textes = corps.map((k) => `${c.etat.finalistes?.find((f) => f.id === k.accrocheId)?.dit ?? ""} ${texteBlocs(k.blocs ?? [])}`.trim());
  const questions = [
    ...questionsDeLEtape(9),
    ...(c.etat.fond?.criteresPropres ?? []).map((x, i): QuestionJuge => ({ id: `BRF-${String(i + 1).padStart(2, "0")}`, version: 1, texte: `Le texte respecte-t-il ce critère : « ${x.texte} » ?`, attendu: "oui", etapes: [9] })),
  ];
  const verdicts = await juger(c, 9, corps.map((k, i) => ({ id: `corps-${i + 1}`, texte: textes[i] })), questions, [angleTexte(c), fondTexte(c)].join("\n"));
  corps.forEach((k, i) => {
    k.verdicts = { elements: [verdicts[i]] };
    k.ouiJuges = ouiAttendus(verdicts[i]?.reponses ?? []);
  });
  if (corps.length < 2) {
    c.etat.gagnant = 0;
    return;
  }
  const [ab, ba] = await Promise.all([
    appeler(c, 9, ROLES_ECRITURE.preference, variablePreference(textes[0], textes[1]), EVALUATIONS_DES_ROLES.preference),
    appeler(c, 9, ROLES_ECRITURE.preference, variablePreference(textes[1], textes[0]), EVALUATIONS_DES_ROLES.preference),
  ]);
  const g = gagnantDuel(ab.donnees?.preference ?? "egal", ba.donnees?.preference ?? "egal");
  c.etat.preference = { ordreAB: ab.donnees?.preference ?? "egal", ordreBA: ba.donnees?.preference ?? "egal", gagnant: g };
  // Égalité : la note par code puis les « oui attendus » départagent.
  const departage = () => {
    const n = (k: CorpsEcrit) => noterVersion(k.violations ?? []).globale * 100 + (k.ouiJuges?.obtenus ?? 0);
    return n(corps[1]) > n(corps[0]) ? 1 : 0;
  };
  c.etat.gagnant = g === "A" ? 0 : g === "B" ? 1 : departage();
}

const CONTROLES_REECRITURE = new Set(["C1", "C1 bis", "C2", "C3", "C4", "C5", "C5 bis", "C5 ter", "C9", "C16", "C24", "C28", "C30 bis", "C32", "C33", "C39", "C42", "C55", "C62", "C64", "C68", "C77", "C78", "C79", "C81", "C82", "C83"]);

/** Alertes qui valent une réécriture (§2 bis à §2 quinquies) ; les autres restent des informations (aucun appel payé). */
const ALERTES_REECRITES = new Set(["C78", "C81", "C82"]);

/**
 * Corrections ciblées appliquées aux segments du corps (index à plat, 5 au plus). Jamais supprimer ce qui porte la
 * vidéo (appui, livraison, exception, ancrage) : on garde alors l'original. Exporté pour la chaîne courte du banc.
 */
export function appliquerCorrections(blocs: BlocScript[], corrections: SortieReecriture["corrections"]): BlocScript[] {
  const parIndex = new Map<number, SortieReecriture["corrections"][number]>(corrections.slice(0, 5).map((x) => [x.segmentIndex, x]));
  let i = 0;
  return blocs
    .map((b) => ({
      ...b,
      segments: b.segments
        .map((s): SegmentScript => {
          const corr = parIndex.get(i++);
          if (!corr) return s;
          const protege = (s.marqueurs ?? []).some((m) => m === "livraison" || m === "exception" || m === "ancrage" || m === "preuve");
          if (!corr.texte.trim() && protege) return s;
          return { ...s, texte: corr.texte.trim(), marqueurs: corr.marqueurs ?? s.marqueurs };
        })
        .filter((s) => s.texte.trim()),
    }))
    .filter((b) => b.segments.length);
}

/** Étape 10 : réécriture ciblée des segments en cause (violations du code), 5 corrections au plus, 2 tours au plus. */
async function etape10(c: Contexte): Promise<void> {
  if (c.options.reecriture === false) return;
  const k = c.etat.corps?.[c.etat.gagnant ?? 0];
  if (!k?.blocs) return;
  const accroche = c.etat.finalistes?.find((f) => f.id === k.accrocheId)?.dit ?? "";
  const ouverture = ouvertureDe(c, accroche, k.plan, undefined, k.accrocheId);
  const decalage = ouverture.flatMap((b) => b.segments).length;
  c.etat.reecritures = 0;
  for (let tour = 0; tour < 2; tour++) {
    const enCause = (k.violations ?? []).filter((v) => CONTROLES_REECRITURE.has(v.controle) && (v.bloquant || ALERTES_REECRITES.has(v.controle)));
    if (!enCause.length) return;
    const segs: SegmentScript[] = k.blocs.flatMap((b) => b.segments);
    const defauts = enCause.slice(0, 5).map((v) => {
      const i = v.segmentIndex !== undefined && v.segmentIndex >= decalage ? v.segmentIndex - decalage : -1;
      return `<defaut segment="${i}" controle="${v.controle}">${v.message}</defaut>`;
    });
    const texte: string = segs.map((s, i) => `<segment index="${i}" marqueurs="${(s.marqueurs ?? []).join(",")}">${s.texte}</segment>`).join("\n");
    const r: { donnees?: SortieReecriture } = await appeler(c, 10, ROLES_ECRITURE.reecriture, [fondTexte(c), `<accroche>${accroche}</accroche>`, `<corps>\n${texte}\n</corps>`, ...defauts].join("\n"), EVALUATIONS_DES_ROLES.reecriture);
    if (!r.donnees?.corrections.length) return;
    const precedent = texteBlocs(k.blocs);
    k.blocs = appliquerCorrections(k.blocs, r.donnees.corrections);
    c.etat.reecritures++;
    const e = entreeControle(c, { ouverture, corps: k.blocs, fin: [] });
    k.violations = controlerVersion({ ...e, textePrecedent: precedent }, {}).violations.filter((x) => !["C21", "C34", "C36", "C10", "C13", "C14", "C70", "C72"].includes(x.controle));
  }
}

/** L'appel choisi par le code : colonne de l'objectif si permise et ses conditions remplies, sinon le défaut du réseau. */
export function appelPour(p: ParametresGenerateur, reseau: ReseauDeclinaison, objectif: DonneesGeneration["sujet"]["objectif"], corps: BlocScript[]): { type: TypeAppel; selonObjectif: boolean } {
  const r = p.reseau(reseau);
  const voulu = r.appelSelonObjectif?.[objectif];
  const methode = corps.some((b) => b.segments.some((s) => s.marqueurs?.includes("methode")));
  const possible = (t: TypeAppel) => r.appelsPermis.includes(t) && (t !== "sauvegarde" || methode) && t !== "episode-suivant";
  if (voulu && possible(voulu)) return { type: voulu, selonObjectif: true };
  const defaut = possible(r.appelParDefaut) ? r.appelParDefaut : (r.appelsPermis.find(possible) ?? "question-expert");
  return { type: defaut, selonObjectif: false };
}

/**
 * Équipe 7 : les mots-dièse d'une version, ramenés par le CODE à « Vos hashtags » du réseau (3 à 5 sur TikTok), jamais
 * #fyp, #viral, #pourtoi, #foryou — quoi que Claude ait écrit.
 */
export function avecVosHashtags(s: SortieDeclinaison, reseau: ReseauDeclinaison, familles: FamillesHashtags | undefined): SortieDeclinaison {
  const motsDiese = choisirDansFamille(s.publication.motsDiese, famillePour(reseau, familles), ecritureReseau(reseau).motsDiese.valeur);
  return { ...s, publication: { ...s.publication, motsDiese } };
}

/** Règles d'un réseau, en données : réseau, mots-dièse permis, champs de publication, boucle (déclinaison et chaîne courte). */
export function rendreReglesReseau(c: Contexte, reseau: ReseauDeclinaison): string[] {
  const champs = CHAMPS_PUBLICATION[reseau];
  const e = ecritureReseau(reseau);
  const famille = famillePour(reseau, c.options.hashtags);
  return [
    `<reseau id="${reseau}">${rendreReseau(reseau, c.p)}</reseau>`,
    famille ? `<regle_reseau>Mots-dièse UNIQUEMENT parmi : ${famille.join(" ")} ; jamais #fyp, #viral, #pourtoi, #foryou.</regle_reseau>` : "",
    ...champs.consignes.map((x) => `<regle_reseau>${x}</regle_reseau>`),
    champs.post ? `<champ id="post"/>` : "",
    champs.titres ? `<champ id="titres"/>` : "",
    champs.motsClesTiktok ? `<champ id="mots-cles"/>` : "",
    champs.commentaireEpingle ? `<champ id="commentaire-epingle"/>` : "",
    `boucle : ${e.boucle.valeur}`,
  ];
}

function variableDeclinaison(c: Contexte, reseau: ReseauDeclinaison, corps: CorpsEcrit, appel: TypeAppel, consigneEnPlus = ""): string {
  return [
    rendreSujet(c.d),
    ...rendreReglesReseau(c, reseau),
    `Mot-clé : ${c.etat.fond?.motCle ?? ""}`,
    `<appel type="${appel}"/>`,
    `Destinataire de l'envoi : ${c.etat.fond?.envoi.destinataireRole ?? ""}`,
    ...(c.etat.finalistes ?? []).map((f) => `<finaliste id="${f.id}" famille="${f.famille}">${f.dit}</finaliste>`),
    `<corps>\n${texteBlocs(corps.blocs ?? [])}\n</corps>`,
    ...matieresEnvoyees(c.d).filter((m) => c.d.choix.ancrages.some((a) => a.matiereId === m.id)).map((m) => rendreMatiere(m, c.d)),
    c.d.diversite ? rendreConsignesDiversite({ ...c.d.diversite, recitInterdit: false, douleurInterdite: false, rupture: undefined }) : "",
    consigneEnPlus ? `<corrections_demandees>\n${consigneEnPlus}\n</corrections_demandees>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Mise en forme téléprompteur par le code (B.4.7) : lignes de 40 caractères au plus, « / » dans les lignes, une prise par phrase. */
export function miseEnFormePrompteur(blocs: BlocScript[]): string {
  const phrases = blocs.flatMap((b) => b.segments.flatMap((s) => s.texte.split(/(?<=[.!?…])\s+/))).filter((p) => p.trim());
  return phrases
    .map((p, i) => {
      const lignes: string[] = [];
      let ligne = "";
      for (const m of p.split(/\s+/)) {
        if ((ligne + " " + m).trim().length > 40) {
          lignes.push(ligne.trim());
          ligne = m;
        } else ligne = `${ligne} ${m}`;
      }
      if (ligne.trim()) lignes.push(ligne.trim());
      return `${i + 1}. ${lignes.join(" / ")}`;
    })
    .join("\n");
}

/** Trame (B.4.7) : repères de 5 mots au plus, chiffres encadrés, accroche et appel au mot près, cases AVIS et LIMITE préremplies. */
export function miseEnFormeTrame(c: { matieres: DonneesGeneration["matieres"]; exception?: SortieFond["exception"] }, corps: BlocScript[], accroche: string, appel: string): NonNullable<VarianteReseau["trame"]> {
  const segs = corps.flatMap((b) => b.segments);
  const reperes = segs.map((s) => s.texte.replace(/[«»"“”]/g, "").split(/\s+/).slice(0, 5).join(" ").replace(/[,.;:!?]+$/, "")).slice(0, 5);
  const chiffres = [...new Set(segs.flatMap((s) => nombresAffirmes(s.texte).map((n) => n.brut)))].slice(0, 4);
  const avis = c.matieres.find((m) => m.type === "avis-will");
  const limite = c.exception && c.exception.source !== "aucune" ? { texte: c.exception.texte, matiereId: c.exception.matiereId } : { texte: "[LIMITE À VALIDER]" };
  return { reperes, chiffres, verbatim: { accroche, appel }, casesWill: { avis: avis ? { texte: avis.texte, matiereId: avis.id } : undefined, limite } };
}

/** Une version par réseau (étape 11) : déclinaison, assemblage, contrôles par code. Exporté pour la chaîne courte. */
export async function declinerVersion(c: Contexte, reseau: ReseauDeclinaison, consigneEnPlus = ""): Promise<VersionEcrite | null> {
  const k = c.etat.corps![c.etat.gagnant ?? 0];
  const finalistes = (c.etat.finalistes ?? []).map((f) => f.id);
  const a = appelPour(c.p, reseau, c.d.sujet.objectif, k.blocs ?? []);
  const ctx: ContexteEvaluation = { ...c.evalCtx, finalistes, appelsPermis: c.p.reseau(reseau).appelsPermis };
  const r = await appeler(c, 11, ROLES_ECRITURE.declinaison, variableDeclinaison(c, reseau, k, a.type, consigneEnPlus), EVALUATIONS_DES_ROLES.declinaison, ctx);
  if (!r.donnees) return null;
  return assemblerVersion(c, reseau, r.donnees);
}

/**
 * Assemblage d'une version À PARTIR d'une déclinaison écrite (ouverture, corps du gagnant, fin), puis contrôles par code.
 * Exporté : la chaîne courte du banc (`chaine-courte.ts`) assemble et contrôle sa version par ce même chemin.
 */
export function assemblerVersion(c: Contexte, reseau: ReseauDeclinaison, declinaison: SortieDeclinaison): VersionEcrite {
  const k = c.etat.corps![c.etat.gagnant ?? 0];
  const a = appelPour(c.p, reseau, c.d.sujet.objectif, k.blocs ?? []);
  const s = avecVosHashtags(declinaison, reseau, c.options.hashtags);
  const ouverture = ouvertureDe(c, s.accroche, k.plan, s.promesse, s.accrocheId);
  const roles = c.p.recette.roles;
  const e = ecritureReseau(reseau);
  const fin: BlocScript[] = [];
  if (s.appel.type !== "aucun" && s.appel.texte.trim()) fin.push(bloc(roles.appel, [{ id: nouvelIdLocal("s"), texte: s.appel.texte.trim(), marqueurs: ["cta"] }]));
  const avecBoucle = e.boucle.valeur !== "non" && !!s.boucle.trim() && roles.boucle !== undefined && !(e.boucle.valeur === "sauf-apres-question" && s.appel.type === "question-expert");
  if (avecBoucle) fin.push(bloc(roles.boucle!, [{ id: nouvelIdLocal("s"), texte: s.boucle.trim() }]));
  const segmentFacultatifRetenu = e.segmentFacultatif.valeur && s.segmentFacultatifRetenu;
  const corpsReseau = (k.blocs ?? []).map((b) => ({ ...b, segments: b.segments.filter((x) => !x.facultatif || (x.facultatif === reseau && segmentFacultatifRetenu)) })).filter((b) => b.segments.length);
  const v: VersionEcrite = {
    reseau,
    declinaison: s,
    appel: { type: s.appel.type === "aucun" ? a.type : s.appel.type, texte: s.appel.texte, selonObjectif: a.selonObjectif },
    ouverture,
    fin,
    boucle: avecBoucle,
    segmentFacultatifRetenu,
    dureeSec: +dureeBlocs([...ouverture, ...corpsReseau, ...fin], c.debit).toFixed(1),
    violations: [],
    note: { globale: 0, criteres: {}, voyant: "rouge" },
    tours: 0,
  };
  v.violations = controlerVersion(entreeControle(c, { ouverture, corps: corpsReseau, fin, reseau, version: v })).violations;
  return v;
}

/** Note /100 et voyant d'une version, tirés de ses violations (même calcul partout). */
export function noterEtVoyant(v: VersionEcrite): void {
  const n = noterVersion(v.violations);
  v.note = { globale: n.globale, criteres: n.criteres, voyant: voyant(n) };
}

/** Étapes 11 et 12 : une version par réseau (en parallèle), contrôlée, corrigée (raccourcir seulement), rejugée. */
async function etapes11et12(c: Contexte): Promise<void> {
  const k = c.etat.corps![c.etat.gagnant ?? 0];
  const versions: VersionEcrite[] = [];
  const decliner = (reseau: ReseauDeclinaison, consigneEnPlus = "") => declinerVersion(c, reseau, consigneEnPlus);

  const premieres = await Promise.all(c.d.sujet.reseaux.map((r) => decliner(r)));
  for (const v of premieres) if (v) versions.push(v);

  // Étape 12 : corrections automatiques (2 tours au plus) : durée au-dessus de la zone, accroches ou 1res lignes égales.
  for (let tour = 0; tour < (c.options.toursCorrection ?? 2); tour++) {
    const aRefaire: { reseau: ReseauDeclinaison; consigne: string }[] = [];
    for (const v of versions) {
      const zone = ecritureReseau(v.reseau).zoneDureeSec.valeur;
      const autres = versions.filter((x) => x !== v);
      const motifs: string[] = [];
      if (v.dureeSec > zone[1]) motifs.push(`La version dure ${v.dureeSec} s pour une zone de ${zone[1]} s au plus : raccourcis l'accroche ou l'appel d'au moins ${Math.ceil(v.dureeSec - zone[1])} s. N'allonge rien.`);
      if (autres.some((x) => x.declinaison.accroche.trim().toLowerCase() === v.declinaison.accroche.trim().toLowerCase()) && versions.indexOf(v) > 0) motifs.push(`Accroche identique à celle d'un autre réseau : prends une autre finaliste ou adapte-la autrement (différente de « ${v.declinaison.accroche} »).`);
      if (autres.some((x) => x.declinaison.publication.premiereLigne.trim() === v.declinaison.publication.premiereLigne.trim()) && versions.indexOf(v) > 0) motifs.push(`1re ligne de publication identique à celle d'un autre réseau : écris-en une autre que « ${v.declinaison.publication.premiereLigne} ».`);
      // Équipe 7 : TikTok doit comprendre que le compte parle d'IA (C10 quater).
      if (v.violations.some((x) => x.controle === "C10 quater")) motifs.push(`Dis « intelligence artificielle », « IA » ou « ChatGPT » dans l'accroche, avant 5 s, sans rien inventer.`);
      if (v.violations.some((x) => x.bloquant && ["C3", "C3 bis", "C5", "C1", "C34", "C63", "C72", "C64", "C83"].includes(x.controle))) motifs.push(...v.violations.filter((x) => x.bloquant).slice(0, 3).map((x) => `${x.controle} : ${x.message}`));
      if (motifs.length) aRefaire.push({ reseau: v.reseau, consigne: motifs.join("\n") });
    }
    if (!aRefaire.length) break;
    const refaites = await Promise.all(aRefaire.map((x) => decliner(x.reseau, x.consigne)));
    refaites.forEach((nv, i) => {
      if (!nv) return;
      const j = versions.findIndex((x) => x.reseau === aRefaire[i].reseau);
      nv.tours = versions[j].tours + 1;
      // On garde la nouvelle seulement si elle n'est pas pire (moins de bloquants).
      if (nv.violations.filter((x) => x.bloquant).length <= versions[j].violations.filter((x) => x.bloquant).length) versions[j] = nv;
    });
  }

  // C14 entre versions, puis rejugement de l'accroche adaptée et de la boucle (ACC-01 à ACC-04, BCL-01, RET-02).
  for (const v of versions) {
    const k2 = c.etat.corps![c.etat.gagnant ?? 0];
    const corpsReseau = (k2.blocs ?? []).map((b) => ({ ...b, segments: b.segments.filter((x) => !x.facultatif || (x.facultatif === v.reseau && v.segmentFacultatifRetenu)) })).filter((b) => b.segments.length);
    const autres = versions.filter((x) => x !== v).map((x) => ({ reseau: x.reseau, accrocheDite: x.declinaison.accroche, appelTexte: x.appel.texte, premiereLigne: x.declinaison.publication.premiereLigne }));
    v.violations = controlerVersion(entreeControle(c, { ouverture: v.ouverture, corps: corpsReseau, fin: v.fin, reseau: v.reseau, version: v, autres })).violations;
  }
  const questions = questionsDeLEtape(11).filter((q) => q.id !== "ACC-05").concat(questionsDeLEtape(12));
  const verdicts = c.options.rejuge === false ? [] : await juger(
    c,
    12,
    versions.map((v) => ({ id: v.reseau, texte: `Accroche : ${v.declinaison.accroche}\nBoucle : ${v.boucle ? v.declinaison.boucle : "(aucune)"}\nAppel : ${v.appel.texte}\nPublication : ${v.declinaison.publication.texte}${v.declinaison.publication.post ? `\nPost : ${v.declinaison.publication.post.texte}` : ""}` })),
    questions,
  );
  for (const v of versions) {
    v.verdicts = verdicts.find((x) => x.id === v.reseau);
    // BCL-01 « non » : la boucle est retirée (C21 bis).
    if (v.boucle && v.verdicts?.reponses.some((r) => r.id === "BCL-01" && r.reponse === "non")) {
      v.fin = v.fin.filter((b) => b.blocRecette !== c.p.recette.roles.boucle);
      v.boucle = false;
    }
    if (c.d.sujet.mode === "teleprompteur") v.prompteur = miseEnFormePrompteur([...v.ouverture, ...(k.blocs ?? []), ...v.fin]);
    if (c.d.sujet.mode === "trame") v.trame = miseEnFormeTrame({ matieres: c.d.matieres, exception: c.etat.fond?.exception }, k.blocs ?? [], v.declinaison.accroche, v.appel.texte);
    noterEtVoyant(v);
  }
  c.etat.versions = versions;
}

/* ------------------------------------------------------------------ */
/* Conduite                                                             */
/* ------------------------------------------------------------------ */

/** Contexte des évaluations (ids fournis, structures transmises…), tiré des données. */
export function contexteEvaluation(d: DonneesGeneration, p: ParametresGenerateur): ContexteEvaluation {
  const envoyees = matieresEnvoyees(d);
  return {
    preuveIds: new Set(d.preuves.filter((x) => utilisable(x, d.maintenant)).map((x) => x.id)),
    matiereIds: new Set(envoyees.map((m) => m.id)),
    structures: [...new Set(d.combinaisons.map((x) => x.structure))],
    famillesPermises: p.recette.famillesAccrochePermises,
    chiffresNonProuves: [...new Set(envoyees.flatMap((m) => chiffresNonProuves(m.texte, d.preuves)))],
  };
}

/** Contexte d'exécution (recette résolue, débit, blocs du corps, cache, évaluations), tiré des données. */
export function creerContexte(d: DonneesGeneration, executeur: ExecuteurRoles, options: OptionsChaine, etatDepart: EtatChaine | undefined, sauver: (e: EtatChaine) => Promise<void>): Contexte {
  const format = formatGenerateur(d.sujet.formatId);
  const p = parametresGenerateur(d.sujet.formatId);
  const debit = (d.sujet.mode === "avatar" ? (options.debit ?? p.debitParMode?.avatar) : undefined) ?? format.recette.debitParMode[d.sujet.mode];
  const parties = new Set([...format.recette.partiesDeclinaison.ouverture, ...format.recette.partiesDeclinaison.fin]);
  return {
    d,
    p,
    debit,
    blocsCorps: format.recette.blocs.filter((b) => !parties.has(b.id)).map((b) => ({ id: b.id, consigne: b.consigne })),
    cache: blocsEnCache(d, p),
    evalCtx: contexteEvaluation(d, p),
    options: { tiragesJuges: 1, reprises: false, modeChoix: "rapide", ...options },
    executeur,
    etat: etatDepart ? structuredClone(etatDepart) : etatInitial(),
    sauver,
  };
}

/**
 * Déroule la chaîne depuis la dernière étape terminée. `sauver` est appelé après chaque étape (reprise sans double
 * paiement). Renvoie « terminee », « arretee » (manque propre, montant déjà utilisé conservé), « pause » (« je
 * choisis ») ou « attente » (crédit, plafond, modèle).
 */
export async function executerChaine(d: DonneesGeneration, executeur: ExecuteurRoles, options: OptionsChaine = {}, etatDepart?: EtatChaine, sauver: (e: EtatChaine) => Promise<void> = async () => {}): Promise<ResultatChaine> {
  const c = creerContexte(d, executeur, options, etatDepart, sauver);
  delete c.etat.pause;
  // « Je choisis » : le choix de Will prime sur celui du stratège.
  if (c.etat.choixWill?.angle !== undefined && c.etat.stratege?.angles[c.etat.choixWill.angle]) c.etat.angleRetenu = c.etat.choixWill.angle;
  c.etat.etape = etapeDeDepart(c.etat);
  const etapes: [number, () => Promise<boolean | void>][] = [
    [1, () => etape1(c)],
    [2, () => etape2(c)],
    [3, () => etape3(c)],
    [4, () => etape4(c)],
    [6, () => etapes5et6(c)],
    [8, () => etapes7et8(c)],
    [9, () => etape9(c)],
    [10, () => etape10(c)],
    [12, () => etapes11et12(c)],
  ];
  try {
    for (const [n, faire] of etapes) {
      if (c.etat.etape >= n) continue;
      if (c.etat.arret) return { statut: "arretee", etat: c.etat };
      const ok = await faire();
      if (ok === false) {
        await sauver(c.etat);
        return { statut: "arretee", etat: c.etat };
      }
      c.etat.etape = n;
      await sauver(c.etat);
      if (c.options.modeChoix === "je-choisis" && n === 1 && c.etat.choixWill?.angle === undefined) {
        c.etat.pause = { raison: "choisir-angle" };
        await sauver(c.etat);
        return { statut: "pause", etat: c.etat };
      }
      if (c.options.modeChoix === "je-choisis" && n === 4 && !c.etat.choixWill?.accrocheIds?.length) {
        c.etat.pause = { raison: "choisir-accroches" };
        await sauver(c.etat);
        return { statut: "pause", etat: c.etat };
      }
    }
    return { statut: "terminee", etat: c.etat };
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

/** Facteur des sorties renvoyées dans l'entrée d'un appel suivant (estimation des jetons au pire, JSON indenté). */
export const FACTEUR_SORTIE_RENVOYEE = 1.5;
/** Allocation fixe au pire pour les petites consignes ajoutées (corrections, défauts, questions des juges). */
export const JETONS_CONSIGNES_AJOUTEES = 3000;

/**
 * Étape d'où la chaîne repart vraiment (même règle que `executerChaine`) : des accroches rechoisies par Will après l'étape
 * 4 la ramènent à l'étape 3 (tri, plan et texte refaits).
 */
export function etapeDeDepart(etat: EtatChaine): number {
  const choisies = etat.choixWill?.accrocheIds;
  return choisies?.length && etat.etape >= 4 && choisies.join() !== (etat.finalistes ?? []).map((f) => f.id).join() ? 3 : etat.etape;
}

/**
 * GARDE-FOUS BUDGET (15/10, corrigé après relecture) : PIRE CAS PRUDENT de la GRANDE chaîne restante, depuis l'état de
 * départ, calculé AVANT le premier appel (PUR). Chaque appel possible est compté (reprises ciblées, retour du plan,
 * raccourcissement de la prose, deux tours de réécriture, corrections des versions, rejugement), même s'il n'a lieu que si
 * un contrôle échoue, au pire PRUDENT (`pireCasPrudentAppel` : entrée au prix normal, `maxTokens` en sortie ; le socle
 * écrit en cache une fois par rôle). L'entrée de chaque appel compte ce qui est connu (contexte en cache, variable de
 * base) PLUS les sorties des étapes précédentes qu'il reçoit (`maxTokens` × 1,5 chacune) et 3 000 jetons de consignes.
 * Avant ce correctif, chaque appel comptait toute son entrée au prix d'écriture en cache (un quart de trop par appel).
 */
export function pireCasGrandeChaine(d: DonneesGeneration, options: OptionsChaine = {}, etatDepart?: EtatChaine): PireCasChaine {
  const c = creerContexte(d, { executer: async () => ({ ok: false, arret: "verrou-perdu", message: "" }) }, options, etatDepart, async () => {});
  const R = ROLES_ECRITURE;
  const fois = c.options.reprises ? 2 : 1;
  const corps = c.options.deuxCorps ? 2 : 1;
  const tirages = Math.max(1, c.options.tiragesJuges);
  const reseaux = Math.max(1, d.sujet.reseaux.length);
  const tours = c.options.toursCorrection ?? 2;
  const sortie = (r: DefinitionRole) => r.maxTokens * FACTEUR_SORTIE_RENVOYEE;
  const base = variableBase(c);
  const blocs = c.blocsCorps.map((b) => b.consigne).join("\n");
  const regles = d.sujet.reseaux.map((r) => rendreReglesReseau(c, r).join("\n")).sort((a, b) => b.length - a.length)[0] ?? "";
  const S = sortie(R.stratege);
  const F = sortie(R.fond);
  const A = sortie(R.accroches);
  const P = sortie(R.plan);
  const Pr = sortie(R.prose);
  const D = sortie(R.declinaison);
  const appel = (role: DefinitionRole, variable: string, jetonsEnPlus: number) => pireCasPrudentAppel(role, { contexte: c.cache, variable }, jetonsEnPlus + JETONS_CONSIGNES_AJOUTEES);
  const prevus: LignePireCas[] = [
    { etape: 1, n: fois, appel: appel(R.stratege, base, 0) },
    { etape: 2, n: fois, appel: appel(R.fond, base, S) },
    { etape: 3, n: fois, appel: appel(R.accroches, `${base}\n${famillesTexte(c)}`, S + F) },
    { etape: 4, n: fois * tirages, parallele: tirages, appel: appel(R.juge, variableJuge([], questionsDeLEtape(4)), S + A) },
    // Un plan par corps, plus le retour avec le plan refusé.
    { etape: 6, n: fois * corps * 2, appel: appel(R.plan, base, S + F + A + P) },
    // Une prose par corps, plus le retour pour raccourcir.
    { etape: 8, n: fois * corps * 2, appel: appel(R.prose, `${base}\n${blocs}`, S + F + A + P) },
    { etape: 9, n: fois * tirages, parallele: tirages, appel: appel(R.juge, variableJuge([], questionsDeLEtape(9)), S + F + corps * Pr) },
    ...(corps > 1 ? [{ etape: 9, n: fois * 2, parallele: 2, appel: appel(R.preference, "", 2 * Pr) }] : []),
    ...(c.options.reecriture === false ? [] : [{ etape: 10, n: fois * 2, appel: appel(R.reecriture, "", F + A + Pr) }]),
    // Une déclinaison par réseau (parties ensemble), plus les tours de correction de chacune.
    { etape: 12, n: fois * reseaux * (1 + tours), parallele: reseaux, appel: appel(R.declinaison, `${base}\n${regles}`, A + Pr) },
    ...(c.options.rejuge === false ? [] : [{ etape: 12, n: fois * tirages, parallele: tirages, appel: appel(R.juge, variableJuge([], [...questionsDeLEtape(11), ...questionsDeLEtape(12)]), reseaux * D) }]),
  ];
  const depuis = etapeDeDepart(c.etat);
  return totaliserPireCas(prevus.filter((x) => x.etape > depuis));
}

/** Texte assemblé d'une version écrite (affichage, banc). */
export function texteVersion(etat: EtatChaine, v: VersionEcrite): string {
  const k = etat.corps?.[etat.gagnant ?? 0];
  const corps = (k?.blocs ?? []).map((b) => ({ ...b, segments: b.segments.filter((x) => !x.facultatif || (x.facultatif === v.reseau && v.segmentFacultatifRetenu)) }));
  return [...v.ouverture, ...corps, ...v.fin].flatMap((b) => b.segments.map((s) => s.texte)).join("\n");
}

/**
 * Retouche d'UNE version (B.3.6 `regenererVariante`) : « autre accroche », « plus court » ou « améliorer » relancent la
 * déclinaison de ce seul réseau sur le corps validé, avec une consigne chiffrée ; contrôles et note par code. L'état de
 * la chaîne n'est pas modifié (la nouvelle version est rangée par le service, l'ancienne est gardée).
 */
export async function redeclinerVersion(d: DonneesGeneration, etat: EtatChaine, reseau: ReseauDeclinaison, executeur: ExecuteurRoles, demande: "autre-accroche" | "plus-court" | "ameliorer", precedente?: { accroche: string; dureeSec: number }, options: OptionsChaine = {}): Promise<VersionEcrite | null> {
  const c = creerContexte(d, executeur, { reprises: false, ...options }, etat, async () => {});
  const consigne =
    demande === "autre-accroche"
      ? `Prends une AUTRE finaliste que « ${precedente?.accroche ?? ""} », ou adapte-la autrement.`
      : demande === "plus-court"
        ? `La version dure ${precedente?.dureeSec ?? "?"} s : raccourcis l'accroche et l'appel d'au moins 3 s. N'allonge rien.`
        : "Améliore l'accroche, l'appel et la publication sans rien inventer : plus concret, plus court, une seule cible.";
  const v = await declinerVersion(c, reseau, consigne);
  if (!v) return null;
  noterEtVoyant(v);
  return v;
}
