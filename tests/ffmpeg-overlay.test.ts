/**
 * Panne d'export du 09/10 : `overlay=format=yuv444p10` refusé par le FFmpeg 5.1 de Debian, alors dans l'image
 * `studio-rendu`. Depuis, l'image embarque FFmpeg 8.1.1 (empreinte figée dans deploiement/studio-rendu/Dockerfile) et
 * les commandes sont EXÉCUTÉES avant chaque mise en ligne (deploiement/verifier-outils-video.sh, tests/ffmpeg-reel).
 * Ici, sans FFmpeg : toute valeur `overlay=…format=X` des graphes produits, et de celles écrites en dur dans
 * `studio-rendu/src`, doit appartenir à la liste de FFmpeg 8.1.1 (`ffmpeg -h filter=overlay`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { grapheExport } from "../studio-rendu/src/composition/ffmpeg";
import { FORMATS_10_BITS, FORMATS_8_BITS } from "../studio-rendu/src/composition/image-ffmpeg";

/** Valeurs de `overlay=format` de FFmpeg 8.1.1 (relevées par `ffmpeg -h filter=overlay` ; 5.1 n'avait pas `yuv444p10`). */
const FORMATS_OVERLAY_FFMPEG_81 = ["yuv420", "yuv420p10", "yuv422", "yuv422p10", "yuv444", "yuv444p10", "rgb", "gbrp", "auto"];

/** Valeurs `format=` des filtres `overlay` d'un graphe (options séparées par `:`, expressions entre apostrophes ignorées). */
function formatsOverlay(graphe: string): string[] {
  const valeurs: string[] = [];
  for (const m of graphe.matchAll(/overlay=((?:'[^']*'|\$\{[^}]*\}|[^,;[\]`"])*)/g)) {
    const options = m[1].replace(/'[^']*'/g, "''").replace(/\$\{[^}]*\}/g, "_");
    for (const o of options.split(":")) if (o.startsWith("format=")) valeurs.push(o.slice("format=".length));
  }
  return valeurs;
}

function fichiersTs(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiersTs(join(dossier, e.name)) : e.name.endsWith(".ts") || e.name.endsWith(".tsx") ? [join(dossier, e.name)] : []);
}

describe("FFmpeg 8.1 de l'image : overlay=format", () => {
  it("le lecteur d'options trouve bien les formats (témoin)", () => {
    expect(formatsOverlay("[a][b]overlay=format=yuv444p10:eof_action=pass[o]")).toEqual(["yuv444p10"]);
    expect(formatsOverlay("[a][b]overlay=x='1+(2-1)*min(1,t)':y=0:eval=frame:format=gbrp,format=gbrp[m]")).toEqual(["gbrp"]);
  });

  it("graphes de l'export (8 et 10 bits) : formats d'overlay connus de FFmpeg 8.1", () => {
    for (const dix of [false, true]) {
      const f = formatsOverlay(grapheExport(dix));
      expect(f.length).toBeGreaterThan(0);
      for (const v of f) expect(FORMATS_OVERLAY_FFMPEG_81).toContain(v);
    }
    expect(grapheExport(true)).toContain("overlay=format=yuv444p10");
  });

  it("aucun overlay=…format=X hors liste FFmpeg 8.1 écrit dans studio-rendu/src", () => {
    const racine = resolve(__dirname, "../studio-rendu/src");
    let vus = 0;
    for (const fichier of fichiersTs(racine)) {
      for (const v of formatsOverlay(readFileSync(fichier, "utf8"))) {
        vus++;
        // V6 : `format=${fOv}` (variable du graphe) — ses deux valeurs sont vérifiées plus bas.
        if (v === "_") continue;
        expect(FORMATS_OVERLAY_FFMPEG_81, `${fichier} : overlay format=${v}`).toContain(v);
      }
    }
    expect(vus).toBeGreaterThan(5);
  });

  it("V6 : formats d'overlay du graphe de composition (8 et 10 bits) connus de FFmpeg 8.1", () => {
    expect(FORMATS_OVERLAY_FFMPEG_81).toContain(FORMATS_8_BITS.ov);
    expect(FORMATS_OVERLAY_FFMPEG_81).toContain(FORMATS_10_BITS.ov);
  });
});
