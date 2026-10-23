/**
 * CONTRÔLE RÉEL DE FFMPEG DANS L'IMAGE DU STUDIO (panne du 15/10 : `ffmpeg` absent du conteneur `studio`, la lecture de
 * l'image d'une vidéo « Image → vidéo » s'arrêtait sur « L'image n'a pas pu être préparée pour la lecture » ; la mesure
 * des images noires et figées (Q24) serait restée « non mesurée »). Les commandes du format sont EXÉCUTÉES avec le FFmpeg
 * de l'image, avec les MÊMES fabriques d'arguments que la production (`src/moteurs/montage-image-video/commandes-ffmpeg.ts`)
 * et la MÊME préparation de l'image (`lecture/preparation.ts` : plan, morceaux, contrôle des PNG reçus) :
 *   - conversion en PNG (`argumentsMorceau`) : image entière et 4 tuiles, depuis un PNG, un JPEG, un WebP et un GIF ;
 *   - images noires et figées (`argumentsNoirEtFige` + `lireNoirEtFige`) : un fichier avec 0,5 s de noir et 1 s figée
 *     doit être mesuré comme tel, un fichier sans défaut doit donner 0 ;
 *   - son brut MP3 → WAV mono (`argumentsSonWav`, 15/10 v-dd3049053f88 : la copie HeyGen est un MP3, l'assemblage mesure
 *     ses silences en WAV) : WAV PCM 16 bits mono, à la fréquence du MP3, son posé à 0,5 s retrouvé à 0,5 s (± 5 ms).
 *
 * Lancé par `deploiement/verifier-outils-video.sh` dans l'image fraîchement construite, sans réseau, AVANT toute mise en
 * ligne ; et par `tests/image-video/ffmpeg-studio.test.ts` avec le FFmpeg du poste.
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON deploiement/studio/controle-ffmpeg-iv.mjs
 *     → une ligne par contrôle, code 1 si un seul échoue
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { argumentsMorceau, argumentsNoirEtFige, argumentsSonWav, lireNoirEtFige } from "../../src/moteurs/montage-image-video/commandes-ffmpeg.ts";
import { preparerImage } from "../../src/moteurs/montage-image-video/lecture/preparation.ts";

/** Commandes du format exécutées ici (le test vérifie que chaque `execFile("ffmpeg", …)` du studio y figure). */
export const COMMANDES_CONTROLEES = ["argumentsMorceau", "argumentsNoirEtFige", "argumentsSonWav"];

/** `execFile` en promesse ; `options` : celles de la production. */
function lancer(ffmpeg, args, options) {
  return new Promise((ok, ko) => execFile(ffmpeg, args, options, (e, sortie, erreurs) => (e ? ko(Object.assign(e, { erreurs: String(erreurs ?? "") })) : ok({ sortie, erreurs: String(erreurs) }))));
}

/** Même conversion que `convertirParFfmpeg` (src/services/image-video.ts) : mêmes arguments, mêmes options. */
function convertisseur(ffmpeg, dossier) {
  return async (d) => {
    const entree = join(dossier, `conversion.${d.format === "jpeg" ? "jpg" : d.format}`);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(entree, d.octets);
    const sorties = [];
    for (const m of d.morceaux) sorties.push(new Uint8Array((await lancer(ffmpeg, argumentsMorceau(entree, m), { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 60_000 })).sortie));
    return sorties;
  };
}

/** Mesure comme `mesurerNoirEtFigeParFfmpeg` (src/services/image-video.ts) : mêmes arguments, mêmes options. */
async function mesurer(ffmpeg, fichier, dureeSec) {
  const { erreurs } = await lancer(ffmpeg, argumentsNoirEtFige(fichier), { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60_000 });
  return lireNoirEtFige(erreurs, dureeSec);
}

/** WAV PCM 16 bits : format, fréquence, canaux, durée et instant du premier échantillon audible (au-dessus de 1 %). */
function lireWavSimple(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("la sortie n'est pas un WAV");
  let fmt = null;
  for (let i = 12; i + 8 <= b.length; ) {
    const id = tag(i);
    const taille = v.getUint32(i + 4, true);
    if (id === "fmt ") fmt = { format: v.getUint16(i + 8, true), canaux: v.getUint16(i + 10, true), frequence: v.getUint32(i + 12, true), bits: v.getUint16(i + 22, true) };
    else if (id === "data" && fmt) {
      const n = Math.floor(Math.min(taille, b.length - i - 8) / 2);
      let premier = -1;
      for (let k = 0; k < n && premier < 0; k++) if (Math.abs(v.getInt16(i + 8 + k * 2, true)) > 328) premier = k;
      return { ...fmt, dureeSec: n / fmt.frequence, debutSonSec: premier / fmt.frequence };
    }
    i += 8 + taille + (taille % 2);
  }
  throw new Error("WAV sans données");
}

