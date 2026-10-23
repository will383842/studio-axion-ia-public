/**
 * CRÉDIT CLAUDE RESTANT ESTIMÉ — côté serveur, AFFICHAGE SEULEMENT (calculs dans `domaine/credit-claude.ts`).
 * Aucune API Anthropic de solde : c'est un calcul. Ce fichier ne touche JAMAIS aux marques d'épuisement, à la remise en
 * service ni aux recharges : une estimation ne bloque ni ne débloque rien. Une clé n'est jamais renvoyée d'ici.
 */
import "server-only";
import {
  consommeDepuis,
  paramCycleCredit,
  paramReleveCredit,
  restantEstime,
  totalRestant,
  type CompteTotal,
  type CycleCredit,
  type EtatRestant,
  type ReleveCredit,
} from "@/domaine/credit-claude";
import { finDeCle, formaterDollars } from "@/domaine/credits";
import { cleDeLaSource, libelleSource, numeroAbonnement, type EnvClaude, type SourceAbonnement } from "@/domaine/source-claude";
import { dateCourte, cleMois } from "@/lib/dates";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { depots, ecrireParametre, journaliser, lireParametre, maintenant } from "./_commun";
import { lireReglageSourcesClaude } from "./source-claude";

export interface VueCompteCredit {
  source: SourceAbonnement;
  libelle: string;
  finCle: string | null;
  etat: EtatRestant;
  restantTexte: string;
  depuisTexte: string | null;
  /** Restant en centimes de dollar (pour la carte de l'Accueil) ; `null` : pas de chiffre. */
  restantCentimes: number | null;
  /** Date du relevé de la Console qui sert de base (ou, à défaut, du dernier relevé saisi sur ce compte). */
  releveLe: string | null;
  /** « Le cycle est saisi sur le compte N » quand ce compte partage sa clé et lit le cycle d'un autre ; sinon `null`. */
  cycleSaisiSurTexte: string | null;
  base: "releve" | "cycle" | null;
  /** Cycle saisi (montant en dollars) pour pré-remplir le formulaire ; `null` : rien de saisi. */
  cycle: { dollars: number; debut: string; expireLe: string | null; prochainLe: string | null } | null;
  expireLe: string | null;
  prochainLe: string | null;
  desactive: boolean;
  doublon: boolean;
  /** Pourquoi ce compte n'entre pas dans le total (texte pour la carte) ; `null` : il y entre. */
  horsTotalTexte: string | null;
}

export interface VueCreditClaude {
  totalTexte: string;
  comptes: VueCompteCredit[];
  api: { finCle: string | null; eteinte: boolean; consommeMoisTexte: string };
  mode: "abonnements" | "api";
}

function cycleValide(v: unknown): CycleCredit | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.montantCentimes !== "number" || !Number.isFinite(o.montantCentimes) || typeof o.debut !== "string") return null;
  return { montantCentimes: o.montantCentimes, debut: o.debut, expireLe: typeof o.expireLe === "string" ? o.expireLe : null, prochainLe: typeof o.prochainLe === "string" ? o.prochainLe : null };
}

function releveValide(v: unknown): ReleveCredit | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return typeof o.centimes === "number" && Number.isFinite(o.centimes) && typeof o.le === "string" ? { centimes: o.centimes, le: o.le } : null;
}

function texteRestant(etat: EtatRestant, centimes: number | null, depasse: boolean): string {
  if (etat === "estime" && depasse) return "0 $ (dépensé plus que le crédit noté : à recaler avec la Console)";
  if (etat === "estime" && centimes !== null) return formaterDollars(centimes);
  if (etat === "expire") return "Expiré (0 $)";
  if (etat === "a-venir") return "À venir";
  return "À renseigner";
}

