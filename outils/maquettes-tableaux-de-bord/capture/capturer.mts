/**
 * T-EXT-03 : filme la navigation d'une maquette aux durées de la voix DÉJÀ mesurée (cloud ou CI seulement, jamais le PC).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/capture/capturer.mts --maquette <dossier> --scenario <fichier.json> [--calage <fichier.json>] [--poste <poste.json>] --sortie <dossier hors dépôt>
 *
 * Codes : 0 ok · 2 cible introuvable · 3 environnement interdit · 4 entrée refusée · 5 FFmpeg absent ou en échec · 6 cadence irrégulière.
 * Film : image par image (horloge de la page arrêtée, 40 ms par image, PNG 2× vers FFmpeg x264).
 * Zéro euro : aucune voix fabriquée, aucun appel à un fournisseur ; réseau coupé (seuls les fichiers de la maquette passent).
 * Jamais appelé par le Studio. Rien n'est écrit dans le dépôt.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lireScenarioMaquette, type ScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";
import {
  argumentsEncodage,
  avancerAnimations,
  empreinteFilm,
  instantDeLImage,
  lireCadence,
  PAS_IMAGE_MS,
  planImages,
  type GesteImage,
  type PlanImages,
} from "./film-images";
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
const ATTENTE_CIBLE_MAX_MS = 5000;
const ATTENTE_ANIMATIONS_MAX_MS = 2000;

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

/** Passe 1 : le film, image par image, à horloge maîtrisée (T-EXT-03b). Le temps de la page n'avance que par nous : 40 ms par image. */
async function passeFilm(
  scenario: ScenarioMaquette,
  plan: Extract<PlanImages, { ok: true }>,
  actions: ActionFilm[],
  urlIndex: string,
  sortie: string,
  rapport: Rapport,
): Promise<{ mesures: MesureEtape[]; debutFilmMs: number; fichier: string; animationsPilotees: number }> {
  if (!sonde("ffmpeg", ["-version"]).ok) throw new Arret(5, "FFmpeg est nécessaire pour le film.");
  const fichier = join(sortie, "navigation.mp4");
  const browser = await chromium.launch({ executablePath: process.env.CAPTURE_CHROMIUM || undefined });
  let encodeur: ChildProcess | undefined;
  try {
    const context = await browser.newContext({
      viewport: { width: scenario.largeur, height: scenario.hauteur },
      deviceScaleFactor: 2,
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      // T-EXT-41 : navigateur sans réseau ni téléchargement ni permission ; jamais `bypassCSP`.
      offline: true,
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
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
    if (!(await page.evaluate(() => document.fonts.check("16px Manrope")))) {
      throw new Arret(4, "Police Manrope absente : la charte n'est pas chargée");
    }
    if (await page.evaluate(() => document.querySelector("video") !== null)) {
      rapport.remarques.push("Une <video> dans la maquette ne suit pas l'horloge : arrêt.");
      throw new Arret(4, "La maquette contient une <video> : elle ne suivrait pas l'horloge du film.");
    }
    // L'horloge simulée a avancé pendant le chargement : on vise une heure lue dans la page, jamais une heure fixe.
    const maintenant = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(new Date(maintenant + 1000)); // à partir d'ici, rien ne bouge sans nous

    const enc = spawn("ffmpeg", argumentsEncodage(fichier), { stdio: ["pipe", "ignore", "pipe"] });
    encodeur = enc;
    let stderrEncodeur = "";
    enc.stderr.on("data", (d: Buffer) => (stderrEncodeur = (stderrEncodeur + d.toString()).slice(-4000)));
    let erreurEncodeur: Error | undefined;
    enc.stdin.on("error", (e) => (erreurEncodeur = e));
    const fini = new Promise<number | null>((ok) => enc.on("close", (code) => ok(code)));
    const entree = enc.stdin;
    const ecrire = (png: Buffer): Promise<void> =>
      new Promise((ok) => {
        if (entree.write(png)) ok();
        else entree.once("drain", () => ok());
      });

    const geste = new Map(plan.gestes.map((g) => [g.image, g] as const));
    const mesures: MesureEtape[] = [];
    const finMsParEtape = new Map(actions.map((a) => [a.etapeId, a.finMs] as const));
    const finDe = (etapeId: string): number => finMsParEtape.get(etapeId) ?? 0;
    let attente: { g: GesteImage; limite: number } | undefined;
    let animationsPilotees = 0;
    for (let i = 0; i < plan.total; i++) {
      const g = geste.get(i);
      if (g) {
        await appelerMaquette(page, "aller", g.aller);
        if (g.cible) attente = { g, limite: i + g.attenteMaxImages };
        else mesures.push({ etapeId: g.etapeId, instantMs: instantDeLImage(i), finMs: finDe(g.etapeId) });
      }
      await page.clock.runFor(PAS_IMAGE_MS);
      animationsPilotees = Math.max(animationsPilotees, await page.evaluate<number>(`(${avancerAnimations.toString()})(document, ${PAS_IMAGE_MS})`));
      if (attente) {
        const loc = page.locator(attente.g.cible!).first();
        const b = (await loc.isVisible()) ? await loc.boundingBox() : null;
        if (b) {
          mesures.push({ etapeId: attente.g.etapeId, rectPx: { x: b.x, y: b.y, largeur: b.width, hauteur: b.height }, instantMs: instantDeLImage(attente.g.image), finMs: finDe(attente.g.etapeId) });
          attente = undefined;
        } else if (i >= attente.limite) {
          throw new Arret(2, `Étape ${attente.g.etapeId} : cible « ${attente.g.cible} » introuvable`);
        }
      }
      if (erreurEncodeur) break;
      await ecrire(await page.screenshot({ type: "png", scale: "device", animations: "allow", caret: "hide" }));
    }
    if (attente) throw new Arret(2, `Étape ${attente.g.etapeId} : cible « ${attente.g.cible} » introuvable`);
    entree.end();
    const code = await fini;
    encodeur = undefined;
    if (code !== 0 || erreurEncodeur) throw new Arret(5, `FFmpeg a échoué : ${stderrEncodeur.trim() || erreurEncodeur?.message || `code ${code}`}`);
    await context.close();

    const sondeCadence = sonde("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time", "-of", "json", fichier]);
    const cadence = sondeCadence.ok ? lireCadence(sondeCadence.stdout, { images: plan.total }) : { ok: false, images: 0, ecartsMs: [], remarques: ["ffprobe indisponible"] };
    if (!cadence.ok) throw new Arret(6, `Cadence irrégulière : ${cadence.remarques.join(" ")}`);
    mesures.sort((x, y) => x.instantMs - y.instantMs);
    return { mesures, debutFilmMs: 0, fichier, animationsPilotees };
  } finally {
    encodeur?.kill();
    await browser.close();
  }
}

/** Plus petite `font-size` calculée (px CSS) des nœuds texte visibles dans le rectangle ; absent s'il n'y a pas de texte. */
async function mesurerPoliceMin(page: Page, r: RectPx): Promise<number | undefined> {
  const v = await page.evaluate((rect) => {
    let min = Infinity;
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const el = n.parentElement;
      if (!el || !(n.textContent ?? "").trim()) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const b = range.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const dedans = b.left >= rect.x - 1 && b.top >= rect.y - 1 && b.right <= rect.x + rect.largeur + 1 && b.bottom <= rect.y + rect.hauteur + 1;
      if (dedans) min = Math.min(min, parseFloat(st.fontSize));
    }
    return Number.isFinite(min) ? min : null;
  }, r);
  return v ?? undefined;
}

