// OUTIL DE MESURE DU RYTHME, partagé (contrôle du plan = mesure ; revue passe 3 du 15/10, priorité 1).
//
// Même calcul que `dynamisme.py` (25 i/s, 90 × 160 en gris, pixels qui changent de plus de 40 ; pic > 0,6 % et le plus
// fort de ± 2 images ; gros mouvement > 5 %), sans Python : seul ffmpeg est appelé (décodage léger, aucun rendu).
//
// Usage (tsx) :
//   tsx scripts/mesure-rythme.ts prevoir <plan.json>                → rythme PRÉVU par le contrôle (rythmePrevu)
//   tsx scripts/mesure-rythme.ts mesurer <video.mp4> [<plan.json>]  → rythme MESURÉ ; avec le plan : prévu contre mesuré
//   tsx scripts/mesure-rythme.ts etalonner <video.mp4> <plan.json>  → surface mesurée par genre d'événement du plan
//     (médiane et part au-dessus de 5 %) : à reporter dans SURFACES_SOUS_ELEMENTS (realisateur/rythme.ts) quand le rendu
//     d'une carte change de taille.
// Options : --trous (liste les trous de plus de 0,7 s), --pics (liste les pics prévus).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evenementsPrevus, rythmePrevu, MESURE_RYTHME } from "../src/moteurs/montage-facecam-animee/realisateur/rythme";
import type { PlanFacecamAnimee } from "../src/domaine/facecam-animee/plan";

const W = 90;
const H = 160;
const fmt = (x: number, d = 2) => x.toFixed(d).replace(".", ",");

export interface RythmeMesure {
  duree: number;
  z: Float64Array;
  pics: number[];
  grosParMinute: number;
  plusLongTrouSec: number;
  trous: [number, number, number][];
  evenementsParSec: number;
  ampleurMediane: number;
  zoneSousTitres: number;
}

/** Mesure d'une vidéo (identique à dynamisme.py). */
export function mesurerVideo(video: string): RythmeMesure {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `fps=25,scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr?.toString() ?? "échec"}`);
  const raw = r.stdout as Buffer;
  const n = Math.floor(raw.length / (W * H));
  const z = new Float64Array(n);
  let zs = 0;
  for (let i = 1; i < n; i++) {
    let c = 0;
    let cs = 0;
    const a = (i - 1) * W * H;
    const b = i * W * H;
    for (let p = 0; p < W * H; p++) {
      if (Math.abs(raw[b + p] - raw[a + p]) > 40) {
        c++;
        const y = Math.floor(p / W);
        if (y >= Math.floor(H * 0.55) && y < Math.floor(H * 0.85)) cs++;
      }
    }
    z[i] = (c / (W * H)) * 100;
    zs += (cs / (W * (Math.floor(H * 0.85) - Math.floor(H * 0.55)))) * 100;
  }
  const pics: number[] = [];
  for (let i = 2; i < n - 2; i++) {
    if (z[i] <= 0.6) continue;
    let m = -1;
    for (let k = i - 2; k <= i + 2; k++) m = Math.max(m, z[k]);
    if (z[i] === m) pics.push(i);
  }
  const duree = n / 25;
  const t = [0, ...pics.map((i) => i / 25), duree];
  const trous: [number, number, number][] = [];
  for (let k = 1; k < t.length; k++) trous.push([t[k] - t[k - 1], t[k - 1], t[k]]);
  const amp = pics.map((i) => z[i]).sort((x, y) => x - y);
  return {
    duree, z, pics,
    grosParMinute: (pics.filter((i) => z[i] > 5).length / duree) * 60,
    plusLongTrouSec: Math.max(...trous.map(([d]) => d)),
    trous,
    evenementsParSec: pics.length / duree,
    ampleurMediane: amp.length ? (amp[(amp.length - 1) >> 1] + amp[amp.length >> 1]) / 2 : 0,
    zoneSousTitres: zs / Math.max(1, n - 1),
  };
}

const lirePlan = (f: string) => JSON.parse(readFileSync(f, "utf8")) as PlanFacecamAnimee;

