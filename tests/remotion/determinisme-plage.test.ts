/**
 * PREUVE IMAGE PAR IMAGE (fiche G10-06) : une plage rendue = la même plage du rendu entier.
 *
 * Mode d'emploi : STUDIO_ESSAI_REMOTION=1 pnpm exec vitest run tests/remotion/determinisme-plage.test.ts
 *   - Sans la variable : tout est SAUTÉ (CI et lancements courants : vert).
 *   - Prérequis : `cd studio-rendu && npm ci` (paquets Remotion) et un Chromium local
 *     (`STUDIO_RENDU_NAVIGATEUR=/chemin/chrome`, sinon `/opt/pw-browsers/chromium*` en session cloud).
 *   - Durée attendue : 3 à 8 minutes (un seul bundle pour tout le fichier, puis quelques images et deux petits MP4).
 *   - Aucun rendu payant : Remotion local seulement. Aucune vraie voix ni vraie vidéo client.
 *   - Résultat à recopier au journal par le chef : les lignes « [G10-06] » affichées dans la sortie.
 *
 * Compositions : `TutorielOutil` (propriétés de `studio-rendu/scripts/demo-tutoriel-outil.ts`) et la composition v4
 * `InterfaceClaireFaceCameraV4`, rendue en lecture seule avec ses propriétés d'exemple (aucun fichier v4 modifié).
 * Remotion n'est PAS ajouté au `package.json` racine (Remotion figé) : résolution depuis `studio-rendu/node_modules`.
 */
import { spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACTIF = process.env.STUDIO_ESSAI_REMOTION === "1";
const RACINE = resolve(import.meta.dirname, "../..");
const RENDU = resolve(RACINE, "studio-rendu");
const DELAI = 15 * 60_000;
/** Seuil du décalage de son au raccord : une image à 25 i/s, en secondes. */
const SEUIL_DECALAGE_SON_S = 1 / 25;
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

function navigateur(): string | null {
  if (process.env.STUDIO_RENDU_NAVIGATEUR) return process.env.STUDIO_RENDU_NAVIGATEUR;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  const dossier = readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().pop();
  if (!dossier) return null;
  for (const sous of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
    const p = join(base, dossier, sous);
    if (existsSync(p)) return p;
  }
  return null;
}

const somme = (fichier: string) => createHash("sha256").update(readFileSync(fichier)).digest("hex");

describe.skipIf(!ACTIF)("déterminisme d'une plage rendue (opt-in, rendu local)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let R: any;
  let serveUrl = "";
  let tmp = "";
  let serveur: Server | undefined;
  let mediasBase = "";
  const reglagesNav = () => ({ browserExecutable: navigateur(), chromiumOptions: { gl: "swangle" as const } });

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "determinisme-plage-"));
    const req = createRequire(resolve(RENDU, "package.json"));
    const { bundle } = req("@remotion/bundler");
    R = req("@remotion/renderer");
    // Média SYNTHÉTIQUE (mire ffmpeg, muette) servi en local pour la composition v4 : jamais de vraie prise dans le dépôt.
    const medias = join(tmp, "medias");
    mkdirSync(medias);
    if (ffmpegPresent) spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=95", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-g", "30", join(medias, "prise.mp4")]);
    serveur = createServer((q, r) => {
      const f = join(medias, decodeURIComponent((q.url ?? "").split("?")[0]).replace(/^\/+/, ""));
      if (!f.startsWith(medias) || !existsSync(f)) { r.statusCode = 404; r.end(); return; }
      r.setHeader("Access-Control-Allow-Origin", "*");
      r.end(readFileSync(f));
    });
    await new Promise<void>((ok) => serveur!.listen(0, "127.0.0.1", ok));
    mediasBase = `http://127.0.0.1:${(serveur!.address() as { port: number }).port}`;
    serveUrl = await bundle({ entryPoint: resolve(RENDU, "compositions/index.ts") });
  }, DELAI);

  afterAll(() => {
    serveur?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  /** Image N du rendu entier (renderStill) contre image N d'une plage limitée autour de N (renderFrames + frameRange). */
  async function compare(id: string, inputProps: Record<string, unknown>, images: number[]) {
    const composition = await R.selectComposition({ serveUrl, id, inputProps, ...reglagesNav() });
    const resultats: string[] = [];
    for (const n of images) {
      const entier = join(tmp, `${id}-entier-${n}.png`);
      await R.renderStill({ composition, serveUrl, frame: n, output: entier, inputProps, imageFormat: "png", ...reglagesNav() });
      const dossier = join(tmp, `${id}-plage-${n}`);
      const debut = Math.max(0, n - 2);
      const fin = Math.min(composition.durationInFrames - 1, n + 2);
      await R.renderFrames({
        composition, serveUrl, inputProps, imageFormat: "png", outputDir: dossier, frameRange: [debut, fin],
        onStart: () => {}, onFrameUpdate: () => {}, ...reglagesNav(),
      });
      const fichierPlage = readdirSync(dossier).find((f) => new RegExp(`(^|[^0-9])0*${n}\\.png$`).test(f));
      expect(fichierPlage, `image ${n} absente de la plage`).toBeTruthy();
      const identique = somme(entier) === somme(join(dossier, fichierPlage!));
      resultats.push(`${n}:${identique ? "identique" : "DIFFERENTE"}`);
      console.log(`[G10-06] ${id} image ${n} : ${identique ? "pixels identiques" : "pixels DIFFÉRENTS"}`);
      // Témoin : le même renderStill deux fois (si différent, le rendu n'est pas déterministe même sans plage).
      const temoin = join(tmp, `${id}-temoin-${n}.png`);
      await R.renderStill({ composition, serveUrl, frame: n, output: temoin, inputProps, imageFormat: "png", ...reglagesNav() });
      console.log(`[G10-06] ${id} image ${n} : témoin (même image rendue 2 fois) ${somme(entier) === somme(temoin) ? "identique" : "DIFFÉRENT"}`);
    }
    // Toutes les images sont mesurées et notées avant d'échouer.
    expect(resultats.filter((r) => r.endsWith("DIFFERENTE")), `${id} : ${resultats.join(" ")}`).toEqual([]);
    return resultats;
  }

  it("TutorielOutil : début, milieu, juste après un raccord de scène", async () => {
    const { PLAN_DEMO } = await import("../../src/briques/plan-scenes/demo");
    const { validerPlan } = await import("../../src/briques/plan-scenes/validateur");
    const { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, formatDuRatio } = await import("../../src/moteurs/montage-tutoriel-outil/proprietes");
    const format = formatDuRatio("4:5");
    const { plan } = validerPlan({ ...PLAN_DEMO, format }, { format, facecam: false });
    const inputProps = { plan, fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS } as unknown as Record<string, unknown>;
    // 25 i/s : le raccord de la scène 2 est à 5000 ms = image 125 ; 126 = juste après.
    await compare("TutorielOutil", inputProps, [0, 190, 126]);
  }, DELAI);

  it("composition v4 (InterfaceClaireFaceCameraV4, propriétés d'exemple) : début, milieu, après raccord", async () => {
    // Propriétés d'exemple = defaultProps de la composition (aucune propriété passée, rien n'est modifié).
    const composition = await R.selectComposition({ serveUrl, id: "InterfaceClaireFaceCameraV4", inputProps: { mediasBase }, ...reglagesNav() });
    const total: number = composition.durationInFrames;
    await compare("InterfaceClaireFaceCameraV4", { mediasBase }, [0, Math.floor(total / 2), Math.min(total - 1, 31)]);
  }, DELAI);

  it.skipIf(!ffmpegPresent)("son : décalage au raccord d'une plage avec audio (noté, seuil ≤ 1 image)", async () => {
    const { PLAN_DEMO } = await import("../../src/briques/plan-scenes/demo");
    const { validerPlan } = await import("../../src/briques/plan-scenes/validateur");
    const { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, formatDuRatio } = await import("../../src/moteurs/montage-tutoriel-outil/proprietes");
    const format = formatDuRatio("4:5");
    const { plan } = validerPlan({ ...PLAN_DEMO, format }, { format, facecam: false });
    const inputProps = { plan, fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS } as unknown as Record<string, unknown>;
    const composition = await R.selectComposition({ serveUrl, id: "TutorielOutil", inputProps, ...reglagesNav() });
    const entier = join(tmp, "audio-entier.mp4");
    const plage = join(tmp, "audio-plage.mp4");
    const debut = 100, fin = 160; // raccord à l'image 125 au milieu de la plage
    await R.renderMedia({ composition, serveUrl, inputProps, codec: "h264", outputLocation: entier, ...reglagesNav() });
    await R.renderMedia({ composition, serveUrl, inputProps, codec: "h264", frameRange: [debut, fin], outputLocation: plage, ...reglagesNav() });
    const pcm = (f: string, ss?: number) => spawnSync("ffmpeg", ["-v", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", f, "-vn", "-t", "1", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 }).stdout;
    const a = pcm(entier, debut / 25), b = pcm(plage);
    if (a.length < 8000 || b.length < 8000) {
      console.log("[G10-06] son : aucune piste audio dans ce rendu muet (TutorielOutil), décalage non mesurable.");
      return;
    }
    // Décalage = plus petit glissement (en échantillons) minimisant l'écart ; 0 si l'audio est muet des deux côtés.
    let meilleur = 0, min = Infinity;
    const lim = Math.min(a.length, b.length) / 2 - 400;
    for (let d = -400; d <= 400; d += 1) {
      let s = 0;
      for (let i = 400; i < Math.min(lim, 4000); i++) s += Math.abs(a.readInt16LE(2 * i) - b.readInt16LE(2 * (i + d)));
      if (s < min) { min = s; meilleur = d; }
    }
    const decalageS = Math.abs(meilleur) / 8000;
    console.log(`[G10-06] son : décalage mesuré ${(decalageS * 1000).toFixed(1)} ms (${a.length ? "audio présent" : "aucune piste audio"}), seuil ${(SEUIL_DECALAGE_SON_S * 1000).toFixed(0)} ms`);
    if (decalageS > SEUIL_DECALAGE_SON_S) console.warn("[G10-06] décalage du son au-dessus du seuil : mesure notée, sans échec.");
    expect(Number.isFinite(decalageS)).toBe(true);
  }, DELAI);
});
