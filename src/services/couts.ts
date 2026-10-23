/** BUDGET ET COÛTS (AV2.2-9 ; tableau par outil, coût moyen, écart estimé / réel, alerte à 80 % : lot M1b B.9 ter). Montants en centimes. */
import "server-only";
import type { DepenseEnregistree, Id, LigneCout, Montant, Notification, Travail, Video } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { additionner, centimes, centimesAuSuperieur, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import type { VueBudget } from "./vues";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/* --- Heure de Paris (E2E-2 argent n° 16) ------------------------------ */

/** Jour AAAA-MM-JJ en heure de Paris (le serveur tourne en UTC : entre minuit et 2 h, l'UTC donne la veille). */
export function jourParis(date: Date | string = new Date()): string {
  return cleJour(date);
}

/** Mois AAAA-MM en heure de Paris : le budget du mois change à minuit À PARIS, pas à minuit UTC. */
export function moisParis(date: Date | string = new Date()): string {
  return cleJour(date).slice(0, 7);
}

/** Mois AAAA-MM décalé de `n` mois (n négatif : avant). PUR. */
export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/* --- Montants simulés (E2E-2 argent n° 6) ----------------------------- */

/**
 * Fournisseurs dont les montants sont SIMULÉS (rien n'est payé) : les étapes encore simulées d'un moteur (double,
 * habillage, export…). Ils restent visibles (marqués ESSAI) mais ne comptent jamais dans le budget du mois, le total
 * du jour ni le coût moyen d'une vidéo.
 */
const FOURNISSEURS_SIMULES = new Set(["simulation", "montage-avocat"]);

export function ligneSimulee(l: Pick<LigneCout, "fournisseur">): boolean {
  return FOURNISSEURS_SIMULES.has((l.fournisseur ?? "").trim().toLowerCase());
}

/**
 * Ce qui est VRAIMENT payé dans une dépense (lignes simulées retirées). Une dépense sans détail compte en entier.
 * L3-01 : chaque ligne au centime SUPÉRIEUR (une dépense ancienne écrite avec une fraction de centime) : la somme est entière.
 */
export function montantPaye(d: Pick<DepenseEnregistree, "lignes" | "total">): Montant {
  if (!d.lignes?.length) return centimes(centimesAuSuperieur(d.total.centimes));
  return additionner(...d.lignes.filter((l) => !ligneSimulee(l)).map((l) => centimes(centimesAuSuperieur(l.total.centimes))));
}

/**
 * Audit 4.5 : une dépense d'exemple (`estDemo`, semée au premier démarrage, sans travail) n'est jamais de l'argent
 * dépensé. Elle reste en base (rien n'est effacé) mais ne compte ni dans la jauge, ni dans « Par mois », « Par poste »,
 * « Par outil ». Une dépense écrite par une VRAIE fabrication (elle a son travail) compte toujours, même lancée sur
 * une vidéo d'exemple : de l'argent payé ne disparaît jamais du budget.
 */
export function depenseComptee(d: Pick<DepenseEnregistree, "estDemo" | "travailId">): boolean {
  return !d.estDemo || !!d.travailId;
}

/** La part simulée d'une dépense (affichée à part, marquée ESSAI). */
export function montantSimule(d: Pick<DepenseEnregistree, "lignes">): Montant {
  return additionner(...(d.lignes ?? []).filter((l) => ligneSimulee(l)).map((l) => l.total));
}

/* --- Budget engagé (E2E-2 argent n° 5) -------------------------------- */

/**
 * Une fabrication lancée ENGAGE son estimation sur le budget du mois jusqu'à sa fin (la dépense réelle n'est
 * enregistrée qu'à la fin) : deux lancements successifs ne peuvent plus dépasser le budget. Rangé dans les réglages
 * (`budget.engage.<travail>`) avec un index, écrit SOUS le verrou des crédits (`verifierEtReserver`).
 */
interface EngagementBudget {
  centimes: number;
  le: string;
  statut: "active" | "liberee" | "consommee";
  videoId?: Id;
}
const CLE_INDEX_ENGAGEMENTS = "budget.engages";
const cleEngagement = (travailId: Id) => `budget.engage.${travailId}`;
/** Un engagement dont le travail n'a jamais été enregistré (lancement interrompu) ne compte plus après ce délai. */
const ORPHELIN_MS = 15 * 60_000;

/** Engage `montant` pour ce travail (appelé sous le verrou des crédits, juste après le contrôle). */
export async function engagerBudget(travailId: Id, montant: Montant, videoId?: Id): Promise<void> {
  if (montant.centimes <= 0) return;
  const encore: Id[] = [];
  for (const id of await lireParametre<Id[]>(CLE_INDEX_ENGAGEMENTS, [])) {
    if (id !== travailId && (await engagementCompte(id)) > 0) encore.push(id);
  }
  // L1-09 : pire cas, au centime supérieur (jamais de fraction de centime dans la somme du mois).
  const e: EngagementBudget = { centimes: centimesAuSuperieur(montant.centimes), le: maintenant(), statut: "active", videoId };
  await ecrireParametre(cleEngagement(travailId), e);
  await ecrireParametre(CLE_INDEX_ENGAGEMENTS, [...encore, travailId]);
}

/** Fin de l'engagement (fin de fabrication : « consommee » ; échec, arrêt, lancement refusé : « liberee »). */
export async function libererEngagement(travailId: Id, issue: "consommee" | "liberee"): Promise<void> {
  const e = await lireParametre<EngagementBudget | null>(cleEngagement(travailId), null);
  if (!e || e.statut !== "active") return;
  await ecrireParametre(cleEngagement(travailId), { ...e, statut: issue });
}

/** « Réessayer » : l'engagement d'un travail relancé compte de nouveau. */
export async function reactiverEngagement(travailId: Id): Promise<void> {
  const e = await lireParametre<EngagementBudget | null>(cleEngagement(travailId), null);
  if (!e || e.statut !== "liberee") return;
  await ecrireParametre(cleEngagement(travailId), { ...e, statut: "active", le: maintenant() });
  const index = await lireParametre<Id[]>(CLE_INDEX_ENGAGEMENTS, []);
  if (!index.includes(travailId)) await ecrireParametre(CLE_INDEX_ENGAGEMENTS, [...index, travailId]);
}

/**
 * Lot d'images : l'engagement d'un lot (`lot:<id>`) n'a pas de travail ; il diminue de la part de chaque vidéo lancée
 * (qui engage ensuite la sienne) ou remonte quand un lancement est rendu. Plancher 0. Sous le verrou des crédits.
 */
export async function ajusterEngagement(travailId: Id, deltaCentimes: number): Promise<void> {
  const e = await lireParametre<EngagementBudget | null>(cleEngagement(travailId), null);
  if (!e || e.statut !== "active") return;
  await ecrireParametre(cleEngagement(travailId), { ...e, centimes: Math.max(0, Math.round(e.centimes + deltaCentimes)) });
  const index = await lireParametre<Id[]>(CLE_INDEX_ENGAGEMENTS, []);
  if (!index.includes(travailId)) await ecrireParametre(CLE_INDEX_ENGAGEMENTS, [...index, travailId]);
}

/** Montant encore engagé par ce travail (0 : rien, fini, ou travail terminé entre-temps). */
async function engagementCompte(travailId: Id): Promise<number> {
  const e = await lireParametre<EngagementBudget | null>(cleEngagement(travailId), null);
  if (!e || e.statut !== "active") return 0;
  // Un lot n'a pas de travail : il compte tant qu'il n'est pas libéré (fin ou arrêt du lot).
  if (travailId.startsWith("lot:")) return e.centimes;
  const t: Travail | null = await depots().travaux.obtenir(travailId);
  if (t) {
    if (t.statut !== "en_cours" && t.statut !== "en_file") return 0;
    // Vérif A2 (10/10) : ce que ce travail a DÉJÀ payé (voix HeyGen enregistrée dès son paiement, lecture interrompue)
    // est dans les dépenses du mois : il sort de l'engagement, sinon le budget restant le compte deux fois.
    const deja = (await depots().depenses.lister((d) => d.travailId === travailId && depenseComptee(d))).reduce((s, d) => s + montantPaye(d).centimes, 0);
    return Math.max(0, e.centimes - deja);
  }
  // Travail pas encore enregistré : lancement en cours (quelques instants), sinon lancement interrompu.
  return Date.now() - new Date(e.le).getTime() < ORPHELIN_MS ? e.centimes : 0;
}

/** L1-09 : ce que CE travail engage encore (un travail qui reprend ne compte pas deux fois son engagement). */
export async function engagementDuTravail(travailId: Id): Promise<number> {
  return engagementCompte(travailId);
}

/** Total engagé par les fabrications en cours (centimes d'euro). */
export async function budgetEngage(): Promise<number> {
  let total = 0;
  for (const id of await lireParametre<Id[]>(CLE_INDEX_ENGAGEMENTS, [])) total += await engagementCompte(id);
  return total;
}

/* --- Budget du mois --------------------------------------------------- */

/** Vue du budget, plus ce qui est engagé (fabrications en cours) et la part simulée (ESSAI, jamais comptée). */
export interface VueBudgetComplete extends VueBudget {
  /** Engagé par les fabrications en cours (déjà déduit de `restant`). */
  engage: Montant;
  /** Montants simulés du mois (affichés à part, marqués ESSAI ; jamais dans `depense`). */
  essai: Montant;
}

/** Budget du mois : restant = budget − dépensé (réellement payé) − engagé (fabrications en cours). Mois de Paris. */
export async function resumeBudget(): Promise<VueBudgetComplete> {
  const budget = await lireParametre<Montant>("budget.mensuel", centimes(15000));
  const seuilConfirmation = await lireParametre<Montant>("budget.seuilConfirmation", centimes(2000));
  const depenses = await depots().depenses.lister(depenseComptee);
  const moisCourant = moisParis();
  // Mois de chaque dépense calculé UNE fois (avant : 4 fois par dépense, à chaque affichage de l'accueil).
  const moisDe = new Map(depenses.map((d) => [d, moisParis(d.date)]));
  const duMois = depenses.filter((d) => moisDe.get(d) === moisCourant);
  const depense = additionner(...duMois.map(montantPaye));
  const engage = centimes(await budgetEngage());
  const parMois: VueBudget["parMois"] = [];
  for (let i = 2; i >= 0; i--) {
    const cle = decalerMois(moisCourant, -i);
    parMois.push({ mois: cle, libelle: MOIS[Number(cle.slice(5, 7)) - 1], total: additionner(...depenses.filter((d) => moisDe.get(d) === cle).map(montantPaye)) });
  }
  const postes = new Map<string, number>();
  for (const d of duMois) {
    for (const l of d.lignes ?? []) if (!ligneSimulee(l)) postes.set(l.etape, (postes.get(l.etape) ?? 0) + centimesAuSuperieur(l.total.centimes));
    if (!d.lignes?.length && d.total.centimes) postes.set("Autres", (postes.get("Autres") ?? 0) + centimesAuSuperieur(d.total.centimes));
  }
  return {
    budget,
    depense,
    engage,
    essai: additionner(...duMois.map(montantSimule)),
    restant: centimes(Math.max(0, budget.centimes - depense.centimes - engage.centimes)),
    pourcentage: budget.centimes ? Math.round((depense.centimes / budget.centimes) * 100) : 0,
    seuilConfirmation,
    parMois,
    parPoste: Array.from(postes, ([poste, c]) => ({ poste, total: centimes(c) })).sort((a, b) => b.total.centimes - a.total.centimes),
  };
}

/** Plafond du mois : réglé UNIQUEMENT ici, par Will connecté (L1-09). Centimes entiers ≥ 0, sinon refus (rien n'est écrit). */
export async function definirBudget(mensuelCentimes: number, seuilCentimes?: number): Promise<void> {
  await exigerSession();
  const entier = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (!entier(mensuelCentimes) || (seuilCentimes !== undefined && !entier(seuilCentimes))) {
    throw new ErreurStudio("CHAMP_INVALIDE", "Indiquez un montant entier en centimes, positif ou nul.");
  }
  await ecrireParametre("budget.mensuel", centimes(mensuelCentimes));
  if (seuilCentimes !== undefined) await ecrireParametre("budget.seuilConfirmation", centimes(seuilCentimes));
  await journaliser("budget", "Budget modifié");
}

/* --- Tableau des coûts (B.9 ter) ------------------------------------ */

/** Nom lisible d'un outil (`LigneCout.fournisseur`). */
const NOMS_OUTILS: Record<string, string> = {
  simulation: "Essais (rien n'est payé)",
  heygen: "HeyGen",
  elevenlabs: "ElevenLabs",
  fal: "fal.ai",
  "fal-ai": "fal.ai",
  anthropic: "Claude",
  pexels: "Pexels",
  pixabay: "Pixabay",
  "remotion-local": "Studio (montage)",
  "studio-rendu": "Studio (montage)",
  "remotion-lambda": "Montage en ligne",
  r2: "Stockage R2",
};

export function nomOutil(fournisseur: string): string {
  return NOMS_OUTILS[fournisseur] ?? (fournisseur ? fournisseur.charAt(0).toUpperCase() + fournisseur.slice(1) : "Autres");
}

export interface TableauCouts {
  /** Mois courant (« 2026-10 »). */
  mois: string;
  /** Dépenses du mois par outil, de la plus forte à la plus faible. */
  parOutil: { outil: string; nom: string; total: Montant }[];
  /** Vidéos terminées ce mois-ci. */
  nbVideos: number;
  /** Coût moyen d'une vidéo terminée ce mois-ci (null : aucune). */
  coutMoyen: Montant | null;
  /** Prix annoncé et prix réel des vidéos terminées ce mois-ci (null : rien à comparer). */
  ecart: { estime: Montant; reel: Montant; pourcentage: number } | null;
  /** Taux dollar → euro utilisé pour les tarifs en dollars. */
  tauxUsdEur: number;
}

/** Outil d'une ligne, regroupé (« fal » et « fal-ai » sont le même fal.ai ; E2E-2 argent n° 17 a). */
function outilDe(fournisseur: string): string {
  const id = (fournisseur ?? "").trim().toLowerCase().replace(/[\s.]+/g, "-");
  if (id === "fal-ai" || id === "fal") return "fal";
  if (id === "claude" || id === "anthropic") return "anthropic";
  return id;
}

/**
 * Calcul PUR du tableau (testé). E2E-2 argent n° 6 et n° 17 :
 *  - par outil : regroupé par outil (« fal » et « fal.ai » ensemble) ; la ligne « Essais (montants simulés) » reste à part ;
 *  - coût moyen : ce qui a VRAIMENT été payé pour chaque vidéo terminée (toutes ses dépenses, maquette comprise), jamais
 *    les montants simulés ; sans dépense rattachée, son `coutReel` ;
 *  - écart annoncé / réel : chose pour chose — l'estimation du DERNIER lancement face au coût de CE travail (relances
 *    comprises), pas au cumul des retouches et formats ajoutés.
 */
export function calculerTableauCouts(
  toutesDepenses: DepenseEnregistree[],
  toutesVideos: Pick<Video, "id" | "terminee" | "coutEstime" | "coutReel" | "estDemo">[],
  mois: string,
  tauxUsdEur: number,
  travaux: Pick<Travail, "id" | "cibleId" | "type" | "statut" | "creeLe">[] = [],
): TableauCouts {
  // Audit 4.5 : dépenses et vidéos d'exemple hors du calcul (gardées en base).
  const depenses = toutesDepenses.filter(depenseComptee);
  const videos = toutesVideos.filter((v) => !v.estDemo);
  const duMois = depenses.filter((d) => moisParis(d.date) === mois);
  const outils = new Map<string, number>();
  for (const l of duMois.flatMap((d) => d.lignes)) {
    const o = ligneSimulee(l) ? "simulation" : outilDe(l.fournisseur);
    outils.set(o, (outils.get(o) ?? 0) + l.total.centimes);
  }
  const terminees = videos.filter((v) => v.terminee && moisParis(v.terminee) === mois);
  const payeParVideo = new Map<string, number>();
  for (const d of depenses) if (d.videoId) payeParVideo.set(d.videoId, (payeParVideo.get(d.videoId) ?? 0) + montantPaye(d).centimes);
  const totalVideos = terminees.reduce((s, v) => s + (payeParVideo.get(v.id) ?? v.coutReel?.centimes ?? 0), 0);
  let estime = 0;
  let reel = 0;
  let comparables = 0;
  for (const v of terminees) {
    if (!v.coutEstime) continue;
    const dernier = travaux.filter((t) => t.cibleId === v.id && t.type === "fabrication" && t.statut === "termine").sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
    const duTravail = dernier ? depenses.filter((d) => d.travailId === dernier.id) : [];
    // Audit 4.2 : seul le PAYÉ se compare. Un travail dont une part du « réel » est simulée (estimation ± 10 %) ne
    // figure pas : ce réel-là serait inventé. Sans dépense rattachée (vidéo ancienne), son `coutReel`, s'il n'a
    // aucune dépense du tout.
    if (duTravail.some((d) => montantSimule(d).centimes > 0)) continue;
    const coutTravail = duTravail.length ? duTravail.reduce((s, d) => s + montantPaye(d).centimes, 0) : payeParVideo.has(v.id) ? undefined : v.coutReel?.centimes;
    if (coutTravail === undefined) continue;
    estime += v.coutEstime.centimes;
    reel += coutTravail;
    comparables++;
  }
  return {
    mois,
    parOutil: Array.from(outils, ([outil, c]) => ({ outil, nom: nomOutil(outil), total: centimes(c) })).sort((a, b) => b.total.centimes - a.total.centimes),
    nbVideos: terminees.length,
    coutMoyen: terminees.length ? centimes(totalVideos / terminees.length) : null,
    ecart: comparables && estime > 0 ? { estime: centimes(estime), reel: centimes(reel), pourcentage: Math.round(((reel - estime) / estime) * 100) } : null,
    tauxUsdEur,
  };
}

export async function tableauCouts(): Promise<TableauCouts> {
  const d = depots();
  return calculerTableauCouts(await d.depenses.lister(), await d.videos.lister(), moisParis(), await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT), await d.travaux.lister((t) => t.type === "fabrication"));
}

