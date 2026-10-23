/**
 * COMITÉ ÉDITORIAL DES IDÉES (lot « Idées : comité éditorial », 17/10). Serveur seulement. LIVRÉ ÉTEINT : réglage
 * `idees.comite` (faux par défaut) ; éteint, rien ne part, rien n'est tiré.
 *
 * Travail de fond (`travaillerComite`, tâche annexe de la boucle, une seule à la fois, hors du tour) :
 *  1. un lot ENVOYÉ est relu au plus toutes les 5 min ; FINI, ses résultats sont lus (par `custom_id`, dans n'importe
 *     quel ordre), CONTRÔLÉS (`controlerJugements` : rien d'inventé) et rangés dans `ideesJugees` ; la dépense RÉELLE
 *     (jetons × tarif × 50 %) est enregistrée et la réservation « consommée ». Résultats partiels : ce qui a réussi est
 *     rangé, le reste (erreur, expiré, annulé : non facturé) est simplement perdu, et ses idées pourront revenir ;
 *  2. sans lot en cours, UNE fois par jour au plus, s'il reste moins de 10 idées « garder » non utilisées : 30
 *     combinaisons sont demandées à l'Usine (`SourceIdees`), et partent en UN lot de 3 requêtes (10 idées chacune).
 * Repli : `jugerALaDemande` (réserve vide seulement), appel normal au prix plein, prix montré avant (`prixJugementDirect`).
 *
 * ARGENT, avant tout envoi, d'un seul tenant sous le VERROU DU MOIS (le même que l'écriture des sujets) :
 *  a. plafond des IDÉES du mois (`idees.plafondMoisUsd`, 5 $ par défaut) : dépensé ce mois par le comité + réservé +
 *     pire cas × 1,2 > plafond → rien ne part ;
 *  b. limite Claude DU MOIS (`claude.plafondMensuelUsd`) ;
 *  c. pré-vol de la brique Crédits (budget du studio, solde Claude suivi, seuil de confirmation) ;
 *  d. réservation du PIRE CAS (`reserverCredits`, un `travailId` par lot). Pire cas d'un lot = pire cas exact de chaque
 *     requête (`pireCasRequete` : socle écrit en cache 1 h, sortie = `maxTokens`) × 50 % (tarif des lots).
 *  c et d passent par `verifierEtReserverSelonOrigine` (contrôle, réservation et engagement sous le verrou des crédits).
 * PORTE DE COMMANDE (L3-01) : le comité est HORS PORTE au lot 3. Il n'est lancé que par la tâche de fond du studio
 * (`boucle.ts`) et par le geste de Will (`jugerALaDemande`) ; aucune route `/api/usine/*` ne le déclenche. Si une commande
 * de l'Usine le déclenche un jour, elle passe `origine: "usine"` (`travaillerComite`, `jugerALaDemande`) : l'origine suit
 * jusqu'à `reserverPourUsine` (budget du mois de l'Usine exigé, refus avant tout appel).
 * Envoi INCERTAIN (réseau, délai, erreur 5xx, réponse illisible) : le lot a pu être créé sans qu'on le sache. La
 * réservation est GARDÉE, le lot noté « incertain » (aucun nouvel envoi) et recherché dans la liste des lots récents
 * (même nombre de requêtes, créé autour de l'envoi, puis `custom_id` vérifiés sur ses résultats). Retrouvé : suivi comme
 * les autres. Introuvable après 1 h : son pire cas est compté en dépense ESTIMÉE et la réservation consommée (jamais
 * repayé, jamais rendu à tort). Refus net (4xx) : réservation rendue.
 * Un lot ENVOYÉ est suivi jusqu'à sa fin même si le comité est éteint ou Claude retiré entre-temps (la lecture est
 * gratuite) : seuls les NOUVEAUX envois en dépendent.
 * Jamais de lot payant sur la source SIMULÉE (aucune vraie idée) : le branchement réel est fait par l'autre lot.
 */
import "server-only";
import { depenseDuFournisseur, eurVersUsd } from "@/domaine/credits";
import type { DepenseEnregistree, IdeeJugee, LigneCout } from "@/domaine/types";
import { ErreurClaude, type OptionsClient } from "@/fournisseurs/claude/client";
import { lireSortie } from "@/fournisseurs/claude/inscription";
import { creerLot, listerLots, lireLot, lireResultatsLot, REMISE_LOT, type DemandeLot, type EtatLot, type ResultatLot } from "@/fournisseurs/claude/lots";
import { masquerSecretsClaude } from "@/fournisseurs/claude/secret";
import { controlerJugements, IDEES_PAR_REQUETE, roleComite, texteIdee, variableComite, type IdeeAJuger, type JugementControle, type SortieComite } from "@/generateur/roles/comite";
import { construireRequete, pireCasRequete, type EntreeRole } from "@/generateur/roles/types";
import { cleJour, cleMois, JOUR_MS } from "@/lib/dates";
import { nouvelId } from "@/lib/ids";
import { centimes, centimesDuPlafond, formaterMontant, usdVersEur } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, horodatage, journaliser, lireParametre, maintenant } from "./_commun";
import { libererReservation, MARGE_CREDITS, verifierEtReserverSelonOrigine } from "./credits";
import { signalerDepassementIndicatif } from "./budget-mensuel";
import { budgetIndicatifPour, FACTEUR_SECURITE_BUDGET } from "./mode-budget";
import type { OrigineLancement } from "./budget-mensuel";
import { appelerAvecRotation, claudeActif, cleClaudeDuStudio, coutReelUsd, engageClaudeDuMoisCentimes, envClaude, fetchClaudeEssai, ligne, messageSansCompte, peutEcrire, plafondMensuelClaudeUsd, sousVerrouMois, taux } from "./generation-claude";
import { marquerEpuisee } from "./source-claude";
import type { SourceClaude } from "@/domaine/source-claude";
import { sourceIdees, type CombinaisonUsine } from "./source-idees";

