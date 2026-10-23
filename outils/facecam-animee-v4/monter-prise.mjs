/**
 * Monte la prise complète de Will (IMG_7747) selon les intervalles gardés de `transcription.json` : 30 i/s, image par image, voix comprise.
 *   node outils/facecam-animee-v4/monter-prise.mjs <sortie.mp4>
 * (les coupes viennent de `preparer-prise.ts`, c'est-à-dire de la chaîne réelle `calculerCoupes` ; aucun zoom ni recadrage, le fond n'est pas touché.)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const sortie = process.argv[2];
if (!sortie) throw new Error("Usage : node monter-prise.mjs <sortie.mp4>");
const t = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/transcription.json", "utf8"));
const g = t.gardes;
const filtre =
  g.map((x, i) => `[0:v]trim=start=${x.debutSec}:end=${x.finSec},setpts=PTS-STARTPTS,fps=30[v${i}];[0:a]atrim=start=${x.debutSec}:end=${x.finSec},asetpts=PTS-STARTPTS[a${i}];`).join("") +
  g.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${g.length}:v=1:a=1[v][a]`;
const script = join(tmpdir(), "filtre-monter-prise.txt");
writeFileSync(script, filtre);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", resolve(t.prise), "-filter_complex_script", script, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", resolve(sortie)], { stdio: "inherit" });
console.log("monté", sortie, "durée attendue", t.dureeMonteeSec, "s");
