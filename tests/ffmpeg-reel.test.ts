/**
 * FFMPEG RÉEL (09/10, après la panne d'export : `overlay=format=yuv444p10` refusé par le FFmpeg 5.1 de l'image) : les
 * graphes et commandes de studio-rendu (`grapheExport` 8 et 10 bits, export libx264 High 4.1, masters, chaîne du son,
 * étalonnage) sont EXÉCUTÉS avec le FFmpeg du poste, par le même module que le contrôle avant mise en ligne
 * (`deploiement/verifier-outils-video.sh`). Sans FFmpeg sur le poste : sauté, et dit.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { controlerFfmpeg } from "../studio-rendu/src/controle-ffmpeg";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const sonde = spawnSync(FFMPEG, ["-hide_banner", "-version"], { encoding: "utf8" });
const version = sonde.status === 0 ? sonde.stdout.split("\n")[0] : null;
if (!version) console.warn(`[ffmpeg-reel] FFmpeg introuvable (${FFMPEG}) : graphes NON exécutés, test sauté.`);
// Note VMAF (09/10) : libvmaf est dans le FFmpeg 8.1.1 des images ; un FFmpeg de poste sans libvmaf saute ces contrôles (dit).
const vmaf = version !== null && /\blibvmaf\b/.test(spawnSync(FFMPEG, ["-hide_banner", "-filters"], { encoding: "utf8" }).stdout ?? "");
if (version && !vmaf) console.warn("[ffmpeg-reel] FFmpeg du poste sans libvmaf : contrôles de la note VMAF NON exécutés.");

describe.skipIf(!version)(`FFmpeg réel : graphes de studio-rendu exécutés (${version ?? "FFmpeg absent"})`, () => {
  it("chaque commande s'initialise et produit un fichier conforme", async () => {
    const r = await controlerFfmpeg();
    const echecs = r.filter((x) => !x.ok && (vmaf || !x.nom.includes("VMAF"))).map((x) => `${x.nom} : ${x.erreur}`);
    expect(echecs).toEqual([]);
    expect(r.map((x) => x.nom)).toEqual(expect.arrayContaining(["export 8 bits, 2 passes (grapheExport, libx264 High 4.1)", "export 10 bits, 2 passes (grapheExport 10 bits)"]));
  }, 300_000);
});