/** Réglage : le comité est-il allumé ? (Faux par défaut : livré éteint.) */
export const PARAM_COMITE = "idees.comite";
/** Plafond Claude du comité, par mois, en dollars. */
export const PARAM_PLAFOND_IDEES = "idees.plafondMoisUsd";
export const PLAFOND_IDEES_MOIS_USD = 5;
/** Lot envoyé et pas encore rangé (un seul à la fois). */
export const PARAM_LOT_EN_COURS = "idees.comite.lot";
/** Date du dernier envoi (une fois par jour au plus). */
export const PARAM_DERNIER_ENVOI = "idees.comite.dernierEnvoi";

/** En dessous de ce nombre d'idées « garder » non utilisées, un nouveau lot part (une fois par jour au plus). */
export const SEUIL_RESERVE = 10;
/** Une idée jugée plus vieille que ce nombre de jours (à l'heure de Paris) n'est plus montrée ni réutilisée. */
export const AGE_MAX_IDEE_JUGEE_JOURS = 7;
/** Combinaisons demandées à l'Usine par lot. */
export const COMBINAISONS_PAR_LOT = 30;
/** Idées jugées par le repli « à la demande ». */
export const IDEES_A_LA_DEMANDE = 20;
/** Un lot en cours est relu au plus toutes les 5 minutes. */
export const INTERVALLE_LECTURE_MS = 5 * 60_000;
/** Lot à la création incertaine, toujours introuvable dans la liste après ce délai : son pire cas est compté. */
export const DELAI_RECHERCHE_LOT_MS = 60 * 60_000;
/** Fenêtre autour de l'envoi où un lot de la liste peut être le nôtre. */
const FENETRE_AVANT_MS = 5 * 60_000;
const FENETRE_APRES_MS = 30 * 60_000;

/** Étapes des dépenses du comité (préfixe commun : son plafond les retrouve). */
export const PREFIXE_ETAPE_IDEES = "Idées · comité éditorial";
const ETAPE_LOT = `${PREFIXE_ETAPE_IDEES} (lot groupé)`;
const ETAPE_DIRECT = `${PREFIXE_ETAPE_IDEES} (à la demande)`;
const ETAPE_LOT_PERDU = `${PREFIXE_ETAPE_IDEES} (lot sans nouvelles, estimation)`;
/** Préfixe des réservations du comité. */
export const PREFIXE_APPEL_IDEES = "idees";

/** Une requête du lot : son identifiant, son modèle et les idées qu'elle juge (pour lier les résultats). */
interface RequeteEnvoyee {
  idPerso: string;
  modele: string;
  idees: (IdeeAJuger & { signature: string; parts?: Record<string, string | null> })[];
}

/** Lot en cours (réglage `idees.comite.lot`). */
export interface LotEnCours {
  /** Vide tant que le lot est `incertain`. */
  lotId: string;
  /** Création sans réponse sûre : le lot a pu être créé ; on le cherche (réservation gardée). */
  incertain?: true;
  /** Instant de l'envoi (ISO), pour retrouver un lot incertain. */
  envoiInstant?: string;
  /** Lots de la liste vérifiés : pas les nôtres. */
  ecartes?: string[];
  appelId: string;
  envoyeLe: string;
  pireUsd: number;
  requetes: RequeteEnvoyee[];
  derniereLecture?: string;
  /** Compte Claude qui a reçu le lot (absent : compte 1). Le suivi relit le lot avec CE compte, même désactivé ou épuisé. */
  source?: SourceClaude;
}

export type IssueComite =
  | { etat: "eteint" | "claude-inactif" | "source-simulee" | "reserve-suffisante" | "deja-aujourd-hui" | "attente" | "rien-a-juger" }
  | { etat: "envoye"; lotId: string; idees: number; pireUsd: number }
  | { etat: "range"; lotId: string; gardes: number; refuses: string[]; coutUsd: number }
  | { etat: "arrete"; message: string };

/* ------------------------------------------------------------------ */
/* Réglages et lecture                                                 */
/* ------------------------------------------------------------------ */

export async function comiteAllume(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_COMITE, false)) === true;
}

export async function plafondIdeesMoisUsd(): Promise<number> {
  const v = await lireParametre<number>(PARAM_PLAFOND_IDEES, PLAFOND_IDEES_MOIS_USD);
  return Number.isFinite(v) && v >= 0 ? v : PLAFOND_IDEES_MOIS_USD;
}

/** Âge en jours pleins d'une date, comptés en journées de Paris (minuit à minuit, pas en tranches de 24 h). PUR. */
export function ageEnJoursParis(date: string, maintenantIso: string): number {
  const jour = (iso: string) => Date.parse(`${cleJour(iso)}T00:00:00Z`);
  return Math.round((jour(maintenantIso) - jour(date)) / JOUR_MS);
}