function afficherPrevu(plan: PlanFacecamAnimee, options: string[]) {
  const r = rythmePrevu(plan);
  const longs = r.trous.filter(([d]) => d > 0.7 + 1e-6).sort((a, b) => b[0] - a[0]);
  console.log(`PRÉVU   gros/min ${fmt(r.grosParMinute, 1)}  plus long trou ${fmt(r.plusLongTrouSec)} s  trous > 0,7 s : ${longs.length}`);
  if (options.includes("--trous")) for (const [d, a, z] of longs) console.log(`   trou ${fmt(d)} s  ${fmt(a)} → ${fmt(z)}`);
  if (options.includes("--pics")) for (const p of r.pics) console.log(`   ${fmt(p.t)}  ${fmt(p.surface, 1)} %  ${p.gros >= 0.5 ? "G" : " "}  ${p.quoi.join(", ")}`);
  return r;
}

function principal() {
  const [mode, a, b] = process.argv.slice(2);
  const options = process.argv.slice(2).filter((x) => x.startsWith("--"));
  if (mode === "prevoir" && a) return void afficherPrevu(lirePlan(a), options);
  if ((mode === "mesurer" || mode === "etalonner") && a) {
    const m = mesurerVideo(a);
    const longs = m.trous.filter(([d]) => d > 0.7 + 1e-6).sort((x, y) => y[0] - x[0]);
    console.log(`MESURÉ  gros/min ${fmt(m.grosParMinute, 1)}  plus long trou ${fmt(m.plusLongTrouSec)} s  trous > 0,7 s : ${longs.length}  (événements/s ${fmt(m.evenementsParSec)}, ampleur médiane ${fmt(m.ampleurMediane)} %, zone sous-titres ${fmt(m.zoneSousTitres)} %)`);
    if (options.includes("--trous")) for (const [d, x, y] of longs) console.log(`   trou ${fmt(d)} s  ${fmt(x)} → ${fmt(y)}`);
    if (!b) return;
    const plan = lirePlan(b);
    if (mode === "mesurer") {
      const p = afficherPrevu(plan, options);
      const e = (x: number, y: number) => `${x >= y ? "+" : ""}${fmt(((x - y) / y) * 100, 1)} %`;
      console.log(`ÉCART   gros/min ${e(p.grosParMinute, m.grosParMinute)}  plus long trou ${e(p.plusLongTrouSec, m.plusLongTrouSec)}`);
      return;
    }
    // Étalonnage : pour chaque genre d'événement prévu, le pic mesuré le plus fort à −1 / +3 images.
    const pk = new Float64Array(m.z.length);
    for (const i of m.pics) pk[i] = m.z[i];
    const parGenre = new Map<string, number[]>();
    for (const ev of evenementsPrevus(plan)) {
      const i = Math.round(ev.t * MESURE_RYTHME.fps);
      let v = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(pk.length - 1, i + 2); k++) v = Math.max(v, pk[k]);
      const genre = ev.quoi.replace(/\s*\((carte|calque) \d+[^)]*\)|\s+\d+/g, "").replace(/\(\d,\d+ H\)|\(\d\.\d+ H\)/, "").trim();
      parGenre.set(genre, [...(parGenre.get(genre) ?? []), v]);
    }
    for (const [g, v] of [...parGenre].sort()) {
      const s = [...v].sort((x, y) => x - y);
      console.log(`${g.padEnd(48)} n=${String(s.length).padStart(3)}  médiane ${fmt(s[(s.length - 1) >> 1], 1).padStart(5)} %  > 5 % : ${String(Math.round((s.filter((x) => x > 5).length / s.length) * 100)).padStart(3)} %`);
    }
    return;
  }
  console.log("Usage : tsx scripts/mesure-rythme.ts prevoir <plan.json> | mesurer <video.mp4> [<plan.json>] | etalonner <video.mp4> <plan.json> [--trous] [--pics]");
}

if (process.argv[1] && /mesure-rythme/.test(process.argv[1])) principal();
