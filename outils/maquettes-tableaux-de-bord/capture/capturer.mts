/**
 * T-EXT-03 : filme la navigation d'une maquette aux durées de la voix DÉJÀ mesurée (cloud ou CI seulement, jamais le PC).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/capture/capturer.mts --maquette <dossier> --scenario <fichier.json> [--calage <fichier.json>] --sortie <dossier hors dépôt>
 *
 * Codes : 0 ok · 2 cible introuvable · 3 environnement interdit · 4 entrée refusée.
 * Zéro euro : aucune voix fabriquée, aucun appel à un fournisseur ; réseau coupé (seuls les fichiers de la maquette passent).
 * Jamais appelé par le Studio. Rien n'est écrit dans le dépôt.
 */
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lireScenarioMaquette, type ScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";
import { adresseAutorisee, environnementAutorise, RACINES_PAR_DEFAUT } from "./garde";
import {
  empreinteCapture,
  lireCalage,
  lireFreezedetect,
  navigationJson,
  nomDossierSortie,
  planCaptures,
  planFilm,
  zonePctDepuisRect,
  type ActionCapture,
  type ActionFilm,
  type Calage,
  type IntervalleFige,
  type MesureEtape,
  type RectPx,
} from "./plan-capture";

const RACINE_DEPOT = fileURLToPath(new URL("../../../", import.meta.url));
const HEURE_FIGEE = new Date("2026-01-15T09:00:00+01:00");
const RETARD_NOTE_MS = 100;
const ATTENTE_CIBLE_MAX_MS = 5000;
const ATTENTE_ANIMATIONS_MAX_MS = 2000;
const MARGE_FIN_FILM_MS = 500;

class Arret extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

interface Rapport {
  requetesBloquees: string[];
  retardsMs: { etapeId: string; retardMs: number }[];
  remarques: string[];
  [cle: string]: unknown;
}

const maintenant = () => performance.now();
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
async function attendreInstant(cibleAbs: number): Promise<number> {
  await dormir(cibleAbs - maintenant());
  return maintenant() - cibleAbs; // retard (≥ 0)
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

async function attendreCible(page: Page, etapeId: string, cible: string, delaiMs: number): Promise<RectPx> {
  try {
    const loc = page.locator(cible).first();
    await loc.waitFor({ state: "visible", timeout: Math.max(1, delaiMs) });
    const b = await loc.boundingBox();
    if (!b) throw new Error("sans boîte");
    return { x: b.x, y: b.y, largeur: b.width, hauteur: b.height };
  } catch {
    throw new Arret(2, `Étape ${etapeId} : cible « ${cible} » introuvable`);
  }
}

async function appelerMaquette(page: Page, methode: "aller" | "reinitialiser", id?: string): Promise<void> {
  await page.evaluate(
    ([m, i]) => {
      const d = (window as unknown as { demoMaquette?: Record<string, (x?: string) => void> }).demoMaquette;
      if (!d || typeof d[m!] !== "function") throw new Error("window.demoMaquette absent");
      d[m!]!(i as string | undefined);
    },
    [methode, id] as const,
  );
}

/** Passe 1 : le film, une seule prise. AUCUNE capture d'image ici (elle ferait saccader la prise). */
async function passeFilm(
  scenario: ScenarioMaquette,
  actions: ActionFilm[],
  calage: Calage,
  urlIndex: string,
  sortie: string,
  rapport: Rapport,
): Promise<{ mesures: MesureEtape[]; debutFilmMs: number; fichier: string }> {
  const browser = await chromium.launch();
  const dossierBrut = join(sortie, "brut");
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      viewport: { width: scenario.largeur, height: scenario.hauteur },
      deviceScaleFactor: 2,
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      recordVideo: { dir: dossierBrut, size: { width: 2 * scenario.largeur, height: 2 * scenario.hauteur } },
    });
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (adresseAutorisee(url, RACINES_MAQUETTE)) await route.continue();
      else {
        rapport.requetesBloquees.push(url);
        await route.abort();
      }
    });
    const creation = maintenant();
    const page = await context.newPage();
    await page.clock.install({ time: HEURE_FIGEE }); // l'heure démarre à une valeur fixe et AVANCE (pas pauseAt)
    await page.goto(urlIndex);
    await appelerMaquette(page, "reinitialiser");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const t0 = maintenant();
    const debutFilmMs = t0 - creation;
    const mesures: MesureEtape[] = [];
    for (const a of actions) {
      const retard = await attendreInstant(t0 + a.gesteMs);
      if (retard > RETARD_NOTE_MS) rapport.retardsMs.push({ etapeId: a.etapeId, retardMs: Math.round(retard) });
      await appelerMaquette(page, "aller", a.aller);
      const instantMs = maintenant() - t0; // instant MESURÉ du « aller »
      let rectPx: RectPx | undefined;
      if (a.cible) rectPx = await attendreCible(page, a.etapeId, a.cible, Math.min(ATTENTE_CIBLE_MAX_MS, a.finMs - a.gesteMs));
      mesures.push(rectPx ? { etapeId: a.etapeId, rectPx, instantMs, finMs: a.finMs } : { etapeId: a.etapeId, instantMs, finMs: a.finMs });
    }
    await attendreInstant(t0 + calage.dureeVoixMs + MARGE_FIN_FILM_MS);
    const video = page.video();
    await context.close(); // le film est écrit à la fermeture
    context = undefined;
    const brut = await video?.path();
    if (!brut) throw new Arret(2, "Le film n'a pas été écrit.");
    const fichier = join(sortie, "navigation.webm");
    renameSync(brut, fichier);
    rmSync(dossierBrut, { recursive: true, force: true });
    return { mesures, debutFilmMs, fichier };
  } finally {
    await context?.close().catch(() => undefined);
    await browser.close();
  }
}