/** L'idée jugée est-elle encore assez fraîche pour être montrée ou reprise ? PUR. */
export function ideeJugeeFraiche(date: string, maintenantIso: string, ageMaxJours = AGE_MAX_IDEE_JUGEE_JOURS): boolean {
  return ageEnJoursParis(date, maintenantIso) <= ageMaxJours;
}

/** Idées jugées, les meilleures d'abord. Par défaut : toutes, sauf les utilisées et les trop vieilles. */
export async function listerIdeesJugees(options: { verdict?: IdeeJugee["verdict"]; inclureUtilisees?: boolean } = {}): Promise<IdeeJugee[]> {
  const ce = maintenant();
  const liste = await depots().ideesJugees.lister((i) => (!options.verdict || i.verdict === options.verdict) && (options.inclureUtilisees || !i.utiliseeLe) && ideeJugeeFraiche(i.date, ce));
  return liste.sort((a, b) => b.total - a.total || b.date.localeCompare(a.date));
}

/** Idées « garder » réelles (non simulées) et non utilisées : la réserve. */
export async function tailleReserve(): Promise<number> {
  const ce = maintenant();
  return depots().ideesJugees.compter((i) => i.verdict === "garder" && !i.utiliseeLe && !i.simule && ideeJugeeFraiche(i.date, ce));
}

/** Une idée reprise pour écrire une vidéo sort de la réserve. */
export async function marquerIdeeUtilisee(id: string): Promise<void> {
  await depots().ideesJugees.modifier(id, { utiliseeLe: maintenant() });
}

/** Engagé ce mois par le comité (dépenses de ses étapes + ses réservations actives), centimes de dollar. */
export async function engageIdeesDuMoisCentimes(): Promise<number> {
  const d = depots();
  const mois = cleMois();
  const t = await taux();
  const depenses = await d.depenses.lister((x) => cleMois(x.date) === mois && x.lignes.some((l) => l.etape.startsWith(PREFIXE_ETAPE_IDEES)));
  // Réel, plus l'estimation des lots restés sans nouvelles (peut-être facturés) : jamais sous-estimé.
  const estimee = depenses.flatMap((x) => x.lignes).filter((l) => l.nature === "estime" && l.etape.startsWith(PREFIXE_ETAPE_IDEES)).reduce((s, l) => s + eurVersUsd(l.total.centimes, t), 0);
  const depense = Math.ceil(depenseDuFournisseur(depenses, "anthropic", t) + estimee - 1e-9);
  const reserve = (await d.reservations.lister((r) => r.statut === "active" && r.fournisseur === "anthropic" && !!r.travailId?.startsWith(`${PREFIXE_APPEL_IDEES}-`))).reduce((s, r) => s + r.centimes, 0);
  return depense + reserve;
}

/* ------------------------------------------------------------------ */
/* Préparation des requêtes                                            */
/* ------------------------------------------------------------------ */

/** Le socle CANONIQUE de Will (charte, style, preuves ; cache 1 h), sans rien du format. */
async function socleCanonique(): Promise<EntreeRole["contexte"]> {
  const { blocsSocleWill } = await import("./socle-will");
  const { contexteAxion, styleWill, preuves } = await blocsSocleWill({ modelesDeTon: [], cadreFormat: "" });
  return { contexteAxion, styleWill, preuves };
}

/** Découpe les combinaisons en requêtes de 10 idées (identifiants courts, lisibles par le comité). */
function preparer(combinaisons: CombinaisonUsine[], prefixe: string, contexte: EntreeRole["contexte"]): { requete: RequeteEnvoyee; entree: EntreeRole }[] {
  const sorties: { requete: RequeteEnvoyee; entree: EntreeRole }[] = [];
  for (let i = 0; i < combinaisons.length; i += IDEES_PAR_REQUETE) {
    const n = sorties.length + 1;
    const idees = combinaisons.slice(i, i + IDEES_PAR_REQUETE).map((c, k) => ({ id: `i${n}-${k + 1}`, signature: c.signature, parts: c.parts, textes: c.textes }));
    sorties.push({ requete: { idPerso: `${prefixe}-r${n}`, modele: roleComite.modele, idees }, entree: { contexte, variable: variableComite(idees) } });
  }
  return sorties;
}

/** Combinaisons neuves : jamais jugées (signature), sans doublon. */
async function combinaisonsNeuves(n: number): Promise<{ combinaisons: CombinaisonUsine[]; simulee: boolean }> {
  const source = sourceIdees();
  const deja = new Set((await depots().ideesJugees.lister()).map((i) => i.signature));
  const vues = new Set<string>();
  const combinaisons = (await source.tirer(n)).filter((c) => {
    if (!c.signature || deja.has(c.signature) || vues.has(c.signature) || !texteIdee(c.textes).trim()) return false;
    vues.add(c.signature);
    return true;
  });
  return { combinaisons: combinaisons.slice(0, n), simulee: source.simulee };
}

/** Pire cas (dollars) de requêtes du comité ; lot groupé : × 50 %. */
export function pireCasComiteUsd(entrees: EntreeRole[], lot: boolean): number {
  return entrees.reduce((s, e) => s + pireCasRequete(roleComite, e), 0) * (lot ? REMISE_LOT : 1);
}

