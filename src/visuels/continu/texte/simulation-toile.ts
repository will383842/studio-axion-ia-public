import { choisirPlan, REGISTRES_PRODUCTION, type EntreePlan, type PlanToile, type RegistresPlan } from "../../../briques/visuels/continu/plan-toile";
import { texteSansLien } from "../../../domaine/visuels/schema";
import { contientJAide, expressionsBannieDans, tutoiementDans } from "../../../domaine/controles-visuel/texte";
import { VERSION_MODELE_TOILE, type PageToile, type RaccordToile } from "../../../domaine/visuels/continu/schema-toile";
import type { FormatToile } from "../../../domaine/visuels/continu/geometrie";

export interface ToileEcrite {
  version: typeof VERSION_MODELE_TOILE;
  format: FormatToile;
  pages: PageToile[];
  raccords: RaccordToile[];
}

export interface ReponseTexteToile {
  titre: string;
  /** Une phrase par page. */
  pourquoi: string[];
  toile: ToileEcrite;
  mode: "simulation" | "session";
}

export interface ReponseSimulationToile extends ReponseTexteToile {
  mode: "simulation";
  plan: PlanToile;
  /** Pourquoi le sujet n'a pas été repris comme titre de couverture. */
  note?: string;
}

const TITRE_MAX = 120;
const NON_REPRIS = "sujet non repris : ";

/** Pourquoi le sujet ne peut pas servir de titre (nombre, mot ou formule à éviter), sinon `undefined`. */
function refusDuSujet(sujet: string): string | undefined {
  if (/\d/u.test(sujet)) return "il contient un nombre";
  if (expressionsBannieDans(sujet).length > 0 || tutoiementDans(sujet) !== undefined || contientJAide(sujet)) return "il contient un mot ou une formule à éviter";
  return undefined;
}

/** Le sujet devient le titre de la première page s'il passe le schéma de sa plaquette (budget compris) et la porte. */
function avecSujet(page: PageToile, sujet: string, registres: RegistresPlan): { page: PageToile; note?: string } {
  const gabarit = registres.gabarits.find((g) => g.type === page.type);
  if (!gabarit || !("titre" in page)) return { page, note: `${NON_REPRIS}cette couverture n'a pas de titre` };
  const refus = refusDuSujet(sujet);
  if (refus) return { page, note: `${NON_REPRIS}${refus}` };
  const candidate = { ...page, titre: sujet.trim() };
  if (!gabarit.schema.safeParse(candidate).success) return { page, note: `${NON_REPRIS}trop long pour la couverture` };
  return { page: candidate };
}

function pourquoiDe(plan: PlanToile, registres: RegistresPlan): string[] {
  const parcours = registres.parcours.find((p) => p.id === plan.parcours);
  return plan.types.map((type) => {
    const g = registres.gabarits.find((x) => x.type === type)!;
    const j = parcours?.pagesTypes.indexOf(type) ?? -1;
    if (parcours && j >= 0) return `${parcours.nom}, page ${j + 1} sur ${parcours.pagesTypes.length} : le visuel continue d'une page à l'autre.`;
    if (g.role === "couverture") return `${g.nom} : pose le sujet en grand titre et donne envie de glisser.`;
    if (g.role === "relance") return `${g.nom} : résume l'idée à retenir avant l'appel.`;
    if (g.role === "appel") return `${g.nom} : une seule action de valeur pour finir.`;
    return `${g.nom} : développe le sujet sous un autre angle.`;
  });
}

/**
 * Simulation (sans IA, sans coût) : remplit le plan avec les `exemple` du registre. Le titre de la première page devient le
 * sujet s'il tient dans son budget ; sinon une `note` le dit. `version` décale le plan (choisirPlan).
 */
export function ecrireToileSimulation(entree: EntreePlan, registres: RegistresPlan = REGISTRES_PRODUCTION): ReponseSimulationToile {
  const plan = choisirPlan(entree, registres);
  const pages = plan.types.map((type) => ({ ...(registres.gabarits.find((g) => g.type === type)!.exemple as PageToile) }));
  const { page, note } = avecSujet(pages[0], entree.sujet, registres);
  pages[0] = page;
  const sujet = entree.sujet.trim();
  const titre = !refusDuSujet(sujet) && texteSansLien(1, TITRE_MAX).safeParse(sujet).success ? sujet : String(pages[0].titre ?? pages[0].alt);
  return {
    titre,
    pourquoi: pourquoiDe(plan, registres),
    toile: { version: VERSION_MODELE_TOILE, format: entree.format, pages, raccords: plan.raccords },
    plan,
    ...(note ? { note } : {}),
    mode: "simulation",
  };
}