/** Passe 2 : une image par étape pour les contrôles, SANS film. */
async function passeControles(
  scenario: ScenarioMaquette,
  actions: ActionCapture[],
  urlIndex: string,
  sortie: string,
  rapport: Rapport,
): Promise<{ cible: string | undefined; etapeId: string; rectPx?: RectPx; policeMinPx?: number }[]> {
  const browser = await chromium.launch({ executablePath: process.env.CAPTURE_CHROMIUM || undefined });
  try {
    const context = await browser.newContext({
      viewport: { width: scenario.largeur, height: scenario.hauteur },
      deviceScaleFactor: 2,
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      // T-EXT-41 : navigateur sans réseau ni téléchargement ni permission ; jamais `bypassCSP`.
      offline: true,
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
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
    const mesures: { cible: string | undefined; etapeId: string; rectPx?: RectPx; policeMinPx?: number }[] = [];
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
      const policeMinPx = rectPx ? await mesurerPoliceMin(page, rectPx) : undefined;
      mesures.push({ cible: a.cible, etapeId: a.etapeId, ...(rectPx ? { rectPx } : {}), ...(policeMinPx !== undefined ? { policeMinPx } : {}) });
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
  let poste: string | undefined;
  if (a.poste) {
    const p = lireJson(resolve(a.poste));
    const e = typeof p === "object" && p !== null ? (p as { empreinte?: unknown }).empreinte : undefined;
    if (typeof e === "string" && e.length > 0) poste = e;
  }
  const empreinte = empreinteCapture(scenario, calage);
  const sortie = join(sortieBase, nomDossierSortie(scenario.maquette, empreinte));
  mkdirSync(sortie, { recursive: true });
  RACINES_MAQUETTE.push(dossierMaquette);
  const urlIndex = pathToFileURL(join(dossierMaquette, "index.html")).href;
  const rapport: Rapport = { requetesBloquees: [], retardsMs: [], remarques: [], empreinteCapture: empreinte };

  let film: { mesures: MesureEtape[]; debutFilmMs: number; fichier: string; animationsPilotees: number } | undefined;
  if (calage) {
    const plan = planFilm(scenario, calage);
    if (!plan.ok) throw new Arret(4, `Plan refusé :\n- ${plan.erreurs.join("\n- ")}`);
    const images = planImages(plan.actions, calage.dureeVoixMs);
    if (!images.ok) throw new Arret(4, `Plan d'images refusé :\n- ${images.erreurs.join("\n- ")}`);
    film = await passeFilm(scenario, images, plan.actions, urlIndex, sortie, rapport);
    rapport.images = images.total;
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
      ...(c.policeMinPx !== undefined ? { policeMinPx: c.policeMinPx } : {}),
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
    rapport.film = "navigation.mp4";
    rapport.methode = "images";
    rapport.imagesParSeconde = 25;
    rapport.animationsPilotees = film.animationsPilotees;
    rapport.cadence = "reguliere";
    rapport.resolution = lireFilm(film.fichier);
    rapport.empreinteFilm = empreinteFilm({ scenario, calage, ...(poste ? { poste } : {}) });
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
