/**
 * GUIDES PDF (lot G6) · réconciliation Studio ↔ site des guides fabriqués. LECTURE SEULE : le service AFFICHE les écarts, il ne
 * corrige rien et n'écrit JAMAIS vers le site (un seul GET signé par guide). INERTE : tant que `GUIDES_RECONCILIATION_ENABLED`
 * n'est pas exactement « true », AUCUN appel réseau, AUCUNE écriture. Aucune tâche périodique n'y est branchée (la fréquence
 * de 6 h viendra avec le lot suivant) : seul un appel explicite le lance.
 *
 * Côté Studio : les versions « Validé » rangées sous `guides.redaction.<id>` dont la valeur porte un `code` (gde-…).
 * Côté site : GET /api/interne/guides-reseau/versions?code=gde-… (même signature HMAC que les autres routes signées ; le
 * chemin signé est celui de la requête, requête comprise). 404 = route absente = « site pas prêt » (pas une erreur) ; 503 ou
 * délai = site indisponible. Résultat mémorisé dans `guides.reconciliation` (dernier passage et écarts, sans aucun texte).
 */
import "server-only";
import { comparerVersions, lireVersionsSite, type Ecart, type VersionSite, type VersionStudio } from "@/domaine/guides-pdf/reconciliation";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { ReponseSite, TransportSite } from "@/fournisseurs/site/types";
import { PREFIXE_PARAM_REDACTION, STATUT_VALIDE } from "./guides-redaction";

export const VARIABLE_INTERRUPTEUR_GUIDES_RECONCILIATION = "GUIDES_RECONCILIATION_ENABLED";
export const CHEMIN_VERSIONS_GUIDES = "/api/interne/guides-reseau/versions";
export const PARAM_RECONCILIATION = "guides.reconciliation";
export const DELAI_SITE_RECONCILIATION_MS = 3_000;
export const MAX_GUIDES_PAR_PASSAGE = 200;
export const MAX_ECARTS_MEMORISES = 500;
const LONGUEUR_MAX_INTERRUPTEUR = 16;

type Env = Record<string, string | undefined>;

/** Seul le texte exact « true » allume (valeur démesurée, majuscules, espaces : éteint). */
export function guidesReconciliationActif(env: Env = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_GUIDES_RECONCILIATION];
  return typeof v === "string" && v.length <= LONGUEUR_MAX_INTERRUPTEUR && v === "true";
}

export interface DepsReconciliation {
  env?: Env;
  /** Transport signé vers le site (faux dans les essais). `null` = site non relié : aucun appel. */
  transport: () => { transport: TransportSite; secret: string } | null;
  lireVersionsStudio: () => Promise<VersionStudio[]>;
  lireParametre: (id: string) => Promise<unknown>;
  ecrireParametre: (id: string, valeur: unknown) => Promise<void>;
  journaliser: (type: string, message: string) => Promise<void>;
  maintenantMs: () => number;
}

export type EtatReconciliation = "compare" | "site_pas_pret" | "site_indisponible" | "site_non_relie" | "reponse_illisible";

export interface MemoireReconciliation {
  /** Instant ISO du dernier passage terminé (comparaison faite, ou site pas prêt). */
  dernierPassage: string | null;
  etat: EtatReconciliation;
  guidesLus: number;
  lignesIgnorees: number;
  ecarts: Ecart[];
  ecartsTronques: boolean;
}

export type ResultatReconciliation =
  | { ok: true; etat: "compare"; ecarts: Ecart[] }
  | { ok: true; etat: "site_pas_pret" }
  | { ok: false; raison: "interrupteur_eteint" | "site_non_relie" | "site_indisponible" | "reponse_illisible" | "studio_illisible" | "dependances_indisponibles" };

async function depsReelles(): Promise<DepsReconciliation> {
  const commun = await import("./_commun");
  const { transportDuSite } = await import("./parcours-mot");
  return {
    transport: () => transportDuSite(process.env),
    lireVersionsStudio: async () => {
      const lignes = await commun.depots().parametres.lister((p) => p.id.startsWith(PREFIXE_PARAM_REDACTION), (p) => ({ ...p, valeur: sansTexte(p.valeur) }));
      return versionsStudioDepuisParametres(lignes.map((p) => p.valeur));
    },
    lireParametre: async (id) => (await commun.depots().parametres.obtenir(id))?.valeur ?? null,
    ecrireParametre: commun.ecrireParametre,
    journaliser: (type, message) => commun.journaliser(type, message),
    maintenantMs: () => Date.now(),
  };
}

/** Allège une valeur de paramètre avant la copie : ni `contenu` (texte du guide), seulement code, version, statut, empreinte. */
function sansTexte(v: unknown): unknown {
  if (typeof v !== "object" || v === null) return null;
  const o = v as { code?: unknown; versions?: unknown };
  const versions = Array.isArray(o.versions)
    ? o.versions.map((x) => {
        const w = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
        return { version: w.version, statut: w.statut, empreinte: w.empreinte };
      })
    : [];
  return { code: o.code, versions };
}

/** Versions « Validé » des paramètres `guides.redaction.<id>` portant un code de guide (gde-…). Le reste est ignoré. */
export function versionsStudioDepuisParametres(valeurs: readonly unknown[]): VersionStudio[] {
  const sortie: VersionStudio[] = [];
  for (const v of valeurs) {
    const o = typeof v === "object" && v !== null ? (v as { code?: unknown; versions?: unknown }) : null;
    if (!o || typeof o.code !== "string" || !/^gde-[a-z0-9-]{6,24}$/.test(o.code) || !Array.isArray(o.versions)) continue;
    for (const x of o.versions as unknown[]) {
      const w = typeof x === "object" && x !== null ? (x as Record<string, unknown>) : null;
      if (w && w.statut === STATUT_VALIDE && Number.isSafeInteger(w.version) && typeof w.empreinte === "string") sortie.push({ code: o.code, version: w.version as number, empreinte: w.empreinte });
    }
  }
  return sortie;
}

