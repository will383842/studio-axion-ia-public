/**
 * PRONONCIATION-a : « ce mot est mal dit dans CETTE vidéo » (module PUR, sans importeur : éteint, 0 €).
 * À partir du texte de la vidéo, de la base de prononciations existante et d'un couple mot → prononciation, calcule :
 * les phrases concernées, le texte LU avant / après, la preuve que le texte ÉCRIT (script, sous-titres) ne change pas,
 * le nombre de caractères à relire, et s'il faut AJOUTER une entrée ou MODIFIER celle qui existe (l'ancienne sera
 * archivée par le service existant, jamais effacée). Aucun service, aucun fournisseur, aucun réglage.
 */
import { appliqueA, cleMot, motifMot, prononciationsActives, substituerPrononciations } from "./prononciations";
import type { Id, Prononciation } from "./types";

export interface PlanTexte {
  id: string;
  texte: string;
}

export interface PhraseMotMalDit {
  planId: string;
  /** Texte ÉCRIT d'origine, recopié tel quel. */
  ecrit: string;
  luAvant: string;
  luApres: string;
}

export interface MotMalDit {
  action: "ajouter" | "modifier" | "rien";
  /** L'entrée ACTIVE qui sera archivée puis remplacée (action « modifier »). */
  entreeExistante?: Prononciation;
  phrases: PhraseMotMalDit[];
  /** Toujours vrai : l'écriture n'est jamais passée par la substitution. */
  ecritInchange: true;
  caracteresARelire: number;
  /** Phrase claire pour l'écran (jamais de montant). */
  message: string;
}

export interface DemandeMotMalDit {
  /** Texte entier, utilisé seulement quand `plans` est vide. */
  texte?: string;
  plans: Pick<PlanTexte, "id" | "texte">[];
  liste: Prononciation[];
  mot: string;
  prononciation: string;
  portee?: { voixId?: Id; personnageId?: Id };
}

const memePortee = (a?: { voixId?: Id; personnageId?: Id }, b?: { voixId?: Id; personnageId?: Id }): boolean => (a?.voixId ?? "") === (b?.voixId ?? "") && (a?.personnageId ?? "") === (b?.personnageId ?? "");

const rien = (message: string): MotMalDit => ({ action: "rien", phrases: [], ecritInchange: true, caracteresARelire: 0, message });

export function preparerMotMalDit(d: DemandeMotMalDit): MotMalDit {
  const mot = d.mot.trim();
  const prononciation = d.prononciation.trim();
  if (!mot) return rien("Aucun mot choisi.");
  if (!prononciation) return rien("Écrivez comment le mot se prononce.");
  if (prononciation === mot) return rien("La prononciation est identique au mot : rien à changer.");

  const existante = d.liste.find((p) => !p.archiveLe && cleMot(p.mot) === cleMot(mot) && memePortee(p.portee, d.portee));
  if (existante && existante.prononciation.trim() === prononciation) return rien("Cette prononciation est déjà enregistrée pour ce mot.");

  const contexte = { voixId: d.portee?.voixId, personnageId: d.portee?.personnageId };
  const sources = d.plans.length ? d.plans.map((p) => ({ planId: p.id, texte: p.texte })) : d.texte ? [{ planId: "texte", texte: d.texte }] : [];
  const concernees = sources.filter((s) => motifMot(mot).test(s.texte));
  if (!concernees.length) return rien("Ce mot n'apparaît pas dans le texte lu de cette vidéo.");

  const correction: Prononciation = { id: "correction-en-cours", creeLe: "", modifieLe: "", mot, prononciation, ...(d.portee ? { portee: d.portee } : {}) } as Prononciation;
  const avant = prononciationsActives(d.liste.filter((p) => appliqueA(p, contexte)), contexte);
  const apres = prononciationsActives([...d.liste.filter((p) => p !== existante), correction], contexte);
  const phrases = concernees.map((s) => ({
    planId: s.planId,
    ecrit: s.texte,
    luAvant: substituerPrononciations(s.texte, avant),
    luApres: substituerPrononciations(s.texte, apres),
  }));
  return {
    action: existante ? "modifier" : "ajouter",
    ...(existante ? { entreeExistante: existante } : {}),
    phrases,
    ecritInchange: true,
    caracteresARelire: phrases.reduce((s, p) => s + p.luApres.length, 0),
    message: `${phrases.length} phrase${phrases.length > 1 ? "s" : ""} à relire avec la nouvelle prononciation ; le texte écrit ne change pas.`,
  };
}
