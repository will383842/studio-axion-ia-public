/**
 * PRONONCIATIONS (brique commune, `PRONONCIATIONS-SYSTEME.md`) — service du lot A1 (`docs/BRANCHEMENTS-EXECUTION.md`).
 * Les règles sont PURES dans `domaine/prononciations.ts` ; ici : lecture et écriture de la liste, écoute avant / après
 * par la voix par défaut, ajout en lot, détection dans un script, contrôle d'une vidéo, usage dans les vidéos.
 * Rien n'est jamais supprimé : une entrée retirée est rangée ; une entrée modifiée est rangée et remplacée (l'ancienne
 * prononciation reste dans « Archivés »).
 */
import "server-only";
import {
  cleMot,
  compterUtilisations,
  contientMot,
  detecterMotsARisque,
  lireListeCollee,
  prononciationsActives,
  prononciationsAjouteesDepuis,
  textesAvantApres,
  type LigneCollee,
  type MotARisque,
  type PrononciationAjouteeDepuis,
} from "@/domaine/prononciations";
import type { Id, Montant, Prononciation, SourcePrononciation, Voix } from "@/domaine/types";
import { resoudreFournisseur } from "@/fournisseurs";
import { urlEcoute } from "@/fournisseurs/heygen/ecoute";
import { nouvelId } from "@/lib/ids";
import { centimes } from "@/lib/montants";
import { depots, ErreurStudio, horodatage, journaliser, maintenant, ressourceActive } from "./_commun";
import { exigerSession } from "./auth";
import type { OrigineLancement } from "./budget-mensuel";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { trouverMoi } from "./moi";

const estRange = (e: { archiveLe?: string }) => !!e.archiveLe;

export async function listerPrononciations(options: { ranges?: boolean } = {}): Promise<Prononciation[]> {
  return (await depots().prononciations.lister((p) => estRange(p) === !!options.ranges)).sort((a, b) => a.mot.localeCompare(b.mot, "fr"));
}

export interface OptionsPrononciation {
  ecriture?: string;
  portee?: Prononciation["portee"];
  source?: SourcePrononciation;
  note?: string;
  /** Écoutée et validée au moment de l'ajout (« Écouter » puis « Ajouter » dans la feuille). */
  ecoutee?: boolean;
}

const memePortee = (a?: Prononciation["portee"], b?: Prononciation["portee"]) => (a?.voixId ?? "") === (b?.voixId ?? "") && (a?.personnageId ?? "") === (b?.personnageId ?? "");

function nettoyer(mot: string, prononciation: string, options: OptionsPrononciation) {
  const m = mot.trim().slice(0, 60);
  const p = prononciation.trim().slice(0, 120);
  if (!m || !p) throw new ErreurStudio("VIDE", "Indiquez le mot et sa prononciation.");
  const ecriture = options.ecriture?.trim().slice(0, 60);
  const portee = options.portee?.voixId || options.portee?.personnageId ? { voixId: options.portee.voixId || undefined, personnageId: options.portee.personnageId || undefined } : undefined;
  return { mot: m, prononciation: p, ecriture: ecriture && ecriture !== m ? ecriture : undefined, portee };
}

/** Ajoute un mot. Un mot déjà présent (même portée, variantes comprises) est refusé : on le modifie à la place. */
export async function ajouterPrononciation(mot: string, prononciation: string, options: OptionsPrononciation = {}): Promise<Id> {
  await exigerSession();
  const n = nettoyer(mot, prononciation, options);
  const d = depots();
  const doublon = await d.prononciations.trouver((p) => !p.archiveLe && cleMot(p.mot) === cleMot(n.mot) && memePortee(p.portee, n.portee));
  if (doublon) throw new ErreurStudio("DOUBLON", `« ${doublon.mot} » est déjà dans la liste (« ${doublon.prononciation} »).`);
  const p: Prononciation = {
    id: nouvelId("pr"),
    ...n,
    note: options.note?.trim().slice(0, 200) || undefined,
    source: options.source ?? "manuel",
    ecouteeLe: options.ecoutee ? maintenant() : undefined,
    ...horodatage(),
  };
  await d.prononciations.enregistrer(p);
  await journaliser("prononciation", `Prononciation ajoutée : « ${p.mot} » se dit « ${p.prononciation} »`, { type: "prononciation", id: p.id });
  return p.id;
}

