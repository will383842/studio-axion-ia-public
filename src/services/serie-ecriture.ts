/**
 * ÉCRITURE EN SÉRIE (B7 de l'audit B, validée par Will) : plusieurs idées écrites d'un geste.
 *
 * - `planSerie(n)` : prix d'UN sujet calculé (`prixLancement`, la réserve maximale du sujet, jamais un chiffre en dur),
 *   prix total maximum = n × ce prix, et combien d'idées PARTIRONT sans jamais dépasser le budget du mois ni la limite
 *   Claude du mois. Les écritures déjà en cours comptent pour leur reste possible (on ne promet pas deux fois le même
 *   argent).
 * - `lancerSerie` : un `lancerGeneration` par idée retenue, l'une après l'autre ; la boucle les écrit une par une
 *   (rien n'est appelé chez Claude dans la requête). Chaque idée est reliée à son sujet. Les idées qui ne partent pas
 *   restent des idées (celles tapées dans l'atelier sont notées, rien n'est perdu).
 * - `suiviSerie` : « 3 sur 10 écrits », à partir de l'état réel des écritures.
 * En essai (Claude pas branché), rien n'est payé : toutes partent, l'écran le dit.
 */
import "server-only";
import { detecterSujetSensible } from "@/domaine/classement-generateur";
import { MAX_IDEES_SERIE } from "@/domaine/serie-idees";
import type { Adresse, Id, ModeDiction, Montant, ObjectifSujet, ReseauDeclinaison } from "@/domaine/types";
import { centimes, formaterMontant } from "@/lib/montants";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { chaineDeLEcriture, lancerGeneration, prixLancement } from "./boucle-generation";
import { resumeBudget } from "./couts";
import { claudeBranche, depenseGenerationUsd, ecritureEnEssai, engageClaudeDuMoisCentimes, plafondChaineUsd, plafondMensuelClaudeUsd, taux } from "./generation-claude";
import { ajouterIdee } from "./idees";
import { budgetIndicatif } from "./mode-budget";
import { depots, ErreurStudio, ecrireParametre, journaliser, lireParametre, maintenant } from "./_commun";

/** Au plus 20 idées d'un geste. */
export const MAX_SERIE = MAX_IDEES_SERIE;

export interface ReglagesSerie {
  reseaux: ReseauDeclinaison[];
  formatId: string;
  adresse: Adresse;
  mode: ModeDiction;
  objectif: ObjectifSujet;
  /** Intégration paquet 4 (équipe 7) : série TikTok choisie dans l'atelier ; chaque idée partie en devient un épisode, dans l'ordre. */
  serieId?: Id;
}

export interface PlanSerie {
  demandees: number;
  /** Combien partiront vraiment (jamais au-delà du budget ni de la limite Claude du mois). */
  partiront: number;
  prixUnitaire: Montant;
  /** n × prix d'un sujet : le plus que la série peut coûter. */
  totalMax: Montant;
  /** Prix maximum de celles qui partiront. */
  totalPartant: Montant;
  /** Essai : Claude pas branché, rien n'est payé. */
  essai: boolean;
  /** Ce qui limite, quand toutes ne partent pas. */
  limite?: "budget" | "claude";
}

/**
 * PUR : combien d'idées partent. Chaque sujet peut coûter jusqu'à son plafond ; on n'en lance que ce que le budget
 * restant (euros) ET la limite Claude restante (cents de dollar) couvrent ENTIÈREMENT.
 */
export function calculerPlanSerie(e: {
  demandees: number;
  prixUnitaireCentimes: number;
  restantBudgetCentimes: number;
  plafondSujetUsdCentimes: number;
  restantClaudeUsdCentimes: number;
  essai: boolean;
  /** Mode budget indicatif : le budget et la limite Claude du mois sont des repères, tout part ; la limite reste dite en information. */
  indicatif?: boolean;
}): { partiront: number; limite?: "budget" | "claude" } {
  const n = Math.max(0, Math.floor(e.demandees));
  if (e.essai) return { partiront: n };
  const parBudget = e.prixUnitaireCentimes > 0 ? Math.floor(Math.max(0, e.restantBudgetCentimes) / e.prixUnitaireCentimes) : n;
  const parClaude = e.plafondSujetUsdCentimes > 0 ? Math.floor(Math.max(0, e.restantClaudeUsdCentimes) / e.plafondSujetUsdCentimes) : n;
  const partiront = Math.min(n, parBudget, parClaude);
  if (partiront >= n) return { partiront };
  const limite = parBudget <= parClaude ? ("budget" as const) : ("claude" as const);
  return e.indicatif ? { partiront: n, limite } : { partiront, limite };
}