/* ------------------------------------------------------------------ */
/* Argent : plafond des idées, limite du mois, pré-vol, réservation     */
/* ------------------------------------------------------------------ */

/**
 * Contrôles et réservation du pire cas, d'un seul tenant sous le verrou du mois. `null` : réservé ; sinon le motif de
 * l'arrêt (rien n'est parti, rien n'est payé).
 */
async function reserverPourComite(appelId: string, etape: string, pireUsd: number, accord: number | false, origine?: OrigineLancement): Promise<string | null> {
  const t = await taux();
  const lignes: LigneCout[] = [ligne(etape, pireUsd, t, "estime")];
  const demande = Math.ceil(pireUsd * 100 * (1 + MARGE_CREDITS));
  // Mode indicatif (commande de Will, jamais l'Usine) : le plafond des idées et la limite Claude du mois sont des repères (alerte, rien n'est refusé).
  const indicatif = await budgetIndicatifPour(origine);
  // Les alertes du mode indicatif partent APRÈS le verrou du mois (pas d'écriture de notification sous verrou).
  const alertes: [string, string, string][] = [];
  const resultat = await sousVerrouMois(async () => {
    const plafondIdees = await plafondIdeesMoisUsd();
    if ((await engageIdeesDuMoisCentimes()) + demande > centimesDuPlafond(plafondIdees)) {
      const enEuros = formaterMontant(centimes(centimesDuPlafond(plafondIdees * t)));
      if (!indicatif) {
        await journaliser("generateur", `Comité éditorial : plafond des idées du mois atteint (${enEuros}), rien n'est parti`);
        return `Plafond des idées du mois atteint (${enEuros}) : rien n'a été payé.`;
      }
      // Arrêt de sécurité : même en indicatif, jamais au-delà de 5 × le repère des idées du mois.
      if ((await engageIdeesDuMoisCentimes()) + demande > centimesDuPlafond(plafondIdees) * FACTEUR_SECURITE_BUDGET) {
        await journaliser("generateur", `Comité éditorial : arrêt de sécurité (5 fois le repère des idées du mois, ${enEuros}), rien n'est parti`);
        return `Arrêt de sécurité : le jugement d'idées dépasserait ${FACTEUR_SECURITE_BUDGET} fois le repère des idées du mois (${enEuros}), rien n'a été payé.`;
      }
      alertes.push(["idees-mois", "Repère des idées du mois dépassé", `Le jugement d'idées continue (repère du mois ${enEuros}) ; rien n'est arrêté. Réglages pour l'ajuster.`]);
    }
    const plafondMois = await plafondMensuelClaudeUsd();
    const engage = await engageClaudeDuMoisCentimes();
    if (engage.depense + engage.reserve + demande > centimesDuPlafond(plafondMois)) {
      if (!indicatif) {
        await journaliser("generateur", "Comité éditorial : limite Claude du mois atteinte, rien n'est parti");
        return "Limite Claude du mois atteinte : rien n'a été payé.";
      }
      alertes.push(["claude-mois", "Repère Claude du mois dépassé", "Rien n'est arrêté : le jugement d'idées continue. Seul un crédit Claude épuisé l'arrête."]);
    }
    try {
      // Contrôle, réservation ET engagement sur le budget du mois, d'un seul tenant (libérés par `libererReservation`).
      await verifierEtReserverSelonOrigine(origine, { lignes, total: lignes[0]!.total }, accord, "Ce jugement d'idées", { travailId: appelId });
    } catch (e) {
      // L3-0 : jugement commandé par l'Usine sans budget reçu (ou budget atteint) : refus net, rien n'est payé.
      if (e instanceof ErreurStudio && (e.code === "BUDGET_USINE_ABSENT" || e.code === "BUDGET_MENSUEL_ATTEINT")) {
        await journaliser("generateur", "Comité éditorial : budget de l'Usine absent ou atteint, rien n'est parti");
        return e.message;
      }
      if (e instanceof ErreurStudio && (e.code === "CREDIT_INSUFFISANT" || e.code === "BUDGET_DEPASSE" || e.code === "CONFIRMATION_REQUISE")) {
        const phrase = e.code === "CREDIT_INSUFFISANT" ? "Crédit Claude insuffisant." : e.code === "BUDGET_DEPASSE" ? "Budget du mois atteint." : e.message;
        await journaliser("generateur", `Comité éditorial : ${e.code === "CONFIRMATION_REQUISE" ? "prix à confirmer" : phrase}, rien n'est parti`);
        return phrase;
      }
      throw e;
    }
    return null;
  });
  for (const [motif, titre, message] of alertes) await signalerDepassementIndicatif(motif, titre, message);
  return resultat;
}

async function enregistrerDepense(appelId: string, etape: string, usd: number, nature: LigneCout["nature"], source?: SourceClaude): Promise<DepenseEnregistree> {
  const lignes = [ligne(etape, usd, await taux(), nature)];
  const depense: DepenseEnregistree = { id: nouvelId("dep"), travailId: appelId, lignes, total: lignes[0]!.total, date: maintenant(), ...(source ? { sourceClaude: source } : {}), ...horodatage() };
  return depots().depenses.enregistrer(depense);
}

