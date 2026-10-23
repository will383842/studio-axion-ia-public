/**
 * Qualité maximale face caméra (09/10, docs/JOURNAL-FFMPEG8-QUALITE.md) : fils de FFmpeg 8 dans l'export (même sortie
 * au bit près), note VMAF de l'export (seuil réglable, relance UNIQUE plus fine) et son alerte côté studio. Sans FFmpeg :
 * les commandes réelles sont exécutées par `studio-rendu/src/controle-ffmpeg.ts` (tests/ffmpeg-reel.test.ts).
 */
import { describe, expect, it } from "vitest";
import { controlesExport, SEUIL_VMAF } from "@/briques/composition/controles";
import type { ParametresExport } from "@/briques/composition/scene";
import { argumentsExport, argumentsVmaf, exportRelance, grapheExport, lireVmaf, seuilVmaf, VMAF } from "../studio-rendu/src/composition/ffmpeg";

const E: ParametresExport = { fps: 25, debitKbps: 18000, debitMaxKbps: 20000, audioKbps: 256, audioHz: 48000, mode: "crf", crf: 17, source10bits: true };
const SON = { lufs: -14, toleranceLufs: 1, creteVraieMaxDbtp: -1.5 };

describe("fils de FFmpeg 8 dans l'export", () => {
  it("`-filter_complex_threads` (le graphe est un -filter_complex) et `scale` découpé sur les fils du conteneur", () => {
    const t = argumentsExport("m.mov", "liste.txt", E, "p", "v.mp4", 4).passe2.join(" ");
    expect(t).toMatch(/^-hide_banner -y -filter_complex_threads 4 -i m\.mov /);
    expect(t).not.toContain("-filter_threads");
    expect(t).toContain("[0:v]scale=threads=4,format=yuv444p10le[m]");
    expect(t).toContain("sws_dither=ed:threads=4,format=yuv420p");
    expect(t).toContain(" -threads 4 ");
  });

  it("sans fils : graphe identique à celui d'avant (8 et 10 bits)", () => {
    expect(grapheExport(true)).toBe(
      "[0:v]format=yuv444p10le[m];[1:v]format=gbrap,scale=out_color_matrix=bt709:out_range=tv,format=yuva444p10le[t];[m][t]overlay=format=yuv444p10:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv:sws_dither=ed,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    );
    expect(grapheExport(false)).toBe(
      "[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[m];[1:v]format=gbrap[t];[m][t]overlay=format=gbrp:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    );
    expect(argumentsExport("m.mov", "l.txt", E, "p", "v.mp4").passe2).not.toContain("-filter_complex_threads");
  });
});

describe("note VMAF de l'export", () => {
  it("référence = le même graphe d'export (master + texte), une image sur 5, journal JSON, fils du conteneur", () => {
    const a = argumentsVmaf("video.mp4", "master.mov", "texte/liste.txt", E, "vmaf.json", 4);
    const t = a.join(" ");
    expect(t).toContain("-i video.mp4 -i master.mov -f concat -safe 0 -i texte/liste.txt");
    const g = a[a.indexOf("-filter_complex") + 1];
    expect(g).toContain("[0:v]setpts=PTS-STARTPTS,select='not(mod(round(t*25)\\,5))',settb=AVTB[dist]");
    expect(g).toContain("[mst]scale=threads=4,format=yuv444p10le[m]");
    expect(g).toContain("[2:v]format=gbrap");
    expect(g).toContain("range=tv[ref]");
    expect(g).toContain("[dist][ref]libvmaf=model=version=vmaf_v0.6.1:log_fmt=json:log_path=vmaf.json:shortest=1:n_threads=4");
    expect(argumentsVmaf("v.mp4", "m.mov", "t.mov", E, "j.json", undefined, 1).join(" ")).not.toContain("select=");
  });

  it("seuil : demande, puis paramètre caché du conteneur, puis 93 ; « non » coupe la note", () => {
    expect(seuilVmaf({}, {})).toBe(93);
    expect(VMAF.seuil).toBe(SEUIL_VMAF);
    expect(seuilVmaf({}, { STUDIO_RENDU_VMAF_MIN: "95" })).toBe(95);
    expect(seuilVmaf({ vmafMin: 90 }, { STUDIO_RENDU_VMAF_MIN: "95" })).toBe(90);
    expect(seuilVmaf({ vmafMin: 0 }, {})).toBe(0);
    expect(seuilVmaf({}, { STUDIO_RENDU_VMAF_MIN: "abc" })).toBe(93);
    expect(seuilVmaf({}, { STUDIO_RENDU_VMAF: "non" })).toBeNull();
  });

  it("lecture du journal libvmaf : moyenne, minimum, 5e centile", () => {
    const frames = [96, 94, 80, 95, 97].map((v, i) => ({ frameNum: i, metrics: { vmaf: v } }));
    const n = lireVmaf(JSON.stringify({ frames, pooled_metrics: { vmaf: { min: 80, mean: 92.4 } } }));
    expect(n).toEqual({ vmaf: 92.4, vmafMin: 80, vmafP5: 80, vmafImages: 5 });
    expect(() => lireVmaf(JSON.stringify({ frames: [] }))).toThrow();
  });

  it("relance UNIQUE : CRF − 3 (plancher 12) ; 2 passes → CRF 14 ; 2 passes imposées → débit + 25 %", () => {
    expect(exportRelance(E, {})).toMatchObject({ mode: "crf", crf: 14 });
    expect(exportRelance({ ...E, crf: 13 }, {})).toMatchObject({ crf: 12 });
    expect(exportRelance({ ...E, crf: 12 }, {})).toBeNull();
    expect(exportRelance({ ...E, mode: "2-passes" }, {})).toMatchObject({ mode: "crf", crf: 14 });
    expect(exportRelance({ ...E, debitKbps: 12000 }, { STUDIO_RENDU_EXPORT: "2-passes" })).toMatchObject({ debitKbps: 15000 });
    expect(exportRelance({ ...E, debitKbps: 20000 }, { STUDIO_RENDU_EXPORT: "2-passes" })).toBeNull();
  });

  it("alerte qualité du studio sous le seuil (renvoyé par studio-rendu), jamais à 0 ni au-dessus", () => {
    const alerte = (m: Record<string, number>) => controlesExport(m, SON).filter((a) => a.message.includes("VMAF"));
    expect(alerte({ vmaf: 95.2, vmafSeuil: 93 })).toEqual([]);
    expect(alerte({ vmaf: 91.3 })).toEqual([{ code: "export", gravite: "attention", message: "Note de qualité de l'image 91,3 sur 100 (VMAF, au moins 93)." }]);
    expect(alerte({ vmaf: 94, vmafSeuil: 96, vmafRelance: 1 })[0].message).toContain("même après un second export plus fin");
    expect(alerte({ vmaf: 50, vmafSeuil: 0 })).toEqual([]);
    expect(alerte({})).toEqual([]);
  });
});
