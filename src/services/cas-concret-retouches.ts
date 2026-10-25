/**
 * RETOUCHES PAR DISCUSSION DU « CAS CONCRET MD » (tâche P2S, lot A, point 2 ; d'après P2-09).
 *
 * Sur la fiche d'une vidéo faite, Will écrit « Que voulez-vous changer ? ». Le studio :
 *  1. traduit la phrase en opérations de la liste fermée de P2-02 (`montage-cas-concret/discussion.ts`) par UN appel
 *     Claude DÉTACHÉ : `proposerRetouche` et `suivreRetouche` ne l'attendent jamais ; le premier passage le lance, les
 *     suivants relisent sa réponse (journal des appels gardé avec la demande), un appel en cours n'est jamais doublé ;
 *  2. montre AVANT d'agir ce qui change (« Je change l'écran 3 : … »), ce qui est refait (« je refais la voix de la
 *     fin ») et le prix, calculés par l'aperçu du moteur (`estimerRetoucheCasConcret`, pur : seul ce qui change est
 *     refait) ;
 *  3. ne lance RIEN sans l'accord de Will : `confirmerRetouche` demande l'accord (règle commune du seuil de `lancerRetouche` : sous le
 *     seuil l'accord suffit, au-delà le montant est redemandé), puis passe par le chemin de retouche du studio (`lancerRetouche`, opérations transmises au moteur).
 * Une demande hors liste : le studio le dit et propose ce qui est possible, aucune opération n'est montrée.
 *
 * La demande en cours d'une vidéo est gardée dans les paramètres du studio (`casConcret.discussion.<vidéo>`) : aucune
 * collection nouvelle. Ce fichier ne publie rien.
 */
import "server-only";
import { createHash } from "node:crypto";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import type { Id, VersionVideo } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";
import { moteurDeCommande } from "@/moteurs";
import { casDesEntrees, estimerRetoucheCasConcret, ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret, servicesCasConcret } from "@/moteurs/montage-cas-concret";
import { ecritureDetachee, type AppelSuivi } from "@/moteurs/montage-cas-concret/appels";
import { ETAPE_DISCUSSION, operationsSimulees, PHRASE_DEMANDE_VIDE, phraseOperation, phraseRefaits, RETOUCHES_POSSIBLES, traduireDemande } from "@/moteurs/montage-cas-concret/discussion";
import { validerSchemaFiche } from "@/moteurs/montage-cas-concret/fiche";
import { lireOperationRetoucheCasConcret, type OperationRetoucheCasConcret } from "@/moteurs/montage-cas-concret/retouches";
import type { OperationMontage } from "@/moteurs/types";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { ecritureClaudeCasConcret, type DependancesBranchementsCasConcret } from "./cas-concret-branchements";
import { preparerReglagesMoteur, REGLAGES_CAS_CONCRET, reglageAllume } from "./cas-concret-reglages";
import { avecAccordAutomatique } from "./mode-budget";

export const PREFIXE_DISCUSSION = "casConcret.discussion.";
export const PHRASE_LECTURE = "Je lis votre demande…";
export const PHRASE_SANS_RETOUCHE = "Cette vidéo ne peut pas être retouchée pour l'instant.";
/** Réglage `casConcret.retouches` éteint (défaut) : aucune lecture, aucun appel, aucune retouche. */
export const PHRASE_RETOUCHES_ETEINTES = "La retouche par discussion n'est pas ouverte pour l'instant : pour ce changement, refaites la vidéo.";

/** « Déplacer une étape » reste au catalogue, mais la règle d'ordre du cas la refuse toujours : la phrase le dit clairement. */
export const PHRASE_DEPLACER_REFUSE = "Je ne peux pas déplacer une étape : les étapes se montrent dans l'ordre du cas. Je peux retirer une étape ou changer une phrase.";