/**
 * Modifie une entrée : l'ancienne est RANGÉE (jamais effacée) et une nouvelle prend sa place, avec la même origine.
 * Sans changement de ce que dit la voix, la mention « écoutée » et la note se posent sur place.
 */
export async function modifierPrononciation(id: Id, donnees: { mot: string; prononciation: string } & OptionsPrononciation): Promise<Id> {
  await exigerSession();
  const d = depots();
  const avant = await d.prononciations.obtenir(id);
  if (!avant) throw new ErreurStudio("INTROUVABLE", "Cette prononciation n'existe plus.");
  const n = nettoyer(donnees.mot, donnees.prononciation, { ...donnees, portee: donnees.portee ?? avant.portee });
  const inchange = n.mot === avant.mot && n.prononciation === avant.prononciation && (n.ecriture ?? "") === (avant.ecriture ?? "") && memePortee(n.portee, avant.portee);
  if (inchange) {
    const patch: Partial<Prononciation> = {};
    if (donnees.ecoutee && !avant.ecouteeLe) patch.ecouteeLe = maintenant();
    if (donnees.note !== undefined) patch.note = donnees.note.trim().slice(0, 200) || undefined;
    if (Object.keys(patch).length) await d.prononciations.modifier(id, patch);
    return id;
  }
  const doublon = await d.prononciations.trouver((p) => p.id !== id && !p.archiveLe && cleMot(p.mot) === cleMot(n.mot) && memePortee(p.portee, n.portee));
  if (doublon) throw new ErreurStudio("DOUBLON", `« ${doublon.mot} » est déjà dans la liste.`);
  await d.prononciations.modifier(id, { archiveLe: maintenant() });
  const p: Prononciation = {
    id: nouvelId("pr"),
    ...n,
    note: (donnees.note ?? avant.note)?.trim().slice(0, 200) || undefined,
    source: avant.source,
    ecouteeLe: donnees.ecoutee ? maintenant() : undefined,
    ...horodatage(),
  };
  await d.prononciations.enregistrer(p);
  await journaliser("prononciation", `Prononciation modifiée : « ${p.mot} » se dit « ${p.prononciation} » (l'ancienne est archivée)`, { type: "prononciation", id: p.id });
  return p.id;
}

/** Will l'a écoutée et la garde (liste de départ « à valider à l'écoute »). */
export async function validerEcoute(id: Id): Promise<void> {
  await exigerSession();
  await depots().prononciations.modifier(id, { ecouteeLe: maintenant() });
}

/** Range une prononciation : la voix ne l'applique plus, mais elle n'est jamais effacée. */
export async function rangerPrononciation(id: Id): Promise<void> {
  await exigerSession();
  await depots().prononciations.modifier(id, { archiveLe: new Date().toISOString() });
}

/** Remet une prononciation rangée (refusé si le même mot est déjà actif : on ne crée jamais de doublon). */
export async function remettrePrononciation(id: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const p = await d.prononciations.obtenir(id);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette prononciation n'existe plus.");
  const actif = await d.prononciations.trouver((x) => x.id !== id && !x.archiveLe && cleMot(x.mot) === cleMot(p.mot) && memePortee(x.portee, p.portee));
  if (actif) throw new ErreurStudio("DOUBLON", `« ${actif.mot} » est déjà dans la liste (« ${actif.prononciation} ») : archivez-le d'abord.`);
  await d.prononciations.modifier(id, { archiveLe: undefined });
}

/* --- n° 4 : ajout en lot ------------------------------------------------ */

/** Aperçu d'une liste collée (rien n'est enregistré). */
export async function apercuListeCollee(texte: string): Promise<LigneCollee[]> {
  return lireListeCollee(texte.slice(0, 20_000), await depots().prononciations.lister((p) => !p.archiveLe));
}

/** Enregistre les lignes nouvelles d'une liste collée ; les doublons et lignes illisibles sont seulement comptés. */
export async function ajouterListeCollee(texte: string): Promise<{ ajoutes: number; ignores: number }> {
  await exigerSession();
  const lignes = await apercuListeCollee(texte);
  let ajoutes = 0;
  for (const l of lignes.filter((x) => x.etat === "nouveau").slice(0, 300)) {
    await depots().prononciations.enregistrer({
      id: nouvelId("pr"),
      mot: l.mot,
      prononciation: l.prononciation,
      ecriture: l.ecriture && l.ecriture !== l.mot ? l.ecriture : undefined,
      source: "lot",
      ...horodatage(),
    });
    ajoutes++;
  }
  if (ajoutes) await journaliser("prononciation", `${ajoutes} prononciation${ajoutes > 1 ? "s" : ""} ajoutée${ajoutes > 1 ? "s" : ""} par une liste collée`);
  return { ajoutes, ignores: lignes.length - ajoutes };
}