/* ------------------------------------------------------------------ */
/* Rangement                                                           */
/* ------------------------------------------------------------------ */

/** Range les jugements contrôlés d'une requête. Renvoie le nombre rangé et les refus du contrôle. */
async function ranger(requete: RequeteEnvoyee, sortie: SortieComite, o: { source: IdeeJugee["source"]; lotId?: string; simule?: boolean }): Promise<{ ranges: number; refuses: string[] }> {
  const { gardes, refuses } = controlerJugements(requete.idees, sortie);
  const d = depots();
  const date = maintenant();
  let ranges = 0;
  for (const j of gardes as JugementControle[]) {
    const idee = requete.idees.find((i) => i.id === j.id)!;
    if (await d.ideesJugees.trouver((x) => x.signature === idee.signature)) continue;
    ranges++;
    await d.ideesJugees.enregistrer({
      id: nouvelId("ij"),
      signature: idee.signature,
      idee: texteIdee(idee.textes),
      textes: idee.textes,
      ...(idee.parts ? { parts: idee.parts } : {}),
      notes: j.notes,
      total: j.total,
      verdict: j.verdict,
      raison: j.raison,
      angle: j.angle,
      date,
      source: o.source,
      ...(o.lotId ? { lotId: o.lotId } : {}),
      ...(o.simule ? { simule: true } : {}),
      ...horodatage(),
    });
  }
  return { ranges, refuses };
}

/* ------------------------------------------------------------------ */
/* Lot groupé                                                          */
/* ------------------------------------------------------------------ */

/** Options du client pour un NOUVEL envoi : `null` Claude absent ; `"epuises"` tous les comptes posés sont épuisés (attente). */
async function optionsClient(): Promise<(OptionsClient & { source: SourceClaude }) | "epuises" | null> {
  const actif = await claudeActif("script");
  if (!actif) return null;
  if (!peutEcrire(actif)) return "epuises";
  const f = fetchClaudeEssai();
  return { cle: actif.cle, source: actif.source, ...(f ? { fetch: f } : {}) };
}

/** Envoie un lot de 30 idées (contrôles d'argent d'abord). `origine` : d'où vient la commande (L3-01). */
async function envoyerLot(o: OptionsClient & { source: SourceClaude }, instant: number, origine?: OrigineLancement): Promise<IssueComite> {
  const { combinaisons, simulee } = await combinaisonsNeuves(COMBINAISONS_PAR_LOT);
  if (simulee) return { etat: "source-simulee" };
  if (!combinaisons.length) return { etat: "rien-a-juger" };
  const appelId = nouvelId(PREFIXE_APPEL_IDEES);
  const prepares = preparer(combinaisons, appelId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48), await socleCanonique());
  const pireUsd = pireCasComiteUsd(prepares.map((p) => p.entree), true);
  // L'envoi du jour est noté AVANT l'appel : un échec ne relance pas un lot toutes les 5 s.
  await ecrireParametre(PARAM_DERNIER_ENVOI, new Date(instant).toISOString());
  const arret = await reserverPourComite(appelId, ETAPE_LOT, pireUsd, false, origine);
  if (arret) return { etat: "arrete", message: arret };
  const demandes: DemandeLot[] = prepares.map((p) => ({ idPerso: p.requete.idPerso, requete: construireRequete(roleComite, p.entree) }));
  let etat: EtatLot;
  try {
    etat = await creerLot(demandes, o);
  } catch (e) {
    const err = e instanceof ErreurClaude ? e : null;
    const message = masquerSecretsClaude(err?.message ?? (e instanceof Error ? e.message : "Erreur inconnue."), [o.cle], envClaude());
    console.warn(`[studio] comité éditorial : lot non créé : ${err?.code ?? "erreur"} — ${message}`);
    const incertain = !err || err.code === "reseau" || err.code === "delai" || err.code === "illisible" || (err.code === "surcharge" && (err.statut ?? 0) >= 500);
    if (!incertain) {
      // Refus net (4xx) : rien n'a été créé, rien n'est payé.
      await libererReservation(appelId, "liberee");
      // Compte épuisé (refus de facturation avant tout flux) : marqué, SANS renvoi immédiat (le prochain passage prend le suivant).
      if (err?.code === "facturation" && err.horsFlux && err.statut !== 429 && (err.statut ?? 0) < 500 && o.source !== "api") {
        await marquerEpuisee(o.source).catch((x: unknown) => {
          // La marque d'épuisement est facultative : sa panne ne change pas l'issue du lot. Texte masqué, jamais la clé.
          console.warn(`[studio] comité éditorial : marque d'épuisement non écrite : ${masquerSecretsClaude(x instanceof Error ? x.message : "erreur inconnue", [o.cle], envClaude())}`);
        });
      }
      await journaliser("generateur", "Comité éditorial : Claude refuse le lot, rien n'est payé");
      return { etat: "arrete", message: "Claude refuse le lot : rien n'a été payé." };
    }
    // Incertain : le lot a pu être créé. Réservation GARDÉE ; on le cherchera dans la liste des lots.
    const perdu: LotEnCours = { lotId: "", incertain: true, envoiInstant: new Date(instant).toISOString(), appelId, envoyeLe: maintenant(), pireUsd, requetes: prepares.map((p) => p.requete), derniereLecture: new Date(instant).toISOString(), source: o.source };
    await ecrireParametre(PARAM_LOT_EN_COURS, perdu);
    await journaliser("generateur", "Comité éditorial : envoi du lot incertain, réservation gardée, lot recherché");
    return { etat: "arrete", message: "Envoi du lot incertain : son prix au plus reste réservé, le lot est recherché." };
  }
  const lot: LotEnCours = { lotId: etat.id, appelId, envoyeLe: maintenant(), pireUsd, requetes: prepares.map((p) => p.requete), derniereLecture: new Date(instant).toISOString(), source: o.source };
  await ecrireParametre(PARAM_LOT_EN_COURS, lot);
  await journaliser("generateur", `Comité éditorial : ${combinaisons.length} idées envoyées en lot groupé (moitié prix)`);
  return { etat: "envoye", lotId: etat.id, idees: combinaisons.length, pireUsd };
}

