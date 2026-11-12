/**
 * BRANCHEMENT DE LA SOURCE D'IDÉES DU COMITÉ ÉDITORIAL SUR LA PORTE DE L'USINE (fiche KB-01, suite de L6-03). Serveur seulement.
 *
 * `brancherIdeesUsine()` range, au démarrage, une source dont chaque `tirer(n)` relit d'abord le réglage
 * `comite.source_usine.actif` (ÉTEINT par défaut) et `usineActive()` :
 *  - l'un des deux manque (ou la lecture du réglage échoue) : la simulation sert, la porte n'est jamais appelée ;
 *  - les deux sont là : `sourceIdeesReelle({ actif: true, porte })`, où la porte LIT les idées (plusieurs demandes de 5
 *    jusqu'à `n`, arrêt au premier échec) et convertit chaque `IdeeUsine` en `CombinaisonUsine`.
 * Basculer le réglage ne demande aucun redémarrage : il est relu à chaque lot. Aucune minuterie, aucune écriture vers
 * l'usine (jamais de « retenir »), aucun appel hors de `proposerIdeesUsine`. `fetch` est injectable pour les tests.
 */
import "server-only";
import { NB_IDEES_USINE, type FiltresUsine, type IdeeUsine } from "@/domaine/usine";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import { lireParametre } from "@/services/_commun";
import { brancherSourceIdees, sourceIdeesSimulee, type CombinaisonUsine, type SourceIdees } from "@/services/source-idees";
import { sourceIdeesReelle } from "@/services/source-idees-reelle";
import { proposerIdeesUsine, usineActive } from "@/services/usine-porte";

/** Réglage « le comité lit les idées de l'usine » : faux tant que le fondateur ne l'a pas allumé. */
export const REGLAGE_SOURCE_USINE = "comite.source_usine.actif";

type Env = { USINE_URL?: string; USINE_PORTE_SECRET?: string };
export interface OptionsBranchementIdeesUsine {
  env?: Env;
  fetchImpl?: typeof fetch;
  delaiMs?: number;
}

/** Mêmes filtres que le bloc manuel « Idées de l'usine ». */
function filtres(): FiltresUsine {
  return { type: "video", reseaux: [...RESEAUX_DECLINAISON], metiers: [], tailles: [] };
}

/** Une idée de la porte devient une combinaison du comité (`famille` → `familleAccroche`). */
export function enCombinaison(i: IdeeUsine): CombinaisonUsine {
  const textes: Record<string, string> = { metier: i.metier, taille: i.taille, douleur: i.douleur, casUsage: i.casUsage };
  const facultatifs: [string, string | undefined][] = [["service", i.service], ["sujet", i.sujet], ["format", i.format], ["familleAccroche", i.famille], ["fin", i.fin]];
  for (const [cle, valeur] of facultatifs) if (valeur !== undefined) textes[cle] = valeur;
  return { signature: i.signature, parts: i.parts, textes };
}

async function reglageAllume(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_SOURCE_USINE, false)) === true;
  } catch {
    return false; // lecture impossible : on reste sur la simulation
  }
}

export function brancherIdeesUsine(options: OptionsBranchementIdeesUsine = {}): void {
  const simulation = sourceIdeesSimulee();
  let derniereSimulee = true;
  const porte = async (n: number): Promise<CombinaisonUsine[]> => {
    const sortie: CombinaisonUsine[] = [];
    const vues = new Set<string>();
    const appels = Math.ceil(n / NB_IDEES_USINE);
    for (let k = 0; k < appels && sortie.length < n; k++) {
      let idees: IdeeUsine[];
      try {
        idees = await proposerIdeesUsine(filtres(), { env: options.env, fetchImpl: options.fetchImpl, delaiMs: options.delaiMs });
      } catch {
        break; // premier échec : on s'arrête, on garde les vraies idées déjà reçues
      }
      if (idees.length === 0) break;
      for (const i of idees) {
        if (vues.has(i.signature)) continue;
        vues.add(i.signature);
        sortie.push(enCombinaison(i));
      }
    }
    return sortie.slice(0, n);
  };
  const source: SourceIdees = {
    nom: "Usine (réglage)",
    get simulee() {
      return derniereSimulee;
    },
    async tirer(n: number) {
      const reelle = (await reglageAllume()) && usineActive(options.env);
      derniereSimulee = !reelle;
      return reelle ? sourceIdeesReelle({ actif: true, porte }).tirer(n) : simulation.tirer(n);
    },
  };
  brancherSourceIdees(source);
}
