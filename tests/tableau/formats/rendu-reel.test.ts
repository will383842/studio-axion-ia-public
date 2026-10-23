/**
 * RENDU RÉEL d'une scène témoin dans chaque format de sortie (quand Chromium, Remotion de `studio-rendu` et FFmpeg sont
 * là) : la composition `TableauScene` rendue en H.264 comme en production (CRF 12) a les dimensions EXACTES du format
 * et aucune colonne ni rangée noire au bord. Sans ces outils, le test est sauté (et le dit).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDS_FORMATS_SORTIE, formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { bordsNoirs } from "../../../studio-rendu/src/controle-bords";
import { ficheDemonstration } from "../regles/exemples";
import { scenesFormat } from "./outils";

const RACINE = join(__dirname, "../../..");
const NAVIGATEUR = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const REMOTION = existsSync(join(RACINE, "studio-rendu/node_modules/@remotion/renderer"));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const outils = spawnSync(FFPROBE, ["-version"]).status === 0 && spawnSync(FFMPEG, ["-version"]).status === 0;
const possible = !!NAVIGATEUR && REMOTION && outils;
if (!possible) console.warn(`[rendu-reel] rendu réel NON fait (navigateur : ${NAVIGATEUR ?? "absent"} ; Remotion : ${REMOTION ? "oui" : "absent"} ; FFmpeg : ${outils ? "oui" : "absent"}).`);

interface Choisie {
  width: number;
  height: number;
}

describe.skipIf(!possible)("rendu réel d'une scène témoin dans chaque format", () => {
  it(
    "dimensions exactes et aucun bord noir",
    async () => {
      const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
      const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
      const { renderMedia, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
        selectComposition: (o: Record<string, unknown>) => Promise<Choisie>;
        renderMedia: (o: Record<string, unknown>) => Promise<unknown>;
      };
      const reglages = { browserExecutable: NAVIGATEUR, chromiumOptions: { gl: "swangle" } };
      const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
      const dossier = mkdtempSync(join(tmpdir(), "formats-"));
      for (const id of IDS_FORMATS_SORTIE) {
        const f = formatSortie(id);
        const { scenes } = scenesFormat(ficheDemonstration, id);
        // La scène la plus remplie de la page 2 (tout ce qui précède est déjà écrit).
        const p = scenes.filter((s) => s.page.page === 2).at(-1)!;
        const inputProps = p as unknown as Record<string, unknown>;
        const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
        expect([composition.width, composition.height], id).toEqual([f.largeur, f.hauteur]);
        const sortie = join(dossier, `${id}.mp4`);
        await renderMedia({ composition, serveUrl, codec: "h264", crf: 12, colorSpace: "bt709", frameRange: [0, 4], outputLocation: sortie, inputProps, ...reglages });
        const sonde = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", sortie], { encoding: "utf8" });
        expect(sonde.stdout.trim(), id).toBe(`${f.largeur},${f.hauteur}`);
        const image = spawnSync(FFMPEG, ["-v", "error", "-i", sortie, "-frames:v", "1", "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
        expect(bordsNoirs(image.stdout, f.largeur, f.hauteur), id).toEqual({ gauche: 0, droite: 0, haut: 0, bas: 0 });
      }
    },
    600_000,
  );
});
