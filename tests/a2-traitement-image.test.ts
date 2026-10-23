/**
 * LOT A2 — opération `traitement-image` de `studio-rendu` : zones floutées sur une COPIE, vignette 9:16, mesures.
 * Graphes FFmpeg PURS, puis un vrai passage FFmpeg (si présent) par un petit serveur local qui joue le stockage :
 * l'original est lu, le résultat déposé à part, l'original n'est jamais modifié.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { filtreVignette, grapheFlou, traitementImage, zonesBornees } from "../studio-rendu/src/operations/traitement-image";
import { OPERATIONS } from "../studio-rendu/src/contrat";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("traitement-image : graphes purs", () => {
  it("l'opération est déclarée au contrat", () => expect(OPERATIONS).toContain("traitement-image"));
  it("zones bornées à l'image, dimensions paires, zones vides retirées", () => {
    expect(zonesBornees([{ x: -10, y: 5, largeur: 51, hauteur: 2000 }, { x: 999, y: 999, largeur: 10, hauteur: 10 }], 1000, 600)).toEqual([{ x: 0, y: 5, largeur: 50, hauteur: 594 }, { x: 998, y: 598, largeur: 2, hauteur: 2 }]);
  });
  it("chaque zone est découpée, floutée, reposée à sa place", () => {
    const g = grapheFlou([{ x: 10, y: 20, largeur: 100, hauteur: 40 }, { x: 200, y: 50, largeur: 60, hauteur: 60 }]);
    expect(g).toContain("split=3[base][s0][s1]");
    expect(g).toContain("[s0]crop=100:40:10:20,boxblur=10:3[f0]");
    expect(g).toContain("[base][f0]overlay=10:20[o0]");
    expect(g).toContain("[o0][f1]overlay=200:50[out]");
    expect(grapheFlou([])).toBe("[0:v]null[out]");
  });
  it("vignette : recadrage 9:16 autour du point d'intérêt, dans l'image", () => {
    expect(filtreVignette(1920, 1080, { x: 0.9, y: 0.5 })).toBe("crop=606:1080:1314:0,scale=540:960:flags=lanczos");
    expect(filtreVignette(1080, 1920, { x: 0.5, y: 0.5 })).toBe("crop=1080:1920:0:0,scale=540:960:flags=lanczos");
  });
});

describe.skipIf(!ffmpegPresent)("traitement-image : vrai passage FFmpeg", { timeout: 60_000 }, () => {
  let serveur: Server;
  let base = "";
  const recus = new Map<string, Buffer>();
  const dossier = mkdtempSync(join(tmpdir(), "a2-traitement-"));
  const original = join(dossier, "original.png");

  beforeAll(async () => {
    // Une image de test : damier contrasté 400 × 200 (le flou y est mesurable).
    spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=400x200", "-frames:v", "1", original]);
    serveur = createServer((req, res) => {
      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(readFileSync(original));
        return;
      }
      const morceaux: Buffer[] = [];
      req.on("data", (c: Buffer) => morceaux.push(c));
      req.on("end", () => {
        recus.set(req.url ?? "", Buffer.concat(morceaux));
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });
  afterAll(() => serveur.close());

  const contexte = (nom: string) => {
    const d = join(dossier, nom);
    mkdirSync(d, { recursive: true });
    return { progression: () => undefined, dossier: d, signal: new AbortController().signal };
  };
  const empreinte = (b: Buffer) => createHash("sha256").update(b).digest("hex");

  it("flouter : une COPIE JPEG est déposée, l'original n'a pas bougé ; mesures rendues", async () => {
    const avant = empreinte(readFileSync(original));
    const r = await traitementImage(
      { idRendu: "t1", operation: "traitement-image", file: "courte", entrees: { image: `${base}/original.png` }, sortie: { urlDepot: `${base}/depot/floutee.jpg`, cle: "x" }, parametres: { mode: "flouter", zones: [{ x: 50, y: 50, largeur: 100, hauteur: 80 }] } },
      contexte("flou"),
    );
    expect(r.mesures).toMatchObject({ largeur: 400, hauteur: 200, zones: 1 });
    const copie = recus.get("/depot/floutee.jpg")!;
    expect(copie.subarray(0, 2).toString("hex")).toBe("ffd8"); // JPEG
    expect(empreinte(readFileSync(original))).toBe(avant);
    writeFileSync(join(dossier, "floutee.jpg"), copie);
    // La zone floutée a perdu son détail (variance des pixels bien plus faible) ; hors zone, l'image est la même.
    const variance = (chemin: string, crop: string) => {
      const px = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-i", chemin, "-vf", `crop=${crop},format=gray`, "-f", "rawvideo", "-"]).stdout as Buffer;
      const m = px.reduce((t, v) => t + v, 0) / px.length;
      return px.reduce((t, v) => t + (v - m) ** 2, 0) / px.length;
    };
    const floutee = join(dossier, "floutee.jpg");
    expect(variance(floutee, "80:60:60:60")).toBeLessThan(variance(original, "80:60:60:60") * 0.6);
    expect(variance(floutee, "40:40:300:120")).toBeGreaterThan(variance(original, "40:40:300:120") * 0.7);
  });

  it("vignette 540 × 960 ; mesurer : largeur, hauteur, luminosité", async () => {
    await traitementImage({ idRendu: "t2", operation: "traitement-image", file: "courte", entrees: { image: `${base}/original.png` }, sortie: { urlDepot: `${base}/depot/vignette.jpg`, cle: "x" }, parametres: { mode: "vignette", point: { x: 0.5, y: 0.5 } } }, contexte("vignette"));
    writeFileSync(join(dossier, "vignette.jpg"), recus.get("/depot/vignette.jpg")!);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(dossier, "vignette.jpg")], { encoding: "utf8" });
    expect(probe.stdout.trim()).toBe("540,960");
    const m = await traitementImage({ idRendu: "t3", operation: "traitement-image", file: "courte", entrees: { image: `${base}/original.png` }, sortie: { urlDepot: `${base}/depot/m.json`, cle: "x" }, parametres: { mode: "mesurer" } }, contexte("mesurer"));
    expect(m.mesures?.largeur).toBe(400);
    expect(m.mesures?.luminosite).toBeGreaterThan(0);
  });

  it("mode inconnu ou entrée manquante : refus clair", async () => {
    await expect(traitementImage({ idRendu: "t4", operation: "traitement-image", file: "courte", entrees: {}, sortie: { urlDepot: "", cle: "x" }, parametres: { mode: "flouter" } }, contexte("refus"))).rejects.toThrow(/manquante/);
    await expect(traitementImage({ idRendu: "t5", operation: "traitement-image", file: "courte", entrees: { image: `${base}/o.png` }, sortie: { urlDepot: "", cle: "x" }, parametres: { mode: "effacer" } }, contexte("refus2"))).rejects.toThrow(/inconnu/);
  });
});