/** Reste possible des écritures déjà parties (dollars) : leur plafond moins ce qu'elles ont dépensé. */
async function resteDesEcrituresEnCoursUsd(): Promise<number> {
  const enCours = await depots().generations.lister((g) => (g.statut === "en-cours" || g.statut === "en-attente-credit") && !g.simulee && !ecritureEnEssai(g) && !g.estDemo);
  return enCours.reduce((s, g) => s + Math.max(0, g.plafondUsd - depenseGenerationUsd(g)), 0);
}

export async function planSerie(demandees: number): Promise<PlanSerie> {
  await exigerSession();
  const n = Math.min(MAX_SERIE, Math.max(0, Math.floor(Number(demandees) || 0)));
  const prixUnitaire = await prixLancement();
  const essai = !(await claudeBranche());
  const [budget, engageClaude, plafondUsd, reste, t, plafondSujetUsd] = await Promise.all([resumeBudget(), engageClaudeDuMoisCentimes(), plafondMensuelClaudeUsd(), resteDesEcrituresEnCoursUsd(), taux(), chaineDeLEcriture().then(plafondChaineUsd)]);
  const resteCentimesUsd = Math.ceil(reste * 100);
  const { partiront, limite } = calculerPlanSerie({
    demandees: n,
    prixUnitaireCentimes: prixUnitaire.centimes,
    restantBudgetCentimes: budget.restant.centimes - Math.ceil(resteCentimesUsd * t),
    // Re-relecture A09 : le plafond d'un sujet est celui du RÉGLAGE de la chaîne (le même que le prix unitaire).
    plafondSujetUsdCentimes: Math.round(plafondSujetUsd * 100),
    restantClaudeUsdCentimes: Math.round(plafondUsd * 100) - engageClaude.depense - engageClaude.reserve - resteCentimesUsd,
    essai,
    indicatif: await budgetIndicatif(),
  });
  return { demandees: n, partiront, prixUnitaire, totalMax: centimes(n * prixUnitaire.centimes), totalPartant: centimes(partiront * prixUnitaire.centimes), essai, limite };
}

/* ------------------------------------------------------------------ */
/* Lancement                                                            */
/* ------------------------------------------------------------------ */

export interface ElementSerie {
  texte: string;
  ideeId?: Id;
  scriptMaitreId?: Id;
  /** « parti » : écriture lancée (ou arrêtée gratuitement sur un manque) ; « reste » : gardé en idée ; « refuse » : erreur. */
  sort: "parti" | "reste" | "refuse";
  message?: string;
}

export interface Serie {
  id: Id;
  creeLe: string;
  elements: ElementSerie[];
}

const cleSerie = (id: Id) => `generateur.serie.${id}`;
const CLE_DERNIERE = "generateur.serie.derniere";

/** Une série à la fois : deux touchers ne lancent jamais deux fois les mêmes idées, ni au-delà du budget. */
let file: Promise<unknown> = Promise.resolve();
function unParUn<T>(f: () => Promise<T>): Promise<T> {
  const suite = file.then(f, f);
  file = suite.catch(() => undefined);
  return suite;
}

function reglagesPropres(r: ReglagesSerie): ReglagesSerie {
  if (!Array.isArray(r?.reseaux) || !r.reseaux.length) throw new ErreurStudio("SANS_RESEAU", "Choisissez au moins un réseau.");
  if (!r.formatId) throw new ErreurStudio("FORMAT", "Choisissez un format.");
  return { reseaux: [...r.reseaux], formatId: String(r.formatId), adresse: r.adresse === "tu" ? "tu" : "vous", mode: r.mode, objectif: r.objectif, ...(typeof r.serieId === "string" && r.serieId ? { serieId: r.serieId } : {}) };
}