/** Sources lavfi (fabriquées par le même FFmpeg) : images de chaque format accepté, vidéos de 2,5 s. */
const SOURCES = [
  { fichier: "portrait.png", args: ["-f", "lavfi", "-i", "testsrc2=s=1200x1600", "-frames:v", "1"] },
  { fichier: "paysage.jpg", args: ["-f", "lavfi", "-i", "testsrc2=s=2400x1350", "-frames:v", "1", "-q:v", "3"] },
  { fichier: "carre.webp", args: ["-f", "lavfi", "-i", "testsrc2=s=1000x1000", "-frames:v", "1"] },
  { fichier: "portrait.gif", args: ["-f", "lavfi", "-i", "testsrc2=s=900x1200", "-frames:v", "1"] },
  // 0,5 s de noir, 1 s qui bouge, 1 s figée (dernière image répétée).
  { fichier: "defauts.mp4", args: ["-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=0.5", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=1,tpad=stop_mode=clone:stop_duration=1", "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"] },
  // Son brut comme la copie HeyGen : MP3 24 kHz mono, 0,5 s de silence, 1 s de son, 0,5 s de silence.
  { fichier: "brut.mp3", args: ["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.5", "-f", "lavfi", "-i", "sine=f=300:r=24000:d=1", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.5", "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-c:a", "libmp3lame", "-b:a", "64k"] },
  { fichier: "propre.mp4", args: ["-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=2.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"] },
];

/** Exécute chaque contrôle ; jamais d'exception (un échec est une ligne). */
export async function controlerFfmpegIV(ffmpeg = process.env.FFMPEG ?? "ffmpeg") {
  const resultats = [];
  const dossier = await mkdtemp(join(tmpdir(), "controle-iv-"));
  const controle = async (nom, f) => {
    const t0 = Date.now();
    try {
      await f();
      resultats.push({ nom, ok: true, dureeMs: Date.now() - t0 });
    } catch (e) {
      const detail = e && typeof e === "object" && "erreurs" in e && e.erreurs ? ` — ${String(e.erreurs).trim().split("\n").slice(-3).join(" | ")}` : "";
      resultats.push({ nom, ok: false, dureeMs: Date.now() - t0, erreur: `${e instanceof Error ? e.message : String(e)}${detail}` });
    }
  };
  try {
    for (const s of SOURCES) await controle(`source : ${s.fichier}`, () => lancer(ffmpeg, ["-v", "error", "-nostdin", "-y", ...s.args, join(dossier, s.fichier)], { timeout: 120_000 }));
    for (const fichier of ["portrait.png", "paysage.jpg", "carre.webp", "portrait.gif"])
      await controle(`conversion en PNG, image entière et 4 tuiles (argumentsMorceau) : ${fichier}`, async () => {
        const r = await preparerImage(new Uint8Array(await readFile(join(dossier, fichier))), convertisseur(ffmpeg, dossier));
        if (!r.ok) throw new Error(`préparation refusée (${r.motif}) : ${r.message}`);
        if (r.tuiles.length !== 4) throw new Error(`${r.tuiles.length} tuiles au lieu de 4`);
      });
    await controle("images noires et figées mesurées (argumentsNoirEtFige) : 0,5 s de noir, 1 s figée", async () => {
      const m = await mesurer(ffmpeg, join(dossier, "defauts.mp4"), 2.5);
      if (Math.abs(m.noirMaxSec - 0.5) > 0.1 || m.figeMaxSec < 0.8 || m.figeMaxSec > 1.2) throw new Error(`mesure fausse : noir ${m.noirMaxSec} s, figée ${m.figeMaxSec} s`);
    });
    await controle("images noires et figées mesurées (argumentsNoirEtFige) : fichier sans défaut", async () => {
      const m = await mesurer(ffmpeg, join(dossier, "propre.mp4"), 2.5);
      if (m.noirMaxSec !== 0 || m.figeMaxSec !== 0) throw new Error(`défaut inventé : noir ${m.noirMaxSec} s, figée ${m.figeMaxSec} s`);
    });
    await controle("son brut MP3 converti en WAV mono, sans décalage (argumentsSonWav)", async () => {
      const sortie = join(dossier, "brut.wav");
      await lancer(ffmpeg, argumentsSonWav(join(dossier, "brut.mp3"), sortie), { timeout: 120_000 });
      const w = lireWavSimple(new Uint8Array(await readFile(sortie)));
      if (w.format !== 1 || w.bits !== 16 || w.canaux !== 1 || w.frequence !== 24000) throw new Error(`WAV inattendu : format ${w.format}, ${w.bits} bits, ${w.canaux} canal(aux), ${w.frequence} Hz`);
      if (Math.abs(w.debutSonSec - 0.5) > 0.005 || Math.abs(w.dureeSec - 2) > 0.03) throw new Error(`son décalé : début ${w.debutSonSec} s (0,5 attendu), durée ${w.dureeSec} s (2 attendu)`);
    });
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
  return resultats;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
  const version = await lancer(ffmpeg, ["-hide_banner", "-version"], {}).then((r) => String(r.sortie).split("\n")[0], (e) => `FFmpeg introuvable (${e instanceof Error ? e.message : String(e)})`);
  console.log(`Format « Image → vidéo » côté studio — ${version}`);
  const r = await controlerFfmpegIV(ffmpeg);
  for (const x of r) console.log(`${x.ok ? "OK   " : "ÉCHEC"} ${x.nom} (${x.dureeMs} ms)${x.ok ? "" : `\n      ${x.erreur}`}`);
  process.exit(r.every((x) => x.ok) ? 0 : 1);
}