/** Le refus de l'aperçu, en clair : « déplacer une étape » a sa phrase ; un identifiant d'écran (« e08 ») devient son numéro. */
function phraseRefus(refus: string | null, operations: readonly OperationRetoucheCasConcret[]): string {
  if (!refus) return PHRASE_SANS_RETOUCHE;
  if (operations.some((o) => o.type === "deplacer-etape") && refus.includes("ordre du fonctionnement")) return PHRASE_DEPLACER_REFUSE;
  return refus.replace(/\b[Éé]cran e(\d{2})\b/g, (_m, n: string) => `Écran ${Number(n)}`);
}

const retouchesAllumees = () => reglageAllume(REGLAGES_CAS_CONCRET.retouches);

/** Ce que la fiche montre de la demande en cours. */
export type EtatRetouche =
  | { statut: "aucune" }
  | { statut: "en-cours"; demande: string; phrase: string }
  | { statut: "refusee"; demande: string; phrase: string; possibles: string[] }
  | { statut: "proposee"; demande: string; changements: string[]; refaits: string; centimes: number; prix: string };

export type IssueRetouche = { statut: "lancee"; travailId: Id } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

export type DependancesRetouche = Pick<DependancesBranchementsCasConcret, "claudeActif" | "executer" | "verifierBudget" | "appels"> & {
  maintenant?: () => number;
  /** « Demander une modification » : la phrase de la demande que la confirmation vise (une autre demande est passée entre-temps : refus). */
  demande?: string;
  /** Le chemin de retouche du studio (défaut : `lancerRetouche`). */
  lancerRetouche?: (videoId: Id, planIds: Id[], consigne: string, options: { confirme?: AccordPrix; operations?: OperationMontage[] }) => Promise<{ travailId: Id }>;
};

/** La demande gardée : la phrase, la version visée, le journal de l'appel, puis les opérations ou le refus. */
interface DemandeGardee {
  demande: string;
  versionId: Id;
  cle: string;
  appels: Record<string, AppelSuivi>;
  operations?: OperationRetoucheCasConcret[];
  refus?: string;
  /** Demande oubliée (refus passager, « Laisser ») : seul le journal des appels est gardé, la fiche n'affiche plus rien. */
  oubliee?: true;
}

class Attente extends Error {}
class Expire extends Error {}

const cleParametre = (videoId: Id) => `${PREFIXE_DISCUSSION}${videoId}`;
const cleDemande = (demande: string, versionId: Id) => createHash("sha256").update(`${versionId}\n${demande}`).digest("hex").slice(0, 12);

const verrou = creerVerrou();

/** La version choisie d'une vidéo du format, terminée, avec sa fiche d'écrans ; sinon `null`. */
async function versionRetouchable(videoId: Id): Promise<VersionVideo | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!version || version.commande.moteurId !== ID_MOTEUR_CAS_CONCRET) return null;
  const fiche = (version.projetMontage?.casConcret as { fiche?: unknown } | undefined)?.fiche;
  return fiche !== undefined && validerSchemaFiche(fiche).ok ? version : null;
}

async function lireDemande(videoId: Id): Promise<DemandeGardee | null> {
  const v = await lireParametre<DemandeGardee | null>(cleParametre(videoId), null);
  return v && typeof v === "object" && typeof v.demande === "string" ? v : null;
}

/**
 * L'aperçu et le prix tels que le chemin d'argent les voit : mêmes outils que la réservation (cas, table des fins, mots
 * interdits, voix), et le prix est celui de `moteur.estimerRetouche`, appelé comme `lancerRetouche` l'appelle.
 */
async function apercuDe(operations: readonly OperationRetoucheCasConcret[], version: VersionVideo) {
  let outils = null;
  try {
    outils = (await servicesCasConcret().outils?.(version.commande, "estimation")) ?? null;
  } catch {
    outils = null;
  }
  const a = estimerRetoucheCasConcret(version.commande, operations, { projetMontage: version.projetMontage }, outils);
  if (!a.apercu?.ok) return { a, total: null };
  const { parentDeLaVersion } = await import("./fabrication");
  const reservation = await moteurDeCommande(version.commande).estimerRetouche(version.commande, [], { operations: operations as unknown as OperationMontage[], parent: await parentDeLaVersion(version) });
  return { a, total: reservation.total };
}

