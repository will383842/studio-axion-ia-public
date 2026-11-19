/**
 * T-EXT-54d : écrit `zones.json`, la liste des zones à mesurer dans la vidéo finie d'un tutoriel (cloud ou CI seulement, jamais le PC).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/controle/zones-tutoriel.mts --navigation navigation.json --cibles cibles.json --ratio 4:5 [--motion motion.json] [--minimum-px N pour forcer] --sortie <dossier hors dépôt>
 *
 * Codes : 0 ok · 3 environnement interdit · 4 entrée refusée.
 * Aucun FFmpeg, aucun réseau, aucun navigateur : calcul de géométrie seulement. `motion.json` absent : poses recalculées par `motion-film.ts`
 * avec les réglages par défaut (dit dans la sortie). `zones.json` est l'entrée `--zones` du lanceur commun de mesure (54b).
 * Jamais appelé par le Studio. Rien n'est écrit dans le dépôt.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lireNavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";
import { planMotionFilm, type PlanMotionFilm } from "../../../src/briques/plan-scenes/tutoriel/motion-film";
import { formatDuRatio, zonesTutoriel, type CibleMesuree } from "../../../src/moteurs/montage-tutoriel-outil/nettete";
import { environnementAutorise } from "../capture/garde";

const RACINE_DEPOT = fileURLToPath(new URL("../../../", import.meta.url));
/** Définition de la capture : 2× la page (voir `capturer.mts`). */
const ECHELLE_CAPTURE = 2;

class Arret extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function args(): Record<string, string> {
  const sortie: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) {
    if (!a[i]?.startsWith("--") || a[i + 1] === undefined) throw new Arret(4, `Argument invalide près de « ${a[i] ?? ""} ».`);
    sortie[a[i]!.slice(2)] = a[i + 1]!;
  }
  return sortie;
}

function lireJson(chemin: string): unknown {
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    throw new Arret(4, `Fichier illisible : ${chemin}`);
  }
}

function principal(): void {
  const verdict = environnementAutorise(process.env, process.platform);
  if (!verdict.ok) throw new Arret(3, verdict.raison);
  const a = args();
  for (const k of ["navigation", "cibles", "ratio", "sortie"]) if (!a[k]) throw new Arret(4, `Argument « --${k} » obligatoire.`);
  const sortie = resolve(a.sortie!);
  const versDepot = relative(RACINE_DEPOT, sortie);
  if (!versDepot.startsWith("..") && !isAbsolute(versDepot)) throw new Arret(4, "« --sortie » doit être hors du dépôt.");
  const format = formatDuRatio(a.ratio!);
  if (!format) throw new Arret(4, `Ratio inconnu : « ${a.ratio} ».`);
  const lecture = lireNavigationFilmee(lireJson(resolve(a.navigation!)));
  if (!lecture.ok) throw new Arret(4, `Navigation refusée :\n- ${lecture.erreurs.join("\n- ")}`);
  const nav = lecture.navigation;
  const brutCibles = lireJson(resolve(a.cibles!));
  if (!Array.isArray(brutCibles)) throw new Arret(4, "Les cibles doivent être une liste.");
  const cibles: CibleMesuree[] = brutCibles
    .filter((c): c is { etapeId: string; policeMinPx?: unknown } => !!c && typeof c === "object" && typeof (c as { etapeId?: unknown }).etapeId === "string")
    .map((c) => ({ etapeId: c.etapeId, ...(typeof c.policeMinPx === "number" && Number.isFinite(c.policeMinPx) ? { policeMinPx: c.policeMinPx } : {}) }));
  let plan: PlanMotionFilm;
  if (a.motion) {
    const brut = lireJson(resolve(a.motion)) as Partial<PlanMotionFilm> | null;
    if (!brut || !Array.isArray(brut.camera) || !Array.isArray(brut.clics) || !Array.isArray(brut.curseur)) throw new Arret(4, "Le plan de motion est illisible.");
    plan = brut as PlanMotionFilm;
  } else {
    plan = planMotionFilm(nav, format);
    console.log("Aucun plan de motion fourni : les poses de la caméra sont recalculées avec les réglages par défaut.");
  }
  const minimumPx = a["minimum-px"] !== undefined ? Number(a["minimum-px"]) : undefined;
  if (minimumPx !== undefined && !(Number.isFinite(minimumPx) && minimumPx > 0)) throw new Arret(4, "« --minimum-px » doit être un nombre positif.");
  const zones = zonesTutoriel(nav, plan, format, { largeurPx: nav.largeur * ECHELLE_CAPTURE, hauteurPx: nav.hauteur * ECHELLE_CAPTURE }, cibles, minimumPx !== undefined ? { minimumPx } : {});
  mkdirSync(sortie, { recursive: true });
  writeFileSync(join(sortie, "zones.json"), JSON.stringify(zones, null, 2));
  console.log(`${zones.length} zone${zones.length > 1 ? "s" : ""} à mesurer écrite${zones.length > 1 ? "s" : ""} dans zones.json.`);
}

try {
  principal();
} catch (e) {
  if (e instanceof Arret) {
    console.error(e.message);
    process.exit(e.code);
  }
  throw e;
}