/** Taux dollar → euro (Réglages > Budget). Figé dans chaque commande au lancement. */
export async function definirTauxUsdEur(taux: number): Promise<void> {
  await exigerSession();
  if (!Number.isFinite(taux) || taux < 0.5 || taux > 2) throw new ErreurStudio("TAUX_INVALIDE", "Indiquez un taux entre 0,50 et 2,00.");
  await ecrireParametre("taux.usdEur", Math.round(taux * 10000) / 10000);
  await journaliser("budget", `Taux dollar → euro : ${taux.toFixed(4).replace(".", ",")}`);
}

type AlerteBudget = Omit<Notification, "id" | "creeLe" | "modifieLe" | "lue">;
const cleAlerteBudget = () => `budget.alerte.${moisParis()}`;

/**
 * Alerte « Budget à 80 % » : la notification à créer UNE fois par mois, quand la dépense franchit 80 % (le réglage
 * `budget.alerte.<mois>` retient qu'elle est partie). Lecture seule : aucune marque posée ici, aucun appel réseau.
 */
export async function alerteBudget(): Promise<AlerteBudget | null> {
  const b = await resumeBudget();
  if (b.pourcentage < 80) return null;
  if (await lireParametre<boolean>(cleAlerteBudget(), false)) return null;
  return { type: "budget", titre: b.pourcentage >= 100 ? "Budget du mois atteint" : `Budget du mois utilisé à ${b.pourcentage} %`, message: "Réglages > Budget pour le modifier.", lien: "/reglages#budget" };
}

/** Deux passages simultanés (deux dépenses finies ensemble) : une seule alerte part. */
const verrouAlerteBudget = creerVerrou();

/**
 * L3-01 : envoie l'alerte « budget à 80 % » si elle est due, PUIS pose la marque du mois. Un envoi en panne remonte sans
 * marque : l'alerte repart au passage suivant (avant, la marque était posée avant l'envoi et l'alerte se perdait).
 * Renvoie true si l'alerte est partie.
 */
export async function envoyerAlerteBudget(envoyer: (n: AlerteBudget) => Promise<unknown>): Promise<boolean> {
  return verrouAlerteBudget(async () => {
    const alerte = await alerteBudget();
    if (!alerte) return false;
    await envoyer(alerte);
    await ecrireParametre(cleAlerteBudget(), true);
    return true;
  });
}
