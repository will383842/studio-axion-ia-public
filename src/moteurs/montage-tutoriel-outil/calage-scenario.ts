// T-EXT-02 : caler un scénario de maquette sur la voix mesurée (instants par étape) et produire un suivi d'écran.
// Pur : ni disque, ni réseau, ni horloge. Rien ne l'importe en production.
// Les mots sont en SECONDES (calage mot à mot), le suivi en MILLISECONDES : une seule conversion, `versMs`.
// Aucun seuil de durée codé en dur (H1, risque 3) : `ecartMaxMs` n'existe que s'il est fourni par l'appelant.
import type { SuiviSourceEcran, ZoneSuivi, PointSuivi } from "../../domaine/source-ecran";
import type { ZonePct } from "./artefacts-retouche";
import type { MotTutoriel } from "./etapes-tutoriel";
import type { RoleEtapeScenario, ScenarioMaquette } from "./scenario-maquette";

export interface EtapeCalee {
  id: string;
  role: RoleEtapeScenario;
  debutMs: number;
  finMs: number;
  cible?: string;
  zone?: ZonePct;
}

export interface OptionsCalage {
  /** Aucune valeur par défaut : absent = aucune remarque de durée. */
  ecartMaxMs?: number;
}

export type ResultatCalage =
  | { ok: true; etapes: EtapeCalee[]; suivi: SuiviSourceEcran; remarques: string[] }
  | { ok: false; erreurs: string[] };

/** Cadence nominale du suivi produit (le lecteur G15-01 exige 1-120) ; aucun point de curseur n'en dépend. */
const IMAGES_PAR_SECONDE_SUIVI = 30;

/** Seconde → milliseconde : l'unique conversion du fichier. */
export const versMs = (sec: number): number => Math.round(sec * 1000);

/** Minuscules, sans accents, sans ponctuation de bord. */
function normaliser(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Début (ms) du n-ième passage de `surMot` dans les mots ; `null` si absent. Plusieurs mots : suite exacte. */
function trouverMot(mots: readonly MotTutoriel[], surMot: string, occurrence: number): number | null {
  const cherches = surMot.split(/\s+/).map(normaliser).filter((m) => m.length > 0);
  if (cherches.length === 0) return null;
  const voix = mots.map((m) => normaliser(m.mot));
  let vu = 0;
  for (let i = 0; i + cherches.length <= voix.length; i++) {
    if (cherches.every((c, k) => voix[i + k] === c)) {
      vu++;
      if (vu === occurrence) return versMs(mots[i]!.debutSec);
    }
  }
  return null;
}

export function calerScenario(
  scenario: ScenarioMaquette,
  mots: MotTutoriel[],
  dureeVoixMs: number,
  options: OptionsCalage = {},
): ResultatCalage {
  const erreurs: string[] = [];
  if (!Number.isFinite(dureeVoixMs) || dureeVoixMs <= 0) {
    return { ok: false, erreurs: ["La durée de la voix doit être un nombre positif."] };
  }
  const debuts = new Map<string, number>();
  const debutsMs: number[] = [];
  scenario.etapes.forEach((e) => {
    let debut: number | null = null;
    if ("surMot" in e.ancre) {
      debut = trouverMot(mots, e.ancre.surMot, e.ancre.occurrence ?? 1);
      if (debut === null) {
        const nieme = (e.ancre.occurrence ?? 1) > 1 ? ` (occurrence ${e.ancre.occurrence})` : "";
        erreurs.push(`Étape ${e.id} : le mot « ${e.ancre.surMot} »${nieme} n'est pas dans la voix.`);
      }
    } else {
      const base = debuts.get(e.ancre.apresEtape);
      if (base === undefined) erreurs.push(`Étape ${e.id} : l'étape « ${e.ancre.apresEtape} » n'est pas encore calée.`);
      else debut = base + e.ancre.delaiMs;
    }
    if (debut === null) return;
    debuts.set(e.id, debut);
    debutsMs.push(debut);
  });
  if (erreurs.length > 0) return { ok: false, erreurs };

  scenario.etapes.forEach((e, i) => {
    const d = debutsMs[i]!;
    if (d >= dureeVoixMs) erreurs.push(`Étape ${e.id} : commence à ${d} ms, après la fin de la voix (${dureeVoixMs} ms).`);
    else if (i > 0 && d <= debutsMs[i - 1]!) {
      erreurs.push(`Étape ${e.id} : instants non croissants (${d} ms, après ${debutsMs[i - 1]} ms).`);
    }
  });
  if (erreurs.length > 0) return { ok: false, erreurs };

  const remarques: string[] = [];
  const etapes: EtapeCalee[] = scenario.etapes.map((e, i) => {
    const debutMs = debutsMs[i]!;
    const finMs = i + 1 < debutsMs.length ? debutsMs[i + 1]! : dureeVoixMs;
    const calee: EtapeCalee = { id: e.id, role: e.role, debutMs, finMs };
    if (e.cible !== undefined) calee.cible = e.cible;
    if (e.zone) calee.zone = { ...e.zone };
    if (options.ecartMaxMs !== undefined && finMs - debutMs < options.ecartMaxMs) {
      remarques.push(`Étape ${e.id} : ${finMs - debutMs} ms, plus courte que ${options.ecartMaxMs} ms, à vérifier.`);
    }
    return calee;
  });

  const zones: ZoneSuivi[] = [];
  const clics: PointSuivi[] = [];
  for (const e of etapes) {
    if (!e.zone) continue;
    zones.push({ debutMs: e.debutMs, finMs: e.finMs, ...e.zone, motif: e.id });
    if (e.role === "parcours") {
      clics.push({ tMs: e.debutMs, x: e.zone.x + e.zone.largeur / 2, y: e.zone.y + e.zone.hauteur / 2 });
    }
  }
  const suivi: SuiviSourceEcran = {
    version: 1,
    origine: "fichier",
    imagesParSeconde: IMAGES_PAR_SECONDE_SUIVI,
    largeur: scenario.largeur,
    hauteur: scenario.hauteur,
    curseur: [],
    clics,
    zones,
  };
  return { ok: true, etapes, suivi, remarques };
}
