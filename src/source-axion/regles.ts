/**
 * SOURCE AXION-IA.COM — règles de la lecture quotidienne (PURES, une règle = un test).
 * - Première lecture = POINT DE DÉPART : les pages déjà en ligne sont notées, rien n'est proposé, sauf les articles
 *   et actualités parus (ou modifiés) depuis 2 jours.
 * - Au plus `MATIERES_PAR_JOUR` matières proposées par jour : une page dont les morceaux nouveaux ne tiennent plus dans
 *   la journée n'est pas notée ; elle est reprise le lendemain.
 * - Ensuite : une page NOUVELLE est lue ; une page dont la date change est relue au plus une fois par semaine ; une
 *   page SUIVIE est relue chaque jour. Au plus `PAGES_PAR_JOUR` pages par jour (le reste attend le lendemain).
 * - Une page connue au départ et lue pour la première fois sert de point de départ : ses morceaux sont notés, rien
 *   n'est proposé. Seuls les morceaux qui APPARAISSENT ensuite deviennent des matières.
 * - Captures : une page suivie est photographiée si elle ne l'a jamais été, ou si son contenu a changé ET que la
 *   dernière capture date d'au moins 7 jours (la page d'accueil change chaque jour : pas une capture par jour).
 */
import type { PageSite, RubriqueSite } from "@/domaine/types";
import { JOUR_MS } from "@/lib/dates";
import type { EntreePlan } from "./plan-du-site";

export const PAGES_PAR_JOUR = 60;
/** Au plus 12 matières proposées par jour : Will relit tout ; le reste attend le lendemain (rien n'est perdu). */
export const MATIERES_PAR_JOUR = 12;
export const RECENTES_AU_DEPART_JOURS = 2;
export const RELECTURE_JOURS = 7;
export const RECAPTURE_JOURS = 7;

/** Rubriques dont on tire des matières (les pages « autre » sont ignorées). */
export const RUBRIQUES_LUES: ReadonlySet<RubriqueSite> = new Set(["accueil", "offre", "formation", "faq", "a-propos", "article", "actualite"]);

export function estSuivie(p: Pick<PageSite, "suivie">): boolean {
  return !!p.suivie && !p.suivie.retireeLe;
}

export type RaisonLecture = "suivie" | "nouvelle" | "changee";

export interface PageALire {
  url: string;
  raison: RaisonLecture;
  rubrique: RubriqueSite;
  date?: string;
  titrePlan?: string;
}

function ageJours(iso: string | undefined, maintenant: Date): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (maintenant.getTime() - t) / JOUR_MS : Infinity;
}

/**
 * Pages à lire aujourd'hui, dans l'ordre : suivies, nouvelles (les plus récentes d'abord), changées. `premiere` : aucune
 * lecture n'a encore eu lieu (point de départ).
 */
export function pagesALire(
  entrees: (EntreePlan & { rubrique: RubriqueSite })[],
  connues: Map<string, Pick<PageSite, "url" | "dateSite" | "luLe" | "suivie" | "rubrique">>,
  maintenant: Date,
  premiere: boolean,
  limite = PAGES_PAR_JOUR,
): PageALire[] {
  const suivies: PageALire[] = [...connues.values()].filter(estSuivie).map((p) => ({ url: p.url, raison: "suivie" as const, rubrique: p.rubrique }));
  const dejaPrises = new Set(suivies.map((p) => p.url));
  const nouvelles: PageALire[] = [];
  const changees: PageALire[] = [];
  for (const e of entrees) {
    if (dejaPrises.has(e.url) || !RUBRIQUES_LUES.has(e.rubrique)) continue;
    dejaPrises.add(e.url);
    const connue = connues.get(e.url);
    if (!connue) {
      const recente = (e.rubrique === "article" || e.rubrique === "actualite") && ageJours(e.date, maintenant) <= RECENTES_AU_DEPART_JOURS;
      if (!premiere || recente) nouvelles.push({ url: e.url, raison: "nouvelle", rubrique: e.rubrique, date: e.date, titrePlan: e.titre });
      continue;
    }
    if (e.date && e.date !== connue.dateSite && ageJours(connue.luLe, maintenant) >= RELECTURE_JOURS - 1 / 24) {
      changees.push({ url: e.url, raison: "changee", rubrique: e.rubrique, date: e.date, titrePlan: e.titre });
    }
  }
  nouvelles.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return [...suivies, ...nouvelles, ...changees].slice(0, limite);
}

/**
 * Pages du plan À NOTER sans les lire (point de départ, ou lues un autre jour) : elles deviennent « connues » avec leur
 * date. Une page jamais notée qui n'est pas lue aujourd'hui (au-delà de la limite) n'est PAS notée : elle reste
 * nouvelle pour demain.
 */
export function pagesANoter(entrees: (EntreePlan & { rubrique: RubriqueSite })[], connues: Map<string, unknown>, aLire: Set<string>, premiere: boolean): (EntreePlan & { rubrique: RubriqueSite })[] {
  if (!premiere) return [];
  return entrees.filter((e) => RUBRIQUES_LUES.has(e.rubrique) && !connues.has(e.url) && !aLire.has(e.url));
}

/** Une capture est-elle due pour cette page suivie ? */
export function captureDue(p: Pick<PageSite, "captures" | "empreinte" | "suivie">, maintenant: Date): boolean {
  if (!estSuivie(p)) return false;
  if (!p.captures?.elementIds.length) return true;
  if (!p.empreinte || p.captures.empreinte === p.empreinte) return false;
  return ageJours(p.captures.faitesLe, maintenant) >= RECAPTURE_JOURS - 1 / 24;
}

/** Une lecture par jour : vrai si la dernière date d'au moins 24 h (ou n'a jamais eu lieu). */
export function lectureSiteDue(derniere: string | null, maintenant: Date): boolean {
  return !derniere || maintenant.getTime() - new Date(derniere).getTime() >= JOUR_MS - 60_000;
}

/** Texte de la cloche après une lecture. */
export function texteNotification(matieres: number, captures: number): { titre: string; message?: string } | null {
  if (!matieres && !captures) return null;
  const m = matieres ? `${matieres} nouvelle${matieres > 1 ? "s" : ""} matière${matieres > 1 ? "s" : ""} depuis votre site` : "";
  const c = captures ? `${captures} nouvelle${captures > 1 ? "s" : ""} image${captures > 1 ? "s" : ""} de votre site` : "";
  return matieres ? { titre: m, ...(c ? { message: `Et ${c}.` } : { message: "À relire d'un toucher dans Matières." }) } : { titre: c[0].toUpperCase() + c.slice(1), message: "Rangées dans Mes images." };
}