/**
 * Lance la série : `cle` vient de l'écran (un même geste renvoyé deux fois rend la même série). Les idées sont
 * prises dans l'ordre ; seules celles que le budget et la limite Claude couvrent partent.
 *
 * Intégration paquet 4 (garde argent, CORRECTEUR 1 — B6) : `totalConfirme` est le total (centimes) que Will a vu sur la
 * feuille. Au-delà du seuil de confirmation du budget, la série ne part pas si ce total manque ou s'il est plus bas que
 * le prix maximum d'aujourd'hui de ce qui partirait (`CONFIRMATION_REQUISE`, rien n'est créé). Jamais confirmé d'office.
 */
export async function lancerSerie(entrees: { texte: string; ideeId?: Id }[], reglages: ReglagesSerie, cle: string, totalConfirme?: number, partirontConfirme?: number): Promise<{ serie: Serie; plan: PlanSerie }> {
  await exigerSession();
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(String(cle))) throw new ErreurStudio("SERIE", "Demande illisible. Réessayez.");
  const r = reglagesPropres(reglages);
  return unParUn(async () => {
    const deja = await lireParametre<Serie | null>(cleSerie(cle), null);
    if (deja) return { serie: deja, plan: await planSerie(deja.elements.length) };
    const vus = new Set<string>();
    const idees = (Array.isArray(entrees) ? entrees : [])
      .map((x) => ({ texte: String(x?.texte ?? "").trim().slice(0, 300), ideeId: typeof x?.ideeId === "string" ? x.ideeId : undefined }))
      .filter((x) => x.texte && !vus.has(x.texte.toLowerCase()) && vus.add(x.texte.toLowerCase()));
    if (!idees.length) throw new ErreurStudio("IDEE_VIDE", "Choisissez au moins une idée.");
    if (idees.length > MAX_SERIE) throw new ErreurStudio("SERIE_LONGUE", `${MAX_SERIE} idées au plus d'un coup.`);
    const plan = await planSerie(idees.length);
    await exigerTotalConfirme(plan, totalConfirme, partirontConfirme);
    const d = depots();
    const elements: ElementSerie[] = [];
    for (const [i, x] of idees.entries()) {
      if (i >= plan.partiront) {
        // Rien n'est perdu : une idée tapée dans l'atelier est notée dans « Idées ».
        const ideeId = x.ideeId ?? (await ajouterIdee(x.texte)).id;
        elements.push({ texte: x.texte, ideeId, sort: "reste" });
        continue;
      }
      // CORRECTEUR FINAL A (VERIF-E2E-1, gêne argent) : une idée déjà écrite (écran périmé, autre onglet) n'est jamais
      // écrite ni payée une seconde fois. Rien n'est effacé : l'idée garde son sujet.
      const idee = x.ideeId ? await d.idees.obtenir(x.ideeId) : null;
      const sujetExistant = idee?.scriptMaitreId ? await d.scriptsMaitres.obtenir(idee.scriptMaitreId) : null;
      if (sujetExistant && !sujetExistant.archiveLe) {
        elements.push({ texte: x.texte, ideeId: x.ideeId, sort: "refuse", message: "Cette idée est déjà écrite : rien n'a été relancé ni payé." });
        continue;
      }
      try {
        const lance = await lancerGeneration({ idee: x.texte, reseaux: r.reseaux, formatId: r.formatId, adresse: r.adresse, mode: r.mode, objectif: r.objectif, ideeId: x.ideeId, sujetSensible: detecterSujetSensible(x.texte), serieId: r.serieId });
        if (x.ideeId) await d.idees.modifier(x.ideeId, { scriptMaitreId: lance.scriptMaitreId });
        elements.push({ texte: x.texte, ideeId: x.ideeId, scriptMaitreId: lance.scriptMaitreId, sort: "parti" });
      } catch (e) {
        const ideeId = x.ideeId ?? (await ajouterIdee(x.texte)).id;
        elements.push({ texte: x.texte, ideeId, sort: "refuse", message: e instanceof ErreurStudio ? e.message : "Cette idée n'a pas pu partir." });
      }
    }
    const serie: Serie = { id: cle, creeLe: maintenant(), elements };
    await ecrireParametre(cleSerie(cle), serie);
    await ecrireParametre(CLE_DERNIERE, cle);
    const partis = elements.filter((e) => e.sort === "parti").length;
    await journaliser("generateur", `Série : ${partis} idée(s) sur ${elements.length} en écriture${plan.essai ? " (essai)" : ""}`);
    return { serie, plan };
  });
}

