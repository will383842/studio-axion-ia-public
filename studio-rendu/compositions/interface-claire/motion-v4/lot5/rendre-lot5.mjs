/**
 * Rend les extraits (540×960, 30 i/s) et l'enchaînement de 15 s du lot 5. À lancer DANS LE CLOUD, un rendu à la fois.
 * Usage : node rendre-lot5.mjs <dossier-sortie> <dossier-de-travail> <normal|visage|stills> [id ...]
 *   id = un élément (dalle-claquee, rafale-trois-mots, duel-video, mot-derriere, element-barre, element-barre-pictos, appel-final-pile, panneau-fin)
 *        ou « enchainement » ; sans id : tout. Palette B uniquement. Variable FOND (prise|blanc|noir|broll) : test des 4 fonds.
 *   Mode « stills » : images fixes (variables d'environnement IMAGES="12,14,20" et PALETTE=A) pour itérer vite.
 * Le dossier de travail (publicDir assemblé + bundle) est le SEUL à effacer ensuite.
 * Remotion rend en H.264 crf 18 puis ffmpeg ré-encode en crf 28 (< 3 Mo par fichier).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const ici = import.meta.dirname;
const v4 = resolve(ici, "..");
const sons = resolve(v4, "..", "sons");
const [sortie, travail, mode = "normal", ...ids] = process.argv.slice(2);
const navigateur = process.env.NAVIGATEUR ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const TOUS = ["dalle-claquee", "rafale-trois-mots", "duel-video", "mot-derriere", "element-barre", "element-barre-pictos", "appel-final-pile", "panneau-fin", "enchainement"];
const PALETTES = process.env.PALETTE ? [process.env.PALETTE] : ["B"]; // palette B orange seule (décision de Will, standard § K)
const FOND = process.env.FOND ?? "prise"; // prise | blanc | noir | broll (test des 4 fonds, standard § J.5)
mkdirSync(sortie, { recursive: true });
mkdirSync(travail, { recursive: true });

/** Bruitages maison (synthèse ffmpeg, aucun échantillon tiers) : voir `sons/LISEZMOI.md`. */
function fabriquerSons() {
  const dossier = resolve(ici, "sons");
  const f = (nom, args) => { if (!existsSync(join(dossier, nom))) execFileSync("ffmpeg", ["-v", "error", "-y", ...args, "-ac", "1", "-c:a", "pcm_s16le", join(dossier, nom)]); };
  f("boum.wav", ["-f", "lavfi", "-i", "aevalsrc='0.72*sin(2*PI*(42*t+4*(1-exp(-t/0.05))))*exp(-t/0.13)+0.2*sin(2*PI*(90*t))*exp(-t/0.05)':d=0.55:s=48000"]);
  f("whoosh-grave.wav", ["-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.9:r=48000:seed=7", "-af", "lowpass=f=650,highpass=f=60,afade=t=in:st=0:d=0.28,afade=t=out:st=0.3:d=0.4,volume=2.2,alimiter=limit=0.89"]);
  f("montee.wav", ["-f", "lavfi", "-i", "aevalsrc='0.6*sin(2*PI*(1200*t+(1400/1.2)*t*t))+0.18*sin(2*PI*2*(1200*t+(1400/1.2)*t*t))':d=0.62:s=48000", "-af", "afade=t=in:st=0:d=0.03,afade=t=out:st=0.44:d=0.18,alimiter=limit=0.89"]);
}
fabriquerSons();

// publicDir : prise de 15 s, B-roll, bruitages (studio + maison).
const publicDir = resolve(travail, "public");
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
  cpSync(resolve(v4, "communs", "prise-commune-15s.mp4"), join(publicDir, "prise-commune-15s.mp4"));
  cpSync(resolve(v4, "communs", "broll"), join(publicDir, "broll"), { recursive: true });
  cpSync(resolve(ici, "polices"), join(publicDir, "polices"), { recursive: true });
  cpSync(resolve(ici, "marque"), join(publicDir, "marque"), { recursive: true });
  mkdirSync(join(publicDir, "sons"), { recursive: true });
  for (const d of [sons, resolve(ici, "sons")]) for (const n of readdirSync(d)) if (n.endsWith(".wav")) cpSync(join(d, n), join(publicDir, "sons", n));
}
const serveUrl = await bundle({ entryPoint: resolve(ici, "PlancheLot5.tsx"), publicDir, outDir: resolve(travail, "bundle") });
const choisis = ids.length ? ids : TOUS;

for (const id of choisis) {
  for (const palette of PALETTES) {
    const enchainement = id === "enchainement";
    const inputProps = enchainement ? { palette, fond: FOND, mode: mode === "visage" ? "visage" : "normal" } : { element: id, palette, fond: FOND, mode: mode === "visage" ? "visage" : "normal" };
    const composition = await selectComposition({ serveUrl, id: enchainement ? "EnchainementLot5" : "ExtraitLot5", inputProps, browserExecutable: navigateur });
    if (mode === "stills") {
      const images = (process.env.IMAGES ?? "10,20,30").split(",").map(Number);
      for (const fr of images) {
        await renderStill({ composition, serveUrl, output: resolve(sortie, `st-${id}-${FOND}-${String(fr).padStart(3, "0")}.png`), frame: fr, inputProps, scale: 0.5, browserExecutable: navigateur, timeoutInMilliseconds: 180000 });
      }
      console.log(id, palette, "stills ok");
      continue;
    }
    const nom = enchainement ? `lot5-enchainement-15s-${palette}` : `${id}-${palette}`;
    const brut = resolve(travail, `${nom}-brut.mp4`);
    await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, scale: 0.5, outputLocation: brut, inputProps, concurrency: 2, browserExecutable: navigateur, timeoutInMilliseconds: 240000, pixelFormat: "yuv420p", audioCodec: "aac" });
    const final = resolve(sortie, `${mode === "visage" ? "visage-" : ""}${nom}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", brut, "-c:v", "libx264", "-preset", "slow", "-crf", process.env.CRF ?? "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-movflags", "+faststart", final]);
    console.log(nom, "ok", (statSync(final).size / 1e6).toFixed(2), "Mo");
  }
}
void renameSync;
