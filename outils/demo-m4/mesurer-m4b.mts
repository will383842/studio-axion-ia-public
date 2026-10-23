/**
 * LOT M4b — où passe le temps du montage FFmpeg, et combien de TEMPS PROCESSEUR il coûte (pour estimer le serveur).
 * Rejoue, sur les fichiers préparés par `rendre-demo.mts` (dossier temporaire `studio-m4-demo/m4b-rendu-9x16`), la
 * passe « calques image + couleurs → master » puis l'export, avec `-benchmark` de FFmpeg (durée, temps processeur
 * utilisateur + système, mémoire maximale). Le temps processeur divisé par les cœurs donnés au conteneur donne une
 * borne basse de la durée sur le serveur.
 * Usage : `pnpm exec tsx outils/demo-m4/mesurer-m4b.mts [fils FFmpeg, 0 = tous]`.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DOSSIER = join(tmpdir(), "studio-m4-demo", "m4b-rendu-9x16");
const PARAMETRES = join(tmpdir(), "studio-m4-demo", "parametres-9x16.json");
if (!existsSync(PARAMETRES)) throw new Error("Lancez d'abord outils/demo-m4/rendre-demo.mts");
const fils = Number(process.argv[2] ?? 0);
const { argumentsImageFfmpeg } = await import("../../studio-rendu/src/composition/image-ffmpeg");
const { argumentsExport } = await import("../../studio-rendu/src/composition/ffmpeg");
type P = Parameters<typeof argumentsImageFfmpeg>;
const m = JSON.parse(readFileSync(PARAMETRES, "utf8")) as { image: P[0]; couleurs: P[1]; fichiers: P[2]; dureeSec: number; export: Parameters<typeof argumentsExport>[2] };

function lancer(args: string[]): Promise<{ reel: number; processeur: number; memoireMo: number }> {
  return new Promise((ok, ko) => {
    const p = spawn("ffmpeg", ["-benchmark", ...args], { cwd: DOSSIER });
    let erreurs = "";
    p.stderr.on("data", (d) => (erreurs = (erreurs + d).slice(-20000)));
    p.on("close", (code) => {
      if (code !== 0) return ko(new Error(erreurs.slice(-2000)));
      const b = /bench: utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/.exec(erreurs);
      const rss = /bench: maxrss=(\d+)\s*KiB/i.exec(erreurs) ?? /bench: maxrss=(\d+)kB/i.exec(erreurs);
      ok({ reel: Number(b?.[3] ?? NaN), processeur: Number(b?.[1] ?? NaN) + Number(b?.[2] ?? NaN), memoireMo: Math.round(Number(rss?.[1] ?? NaN) / 1024) });
    });
  });
}

const resultat: Record<string, { reel: number; processeur: number; memoireMo: number }> = {};
resultat.imageEtCouleurs = await lancer(argumentsImageFfmpeg(m.image, m.couleurs, m.fichiers, m.dureeSec, "mesure-master.mov", { fils: fils || undefined }));
const texte = readdirSync(DOSSIER).filter((f) => f.startsWith("texte-")).sort().pop()!;
const ex = argumentsExport("mesure-master.mov", join(texte, "liste.txt"), m.export, "mesure-passe", "mesure-video.mp4", fils || undefined);
if (ex.passe1.length) resultat.exportPasse1 = await lancer(ex.passe1);
resultat.export = await lancer(ex.passe2);
for (const [k, v] of Object.entries(resultat)) console.log(`${k} : ${v.reel.toFixed(1)} s, processeur ${v.processeur.toFixed(1)} s (×${(v.processeur / v.reel).toFixed(1)}), mémoire ${v.memoireMo} Mo`);
console.log(JSON.stringify({ fils: fils || "tous", ...resultat }));