/**
 * Lot à la création incertaine : cherché dans la liste des lots récents (même nombre de requêtes, créé autour de
 * l'envoi) ; un candidat fini est le nôtre si ses résultats portent nos `custom_id`. Rien de payant ne part.
 */
async function retrouverLot(lot: LotEnCours, o: OptionsClient, instant: number): Promise<IssueComite> {
  const attendre = async (maj: Partial<LotEnCours> = {}): Promise<IssueComite> => {
    await ecrireParametre(PARAM_LOT_EN_COURS, { ...lot, ...maj, derniereLecture: new Date(instant).toISOString() } satisfies LotEnCours);
    return { etat: "attente" };
  };
  let liste: EtatLot[];
  try {
    liste = await listerLots(o);
  } catch {
    return attendre();
  }
  const envoi = Date.parse(lot.envoiInstant ?? lot.envoyeLe);
  const ecartes = [...(lot.ecartes ?? [])];
  const total = (l: EtatLot) => l.compteurs.enCours + l.compteurs.reussis + l.compteurs.enErreur + l.compteurs.annules + l.compteurs.expires;
  const candidats = liste.filter((l) => {
    const cree = l.creeLe ? Date.parse(l.creeLe) : NaN;
    return !ecartes.includes(l.id) && total(l) === lot.requetes.length && cree >= envoi - FENETRE_AVANT_MS && cree <= envoi + FENETRE_APRES_MS;
  });
  const parId = new Map(lot.requetes.map((r) => [r.idPerso, { modele: r.modele, json: true as const }]));
  let enCours = false;
  for (const c of candidats) {
    if (c.statut !== "ended") {
      enCours = true;
      continue;
    }
    let resultats: ResultatLot[];
    try {
      resultats = await lireResultatsLot(c, parId, o);
    } catch {
      return attendre({ ecartes });
    }
    // `lireResultatsJsonl` ne garde que nos `custom_id` : un résultat suffit à reconnaître le lot.
    if (!resultats.length) {
      ecartes.push(c.id);
      continue;
    }
    const retrouve: LotEnCours = { ...lot, lotId: c.id, ecartes };
    delete retrouve.incertain;
    delete retrouve.derniereLecture;
    await ecrireParametre(PARAM_LOT_EN_COURS, retrouve);
    await journaliser("generateur", "Comité éditorial : lot à l'envoi incertain retrouvé chez Claude");
    return suivreLot(retrouve, o, instant);
  }
  if (enCours || instant - envoi < DELAI_RECHERCHE_LOT_MS) return attendre({ ecartes });
  // Introuvable : peut-être facturé quand même (autre espace de travail…). Son pire cas est compté, jamais rendu.
  await enregistrerDepense(lot.appelId, ETAPE_LOT_PERDU, lot.pireUsd, "estime", lot.source);
  await libererReservation(lot.appelId, "consommee");
  await ecrireParametre(PARAM_LOT_EN_COURS, null);
  await journaliser("generateur", "Comité éditorial : lot à l'envoi incertain introuvable, son prix au plus reste compté");
  return { etat: "arrete", message: "Lot introuvable après un envoi incertain : son prix au plus reste compté." };
}

