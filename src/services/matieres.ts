/**
 * SERVICE DES MATIÈRES (générateur, plan v5 B.2.9, lot G2).
 *
 * - « + Matière » : Will dicte, le code propose le type (confirmé d'un toucher), source « dictée » et date du jour par
 *   défaut. Saisie par Will : validée d'office, sauf un texte qui ressemble à une consigne (C58), qui reste à confirmer.
 * - Dictée en vrac : le code découpe ; chaque morceau enregistré doit être une SOUS-CHAÎNE EXACTE de la dictée, sinon
 *   il est refusé. « Ranger pour moi » est facultatif et SIMULÉ (aucun appel, aucune dépense) ; sa sortie passe par le
 *   même contrôle et reste à confirmer.
 * - Cas client et étude : les faits vivent dans une Preuve ; sans preuve désignée, une preuve est créée avec le texte
 *   exact de la matière comme énoncé, et la matière pointe vers elle.
 * - Retrait : rien n'est effacé ; la matière passe en `retrait`, toutes les versions qui l'utilisent sont listées et
 *   classées ; seules les versions non publiées changent d'état ; déprogrammer reste un geste de Will, un par publication.
 */
import "server-only";
import type { DateIso, Id, Matiere, Preuve, TypeMatiere } from "@/domaine/types";
import { proposerPilier, utilisationsMatiere, type Utilisations } from "@/domaine/derivations-generateur";
import {
  accordRequis,
  decouperDictee,
  estVerbatim,
  etatMatiere,
  exigePreuve,
  jaugeCarburant,
  LIBELLES_MATIERE,
  LIBELLES_MOTIF_RETRAIT,
  motsClesDe,
  proposerNomsSensibles,
  proposerTypeMatiere,
  ressembleInstruction,
  sujetReserveDe,
  verifierRangement,
  versionsTouchees,
  type CibleRetrait,
  type EtatMatiere,
  type Jauge,
  type VersionTouchee,
} from "@/domaine/matieres";
import { peremptionParDefaut } from "@/domaine/preuves";
import { preuveParDefaut } from "@/domaine/preuves-saisie";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { synchroniserSujet } from "./generateur";
import { depots, ecrireParametre, ErreurStudio, filtreExemples, horodatage, journaliser, lireParametre, maintenant } from "./_commun";

/* ------------------------------------------------------------------ */
/* Ajout                                                               */
/* ------------------------------------------------------------------ */

export interface SaisieMatiere {
  texte: string;
  /** Absent : proposé par le code. */
  type?: TypeMatiere;
  origine?: Matiere["source"]["origine"];
  detail?: string;
  url?: string;
  date?: DateIso;
  /** Interrupteur « J'ai son accord » (cas client, parole de dirigeant). */
  accord?: boolean;
  nomsSensibles?: string[];
  pilier?: string;
  preuveId?: Id;
  scene?: string;
  croyanceAttribuee?: boolean;
  /** Matières d'essai (tests) : marquées, jamais mêlées aux vraies. */
  estDemo?: boolean;
}

export interface MatiereAjoutee {
  matiere: Matiere;
  /** Noms propres repérés, à masquer d'un toucher (C59). */
  nomsProposes: string[];
  /** Raison pour laquelle elle reste à confirmer (C58). */
  aConfirmer?: string;
}

async function piliersValides(): Promise<{ id: string; motsCles: string[] }[]> {
  const contextes = await depots().contexteAxion.lister();
  const courant = contextes.sort((a, b) => b.version - a.version)[0];
  return courant?.piliers ?? [];
}

