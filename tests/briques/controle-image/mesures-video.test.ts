import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlerMesures } from "../../../src/briques/controle-image";
import {
  SEUIL_FIGE_MS,
  agrandissementOk,
  argumentsDetections,
  argumentsSsim,
  lireDetections,
  lireSsim,
  lisibleApresZoom,
  mesuresPourControle,
  noterZones,
  policeApresZoomPx,
  type ZoneMesure,
} from "../../../src/briques/controle-image/mesures-video";

const ZONE: ZoneMesure = {
  id: "z1",
  tSourceSec: 2.5,
  tVideoSec: 4,
  rectSource: { x: 100, y: 200, largeur: 800, hauteur: 400 },
  rectVideo: { x: 50, y: 100, largeur: 400, hauteur: 200 },
  echelleSource: 0.5,
};

const FIN = "video:0kB audio:0kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: unknown\n";
const gel = (d: number, f: number) =>
  `[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: ${d}\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: ${(f - d).toFixed(3)}\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: ${f}\n`;

describe("mesures communes de la vidéo finie", () => {
  it("argumentsSsim : recadre, remet à la taille de sortie, compare une image", () => {
    const a = argumentsSsim({ source: "film.mp4", video: "final.mp4", zone: ZONE })!;
    const g = a[a.indexOf("-filter_complex") + 1];
    expect(g).toContain("crop=800:400:100:200");
    expect(g).toContain("scale=400:200:flags=lanczos");
    expect(g).toContain("format=gray");
    expect(g).toContain("ssim");
    expect(a.join(" ")).toContain("-frames:v 1");
    expect(a).toContain("-ss");
  });

  it("argumentsSsim : adresse réseau ou zone invalide → null", () => {
    expect(argumentsSsim({ source: "https://x.invalid/a.mp4", video: "f.mp4", zone: ZONE })).toBeNull();
    expect(argumentsSsim({ source: "a.mp4", video: "rtmp://x.invalid/f", zone: ZONE })).toBeNull();
    expect(argumentsSsim({ source: "a.mp4", video: "f.mp4", zone: { ...ZONE, rectVideo: { x: 0, y: 0, largeur: 0, hauteur: 5 } } })).toBeNull();
  });

  it("protocoles emboîtés et pipe/data refusés ; chemins locaux acceptés", () => {
    const refus = [
      "cache:https://exemple.invalid/a.mp4",
      "concat:https://exemple.invalid/a.mp4",
      "subfile,,start,0,end,0,,:https://exemple.invalid/a.mp4",
      "pipe:0",
      "data:video/mp4;base64,AAAA",
    ];
    for (const r of refus) {
      expect(argumentsDetections(r), r).toBeNull();
      expect(argumentsSsim({ source: r, video: "f.mp4", zone: ZONE }), r).toBeNull();
      expect(argumentsSsim({ source: "a.mp4", video: r, zone: ZONE }), r).toBeNull();
    }
    for (const ok of ["/tmp/a/final.mp4", "sorties/final.mp4", "./final.mp4"]) expect(argumentsDetections(ok), ok).not.toBeNull();
  });

  it("lireSsim lit la sortie de FFmpeg", () => {
    const sortie = "[Parsed_ssim_5 @ 0x5581] SSIM Y:0.973100 (15.7) U:0.9 V:0.9 All:0.9734 (15.78)\n";
    expect(lireSsim(sortie)).toBeCloseTo(0.9734, 4);
    expect(lireSsim("rien")).toBeNull();
    expect(lireSsim("")).toBeNull();
  });

  it("argumentsDetections : seuils attendus", () => {
    const a = argumentsDetections("final.mp4")!;
    const vf = a[a.indexOf("-vf") + 1];
    expect(vf).toBe("freezedetect=n=0.003:d=1.5,blackdetect=d=0.1:pix_th=0.1");
    expect(a.slice(-3)).toEqual(["-f", "null", "-"]);
    expect(argumentsDetections("http://x.invalid/f.mp4")).toBeNull();
    expect(SEUIL_FIGE_MS).toBe(1500);
  });

  it("lireDetections : gel de 2 s au milieu → 1", () => {
    expect(lireDetections(gel(5, 7) + FIN, { finUtileMs: 20000 }).imagesFigeesHorsFin).toBe(1);
  });
  it("lireDetections : gel de 1,4 s → 0", () => {
    expect(lireDetections(gel(5, 6.4) + FIN, { finUtileMs: 20000 }).imagesFigeesHorsFin).toBe(0);
  });
  it("lireDetections : gel jusqu'à la fin du fichier (sans freeze_end) est compté", () => {
    const duree = "  Duration: 00:00:06.00, start: 0.000000, bitrate: 100 kb/s\n";
    const sansFin = "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 3\n";
    expect(lireDetections(duree + sansFin + FIN, { finUtileMs: 6000 }).imagesFigeesHorsFin).toBe(1);
  });
  it("lireDetections : gel qui se prolonge dans la carte de fin : seule la partie avant la fin utile compte", () => {
    expect(lireDetections(gel(5, 12) + FIN, { finUtileMs: 10000 }).imagesFigeesHorsFin).toBe(1); // 5 s avant la fin utile
    expect(lireDetections(gel(9, 12) + FIN, { finUtileMs: 10000 }).imagesFigeesHorsFin).toBe(0); // 1 s avant la fin utile
  });
  it("lireDetections : gel pendant la fin → 0 (terminé après, ou sans fin)", () => {
    expect(lireDetections(gel(18, 21) + FIN, { finUtileMs: 17000 }).imagesFigeesHorsFin).toBe(0);
    const sansFin = "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 18\n" + FIN;
    expect(lireDetections(sansFin, { finUtileMs: 17000 }).imagesFigeesHorsFin).toBe(0);
  });
  it("lireDetections : noir en tête, noir au milieu", () => {
    const tete = "[blackdetect @ 0x2] black_start:0 black_end:0.5 black_duration:0.5\n" + FIN;
    expect(lireDetections(tete, { finUtileMs: 20000 })).toMatchObject({ imageNoireTete: 1, imagesNoiresHorsFin: 0 });
    const milieu = "[blackdetect @ 0x2] black_start:8 black_end:8.4 black_duration:0.4\n" + FIN;
    expect(lireDetections(milieu, { finUtileMs: 20000 })).toMatchObject({ imageNoireTete: 0, imagesNoiresHorsFin: 1 });
  });
  it("lireDetections : sortie vide ou illisible → {}", () => {
    expect(lireDetections("", { finUtileMs: 1000 })).toEqual({});
    expect(lireDetections("bruit", { finUtileMs: 1000 })).toEqual({});
    expect(lireDetections(FIN, { finUtileMs: Number.NaN })).toEqual({});
  });

  it("le contrôle de master voit noir et figé comme mesurés, et « non fait » sur {}", () => {
    const m = mesuresPourControle(lireDetections(gel(5, 7) + FIN, { finUtileMs: 20000 }));
    const r = controlerMesures(m);
    const figee = r.find((c) => c.id === "image-figee")!;
    const noire = r.find((c) => c.id === "image-noire")!;
    expect(figee.etat).toBe("echoue");
    expect(noire.etat).toBe("reussi");
    const vide = controlerMesures(mesuresPourControle(lireDetections("", { finUtileMs: 1000 })));
    expect(vide.find((c) => c.id === "image-figee")!.etat).toBe("non-fait");
    expect(vide.find((c) => c.id === "image-noire")!.etat).toBe("non-fait");
  });

  it("agrandissement et police après zoom", () => {
    expect(agrandissementOk(0.8)).toBe(true);
    expect(agrandissementOk(1)).toBe(true);
    expect(agrandissementOk(1.25)).toBe(false);
    expect(policeApresZoomPx(26, 0.5)).toBe(13);
    expect(lisibleApresZoom(13, 41)).toBe(false);
    expect(lisibleApresZoom(48, 41)).toBe(true);
  });

  it("noterZones : ok, à revoir (phrases simples), non mesuré", () => {
    const zones: ZoneMesure[] = [
      { ...ZONE, id: "a", echelleSource: 0.8, policeSourcePx: 60, minimumPx: 41 },
      { ...ZONE, id: "b" },
      { ...ZONE, id: "c" },
      { ...ZONE, id: "d", echelleSource: 1.25 },
      { ...ZONE, id: "e", echelleSource: 0.5, policeSourcePx: 64, minimumPx: 41 },
    ];
    const r = noterZones(zones, { a: 0.95, b: 0.84, c: null, d: 0.99, e: 0.95 });
    expect(r[0]).toMatchObject({ verdict: "ok", raisons: [], policeEffectivePx: 48 });
    expect(r[1].verdict).toBe("a-revoir");
    expect(r[1].raisons).toEqual(["Zone « b » : le texte perd en netteté (score 0,84)."]);
    expect(r[2]).toMatchObject({ verdict: "non-mesure", ssim: null });
    expect(r[3].raisons).toEqual(["Zone « d » : le zoom agrandit l'image au-delà de sa finesse."]);
    expect(r[4].raisons).toEqual(["Zone « e » : le plus petit texte montré fait 32 px, il en faut 41."]);
    for (const m of r) for (const t of m.raisons) expect(t).not.toMatch(/ssim|\$|€/i);
  });

  it("le fichier reste pur : ni service, ni moteur, ni node:", () => {
    const t = readFileSync("src/briques/controle-image/mesures-video.ts", "utf8");
    expect(t).not.toMatch(/@\/services|montage-|node:/);
    const imports = [...t.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./seuils", "./types"]);
  });
});