/** Passe 2 : une image par étape pour les contrôles, SANS film. */
async function passeControles(
  scenario: ScenarioMaquette,
  actions: ActionCapture[],
  urlIndex: string,
  sortie: string,
  rapport: Rapport,
): Promise<{ cible: string | undefined; etapeId: string; rectPx?: RectPx }[]> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: scenario.largeur, height: scenario.hauteur },
      deviceScaleFactor: 2,
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
    });
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (adresseAutorisee(url, RACINES_MAQUETTE)) await route.continue();
      else {
        rapport.requetesBloquees.push(url);
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.clock.install({ time: HEURE_FIGEE });
    await page.goto(urlIndex);
    await appelerMaquette(page, "reinitialiser");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const mesures: { cible: string | undefined; etapeId: string; rectPx?: RectPx }[] = [];
    for (const a of actions) {
      await appelerMaquette(page, "aller", a.aller);
      const rectPx = a.cible ? await attendreCible(page, a.etapeId, a.cible, ATTENTE_CIBLE_MAX_MS) : undefined;
      await page.evaluate(
        (max) =>
          Promise.race([
            Promise.all(document.getAnimations().map((x) => x.finished.catch(() => undefined))),
            new Promise((r) => setTimeout(r, max)),
          ]).then(() => undefined),
        ATTENTE_ANIMATIONS_MAX_MS,
      );
      await page.screenshot({ path: join(sortie, a.fichierPng) });
      mesures.push({ cible: a.cible, etapeId: a.etapeId, ...(rectPx ? { rectPx } : {}) });
    }
    await context.close();
    return mesures;
  } finally {
    await browser.close();
  }
}

