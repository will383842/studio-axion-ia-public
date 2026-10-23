/**
 * Cas hors catalogue (porte B, P2S) retenus pour la SEULE simulation de l'écriture : la variable ne porte que
 * l'identifiant du cas, et `simulerEcriture` (`ecriture.ts`) ne retrouve que les cas du catalogue. Sans effet sur un
 * appel réel (Claude lit la variable, qui dit tout le cas).
 *
 * `avecCasRetenus(role)` rend le même rôle dont la simulation, quand elle ne trouve rien, cherche le cas ici. Le raccord
 * est posé à l'appel (`ecritureClaudeCasConcret`) pour ne pas toucher `ecriture.ts` (écriture des scripts, session 5c).
 */
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { ficheParGabarit, type FicheFixe } from "./ecriture";

const cleCasSimules = Symbol.for("studio-axion-ia.cas-concret-cas-simules");
type AvecCasSimules = typeof globalThis & { [cleCasSimules]?: Map<string, CasConcret> };

const casSimules = (): Map<string, CasConcret> => ((globalThis as AvecCasSimules)[cleCasSimules] ??= new Map());

export function retenirCasPourSimulation(cas: CasConcret): void {
  casSimules().set(cas.id, cas);
}

const balise = (variable: string, nom: string): string | undefined => new RegExp(`<${nom}>\\s*([\\s\\S]*?)\\s*</${nom}>`).exec(variable)?.[1];

/** Même lecture que la simulation du catalogue, pour un cas retenu ici. */
function simulerCasRetenu(entree: EntreeRole): unknown {
  const id = balise(entree.variable, "cas-id");
  const cas = id ? casSimules().get(id) : undefined;
  if (!cas) return "";
  let fixe: FicheFixe = { videoId: "essai", versionId: "essai", habillage: "charte-duo/1", origine: "porte-a" };
  try {
    const lu = JSON.parse(balise(entree.variable, "fiche_fixe") ?? "{}") as Partial<FicheFixe>;
    fixe = { ...fixe, ...Object.fromEntries(Object.entries(lu).filter(([k]) => k in fixe)) };
  } catch {
    // Champs d'essai.
  }
  const lu = (nom: string) => {
    const m = new RegExp(`${nom} (\\d+(?:,\\d+)?) s`).exec(balise(entree.variable, "duree_fins") ?? "");
    return m ? Math.round(Number(m[1].replace(",", ".")) * 1000) : undefined;
  };
  const plusCourteMs = lu("fin la plus courte");
  const plusLongueMs = lu("fin la plus longue");
  return ficheParGabarit(cas, fixe, plusCourteMs !== undefined && plusLongueMs !== undefined ? { plusCourteMs, plusLongueMs } : null);
}

/** Le rôle, sa simulation étendue aux cas retenus (aucun changement pour un cas du catalogue ni pour un appel réel). */
export function avecCasRetenus<R extends Pick<DefinitionRole, "simuler">>(role: R): R {
  const simuler = role.simuler;
  if (!simuler) return role;
  return { ...role, simuler: (entree: EntreeRole) => {
    const r = simuler(entree);
    return r === "" ? (simulerCasRetenu(entree) as ReturnType<typeof simuler>) : r;
  } };
}
