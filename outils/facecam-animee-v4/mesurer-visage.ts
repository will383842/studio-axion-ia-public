/**
 * MESURE du visage à moitié couvert SUR LE RENDU (critère de Will : jamais plus de 2 images d'affilée) : le plan est rendu SANS la prise (fond magenta uni 0xFF00FF, voir
 * `mesurer-rendu.mjs`) ; pour chaque image, on prend la boîte du visage de la prise DESCENDUE de D(f) (descente réelle du registre), on compte la part de pixels qui
 * ne sont plus le magenta uni (= couverts par une plaquette). Visage entier ≤ 3 %, couvert ≥ 97 %, entre les deux = « à moitié couvert ».
 *   npx tsx outils/facecam-animee-v4/mesurer-visage.ts <plan.json> <sans-prise.mp4>
 * Sortie : JSON { images, partiellesMax, suites: [{ debutSec, images }…] } (suites de plus de 2 images d'affilée à part).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { descenteA, type ChangementD } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4";
import { ficheV4 } from "../../src/moteurs/montage-facecam-animee/realisateur/catalogue-v4";

const [fichierPlan, video] = process.argv.slice(2);
if (!fichierPlan || !video) throw new Error("Usage : mesurer-visage.ts <plan.json> <sans-prise.mp4>");
const plan = JSON.parse(readFileSync(fichierPlan, "utf8"));
const L = 270, H = 480;
const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `fps=30,scale=${L}:${H}`, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
const brut = r.stdout;
const n = Math.floor(brut.length / (L * H * 3));
/** Même calcul que `clesDescenteV4` du registre de rendu (descente de la fiche du catalogue ; la prise bouge dans la même image que la plaquette qui entre). */
const tries = [...plan.elementsV4].sort((a: { debut: number }, b: { debut: number }) => a.debut - b.debut);
const cles: ChangementD[] = [];
let courant = 0;
for (const e of tries) {
  const f = ficheV4(e.id)!;
  if (Math.abs(f.descente - courant) > 1e-9) { cles.push({ i: Math.round(e.debut * 30) + (f.couvreVisage ? Number(process.env.DECALAGE ?? 0) : 0), D: f.descente }); courant = f.descente; }
}
if (tries.length && courant > 0) cles.push({ i: Math.round(tries[tries.length - 1].fin * 30) + 1, D: 0 });
const descenteReelleV4 = descenteA;
const { centreX, largeurVisage, yeux } = plan.prise;
const x0 = Math.round((centreX - largeurVisage / 2) * L), x1 = Math.round((centreX + largeurVisage / 2) * L);
const etats: ("entier" | "couvert" | "partiel")[] = [];
const parts: number[] = [];
for (let f = 0; f < n; f++) {
  const d = descenteReelleV4(f, cles);
  const y0 = Math.max(0, Math.round((yeux - 0.09 + d) * H)), y1 = Math.min(H, Math.round((yeux + 0.15 + d) * H));
  let couvert = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    total++;
    const o = (f * L * H + y * L + x) * 3;
    // La prise est remplacée par du magenta uni (≈ 253, 35, 253 après encodage) : tout pixel qui s'en écarte est couvert par une plaquette.
    if (!(brut[o] > 215 && brut[o + 2] > 215 && brut[o + 1] < 75)) couvert++;
  }
  const part = total ? couvert / total : 0;
  parts.push(part);
  etats.push(part <= 0.03 ? "entier" : part >= 0.97 ? "couvert" : "partiel");
}
const suites: { debutSec: number; images: number; parts: number[] }[] = [];
for (let f = 0; f < n; f++) {
  if (etats[f] !== "partiel") continue;
  let g = f;
  while (g + 1 < n && etats[g + 1] === "partiel") g++;
  suites.push({ debutSec: +(f / 30).toFixed(2), images: g - f + 1, parts: parts.slice(f, g + 1).map((p) => +p.toFixed(2)) });
  f = g;
}
console.log(JSON.stringify({ images: n, entieres: etats.filter((e) => e === "entier").length, couvertes: etats.filter((e) => e === "couvert").length, partiellesMin3pc: parts.filter((p) => p > 0.01 && p < 0.99).length, partiellesMax: Math.max(0, ...suites.map((s) => s.images)), suites: suites.filter((s) => s.images >= 2) , suitesDeUneImage: suites.filter((s) => s.images === 1).length }));
