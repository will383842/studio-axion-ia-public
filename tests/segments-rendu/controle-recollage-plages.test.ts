import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { controles } from "../../studio-rendu/src/controle-ffmpeg";

const NOM = "recollage par plages (T-EXT-52c-c : tronçon d'avant + morceau neuf, -c copy, mêmes images, 1 flux vidéo + 1 audio)";
const NOM_G11_04 = "recollage de deux mini-exports recollables (G11-04 : -c copy, mêmes images, temps croissants, son posé une fois)";

const NOMS_MASTER = [
  "version",
  "ffprobe",
  "source : prise 8 bits",
  "source : prise 10 bits",
  "source : décor",
  "source : carte",
  "source : voix",
  "source : voix des fondus",
  "source : illustration 0",
  "source : illustration 1",
  "source : calques texte",
  "source : LUT (ecrireCube)",
  "source : liste concat du texte",
  "chaîne du son (preparerSon : loudnorm, voix, limiteur, ebur128)",
  "master avocat 8 bits (argumentsImageFfmpeg)",
  "master face caméra 10 bits (argumentsImageFfmpeg)",
  "master tableau 8 bits avec fondus entre illustrations (argumentsImageFfmpeg + xfade)",
  "source : dégradé de mur 10 bits",
  "master face caméra 10 bits : aucune bande sur le dégradé du mur",
  "source : mire face caméra 10 bits (mur, peau, sweat)",
  "master face caméra 10 bits avec zoom et carte plein écran : couleurs de l'image filmée gardées",
  "export 10 bits avec zoom et carte plein écran : couleurs gardées, garde-fou des couleurs (juste : livré ; aberrant : arrêté)",
  "master M4 (argumentsMaster + grapheCouleurs)",
  "étalonnage d'une vidéo (filtreEtalonnage + LUT)",
  "export 8 bits, 2 passes (grapheExport, libx264 High 4.1)",
  "export 8 bits, CRF, séquence PNG",
  "export 10 bits, 2 passes (grapheExport 10 bits)",
  "export 10 bits, CRF",
  "note VMAF de l'export 10 bits (libvmaf contre le graphe d'export)",
  "export dégradé (CRF 45) : note VMAF sous 93, relance UNIQUE plus fine (noterEtRelancer)",
  "graphe écran divisé (grapheEcranDivise, visage + écran)",
  "recollage de deux mini-exports recollables (G11-04 : -c copy, mêmes images, temps croissants, son posé une fois)",
];

describe("liste des contrôles (T-EXT-52c-c)", () => {
  it("contient l'entrée neuve une seule fois et garde les entrées d'avant (noms figés)", () => {
    const noms = controles("/tmp/inutile").map((c) => c.nom);
    expect(noms.filter((n) => n === NOM)).toHaveLength(1);
    const i = NOMS_MASTER.findIndex((n) => n.includes("graphe écran divisé"));
    expect(i).toBeGreaterThan(0);
    expect(noms).toEqual([...NOMS_MASTER.slice(0, i), NOM, ...NOMS_MASTER.slice(i)]);
  });
  it("le texte du contrôle passe par les fonctions pures de recollage-plages", async () => {
    const texte = await readFile(join(__dirname, "../../studio-rendu/src/controle-ffmpeg.ts"), "utf8");
    expect(texte).toContain("listeConcatPlages");
    expect(texte).toContain("imagesDans");
  });
});

const ffmpeg = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-hide_banner", "-version"]).status === 0;
if (!ffmpeg) console.warn("[controle-recollage-plages] FFmpeg introuvable : contrôle réel NON exécuté, test sauté.");

describe.skipIf(!ffmpeg)("recollage par plages réel (T-EXT-52c-c)", () => {
  it("prise, voix puis recollage par plages : aucune exception", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "recollage-plages-"));
    try {
      const liste = controles(dossier);
      for (const nom of ["source : prise 8 bits", "source : voix", NOM]) {
        const c = liste.find((x) => x.nom === nom);
        expect(c, nom).toBeDefined();
        await c!.executer();
      }
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  }, 120_000);
});