/** Ce que la fiche montre : l'aperçu du moteur (pur) sur les opérations gardées, ou la phrase du refus. */
async function etatDe(g: DemandeGardee, version: VersionVideo): Promise<EtatRetouche> {
  if (g.refus) return { statut: "refusee", demande: g.demande, phrase: g.refus, possibles: RETOUCHES_POSSIBLES };
  if (!g.operations) return { statut: "en-cours", demande: g.demande, phrase: PHRASE_LECTURE };
  const { a, total } = await apercuDe(g.operations, version);
  if (!a.apercu?.ok || !total) return { statut: "refusee", demande: g.demande, phrase: phraseRefus(a.refus, g.operations), possibles: RETOUCHES_POSSIBLES };
  const fiche = validerSchemaFiche((version.projetMontage?.casConcret as { fiche: unknown }).fiche);
  const avant = fiche.ok ? fiche.fiche : a.apercu.fiche;
  return {
    statut: "proposee",
    demande: g.demande,
    changements: g.operations.map((op) => phraseOperation(op, avant)),
    refaits: phraseRefaits(a.apercu),
    centimes: total.centimes,
    prix: `environ ${formaterMontant(total)}`,
  };
}

/**
 * Un refus qui peut passer (panne, délai, budget) : la phrase est montrée une fois, la demande est oubliée. Le journal des
 * appels est GARDÉ (l'appel y est déjà `clos`) : la même phrase lance la tentative suivante, sous une clé neuve, au lieu
 * de relire l'ancienne panne sous la même clé.
 */
async function refusPassager(videoId: Id, g: DemandeGardee, phrase: string): Promise<EtatRetouche> {
  await ecrireParametre(cleParametre(videoId), { demande: g.demande, versionId: g.versionId, cle: g.cle, appels: g.appels, oubliee: true } satisfies DemandeGardee);
  const demande = g.demande;
  return { statut: "refusee", demande, phrase, possibles: RETOUCHES_POSSIBLES };
}

/** Un pas : relit la réponse de l'appel (ou le lance), sans jamais l'attendre. */
async function avancer(videoId: Id, version: VersionVideo, depart: DemandeGardee, dep: DependancesRetouche): Promise<EtatRetouche> {
  let g = depart;
  if (g.operations || g.refus) return await etatDe(g, version);
  const garde = version.projetMontage?.casConcret as { fiche: unknown; mot?: string; motDit?: string; avecMot?: boolean };
  const fiche = validerSchemaFiche(garde.fiche);
  if (!fiche.ok) return { statut: "refusee", demande: g.demande, phrase: PHRASE_SANS_RETOUCHE, possibles: RETOUCHES_POSSIBLES };
  const e = lireEntreesCasConcret(version.commande.entrees);
  const reglages = { mot: garde.mot ?? e.mot ?? "", avecMot: typeof garde.avecMot === "boolean" ? garde.avecMot : e.avecMot };

  const journal: { appels?: Record<string, AppelSuivi> } = { appels: { ...g.appels } };
  const garder = async (champs: Partial<DemandeGardee>) => {
    g = { ...g, ...champs };
    await ecrireParametre(cleParametre(videoId), g);
  };
  const outils = ecritureDetachee(await ecritureClaudeCasConcret(videoId, () => ETAPE_DISCUSSION, dep), {
    journal,
    garder: () => garder({ appels: journal.appels ?? {} }),
    horloge: dep.maintenant ?? Date.now,
    libelle: "La retouche",
    attente: () => new Attente(),
    expire: (phrase) => new Expire(phrase),
  });
  try {
    // P2C : les faits du cas, pour que le code trouve seul la barre d'un chiffre à changer.
    const faits = casDesEntrees(e)?.faits;
    const r = await traduireDemande({ demande: g.demande, fiche: fiche.fiche, reglages, videoId, cle: g.cle, ...(faits ? { faits } : {}) }, outils);
    // Une panne d'appel ou un budget atteint passent : la demande n'est pas gardée, la même phrase repart d'un nouvel appel.
    if (!r.ok && (r.motif === "appel" || r.motif === "budget")) return await refusPassager(videoId, { ...g, appels: journal.appels ?? g.appels }, r.message);
    await garder(r.ok ? { operations: r.operations } : { refus: r.message });
    return await etatDe(g, version);
  } catch (err) {
    if (err instanceof Attente) return { statut: "en-cours", demande: g.demande, phrase: PHRASE_LECTURE };
    if (err instanceof Expire) {
      return await refusPassager(videoId, { ...g, appels: journal.appels ?? g.appels }, "Je n'ai pas pu lire votre demande. Réessayez dans un instant.");
    }
    throw err;
  }
}

