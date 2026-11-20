/**
 * T-EXT-53b — LECTEUR DE DEMANDE COMMUN du chat de retouche (SENSIBLE ARGENT, ÉTEINT tant qu'aucun générateur ne le branche).
 * Un seul lecteur pour tous les générateurs : d'abord les RÈGLES (gratuites, sans réseau) ; si elles ne comprennent rien,
 * ET SEULEMENT si le générateur dit que Claude est allumé, UN SEUL appel par le port `appeler` du générateur (qui porte son
 * plafond et sa consigne). Jamais de second essai, jamais d'exception, jamais de montant dans une phrase.
 * Pur : ports injectés, aucun import d'un moteur ni du tutoriel. Chaque générateur n'apporte que son SUPPLÉMENT
 * (opérations propres) et son port d'appel.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { extraireJson } from "@/fournisseurs/claude/client";
import { construireRequeteRetouche, demandeExpliciteScript, lectureSimple } from "./comprendre";
import { lireParRegles } from "./lecture-regles";
import { lireOperations } from "./schema";
import type { PortsRetoucheChat } from "./service";

/** Plafond de réponse d'une lecture : une réponse d'opérations tient largement dedans ; une réponse coupée est illisible, donc « rien ». */
export const MAX_JETONS_LECTEUR = 1500;

export const PHRASE_LECTEUR_VIDE = "Écrivez ce que vous voulez changer.";
export const PHRASE_LECTEUR_NON_COMPRIS = "Je n'ai pas compris : dites la scène ou l'étape (par exemple « étape 3 ») et ce qu'il faut changer.";
export const PHRASE_LECTEUR_EPUISE = "Les lectures prévues pour cette vidéo sont faites : dites la scène ou l'étape (par exemple « étape 3 ») et ce qu'il faut changer.";
const LIGNE_SUPPLEMENT = "Les opérations propres à cette vidéo vont dans la clé \"supplementaires\".";

/** Ce qu'un générateur ajoute au lecteur : ses opérations propres (liste fermée, relue strictement). */
export interface SupplementLecteur<T> {
  /** Ajouté à la FIN du message `user` (jamais à la consigne) : opérations propres + contexte. */
  bloc: string;
  /** Lecture gratuite des opérations propres. */
  regles: (phrase: string) => T[];
  /** Relecture stricte de la clé `supplementaires` de la réponse de Claude. */
  relire: (brut: unknown) => { operations: T[]; remarques: string[] };
}

export interface PortsLecteur {
  /** Déjà enveloppé par le générateur (consigne, plafond, étape de dépense). */
  appeler: AppelClaude;
  /** Réglage du générateur : seul `true` allume ; une lecture en échec vaut « non ». */
  claudeAllume: () => Promise<boolean>;
  /** Facultatif : nombre de lectures encore permises. Absent : pas de limite propre, le plafond de la vidéo reste la barrière. En échec : 0. */
  lecturesRestantes?: () => Promise<number>;
}

export interface LectureDemande<T = never> {
  operations: OperationRetouche[];
  supplementaires: T[];
  remarques: string[];
  source: "regles" | "claude" | "rien";
  appels: 0 | 1;
}

const rien = <T>(phrase: string, appels: 0 | 1 = 0): LectureDemande<T> => ({ operations: [], supplementaires: [], remarques: [phrase], source: "rien", appels });

async function sur(f: (() => Promise<boolean>) | undefined): Promise<boolean> {
  try {
    return f ? (await f()) === true : false;
  } catch {
    return false;
  }
}

async function lecturesPermises(ports: PortsLecteur): Promise<boolean> {
  if (!ports.lecturesRestantes) return true;
  try {
    const n = await ports.lecturesRestantes();
    return Number.isFinite(n) && n > 0;
  } catch {
    return false;
  }
}

/** Ne lève jamais. Au plus UN appel à `ports.appeler`. */
export async function lireDemande<T = never>(e: { phrase: string; plan: PlanValide; supplement?: SupplementLecteur<T> }, ports: PortsLecteur): Promise<LectureDemande<T>> {
  const phrase = (e.phrase ?? "").trim();
  if (!phrase) return rien(PHRASE_LECTEUR_VIDE);

  // 1. Les règles, gratuites.
  try {
    const operations = lireParRegles(phrase, e.plan);
    const simples = operations.length ? operations : lectureSimple(phrase);
    const propres = e.supplement ? e.supplement.regles(phrase) : [];
    if (simples.length || propres.length) return { operations: simples, supplementaires: propres, remarques: [], source: "regles", appels: 0 };
  } catch {
    // Une règle qui échoue ne coûte rien : on passe à la suite.
  }

  // 2. Claude : seulement si le générateur l'a allumé et que des lectures restent.
  if (!(await sur(ports.claudeAllume))) return rien(PHRASE_LECTEUR_NON_COMPRIS);
  if (!(await lecturesPermises(ports))) return rien(PHRASE_LECTEUR_EPUISE);

  // `appels` = appels RÉPONDUS (donc payés) : 1 dès que `ports.appeler` a rendu une réponse, même si elle est illisible ;
  // 0 si `ports.appeler` lui-même lève (plafond refusé, panne : rien n'a été facturé par ce lecteur).
  let repondu: 0 | 1 = 0;
  try {
    const base = construireRequeteRetouche(phrase, e.plan);
    const dernier = base.messages[base.messages.length - 1];
    const ajout = e.supplement ? `\n\n${e.supplement.bloc}\n${LIGNE_SUPPLEMENT}` : "";
    const requete = { ...base, maxTokens: MAX_JETONS_LECTEUR, messages: [...base.messages.slice(0, -1), { ...dernier, contenu: `${dernier.contenu}${ajout}` }] };
    const r = await ports.appeler(requete); // l'UNIQUE appel de cette demande
    repondu = 1;
    const valeur: unknown = JSON.parse(extraireJson(r.texte));
    const objet = valeur && typeof valeur === "object" ? (valeur as { operations?: unknown; supplementaires?: unknown }) : {};
    const remarques: string[] = [];
    const lu = lireOperations(Array.isArray(objet.operations) ? objet.operations : []);
    remarques.push(...lu.remarques);
    let operations = lu.operations;
    if (!demandeExpliciteScript(phrase)) {
      const gardees = operations.filter((o) => o.type !== "modifier-script");
      if (gardees.length !== operations.length) remarques.push("Le texte lu reste le vôtre : pour le changer, demandez « modifie le script ».");
      operations = gardees;
    }
    let supplementaires: T[] = [];
    if (e.supplement && objet.supplementaires !== undefined) {
      const s = e.supplement.relire(objet.supplementaires);
      supplementaires = s.operations;
      remarques.push(...s.remarques);
    }
    if (!operations.length && !supplementaires.length && !remarques.length) remarques.push(PHRASE_LECTEUR_NON_COMPRIS);
    return { operations, supplementaires, remarques, source: "claude", appels: 1 };
  } catch {
    // Panne, plafond refusé, JSON illisible : « rien », jamais de second appel.
    return rien(PHRASE_LECTEUR_NON_COMPRIS, repondu);
  }
}

/** La forme attendue par le port `lecteur` du service. */
export function creerLecteur<T>(supplement: SupplementLecteur<T> | undefined, ports: PortsLecteur): NonNullable<PortsRetoucheChat["lecteur"]> {
  return async (demande, plan) => {
    const l = await lireDemande<T>({ phrase: demande, plan, supplement }, ports);
    return { operations: l.operations, supplementaires: l.supplementaires, remarques: l.remarques, source: l.source };
  };
}
