/**
 * SERVICE DES PREUVES ALLÉGÉES (générateur, plan v5 B.10 ligne G2).
 *
 * Saisie en < 20 s : l'énoncé dicté et, au besoin, « ce qu'on peut dire » ; tout le reste par défaut. Le « à ne pas
 * dire » est PROPOSÉ par le code (sans fait ajouté) et n'entre dans la preuve qu'après le toucher de Will. Les accords
 * sont des interrupteurs. Rien n'est effacé : un retrait liste les versions touchées (et fait tomber les matières qui
 * citent la preuve).
 */
import "server-only";
import type { Id, Preuve } from "@/domaine/types";
import { utilisationsPreuve, type Utilisations } from "@/domaine/derivations-generateur";
import { LIBELLES_MOTIF_RETRAIT, LIBELLES_TYPE_PREUVE, matieresDeLaPreuve, preuveDisponible } from "@/domaine/matieres";
import { peremptionParDefaut } from "@/domaine/preuves";
import { preuveParDefaut, proposerANePasDire, sansFaitAjoute, type PropositionANePasDire, type SaisiePreuve } from "@/domaine/preuves-saisie";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { appliquerRetrait, type ImpactRetrait, type MotifRetrait } from "./matieres";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser, maintenant } from "./_commun";

export interface PreuveAjoutee {
  preuve: Preuve;
  /** « À ne pas dire » proposé, à valider d'un toucher. */
  propositions: PropositionANePasDire[];
}

/** Ajoute une preuve depuis l'énoncé seul (valeurs par défaut). */
export async function ajouterPreuve(s: SaisiePreuve & { estDemo?: boolean }): Promise<PreuveAjoutee> {
  await exigerSession();
  if (!s.enonce.trim()) throw new ErreurStudio("VIDE", "Dictez la phrase exacte qu'on peut dire.");
  const le = maintenant();
  const preuve: Preuve = { ...preuveParDefaut(s, le), id: nouvelId("preuve"), estDemo: s.estDemo, ...horodatage() };
  await depots().preuves.enregistrer(preuve);
  await journaliser("preuve", `Preuve ajoutée (${LIBELLES_TYPE_PREUVE[preuve.type]})`, { type: "preuve", id: preuve.id });
  return { preuve, propositions: proposerANePasDire(preuve) };
}

async function obtenir(id: Id): Promise<Preuve> {
  const p = await depots().preuves.obtenir(id);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette preuve n'existe plus.");
  return p;
}

/** Propositions « à ne pas dire » d'une preuve existante (celles déjà validées sont retirées de la liste). */
export async function propositionsANePasDire(id: Id): Promise<PropositionANePasDire[]> {
  await exigerSession();
  const p = await obtenir(id);
  return proposerANePasDire(p).filter((x) => !p.formulationsInterdites.includes(x.texte));
}

/**
 * Valide d'un toucher une formulation « à ne pas dire ». Refusée si elle ajoute un fait (un chiffre absent de
 * l'énoncé) : elle ne peut que nommer une déformation.
 */
export async function validerANePasDire(id: Id, texte: string): Promise<Preuve> {
  await exigerSession();
  const p = await obtenir(id);
  const t = texte.trim();
  if (!t) throw new ErreurStudio("VIDE", "Formulation vide.");
  if (!sansFaitAjoute(p.enonce, t)) throw new ErreurStudio("FAIT_AJOUTE", "Cette formulation ajoute un chiffre absent de la preuve.");
  if (p.formulationsInterdites.includes(t)) return p;
  return depots().preuves.modifier(id, { formulationsInterdites: [...p.formulationsInterdites, t] });
}

/** Ajoute une formulation autorisée (« ce qu'on peut dire »). */
export async function ajouterPeutDire(id: Id, texte: string): Promise<Preuve> {
  await exigerSession();
  const p = await obtenir(id);
  const t = texte.trim();
  if (!t || p.formulationsAutorisees.includes(t)) return p;
  return depots().preuves.modifier(id, { formulationsAutorisees: [...p.formulationsAutorisees, t] });
}

export type AccordPreuve = "accordEcrit" | "accordCapture" | "accordAvantApres";

/** Accords du client en interrupteurs (cas client). */
export async function basculerAccordPreuve(id: Id, accord: AccordPreuve, valeur: boolean): Promise<Preuve> {
  await exigerSession();
  const p = await obtenir(id);
  const client = { ...(p.client ?? { anonymise: true, accordEcrit: false }), [accord]: valeur };
  const maj = await depots().preuves.modifier(id, { client });
  if (accord === "accordEcrit") {
    for (const mid of matieresDeLaPreuve(id, await depots().matieres.lister((m) => m.preuveId === id))) {
      const m = await depots().matieres.obtenir(mid);
      if (m?.accord) await depots().matieres.modifier(mid, { accord: { ...m.accord, obtenu: valeur, le: valeur ? maintenant() : undefined } });
    }
  }
  return maj;
}

/** Change le type (un toucher) : la péremption suit le type. */
export async function changerTypePreuve(id: Id, type: Preuve["type"]): Promise<Preuve> {
  await exigerSession();
  const p = await obtenir(id);
  return depots().preuves.modifier(id, { type, perimeLe: peremptionParDefaut({ preuve: type }, p.source.date) ?? undefined });
}

/** Retire une preuve (motif en un toucher) ; les matières qui la citent tombent avec elle. Rien n'est supprimé. */
export async function retirerPreuve(id: Id, motif: MotifRetrait, note?: string): Promise<ImpactRetrait> {
  await exigerSession();
  const p = await obtenir(id);
  const le = maintenant();
  const retrait = { le, motif, note: note?.trim() || undefined };
  if (!p.retrait) await depots().preuves.modifier(id, { retrait });
  const liees = matieresDeLaPreuve(id, await depots().matieres.lister((m) => m.preuveId === id));
  for (const mid of liees) {
    const m = await depots().matieres.obtenir(mid);
    if (m && !m.retrait) await depots().matieres.modifier(mid, { retrait });
  }
  const impact = await appliquerRetrait({ matiereIds: liees, preuveIds: [id] });
  await journaliser("preuve", `Preuve retirée (${LIBELLES_MOTIF_RETRAIT[motif]}) : ${impact.versions.length} version(s) concernée(s)`, { type: "preuve", id });
  return impact;
}

export interface VuePreuve {
  preuve: Preuve;
  disponible: boolean;
  utilisations: Utilisations;
}

/** « Chiffres et preuves » (filtre de l'onglet Matières). */
export async function listerPreuves(): Promise<VuePreuve[]> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<Preuve>();
  const [preuves, maitres, scripts, variantes] = await Promise.all([d.preuves.lister((p) => exemples(p) && !p.archiveLe), d.scriptsMaitres.lister(), d.scripts.lister((s) => !!s.scriptMaitreId), d.variantes.lister()]);
  const t = maintenant();
  return preuves
    .map((p) => ({ preuve: p, disponible: preuveDisponible(p, t), utilisations: utilisationsPreuve(p.id, { maitres, scripts, variantes }) }))
    .sort((a, b) => Number(!!a.preuve.retrait) - Number(!!b.preuve.retrait) || b.preuve.creeLe.localeCompare(a.preuve.creeLe));
}