/**
 * Garde argent (B6) appliquée à la série : au-delà du seuil, le total vu sur la feuille doit couvrir le prix du jour, et
 * venir d'un plan de MÊME TAILLE (relecture paquet 4, exactitude petit défaut 5 : le total d'un autre plan ne vaut pas ;
 * seconde relecture, R4 : une taille absente ne vaut pas non plus).
 */
async function exigerTotalConfirme(plan: PlanSerie, totalConfirme: number | undefined, partirontConfirme?: number): Promise<void> {
  if (plan.essai || plan.partiront === 0) return;
  const { seuilConfirmation } = await resumeBudget();
  if (plan.totalPartant.centimes <= seuilConfirmation.centimes) return;
  // Seconde relecture (R4) : la taille du plan vu est EXIGÉE dès qu'il y a une confirmation (absente = refus).
  const memeTaille = partirontConfirme === plan.partiront;
  const confirme = memeTaille && typeof totalConfirme === "number" && Number.isFinite(totalConfirme) && totalConfirme >= plan.totalPartant.centimes;
  if (!confirme) throw new ErreurStudio("CONFIRMATION_REQUISE", `Ces ${plan.partiront} écritures coûtent au plus ${formaterMontant(plan.totalPartant)}, plus que d'habitude. Confirmez ce prix pour continuer.`, plan.totalPartant.centimes);
}

/* ------------------------------------------------------------------ */
/* Suivi                                                                */
/* ------------------------------------------------------------------ */

export type EtatElementSerie = "ecrit" | "en-cours" | "attente" | "a-completer" | "arretee" | "reste" | "refuse";

export interface SuiviSerie {
  id: Id;
  /** Idées parties. */
  total: number;
  ecrits: number;
  /** Arrêtées sans frais : il manque une matière (à compléter sur la fiche du sujet). */
  aCompleter: number;
  /** En attente de budget ou de crédit : elles repartent seules. */
  enAttente: number;
  /** CORRECTEUR FINAL A : arrêtées sur une panne (« Reprendre l'écriture » sur la fiche du sujet), jamais « À compléter ». */
  arretees: number;
  restees: number;
  termine: boolean;
  elements: { texte: string; scriptMaitreId?: Id; etat: EtatElementSerie }[];
}

export async function suiviSerie(id?: Id | null): Promise<SuiviSerie | null> {
  await exigerSession();
  const cle = id ?? (await lireParametre<Id | null>(CLE_DERNIERE, null));
  if (!cle) return null;
  const serie = await lireParametre<Serie | null>(cleSerie(cle), null);
  if (!serie) return null;
  const d = depots();
  const elements: SuiviSerie["elements"] = [];
  for (const e of serie.elements) {
    if (e.sort !== "parti" || !e.scriptMaitreId) {
      elements.push({ texte: e.texte, etat: e.sort === "refuse" ? "refuse" : "reste" });
      continue;
    }
    const m = await d.scriptsMaitres.obtenir(e.scriptMaitreId);
    const g = m?.generationId ? await d.generations.obtenir(m.generationId) : null;
    const etat: EtatElementSerie =
      g?.statut === "terminee"
        ? "ecrit"
        : m?.etat === "a-completer" || m?.manque || !g
          ? "a-completer"
          : g.statut === "en-attente-credit"
            ? "attente"
            : g.statut === "en-cours"
              ? "en-cours"
              : // CORRECTEUR FINAL A : panne, plafond ou modèle bloqué : l'écriture est ARRÊTÉE (rien à compléter).
                "arretee";
    elements.push({ texte: e.texte, scriptMaitreId: e.scriptMaitreId, etat });
  }
  const partis = elements.filter((e) => e.scriptMaitreId);
  return {
    id: serie.id,
    total: partis.length,
    ecrits: partis.filter((e) => e.etat === "ecrit").length,
    aCompleter: partis.filter((e) => e.etat === "a-completer").length,
    enAttente: partis.filter((e) => e.etat === "attente").length,
    arretees: partis.filter((e) => e.etat === "arretee").length,
    restees: elements.length - partis.length,
    termine: partis.every((e) => e.etat !== "en-cours"),
    elements,
  };
}

/** Nouvel identifiant de série (côté serveur, pour les tests et les appels sans écran). */
export function nouvelleCleSerie(): string {
  return nouvelId("serie");
}