/** Relit le lot en cours ; fini, range ses résultats et enregistre la dépense réelle. */
async function suivreLot(lot: LotEnCours, o: OptionsClient, instant: number): Promise<IssueComite> {
  if (lot.derniereLecture && instant - Date.parse(lot.derniereLecture) < INTERVALLE_LECTURE_MS) return { etat: "attente" };
  if (lot.incertain) return retrouverLot(lot, o, instant);
  let etat: EtatLot;
  try {
    etat = await lireLot(lot.lotId, o);
  } catch (e) {
    const err = e instanceof ErreurClaude ? e : null;
    await ecrireParametre(PARAM_LOT_EN_COURS, { ...lot, derniereLecture: new Date(instant).toISOString() } satisfies LotEnCours);
    if (err?.code === "requete" || err?.code === "modele-introuvable") {
      // Lot inconnu de Claude (404) : rien n'a été traité, rien n'est facturé.
      await libererReservation(lot.appelId, "liberee");
      await ecrireParametre(PARAM_LOT_EN_COURS, null);
      await journaliser("generateur", "Comité éditorial : lot introuvable chez Claude, abandonné (rien n'est payé)");
      return { etat: "arrete", message: "Lot introuvable chez Claude : abandonné." };
    }
    return { etat: "attente" };
  }
  if (etat.statut !== "ended") {
    await ecrireParametre(PARAM_LOT_EN_COURS, { ...lot, derniereLecture: new Date(instant).toISOString() } satisfies LotEnCours);
    return { etat: "attente" };
  }
  const parId = new Map(lot.requetes.map((r) => [r.idPerso, { modele: r.modele, json: true as const }]));
  let resultats: ResultatLot[];
  try {
    resultats = await lireResultatsLot(etat, parId, o);
  } catch {
    await ecrireParametre(PARAM_LOT_EN_COURS, { ...lot, derniereLecture: new Date(instant).toISOString() } satisfies LotEnCours);
    return { etat: "attente" };
  }
  let cout = 0;
  let gardes = 0;
  const refuses: string[] = [];
  for (const r of resultats) {
    const requete = lot.requetes.find((x) => x.idPerso === r.idPerso);
    if (!requete) continue;
    if (r.type !== "succeeded") {
      if (r.type === "errored") refuses.push(`${r.idPerso} : ${r.erreur.code}`);
      else refuses.push(`${r.idPerso} : ${r.type === "expired" ? "expirée" : "annulée"}`);
      continue;
    }
    // Facturée même si la sortie est illisible : coût réel × 50 % (tarif des lots).
    cout += coutReelUsd(r.reponse) * REMISE_LOT;
    const lue = lireSortie(roleComite, r.reponse);
    if (!lue.donnees) {
      refuses.push(`${r.idPerso} : ${lue.invalide ?? lue.marqueur ?? "sortie illisible"}`);
      continue;
    }
    const rangement = await ranger(requete, lue.donnees, { source: "lot", lotId: lot.lotId });
    gardes += rangement.ranges;
    refuses.push(...rangement.refuses);
  }
  if (cout > 0) await enregistrerDepense(lot.appelId, ETAPE_LOT, cout, "reel", lot.source);
  await libererReservation(lot.appelId, "consommee");
  await ecrireParametre(PARAM_LOT_EN_COURS, null);
  if (refuses.length) console.info(`[studio] comité éditorial : écartés au contrôle : ${refuses.join(" · ")}`);
  await journaliser("generateur", `Comité éditorial : ${gardes} idées jugées rangées${refuses.length ? `, ${refuses.length} écartées au contrôle` : ""}`);
  return { etat: "range", lotId: lot.lotId, gardes, refuses, coutUsd: cout };
}

/**
 * Le travail de fond (tâche annexe de la boucle). `instant` : injection pour les essais. Ne lève jamais pour une cause
 * attendue (éteint, plafond, Claude absent) : renvoie l'issue. Un lot DÉJÀ envoyé est suivi jusqu'à sa fin, même
 * comité éteint ou Claude retiré (lecture gratuite, rien de payant ne part) ; seuls les nouveaux envois en dépendent.
 * L3-01 : `origine` suit le nouvel envoi jusqu'à la garde d'argent (« usine » → `reserverPourUsine`, budget de l'Usine
 * exigé) ; absente, la tâche de fond du studio (défaut, inchangé). Le suivi d'un lot déjà envoyé ne dépense rien de plus.
 */
export async function travaillerComite(options: { instant?: number; origine?: OrigineLancement } = {}): Promise<IssueComite> {
  const instant = options.instant ?? Date.now();
  const lot = await lireParametre<LotEnCours | null>(PARAM_LOT_EN_COURS, null);
  if (lot) {
    // Lire un lot est gratuit : on le relit avec le compte qui l'a reçu, même désactivé, épuisé ou hors du mode choisi.
    const cle = cleClaudeDuStudio(lot.source ?? "abonnement-1");
    // Sans clé, impossible de lire : le lot et sa réservation restent, jamais oubliés.
    if (!cle) return { etat: "attente" };
    const f = fetchClaudeEssai();
    return suivreLot(lot, { cle, ...(f ? { fetch: f } : {}) }, instant);
  }
  if (!(await comiteAllume())) return { etat: "eteint" };
  const o = await optionsClient();
  if (!o) return { etat: "claude-inactif" };
  if (o === "epuises") return { etat: "attente" };
  if ((await tailleReserve()) >= SEUIL_RESERVE) return { etat: "reserve-suffisante" };
  const dernier = await lireParametre<string | null>(PARAM_DERNIER_ENVOI, null);
  if (dernier && cleJour(dernier) === cleJour(new Date(instant))) return { etat: "deja-aujourd-hui" };
  return envoyerLot(o, instant, options.origine);
}

/* ------------------------------------------------------------------ */
/* Repli : à la demande, au prix plein                                 */
/* ------------------------------------------------------------------ */

/** Prix « au plus » d'un jugement à la demande (20 idées, prix plein), en centimes d'euro, montré AVANT. */
export async function prixJugementDirect(): Promise<{ centimesEur: number; texte: string }> {
  const contexte = await socleCanonique();
  // Le prix ne dépend que de la taille : 20 idées de longueur prudente.
  const factices: CombinaisonUsine[] = Array.from({ length: IDEES_A_LA_DEMANDE }, (_, i) => ({ signature: `prix-${i}`, parts: {}, textes: { douleur: "x".repeat(600) } }));
  const pire = pireCasComiteUsd(preparer(factices, "prix", contexte).map((p) => p.entree), false);
  const montant = usdVersEur(Math.ceil(pire * 100 * (1 + MARGE_CREDITS)), await taux());
  return { centimesEur: montant.centimes, texte: `≈ ${formaterMontant(montant)} au plus` };
}

