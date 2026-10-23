/**
 * LOT 1 DES VIGNETTES — opération `miniature` de studio-rendu (étape 5, 17/10). Rendu Remotion INJECTÉ : aucun
 * navigateur, aucun réseau extérieur. FFmpeg local (comme les tests R4) ; le test est sauté s'il manque.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerOperationMiniature, OCTETS_MAX_MINIATURE } from "../studio-rendu/src/operations/miniature";
import type { DemandeRendu } from "../studio-rendu/src/contrat";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!ffmpegPresent)("vignettes lot 1 · opération miniature", { timeout: 90_000 }, () => {
  let serveur: Server;
  let base = "";
  const recus = new Map<string, Buffer>();
  const requetes: string[] = [];
  const dossier = mkdtempSync(join(tmpdir(), "vignettes-lot1-op-"));
  const video = join(dossier, "video.mp4");
  const png = join(dossier, "sujet.png");

  beforeAll(async () => {
    expect(spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=25:duration=4", "-c:v", "libx264", "-g", "1", "-pix_fmt", "yuv420p", video]).status).toBe(0);
    expect(spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=red:size=64x64", "-frames:v", "1", png]).status).toBe(0);
    serveur = createServer((req, res) => {
      requetes.push(`${req.method} ${req.url}`);
      if (req.method === "GET" || req.method === "HEAD") {
        const contenu = readFileSync(req.url === "/sujet.png" ? png : video);
        const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
        if (plage) {
          const debut = plage[1] ? Number(plage[1]) : 0;
          const fin = plage[2] ? Math.min(contenu.length - 1, Number(plage[2])) : contenu.length - 1;
          res.writeHead(206, { "content-type": "video/mp4", "content-length": fin - debut + 1, "content-range": `bytes ${debut}-${fin}/${contenu.length}`, "accept-ranges": "bytes" });
          res.end(req.method === "HEAD" ? undefined : contenu.subarray(debut, fin + 1));
          return;
        }
        res.writeHead(200, { "content-type": req.url === "/sujet.png" ? "image/png" : "video/mp4", "content-length": contenu.length, "accept-ranges": "bytes" });
        res.end(req.method === "HEAD" ? undefined : contenu);
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

  /** Rendu d'essai : un PNG uni de la bonne taille ; note les propriétés et la composition demandées. */
  function essai() {
    const vus: { id: string; proprietes: Record<string, unknown> }[] = [];
    const png = (proprietes: unknown, sortiePng: string) => {
      const taille = (proprietes as { ratio: string }).ratio === "16:9" ? "1280x720" : "1080x1920";
      expect(spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", `color=c=0x303030:size=${taille}`, "-frames:v", "1", sortiePng]).status).toBe(0);
    };
    const rendre = async (proprietes: unknown, sortiePng: string) => {
      vus.push({ id: "Miniature", proprietes: proprietes as Record<string, unknown> });
      png(proprietes, sortiePng);
    };
    const rendreVignette = async (proprietes: unknown, sortiePng: string) => {
      vus.push({ id: "VignetteAxion", proprietes: proprietes as Record<string, unknown> });
      png(proprietes, sortiePng);
    };
    return { vus, op: creerOperationMiniature(rendre as never, rendreVignette as never) };
  }

  function demande(parametres: Record<string, unknown>, entrees: Record<string, string> = { video: `${base}/video.mp4` }): DemandeRendu {
    return { idRendu: "v-1", operation: "miniature", file: "courte", entrees, sortie: { urlDepot: `${base}/depot/v.jpg`, cle: "x" }, parametres } as DemandeRendu;
  }
  function contexte() {
    const travail = mkdtempSync(join(dossier, "t-"));
    mkdirSync(travail, { recursive: true });
    return { progression: () => undefined, dossier: travail, signal: new AbortController().signal };
  }

  it("sans gabarit ou « r4 » : composition Miniature, propriétés identiques à avant", async () => {
    const attendu = { ratio: "9:16", couverture: "Un PV de 135 € ?", motCle: "135 €", variante: "etiquettes", image: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/fond\.png$/) };
    for (const gabarit of [undefined, "r4"]) {
      const { op, vus } = essai();
      const parametres = { instantSec: 2, dureeSec: 4, ratio: "9:16", couverture: "Un PV de 135 € ?", motCle: "135 €", variante: 1, ...(gabarit ? { gabarit } : {}) };
      await op(demande(parametres), contexte());
      expect(vus).toEqual([{ id: "Miniature", proprietes: attendu }]);
    }
  });

  it("« axion-v2 » : composition VignetteAxion, ambiance et mise transmises, titre tronqué à 80 caractères", async () => {
    const { op, vus } = essai();
    const long = "A".repeat(100);
    await op(demande({ gabarit: "axion-v2", instantSec: 2, dureeSec: 4, ratio: "16:9", couverture: long, motCle: "A", ambiance: "ivoire", mise: "m2", generateur: "facecam" }), contexte());
    expect(vus).toHaveLength(1);
    expect(vus[0].id).toBe("VignetteAxion");
    expect(vus[0].proprietes).toMatchObject({ ratio: "16:9", ambiance: "ivoire", mise: "m2", instagram: false, couverture: "A".repeat(80), motCle: "A", image: expect.stringMatching(/\/fond\.png$/) });
    expect(vus[0].proprietes.sujet).toBeUndefined();
  });

  it("« axion-v2 » : JPEG ≤ 2 Mo, déposé, à la bonne taille", async () => {
    const { op } = essai();
    await op(demande({ gabarit: "axion-v2", instantSec: 2, dureeSec: 4, ratio: "9:16", couverture: "Un devis en 2 minutes", motCle: "2 minutes" }), contexte());
    const jpeg = recus.get("/depot/v.jpg")!;
    expect(jpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(jpeg.length).toBeLessThanOrEqual(OCTETS_MAX_MINIATURE);
    const sonde = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", "-"], { input: jpeg });
    expect(sonde.stdout.toString().trim()).toBe("1080,1920");
  });

  it("Instagram : aucune image extraite de la vidéo, aucun sujet, ratio forcé 9:16", async () => {
    const { op, vus } = essai();
    const ctx = contexte();
    requetes.length = 0;
    await op(demande({ gabarit: "axion-v2", instagram: true, ratio: "16:9", couverture: "Où fuit votre temps", motCle: "temps" }, { video: `${base}/video.mp4`, sujet: `${base}/sujet.png` }), ctx);
    expect(vus[0].id).toBe("VignetteAxion");
    expect(vus[0].proprietes).toMatchObject({ ratio: "9:16", instagram: true });
    expect(vus[0].proprietes.image).toBeUndefined();
    expect(vus[0].proprietes.sujet).toBeUndefined();
    expect(readdirSync(ctx.dossier).filter((f) => f.startsWith("candidat-"))).toEqual([]);
    expect(requetes.filter((r) => r.includes("video.mp4") || r.includes("sujet.png"))).toEqual([]);
  });

  it("entrée « sujet » d'un hôte non permis : refus", async () => {
    const { op } = essai();
    await expect(op(demande({ gabarit: "axion-v2", instantSec: 2, dureeSec: 4, ratio: "9:16", couverture: "Où fuit votre temps" }, { video: `${base}/video.mp4`, sujet: "https://exemple.invalide/s.png" }), contexte())).rejects.toThrow(/refus/i);
  });

  it("entrée « sujet » permise : transmise au rendu, servie depuis le dossier de travail ou l'adresse permise", async () => {
    const { op, vus } = essai();
    await op(demande({ gabarit: "axion-v2", instantSec: 2, dureeSec: 4, ratio: "9:16", couverture: "Où fuit votre temps", motCle: "temps" }, { video: `${base}/video.mp4`, sujet: `${base}/sujet.png` }), contexte());
    expect(vus[0].proprietes.sujet).toBe(`${base}/sujet.png`);
    expect(vus[0].proprietes.image).toBeUndefined();
  });

  it("ratio 4:5 ou 1:1 refusé en axion-v2", async () => {
    const { op } = essai();
    await expect(op(demande({ gabarit: "axion-v2", instantSec: 2, dureeSec: 4, ratio: "4:5", couverture: "X" }), contexte())).rejects.toThrow(/16:9|9:16/);
  });
});