/* --- n° 5 : usage dans les vidéos -------------------------------------- */

/** Texte de la version choisie de chaque vidéo non archivée. */
async function textesDesVideos(): Promise<string[]> {
  const d = depots();
  const videos = await d.videos.lister((v) => v.statut !== "archivee" && !!v.versionChoisieId);
  const versions = await Promise.all(videos.map((v) => d.versions.obtenir(v.versionChoisieId!)));
  return versions.flatMap((ver) => (ver?.commande.script.texteComplet ? [ver.commande.script.texteComplet] : []));
}

/** La liste (active ou rangée) avec « utilisé dans N vidéos » recalculé. */
export async function listerPrononciationsAvecUsage(options: { ranges?: boolean } = {}): Promise<Prononciation[]> {
  const [liste, textes] = await Promise.all([listerPrononciations(options), textesDesVideos()]);
  return liste.map((p) => ({ ...p, utilisations: compterUtilisations(p, textes) }));
}

/* --- n° 2 : détection dans un script ----------------------------------- */

export async function detecterDansScript(texte: string): Promise<MotARisque[]> {
  return detecterMotsARisque(texte.slice(0, 20_000), await depots().prononciations.lister());
}

/* --- n° 1 : écoute avant / après --------------------------------------- */

export interface Ecoute {
  url: string;
  /** Clé du son lu (pour le faire dire au double, « Tester » un visage). */
  fichierCle?: string;
  dureeSec: number;
  cout: Montant;
  simulee: boolean;
  /** Nom de la voix qui a lu. */
  voix: string;
}

/** Voix par défaut de Will (personnage « moi ») : sa voix par défaut, sinon une voix réelle prête, sinon la première prête. */
export async function voixParDefaut(): Promise<Voix | null> {
  const d = depots();
  const moi = await trouverMoi();
  const pretes = await d.voix.lister((v) => v.statut === "pret");
  if (moi) {
    const siennes = pretes.filter((v) => v.personnageId === moi.id);
    const choisie = siennes.find((v) => v.id === moi.voixParDefautId) ?? siennes.find((v) => v.fournisseur !== "simulation") ?? siennes[0];
    if (choisie) return choisie;
  }
  return pretes[0] ?? null;
}

/** Fait lire une phrase courte par une voix (par défaut celle de Will) ; la dépense réelle est enregistrée. Jamais de vidéo. */
export async function lirePhrase(texte: string, options: { voixId?: Id; prononciations?: { mot: string; prononciation: string }[]; etape?: string; confirme?: AccordPrix; origine?: OrigineLancement } = {}): Promise<Ecoute> {
  const d = depots();
  const voix = options.voixId ? await d.voix.obtenir(options.voixId) : await voixParDefaut();
  const f = resoudreFournisseur("voix", voix?.fournisseur);
  const ressource = voix ? await ressourceActive(voix.id) : null;
  const t = texte.slice(0, 400);
  const etape = options.etape ?? "Écoute";
  const lire = async () => {
    const r = await f.lire({ idExterne: ressource?.idExterne ?? "", texte: t, reglages: voix?.reglages ?? { vitesse: 1, stabilite: 60, emotion: 50 }, prononciations: options.prononciations ?? [] });
    if (f.mode === "reel" && r.cout.centimes > 0) {
      const ligne = { etape, fournisseur: f.id, unite: "caractere" as const, quantite: t.length, prixUnitaire: f.capacites.tarif?.prixUnitaire ?? r.cout, total: r.cout, nature: "reel" as const };
      await d.depenses.enregistrer({ id: nouvelId("dep"), lignes: [ligne], total: r.cout, date: maintenant(), ...horodatage() });
    }
    return r;
  };
  // E2E-2 argent n° 14 : une voix payante passe par le même contrôle que le reste (budget du mois, crédit) AVANT l'appel.
  // L3-01 : contrôle, réservation ET engagement sous le verrou des crédits, avec l'origine, le temps de la lecture.
  let r: Awaited<ReturnType<typeof lire>>;
  if (f.mode === "reel") {
    const prixUnitaire = f.capacites.tarif?.prixUnitaire ?? centimes(0);
    const total = centimes(prixUnitaire.centimes * t.length);
    const { depenserSelonOrigine } = await import("./credits");
    // CORRECTEUR 1 — B6 : la confirmation (au-delà du seuil) vient de l'appelant, jamais écrite en dur.
    r = await depenserSelonOrigine(options.origine, { lignes: [{ etape, fournisseur: f.id, unite: "caractere", quantite: t.length, prixUnitaire, total, nature: "estime" }], total }, accordPropre(options.confirme), "Cette écoute", { travailId: nouvelId("ecoute") }, lire);
  } else r = await lire();
  return { url: urlEcoute(r.fichierCle), fichierCle: r.fichierCle, dureeSec: r.dureeSec, cout: r.cout, simulee: f.mode === "simulation", voix: voix?.nom ?? "Voix d'essai" };
}