/** « Que voulez-vous changer ? » : la demande est gardée et l'appel part, détaché. Rien n'est lancé sur la vidéo. */
export async function proposerRetouche(videoId: Id, demande: string, dep: DependancesRetouche = {}): Promise<EtatRetouche> {
  await exigerSession();
  const texte = demande.trim();
  if (!(await retouchesAllumees())) return { statut: "refusee", demande: texte, phrase: PHRASE_RETOUCHES_ETEINTES, possibles: [] };
  return verrou(async () => {
    const version = await versionRetouchable(videoId);
    if (!version) throw new ErreurStudio("RETOUCHE_INDISPONIBLE", PHRASE_SANS_RETOUCHE);
    if (!texte) return { statut: "refusee", demande: "", phrase: PHRASE_DEMANDE_VIDE, possibles: RETOUCHES_POSSIBLES };
    const cle = cleDemande(texte, version.id);
    const deja = await lireDemande(videoId);
    // La même demande sur la même version : reprise telle quelle (jamais un second appel).
    const reprise = deja && deja.cle === cle ? { ...deja, oubliee: undefined } : null;
    const g: DemandeGardee = reprise ?? { demande: texte, versionId: version.id, cle, appels: {} };
    if (g !== deja) await ecrireParametre(cleParametre(videoId), g);
    return avancer(videoId, version, g, dep);
  });
}

/** La fiche relit la demande en cours (l'appel n'est jamais attendu). */
export async function suivreRetouche(videoId: Id, dep: DependancesRetouche = {}): Promise<EtatRetouche> {
  await exigerSession();
  if (!(await retouchesAllumees())) return { statut: "aucune" };
  return verrou(async () => {
    const g = await lireDemande(videoId);
    const version = await versionRetouchable(videoId);
    if (!g || !version || g.oubliee || g.versionId !== version.id) return { statut: "aucune" };
    return avancer(videoId, version, g, dep);
  });
}

/** « Annuler » : la demande est oubliée, rien n'a été lancé. `demande` : seule cette demande est oubliée (une autre, plus récente, reste). */
export async function abandonnerRetouche(videoId: Id, demande?: string): Promise<void> {
  await exigerSession();
  await verrou(async () => {
    if (demande !== undefined && (await lireDemande(videoId))?.demande !== demande.trim()) return;
    // Le journal des appels reste : la même phrase relit la réponse déjà payée au lieu de relancer un appel.
    const g = await lireDemande(videoId);
    await ecrireParametre(cleParametre(videoId), g ? ({ demande: g.demande, versionId: g.versionId, cle: g.cle, appels: g.appels, oubliee: true } satisfies DemandeGardee) : null);
  });
}

/**
 * « Confirmer » : l'aperçu est recalculé ; sans un accord (voir `lancerRetouche`), rien ne part ; un montant trop bas redemande.
 * Sinon, le chemin de retouche du studio, avec les opérations ; la demande est oubliée.
 */
export async function confirmerRetouche(videoId: Id, accordCentimes: unknown, dep: DependancesRetouche = {}): Promise<IssueRetouche> {
  // Règle « le prix ne bloque jamais » : en mode indicatif, un accord-requis est relancé UNE fois avec le prix du jour ;
  // bloquant (et Usine) : l'issue d'avant, telle quelle.
  return avecAccordAutomatique((accord) => confirmerRetoucheSansAuto(videoId, accord ?? accordCentimes, dep), undefined, { videoId });
}

