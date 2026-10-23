/**
 * « Idées de l'usine » : ce que le comité éditorial a DÉJÀ jugé, pour l'affichage. Serveur seulement, LECTURE SEULE :
 * rien ne part, rien n'est payé. Le comité n'est lancé que par la tâche quotidienne (`travaillerComite`), jamais ici.
 * Éteint (`idees.comite`), plafond des idées du mois atteint ou réserve vide : rien (l'écran garde les idées brutes).
 */
import "server-only";
import { ideeDuComite, type IdeesDuComite } from "@/domaine/usine";
import { comiteAllume, engageIdeesDuMoisCentimes, listerIdeesJugees, plafondIdeesMoisUsd } from "./comite-editorial";

/** Idées écartées montrées au plus (repliées). */
export const ECARTEES_MONTREES = 10;

const RIEN: IdeesDuComite = { retenues: [], ecartees: [] };

export async function ideesDuComitePourAffichage(): Promise<IdeesDuComite> {
  if (!(await comiteAllume())) return RIEN;
  if ((await engageIdeesDuMoisCentimes()) >= Math.round((await plafondIdeesMoisUsd()) * 100)) return RIEN;
  // La réserve du comité : « garder », réelles (jamais simulées), non utilisées ; dans son ordre (meilleures d'abord).
  const retenues = (await listerIdeesJugees({ verdict: "garder" })).filter((i) => !i.simule);
  if (!retenues.length) return RIEN;
  const ecartees = (await listerIdeesJugees({ verdict: "ecarter" })).filter((i) => !i.simule).slice(0, ECARTEES_MONTREES);
  return { retenues: retenues.map(ideeDuComite), ecartees: ecartees.map(ideeDuComite) };
}