/**
 * Jugement À LA DEMANDE (repli), seulement si la réserve est vide : appel normal (prix plein), `prixVuCentimesEur` : le
 * prix montré à Will et accepté. Claude absent : simulation (rien n'est payé, idées marquées « simulées »).
 * L3-01 : `origine` suit le jugement jusqu'à la garde d'argent (« usine » → `reserverPourUsine`) ; absente, Will (défaut).
 */
export async function jugerALaDemande(prixVuCentimesEur: number, options: { origine?: OrigineLancement } = {}): Promise<{ ok: true; gardes: number; refuses: string[]; coutUsd: number; simule: boolean } | { ok: false; message: string }> {
  if (!(await comiteAllume())) return { ok: false, message: "Comité éditorial éteint (Réglages)." };
  if ((await tailleReserve()) > 0) return { ok: false, message: "Des idées jugées attendent déjà : rien n'est payé." };
  const actif = await claudeActif("script");
  const { combinaisons, simulee } = await combinaisonsNeuves(IDEES_A_LA_DEMANDE);
  if (!combinaisons.length) return { ok: false, message: "Aucune idée neuve à juger." };
  const appelId = nouvelId(PREFIXE_APPEL_IDEES);
  const prepares = preparer(combinaisons, appelId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48), await socleCanonique());

  if (actif && !peutEcrire(actif)) return { ok: false, message: actif.sansCompte ? `${messageSansCompte(actif.sansCompte)} Rien n'est payé.` : "Les comptes Claude sont épuisés pour cette période : rien n'est payé." };
  if (!actif || simulee) {
    // Simulation : aucun appel, 0 $ ; jamais compté dans la réserve.
    let gardes = 0;
    const refuses: string[] = [];
    for (const p of prepares) {
      const r = await ranger(p.requete, roleComite.simuler(p.entree) as SortieComite, { source: "direct", simule: true });
      gardes += r.ranges;
      refuses.push(...r.refuses);
    }
    return { ok: true, gardes, refuses, coutUsd: 0, simule: true };
  }

  const pireUsd = pireCasComiteUsd(prepares.map((p) => p.entree), false);
  // Le prix montré doit couvrir le pire cas de CE jugement (marge comprise) : sinon Will revoit le nouveau prix.
  const prixReel = usdVersEur(Math.ceil(pireUsd * 100 * (1 + MARGE_CREDITS)), await taux());
  if (!Number.isFinite(prixVuCentimesEur) || prixVuCentimesEur < prixReel.centimes) {
    return { ok: false, message: `Le prix a changé : ≈ ${formaterMontant(prixReel)} au plus. Confirmez ce prix pour continuer.` };
  }
  const arret = await reserverPourComite(appelId, ETAPE_DIRECT, pireUsd, prixVuCentimesEur, options.origine);
  if (arret) return { ok: false, message: arret };
  let cout = 0;
  // Coût par compte qui a répondu (la rotation peut changer de compte en cours de route) : une dépense par compte.
  const parSource = new Map<SourceClaude, { reel: number; estime: number }>();
  const compter = (source: SourceClaude, usd: number, nature: "reel" | "estime") => {
    const c = parSource.get(source) ?? { reel: 0, estime: 0 };
    c[nature] += usd;
    parSource.set(source, c);
    cout += usd;
  };
  let gardes = 0;
  const refuses: string[] = [];
  try {
    for (const p of prepares) {
      try {
        const r = await appelerAvecRotation(actif, roleComite, p.entree);
        compter(actif.source, coutReelUsd(r.reponse), "reel");
        if (!r.donnees) {
          refuses.push(`${p.requete.idPerso} : ${r.invalide ?? r.marqueur ?? "sortie illisible"}`);
          continue;
        }
        const rangement = await ranger(p.requete, r.donnees, { source: "direct" });
        gardes += rangement.ranges;
        refuses.push(...rangement.refuses);
      } catch (e) {
        const err = e instanceof ErreurClaude ? e : null;
        refuses.push(`${p.requete.idPerso} : ${err?.code ?? "erreur"}`);
        // Coupure après l'envoi : la réponse a pu être facturée ; son pire cas reste compté.
        if (!err || err.code === "reseau" || err.code === "delai") {
          compter(actif.source, pireCasRequete(roleComite, p.entree), "estime");
        }
        if (err?.code === "facturation" || err?.code === "cle-refusee" || err?.code === "modele-introuvable") break;
      }
    }
  } finally {
    for (const [source, c] of parSource) {
      if (c.reel > 0) await enregistrerDepense(appelId, ETAPE_DIRECT, c.reel, "reel", source);
      if (c.estime > 0) await enregistrerDepense(appelId, ETAPE_DIRECT, c.estime, "estime", source);
    }
    await libererReservation(appelId, cout > 0 ? "consommee" : "liberee");
  }
  await journaliser("generateur", `Comité éditorial (à la demande) : ${gardes} idées jugées rangées`);
  return { ok: true, gardes, refuses, coutUsd: cout, simule: false };
}
