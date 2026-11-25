// Film d'une vidéo partie d'un DOSSIER .zip, sans équipe de rôles : le `scenario.json` du dossier (schéma `scenario-maquette.v1`)
// tient lieu de parcours. Pur : ni disque, ni réseau, ni horloge, aucun import de service.
import { calerScenario, normaliser } from "./calage-scenario";
import type { MotTutoriel } from "./etapes-tutoriel";
import { lireScenarioMaquette, type AncreEtape, type ScenarioMaquette } from "./scenario-maquette";

const NOM_SCENARIO = "scenario.json";

/** Le `scenario.json` du dossier : à la racine ou, à défaut, l'unique scenario.json d'un sous-dossier direct. `null` : absent, ambigu ou illisible. */
export function scenarioDuDossier(fichiers: { chemin: string; contenu: string }[]): ScenarioMaquette | null {
  const propres = fichiers.map((f) => ({ ...f, chemin: f.chemin.replace(/\\/g, "/").replace(/^\.\//, "") }));
  const racine = propres.filter((f) => f.chemin === NOM_SCENARIO);
  const candidats = racine.length > 0 ? racine : propres.filter((f) => /^[^/]+\/scenario\.json$/.test(f.chemin));
  if (candidats.length !== 1) return null;
  try {
    const lu = lireScenarioMaquette(JSON.parse(candidats[0]!.contenu));
    return lu.ok ? lu.scenario : null;
  } catch {
    return null;
  }
}

/**
 * Le scénario calé sur la voix : tel quel s'il se cale ; sinon (mots d'ancrage absents du script collé) une copie dont les ancres sont
 * réparties régulièrement sur le texte. `null` si le calage échoue encore (trop peu de mots, voix illisible…).
 */
export function scenarioCalable(scenario: ScenarioMaquette, mots: MotTutoriel[], dureeVoixMs: number): ScenarioMaquette | null {
  if (calerScenario(scenario, mots, dureeVoixMs).ok) return scenario;
  const n = mots.length;
  const nb = scenario.etapes.length;
  if (n === 0 || nb === 0) return null;
  const formes = mots.map((m) => normaliser(m.mot));
  const valable = (i: number) => /[\p{L}\p{N}]/u.test(formes[i]!) && !/\s/.test(formes[i]!);
  const etapes = scenario.etapes.map((e, i) => {
    let idx = Math.floor((i * n) / nb);
    while (idx < n && !valable(idx)) idx++;
    if (idx >= n) return null;
    const forme = formes[idx]!;
    let rang = 0;
    for (let k = 0; k <= idx; k++) if (formes[k] === forme) rang++;
    const ancre: AncreEtape = { surMot: forme, occurrence: rang };
    return { ...e, ancre };
  });
  if (etapes.some((e) => e === null)) return null;
  const copie: ScenarioMaquette = { ...scenario, etapes: etapes as ScenarioMaquette["etapes"] };
  return calerScenario(copie, mots, dureeVoixMs).ok ? copie : null;
}