function sonde(commande: string, argv: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync(commande, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function lireFilm(fichier: string): string {
  const r = sonde("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", fichier]);
  if (!r.ok) return "non mesuré";
  try {
    const j = JSON.parse(r.stdout) as { streams?: { width: number; height: number }[]; format?: { duration?: string } };
    return JSON.stringify({ largeur: j.streams?.[0]?.width, hauteur: j.streams?.[0]?.height, dureeS: Number(j.format?.duration) });
  } catch {
    return "non mesuré";
  }
}

const RACINES_MAQUETTE: string[] = RACINES_PAR_DEFAUT.map((r) => resolve(RACINE_DEPOT, r));

async function principal(): Promise<void> {
  const verdict = environnementAutorise(process.env, process.platform);
  if (!verdict.ok) throw new Arret(3, verdict.raison);
  const a = args();
  for (const k of ["maquette", "scenario", "sortie"]) if (!a[k]) throw new Arret(4, `Argument « --${k} » obligatoire.`);
  const dossierMaquette = resolve(a.maquette!);
  const sortieBase = resolve(a.sortie!);
  const versDepot = relative(RACINE_DEPOT, sortieBase);
  if (!versDepot.startsWith("..") && !isAbsolute(versDepot)) {
    throw new Arret(4, "« --sortie » doit être hors du dépôt.");
  }
  const lecture = lireScenarioMaquette(lireJson(resolve(a.scenario!)));
  if (!lecture.ok) throw new Arret(4, `Scénario refusé :\n- ${lecture.erreurs.join("\n- ")}`);
  const scenario = lecture.scenario;
  let calage: Calage | undefined;
  if (a.calage) {
    const c = lireCalage(lireJson(resolve(a.calage)));
    if (!c.ok) throw new Arret(4, `Calage refusé :\n- ${c.erreurs.join("\n- ")}`);
    calage = c.calage;
  }
  const empreinte = empreinteCapture(scenario, calage);
  const sortie = join(sortieBase, nomDossierSortie(scenario.maquette, empreinte));
  mkdirSync(sortie, { recursive: true });
  RACINES_MAQUETTE.push(dossierMaquette);
  const urlIndex = pathToFileURL(join(dossierMaquette, "index.html")).href;
  const rapport: Rapport = { requetesBloquees: [], retardsMs: [], remarques: [], empreinteCapture: empreinte };

  let film: { mesures: MesureEtape[]; debutFilmMs: number; fichier: string } | undefined;
  if (calage) {
    const plan = planFilm(scenario, calage);
    if (!plan.ok) throw new Arret(4, `Plan refusé :\n- ${plan.erreurs.join("\n- ")}`);
    film = await passeFilm(scenario, plan.actions, calage, urlIndex, sortie, rapport);
  }
  const controles = await passeControles(scenario, planCaptures(scenario), urlIndex, sortie, rapport);

  const cibles = controles.map((c) => {
    const m = film?.mesures.find((x) => x.etapeId === c.etapeId);
    if (film && c.rectPx && m?.rectPx) {
      const ecart = Math.max(
        Math.abs(c.rectPx.x - m.rectPx.x),
        Math.abs(c.rectPx.y - m.rectPx.y),
        Math.abs(c.rectPx.largeur - m.rectPx.largeur),
        Math.abs(c.rectPx.hauteur - m.rectPx.hauteur),
      );
      if (ecart > 2) rapport.remarques.push(`Étape ${c.etapeId} : rectangle différent entre le film et les contrôles (${ecart.toFixed(1)} px) : maquette non déterministe.`);
    }
    const rect = m?.rectPx ?? c.rectPx;
    return {
      etapeId: c.etapeId,
      cible: c.cible,
      rectPx: rect,
      zonePct: rect ? zonePctDepuisRect(rect, scenario.largeur, scenario.hauteur) : undefined,
      instantMs: m ? Math.round(m.instantMs) : undefined,
    };
  });
  writeFileSync(join(sortie, "cibles.json"), JSON.stringify(cibles, null, 2));

  if (film && calage) {
    let figees: IntervalleFige[] | undefined;
    if (sonde("ffmpeg", ["-version"]).ok) {
      const r = sonde("ffmpeg", ["-i", film.fichier, "-vf", "freezedetect=n=0.003:d=0.5", "-f", "null", "-"]);
      figees = lireFreezedetect(r.stderr, film.debutFilmMs);
    } else rapport.remarques.push("immobilité non mesurée");
    const nav = navigationJson({
      maquette: scenario.maquette,
      largeur: scenario.largeur,
      hauteur: scenario.hauteur,
      debutFilmMs: film.debutFilmMs,
      dureeVoixMs: calage.dureeVoixMs,
      mesures: film.mesures,
      ...(figees ? { figees } : {}),
    });
    writeFileSync(join(sortie, "navigation.json"), JSON.stringify(nav, null, 2));
    rapport.debutFilmMs = Math.round(film.debutFilmMs);
    rapport.film = lireFilm(film.fichier);
  }
  rapport.fichiers = readdirSync(sortie).sort();
  writeFileSync(join(sortie, "rapport.json"), JSON.stringify(rapport, null, 2));
  console.log(`Capture écrite dans ${sortie} (${rapport.requetesBloquees.length} requête(s) bloquée(s)).`);
}

principal().catch((e: unknown) => {
  const code = e instanceof Arret ? e.code : 1;
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(code);
});
