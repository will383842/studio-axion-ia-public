import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { empreinteEncodage, recollable, type SondeFfprobe } from "../../studio-rendu/src/composition/empreinte-encodage";

/** Sortie ffprobe écrite à la main, calquée sur le master de `ffmpeg.ts` : h264 High, yuv420p, BT.709, plage tv, AAC 48 kHz stéréo. */
function maitre(): SondeFfprobe {
  return {
    streams: [
      {
        codec_type: "video", codec_name: "h264", profile: "High", pix_fmt: "yuv420p", width: 1080, height: 1920,
        r_frame_rate: "30/1", avg_frame_rate: "30/1", time_base: "1/15360",
        color_space: "bt709", color_transfer: "bt709", color_primaries: "bt709", color_range: "tv",
        field_order: "progressive", closed_gop: 1,
      },
      { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2, channel_layout: "stereo" },
    ],
    format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.0" },
  };
}
const copie = (): SondeFfprobe => JSON.parse(JSON.stringify(maitre()));
const video = (s: SondeFfprobe) => s.streams!.find((f) => f.codec_type === "video")!;

describe("empreinte d'encodage", () => {
  it("deux fichiers identiques sont recollables", () => {
    const r = recollable(maitre(), copie());
    expect(r.recollable).toBe(true);
    expect(r.raisons.filter((x) => !x.startsWith("Non vérifié"))).toEqual([]);
  });
  it("un seul fichier conforme au master est recollable", () => {
    expect(recollable(maitre()).recollable).toBe(true);
  });
  it("pix_fmt 8 contre 10 bits : non, avec raison", () => {
    const b = copie();
    video(b).pix_fmt = "yuv420p10le";
    const r = recollable(maitre(), b);
    expect(r.recollable).toBe(false);
    expect(r.raisons.join(" ")).toContain("yuv420p");
  });
  it("cadence différente : raison en français", () => {
    const b = copie();
    video(b).r_frame_rate = "25/1";
    video(b).avg_frame_rate = "25/1";
    const r = recollable(maitre(), b);
    expect(r.recollable).toBe(false);
    expect(r.raisons).toContain("cadence 30 contre 25 i/s");
  });
  it("cadence variable : non", () => {
    const a = copie();
    video(a).avg_frame_rate = "2997/100";
    expect(recollable(a).recollable).toBe(false);
  });
  it("audio présent d'un seul côté : non", () => {
    const b = copie();
    b.streams = b.streams!.filter((f) => f.codec_type !== "audio");
    expect(recollable(maitre(), b).recollable).toBe(false);
    expect(recollable(maitre(), b).raisons.join(" ")).toContain("audio");
  });
  it("audio absent des deux côtés : recollable", () => {
    const a = copie(); a.streams = a.streams!.filter((f) => f.codec_type !== "audio");
    const b = copie(); b.streams = b.streams!.filter((f) => f.codec_type !== "audio");
    expect(recollable(a, b).recollable).toBe(true);
  });
  it("entrelacé ou non h264 : non", () => {
    const a = copie(); video(a).field_order = "tt";
    expect(recollable(a).recollable).toBe(false);
    const b = copie(); video(b).codec_name = "hevc";
    expect(recollable(b).recollable).toBe(false);
  });
  it("champs manquants : non recollable, jamais d'exception", () => {
    const vide: unknown[] = [undefined, null, {}, { streams: [] }, { streams: [{}] }, { streams: "x" }, 42];
    for (const v of vide) {
      expect(() => empreinteEncodage(v as SondeFfprobe)).not.toThrow();
      const r = recollable(v as SondeFfprobe, maitre());
      expect(r.recollable).toBe(false);
      expect(r.raisons.length).toBeGreaterThan(0);
      expect(recollable(v as SondeFfprobe).recollable).toBe(false);
    }
    const a = copie(); delete video(a).pix_fmt;
    expect(recollable(a, a).recollable).toBe(false);
  });
  it("GOP fermée absente : signalée non vérifiée, rien d'inventé", () => {
    const a = copie(); delete video(a).closed_gop;
    expect(recollable(a).raisons.some((x) => x.startsWith("Non vérifié"))).toBe(true);
  });
  it("empreinte stable, ordre des flux indifférent", () => {
    const a = maitre();
    const b = copie(); b.streams!.reverse();
    expect(empreinteEncodage(a)).toBe(empreinteEncodage(a));
    expect(empreinteEncodage(b)).toBe(empreinteEncodage(a));
    expect(empreinteEncodage(a)).toContain("h264");
  });
});

const ffprobePresent = spawnSync("ffprobe", ["-version"]).status === 0;
describe("vrai ffprobe", () => {
  it.skipIf(!ffprobePresent)("sonde un fichier synthétique", () => {
    const f = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=25:d=1",
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
      "-f", "mp4", "pipe:1"], { maxBuffer: 1 << 26 });
    if (f.status !== 0) return;
    const p = spawnSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", "-i", "pipe:0"],
      { input: f.stdout, maxBuffer: 1 << 24 });
    const sonde = JSON.parse(p.stdout.toString()) as SondeFfprobe;
    expect(empreinteEncodage(sonde)).toContain("h264");
    expect(() => recollable(sonde, sonde)).not.toThrow();
  });
});