type Lecture = { kind: "ok"; versions: VersionSite[]; ignorees: number } | { kind: "pas_pret" } | { kind: "indisponible" } | { kind: "illisible" };

async function lireUnGuide(d: DepsReconciliation, site: { transport: TransportSite; secret: string }, code: string): Promise<Lecture> {
  const chemin = `${CHEMIN_VERSIONS_GUIDES}?code=${encodeURIComponent(code)}`;
  const entetes = signerAppel({ secret: site.secret, methode: "GET", chemin, corps: "", horodatageSec: Math.floor(d.maintenantMs() / 1000) });
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error("delai")), DELAI_SITE_RECONCILIATION_MS);
  });
  let r: ReponseSite;
  try {
    r = await Promise.race([site.transport({ methode: "GET", chemin, corps: "", entetes }), delai]);
  } catch {
    return { kind: "indisponible" };
  } finally {
    clearTimeout(minuteur);
  }
  if (r.statut === 404) return { kind: "pas_pret" };
  if (r.statut !== 200) return { kind: "indisponible" }; // 503, 5xx, 401, 429… : rien n'est comparé
  const lu = lireVersionsSite(r.corps);
  return lu ? { kind: "ok", versions: lu.versions, ignorees: lu.ignorees } : { kind: "illisible" };
}

/**
 * Lance UN passage de réconciliation. Ne lève jamais. Éteint : rend « interrupteur_eteint » sans rien charger, sans aucun appel.
 * N'écrit que le paramètre `guides.reconciliation` (jamais le site).
 */
export async function reconcilierGuides(deps?: DepsReconciliation): Promise<ResultatReconciliation> {
  if (!guidesReconciliationActif(deps?.env ?? process.env)) return { ok: false, raison: "interrupteur_eteint" };
  let d: DepsReconciliation;
  try {
    d = deps ?? (await depsReelles());
  } catch {
    return { ok: false, raison: "dependances_indisponibles" };
  }
  const memoriser = async (m: MemoireReconciliation) => {
    try {
      await d.ecrireParametre(PARAM_RECONCILIATION, m);
    } catch {
      /* la mémoire ne fait jamais échouer le passage */
    }
  };
  const journal = async (type: string, message: string) => {
    try {
      await d.journaliser(type, message);
    } catch {
      /* idem */
    }
  };
  const site = d.transport();
  if (!site) return { ok: false, raison: "site_non_relie" };

  let studio: VersionStudio[];
  try {
    studio = await d.lireVersionsStudio();
  } catch {
    return { ok: false, raison: "studio_illisible" };
  }
  const codes = [...new Set(studio.map((v) => v.code))].sort().slice(0, MAX_GUIDES_PAR_PASSAGE);
  const ancien = await d.lireParametre(PARAM_RECONCILIATION).catch(() => null);
  const garder = (etat: EtatReconciliation): MemoireReconciliation => {
    const a = (typeof ancien === "object" && ancien !== null ? ancien : {}) as Partial<MemoireReconciliation>;
    // Un échec ne change ni le dernier passage terminé ni les écarts connus : seul l'état dit que le dernier essai a échoué.
    return { dernierPassage: typeof a.dernierPassage === "string" ? a.dernierPassage : null, etat, guidesLus: a.guidesLus ?? 0, lignesIgnorees: a.lignesIgnorees ?? 0, ecarts: Array.isArray(a.ecarts) ? a.ecarts : [], ecartsTronques: a.ecartsTronques === true };
  };

  const deSite: VersionSite[] = [];
  let ignorees = 0;
  for (const code of codes) {
    const l = await lireUnGuide(d, site, code);
    if (l.kind === "pas_pret") {
      await memoriser({ dernierPassage: new Date(d.maintenantMs()).toISOString(), etat: "site_pas_pret", guidesLus: 0, lignesIgnorees: 0, ecarts: [], ecartsTronques: false });
      await journal("guides_reconciliation", "site pas prêt (route absente)");
      return { ok: true, etat: "site_pas_pret" };
    }
    if (l.kind === "indisponible") {
      await memoriser(garder("site_indisponible"));
      await journal("guides_reconciliation", "site indisponible");
      return { ok: false, raison: "site_indisponible" };
    }
    if (l.kind === "illisible") {
      await memoriser(garder("reponse_illisible"));
      await journal("guides_reconciliation", "réponse du site illisible");
      return { ok: false, raison: "reponse_illisible" };
    }
    // Le site ne doit rendre que le guide demandé : une ligne d'un autre code serait un manque au Studio trompeur, on l'écarte.
    for (const v of l.versions) {
      if (v.code === code) deSite.push(v);
      else ignorees++;
    }
    ignorees += l.ignorees;
  }
  const ecarts = comparerVersions(studio, deSite);
  await memoriser({
    dernierPassage: new Date(d.maintenantMs()).toISOString(),
    etat: "compare",
    guidesLus: codes.length,
    lignesIgnorees: ignorees,
    ecarts: ecarts.slice(0, MAX_ECARTS_MEMORISES),
    ecartsTronques: ecarts.length > MAX_ECARTS_MEMORISES,
  });
  await journal("guides_reconciliation", `ecarts=${ecarts.length} guides=${codes.length}`);
  return { ok: true, etat: "compare", ecarts };
}