/**
 * Écoute d'un mot dans la phrase type (« Chez Teleos, nous… »), AVANT (comme la voix le dit aujourd'hui, les autres
 * prononciations appliquées) ou APRÈS (avec la prononciation saisie).
 */
export async function ecouterPrononciation(mot: string, prononciation: string, moment: "avant" | "apres", options: { voixId?: Id } = {}): Promise<Ecoute> {
  await exigerSession();
  if (!mot.trim()) throw new ErreurStudio("VIDE", "Indiquez le mot.");
  if (moment === "apres" && !prononciation.trim()) throw new ErreurStudio("VIDE", "Indiquez comment le dire.");
  const d = depots();
  const voix = options.voixId ? await d.voix.obtenir(options.voixId) : await voixParDefaut();
  const autres = prononciationsActives(await d.prononciations.lister(), { voixId: voix?.id, personnageId: voix?.personnageId }).filter((p) => cleMot(p.mot) !== cleMot(mot) && !contientMot(mot, p.mot));
  const { avant, apres } = textesAvantApres(mot.trim().slice(0, 60), prononciation.trim().slice(0, 120));
  return lirePhrase(moment === "avant" ? avant : apres, { voixId: voix?.id, prononciations: autres, etape: "Écoute d'une prononciation" });
}

/* --- n° 9 : contrôle d'une vidéo --------------------------------------- */

/** Prononciations ajoutées (ou changées) après la fabrication de la version choisie, pour des mots qu'elle contient. */
export async function prononciationsAjouteesDepuisVideo(videoId: Id): Promise<PrononciationAjouteeDepuis[]> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!version || version.statut !== "prete") return [];
  const c = version.commande;
  const distribution = c.distribution[0];
  // E2E-2 parcours n° 6 : une prise filmée par Will (« je lis ») n'a aucune voix de synthèse : rien à refaire.
  if (distribution?.source === "rush" || c.prises?.length) return [];
  const liste = await d.prononciations.lister();
  // Vidéo du générateur : les prononciations sont appliquées DANS le texte dit (`texteDitParSegment`) et la liste de
  // la commande est vide. Celles qui étaient en place à la fabrication (créées avant, pas encore rangées) y étaient.
  const appliquees = c.texteDitParSegment && !c.prononciations.length ? prononciationsActives(liste.filter((p) => p.creeLe <= c.construiteLe && (!p.archiveLe || p.archiveLe > c.construiteLe)).map((p) => ({ ...p, archiveLe: undefined })), { voixId: distribution?.voixId, personnageId: distribution?.personnageId }) : c.prononciations;
  return prononciationsAjouteesDepuis({ texte: c.script.texteComplet, prononciations: appliquees }, liste, { voixId: distribution?.voixId, personnageId: distribution?.personnageId });
}

/* --- Portée : voix proposées dans la feuille d'ajout ------------------- */

/** Voix prêtes (avec le nom de leur personnage), pour « réservé à une voix ». */
export async function voixPourPortee(): Promise<{ id: Id; nom: string; personnageId: Id; personnage: string }[]> {
  const d = depots();
  const [voix, personnages] = await Promise.all([d.voix.lister((v) => v.statut === "pret"), d.personnages.lister()]);
  const noms = new Map(personnages.map((p) => [p.id, p.nom]));
  return voix.map((v) => ({ id: v.id, nom: v.nom, personnageId: v.personnageId, personnage: noms.get(v.personnageId) ?? "" }));
}