async function confirmerRetoucheSansAuto(videoId: Id, accordCentimes: unknown, dep: DependancesRetouche): Promise<IssueRetouche> {
  await exigerSession();
  if (!(await retouchesAllumees())) return { statut: "refusee", phrase: PHRASE_RETOUCHES_ETEINTES };
  return verrou(async () => {
    const g = await lireDemande(videoId);
    const version = await versionRetouchable(videoId);
    if (!g || !version || g.versionId !== version.id || !g.operations || (dep.demande !== undefined && dep.demande.trim() !== g.demande)) return { statut: "refusee", phrase: "Cette retouche n'est plus d'actualité : écrivez-la de nouveau." };
    const etat = await etatDe(g, version);
    if (etat.statut !== "proposee") return { statut: "refusee", phrase: etat.statut === "refusee" ? etat.phrase : PHRASE_SANS_RETOUCHE };
    // Un montant au moins égal au prix passe tel quel ; un montant trop bas redemande. `true` et `false` passent aussi tels
    // quels : la règle commune du seuil est appliquée par `lancerRetouche` (sous le seuil l'accord suffit, au-delà il redemande
    // le montant). Une valeur illisible vaut `false`, jamais un accord.
    const accord = accordPropre(accordCentimes);
    if (typeof accord === "number" && accord < etat.centimes) return { statut: "accord-requis", centimes: etat.centimes, phrase: `Cette retouche coûte ${etat.prix}. Confirmez ce prix pour continuer.` };
    // Les opérations relues une dernière fois : seule la liste fermée part.
    const operations = g.operations.map(lireOperationRetoucheCasConcret).filter((o): o is OperationRetoucheCasConcret => !!o);
    await preparerReglagesMoteur(version.commande);
    const lancer = dep.lancerRetouche ?? (await import("./fabrication")).lancerRetouche;
    try {
      const r = await lancer(videoId, [], g.demande, { confirme: accord, operations: operations as unknown as OperationMontage[] });
      await ecrireParametre(cleParametre(videoId), null);
      return { statut: "lancee", travailId: r.travailId };
    } catch (err) {
      // Le budget demande un autre montant (réservation au pire) : Will le confirme de nouveau.
      if (err instanceof ErreurStudio && err.code === "CONFIRMATION_REQUISE" && typeof err.montant === "number") return { statut: "accord-requis", centimes: err.montant, phrase: err.message };
      if (err instanceof ErreurStudio) return { statut: "refusee", phrase: err.message };
      throw err;
    }
  });
}

/** Tournures proposées en exemples : chacune est gardée seulement si l'aperçu l'accepte sur CETTE vidéo. */
const EXEMPLES_CANDIDATS = ["Faites-la sans le mot.", "Retirez l'étape 2.", "Retirez l'étape 3."];

/**
 * Exemples cliquables de « Demander une modification » pour une vidéo du format : ceux que la vidéo permet vraiment
 * (aucun mot branché : pas de « sans le mot »). Lecture seule, aucun appel. Réglage éteint ou vidéo illisible : aucun.
 */
export async function exemplesRetouche(videoId: Id): Promise<string[]> {
  await exigerSession();
  if (!(await retouchesAllumees())) return [];
  const version = await versionRetouchable(videoId);
  if (!version) return [];
  const fiche = validerSchemaFiche((version.projetMontage?.casConcret as { fiche: unknown }).fiche);
  if (!fiche.ok) return [];
  const ecrans = fiche.fiche.ecrans.map((e) => ({ id: e.id, type: e.type, texteDit: e.texteDit }));
  const gardes: string[] = [];
  for (const texte of EXEMPLES_CANDIDATS) {
    const operations = operationsSimulees(texte, ecrans).operations;
    if (operations.length > 0 && (await apercuDe(operations, version)).total) gardes.push(texte);
  }
  return gardes;
}