/** Crée la preuve d'un cas client ou d'une étude dont le texte EXACT devient l'énoncé. */
async function preuvePour(texte: string, type: "cas-client" | "etude", m: SaisieMatiere, le: DateIso): Promise<Preuve> {
  const base = preuveParDefaut({ enonce: texte, type, source: { titre: m.detail, url: m.url, date: m.date ?? le } }, le);
  const p: Preuve = {
    ...base,
    id: nouvelId("preuve"),
    client: type === "cas-client" ? { anonymise: true, accordEcrit: !!m.accord, nomsSensibles: m.nomsSensibles } : undefined,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  await depots().preuves.enregistrer(p);
  return p;
}

async function construire(m: SaisieMatiere, saisiePar: Matiere["saisiePar"]): Promise<MatiereAjoutee> {
  const texte = m.texte.trim();
  if (!texte) throw new ErreurStudio("VIDE", "Dictez ou écrivez la matière.");
  const le = maintenant();
  const type = m.type ?? proposerTypeMatiere(texte);
  const d = depots();
  let preuve: Preuve | null = null;
  if (exigePreuve(type)) {
    preuve = m.preuveId ? await d.preuves.obtenir(m.preuveId) : await preuvePour(texte, type, m, le);
    if (!preuve) throw new ErreurStudio("INTROUVABLE", "Cette preuve n'existe plus.");
  }
  const date = m.date ?? le;
  const raison = ressembleInstruction(texte);
  const matiere: Matiere = {
    id: nouvelId("mat"),
    type,
    texte,
    scene: m.scene?.trim() || undefined,
    source: { origine: m.origine ?? "dictee", detail: m.detail?.trim() || undefined, url: m.url?.trim() || undefined, date },
    preuveId: preuve?.id,
    accord: accordRequis(type) ? { requis: true, obtenu: !!m.accord, le: m.accord ? le : undefined, forme: m.accord ? "oral-note" : undefined } : undefined,
    pilier: m.pilier ?? proposerPilier(texte, await piliersValides()),
    motsCles: motsClesDe(texte),
    croyanceAttribuee: type === "idee-recue" ? (m.croyanceAttribuee ?? true) : undefined,
    nomsSensibles: m.nomsSensibles?.length ? [...new Set(m.nomsSensibles)] : undefined,
    saisiePar,
    statut: saisiePar === "will" && !raison ? "validee" : "a-confirmer",
    perimeLe: peremptionParDefaut({ matiere: type, preuveReliee: preuve ?? undefined }, date) ?? undefined,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  await d.matieres.enregistrer(matiere);
  return { matiere, nomsProposes: proposerNomsSensibles(texte).filter((n) => !matiere.nomsSensibles?.includes(n)), aConfirmer: raison ?? undefined };
}

/** « + Matière » : un texte dicté, le type proposé (ou celui que Will a touché), rien d'autre à remplir. */
export async function ajouterMatiere(m: SaisieMatiere): Promise<MatiereAjoutee> {
  await exigerSession();
  const r = await construire(m, "will");
  await journaliser("matiere", `Matière ajoutée (${LIBELLES_MATIERE[r.matiere.type].court})`, { type: "matiere", id: r.matiere.id });
  return r;
}

/**
 * Matière PROPOSÉE par le studio (Source axion-ia.com, tâche de fond : sans session) : saisie « proposee-machine »,
 * toujours « à confirmer » ; le texte est celui de la source, mot pour mot.
 */
export async function proposerMatiere(m: SaisieMatiere): Promise<Matiere> {
  return (await construire(m, "proposee-machine")).matiere;
}

/** « Écarter » une matière proposée : rangée (jamais effacée), plus jamais montrée ni proposée. */
export async function ecarterMatiere(id: Id): Promise<Matiere> {
  await exigerSession();
  const m = await obtenir(id);
  if (m.archiveLe) return m;
  const maj = await depots().matieres.modifier(id, { archiveLe: maintenant() });
  await journaliser("matiere", "Matière proposée écartée", { type: "matiere", id });
  return maj;
}

/* ------------------------------------------------------------------ */
/* Dictée en vrac                                                      */
/* ------------------------------------------------------------------ */

export interface MorceauPropose {
  texte: string;
  debut: number;
  fin: number;
  type: TypeMatiere;
  nomsProposes: string[];
}

/** Découpe proposée (aucune écriture) : chaque morceau est une sous-chaîne exacte, avec un type proposé. */
export async function proposerDecoupe(dictee: string): Promise<MorceauPropose[]> {
  await exigerSession();
  return decouperDictee(dictee).map((m) => ({ ...m, type: proposerTypeMatiere(m.texte), nomsProposes: proposerNomsSensibles(m.texte) }));
}

/**
 * « Ranger pour moi · ≈ 0,01 € » : SIMULÉ (aucun appel à Claude, aucune dépense). La sortie, simulée aujourd'hui et
 * réelle plus tard, passe toujours par `verifierRangement` : un morceau qui n'est pas une sous-chaîne exacte est rejeté.
 */
export async function rangerPourMoi(dictee: string, sortieMachine?: { texte: string; type: TypeMatiere }[]): Promise<{ morceaux: MorceauPropose[]; rejetes: string[]; simule: true }> {
  await exigerSession();
  // Correcteur 3 (B14) : aucun rôle Claude ne range encore ; Claude relié, on ne montre pas un rangement inventé.
  if (!sortieMachine && (await (await import("./generation-claude")).claudeBranche())) throw new ErreurStudio("RANGEMENT_ESSAI", "« Ranger pour moi » n'est pas encore relié à Claude : utilisez « Découper ».");
  const sortie = sortieMachine ?? decouperDictee(dictee).map((m) => ({ texte: m.texte, type: proposerTypeMatiere(m.texte) }));
  const { gardes, rejetes } = verifierRangement(dictee, sortie);
  const morceaux = gardes.map((g) => {
    const debut = dictee.indexOf(g.texte);
    return { texte: g.texte, debut, fin: debut + g.texte.length, type: g.type, nomsProposes: proposerNomsSensibles(g.texte) };
  });
  return { morceaux, rejetes: rejetes.map((r) => r.texte), simule: true };
}

/**
 * Enregistre les morceaux confirmés d'une dictée en vrac. Chaque texte DOIT être une sous-chaîne exacte de la dictée :
 * sinon rien n'est enregistré (aucun mot changé, jamais).
 */
export async function enregistrerEnVrac(
  dictee: string,
  morceaux: { texte: string; type: TypeMatiere; accord?: boolean; nomsSensibles?: string[] }[],
  options: { rangePar?: "code" | "machine"; estDemo?: boolean } = {},
): Promise<Matiere[]> {
  await exigerSession();
  const faux = morceaux.find((m) => !estVerbatim(dictee, m.texte));
  if (faux) throw new ErreurStudio("VERBATIM", "Un morceau ne correspond pas mot pour mot à votre dictée : rien n'a été rangé.");
  const sortie: Matiere[] = [];
  for (const m of morceaux) {
    const r = await construire({ texte: m.texte, type: m.type, accord: m.accord, nomsSensibles: m.nomsSensibles, estDemo: options.estDemo }, options.rangePar === "machine" ? "proposee-machine" : "will");
    sortie.push(r.matiere);
  }
  await journaliser("matiere", `${sortie.length} matière(s) rangée(s) depuis une dictée`);
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Retouches d'un toucher                                              */
/* ------------------------------------------------------------------ */

async function obtenir(id: Id): Promise<Matiere> {
  const m = await depots().matieres.obtenir(id);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Cette matière n'existe plus.");
  return m;
}

/** Change le type (un toucher) : accord, péremption et preuve suivent le nouveau type. Le texte ne change jamais. */
export async function changerTypeMatiere(id: Id, type: TypeMatiere): Promise<Matiere> {
  await exigerSession();
  const m = await obtenir(id);
  if (m.type === type) return m;
  let preuveId = m.preuveId;
  let preuve: Preuve | null = preuveId ? await depots().preuves.obtenir(preuveId) : null;
  if (exigePreuve(type) && !preuve) {
    preuve = await preuvePour(m.texte, type, { texte: m.texte, accord: m.accord?.obtenu, nomsSensibles: m.nomsSensibles, estDemo: m.estDemo }, maintenant());
    preuveId = preuve.id;
  }
  return depots().matieres.modifier(id, {
    type,
    preuveId,
    accord: accordRequis(type) ? (m.accord ?? { requis: true, obtenu: false }) : undefined,
    croyanceAttribuee: type === "idee-recue" ? (m.croyanceAttribuee ?? true) : undefined,
    perimeLe: peremptionParDefaut({ matiere: type, preuveReliee: preuve ?? undefined }, m.source.date) ?? undefined,
  });
}

/** Interrupteur « J'ai son accord ». Sans accord, la matière n'est pas citée. */
export async function basculerAccordMatiere(id: Id, obtenu: boolean): Promise<Matiere> {
  await exigerSession();
  const m = await obtenir(id);
  const le = maintenant();
  const maj = await depots().matieres.modifier(id, { accord: { requis: accordRequis(m.type), obtenu, le: obtenu ? le : undefined, forme: obtenu ? (m.accord?.forme ?? "oral-note") : undefined } });
  if (m.preuveId) {
    const p = await depots().preuves.obtenir(m.preuveId);
    if (p?.client) await depots().preuves.modifier(p.id, { client: { ...p.client, accordEcrit: obtenu } });
  }
  return maj;
}

/** Confirme une matière « à confirmer » (proposée par la machine, ou qui ressemblait à une consigne). */
export async function confirmerMatiere(id: Id): Promise<Matiere> {
  await exigerSession();
  return depots().matieres.modifier(id, { statut: "validee" });
}

/** Noms à masquer (C59) : jamais envoyés à Claude ni affichés en public. */
export async function definirNomsSensibles(id: Id, noms: string[]): Promise<Matiere> {
  await exigerSession();
  const m = await obtenir(id);
  const propres = [...new Set(noms.map((n) => n.trim()).filter((n) => n && m.texte.includes(n)))];
  const maj = await depots().matieres.modifier(id, { nomsSensibles: propres.length ? propres : undefined });
  if (m.preuveId) {
    const p = await depots().preuves.obtenir(m.preuveId);
    if (p?.client) await depots().preuves.modifier(p.id, { client: { ...p.client, nomsSensibles: propres } });
  }
  return maj;
}

/** « Question reçue souvent » (n° 98) : seule condition pour dire « souvent ». */
export async function marquerFrequente(id: Id, frequente: boolean): Promise<Matiere> {
  await exigerSession();
  return depots().matieres.modifier(id, { frequente: frequente || undefined });
}

/* ------------------------------------------------------------------ */
/* Retrait (B.0 n° 56)                                                 */
/* ------------------------------------------------------------------ */

export type MotifRetrait = NonNullable<Matiere["retrait"]>["motif"];

export interface ImpactRetrait {
  versions: VersionTouchee[];
  aCompleter: number;
  aRevoir: number;
  programmees: number;
  publiees: number;
}

async function entreesRetrait() {
  const d = depots();
  const [maitres, scripts, variantes, videos, publications] = await Promise.all([d.scriptsMaitres.lister(), d.scripts.lister((s) => !!s.scriptMaitreId), d.variantes.lister(), d.videos.lister((v) => !!v.varianteId), d.publications.lister()]);
  return { maitres, scripts, variantes, videos, publications };
}

/** Versions qui utilisent une matière ou une preuve (lecture seule : pour la fiche « Que faire »). */
export async function listerVersionsTouchees(cible: CibleRetrait): Promise<ImpactRetrait> {
  await exigerSession();
  return resumer(versionsTouchees(cible, await entreesRetrait()));
}

function resumer(versions: VersionTouchee[]): ImpactRetrait {
  return {
    versions,
    aCompleter: versions.filter((v) => v.categorie === "a-completer").length,
    aRevoir: versions.filter((v) => v.categorie === "a-revoir").length,
    programmees: versions.filter((v) => v.categorie === "programmee").length,
    publiees: versions.filter((v) => v.categorie === "publiee").length,
  };
}

/**
 * Applique un retrait : non validées → « à compléter » ; validées non programmées → « Milieu modifié, à revoir ».
 * Programmées et publiées : leur état ne change pas (la publication existe) ; elles sont listées avec leur geste.
 */
export async function appliquerRetrait(cible: CibleRetrait): Promise<ImpactRetrait> {
  const d = depots();
  const versions = versionsTouchees(cible, await entreesRetrait());
  const sujets = new Set<Id>();
  for (const v of versions) {
    if (v.categorie === "a-completer") await d.variantes.modifier(v.varianteId, { etat: "a-completer" });
    else if (v.categorie === "a-revoir") await d.variantes.modifier(v.varianteId, { etat: "a-reverifier" });
    sujets.add(v.scriptMaitreId);
  }
  for (const s of sujets) await synchroniserSujet(s);
  return resumer(versions);
}

/** « Retirer » une matière (motif en un toucher). Rien n'est supprimé ; elle n'est plus jamais choisie (C57). */
export async function retirerMatiere(id: Id, motif: MotifRetrait, note?: string): Promise<ImpactRetrait> {
  await exigerSession();
  const m = await obtenir(id);
  if (!m.retrait) await depots().matieres.modifier(id, { retrait: { le: maintenant(), motif, note: note?.trim() || undefined } });
  const impact = await appliquerRetrait({ matiereIds: [id], preuveIds: [] });
  await journaliser("matiere", `Matière retirée (${LIBELLES_MOTIF_RETRAIT[motif]}) : ${impact.versions.length} version(s) concernée(s)`, { type: "matiere", id });
  return impact;
}

/**
 * « Déprogrammée » : Will l'a retirée de Buffer (un toucher par publication, jamais automatique). La publication repasse
 * en brouillon ; rien n'est effacé.
 */
export async function noterDeprogrammee(publicationId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const p = await d.publications.obtenir(publicationId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette publication n'existe plus.");
  if (p.statut !== "programmee") return;
  await d.publications.modifier(p.id, { statut: "brouillon", erreur: "Déprogrammée par Will (matière retirée)" });
  await journaliser("publication", "Publication déprogrammée (matière retirée)", { type: "video", id: p.videoId });
  if (p.varianteId) {
    const v = await d.variantes.obtenir(p.varianteId);
    if (v) await synchroniserSujet(v.scriptMaitreId);
  }
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export interface VueMatiere {
  matiere: Matiere;
  etat: EtatMatiere;
  utilisations: Utilisations;
}

/** Matières (retirées comprises, en fin), avec leur état et « A servi dans n° 42 : TikTok, LinkedIn » calculé. */
export async function listerMatieres(options: { type?: TypeMatiere; avecRetirees?: boolean } = {}): Promise<VueMatiere[]> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<Matiere>();
  const [matieres, maitres, scripts, variantes] = await Promise.all([
    d.matieres.lister((m) => exemples(m) && !m.archiveLe && !sujetReserveDe(m) && (!options.type || m.type === options.type) && (options.avecRetirees !== false || !m.retrait)),
    d.scriptsMaitres.lister(),
    d.scripts.lister((s) => !!s.scriptMaitreId),
    d.variantes.lister(),
  ]);
  const t = maintenant();
  return matieres
    .map((m) => ({ matiere: m, etat: etatMatiere(m, t), utilisations: utilisationsMatiere(m.id, { maitres, scripts, variantes }) }))
    .sort((a, b) => Number(a.etat.retiree) - Number(b.etat.retiree) || Number(b.etat.aConfirmer) - Number(a.etat.aConfirmer) || b.matiere.creeLe.localeCompare(a.matiere.creeLe));
}

/** Jauge : « De quoi faire ≈ N sujets variés · il manque surtout … ». */
export async function lireJauge(): Promise<Jauge> {
  await exigerSession();
  const exemples = await filtreExemples<Matiere>();
  return jaugeCarburant(await depots().matieres.lister((m) => exemples(m) && !sujetReserveDe(m)), maintenant());
}

/* ------------------------------------------------------------------ */
/* Rappel hebdomadaire facultatif                                      */
/* ------------------------------------------------------------------ */

const CLE_RAPPEL = "matieres.rappelHebdo";

/** Coupé par défaut. */
export async function lireRappelHebdo(): Promise<{ actif: boolean; dernier?: DateIso }> {
  await exigerSession();
  return lireParametre(CLE_RAPPEL, { actif: false });
}

export async function reglerRappelHebdo(actif: boolean): Promise<void> {
  await exigerSession();
  const avant = await lireParametre<{ actif: boolean; dernier?: DateIso }>(CLE_RAPPEL, { actif: false });
  await ecrireParametre(CLE_RAPPEL, { ...avant, actif });
}
