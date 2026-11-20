import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { controles } from "../../studio-rendu/src/controle-ffmpeg";

const NOM = "recollage par plages (T-EXT-52c-c : tronçon d'avant + morceau neuf, -c copy, mêmes images, 1 flux vidéo + 1 audio)";
const NOM_G11_04 = "recollage de deux mini-exports recollables (G11-04 : -c copy, mêmes images, temps croissants, son posé une fois)";

describe("liste des contrôles (T-EXT-52c-c)", () => {
  it("contient l'entrée neuve une seule fois et garde les entrées d'avant (noms figés)", () => {
    const noms = controles("/tmp/inutile").map((c) => c.nom);
    expect(noms.filter((n) => n === NOM)).toHaveLength(1);
    for (const n of ["source : prise 8 bits", "source : voix", NOM_G11_04]) expect(noms).toContain(n);
    expect(noms.some((n) => n.includes("graphe écran divisé"))).toBe(true);
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