/** Pour l'écran : le restant estimé de chaque compte et le total. JAMAIS une clé entière. */
export async function vueCreditClaude(env: EnvClaude = process.env): Promise<VueCreditClaude> {
  const reglage = await lireReglageSourcesClaude();
  const depenses = await depots().depenses.lister();
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const instant = maintenant();
  const payante = cleDeLaSource("api", env);

  const comptesOrdonnes = reglage.ordre.map((id) => ({ id, cle: cleDeLaSource(id, env) }));
  const finPayante = finDeCle(payante);
  const pourTotal: CompteTotal[] = [{ source: "api", cle: payante, desactive: false, etat: "a-renseigner", restantCentimes: null }];
  const saisis = new Map<SourceAbonnement, { cycle: CycleCredit | null; releve: ReleveCredit | null }>();
  for (const { id } of comptesOrdonnes) {
    saisis.set(id, { cycle: cycleValide(await lireParametre<unknown>(paramCycleCredit(id), null)), releve: releveValide(await lireParametre<unknown>(paramReleveCredit(id), null)) });
  }
  const intermediaires: { id: SourceAbonnement; cle: string | null; cycle: CycleCredit | null; cycleGroupe: CycleCredit | null; releve: ReleveCredit | null; r: ReturnType<typeof restantEstime>; desactive: boolean; cycleSaisiSurTexte: string | null }[] = [];
  for (const { id, cle } of comptesOrdonnes) {
    const propre = saisis.get(id)!;
    // Plusieurs comptes sur la même clé = la même organisation Console : leurs dépenses se cumulent sur ce crédit,
    // et le cycle (ou le relevé) est le PLUS RÉCENT du groupe (même d'un compte désactivé), pas celui du premier compte.
    const partageurs = cle ? comptesOrdonnes.filter((c) => c.cle === cle).map((c) => c.id) : [id];
    let celuiDuCycle = id;
    let celuiDuReleve = id;
    for (const p of partageurs) {
      const c = saisis.get(p)!.cycle;
      if (c && (!saisis.get(celuiDuCycle)!.cycle || c.debut > saisis.get(celuiDuCycle)!.cycle!.debut)) celuiDuCycle = p;
      const rl = saisis.get(p)!.releve;
      if (rl && (!saisis.get(celuiDuReleve)!.releve || Date.parse(rl.le) > Date.parse(saisis.get(celuiDuReleve)!.releve!.le))) celuiDuReleve = p;
    }
    const cycle = saisis.get(celuiDuCycle)!.cycle;
    const releve = saisis.get(celuiDuReleve)!.releve;
    const textes = [
      cycle && celuiDuCycle !== id ? `Le cycle est saisi sur le compte ${numeroAbonnement(celuiDuCycle)}.` : null,
      releve && celuiDuReleve !== id ? `Le relevé est saisi sur le compte ${numeroAbonnement(celuiDuReleve)}.` : null,
    ].filter((t): t is string => !!t);
    const cycleSaisiSurTexte = textes.length ? textes.join(" ") : null;
    const r = restantEstime({ cycle, releve, consomme: (depuis) => consommeDepuis(depenses, partageurs, depuis, taux), maintenant: instant });
    const desactive = reglage.desactives.includes(id);
    pourTotal.push({ source: id, cle, desactive, etat: r.etat, restantCentimes: r.restantCentimes });
    intermediaires.push({ id, cle, cycle: propre.cycle, cycleGroupe: cycle, releve, r, desactive, cycleSaisiSurTexte });
  }
  const { centimes, comptes: nbComptes, exclus } = totalRestant(pourTotal);
  const motifs: Record<string, string> = {
    desactive: "Compte désactivé : hors total.",
    "sans-cle": "Aucune clé posée pour ce compte : hors total.",
    "cle-payante": `Même clé que l'API payante${finPayante ? ` (${finPayante})` : ""} : hors total, jamais comptée dans un abonnement.`,
  };
  /** Le compte qui porte la clé dans le total : le premier non désactivé de l'ordre (même règle que `totalRestant`). */
  const porteur = (cle: string | null) => intermediaires.find((x) => x.cle === cle && !x.desactive)?.id;
  const comptes: VueCompteCredit[] = intermediaires.map(({ id, cle, cycle, cycleGroupe, releve, r, desactive, cycleSaisiSurTexte }) => ({
    source: id,
    libelle: `Compte ${numeroAbonnement(id)}`,
    finCle: finDeCle(cle) ?? null,
    etat: r.etat,
    restantTexte: exclus[id] === "cle-payante" ? "Clé payante : pas de restant" : texteRestant(r.etat, r.restantCentimes, r.depasse),
    restantCentimes: exclus[id] === "cle-payante" ? null : r.restantCentimes,
    releveLe: releve?.le ?? null,
    cycleSaisiSurTexte,
    depuisTexte: r.etat === "estime" && r.depuis ? `${r.base === "releve" ? "depuis le relevé du" : "depuis le"} ${dateCourte(r.depuis)}` : null,
    base: r.base,
    cycle: cycle ? { dollars: cycle.montantCentimes / 100, debut: cycle.debut, expireLe: cycle.expireLe, prochainLe: cycle.prochainLe } : null,
    expireLe: cycleGroupe?.expireLe ?? null,
    prochainLe: cycleGroupe?.prochainLe ?? null,
    desactive,
    doublon: exclus[id] === "doublon",
    horsTotalTexte: exclus[id] === "doublon" ? `Même clé qu'un autre compte (le compte ${numeroAbonnement(porteur(cle) as SourceAbonnement)}) : hors total, comptée une seule fois sur ce compte.` : exclus[id] ? motifs[exclus[id]!]! : null,
  }));
  const moisApi = consommeDepuis(depenses, "api", `${cleMois(instant)}-01`, taux);
  const retenus = intermediaires.filter((x) => !exclus[x.id]).length;
  return {
    totalTexte: nbComptes === 0 ? "À renseigner" : nbComptes < retenus ? `${formaterDollars(centimes)} sur ${nbComptes} compte${nbComptes > 1 ? "s" : ""} renseigné${nbComptes > 1 ? "s" : ""}` : formaterDollars(centimes),
    comptes,
    api: { finCle: finPayante ?? null, eteinte: reglage.mode !== "api", consommeMoisTexte: formaterDollars(moisApi) },
    mode: reglage.mode,
  };
}

/** Enregistre le cycle de crédit d'un compte (montant en centimes de dollar). Rien d'autre n'est touché. */
export async function enregistrerCycleCredit(s: SourceAbonnement, cycle: CycleCredit): Promise<void> {
  await ecrireParametre(paramCycleCredit(s), cycle);
  await journaliser("credits", `Crédit ${libelleSource(s)} : cycle de ${formaterDollars(cycle.montantCentimes)} noté (estimation)`);
}

/** Enregistre le solde relevé dans la Console (centimes de dollar), daté de maintenant. Rien d'autre n'est touché. */
export async function enregistrerReleveCredit(s: SourceAbonnement, centimes: number): Promise<void> {
  await ecrireParametre(paramReleveCredit(s), { centimes: Math.round(centimes), le: maintenant() } satisfies ReleveCredit);
  await journaliser("credits", `Crédit ${libelleSource(s)} : solde relevé ${formaterDollars(centimes)} noté (estimation)`);
}
